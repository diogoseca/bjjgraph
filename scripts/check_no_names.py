#!/usr/bin/env python3
"""No person's or gym's name in our own text: the clip-credit gate (v1.288.0).

The owner's rule, 17 Nov 2026 (U195 a, "no names in any title", and U196 b, "take the taught-by line out
everywhere"): a clip names its technique, never who teaches it. The source JSON keeps `by` and `channel` as
provenance for our own tools; nothing we render or emit carries them. The YouTube player shows the channel when
a video opens; that is YouTube's text, not ours, and is not checked here.

Two modes, each reading what a reader or a player is actually served:

  (default, no build: ci-validate)   the committed generated Markdown under content/, and the emitted neural
                                     payload under source/quartz/static/neural/content/ (ci-validate emits it).
  --built                            the built site under source/public/: every page's HTML, and the served
                                     copy of the payload under source/public/static/neural/content/.

Checks, each printing a POSITIVE count, because a check that never ran reports clean (CLAUDE.md §6):
  1. every film-study credit line (`<p class="clip-credit">`): 0 may say "taught by";
  2. every schema.org VideoObject in a page's JSON-LD: 0 may carry `creator` or `author`, and 0 may say
     "taught by" in its description;
  3. every clip object in every dossier chunk (role clips, root clips, escape rows): 0 may carry `by`.
It fails on any hit, and when any of the three counts is 0.

Found by this gate on its first green-path run: 8 case-variant ORPHAN pages (content/Positions/{K-Guard,North-South,
X-Guard,Z-Guard}/{top,bottom}.md) that no generator writes, beside the generated Top.md / Bottom.md, so
regenerate:md never cleaned them. Their three credit sites were stripped by hand-run script in v1.288.0.

Mutants, run at v1.288.0 and red here by name: a template's "— taught by" restored (check 1), its JSON-LD
`creator` restored (check 2), `by` back in `_CLIP_FIELDS` of scripts/_neural_content.py (check 3). The app's
"Watch: <title>" label has its own unit (tests/principle_clips.test.mjs) and journey (concepts-surface.spec.ts).
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CREDIT = re.compile(r'<p class="clip-credit">(.*?)</p>', re.S)
LDJSON = re.compile(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', re.S)
CLIP_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def walk(x, visit):
    if isinstance(x, dict):
        visit(x)
        for v in x.values(): walk(v, visit)
    elif isinstance(x, list):
        for v in x: walk(v, visit)


def check_pages(files, label, out):
    credits = videos = 0
    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")
        if "clip-credit" not in text and "VideoObject" not in text: continue
        rel = f.relative_to(ROOT)
        for m in CREDIT.finditer(text):
            credits += 1
            if "taught by" in m.group(1).lower(): out.append(f"{rel}: credit line names who teaches: {m.group(1)[:90]!r}")
        for m in LDJSON.finditer(text):
            try: block = json.loads(m.group(1))
            except ValueError: continue          # not ours to judge here: validate:seo parses JSON-LD
            def visit(d, rel=rel):
                nonlocal videos
                if d.get("@type") == "VideoObject":
                    videos += 1
                    for k in ("creator", "author"):
                        if k in d: out.append(f"{rel}: VideoObject {d.get('name', '')[:60]!r} carries {k}: {d[k]!r:.80}")
                    if "taught by" in str(d.get("description", "")).lower():
                        out.append(f"{rel}: VideoObject {d.get('name', '')[:60]!r} description names who teaches")
            walk(block, visit)
    print(f"{label}: {len(files)} files read, {credits} clip credit lines, {videos} VideoObjects")
    return credits, videos


def check_wire(dir_, label, out):
    files = sorted(dir_.glob("*.json")) if dir_.is_dir() else []
    clips = 0
    for f in files:
        try: data = json.loads(f.read_text(encoding="utf-8"))
        except ValueError: out.append(f"{f.relative_to(ROOT)}: not JSON"); continue
        def visit(d, f=f):
            nonlocal clips
            if isinstance(d.get("id"), str) and CLIP_ID.match(d["id"]) and "title" in d:
                clips += 1
                if "by" in d: out.append(f"{f.relative_to(ROOT)}: shipped clip {d['id']} carries by: {d['by']!r}")
        walk(data, visit)
    print(f"{label}: {len(files)} dossier chunks, {clips} clips shipped")
    return clips


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--built", action="store_true", help="check the built site under source/public/")
    a = ap.parse_args()
    out = []
    if a.built:
        pub = ROOT / "source/public"
        pages = sorted(pub.rglob("*.html"))
        credits, videos = check_pages(pages, "built pages", out)
        clips = check_wire(pub / "static/neural/content", "served payload", out)
    else:
        pages = sorted((ROOT / "content").rglob("*.md"))
        credits, videos = check_pages(pages, "generated Markdown", out)
        clips = check_wire(ROOT / "source/quartz/static/neural/content", "emitted payload", out)
    for name, n in (("clip credit lines", credits), ("VideoObjects", videos), ("shipped clips", clips)):
        if n == 0: out.append(f"0 {name} checked: this gate saw nothing, so it proves nothing (wrong tree, or no build/emit)")
    if out:
        print(f"FAIL no-names: {len(out)} finding(s)")
        for line in out[:40]: print("  " + line)
        if len(out) > 40: print(f"  ... and {len(out) - 40} more")
        return 1
    print("OK no-names: no credit line, no VideoObject creator, no shipped `by`")
    return 0


if __name__ == "__main__":
    sys.exit(main())
