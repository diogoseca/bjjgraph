#!/usr/bin/env python3
"""No person's or gym's name in our own text: the clip gate (v1.288.0; widened in v1.289.0, and it says what it holds).

The owner's rule, 17 Nov 2026 (U195 a, "no names in any title", and U196 b, "take the taught-by line out everywhere";
the option he picked reads "no person's or gym's name in our own text at all"): a clip names its technique, never who
teaches it, nor the gym or channel it comes from. The source JSON keeps `by` and `channel` as provenance for our own
tools; nothing we render or emit about a clip carries them. The YouTube player shows the channel when a video opens;
that is YouTube's text, not ours, and is not checked here.

TWO LISTS, and neither is the rule itself.
  THE NAME LIST is every `by` and `channel` VALUE on a clip in content/**/*.json, less the named EXCEPTIONS below.
    A name matches ONLY AS ONE WHOLE VALUE: whole-word, case-insensitive, any run of spaces or &nbsp; between its
    words. It has a floor (NAME_FLOOR): a list that shrank is red, because a short list reads everything as clean.
  THE LABEL LIST is tests/artifacts/no_names_labels.json: the labels v1.289.0 took out of clip titles that are NO
    clip's `by` or `channel` value (a series, a show, a tag, a handle, a web address, a short form, "10th Planet"),
    each a plain string with the count of titles it left. A ratchet: none of them may come back. Matched the same way,
    in clip titles and credit lines ONLY (never prose, never JSON-LD). An empty or missing list is red.

Two modes, each reading what a reader or a player is actually served:
  (default, no build: ci-validate)  the committed generated Markdown under content/, and the emitted neural payload,
                                    ALL of source/quartz/static/neural/** (ci-validate emits it).
  --built                           the built site under source/public/: every page's HTML, ALL of
                                    static/neural/**, the agent export (markdown/**) and llms.txt.
It never reads the source JSON's titles: a name back in a source title shows here only once the page is regenerated
(CI's "Generated content matches its generator" is what refuses the unregenerated page).

WHAT IT HOLDS, in CLAUDE.md §6.9's three forms.
  PINNED (tests/artifacts/no_names_mutants.py: every mutant red at a named check, from a green control):
    pages:   in any element whose class list holds `clip-credit`: no listed name, no listed label, no "taught by"
             (case, spacing and &nbsp; folded); in the film-study section: no listed name, no "taught by";
             in any JSON-LD block that holds a VideoObject (an @type string or list; any <script type=
             "application/ld+json" ...> tag), no person-ish key anywhere (creator, author, contributor, actor,
             publisher and the rest of PERSON_KEYS) and no listed name or "taught by" in ANY string; a JSON-LD
             block that mentions VideoObject and does not parse is a finding, never skipped;
    payload: every clip object (an 11-character id with a title, and no `url` or `kind`) anywhere under
             static/neural/**, at any depth: its keys are a subset of CLIP_KEYS (an allow-list: `by`, `channel`,
             `teacher`, ... all fail), and its title holds no listed name and no listed label;
             and NO file under static/neural/** (JSON that parses or not, a script, anything) holds a quoted `by`
             key, whatever else the record carries;
    export:  (--built) every credit line of the agent export (a line holding "Watch on YouTube" or "clip-credit"):
             no listed name, no listed label, no "taught by"; llms.txt: no line holding "taught by" next to a name;
             a built tree with no markdown/ or no llms.txt is a finding;
    counts:  the name list (at least NAME_FLOOR), the label list, credit lines, VideoObjects, shipped clips and, in
             --built mode, the exported credit lines: each POSITIVE, any of them 0 is red (CLAUDE.md §6: a check that
             never ran reports clean).
  PARTIALLY PINNED:
    names:   only a WHOLE `by` or `channel` value matches. All of these pass: a part of one (a surname alone, a
             possessive, "Gracie"), the same name glued or hyphenated (a tag, a handle), and any person, gym, show or
             series that is no clip's `by` or `channel` and not on the label list. Measured on v1.289.0's own work
             (208 distinct rewritten titles, each put back): the name list alone flags 53; with the label list, 193.
             The 15 that still pass are named in the label file's `_meta.not_held`. Persons by surname are the next
             check's (a names lexicon with the eponyms masked), not this one's.
    labels:  a ratchet on what v1.289.0 removed, not a detector: a new show or gym nobody listed passes.
    floor:   NAME_FLOOR sits 48 below the list (rotted clips leave, and their channels with them): a smaller loss
             passes.
    markup:  the checks are bound to today's markup: "taught by" outside the film-study section and the credit
             elements (another element, an attribute such as an iframe's title, a meta description, frontmatter), a
             credit whose class is single-quoted, a JSON-LD script tag typed with single quotes, and a name on an
             exported film line with no "Watch on YouTube" all pass.
    payload: a `by` written UNQUOTED in a script passes; a clip-shaped record with no title, or one that also
             carries `url` or `kind`, is not held to the allow-list (its `by` still fails, by the key scan);
             static/contentIndex.json and the RSS feed are not read.
    counts:  aggregate, not per-family floors: a whole template family could lose its credits and stay green.
  UNGUARDED: names in AUTHORED prose (articles, flashcards and their FAQ JSON-LD, Systems guides and their course
    listings, references): the owner's call, not this gate's; a JSON-LD block with no VideoObject (an Article, a FAQ,
    a `creator` there); a bare name in llms.txt.
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
# The name list's FLOOR. Measured 2026-11-17 (v1.289.0): 1,198 names. The floor sits 48 below, because the monthly
# clips-verify run drops rotted clips and a channel can leave with its last clip. It moves BY HAND, with the date.
# Recompute: python3 scripts/check_no_names.py | head -1
NAME_FLOOR = 1150
# The labels v1.289.0 removed from clip titles that are no clip's `by` or `channel` (see the file's own _meta).
LABELS_FILE = ROOT / "tests/artifacts/no_names_labels.json"
BY_KEY = re.compile(rb'"by"\s*:')
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


def load_labels():
    """The label list: (regex or None, how many labels). A label is a plain string; a leading # or @ needs no word
    boundary before it (a tag can be glued to the word before)."""
    try: labels = json.loads(LABELS_FILE.read_text(encoding="utf-8")).get("labels") or {}
    except (OSError, ValueError, AttributeError): return None, 0
    alts = []
    for lab in sorted((l for l in labels if isinstance(l, str) and l.strip()), key=len, reverse=True):
        w = " ".join(lab.replace("\u2019", "'").split())
        body = r"\s+".join(re.escape(x) for x in w.split())
        alts.append((r"(?<![\w])" if re.match(r"\w", w) else "") + body + (r"(?![\w])" if re.search(r"\w$", w) else ""))
    return (re.compile("(" + "|".join(alts) + ")", re.I) if alts else None), len(alts)


def label_hit(lx, s):
    if not lx: return None
    m = lx.search(" ".join(H.unescape(s).replace("\xa0", " ").replace("\u2019", "'").split()))
    return m.group(1) if m else None


def is_video(node):
    t = node.get("@type")
    return t == "VideoObject" or (isinstance(t, list) and "VideoObject" in t)


def check_pages(files, label, rx, lx, out):
    credits = videos = 0
    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")
        if "clip-credit" not in text and "VideoObject" not in text and "film-study" not in text: continue
        rel = f.relative_to(ROOT)
        for m in CREDIT_P.finditer(text):
            credits += 1
            h = hit(rx, text_of(m.group(2)))
            if h: out.append(f"{rel}: credit line names {h!r}: {text_of(m.group(2))[:90]!r}")
            h = label_hit(lx, text_of(m.group(2)))
            if h: out.append(f"{rel}: credit line carries the removed label {h!r}: {text_of(m.group(2))[:90]!r}")
        for m in FILM_SECTION.finditer(text):
            h = hit(rx, text_of(m.group(1)))
            if h: out.append(f"{rel}: film-study section names {h!r}")
        for m in LDJSON.finditer(text):
            try: block = json.loads(m.group(1))
            except ValueError:
                if "VideoObject" in m.group(1):  # never skipped: a block we cannot read is a block we did not check
                    videos += 1
                    out.append(f"{rel}: a JSON-LD block that mentions VideoObject does not parse, so it was not checked")
                continue
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


def check_payload(dir_, label, rx, lx, out):
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
                    h = label_hit(lx, str(d.get("title") or ""))
                    if h: out.append(f"{f.relative_to(ROOT)}: shipped clip {d['id']}'s title carries the removed label {h!r}")
                for v in d.values(): visit(v)
            elif isinstance(d, list):
                for v in d: visit(v)
        visit(data)
    # The `by` key, in ANY file the site ships here (JSON that parses or not, a script), whatever the record's other
    # keys: a clip that gains `url` leaves is_clip, and must not leave the allow-list and this scan together.
    every = sorted(p for p in dir_.rglob("*") if p.is_file()) if dir_.is_dir() else []
    for f in every:
        n = len(BY_KEY.findall(f.read_bytes()))
        if n: out.append(f"{f.relative_to(ROOT)}: ships a `by` key ({n} time(s)); nothing under static/neural may carry one")
    print(f"{label}: {len(files)} JSON files under {dir_.relative_to(ROOT)}, {clips} clips shipped; {len(every)} files scanned for a `by` key")
    return clips


def check_export(pub, rx, lx, out):
    n = 0
    if not (pub / "markdown").is_dir(): out.append(f"{(pub / 'markdown').relative_to(ROOT)}: the agent export is absent, so its credit lines were not checked")
    for f in (sorted((pub / "markdown").rglob("*.md")) if (pub / "markdown").is_dir() else []):
        for i, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if "Watch on YouTube" in line or "clip-credit" in line:
                n += 1
                h = hit(rx, text_of(line))
                if h: out.append(f"{f.relative_to(ROOT)}:{i}: an exported credit names {h!r}")
                h = label_hit(lx, text_of(line))
                if h: out.append(f"{f.relative_to(ROOT)}:{i}: an exported credit carries the removed label {h!r}")
    llms = pub / "llms.txt"
    if not llms.is_file(): out.append(f"{llms.relative_to(ROOT)}: absent, so it was not checked")
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
    print(f"name list: {n_names} `by` and `channel` values from content/, less {len(EXCEPTIONS)} named exceptions (floor {NAME_FLOOR})")
    if 0 < n_names < NAME_FLOOR:
        out.append(f"the name list holds {n_names} names, below its floor of {NAME_FLOOR}: `by` or `channel` values were lost, and a short list reads names as clean (NAME_FLOOR moves by hand)")
    lx, n_labels = load_labels()
    print(f"label list: {n_labels} removed labels held, from {LABELS_FILE.relative_to(ROOT)}")
    counts = {"names on the list": n_names, "labels on the list": n_labels}
    if a.built:
        pub = ROOT / "source/public"
        counts["clip credit lines"], counts["VideoObjects"] = check_pages(sorted(pub.rglob("*.html")), "built pages", rx, lx, out)
        counts["shipped clips"] = check_payload(pub / "static/neural", "served payload", rx, lx, out)
        counts["exported credit lines"] = check_export(pub, rx, lx, out)
    else:
        counts["clip credit lines"], counts["VideoObjects"] = check_pages(sorted((ROOT / "content").rglob("*.md")), "generated Markdown", rx, lx, out)
        counts["shipped clips"] = check_payload(ROOT / "source/quartz/static/neural", "emitted payload", rx, lx, out)
    for name, n in counts.items():
        if n == 0 and name == "labels on the list":
            out.append(f"0 labels on the list: {LABELS_FILE.relative_to(ROOT)} is missing, unreadable or empty, so no removed label is held")
        elif n == 0: out.append(f"0 {name}: this gate saw nothing, so it proves nothing (wrong tree, or no build/emit)")
    if out:
        print(f"FAIL no-names: {len(out)} finding(s)")
        for line in out[:40]: print("  " + line)
        if len(out) > 40: print(f"  ... and {len(out) - 40} more")
        return 1
    print("OK no-names: no listed name or removed label in a credit or a shipped clip, no name in a video's JSON-LD; shipped clips carry player fields only")
    return 0


if __name__ == "__main__":
    sys.exit(main())
