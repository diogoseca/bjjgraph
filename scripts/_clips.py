#!/usr/bin/env python3
"""Shared helpers for the curated YouTube clips pipeline (source_clips.py /
verify_clips.py).

Facts these helpers encode (verified 2026-07-14, v1.55.0):
- yt-dlp flat-playlist SEARCH works from datacenter IPs and returns real
  {id,title,channel,duration,view_count}; per-video watch-page metadata fetches
  are bot-checked ("Sign in to confirm you're not a bot"), so duration/channel
  provenance comes from the SEARCH result, never a follow-up fetch.
- Existence + embeddability: YouTube oEmbed (200 = exists & embeddable,
  401/403 = embedding disabled, 404 = gone/private).
- Verticality (Shorts): portrait thumbnail variants include `oardefault.jpg`
  and `oar1.jpg` (checked 2026-09-20). Their absence does NOT establish landscape:
  some real Shorts only publish a cropped hq720_1 image on the channel Shorts tab.
  Retain previously established format when this check is inconclusive. The
  /shorts/<id> redirect and oEmbed width/height do not establish format.
"""

from __future__ import annotations

import glob
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"

CLIP_ID_PATTERN = r"^[A-Za-z0-9_-]{11}$"
# Front-end fields; channel/duration/verified are content-JSON provenance only.
CLIP_FIELDS = ("id", "title", "by", "start", "end", "vertical", "channel", "duration", "verified")

# The whole corpus must join at least this many escape rows. Raise it as escape clips ship,
# never lower it to make a build pass. A join that finds nothing is a check that never ran.
ESCAPE_CLIP_JOIN_FLOOR = 1

_UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}


# --------------------------------------------------------------------------- #
# Slot enumeration
# --------------------------------------------------------------------------- #
def _load_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return None


def _overview_snippet(d, limit=260):
    for key in ("summary", "overview", "description"):
        v = d.get(key)
        if isinstance(v, str) and v.strip():
            v = v.strip()
            return v[: limit - 1] + "…" if len(v) > limit else v
    return ""


def iter_clip_slots(category=None, file_filter=None):
    """Yield one dict per clip slot, in a stable order.

    Slot: {key, file, category, name, role, kind, context}
    - key:  "Transitions/Hip Bump Sweep#attacker" (role) or "...#root" (hub/whole-file)
    - role: "top"|"bottom"|"attacker"|"defender"|None (None = root holder)
    - kind: "searched" (gets its own query/search/curate run) or
            "derived" (submission family hub — filled by union of child picks at apply)
    - context: prompt material {overview, from_position?, role_note?}
    Positions: every top/bottom role block + a root hub slot (overview clips — the app
    unions them into role dossiers). Transitions/Submissions (non-family): attacker +
    defender slots only (root stays empty; the app falls back per-role). Submission
    family hubs: derived. Principles: root.
    """
    cats = [category] if category else ["Positions", "Transitions", "Submissions", "Principles"]
    for cat in cats:
        for f in sorted(glob.glob(str(CONTENT / cat / "**" / "*.json"), recursive=True)):
            if "TEMPLATE" in f:
                continue
            if file_filter and file_filter.lower() not in f.lower():
                continue
            d = _load_json(f)
            if not isinstance(d, dict) or "name" not in d:
                continue
            name = d["name"]
            rel = os.path.relpath(f, CONTENT)
            base = {"file": f, "category": cat, "name": name}
            overview = _overview_snippet(d)

            if cat == "Positions":
                has_roles = False
                for role in ("top", "bottom"):
                    rd = d.get(role)
                    if isinstance(rd, dict):
                        has_roles = True
                        yield {**base, "key": f"{rel}#{role}", "role": role, "kind": "searched",
                               "context": {"overview": _overview_snippet(rd) or overview,
                                           "role_note": f"playing {role.upper()} in {name}"}}
                # Hub/overview slot (SINGLE positions have no roles: root is the only slot).
                yield {**base, "key": f"{rel}#root", "role": None, "kind": "searched",
                       "context": {"overview": overview,
                                   "role_note": ("the neutral position " if not has_roles else
                                                 "a position OVERVIEW (concept/entries/why it matters), not one role's game — ")
                                   + name}}
            elif cat in ("Transitions", "Submissions"):
                if d.get("is_family"):
                    yield {**base, "key": f"{rel}#root", "role": None, "kind": "derived",
                           "context": {"overview": overview}}
                    continue
                fp = d.get("from_position") or ""
                for role, note in (("attacker", "EXECUTING the technique (instruction/breakdown footage)"),
                                   ("defender", "DEFENDING/ESCAPING the technique (defense instruction, not execution)")):
                    yield {**base, "key": f"{rel}#{role}", "role": role, "kind": "searched",
                           "context": {"overview": overview, "from_position": fp, "role_note": note}}
            else:  # Principles
                yield {**base, "key": f"{rel}#root", "role": None, "kind": "searched",
                       "context": {"overview": overview,
                                   "role_note": f"the BJJ principle/concept '{name}' (concept explainers, not one technique)"}}


def clips_holder(data, role):
    """Return the dict that owns the `clips` array for a slot (root or role block)."""
    if role is None:
        return data
    block = data.get(role)
    return block if isinstance(block, dict) else None


def escape_rows(data):
    """The `defender.escape_clips` rows of one record: per-escape clips, keyed by card label."""
    block = data.get("defender") if isinstance(data, dict) else None
    rows = block.get("escape_clips") if isinstance(block, dict) else None
    return [row for row in rows if isinstance(row, dict)] if isinstance(rows, list) else []


def drop_empty_escape_rows(data):
    """After a prune: a row with no clips left means nothing and fails the schema, so it goes."""
    block = data.get("defender") if isinstance(data, dict) else None
    if not isinstance(block, dict) or "escape_clips" not in block:
        return
    kept = [row for row in escape_rows(data) if row.get("clips")]
    if kept:
        block["escape_clips"] = kept
    else:
        block.pop("escape_clips")


def escape_labels(data):
    """The card labels this submission deals, exactly as the game prints them.

    `escape_clips` joins on this string. It comes from submission_choices.compile_defenses
    rather than a copy of its rules, so a label can only ever be one the game really emits,
    including the two defense_overrides submissions with no defensive_options row. That
    module is an MDP emitter input (regenerate_mdp_data.py hashes it), so it stays untouched.
    """
    scripts = str(ROOT / "scripts")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    from submission_choices import compile_defenses
    catalog = json.loads((ROOT / "neural/submission-states.json").read_text(encoding="utf-8"))
    return [choice["label"] for choice in compile_defenses(data, None, catalog)]


def escape_clip_join(data):
    """(joined, orphans) for one record: rows whose `escape` is a card, and rows that are not."""
    rows = escape_rows(data)
    if not rows:
        return [], []
    labels = set(escape_labels(data))
    return ([r for r in rows if r.get("escape") in labels],
            [r for r in rows if r.get("escape") not in labels])


def restore_clips(original, fixed):
    """Curation-safety: `clips` is machine-verified YouTube film-study data excluded
    from the AI response contract (like Systems `products`). Restore the original
    verbatim — root and every role block — so enrichment can never drop, reorder,
    or invent video IDs. Returns the number of clips arrays restored/removed."""
    if not isinstance(original, dict) or not isinstance(fixed, dict):
        return 0

    def sync(orig_holder, fixed_holder, key="clips"):
        if not isinstance(orig_holder, dict) or not isinstance(fixed_holder, dict):
            return 0
        orig_clips = orig_holder.get(key)
        if orig_clips is not None:
            if fixed_holder.get(key) != orig_clips:
                fixed_holder[key] = orig_clips
                return 1
        elif key in fixed_holder:
            fixed_holder.pop(key)
            return 1
        return 0

    restored = sync(original, fixed)
    for role in ("top", "bottom", "attacker", "defender"):
        restored += sync(original.get(role), fixed.get(role))
    # Per-escape clips: same contract, one level over. A sibling of `clips`, not a key inside
    # defensive_options, because that row is hashed into each defense's MDP identity.
    restored += sync(original.get("defender"), fixed.get("defender"), "escape_clips")
    return restored


def iter_clips_arrays(category=None, file_filter=None):
    """Yield (file, data, role_or_None, holder) for EVERY existing clips array in
    content/, including holders the slot model never searches (e.g. root clips on a
    dual technique, used as the app's general fallback). Use this for verification
    and reporting so no clip escapes coverage; use iter_clip_slots for sourcing."""
    cats = [category] if category else ["Positions", "Transitions", "Submissions", "Principles"]
    for cat in cats:
        for f in sorted(glob.glob(str(CONTENT / cat / "**" / "*.json"), recursive=True)):
            if "TEMPLATE" in f:
                continue
            if file_filter and file_filter.lower() not in f.lower():
                continue
            d = _load_json(f)
            if not isinstance(d, dict):
                continue
            if isinstance(d.get("clips"), list):
                yield f, d, None, d
            for role in ("top", "bottom", "attacker", "defender"):
                block = d.get(role)
                if isinstance(block, dict) and isinstance(block.get("clips"), list):
                    yield f, d, role, block
            # An escape row is a holder too: without this line the monthly rot check, the
            # audit and --prune would never see these clips, and clips-verify would still
            # report full coverage of "the corpus". The row has its own `clips`, so callers
            # that mutate holder["clips"] work unchanged; drop_empty_escape_rows tidies after.
            for row in escape_rows(d):
                if isinstance(row.get("clips"), list):
                    yield f, d, "defender", row


# --------------------------------------------------------------------------- #
# YouTube search (yt-dlp) + machine verification
# --------------------------------------------------------------------------- #
def search_youtube(query, n=10, timeout=90):
    """Real YouTube search via yt-dlp flat-playlist. Returns a list of
    {id,title,channel,duration,view_count} — IDs are real by construction.
    Raises RuntimeError on a failed search (caller backs off / retries)."""
    cmd = ["python3", "-m", "yt_dlp", f"ytsearch{n}:{query}",
           "--flat-playlist", "--dump-json", "--no-warnings", "--quiet"]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0 and not proc.stdout.strip():
        raise RuntimeError(f"yt-dlp search failed: {(proc.stderr or '').strip()[:300]}")
    out = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        vid = e.get("id")
        if not isinstance(vid, str) or len(vid) != 11:
            continue
        out.append({
            "id": vid,
            "title": (e.get("title") or "")[:120],
            "channel": e.get("channel") or e.get("uploader") or "",
            "duration": int(e["duration"]) if isinstance(e.get("duration"), (int, float)) else None,
            "view_count": e.get("view_count"),
        })
    return out


def _http_status(url, method="GET", timeout=15):
    class _NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None
    req = urllib.request.Request(url, method=method, headers=_UA)
    try:
        with urllib.request.build_opener(_NoRedirect).open(req, timeout=timeout) as r:
            return r.status, r
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return None, None


def is_short(video_id, timeout=15):
    """True for a known portrait thumbnail; None when format is inconclusive.

    A 404 is not proof of landscape: current Shorts can use alternate/cropped
    thumbnails. Never downgrade a known Short because one asset is unavailable.
    """
    for name in ("oardefault", "oar1", "oar2", "oar3"):
        status, _ = _http_status(f"https://i.ytimg.com/vi/{video_id}/{name}.jpg",
                                 method="HEAD", timeout=timeout)
        if status == 200:
            return True
    return None


def verify_video(video_id, timeout=15, *, check_format=True):
    """Machine-verify one YouTube ID. Returns
    {status: ok|embed-disabled|gone|error, channel, vertical, reason}.
    Report-only availability checks skip the four portrait-thumbnail probes.
    Sourcing keeps the existing format verification by default."""
    url = ("https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D"
           + video_id + "&format=json")
    req = urllib.request.Request(url, headers=_UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            channel = json.load(r).get("author_name") or ""
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return {"status": "embed-disabled", "channel": None, "vertical": None, "reason": f"oEmbed HTTP {e.code}: embedding unavailable"}
        if e.code == 404:
            return {"status": "gone", "channel": None, "vertical": None, "reason": "oEmbed HTTP 404: unavailable or private"}
        return {"status": "error", "channel": None, "vertical": None, "reason": f"oEmbed HTTP {e.code}: transient check failure"}
    except Exception as e:
        return {"status": "error", "channel": None, "vertical": None, "reason": f"oEmbed {type(e).__name__}: check failed"}
    return {"status": "ok", "channel": channel, "vertical": is_short(video_id, timeout) if check_format else None,
            "reason": "oEmbed HTTP 200: available for embedding"}
