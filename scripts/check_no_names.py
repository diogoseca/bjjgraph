#!/usr/bin/env python3
"""No person's or gym's name in our own text: the clip gate (v1.288.0; widened in v1.289.0) and the prose check (v1.291.0).

The owner's rule, 17 Nov 2026 (U195 a, "no names in any title", and U196 b, "take the taught-by line out everywhere";
the option he picked reads "no person's or gym's name in our own text at all"): a clip names its technique, never who
teaches it, nor the gym or channel it comes from. The source JSON keeps `by` and `channel` as provenance for our own
tools; nothing we render or emit about a clip carries them. The YouTube player shows the channel when a video opens;
that is YouTube's text, not ours, and is not checked here.

THE PROSE CHECK (v1.291.0). The owner's rule U203 a (17 Nov 2026): "Keep a name only where the name is the thing
itself", and U206 a: an origin line says who the technique is named after, and nobody else. Real people's names left
our own written text (172 mentions in 140 fields of 66 records), and this check keeps them out: no entry of THE NAMES
LEXICON in any string of a source record, in a flashcard, in a clip title or in a credit line, outside the kinds
ALLOWED_KINDS names with their reasons. It reads the SOURCE JSON for prose and cards (the pages are tied to it by CI's
"Generated content matches its generator"), and the emitted or built payload for the cards the app is served, because
those are built from graph.json: a content change that does not refresh graph.json ships the old cards, and neither
regenerate:md nor the payload emit rewrites it (v1.291.0's own first payload still carried every name in the cards).
The independent read of PR #437 made it exact (same version): a listed person's surname alone, every field of a record,
an allowed sentence by record, field and text, and a lexicon of people only.

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
  THE NAMES LEXICON is tests/artifacts/no_names_lexicon.json: real people our text has named, and PEOPLE ONLY (an entry
    that does not parse as a person's name is red: a gym, a team, a channel, a phrase). `full_names` and `phrases` (a
    person said through a technique's own word: "the Estima brothers") match whole words, case-insensitive;
    `single_tokens` (a surname, a first name or a nickname our text used alone) and THE DERIVED SURNAMES match whole
    words with their capital letters, so the ordinary word "hall" is never the surname "Hall". The derived surnames are
    the last word of every full name, computed here and never listed: "Wardzinski shows this" is refused because Adam
    Wardzinski is listed. A derived surname is NOT held when it is a word of one of the graph's own names or aliases
    (12 on 2026-11-17: Aoki, Darce, Estima, Flue, Kimura, Long, Mir, Orchard, Peterson, Riva, Suloev, Williams), a word
    the file lists under `technique_words` (D'Arce), or an ordinary word the file NAMES under `ordinary_surnames`, each
    with its reason (Brown, Hall, Hill, Shields; capped by ORDINARY_CAP). The gate prints the three sets every run.
    Matched in every read string of the source, in cards, clip titles and credit lines. Its floor is EXACT
    (LEXICON_FLOOR: the entries that parse as a person's name). It may never hold a word a technique or position is
    named by: the check refuses a token that is a word of one of the graph's own names or aliases, or that the file
    lists under `technique_words` (Kimura, Estima, the London, Marcelotine).
    The file also lists THE ALLOWED PLACES (`origin_lines`, `citations`, `guide_titles`): each row is one record, one
    field and one exact sentence, with the names the lexicon finds in it.

Two modes, each reading what a reader or a player is actually served:
  (default, no build: ci-validate)  the committed generated Markdown under content/, and the emitted neural payload,
                                    ALL of source/quartz/static/neural/** (ci-validate emits it).
  --built                           the built site under source/public/: every page's HTML, ALL of
                                    static/neural/**, the agent export (markdown/**) and llms.txt.
It never reads the source JSON's clip TITLES: a name back in a source title shows here only once the page is
regenerated (CI's "Generated content matches its generator" is what refuses the unregenerated page). Both modes read
every other string of the source JSON (prose, cards, the graph's own fields), and the cards under
static/neural/flashcards.

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
             in EVERY string of every record under content/ outside Systems, but a clip's own fields by key
             (CLIP_FIELD) and a Learning page's references: no lexicon name outside ALLOWED_KINDS. So a new section, a
             new field, a new key on a clip, a `references` list on a technique and free text in a field that mostly
             holds wiring (a decision tree's `technique`: 375 of 2,284 on 2026-11-17; an escape's label; a tag) are
             all read. A LISTED PLACE (an origin line, the citation, a sentence holding a guide's title) is one record,
             one field and one exact sentence, allowed ONCE there, up to ALLOWED_CAPS: a second person added to one,
             the same sentence in another record or another field of its own record (a card's answer included) or
             twice in its field, a place listed past the cap, and a listed sentence gone from its field are each red;
             so is a row whose names the lexicon does not find in its sentence. A cited source is a link to an http(s)
             address, never in a flashcard. A Systems guide's title (one of the exact `name` values of
             content/Systems/*.json, standing whole, case ignored) is allowed as a whole value or in a listed sentence,
             and nowhere else;
    cards:   in every card under static/neural/flashcards (a question, an answer, an option): no lexicon name, and no
             allowed kind applies to a card;
    titles:  in a credit line, a shipped clip's title and (--built) an exported credit line: no lexicon name (a derived
             surname included; a guide's title gives no allowance), so a person by surname ("… - Faria Sweep") is
             refused where the name list (whole values only) passes it;
    lexicon: EXACTLY LEXICON_FLOOR entries that parse as a person's name (one fewer, or one more without the floor, is
             red); an entry that is not a person by shape is red; unreadable or missing is red; a technique's own word
             on it is red; an ordinary-word surname past ORDINARY_CAP, or one that is no listed person's surname, is
             red; strings read, surnames held and shipped cards read are each POSITIVE.
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
             for titles and credits at once, and on the lexicon only when someone adds them). FIRST names are held only
             where someone listed one as a single token. Single tokens and surnames need their capitals. A full name
             split by markup or a line break, glued, hyphenated or written with other accents passes. An entry with a
             person's SHAPE that is nobody's name passes the shape check: what ties the list to our text is the listed
             places (every entry made up is red there; one made-up entry among real ones is not).
    prose:   read from the source only: a name written into a GENERATED page alone passes here (ci-validate's
             "Generated content matches its generator" is what refuses that page; the prose probe records it as a
             non-kill); the payload's dossier prose and the page's FAQ JSON-LD are emitted from that same source and
             are not read again; graph.json itself is read only through the cards built from it. A hub page repeats
             its records' descriptions, so an allowed origin line shows there too (the Positions hub prints Dead
             Orchard Control's).
    cited:   ANY link to an http(s) address allows the names inside it: nothing checks that the address is a source,
             or that the link stands in a sources line (nine sentences on Demi Guard and eight of its transitions carry
             a first name as such a link's text, in running prose).
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
  UNGUARDED: A LISTED PERSON'S SURNAME THAT IS NOT HELD, used alone: the four ordinary words the file names ("Hall shows
    the entry", "Shields does it": the prose probe keeps that mutant green on purpose) and the thirteen that are a
    technique's own word ("Aoki shows…", "Mir finished…": the word is the technique's, so a person meant by it passes);
    A PERSON NOBODY LISTED ("Lo's pass"); a person's name used as a technique's nickname that is no graph name and on
    no list (seven clip titles: "Imanari Roll", "Schultz choke", "McGuire Cradle", "Neil Knot", "Jackie Chan"); gyms,
    schools and channels in prose ("10th Planet", a channel named as a source): U203 is about people; whatever stands
    inside an allowed kind (any name in a cited link, in a Systems guide, in a Learning reference); a JSON-LD block
    with no VideoObject (an Article, a FAQ, a `creator` there); a bare name in llms.txt.
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
# Its FLOOR, EXACT: the entries that PARSE AS A PERSON'S NAME (parses_as_name below). Measured 2026-11-17: 191 full names
# + 41 single tokens = 232. One person off the list is red; one added is red until this line moves with it. BY HAND,
# with the date. Recompute: python3 scripts/check_no_names.py | grep '^lexicon'
LEXICON_FLOOR = 232
# A word that marks a gym, a team or a channel: a `full_names` entry holding one is not a person (the read of PR #437
# found eight such entries: three of a gym, a team, two channels and two phrases).
NOT_A_PERSON = {"barra", "squad", "nation", "team", "academy", "gym", "club", "bjj", "jiu", "jitsu", "mma", "grappling",
                "brothers", "sisters", "family", "the", "of", "and"}
NAME_WORD = re.compile(r"^(?:[A-Z\u00c0-\u00de][A-Za-z\u00c0-\u00ff'.\-]*|'[A-Z][A-Za-z\u00c0-\u00ff]*')$")
# The DERIVED SURNAMES that are deliberately not held because the word is an ordinary one (`ordinary_surnames` in the
# lexicon file, each with its reason). A CAP: a surname moves there by hand, with this line and the date (2026-11-17).
ORDINARY_CAP = 4
# THE LISTED PLACES where a name may stand: each row of the lexicon file is one record, one field and one exact sentence,
# allowed ONCE there. A CAP for each list, today's count (2026-11-17): a new row is a ruling, and its cap moves with it.
ALLOWED_CAPS = {"origin line": 29, "citation": 1, "guide title": 2}
ALLOWED_ROWS = {"origin line": "origin_lines", "citation": "citations", "guide title": "guide_titles"}
# WHERE A PERSON'S NAME MAY STAND IN OUR OWN TEXT (the owner's rule U203 a, 17 Nov 2026: "keep a name only where the
# name is the thing itself"), each kind with its reason. Everything else in authored prose and cards is a finding.
ALLOWED_KINDS = {
    "origin line": "U206 a: a sentence of a technique's own record that says who THAT technique is named after, and "
                   "nobody else. A record may hold more than one (its summary and its overview; its overview again as "
                   "its attacker's). Listed by record, field and exact sentence in the lexicon file (`origin_lines`), "
                   "allowed once in that field, up to ALLOWED_CAPS",
    "cited source": "a cited video or course keeps its author: a name inside a Markdown link whose target is an http(s) "
                    "address, in any read field that is not a flashcard; and the one in-text citation of a Learning "
                    "page's own listed reference (`citations` in the lexicon file, by record, field and sentence)",
    "Systems guide": "a Systems guide keeps the course and its author: content/Systems/ is not read; a value that IS a "
                     "guide's exact title (a link to the guide) is its name; and a guide's title standing inside a "
                     "sentence is allowed where that sentence is listed (`guide_titles`, by record, field and sentence)",
    "Learning reference": "`references[]` of a Learning page is its bibliography: not read",
    "technique word": "a technique or position named after a person keeps its name: the lexicon may not hold a word of "
                      "one of the graph's own names or aliases, nor a word listed in `technique_words`, and a derived "
                      "surname that is one is not held",
}
# The one section the prose check does NOT read (ALLOWED_KINDS: Systems guide). Every other record under content/ is
# read, so a new section is read by default (today: Learning, Positions, Principles, Submissions, Transitions). A
# directory whose name starts with a dot is an editor's own (content/.obsidian, untracked), never a section.
NOT_READ_SECTIONS = ("Systems",)
# WHAT IS NOT READ, and nothing else is skipped: a clip's own fields BY KEY (a title has its own checks on the page and in
# the payload; `by` and `channel` are provenance; an id, a date, a half), so a NEW key on a clip is read; and a Learning
# page's `references[]` (ALLOWED_KINDS). Every other string of a record is read, the graph's own names and wiring too:
# no lexicon entry can match inside one (the lexicon may not hold a word of a graph name), and a value that is free text
# in a field that mostly holds wiring (375 of the 2,284 `decision_tree[].actions[].technique` values on 2026-11-17: they
# render on the page and ship in the dossier) is read like any sentence.
CLIP_FIELD = re.compile(r"(^|\.)clips\[\]\.(id|title|by|channel|verified|half)$")
TREE_TECHNIQUE = re.compile(r"decision_tree\[\]\.actions\[\]\.technique$")
ROLES = ("Top", "Bottom", "Attacker", "Defender")
CITED_LINK = re.compile(r"\[[^\]]*\]\(https?://[^)\s]+\)")     # a cited source: a link to a real address
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


def parses_as_name(entry, full):
    """A person's name BY SHAPE: two to five words for a full name, one for a token; every word capitalised (or a
    quoted nickname), letters only, and none a word that marks a gym, a team or a channel (NOT_A_PERSON). It cannot tell
    a person from a made-up name of the same shape: what ties the list to our text is that every listed place must hold
    the names its row lists (check_prose)."""
    words = entry.split()
    if not ((2 <= len(words) <= 5) if full else len(words) == 1): return False
    return all(NAME_WORD.match(w) and w.strip("'").lower() not in NOT_A_PERSON for w in words)


class Lexicon:
    """tests/artifacts/no_names_lexicon.json, loaded and checked against itself and the graph. `problems` are findings."""

    def __init__(self):
        self.problems = []
        try: raw = json.loads(LEXICON_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError): raw = None
        if not isinstance(raw, dict):
            self.problems.append(f"{LEXICON_FILE.relative_to(ROOT)} is missing or unreadable, so no person's name is held in prose, cards, titles or credits")
            raw = {}
        norm = lambda x: " ".join(_fold(x).split())
        clean = lambda xs: sorted({norm(x) for x in (xs if isinstance(xs, list) else []) if isinstance(x, str) and x.strip()})
        named = lambda k: {norm(a): b for a, b in raw[k].items() if isinstance(a, str) and a.strip()} if isinstance(raw.get(k), dict) else {}
        self.full, self.tokens = clean(raw.get("full_names")), clean(raw.get("single_tokens"))
        self.phrases, self.words, self.ordinary = named("phrases"), named("technique_words"), named("ordinary_surnames")
        # PEOPLE ONLY: an entry that does not parse as a person's name is a finding, and the floor counts those that do.
        for key, entries, full in (("full_names", self.full, True), ("single_tokens", self.tokens, False)):
            for n in entries:
                if not parses_as_name(n, full): self.problems.append(f"the lexicon's `{key}` holds {n!r}, which does not parse as a person's name (a gym, a team, a channel or a phrase is not a person; a phrase that names a person through a technique's own word goes to `phrases`, with its reason)")
        seen = {}
        for n in self.full:
            if n.lower() in seen: self.problems.append(f"the lexicon lists {n!r} and {seen[n.lower()]!r}: one person twice (full names match with case ignored)")
            seen.setdefault(n.lower(), n)
        people = [n for n in self.full if parses_as_name(n, True)]
        self.n = len(people) + sum(parses_as_name(n, False) for n in self.tokens)
        self.own, self.systems = graph_names()
        # A technique's own word may not be on the lexicon (ALLOWED_KINDS: technique word): it would refuse the technique.
        name_words = {}
        for n in self.own:
            for w in re.findall(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-]*", _fold(n)): name_words.setdefault(w.lower(), n)
        listed = {k.lower() for k in self.words}
        for t in self.tokens:
            if t.lower() in listed: self.problems.append(f"the lexicon lists the technique word {t!r} as a person's name (it is in `technique_words`: {self.words.get(t) or 'a technique word'})")
            elif t.lower() in name_words: self.problems.append(f"the lexicon token {t!r} is a word of the technique or position name {name_words[t.lower()]!r}: a name the graph uses is never a person's name here")
        for n in self.full:
            if n.lower() in {x.lower() for x in self.own}: self.problems.append(f"the lexicon lists {n!r}, which is a technique's or position's own name")
        # THE DERIVED SURNAMES: the last word of every full name, held alone like a single token ("Wardzinski shows
        # this"), EXCEPT a word of a graph name, a technique word, and the ordinary words the file names with a reason.
        surnames = {}
        for n in people: surnames.setdefault(n.split()[-1].strip("'"), n)
        self.surnames = surnames
        self.derived, self.unheld = [], {"a word of a graph name": [], "a technique's own word": [], "an ordinary word": []}
        for w in sorted(surnames):
            if w.lower() in name_words: self.unheld["a word of a graph name"].append(w)
            elif w.lower() in listed: self.unheld["a technique's own word"].append(w)
            elif w in self.ordinary: self.unheld["an ordinary word"].append(w)
            else: self.derived.append(w)
        for w, why in self.ordinary.items():
            if w not in surnames: self.problems.append(f"`ordinary_surnames` lists {w!r}, which is no listed person's surname: take it off")
            elif not (isinstance(why, str) and why.strip()): self.problems.append(f"`ordinary_surnames` lists {w!r} with no reason")
        if len(self.ordinary) > ORDINARY_CAP:
            self.problems.append(f"`ordinary_surnames` holds {len(self.ordinary)} surnames, above its cap of {ORDINARY_CAP}: a listed person's surname was moved to the ordinary words, where it is no longer held (ORDINARY_CAP moves by hand, with the reason)")
        held = sorted(set(self.tokens) | set(self.derived))
        spoken = self.full + sorted(self.phrases)
        self.full_rx = re.compile(r"(?<![\w])(" + _alternation(spoken) + r")(?![\w])", re.I) if spoken else None
        self.tok_rx = re.compile(r"(?<![\w])(" + _alternation(held) + r")(?![\w])") if held else None
        # A cheap NECESSARY condition, so the two alternations run on the few strings that can match: the longest run of
        # letters of each entry must stand in the text as a run of letters of its own (case folded).
        self.keys = {max(_LETTERS.findall(n.lower()), key=len) for n in spoken + held if _LETTERS.search(n.lower())}
        # A Systems guide's title: one of the exact `name` values of content/Systems/*.json, standing whole (case ignored).
        self.sys_rx = re.compile(r"(?<![\w])(" + _alternation(self.systems) + r")(?![\w])", re.I) if self.systems else None
        # WIRING: a value that IS one of the graph's own names (with or without its role), the terminal, or a guide's title.
        self.wiring = {"game-over", "game over"} | {norm(n).lower() for n in self.systems}
        for n in self.own:
            k = norm(n).lower(); self.wiring.add(k)
            for r in ROLES: self.wiring.update((f"{k} {r.lower()}", f"{k}/{r.lower()}"))
        # THE LISTED PLACES: (record, field) -> rows. One row is one exact sentence, allowed once in that field.
        self.rows, self.n_rows = {}, {}
        for kind, key in ALLOWED_ROWS.items():
            src = raw.get(key) if isinstance(raw.get(key), list) else []
            ok = [r for r in src if isinstance(r, dict) and all(isinstance(r.get(k), str) and r[k].strip() for k in ("page", "field", "sentence"))
                  and isinstance(r.get("names"), list) and r["names"] and all(isinstance(x, str) for x in r["names"])]
            if len(ok) != len(src): self.problems.append(f"`{key}` holds {len(src) - len(ok)} row(s) without a page, a field, a sentence and the list of names: every allowed place is one record, one field and one exact sentence")
            self.n_rows[kind] = len(ok)
            if len(ok) > ALLOWED_CAPS[kind]:
                self.problems.append(f"`{key}` lists {len(ok)} places, above its cap of {ALLOWED_CAPS[kind]}: a new allowed {kind} is a ruling (ALLOWED_CAPS moves by hand, with it)")
            for r in ok:
                rows = self.rows.setdefault((r["page"], r["field"]), [])
                if any(x["sentence"] == _fold(r["sentence"]) for x in rows): self.problems.append(f"`{key}` lists one place twice: {r['page']} {r['field']}")
                rows.append({"kind": kind, "sentence": _fold(r["sentence"]), "names": sorted({norm(x).lower() for x in r["names"]}), "found": 0})

    def hits(self, s):
        """Every listed name in `s` (plain text, entities already decoded), as (start, end, name); a full name hides its
        own parts; a hit inside a Systems guide's title is the second list (allowed only where check_prose says so)."""
        t = s.replace("’", "'"); taken, out, in_title = [], [], []
        if self.keys.isdisjoint(_LETTERS.findall(t.lower())): return out, in_title
        titles = None
        for rx in (self.full_rx, self.tok_rx):
            if not rx: continue
            for m in rx.finditer(t):
                a, b = m.start(1), m.end(1)
                if any(x <= a < y for x, y in taken): continue
                taken.append((a, b))
                if titles is None: titles = [(x.start(1), x.end(1)) for x in self.sys_rx.finditer(t)] if self.sys_rx else []
                (in_title if any(x <= a and b <= y for x, y in titles) else out).append((a, b, m.group(1)))
        return sorted(out), sorted(in_title)

    def title_hit(self, s):
        """The first listed name in a clip title or a credit line (HTML already stripped), or None. A guide's title gives
        no allowance here: a clip's title names its technique."""
        out, in_title = self.hits(" ".join(_fold(s).split()))
        both = sorted(out + in_title)
        return both[0][2] if both else None


def _strings(x, path=""):
    if isinstance(x, dict):
        for k, v in x.items(): yield from _strings(v, f"{path}.{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x): yield from _strings(v, f"{path}[{i}]")
    elif isinstance(x, str): yield path, x


def check_prose(lex, out):
    """Every string of the SOURCE JSON but a clip's own fields and a Learning page's references: no listed name outside
    ALLOWED_KINDS. A listed place is one record, one field and one exact sentence, once. Returns the strings read."""
    n_files = n_strings = n_wiring = 0
    skipped = {"clip": 0, "reference": 0}
    tree = {True: 0, False: 0}                         # decision_tree[].actions[].technique: a graph name? -> count
    allowed = {"origin line": 0, "citation": 0, "guide title": 0, "cited link": 0, "exact title": 0}
    sections = set()
    for f in sorted((ROOT / "content").rglob("*.json")):
        section = f.relative_to(ROOT / "content").parts[0]
        if section in NOT_READ_SECTIONS or section.startswith("."): continue
        try: d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError: continue
        n_files += 1; sections.add(section)
        rel = f.relative_to(ROOT).as_posix()
        for path, s in _strings(d):
            gp = re.sub(r"\[\d+\]", "[]", path)
            if CLIP_FIELD.search(gp): skipped["clip"] += 1; continue
            if section == "Learning" and gp.startswith(".references[]"): skipped["reference"] += 1; continue
            n_strings += 1
            t = _fold(s)
            value = " ".join(t.split())
            wired = value.lower() in lex.wiring
            n_wiring += wired
            if TREE_TECHNIQUE.search(gp): tree[wired] += 1
            spans = []                             # (start, end, row): the listed sentences of THIS field
            for r in lex.rows.get((rel, path), ()):
                i = t.find(r["sentence"])
                if i >= 0: spans.append((i, i + len(r["sentence"]), r)); r["found"] += t.count(r["sentence"])
            found, in_title = lex.hits(t)
            if not (found or in_title or spans): continue
            card = "flashcard" in gp
            links = [(m.start(), m.end()) for m in CITED_LINK.finditer(t)] if found and not card else []
            inside = {}                            # id(row) -> the names the lexicon finds in its sentence
            for a, b, name, titled in sorted([(a, b, n, False) for a, b, n in found] + [(a, b, n, True) for a, b, n in in_title]):
                row = next((r for x, y, r in spans if x <= a and b <= y), None)
                if row and titled == (row["kind"] == "guide title"):
                    allowed[row["kind"]] += 1; inside.setdefault(id(row), set()).add(" ".join(name.split()).lower()); continue
                if titled and value in lex.systems: allowed["exact title"] += 1; continue
                if not titled and any(x <= a and b <= y for x, y in links): allowed["cited link"] += 1; continue
                what = "a flashcard names" if card else "authored prose names"
                where = "inside a Systems guide's title, in a sentence that is not listed (`guide_titles`)" if titled else "outside the allowed kinds"
                out.append(f"{rel} {path}: {what} {name!r} {where}: {t[max(0, a - 50): b + 30]!r}")
            for x, y, r in spans:
                got = sorted(inside.get(id(r), ()))
                if got != r["names"]:
                    out.append(f"{rel} {path}: the allowed {r['kind']} holds {got} by the lexicon and its row lists {r['names']}: the row and the lexicon disagree (a name the lexicon lost, or one the row does not list): {r['sentence'][:60]!r}")
    for (page, field), rows in sorted(lex.rows.items()):
        for r in rows:
            if not r["found"]: out.append(f"{page} {field}: an allowed {r['kind']} is gone from its field (take its row off {LEXICON_FILE.relative_to(ROOT)}, or restore the sentence): {r['sentence'][:70]!r}")
    print(f"prose: {n_files} source records of {', '.join(sorted(sections))} (every section but {', '.join(NOT_READ_SECTIONS)}); {n_strings} strings read, {n_wiring} of them one of the graph's own names or a guide's title; "
          f"decision trees: {tree[True]} `technique` values are a graph name and {tree[False]} are free text, all read; "
          f"not read: {skipped['clip']} clip fields (by key) and {skipped['reference']} strings of Learning references")
    print(f"allowed where the name is the thing itself: {allowed['origin line']} in {lex.n_rows.get('origin line', 0)} listed origin places, "
          f"{allowed['cited link']} inside cited links (an http(s) target, never a flashcard), {allowed['citation']} in {lex.n_rows.get('citation', 0)} listed citation, "
          f"{allowed['guide title']} in {lex.n_rows.get('guide title', 0)} listed sentences that hold a Systems guide's title, {allowed['exact title']} in values that are a guide's exact title")
    return n_strings


def check_cards(dir_, label, lex, out):
    """Every card the app is served (flashcards/*.json: the decks are built from graph.json, which a content change must
    refresh): no listed name in a question, an answer or an option. No allowed kind applies to a card."""
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
                    found, in_title = lex.hits(s)
                    for a, b, name in sorted(found + in_title):
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
    print(f"lexicon: {lex.n} entries that parse as a person's name ({len(lex.full)} full names, {len(lex.tokens)} single tokens; floor {LEXICON_FLOOR}, exact) and {len(lex.phrases)} phrases, "
          f"from {LEXICON_FILE.relative_to(ROOT)}; it may hold no word of the graph's {len(lex.own)} own names and aliases; {len(lex.systems)} Systems guide titles")
    n_not = sum(len(v) for v in lex.unheld.values())
    print(f"surnames: {len(lex.surnames)} derived from the full names, {len(lex.derived)} held alone ({len(set(lex.derived) - set(lex.tokens))} beyond the single tokens); {n_not} NOT held: "
          + "; ".join(f"{len(v)} {k} ({', '.join(v)})" for k, v in lex.unheld.items() if v))
    out.extend(lex.problems)
    if 0 < lex.n < LEXICON_FLOOR:
        out.append(f"the names lexicon holds {lex.n} entries that parse as a person's name, below its floor of {LEXICON_FLOOR}: a person was taken off it, and a short lexicon reads prose as clean (LEXICON_FLOOR moves by hand)")
    elif lex.n > LEXICON_FLOOR:
        out.append(f"the names lexicon holds {lex.n} entries that parse as a person's name, above its floor of {LEXICON_FLOOR}: raise LEXICON_FLOOR to {lex.n} in the same change, with the date (the floor is exact, so that it has no slack to lose people into)")
    counts = {"names on the list": n_names, "labels on the list": n_labels, "entries in the names lexicon": lex.n}
    counts["strings of the source (prose, cards and the graph's own fields)"] = check_prose(lex, out)
    counts["surnames held alone"] = len(lex.derived)
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
