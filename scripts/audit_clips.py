#!/usr/bin/env python3
"""audit_clips.py — LLM mismatch audit of every curated clip against its slot.

Machine verification (oEmbed/Shorts checks) proves a video EXISTS and embeds;
it cannot tell whether the video actually teaches THIS technique for THIS role.
This audit batches every applied clip through Claude with its slot context and
verdicts each one:

  ok              — plausibly the right technique + role
  wrong_technique — different move (title/channel clearly about something else)
  wrong_role      — execution footage on a defender slot (or vice versa)
  junk            — podcast/vlog/compilation/unrelated

Confidence high|medium|low. With --prune-high, high-confidence non-ok clips are
removed from the content JSON (atomic write) and their slot statuses reset so
the --top-up pass re-sources them. Everything non-ok lands in
clips_sourcing/triage.html for owner review.

Usage:
  python3 scripts/audit_clips.py --dry-run --max-clips 100   # calibrate first
  python3 scripts/audit_clips.py --prune-high                # full audit
  python3 scripts/audit_clips.py --category Transitions --file Kimura
Verdicts are cached in clips_sourcing/audit.json (keyed clip-id+slot) so
reruns only audit new/changed picks.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _atomic_io import atomic_write_json, atomic_write_text
from _clips import CONTENT, iter_clips_arrays
from claude_infer import call_claude
from peak_throttle import throttle_if_peak

ROOT = Path(__file__).resolve().parent.parent
WORKDIR = ROOT / "clips_sourcing"
AUDIT_PATH = WORKDIR / "audit.json"
TRIAGE_PATH = WORKDIR / "triage.html"
STATE_PATH = WORKDIR / "state.json"

CLAUDE_MODEL = "claude-opus-4-8[1m]"  # matches source_clips.py
DEFAULT_EFFORT = "medium"
BATCH = 50

ROLE_NOTES = {
    "attacker": "EXECUTING the technique (instruction/demo of doing it)",
    "defender": "DEFENDING/ESCAPING the technique (defense instruction, NOT execution)",
    "top": "playing TOP in the position (control/attacks)",
    "bottom": "playing BOTTOM in the position (escapes/guard work)",
    None: "overview/concept content for this entry",
}

AUDIT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdicts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "key": {"type": "string"},
                    "verdict": {"type": "string",
                                "enum": ["ok", "wrong_technique", "wrong_role", "junk"]},
                    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    "reason": {"type": "string"},
                },
                "required": ["key", "verdict", "confidence"],
            },
        }
    },
    "required": ["verdicts"],
}


def clip_key(where, clip):
    return f"{where}::{clip.get('id')}"


def gather(args):
    """Every applied clip with its slot context. Returns list of dicts."""
    items = []
    for f, _data, role, holder in iter_clips_arrays(args.category, args.file):
        where = f"{os.path.relpath(f, CONTENT)}#{role or 'root'}"
        name = _data.get("name", Path(f).stem)
        for clip in holder["clips"]:
            items.append({
                "key": clip_key(where, clip), "where": where, "file": f, "role": role,
                "name": name, "clip": clip,
            })
    return items


def audit_batches(items, cache, args):
    todo = [it for it in items if it["key"] not in cache]
    print(f"[audit] {len(items)} clips total, {len(todo)} to audit ({len(items) - len(todo)} cached)")
    if args.max_clips:
        todo = todo[: args.max_clips]
    consec_fails = 0
    for i in range(0, len(todo), BATCH):
        batch = todo[i: i + BATCH]
        throttle_if_peak()
        lines = []
        for it in batch:
            c = it["clip"]
            dur = f"{c['duration']}s" if c.get("duration") else "?s"
            lines.append(
                f"- key: {it['key']}\n"
                f"  slot: '{it['name']}' — {ROLE_NOTES.get(it['role'])}\n"
                f"  clip: \"{c.get('title', '')}\" | by {c.get('by', '?')} | "
                f"channel {c.get('channel', '?')} | {dur}")
        prompt = f"""You audit curated BJJ film-study clips. For EACH entry judge whether the clip
(title/instructor/channel/duration) plausibly teaches the slot's technique/position FOR THE
STATED ROLE. You only see metadata — judge plausibility, not video content:
- ok: title/instructor plausibly match the technique and role
- wrong_technique: clearly a different move (e.g. a kimura video on an armbar slot)
- wrong_role: execution/attack content on a defender/escape slot, or vice versa
- junk: podcast/vlog/highlight-compilation/gear-review/unrelated
Confidence: high = the title itself is conclusive; medium = probable but ambiguous title;
low = can't really tell. BJJ naming nuance: many techniques have synonyms (bullfighter=
toreando, cow catcher=neck crank variations, ashi garami families) — do NOT flag synonyms
or umbrella-term titles as wrong_technique. General-position titles on role slots are ok
if the role content is plausible.

ENTRIES:
{chr(10).join(lines)}

Return JSON: {{"verdicts": [{{"key", "verdict", "confidence", "reason"}}]}} — one entry per
input, `key` copied verbatim, `reason` <= 12 words."""
        payload, err = call_claude(prompt, AUDIT_SCHEMA, args.model, args.effort)
        data = None
        if not err:
            try:
                data = json.loads(payload)
            except (TypeError, json.JSONDecodeError):
                m = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", payload or "")
                for x in m:
                    try:
                        data = json.loads(x)
                        break
                    except json.JSONDecodeError:
                        continue
        if not data or "verdicts" not in data:
            print(f"[audit] batch failed: {err or 'unparseable response'}")
            consec_fails += 1
            if consec_fails >= 3:
                print("[audit] 3 consecutive batch failures — aborting; rerun to resume")
                return
            continue
        consec_fails = 0
        keys_in_batch = {it["key"] for it in batch}
        n = 0
        for v in data["verdicts"]:
            if v.get("key") in keys_in_batch and v.get("verdict") and v.get("confidence"):
                cache[v["key"]] = {"verdict": v["verdict"], "confidence": v["confidence"],
                                   "reason": v.get("reason", "")}
                n += 1
        WORKDIR.mkdir(exist_ok=True)
        atomic_write_json(AUDIT_PATH, cache)
        print(f"[audit] {min(i + BATCH, len(todo))}/{len(todo)} audited (+{n})")


def prune_high(items, cache, args):
    """Remove high-confidence non-ok clips; reset their slots for top-up re-sourcing."""
    by_file = {}
    flagged = 0
    for it in items:
        v = cache.get(it["key"])
        if v and v["verdict"] != "ok" and v["confidence"] == "high":
            by_file.setdefault(it["file"], []).append(it)
            flagged += 1
    print(f"[prune] {flagged} high-confidence mismatches across {len(by_file)} file(s)")
    if args.dry_run or not by_file:
        return 0
    pruned = 0
    for f, its in by_file.items():
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)
        for it in its:
            holder = data if it["role"] is None else data.get(it["role"])
            if not isinstance(holder, dict):
                continue
            before = len(holder.get("clips", []))
            holder["clips"] = [c for c in holder.get("clips", [])
                               if c.get("id") != it["clip"]["id"]]
            if not holder["clips"]:
                holder.pop("clips")
            pruned += before - len(holder.get("clips", []))
        atomic_write_json(f, data)
    print(f"[prune] removed {pruned} clip(s); --top-up will re-source affected slots")
    return pruned


def write_triage(items, cache):
    rows = []
    order = {"high": 0, "medium": 1, "low": 2}
    flagged = [(it, cache[it["key"]]) for it in items
               if it["key"] in cache and cache[it["key"]]["verdict"] != "ok"]
    flagged.sort(key=lambda x: (order.get(x[1]["confidence"], 3), x[1]["verdict"]))
    for it, v in flagged:
        c = it["clip"]
        rows.append(f"""<div class="card {v['confidence']}">
<a href="https://www.youtube.com/watch?v={c.get('id')}" target="_blank">
<img src="https://i.ytimg.com/vi/{c.get('id')}/hqdefault.jpg" loading="lazy" alt=""></a>
<div class="t">{c.get('title', '')}</div>
<div class="v">{v['verdict']} · {v['confidence']} — {v.get('reason', '')}</div>
<div class="s">{it['where']} · by {c.get('by', '?')} · {c.get('duration', '?')}s</div></div>""")
    n_ok = sum(1 for it in items if cache.get(it["key"], {}).get("verdict") == "ok")
    html = f"""<!doctype html><meta charset="utf-8"><title>BJJGraph clip triage</title>
<style>body{{font:14px system-ui;background:#101418;color:#dde;margin:24px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}}
.card{{background:#1a2028;border-radius:10px;padding:10px}}
.card.high{{outline:2px solid #d55}}.card.medium{{outline:1px solid #b90}}
img{{width:100%;border-radius:6px}}.t{{font-weight:700;margin:6px 0 2px}}
.v{{color:#e8956b;font-size:12px}}.s{{color:#68a;font-size:11px;margin-top:4px;word-break:break-all}}</style>
<h1>Clip triage — {len(flagged)} flagged of {len(cache)} audited ({n_ok} ok)</h1>
<p>Red outline = high confidence (auto-pruned when --prune-high), amber = medium (your call).
To prune by hand: delete the clip from the named content JSON file, rerun clips:report.</p>
<div class="grid">{''.join(rows)}</div>"""
    WORKDIR.mkdir(exist_ok=True)
    atomic_write_text(TRIAGE_PATH, html)
    print(f"[triage] {len(flagged)} flagged -> {TRIAGE_PATH}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--category", choices=["Positions", "Transitions", "Submissions", "Principles"])
    ap.add_argument("--file", help="substring filter on content file path")
    ap.add_argument("--max-clips", type=int)
    ap.add_argument("--prune-high", action="store_true",
                    help="remove high-confidence mismatches from content JSON")
    ap.add_argument("--dry-run", action="store_true", help="audit + report, never prune")
    ap.add_argument("--model", default=CLAUDE_MODEL)
    ap.add_argument("--effort", default=DEFAULT_EFFORT)
    args = ap.parse_args()

    cache = json.load(open(AUDIT_PATH)) if AUDIT_PATH.exists() else {}
    items = gather(args)
    audit_batches(items, cache, args)
    write_triage(items, cache)
    if args.prune_high:
        prune_high(items, cache, args)
    from collections import Counter
    item_keys = {it["key"] for it in items}
    dist = Counter(f"{v['verdict']}/{v['confidence']}"
                   for k, v in cache.items() if k in item_keys)
    print("[audit] verdicts:", dict(dist))


if __name__ == "__main__":
    main()
