#!/usr/bin/env python3
"""source_clips.py — staged, resumable sourcing of curated YouTube technique clips.

Fills the `clips` arrays in content/*.json (see the clip schema in every
templates/*TEMPLATE*.json): for each slot (position role, position hub overview,
technique attacker/defender, principle) an LLM names the legendary instructor for
that exact technique+role and writes search queries; yt-dlp runs REAL YouTube
searches (IDs cannot be hallucinated); an LLM curates the best 1-3 clips from the
real results only (Shorts preferred); every pick is machine-verified (oEmbed
embeddability + portrait-thumbnail Shorts check) with ranked auto-substitution;
verified clips are applied into the content JSON; review.html gives the owner a
thumbnail grid for in-place pruning (edit the JSON, rerun report).

Stages (each resumable; state in clips_sourcing/state.json, gitignored):
  pending -> queried -> searched -> curated -> verified -> applied

Usage:
  python3 scripts/source_clips.py --stage all --category Positions --max-slots 50
  python3 scripts/source_clips.py --stage search --sleep 4        # resume searches
  python3 scripts/source_clips.py --stage report                  # regenerate review.html
Flags: --stage queries|search|curate|verify|apply|report|all, --category, --file,
  --max-slots, --sleep, --dry-run, --force (overwrite existing clips arrays),
  --model, --effort.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_json, atomic_write_text
from _clips import CLIP_ID_PATTERN, clips_holder, iter_clip_slots, search_youtube, verify_video
from claude_infer import call_claude
from peak_throttle import throttle_if_peak

ROOT = Path(__file__).resolve().parent.parent
WORKDIR = ROOT / "clips_sourcing"
STATE_PATH = WORKDIR / "state.json"
RESULTS_DIR = WORKDIR / "results"
REVIEW_PATH = WORKDIR / "review.html"

CLAUDE_MODEL = "claude-opus-4-8[1m]"  # matches regenerate_content_json.py
DEFAULT_EFFORT = "medium"             # query planning/curation are cheap, high-volume calls
QUERY_BATCH = 18
CURATE_BATCH = 12
SEARCH_PER_QUERY = 10
MAX_PICKS = 3
CLIP_ID_RE = re.compile(CLIP_ID_PATTERN)

LEGEND_GUIDANCE = """\
Match each technique/position+role to its recognized master — the instructor the BJJ
community would call THE authority on it — and search for THEIR footage. Non-exhaustive map:
- Craig Jones: body lock passing, Z-guard, triangles from odd angles, leg locks
- Gordon Ryan: pressure passing, back attacks, mount, half guard top, systemized no-gi
- John Danaher: back control, leg lock systems, pins, conceptual breakdowns
- Roger Gracie: cross collar choke, mount, closed guard fundamentals
- Marcelo Garcia: guillotine, X-guard, butterfly guard, arm drags, back takes
- Lachlan Giles: 50/50, heel hooks, half guard bottom, guard retention
- Mikey Musumeci: straight footlocks, modern guard, berimbolo
- Rafael Mendes / Mikey Musumeci: berimbolo, de la Riva
- Bernardo Faria: over-under pass, deep half guard
- Priit Mihkelson: defensive postures (turtle, running man), escapes
- Xande Ribeiro: guard retention, diagonal control
- Andre Galvao: passing, transitions, competition strategy
- Eddie Bravo / 10th Planet: rubber guard, twister, lockdown
- Marcus Buchecha / Kaynan Duarte: heavyweight passing and wrestling-up
- Wrestling/takedowns: Jordan Burroughs (double leg), Bo Nickal, Nicky Rodriguez (bodylock)
- Judo throws: Shintaro Higashi, Travis Stevens
If no clear legend exists for a slot, use the strongest reputable instructional channel
(Grapplearts/Jon Thomas, Chewjitsu, Knight Jiu-Jitsu, Absolute MMA/Lachlan Giles, BJJ
Fanatics named-athlete clips). For DEFENDER slots pick the defense/escape authority
(often Priit Mihkelson, Lachlan Giles retention, or the same legend teaching the counter),
and write queries about DEFENDING/ESCAPING the technique, never executing it."""

# --------------------------------------------------------------------------- #
# Sourcing policies. "shorts" is the default (~30s motion loops). "relaxed" is
# the rescue/top-up policy for slots where Shorts don't exist (longer focused
# instructionals beat nothing). "principle" targets concept DEPTH: one short
# hook + 1-2 real lectures. Policy rides on the slot (slot["policy"]) so mixed
# reruns keep per-slot behavior; unset means shorts.
# --------------------------------------------------------------------------- #
SEARCH_CAP = {"shorts": 300, "relaxed": 900, "principle": 1800}

QUERY_BRIEF = {
    "shorts": """The product shows a ~30-second LOOP of the technique's motion — we need YouTube
Shorts or very short clips, NOT lecture-length instructionals. Per slot, exactly 2 queries:
- query 1: legend's name + technique + "shorts" (e.g. "craig jones body lock pass shorts")
- query 2: technique + role framing + "#shorts" or "short demo" (no instructor name, so
  we still find a great Short if the legend never made one)""",
    "relaxed": """Short footage does NOT exist for these hard slots (previous Shorts-biased passes came
up dry or thin). Find the best FOCUSED INSTRUCTIONAL (<= 10 minutes) of exactly this
technique/position and role — defense slots need escape/defense instructionals. Per slot,
exactly 2 queries: one with the legend/authority's name + technique (no "shorts"), one
technique + role + "technique"/"instructional"/"details".""",
    "principle": """These are BJJ PRINCIPLE/CONCEPT pages — depth beats brevity here. Per slot, exactly
2 queries: one for a deep concept lecture/breakdown by the domain authority (Danaher-style
seminar excerpts, 'concepts', 'principles', 'explained', 'breakdown' — 5-25 minutes), and
one for a short punchy explainer of the same concept.""",
}

CURATE_RULES = {
    "shorts": """- Duration policy (strict): STRONGLY prefer <=75s (true Shorts — the whole video IS the
  motion). 76-120s is fine if it's a focused demo. 121-300s is a LAST resort, only when
  nothing shorter shows this technique, and only if clearly a demo (not a lecture).
- If nothing fits (wrong technique, junk results, only lectures), return an empty picks
  array — an empty slot gets re-searched later; a bad long video does not.""",
    "relaxed": """- Duration policy (rescue slots — Shorts don't exist here): prefer the SHORTEST adequate
  focused instructional; up to ~10 minutes acceptable. Still demo/instruction, never a
  podcast/seminar-ramble. Pick 1-2.
- Ids listed under "already used" are on the page already — NEVER re-pick them.
- Only return an empty picks array if genuinely nothing teaches this technique/role.""",
    "principle": """- These are CONCEPT pages: pick up to 3 total — at most ONE short hook (<=120s) plus
  1-2 DEEP lectures/breakdowns (300-1500s) by recognized authorities. Lectures are the
  priority; skip the hook rather than a good lecture.
- Candidates marked [CURRENT] are already on the page — include one in your picks ONLY
  if it deserves to stay as the short hook; your picks REPLACE the page's clips.""",
}


def slot_policy(s):
    return s.get("policy") or ("principle" if s.get("category") == "Principles" else "shorts")


QUERY_SCHEMA = {
    "type": "object",
    "properties": {
        "plans": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "slot": {"type": "string"},
                    "legend": {"type": "string"},
                    "queries": {"type": "array", "items": {"type": "string"},
                                "minItems": 1, "maxItems": 2},
                },
                "required": ["slot", "legend", "queries"],
            },
        }
    },
    "required": ["plans"],
}

CURATE_SCHEMA = {
    "type": "object",
    "properties": {
        "curations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "slot": {"type": "string"},
                    "picks": {
                        "type": "array",
                        "maxItems": 3,
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "title": {"type": "string"},
                                "by": {"type": "string"},
                                "start": {"type": "integer"},
                                "end": {"type": "integer"},
                            },
                            "required": ["id", "title", "by"],
                        },
                    },
                },
                "required": ["slot", "picks"],
            },
        }
    },
    "required": ["curations"],
}


# --------------------------------------------------------------------------- #
# State
# --------------------------------------------------------------------------- #
def load_state():
    if STATE_PATH.exists():
        with open(STATE_PATH, encoding="utf-8") as fh:
            return json.load(fh)
    return {"version": 1, "slots": {}}


def save_state(state):
    WORKDIR.mkdir(exist_ok=True)
    atomic_write_json(STATE_PATH, state)


def results_path(key):
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", key)
    return RESULTS_DIR / f"{safe}.json"


def sync_slots(state, args):
    """Register slots from content/ into state (never demotes existing statuses)."""
    n = 0
    for slot in iter_clip_slots(args.category, args.file):
        if slot["key"] not in state["slots"]:
            state["slots"][slot["key"]] = {
                "status": "derived" if slot["kind"] == "derived" else "pending",
                "category": slot["category"], "name": slot["name"], "role": slot["role"],
                "file": slot["file"], "context": slot["context"],
            }
            n += 1
    if n:
        print(f"[sync] registered {n} new slot(s); state now tracks {len(state['slots'])}")
    return state


def select(state, args, statuses):
    keys = [k for k, s in state["slots"].items()
            if s["status"] in statuses
            and (not args.category or s["category"] == args.category)
            and (not args.file or args.file.lower() in s["file"].lower())]
    return keys[: args.max_slots] if args.max_slots else keys


def _extract(payload):
    """call_claude returns structured JSON or fenced text — normalize to a dict."""
    try:
        return json.loads(payload)
    except (TypeError, json.JSONDecodeError):
        pass
    for m in re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", payload or ""):
        try:
            return json.loads(m)
        except json.JSONDecodeError:
            continue
    return None


def _batches(keys, size):
    for i in range(0, len(keys), size):
        yield keys[i: i + size]


def _existing_clips(s):
    """Clips currently applied on the slot's holder in content JSON (empty on error)."""
    try:
        with open(s["file"], encoding="utf-8") as fh:
            holder = clips_holder(json.load(fh), s["role"])
        return list((holder or {}).get("clips") or [])
    except (OSError, json.JSONDecodeError):
        return []


# --------------------------------------------------------------------------- #
# Stage: queries (LLM — legend + search queries per slot)
# --------------------------------------------------------------------------- #
def stage_queries(state, args):
    all_keys = select(state, args, {"pending"})
    print(f"[queries] {len(all_keys)} slot(s) to plan")
    consec_fails = 0
    by_policy = {}
    for k in all_keys:
        by_policy.setdefault(slot_policy(state["slots"][k]), []).append(k)
    batches = [(pol, batch) for pol, keys in by_policy.items()
               for batch in _batches(keys, QUERY_BATCH)]
    for pol, batch in batches:
        throttle_if_peak()
        lines = []
        for k in batch:
            s = state["slots"][k]
            ctx = s.get("context") or {}
            extra = f" | from: {ctx['from_position']}" if ctx.get("from_position") else ""
            lines.append(f"- slot: {k}\n  what: {ctx.get('role_note') or s['name']}{extra}\n"
                         f"  about: {ctx.get('overview') or '(no summary)'}")
        prompt = f"""You curate film-study footage for a BJJ knowledge graph.

{LEGEND_GUIDANCE}

{QUERY_BRIEF[pol]}
For EACH slot below return: the legend (instructor/authority to prioritize) and exactly
2 YouTube search queries. Keep queries under 9 words.

SLOTS:
{chr(10).join(lines)}

Return JSON: {{"plans": [{{"slot", "legend", "queries": [..]}}]}} — one entry per slot,
`slot` copied verbatim."""
        if args.dry_run:
            print(f"[queries] DRY RUN — would plan batch of {len(batch)}")
            continue
        payload, err = call_claude(prompt, QUERY_SCHEMA, args.model, args.effort)
        data = _extract(payload) if not err else None
        if not data or "plans" not in data:
            print(f"[queries] batch failed: {err or 'unparseable response'}")
            consec_fails += 1
            if consec_fails >= 3:
                print("[queries] 3 consecutive batch failures — aborting stage; rerun to resume")
                return
            continue
        consec_fails = 0
        planned = 0
        for plan in data["plans"]:
            k = plan.get("slot")
            if k in state["slots"] and state["slots"][k]["status"] == "pending":
                qs = [q for q in plan.get("queries", []) if isinstance(q, str) and q.strip()][:2]
                if qs:
                    state["slots"][k].update(status="queried", legend=plan.get("legend") or "",
                                             queries=qs)
                    planned += 1
        save_state(state)
        print(f"[queries] batch done: {planned}/{len(batch)} planned")


# --------------------------------------------------------------------------- #
# Stage: search (yt-dlp — real YouTube results, no LLM)
# --------------------------------------------------------------------------- #
def stage_search(state, args):
    keys = select(state, args, {"queried"})
    print(f"[search] {len(keys)} slot(s) to search (~{args.sleep:.0f}s/query pacing)")
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    consec_failed_slots = 0
    for i, k in enumerate(keys):
        s = state["slots"][k]
        merged, seen, failed = [], set(), False
        for q in s.get("queries", []):
            for attempt in range(3):
                try:
                    res = search_youtube(q, n=SEARCH_PER_QUERY)
                    break
                except Exception as e:
                    wait = 30 * (2 ** attempt)
                    print(f"[search] '{q}' failed ({e}); backoff {wait}s")
                    time.sleep(wait)
            else:
                failed = True
                continue
            for r in res:
                if r["id"] not in seen:
                    seen.add(r["id"])
                    merged.append(r)
            time.sleep(args.sleep * random.uniform(0.7, 1.3))
        if merged:
            # Policy pre-filter: lecture-length videos are mechanically excluded before
            # curation ever sees them (cap per SEARCH_CAP: shorts 300s / relaxed 900s /
            # principle 1800s; unknown-duration entries kept). If the cap empties the
            # list, fall back to the 3 shortest so the slot isn't starved by a bad search.
            cap = args.relax_cap if (args.relax_cap and slot_policy(s) == "relaxed") \
                else SEARCH_CAP[slot_policy(s)]
            shortish = [r for r in merged if not r.get("duration") or r["duration"] <= cap]
            if not shortish:
                shortish = sorted(merged, key=lambda r: r.get("duration") or 10**9)[:3]
            merged = shortish
            atomic_write_json(results_path(k), merged)
            s["status"] = "searched"
            s["n_results"] = len(merged)
            consec_failed_slots = 0
        elif failed:
            s["error"] = "search failed"  # stays 'queried' -> retried on rerun
            consec_failed_slots += 1
            if consec_failed_slots >= 5:
                save_state(state)
                print("[search] 5 consecutive slots failed every search (yt-dlp/YouTube "
                      "down or throttled) — aborting stage; rerun to resume")
                return
        else:
            s["status"] = "curated"  # zero results -> nothing to curate, flows to report
            s["picks"] = []
            consec_failed_slots = 0
        save_state(state)
        if (i + 1) % 25 == 0 or i + 1 == len(keys):
            print(f"[search] {i + 1}/{len(keys)} slots done")


# --------------------------------------------------------------------------- #
# Stage: curate (LLM — pick 1-3 from REAL results only)
# --------------------------------------------------------------------------- #
def stage_curate(state, args):
    all_keys = [k for k in select(state, args, {"searched"}) if results_path(k).exists()]
    print(f"[curate] {len(all_keys)} slot(s) to curate")
    consec_fails = 0
    by_policy = {}
    for k in all_keys:
        by_policy.setdefault(slot_policy(state["slots"][k]), []).append(k)
    batches = [(pol, batch) for pol, keys in by_policy.items()
               for batch in _batches(keys, CURATE_BATCH)]
    for pol, batch in batches:
        throttle_if_peak()
        blocks, valid_ids = [], {}
        for k in batch:
            s = state["slots"][k]
            with open(results_path(k), encoding="utf-8") as fh:
                results = json.load(fh)[:14]
            valid_ids[k] = {r["id"] for r in results}
            ctx = s.get("context") or {}
            rows = "\n".join(
                f"  [{r['id']}] {r['title']} | {r['channel'] or '?'} | "
                f"{r['duration'] or '?'}s | {r['view_count'] or '?'} views"
                for r in results)
            existing = _existing_clips(s)
            if pol == "principle" and existing:
                # Existing shorts are candidates too: the curator's picks REPLACE the
                # page, keeping at most one as the hook.
                for c in existing:
                    valid_ids[k].add(c["id"])
                    rows += (f"\n  [{c['id']}] [CURRENT] {c.get('title','')} | "
                             f"{c.get('channel') or '?'} | {c.get('duration') or '?'}s | applied")
            used_note = ""
            if pol == "relaxed" and existing:
                used_note = "\nalready used (do NOT re-pick): " + ", ".join(c["id"] for c in existing)
            blocks.append(f"### slot: {k}\nwhat: {ctx.get('role_note') or s['name']} "
                          f"(intended legend: {s.get('legend') or 'any authority'}){used_note}\n"
                          f"candidates (REAL YouTube search results):\n{rows}")
        prompt = f"""You curate film-study clips for a BJJ knowledge graph. For each slot pick the
0-3 BEST clips from its candidate list, ranked best-first.

Rules:
- Use ONLY ids from that slot's candidate list. Never invent an id.
{CURATE_RULES[pol]}
- Prefer the intended legend / a recognized authority on this exact technique+role, and
  the instructor's own channel over reuploads. A clean demonstration by a lesser-known
  coach BEATS an off-topic video by a legend.
- Down-rank raw sparring/highlight footage unless the technique is clearly visible.
- The clip must match the ROLE: defender slots need defense/escape teaching, not execution.
- `title`: <=60 chars, plain description. `by`: the instructor on screen (not the channel
  name unless unknown). Omit start/end unless a timestamp is certain from the title.

{chr(10).join(blocks)}

Return JSON: {{"curations": [{{"slot", "picks": [{{"id","title","by","start"?,"end"?}}]}}]}} —
one entry per slot, `slot` copied verbatim."""
        if args.dry_run:
            print(f"[curate] DRY RUN — would curate batch of {len(batch)}")
            continue
        payload, err = call_claude(prompt, CURATE_SCHEMA, args.model, args.effort)
        data = _extract(payload) if not err else None
        if not data or "curations" not in data:
            print(f"[curate] batch failed: {err or 'unparseable response'}")
            consec_fails += 1
            if consec_fails >= 3:
                print("[curate] 3 consecutive batch failures — aborting stage; rerun to resume")
                return
            continue
        consec_fails = 0
        done = 0
        for cur in data["curations"]:
            k = cur.get("slot")
            if k not in state["slots"] or state["slots"][k]["status"] != "searched":
                continue
            banned = ({c["id"] for c in _existing_clips(state["slots"][k])}
                      if pol == "relaxed" else set())
            picks = []
            for p in (cur.get("picks") or [])[:MAX_PICKS]:
                pid = p.get("id")
                if (pid in valid_ids.get(k, set()) and pid not in banned
                        and CLIP_ID_RE.match(pid or "")):
                    picks.append({f: p[f] for f in ("id", "title", "by", "start", "end")
                                  if p.get(f) is not None})
            state["slots"][k].update(status="curated", picks=picks)
            done += 1
        save_state(state)
        print(f"[curate] batch done: {done}/{len(batch)} curated")


# --------------------------------------------------------------------------- #
# Stage: verify (machine — oEmbed + Shorts check, ranked substitution)
# --------------------------------------------------------------------------- #
def stage_verify(state, args):
    keys = select(state, args, {"curated"})
    print(f"[verify] {len(keys)} slot(s) to verify")
    today = date.today().isoformat()
    for i, k in enumerate(keys):
        s = state["slots"][k]
        durations = {c["id"]: c.get("duration") for c in _existing_clips(s)}
        if results_path(k).exists():
            with open(results_path(k), encoding="utf-8") as fh:
                durations.update({r["id"]: r.get("duration") for r in json.load(fh)})
        verified = []
        transient = False
        for p in s.get("picks", []):
            if len(verified) >= MAX_PICKS:
                break
            if args.dry_run:
                continue
            v = verify_video(p["id"])
            time.sleep(0.5)
            if v["status"] == "error":
                # transient (network) — do NOT advance the slot; rerun retries it
                transient = True
                print(f"[verify] {k}: transient check error on {p['id']} — slot deferred")
                continue
            if v["status"] != "ok":
                print(f"[verify] {k}: dropped {p['id']} ({v['status']})")
                continue
            clip = {"id": p["id"], "title": (p.get("title") or "")[:80],
                    "by": p.get("by") or v["channel"]}
            start, end, dur = p.get("start"), p.get("end"), durations.get(p["id"])
            if isinstance(start, int) and start >= 0 and (start > 0 or isinstance(end, int)):
                clip["start"] = start
            if isinstance(end, int) and end > (start or 0) and (not dur or end <= dur):
                clip["end"] = end
                clip.setdefault("start", 0)
            clip["vertical"] = bool(v["vertical"])
            if v["channel"]:
                clip["channel"] = v["channel"]
            if isinstance(dur, int):
                clip["duration"] = dur
            clip["verified"] = today
            verified.append(clip)
        if args.dry_run:
            print(f"[verify] DRY RUN — would verify {len(s.get('picks', []))} pick(s) for {k}")
            continue
        if transient:
            continue  # stays 'curated'; rerun re-verifies the whole slot
        s.update(status="verified", verified_picks=verified)
        save_state(state)
        if (i + 1) % 25 == 0 or i + 1 == len(keys):
            print(f"[verify] {i + 1}/{len(keys)} slots done")


# --------------------------------------------------------------------------- #
# Stage: apply (write into content JSON) + derived family hubs
# --------------------------------------------------------------------------- #
def _load_content(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def stage_apply(state, args):
    keys = select(state, args, {"verified"})
    print(f"[apply] {len(keys)} slot(s) to apply")
    applied = skipped = empty = 0
    for k in keys:
        s = state["slots"][k]
        clips = s.get("verified_picks") or []
        if not clips:
            s["status"] = "applied"
            s["applied"] = "empty"
            empty += 1
            continue
        data = _load_content(s["file"])
        holder = clips_holder(data, s["role"])
        if holder is None:
            s["error"] = f"role block '{s['role']}' missing"
            continue
        pol = slot_policy(s)
        existing = holder.get("clips") or []
        if existing and pol == "shorts" and not args.force:
            s["status"] = "applied"
            s["applied"] = "skipped-existing"
            skipped += 1
            continue
        if pol == "relaxed":
            # top-up: append new picks to what's already there (dedup, existing first)
            seen = {c.get("id") for c in existing}
            clips = existing + [c for c in clips if c["id"] not in seen]
            clips = clips[:4]
        # principle: picks REPLACE the page (curator saw [CURRENT] clips as candidates)
        if args.dry_run:
            print(f"[apply] DRY RUN — would write {len(clips)} clip(s) -> {k} ({pol})")
            continue
        holder["clips"] = clips
        atomic_write_json(s["file"], data)
        s["status"] = "applied"
        s["applied"] = f"{len(clips)} clips"
        applied += 1
        save_state(state)
    if not args.dry_run:
        save_state(state)
    print(f"[apply] wrote {applied}, skipped-existing {skipped}, empty {empty}")
    _apply_family_hubs(state, args)


def _apply_family_hubs(state, args):
    """Submission family hubs derive their clips: union of child attacker clips, cap 4."""
    derived = [k for k, s in state["slots"].items() if s["status"] == "derived"
               and (not args.category or s["category"] == args.category)
               and (not args.file or args.file.lower() in s["file"].lower())]
    for k in derived:
        s = state["slots"][k]
        data = _load_content(s["file"])
        if data.get("clips"):
            s.update(status="applied", applied="skipped-existing")
            continue
        family_dir = Path(s["file"]).with_suffix("")
        union, seen = [], set()
        for child in sorted(family_dir.glob("*.json")) if family_dir.is_dir() else []:
            cd = _load_content(child)
            for c in (cd.get("attacker") or {}).get("clips", []) or []:
                if c.get("id") and c["id"] not in seen:
                    seen.add(c["id"])
                    union.append(c)
        if not union:
            continue
        if args.dry_run:
            print(f"[apply] DRY RUN — would derive {min(len(union), 4)} hub clip(s) -> {k}")
            continue
        data["clips"] = union[:4]
        atomic_write_json(s["file"], data)
        s.update(status="applied", applied=f"derived {min(len(union), 4)} from children")
        save_state(state)


# --------------------------------------------------------------------------- #
# Stage: report (review.html — thumbnail grid for in-place pruning)
# --------------------------------------------------------------------------- #
def stage_report(state, args):
    from _clips import CONTENT, iter_clips_arrays
    import os
    cards, by_id = [], {}
    for f, _data, role, holder in iter_clips_arrays(args.category, args.file):
        key = f"{os.path.relpath(f, CONTENT)}#{role or 'root'}"
        for c in holder["clips"]:
            by_id.setdefault(c.get("id"), []).append(key)
            st = state["slots"].get(key, {})
            cards.append((key, c, st.get("legend", "")))
    rows = []
    for key, c, legend in cards:
        vid = c.get("id", "")
        dupes = [k for k in by_id.get(vid, []) if k != key]
        loop = (f"{c.get('start', 0)}–{c['end']}s loop" if c.get("end") else "full")
        meta = " · ".join(x for x in (
            c.get("by"), c.get("channel"), f"{c['duration']}s" if c.get("duration") else "",
            "SHORT" if c.get("vertical") else "landscape", loop,
            f"verified {c.get('verified', '?')}") if x)
        rows.append(f"""<div class="card{' dupe' if dupes else ''}">
<a href="https://www.youtube.com/watch?v={vid}&t={c.get('start', 0)}s" target="_blank">
<img src="https://i.ytimg.com/vi/{vid}/hqdefault.jpg" loading="lazy" alt=""></a>
<div class="t">{c.get('title', '')}</div>
<div class="m">{meta}</div>
<div class="s">{key}{' · intended: ' + legend if legend else ''}</div>
{f'<div class="d">also used by: {", ".join(dupes)}</div>' if dupes else ''}</div>""")
    counts = {}
    for s in state["slots"].values():
        counts[s["status"]] = counts.get(s["status"], 0) + 1
    html = f"""<!doctype html><meta charset="utf-8"><title>BJJGraph clip review</title>
<style>body{{font:14px system-ui;background:#101418;color:#dde;margin:24px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}}
.card{{background:#1a2028;border-radius:10px;padding:10px}}.card.dupe{{outline:1px solid #b90}}
img{{width:100%;border-radius:6px}}.t{{font-weight:700;margin:6px 0 2px}}
.m{{color:#9ab;font-size:12px}}.s{{color:#68a;font-size:11px;margin-top:4px;word-break:break-all}}
.d{{color:#b90;font-size:11px}}</style>
<h1>Clip review — {len(cards)} clips in content JSON</h1>
<p>Pipeline state: {json.dumps(counts)}. To prune a bad pick: delete it from the named
content JSON file (slot key = file#role), then rerun --stage report.</p>
<div class="grid">{''.join(rows)}</div>"""
    WORKDIR.mkdir(exist_ok=True)
    atomic_write_text(REVIEW_PATH, html)
    print(f"[report] {len(cards)} clips -> {REVIEW_PATH}")


# --------------------------------------------------------------------------- #
STAGES = {"queries": stage_queries, "search": stage_search, "curate": stage_curate,
          "verify": stage_verify, "apply": stage_apply, "report": stage_report}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--stage", default="all", choices=[*STAGES, "all"])
    ap.add_argument("--category", choices=["Positions", "Transitions", "Submissions", "Principles"])
    ap.add_argument("--file", help="substring filter on content file path")
    ap.add_argument("--max-slots", type=int, help="cap slots per stage this run")
    ap.add_argument("--sleep", type=float, default=3.0, help="base seconds between searches")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true", help="overwrite existing clips arrays on apply")
    ap.add_argument("--model", default=CLAUDE_MODEL)
    ap.add_argument("--effort", default=DEFAULT_EFFORT)
    ap.add_argument("--redo-empty", action="store_true",
                    help="reset slots that ended with no clips back to pending (fresh "
                         "queries next pass); combine with --stage all for a re-sweep")
    ap.add_argument("--top-up", action="store_true",
                    help="reset every searched slot whose holder has <2 clips to pending "
                         "under the relaxed policy (longer instructionals allowed, new "
                         "picks APPEND); drives coverage to 100%% / min-2")
    ap.add_argument("--redo-principles", action="store_true",
                    help="reset all Principle slots to pending under the principle policy "
                         "(1 short hook + 1-2 deep lectures REPLACE the current shorts)")
    ap.add_argument("--relax-cap", type=int, default=None,
                    help="override the relaxed policy's search duration cap in seconds "
                         "(default 900; use 1800 for the final rescue round)")
    args = ap.parse_args()

    state = sync_slots(load_state(), args)
    if args.top_up:
        n = 0
        for k, s in state["slots"].items():
            if s["status"] not in ("applied", "curated", "verified"):
                continue
            if args.category and s["category"] != args.category:
                continue
            if args.file and args.file.lower() not in s["file"].lower():
                continue
            if slot_policy(s) == "principle" or len(_existing_clips(s)) >= 2:
                continue
            for field in ("queries", "picks", "verified_picks", "n_results", "applied", "error"):
                s.pop(field, None)
            s["status"] = "pending"
            s["policy"] = "relaxed"
            results_path(k).unlink(missing_ok=True)
            n += 1
        print(f"[top-up] reset {n} thin slot(s) to pending (relaxed policy)")
    if args.redo_principles:
        n = 0
        for k, s in state["slots"].items():
            if s["category"] != "Principles":
                continue
            for field in ("queries", "picks", "verified_picks", "n_results", "applied", "error"):
                s.pop(field, None)
            s["status"] = "pending"
            s["policy"] = "principle"
            results_path(k).unlink(missing_ok=True)
            n += 1
        print(f"[redo-principles] reset {n} principle slot(s) (lecture policy)")
    if args.redo_empty:
        n = 0
        for k, s in state["slots"].items():
            if s.get("applied") == "empty" or (s["status"] == "curated" and not s.get("picks")):
                for field in ("legend", "queries", "picks", "verified_picks", "n_results",
                              "applied", "error"):
                    s.pop(field, None)
                s["status"] = "pending"
                results_path(k).unlink(missing_ok=True)
                n += 1
        print(f"[redo-empty] reset {n} empty slot(s) to pending")
    save_state(state)
    for name in (list(STAGES) if args.stage == "all" else [args.stage]):
        STAGES[name](state, args)


if __name__ == "__main__":
    main()
