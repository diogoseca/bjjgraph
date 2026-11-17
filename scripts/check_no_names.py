#!/usr/bin/env python3
"""No person's or gym's name in our own text: the clip gate (v1.288.0, grown to the rule in v1.289.0).

The owner's rule, 17 Nov 2026 (U195 a, "no names in any title", and U196 b, "take the taught-by line out everywhere";
the option he picked reads "no person's or gym's name in our own text at all"): a clip names its technique, never who
teaches it, nor the gym or channel it comes from. The source JSON keeps `by` and `channel` as provenance for our own
tools; nothing we render or emit about a clip carries them. The YouTube player shows the channel when a video opens;
that is YouTube's text, not ours, and is not checked here.

THE NAME LIST is every `by` and `channel` VALUE on a clip in content/**/*.json (persons, gyms, channels), less the named
EXCEPTIONS below (a technique or position that shares a word with a channel, a generic word), each with its reason.
A name matches whole-word, case-insensitive, with any run of spaces or &nbsp; between its words.

Two modes, each reading what a reader or a player is actually served:
  (default, no build: ci-validate)  the committed generated Markdown under content/, and the emitted neural payload,
                                    ALL of source/quartz/static/neural/** (ci-validate emits it).
  --built                           the built site under source/public/: every page's HTML, ALL of
                                    static/neural/**, the agent export (markdown/**) and llms.txt.

WHAT IT CHECKS, in CLAUDE.md §6.9's three forms.
  PINNED (v1.289.0: the independent read of #433's 25 mutants, each red at a named check, from a green control; rerun
  with tests/artifacts/no_names_mutants.py):
    pages:   in the film-study section and in any element whose class list holds `clip-credit`, no name and no
             "taught by" (case, spacing and &nbsp; folded);
             in any JSON-LD block that holds a VideoObject (an @type string or list; any <script type=
             "application/ld+json" ...> tag), no person-ish key anywhere (creator, author, contributor, actor,
             publisher and the rest of PERSON_KEYS) and no name or "taught by" in ANY string;
    payload: every clip object (an 11-character id with a title, and no `url` or `kind`) anywhere under static/neural/**, at any depth, in
             any file: its keys are a subset of CLIP_KEYS (an allow-list: `by`, `channel`, `teacher`, ... all fail),
             and its title holds no name;
    export:  every credit line of the agent export (a line holding "Watch on YouTube" or "clip-credit"): no name,
             no "taught by"; llms.txt: no line holding "taught by" next to a name;
    counts:  credit lines, VideoObjects and shipped clips, each POSITIVE, and the name list itself (a list that
             loaded nothing proves nothing): any of them 0 is red (CLAUDE.md §6: a check that never ran reports clean).
  PARTIALLY PINNED: the counts are aggregate, not per-family floors, so a whole template family could lose its credits
    and stay green; a name that is in no clip's `by` or `channel` (a person named only in a title) is not on the list.
  UNGUARDED: names in AUTHORED prose (articles, flashcards and their FAQ JSON-LD, Systems guides, references): the
    owner's call, not this gate's; a VideoObject-free JSON-LD block (an Article, a FAQ) is not read.
"""
import argparse
import html as H
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLIP_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
# The player fields a clip may ship with (scripts/_neural_content.py _CLIP_FIELDS). An allow-list: any other key fails.
CLIP_KEYS = {"id", "start", "end", "vertical", "title", "duration", "front", "half"}
PERSON_KEYS = {"creator", "author", "contributor", "actor", "publisher", "producer", "director", "performer", "editor",
               "copyrightHolder", "sourceOrganization", "provider", "funder", "sponsor", "character", "musicBy",
               "translator", "accountablePerson", "maintainer"}
# Values of `by` or `channel` that are not names of who teaches: each with its reason. Matched case-insensitively.
EXCEPTIONS = {
    "Escapes": "a channel's name, and the ordinary BJJ word for escapes, which 35 titles use as such",
    "Ippon": "a channel's name, and the judo throw ippon seoi nage, which 3 titles name",
}
CREDIT_P = re.compile(r'<(\w+)\b[^>]*\bclass="[^"]*\bclip-credit\b[^"]*"[^>]*>(.*?)</\1>', re.S)
FILM_SECTION = re.compile(r'<section\b[^>]*\bid="film-study"[^>]*>(.*?)</section>', re.S)
LDJSON = re.compile(r'<script\b[^>]*\btype="application/ld\+json"[^>]*>\s*(.*?)\s*</script>', re.S)
TAUGHT = re.compile(r"taught\s+by", re.I)


def is_clip(d):
    # A clip: an 11-character YouTube id and a title. A Systems guide's course listing can have an 11-character id too
    # ("marcelotine") but carries a `url` and a `kind`; it is authored product text, not a clip (UNGUARDED, prose).
    return isinstance(d.get("id"), str) and bool(CLIP_ID.match(d["id"])) and "title" in d and "url" not in d and "kind" not in d


def text_of(fragment):
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", fragment)).replace("\xa0", " ")).strip()


def load_names():
    names = {}
    for f in sorted((ROOT / "content").rglob("*.json")):
        try: d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError: continue
        def visit(x):
            if isinstance(x, dict):
                if is_clip(x):
                    for k in ("by", "channel"):
                        v = x.get(k)
                        if isinstance(v, str) and v.strip(): names.setdefault(" ".join(v.split()), f.relative_to(ROOT).as_posix())
                for v in x.values(): visit(v)
            elif isinstance(x, list):
                for v in x: visit(v)
        visit(d)
    exc = {k.lower() for k in EXCEPTIONS}
    kept = sorted((n for n in names if n.lower() not in exc), key=len, reverse=True)
    words = [r"\s+".join(re.escape(w) for w in n.split()) for n in kept]
    rx = re.compile(r"(?<![\w])(" + "|".join(words) + r")(?![\w])", re.I) if words else None
    return rx, len(kept)


def hit(rx, s):
    s = " ".join(H.unescape(s).replace("\xa0", " ").split())
    if TAUGHT.search(s): return "taught by"
    m = rx.search(s) if rx else None
    return m.group(1) if m else None


def is_video(node):
    t = node.get("@type")
    return t == "VideoObject" or (isinstance(t, list) and "VideoObject" in t)


def check_pages(files, label, rx, out):
    credits = videos = 0
    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")
        if "clip-credit" not in text and "VideoObject" not in text and "film-study" not in text: continue
        rel = f.relative_to(ROOT)
        for m in CREDIT_P.finditer(text):
            credits += 1
            h = hit(rx, text_of(m.group(2)))
            if h: out.append(f"{rel}: credit line names {h!r}: {text_of(m.group(2))[:90]!r}")
        for m in FILM_SECTION.finditer(text):
            h = hit(rx, text_of(m.group(1)))
            if h: out.append(f"{rel}: film-study section names {h!r}")
        for m in LDJSON.finditer(text):
            try: block = json.loads(m.group(1))
            except ValueError: continue          # validate:seo parses JSON-LD; not this gate's to judge
            found = []
            def find(x):
                if isinstance(x, dict):
                    if is_video(x): found.append(x)
                    for v in x.values(): find(v)
                elif isinstance(x, list):
                    for v in x: find(v)
            find(block)
            if not found: continue
            videos += len(found)
            def walk(x, path=""):
                if isinstance(x, dict):
                    for k, v in x.items():
                        if k in PERSON_KEYS: out.append(f"{rel}: a video's JSON-LD carries {k} at {path or '/'}")
                        walk(v, path + "/" + k)
                elif isinstance(x, list):
                    for i, v in enumerate(x): walk(v, f"{path}[{i}]")
                elif isinstance(x, str):
                    h = hit(rx, x)
                    if h: out.append(f"{rel}: a video's JSON-LD string at {path} names {h!r}: {x[:80]!r}")
            walk(block)
    print(f"{label}: {len(files)} files read, {credits} clip credit lines, {videos} VideoObjects")
    return credits, videos


def check_payload(dir_, label, rx, out):
    files = sorted(p for p in dir_.rglob("*.json") if p.is_file()) if dir_.is_dir() else []
    clips = 0
    for f in files:
        try: data = json.loads(f.read_text(encoding="utf-8"))
        except ValueError: continue          # not JSON a player reads as clips (the payload's own gates own its shape)
        def visit(d, f=f):
            nonlocal clips
            if isinstance(d, dict):
                if is_clip(d):
                    clips += 1
                    extra = sorted(set(d) - CLIP_KEYS)
                    if extra: out.append(f"{f.relative_to(ROOT)}: shipped clip {d['id']} carries {extra}")
                    h = hit(rx, str(d.get("title") or ""))
                    if h: out.append(f"{f.relative_to(ROOT)}: shipped clip {d['id']}'s title names {h!r}")
                for v in d.values(): visit(v)
            elif isinstance(d, list):
                for v in d: visit(v)
        visit(data)
    print(f"{label}: {len(files)} JSON files under {dir_.relative_to(ROOT)}, {clips} clips shipped")
    return clips


def check_export(pub, rx, out):
    n = 0
    for f in (sorted((pub / "markdown").rglob("*.md")) if (pub / "markdown").is_dir() else []):
        for i, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if "Watch on YouTube" in line or "clip-credit" in line:
                n += 1
                h = hit(rx, text_of(line))
                if h: out.append(f"{f.relative_to(ROOT)}:{i}: an exported credit names {h!r}")
    llms = pub / "llms.txt"
    if llms.is_file():
        for i, line in enumerate(llms.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if TAUGHT.search(line) and rx and rx.search(" ".join(line.split())):
                out.append(f"{llms.relative_to(ROOT)}:{i}: names who teaches: {line[:90]!r}")
    print(f"agent export: {n} credit lines; llms.txt {'read' if llms.is_file() else 'absent'}")
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--built", action="store_true", help="check the built site under source/public/")
    a = ap.parse_args()
    out = []
    rx, n_names = load_names()
    print(f"name list: {n_names} `by` and `channel` values from content/, less {len(EXCEPTIONS)} named exceptions")
    counts = {"names on the list": n_names}
    if a.built:
        pub = ROOT / "source/public"
        counts["clip credit lines"], counts["VideoObjects"] = check_pages(sorted(pub.rglob("*.html")), "built pages", rx, out)
        counts["shipped clips"] = check_payload(pub / "static/neural", "served payload", rx, out)
        check_export(pub, rx, out)
    else:
        counts["clip credit lines"], counts["VideoObjects"] = check_pages(sorted((ROOT / "content").rglob("*.md")), "generated Markdown", rx, out)
        counts["shipped clips"] = check_payload(ROOT / "source/quartz/static/neural", "emitted payload", rx, out)
    for name, n in counts.items():
        if n == 0: out.append(f"0 {name}: this gate saw nothing, so it proves nothing (wrong tree, or no build/emit)")
    if out:
        print(f"FAIL no-names: {len(out)} finding(s)")
        for line in out[:40]: print("  " + line)
        if len(out) > 40: print(f"  ... and {len(out) - 40} more")
        return 1
    print("OK no-names: no name in a credit, a video's JSON-LD or a shipped clip; shipped clips carry player fields only")
    return 0


if __name__ == "__main__":
    sys.exit(main())
