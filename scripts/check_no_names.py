#!/usr/bin/env python3
"""No person's or gym's name in our own text: the clip gate (v1.288.0; widened in v1.289.0) and the prose check (v1.291.0).

The owner's rule, 17 Nov 2026 (U195 a, "no names in any title", and U196 b, "take the taught-by line out everywhere";
the option he picked reads "no person's or gym's name in our own text at all"): a clip names its technique, never who
teaches it, nor the gym or channel it comes from. The source JSON keeps `by` and `channel` as provenance for our own
tools; nothing we render or emit about a clip carries them. The YouTube player shows the channel when a video opens;
that is YouTube's text, not ours, and is not checked here.

THE PROSE CHECK (v1.291.0). The owner's rule U203 a (17 Nov 2026): "Keep a name only where the name is the thing
itself", and U206 a: an origin line says who the technique on that page is named after, and nobody else. Real people's
names left our own written text (172 mentions in 140 fields of 66 records), and this check keeps them out: no entry of
THE NAMES LEXICON in authored prose, in a flashcard, in a clip title or in a credit line, outside the kinds
ALLOWED_KINDS names with their reasons. It reads the SOURCE JSON for prose and cards (the pages are tied to it by CI's
"Generated content matches its generator"), and the emitted or built payload for the cards the app is served, because
those are built from graph.json: a content change that does not refresh graph.json ships the old cards, and neither
regenerate:md nor the payload emit rewrites it (v1.291.0's own first payload still carried every name in the cards).

THREE LISTS, and none is the rule itself.
  THE NAME LIST is every `by` and `channel` VALUE on a clip in content/**/*.json, less the named EXCEPTIONS below.
    A name matches ONLY AS ONE WHOLE VALUE: whole-word, case-insensitive, any run of spaces or &nbsp; between its
    words. It has a floor (NAME_FLOOR): a list that shrank is red, because a short list reads everything as clean.
  THE LABEL LIST is tests/artifacts/no_names_labels.json: the labels v1.289.0 took out of clip titles that are NO
    clip's `by` or `channel` value (a series, a show, a tag, a handle, a web address, a short form, "10th Planet"),
    each a plain string with the count of titles it left. A ratchet: none of them may come back. Matched the same way,
    in clip titles and credit lines ONLY (never prose, never JSON-LD). An empty or missing list is red, and so is one
    below LABEL_FLOOR. A REFUSAL NAMES THE LABEL ("carries the removed label 'X'"). Eight of them are ordinary phrases
    ("BJJ Breakdown", "Daily BJJ", "Learn to Grapple", "Train For Real", "Armory", "The Merge", "First Day BJJ",
    "Who's Next"): a title that honestly needs those words is refused too. A label comes off BY HAND: delete its row,
    write why in the file's `_meta.not_held`, and lower LABEL_FLOOR by one in the same change, with the date.
  THE NAMES LEXICON is tests/artifacts/no_names_lexicon.json: real people our text has named. `full_names` match whole
    words, case-insensitive; `single_tokens` (a surname or a first name used alone) match whole words with their capital
    letters, so the ordinary word "hall" is never the surname "Hall". Matched in authored prose, cards, clip titles and
    credit lines. It has a floor (LEXICON_FLOOR). It may never hold a word a technique or position is named by: the
    check refuses a token that is a word of one of the graph's own names or aliases, or that the file lists under
    `technique_words` (Kimura, Estima, the London, Marcelotine).

Two modes, each reading what a reader or a player is actually served:
  (default, no build: ci-validate)  the committed generated Markdown under content/, and the emitted neural payload,
                                    ALL of source/quartz/static/neural/** (ci-validate emits it).
  --built                           the built site under source/public/: every page's HTML, ALL of
                                    static/neural/**, the agent export (markdown/**) and llms.txt.
It never reads the source JSON's TITLES: a name back in a source title shows here only once the page is regenerated
(CI's "Generated content matches its generator" is what refuses the unregenerated page). Both modes read the source
JSON's prose and cards, and the cards under static/neural/flashcards.

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
    counts:  the name list (at least NAME_FLOOR), the label list (at least LABEL_FLOOR), credit lines, VideoObjects,
             shipped clips and, in --built mode, the exported credit lines: each POSITIVE, any of them 0 is red
             (CLAUDE.md §6: a check that never ran reports clean).
    prose (v1.291.0; tests/artifacts/no_names_prose_mutants.py, every mutant red at a named check, from green controls):
             in every authored string of content/{Positions,Transitions,Submissions,Principles,Learning}/**/*.json (every
             field not named in PROSE_SKIP, so a new field is read by default), flashcards included: no lexicon name
             outside ALLOWED_KINDS. An origin line is allowed BY PAGE AND EXACT SENTENCE: a second person added to one,
             or the same sentence on another page, is a finding, and a listed line that is gone from its page is red;
    cards:   in every card under static/neural/flashcards (a question, an answer, an option): no lexicon name;
    titles:  in a credit line, a shipped clip's title and (--built) an exported credit line: no lexicon name, so a
             person by surname ("… - Faria Sweep") is refused where the name list (whole values only) passes it;
    lexicon: at least LEXICON_FLOOR entries; unreadable or missing is red; a technique's own word on it is red;
             authored strings read and shipped cards read are each POSITIVE.
  PARTIALLY PINNED:
    names:   only a WHOLE `by` or `channel` value matches. All of these pass: a part of one (a surname alone, a
             possessive, "Gracie"), the same name glued or hyphenated (a tag, a handle), and any person, gym, show or
             series that is no clip's `by` or `channel` and not on the label list. Measured on v1.289.0's own work
             (208 distinct rewritten titles, each put back): the name list alone flags 53; with the label list, 193.
             The 15 that still pass are named in the label file's `_meta.not_held`. v1.291.0's lexicon refuses 2 more
             of them (the two "by Gracie…" titles): 195 of 208. The 13 left name no PERSON: a gym or a series whose
             name is ordinary words or a technique's ("The Base", "The EDGE", "Jiu Jitsu Matrix"), UFC, and words
             that name nobody ("Famous", "Camp -", "With BJJ Champion!").
    lexicon: a LIST, not a detector: a person nobody listed passes in prose (a new clip's teacher is on the name list
             for titles and credits at once, and on the lexicon only when someone adds them). Single tokens need their
             capitals. A full name split by markup or a line break passes.
    prose:   read from the source only: the payload's dossier prose and the page's FAQ JSON-LD are emitted from that
             same source and are not read again; graph.json itself is read only through the cards built from it.
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
  UNGUARDED: A SURNAME THAT IS AN ORDINARY ENGLISH WORD, used alone and listed by nobody ("Hall shows the entry",
    "Lo's pass"): listing it would refuse the word, so it is not listed, and it passes (the prose probe keeps that
    mutant green on purpose); gyms, schools and channels in prose ("10th Planet", a channel named as a source): U203 is
    about people; whatever stands inside an allowed kind (any name in a cited-source link's label, in a Systems guide,
    in a Learning reference); a JSON-LD block with no VideoObject (an Article, a FAQ, a `creator` there); a bare name
    in llms.txt.
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
# The label list's FLOOR (v1.291.0): 101 labels on 2026-11-17. A ratchet list that shrank holds less than it says. It
# moves BY HAND with the label that comes off (its reason goes to the file's `_meta.not_held`), with the date.
LABEL_FLOOR = 101
# THE NAMES LEXICON (v1.291.0, the prose check): real people named in our own text. See the file's own _meta.
LEXICON_FILE = ROOT / "tests/artifacts/no_names_lexicon.json"
# Its FLOOR. Measured 2026-11-17: 198 full names + 40 single tokens = 238. It moves BY HAND, with the date.
# Recompute: python3 scripts/check_no_names.py | grep '^lexicon'
LEXICON_FLOOR = 230
# WHERE A PERSON'S NAME MAY STAND IN OUR OWN TEXT (the owner's rule U203 a, 17 Nov 2026: "keep a name only where the
# name is the thing itself"), each kind with its reason. Everything else in authored prose and cards is a finding.
ALLOWED_KINDS = {
    "origin line": "U206 a: the one sentence on a page that says who the technique on THAT page is named after, and "
                   "nobody else. Listed by page and exact sentence in the lexicon file (`origin_lines`)",
    "cited source": "a cited video or course keeps its author: a name inside a Markdown link's label, or in a run of "
                    "links after 'Instructional sources:', 'Sources:' or 'Narration:'; and the one in-text citation of a "
                    "Learning page's own listed reference (`citations` in the lexicon file)",
    "Systems guide": "a Systems guide keeps the course and its author: content/Systems/ is not read, and a guide's "
                     "title standing inside other prose is its own name",
    "Learning reference": "`references[]` of a Learning page is its bibliography: not read",
    "technique word": "a technique or position named after a person keeps its name: a hit inside the graph's own names "
                      "and aliases is never a hit, and the lexicon may not hold a word one is named by",
}
# The authored sections the prose check reads (Systems: see ALLOWED_KINDS).
PROSE_SECTIONS = ("Positions", "Transitions", "Submissions", "Principles", "Learning")
# Source fields that are NOT authored prose, as dotted paths with [] for a list. Anything not matched here IS read, so a
# new field is checked by default. Graph names and wiring (the name is the thing); clips (titles have their own checks
# on the page and in the payload; `by` and `channel` are provenance); a Learning page's references; flags and dates.
PROSE_SKIP = re.compile(
    r"(^|\.)(clips|escape_clips)\[\]|^\.references\[\]|\.aliases\[\]$|^\.name$|^\.(top|bottom|attacker|defender)\.name$"
    r"|^\.slug$|\.variations\[\]\.(name|slug)$|related_content\[\]\.(name|content_type)$|related_positions\[\]\.name$"
    r"|related_submissions\[\](\.name)?$|\.from_position$|\.from_positions\[\]$|\.outcomes\[\]\.(to|result)$"
    r"|\.transitions\[\]\.(transition|outcomes.*)$|decision_tree\[\]\.actions\[\]\.(technique|target)$|\.sameAs\[\]$"
    r"|\.disambiguations\[\]\.name$|\.family$|\.starting_position$|principle_relationships\[\]\.principle_name$"
    r"|graph_applicability\.(families|terms)\[\]$|\.tags\[\]$|state_properties\.|\.verified$|\.half$")
MD_LINK = re.compile(r"\[[^\]]*\]\([^)]*\)")
CITE_RUN = re.compile(r"(?:Instructional sources?|Sources?|Narration)\s*:\s*(?:\[[^\]]*\]\([^)]*\)[\s;,.]*)+")
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


_LETTERS = re.compile(r"[a-z\u00e0-\u00ff]+")


def _alternation(names):
    return "|".join(r"\s+".join(re.escape(w) for w in n.split()) for n in sorted(names, key=len, reverse=True))


def _fold(s):
    """The text a name is matched in: entities decoded, &nbsp; and the curly apostrophe folded. Same length as `s` only
    when `s` holds no entity; the prose check passes plain JSON strings, which hold none."""
    return H.unescape(s).replace("\xa0", " ").replace("\u2019", "'")


def graph_names():
    """(technique and position names and aliases, Systems guide titles): the graph's own names, from the source."""
    own, systems = set(), set()
    for f in sorted((ROOT / "content").rglob("*.json")):
        try: d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError: continue
        if not isinstance(d, dict): continue
        if f.relative_to(ROOT / "content").parts[0] == "Systems":
            if isinstance(d.get("name"), str): systems.add(d["name"])
            continue
        for v in [d.get("name")] + list(d.get("aliases") or []) + [x.get("name") for x in (d.get("variations") or []) if isinstance(x, dict)]:
            if isinstance(v, str) and v.strip(): own.add(v.strip())
    return own, systems


class Lexicon:
    """tests/artifacts/no_names_lexicon.json, loaded and checked against itself and the graph. `problems` are findings."""

    def __init__(self):
        self.problems, self.full, self.tokens, self.origin, self.cites, self.words = [], [], [], [], [], {}
        try: raw = json.loads(LEXICON_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError): raw = None
        if not isinstance(raw, dict):
            self.problems.append(f"{LEXICON_FILE.relative_to(ROOT)} is missing or unreadable, so no person's name is held in prose, cards, titles or credits")
            raw = {}
        clean = lambda xs: sorted({" ".join(_fold(x).split()) for x in (xs or []) if isinstance(x, str) and x.strip()})
        self.full, self.tokens = clean(raw.get("full_names")), clean(raw.get("single_tokens"))
        self.words = {k: v for k, v in (raw.get("technique_words") or {}).items() if isinstance(k, str)}
        row = lambda r: isinstance(r, dict) and isinstance(r.get("page"), str) and isinstance(r.get("sentence"), str) and r["sentence"].strip()
        self.origin = [(r["page"], _fold(r["sentence"])) for r in (raw.get("origin_lines") or []) if row(r)]
        self.cites = [(r["page"], _fold(r["sentence"])) for r in (raw.get("citations") or []) if row(r)]
        self.n = len(self.full) + len(self.tokens)
        self.full_rx = re.compile(r"(?<![\w])(" + _alternation(self.full) + r")(?![\w])", re.I) if self.full else None
        self.tok_rx = re.compile(r"(?<![\w])(" + _alternation(self.tokens) + r")(?![\w])") if self.tokens else None
        # A cheap NECESSARY condition, so the two alternations run on the few strings that can match: the longest run of
        # letters of each entry must stand in the text as a run of letters of its own (case folded).
        self.keys = {max(_LETTERS.findall(n.lower()), key=len) for n in self.full + self.tokens if _LETTERS.search(n.lower())}
        self.own, self.systems = graph_names()
        self.sys_rx = re.compile("(" + _alternation(self.systems) + ")", re.I) if self.systems else None
        # A technique's own word may not be on the lexicon (ALLOWED_KINDS: technique word): it would refuse the technique.
        name_words = {}
        for n in self.own:
            for w in re.findall(r"[A-Za-z\u00c0-\u00ff][A-Za-z\u00c0-\u00ff'\-]*", _fold(n)): name_words.setdefault(w.lower(), n)
        listed = {k.lower() for k in self.words}
        for t in self.tokens:
            if t.lower() in listed: self.problems.append(f"the lexicon lists the technique word {t!r} as a person's name (it is in `technique_words`: {self.words.get(t) or 'a technique word'})")
            elif t.lower() in name_words: self.problems.append(f"the lexicon token {t!r} is a word of the technique or position name {name_words[t.lower()]!r}: a name the graph uses is never a person's name here")
        for n in self.full:
            if n.lower() in {x.lower() for x in self.own}: self.problems.append(f"the lexicon lists {n!r}, which is a technique's or position's own name")

    def hits(self, s):
        """Every listed name in `s` (plain text, entities already decoded), as (start, end, name); a full name hides its
        own parts; a hit inside a Systems guide's title is that title's, not a person's: the second list."""
        t = s.replace("\u2019", "'"); taken, out, in_title = [], [], []
        if self.keys.isdisjoint(_LETTERS.findall(t.lower())): return out, in_title
        titles = None
        for rx in (self.full_rx, self.tok_rx):
            if not rx: continue
            for m in rx.finditer(t):
                a, b = m.start(1), m.end(1)
                if any(x <= a < y for x, y in taken): continue
                taken.append((a, b))
                if titles is None: titles = [(x.start(), x.end()) for x in self.sys_rx.finditer(t)] if self.sys_rx else []
                (in_title if any(x <= a and b <= y for x, y in titles) else out).append((a, b, m.group(1)))
        return sorted(out), in_title

    def title_hit(self, s):
        """The first listed name in a clip title or a credit line (HTML already stripped), or None."""
        out, _ = self.hits(" ".join(_fold(s).split()))
        return out[0][2] if out else None


def _strings(x, path=""):
    if isinstance(x, dict):
        for k, v in x.items(): yield from _strings(v, f"{path}.{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x): yield from _strings(v, f"{path}[{i}]")
    elif isinstance(x, str): yield path, x


def check_prose(lex, out):
    """Authored prose and flashcards in the SOURCE JSON: no listed name outside ALLOWED_KINDS. Returns the counts."""
    n_files = n_strings = 0
    allowed = {"origin line": 0, "cited source": 0, "Systems guide": 0}
    listed = {}                                        # page -> [(sentence, kind, found?)]
    for kind, rows in (("origin line", lex.origin), ("cited source", lex.cites)):
        for page, sentence in rows: listed.setdefault(page, []).append([sentence, kind, 0])
    for section in PROSE_SECTIONS:
        for f in sorted((ROOT / "content" / section).rglob("*.json")):
            try: d = json.loads(f.read_text(encoding="utf-8"))
            except ValueError: continue
            n_files += 1
            rel = f.relative_to(ROOT).as_posix(); rows = listed.get(rel, [])
            for path, s in _strings(d):
                gp = re.sub(r"\[\d+\]", "[]", path)
                if PROSE_SKIP.search(gp): continue
                n_strings += 1
                t = _fold(s)
                spans = []                             # (start, end, kind): where a name may stand in THIS string
                for r in rows:
                    i = t.find(r[0])
                    while i >= 0:
                        spans.append((i, i + len(r[0]), r[1])); r[2] += 1
                        i = t.find(r[0], i + 1)
                found, in_title = lex.hits(t)
                allowed["Systems guide"] += len(in_title)
                if not found: continue
                for m in MD_LINK.finditer(t): spans.append((m.start(), m.end(), "cited source"))
                for m in CITE_RUN.finditer(t): spans.append((m.start(), m.end(), "cited source"))
                for a, b, name in found:
                    kind = next((k for x, y, k in spans if x <= a and b <= y), None)
                    if kind: allowed[kind] += 1; continue
                    what = "a flashcard names" if "flashcard" in gp else "authored prose names"
                    out.append(f"{rel} {path}: {what} {name!r} outside the allowed kinds: {t[max(0, a - 50): b + 30]!r}")
    for page, rows in sorted(listed.items()):
        for sentence, kind, n in rows:
            if not n: out.append(f"{page}: an allowed {kind} is gone from its page (take its row off {LEXICON_FILE.relative_to(ROOT)}, or restore the sentence): {sentence[:70]!r}")
    print(f"prose: {n_files} source records of {', '.join(PROSE_SECTIONS)}; {n_strings} authored strings read; allowed where the name is the thing itself: "
          f"{allowed['origin line']} in {len(lex.origin)} listed origin lines, {allowed['cited source']} in cited-source lines, {allowed['Systems guide']} in Systems guide titles")
    return n_strings


def check_cards(dir_, label, lex, out):
    """Every card the app is served (flashcards/*.json: the decks are built from graph.json, which a content change must
    refresh): no listed name in a question, an answer or an option."""
    fc = dir_ / "flashcards"
    files = sorted(p for p in fc.glob("*.json") if p.is_file()) if fc.is_dir() else []
    n_cards = 0
    for f in files:
        try: data = json.loads(f.read_text(encoding="utf-8"))
        except ValueError: continue
        if not isinstance(data, dict): continue
        for key, deck in data.items():
            for card in (deck.get("cards") if isinstance(deck, dict) else None) or []:
                if not isinstance(card, dict): continue
                n_cards += 1
                for path, s in _strings(card):
                    found, _ = lex.hits(s)
                    for a, b, name in found:
                        out.append(f"{f.relative_to(ROOT)}: a shipped card of the deck {key!r} names {name!r} at {path}: {_fold(s)[max(0, a - 40): b + 30]!r}")
    print(f"{label}: {n_cards} shipped cards read in {len(files)} files under {fc.relative_to(ROOT)}")
    return n_cards


def is_video(node):
    t = node.get("@type")
    return t == "VideoObject" or (isinstance(t, list) and "VideoObject" in t)


def check_pages(files, label, rx, lx, out, lex=None):
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
            h = lex.title_hit(text_of(m.group(2))) if lex else None
            if h: out.append(f"{rel}: credit line names the person {h!r} (the names lexicon): {text_of(m.group(2))[:90]!r}")
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


def check_payload(dir_, label, rx, lx, out, lex=None):
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
                    h = lex.title_hit(str(d.get("title") or "")) if lex else None
                    if h: out.append(f"{f.relative_to(ROOT)}: shipped clip {d['id']}'s title names the person {h!r} (the names lexicon)")
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


def check_export(pub, rx, lx, out, lex=None):
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
                h = lex.title_hit(text_of(line)) if lex else None
                if h: out.append(f"{f.relative_to(ROOT)}:{i}: an exported credit names the person {h!r} (the names lexicon)")
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
    print(f"label list: {n_labels} removed labels held, from {LABELS_FILE.relative_to(ROOT)} (floor {LABEL_FLOOR})")
    if 0 < n_labels < LABEL_FLOOR:
        out.append(f"the label list holds {n_labels} labels, below its floor of {LABEL_FLOOR}: a removed label was taken off the list (LABEL_FLOOR moves by hand, with the label's reason in the file's _meta.not_held)")
    lex = Lexicon()
    print(f"lexicon: {len(lex.full)} full names and {len(lex.tokens)} single tokens of real people, from {LEXICON_FILE.relative_to(ROOT)} (floor {LEXICON_FLOOR}); "
          f"masks: {len(lex.own)} technique and position names and aliases, {len(lex.systems)} Systems guide titles")
    out.extend(lex.problems)
    if 0 < lex.n < LEXICON_FLOOR:
        out.append(f"the names lexicon holds {lex.n} entries, below its floor of {LEXICON_FLOOR}: people were taken off it, and a short lexicon reads prose as clean (LEXICON_FLOOR moves by hand)")
    counts = {"names on the list": n_names, "labels on the list": n_labels, "entries in the names lexicon": lex.n}
    counts["authored strings (prose and cards in the source)"] = check_prose(lex, out)
    if a.built:
        pub = ROOT / "source/public"
        counts["clip credit lines"], counts["VideoObjects"] = check_pages(sorted(pub.rglob("*.html")), "built pages", rx, lx, out, lex)
        counts["shipped clips"] = check_payload(pub / "static/neural", "served payload", rx, lx, out, lex)
        counts["shipped cards"] = check_cards(pub / "static/neural", "served cards", lex, out)
        counts["exported credit lines"] = check_export(pub, rx, lx, out, lex)
    else:
        counts["clip credit lines"], counts["VideoObjects"] = check_pages(sorted((ROOT / "content").rglob("*.md")), "generated Markdown", rx, lx, out, lex)
        counts["shipped clips"] = check_payload(ROOT / "source/quartz/static/neural", "emitted payload", rx, lx, out, lex)
        counts["shipped cards"] = check_cards(ROOT / "source/quartz/static/neural", "emitted cards", lex, out)
    for name, n in counts.items():
        if n == 0 and name == "labels on the list":
            out.append(f"0 labels on the list: {LABELS_FILE.relative_to(ROOT)} is missing, unreadable or empty, so no removed label is held")
        elif n == 0: out.append(f"0 {name}: this gate saw nothing, so it proves nothing (wrong tree, or no build/emit)")
    if out:
        print(f"FAIL no-names: {len(out)} finding(s)")
        for line in out[:40]: print("  " + line)
        if len(out) > 40: print(f"  ... and {len(out) - 40} more")
        return 1
    print("OK no-names: no listed name or removed label in a credit or a shipped clip, no name in a video's JSON-LD; shipped clips carry player fields only; "
          "no listed person in authored prose, a card, a clip title or a credit outside the allowed kinds")
    return 0


if __name__ == "__main__":
    sys.exit(main())
