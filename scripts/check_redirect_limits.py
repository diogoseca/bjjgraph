#!/usr/bin/env python3
"""check_redirect_limits.py — the built `_redirects` fits Cloudflare's parser, rule for rule (v1.236.1, RDR546).

WHY. Only the first 100 of the built file's 1,954 rules worked, on production and on the dev preview,
from the day the file first carried a wildcard ahead of its static rules. Cloudflare's parser counts
a rule as STATIC only while no dynamic rule (a `*` or a `:placeholder` in the source) has been seen;
the first one flips `canCreateStaticRule` to false for good, every later rule counts as dynamic, and
past 100 dynamic rules it logs "Skipping remaining N lines of file" and stops. Rule #1 was
`/Training/*`, so rules #101-#1954 were never loaded. Measured 2026-10-28 on both hosts: #100 -> 301,
#101 -> 404, and #322, #500, #1000, #1954 -> 404. `check_redirect_targets.py` only proves that each
TARGET is built, so every gate stayed green while ~1,850 rules were dead (CLAUDE.md §6: absence
produced a plausible answer).

WHAT THIS IS. An exact Python port of Cloudflare's own code, pinned to workers-sdk commit
fc57bc0e03b096cff58e949e67ccfb9f7832a3c2 (main, 2026-10-28), which `wrangler pages deploy` runs:
  - packages/workers-shared/utils/configuration/parseRedirects.ts       -> parse_redirects()
  - packages/workers-shared/utils/configuration/constants.ts            -> the MAX_* and regex constants
  - packages/workers-shared/utils/configuration/validateURL.ts          -> validate_url(), extract_pathname()
  - packages/workers-shared/utils/configuration/constructConfiguration.ts (constructRedirects) -> construct()
  - packages/pages-shared/asset-server/handler.ts (staticRedirectsMatcher || generateRedirectsMatcher,
    and the Location it writes) + workers-shared/asset-worker/src/utils/rules-engine.ts
    (generateRuleRegExp, replacer)                                       -> Redirects.resolve()
The upstream parser's last change was aa26784ce (2026-03-18, formatting only); 7036310b2 (2026-02-09)
added inline comments. Re-pin by diffing those five files at a newer commit, never by trusting a number.

WHAT THE PORT REFUSES. `validateUrl` normalises a path through WHATWG `new URL()`. The port implements
that parser's steps for these inputs: the `?`/`#` split, the path, query and fragment percent-encode
sets of a non-special URL (UTF-8 for anything non-ASCII), dot-segment removal, and trailing C0
stripping. Two shapes it does not model, a path starting with `//` and a `^` (runtimes encode it
differently), make the gate FAIL naming the line instead of guessing. tests/redirect_limits_test.py
replays upstream's own parseRedirects.{valid,invalid}.test.ts vectors against it.

WHAT IT CHECKS, on the BUILT file (source/public/_redirects, the deploy root Cloudflare reads):
  - no line is invalid or skipped by the parser, and the file parses at least one rule;
  - every static-shaped rule precedes the first dynamic rule (`constructRedirects` would otherwise
    file it as dynamic and spend a dynamic slot on it — the defect itself);
  - every dynamic rule compiles (the matcher drops a rule whose regex throws, silently);
  - static <= 2000 and dynamic <= 100, and it prints both headrooms; under DYNAMIC_HEADROOM_FLOOR
    free dynamic slots it fails, so the next retirement wave cannot walk the file back to the edge.
It prints `static N/2000 · dynamic M/100 · skipped 0 · parsed T of T`.

AND THE FALLBACK TABLE (static/redirect-fallback.json, consulted by site/redirect-fallback.mjs after
the asset server answers 404). On the built tree it also checks that:
  - the table parses, through this same port, into wildcard redirects only, every one of them under
    a path the built `_routes.json` sends to the Pages middleware (a rule outside it never fires);
  - no built file sits under a fallback wildcard (the asset would now win where the rule used to);
  - EVERY rule source, every wildcard with sample children ("", Attacker, Defender, Top, Bottom,
    x/y) and every retired ordinal's URL ends at the same place through the two layers
    (`_redirects` -> assets -> fallback) as through the one unlimited list regenerate_redirects.py
    builds (Cloudflare's own first-match semantics, no limits). It prints how many it compared and
    fails on any difference and on zero.

--source checks the same against a fresh emit of regenerate_redirects.py into a temp dir, with the
pages and folders content/ would build standing in for the built tree (no build; ci-validate.yml
runs it). --probe BASE_URL requests, on a live deployment, the LAST static rule, the LAST dynamic
rule with a child path, one lowercase alias rule, the last exact category rule, and the last fallback
wildcards (plus any --probe-path), and asserts each answers 301/308 with the Location this port
computes, the fallback ones with `X-Redirect-Source: fallback` and the others without it; an unknown
category path must stay a plain 404. It counts its probes and fails on zero and on an empty URL.

Usage:
  python3 scripts/check_redirect_limits.py [--public DIR | --source]   # the full gate
  python3 scripts/check_redirect_limits.py --file PATH                  # one _redirects, parser only
  python3 scripts/check_redirect_limits.py --probe https://<deployment> [--public DIR] [--probe-path P=LOC]
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PUBLIC = PROJECT_ROOT / "source" / "public"
TAG = "[check_redirect_limits]"
UPSTREAM_COMMIT = "fc57bc0e03b096cff58e949e67ccfb9f7832a3c2"
FALLBACK_REL = "static/redirect-fallback.json"   # regenerate_redirects.FALLBACK_REL
REDIRECT_STATUSES = {301, 302, 303, 307, 308}
SAMPLE_CHILDREN = ("", "Attacker", "Defender", "Top", "Bottom", "x/y")

# constants.ts
PERMITTED_STATUS_CODES = {200, 301, 302, 303, 307, 308}
MAX_LINE_LENGTH = 2000
MAX_DYNAMIC_REDIRECT_RULES = 100
MAX_STATIC_REDIRECT_RULES = 2000
SPLAT_REGEX = re.compile(r"\*")
PLACEHOLDER_REGEX = re.compile(r":[A-Za-z][A-Za-z0-9_]*")  # JS \w without the u flag is ASCII

# Not upstream: this repo's own floor. A design that leaves fewer free dynamic slots than this is
# one retirement wave (each retired identity emitted 2-4 wildcard rules) away from the cliff.
DYNAMIC_HEADROOM_FLOOR = 20

# ECMAScript WhiteSpace + LineTerminator, which JS `\s` and String#trim use (Python's differ: no
# U+FEFF, and U+001C-U+001F count as space in Python only).
_JS_WS = ("\t\n\v\f\r             "
          "     　﻿")
_JS_WS_CLASS = "[" + re.escape(_JS_WS) + "]"
_INLINE_COMMENT = re.compile(_JS_WS_CLASS + "+#[^\n\r  ]*\\Z")  # /\s+#.*$/ (no m flag)
_TOKEN_SPLIT = re.compile(_JS_WS_CLASS + "+")
_URL_REGEX = re.compile(r"^https://+(?P<host>[^/]+)/?(?P<path>[^\n\r  ]*)")
_HOST_WITH_PORT_REGEX = re.compile(r".*:\d+\Z")
# WHATWG URL percent-encode sets for a NON-special URL ("relative:"), ASCII part. Every code point
# above U+007E is UTF-8 percent-encoded by all three (the C0 control percent-encode set).
_C0 = {chr(c) for c in range(0x20)}
_QUERY_SET = _C0 | set(' "#<>')
_PATH_SET = _QUERY_SET | set("?`{}")
_FRAGMENT_SET = _C0 | set(' "<>`')
# Runtimes disagree on "^" in a path (the URL Standard added it to the path set; older parsers do
# not encode it), so the port refuses it rather than pick one.
_UNSETTLED = set("^")


class UnportedURL(ValueError):
    """A URL the port cannot normalise exactly; the gate fails rather than guess."""


def js_trim(s: str) -> str:
    return s.strip(_JS_WS)


def js_number(s: str) -> float:
    """ECMAScript Number(string) for the shapes a status token can take."""
    t = js_trim(s)
    if t == "":
        return 0.0
    if re.fullmatch(r"0[xX][0-9a-fA-F]+", t):
        return float(int(t[2:], 16))
    if re.fullmatch(r"0[oO][0-7]+", t):
        return float(int(t[2:], 8))
    if re.fullmatch(r"0[bB][01]+", t):
        return float(int(t[2:], 2))
    if re.fullmatch(r"[+-]?Infinity", t):
        return -math.inf if t.startswith("-") else math.inf
    if re.fullmatch(r"[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?", t):
        return float(t)
    return math.nan


def _percent_encode(text: str, encode_set: set[str]) -> str:
    out = []
    for ch in text:
        if ch in encode_set or ord(ch) > 0x7E:
            out.append("".join(f"%{b:02X}" for b in ch.encode("utf-8")))
        else:
            out.append(ch)
    return "".join(out)


def _remove_dot_segments(path: str) -> str:
    """WHATWG path state for a non-special URL whose path starts with '/'."""
    out: list[str] = []
    segments = path[1:].split("/")
    for i, seg in enumerate(segments):
        last = i == len(segments) - 1
        low = seg.lower()
        if low in ("..", ".%2e", "%2e.", "%2e%2e"):
            if out:
                out.pop()
            if last:
                out.append("")
        elif low in (".", "%2e"):
            if last:
                out.append("")
        else:
            out.append(seg)
    return "/" + "/".join(out)


def extract_pathname(path: str = "/", include_search: bool = False, include_hash: bool = False) -> str:
    """validateURL.ts extractPathname: `new URL("//" + path, "relative://")`, then
    pathname (+ search, + hash). The input never starts with C0/space (it starts with "//"); the
    parser strips trailing C0 controls and spaces and every tab and newline before parsing."""
    if not path.startswith("/"):
        path = "/" + path
    path = ("//" + path).rstrip("".join(sorted(_C0)) + " ").replace("\t", "").replace("\n", "").replace("\r", "")[2:]
    if path.startswith("//"):
        # "////x" parses an empty host and then the path "//x"; nothing in this repo needs it.
        raise UnportedURL(f"{path!r} starts with '//'; not ported")
    hash_ = ""
    if "#" in path:
        path, frag = path.split("#", 1)
        hash_ = "#" + _percent_encode(frag, _FRAGMENT_SET) if frag else ""
    search = ""
    if "?" in path:
        path, query = path.split("?", 1)
        search = "?" + _percent_encode(query, _QUERY_SET) if query else ""
    if _UNSETTLED & set(path):
        raise UnportedURL(f"{path!r} has a '^', which runtimes encode differently; not ported")
    pathname = _remove_dot_segments(_percent_encode(path, _PATH_SET))
    return pathname + (search if include_search else "") + (hash_ if include_hash else "")


def url_has_host(token: str) -> bool:
    m = _URL_REGEX.match(token)
    return bool(m and m.group("host"))


def validate_url(token: str, only_relative=False, disallow_ports=False, include_search=False,
                 include_hash=False) -> tuple[str | None, str | None]:
    """validateURL.ts validateUrl -> (url, None) or (None, message)."""
    host = _URL_REGEX.match(token)
    if host and host.group("host"):
        if only_relative:
            return None, f"Only relative URLs are allowed. Skipping absolute URL {token}."
        if disallow_ports and _HOST_WITH_PORT_REGEX.match(host.group("host")):
            return None, f"Specifying ports is not supported. Skipping absolute URL {token}."
        return f"https://{host.group('host')}" + extract_pathname(host.group("path"), include_search, include_hash), None
    if not token.startswith("/") and only_relative:
        token = "/" + token
    if token.startswith("/"):
        try:
            return extract_pathname(token, include_search, include_hash), None
        except UnportedURL:
            raise
        except Exception:  # upstream: new URL() threw
            return None, f"Error parsing URL segment {token}. Skipping."
    return None, ("URLs should begin with a forward-slash." if only_relative else
                  'URLs should either be relative (e.g. begin with a forward-slash), or use HTTPS '
                  '(e.g. begin with "https://").')


@dataclass(frozen=True)
class Rule:
    source: str
    to: str
    status: int
    line_number: int


@dataclass
class Parsed:
    rules: list[Rule]
    invalid: list[dict]
    static: int          # parseRedirects' own counters, counted the way it counts them
    dynamic: int
    rule_lines: int      # non-blank, non-comment lines in the file
    skipped_lines: int   # lines never read because the dynamic cap stopped the parse
    unported: list[str]


def parse_redirects(text: str, max_static=MAX_STATIC_REDIRECT_RULES, max_dynamic=MAX_DYNAMIC_REDIRECT_RULES,
                    max_line_length=MAX_LINE_LENGTH, html_handling: str | None = None) -> Parsed:
    """parseRedirects.ts, statement for statement."""
    lines = text.split("\n")
    rules: list[Rule] = []
    seen_paths: set[str] = set()
    invalid: list[dict] = []
    unported: list[str] = []
    static_rules = dynamic_rules = 0
    can_create_static_rule = True
    skipped = 0
    rule_lines = sum(1 for raw in lines if (s := js_trim(raw)) and not s.startswith("#"))

    for i in range(len(lines)):
        line = js_trim(lines[i] or "")
        if len(line) == 0 or line.startswith("#"):
            continue
        if len(line.encode("utf-16-le")) // 2 > max_line_length:  # JS length counts UTF-16 units
            invalid.append({"message": f"Ignoring line {i + 1} as it exceeds the maximum allowed length of {max_line_length}."})
            continue
        tokens = _TOKEN_SPLIT.split(_INLINE_COMMENT.sub("", line, count=1))
        if len(tokens) < 2 or len(tokens) > 3:
            invalid.append({"line": line, "lineNumber": i + 1,
                            "message": f"Expected exactly 2 or 3 whitespace-separated tokens. Got {len(tokens)}."})
            continue
        str_from, str_to = tokens[0], tokens[1]
        str_status = tokens[2] if len(tokens) == 3 else "302"

        try:
            from_, err = validate_url(str_from, True, True, False, False)
        except UnportedURL as e:
            unported.append(f"line {i + 1}: {e}: {line}")
            continue
        if from_ is None:
            invalid.append({"line": line, "lineNumber": i + 1, "message": err})
            continue

        if can_create_static_rule and not SPLAT_REGEX.search(from_) and not PLACEHOLDER_REGEX.search(from_):
            static_rules += 1
            if static_rules > max_static:
                invalid.append({"message": f"Maximum number of static rules supported is {max_static}. Skipping line."})
                continue
        else:
            dynamic_rules += 1
            can_create_static_rule = False
            if dynamic_rules > max_dynamic:
                invalid.append({"message": f"Maximum number of dynamic rules supported is {max_dynamic}. "
                                           f"Skipping remaining {len(lines) - i} lines of file."})
                skipped = sum(1 for raw in lines[i:] if (s := js_trim(raw)) and not s.startswith("#"))
                break

        try:
            to, err = validate_url(str_to, False, False, True, True)
        except UnportedURL as e:
            unported.append(f"line {i + 1}: {e}: {line}")
            continue
        if to is None:
            invalid.append({"line": line, "lineNumber": i + 1, "message": err})
            continue

        status = js_number(str_status)
        if math.isnan(status) or status not in PERMITTED_STATUS_CODES:
            invalid.append({"line": line, "lineNumber": i + 1,
                            "message": f"Valid status codes are 200, 301, 302 (default), 303, 307, or 308. Got {str_status}."})
            continue
        status = int(status)

        has_relative_path = not url_has_host(to)
        index_re = re.compile(r"/index(.html)?\Z")  # unescaped "." upstream: any character
        has_wildcard_to_index = from_.endswith("/*") and bool(index_re.search(to))
        has_root_to_index = from_.endswith("/") and bool(index_re.search(to))
        has_html_handling = html_handling != "none"
        if has_relative_path and (has_wildcard_to_index or (has_root_to_index and has_html_handling)):
            invalid.append({"line": line, "lineNumber": i + 1,
                            "message": "Infinite loop detected in this rule and has been ignored. This will cause "
                                       "a redirect to strip `.html` or `/index` and end up triggering this rule "
                                       "again. Please fix or remove this rule to silence this warning."})
            continue

        if from_ in seen_paths:
            invalid.append({"line": line, "lineNumber": i + 1, "message": f"Ignoring duplicate rule for path {from_}."})
            continue
        seen_paths.add(from_)

        if status == 200 and url_has_host(to):
            invalid.append({"line": line, "lineNumber": i + 1,
                            "message": f"Proxy (200) redirects can only point to relative paths. Got {to}"})
            continue

        rules.append(Rule(from_, to, status, i + 1))

    return Parsed(rules, invalid, static_rules, dynamic_rules, rule_lines, skipped, unported)


_ESCAPE_REGEX_CHARACTERS = re.compile(r"[-/\\^$*+?.()|\[\]{}]")


def generate_rule_regexp(rule: str) -> re.Pattern:
    """rules-engine.ts generateRuleRegExp (path rules; `from` is relative-only, so no host placeholders)."""
    rule = "(?P<splat>.*)".join(_ESCAPE_REGEX_CHARACTERS.sub(lambda m: "\\" + m.group(0), part)
                                for part in rule.split("*"))
    for match in list(re.finditer(r":([A-Za-z][A-Za-z0-9_]*)", rule)):
        rule = rule.replace(match.group(0), f"(?P<{match.group(1)}>[^/]+)")
    return re.compile("^" + rule + r"\Z")  # throws on a duplicate group name, as JS does


@dataclass
class Redirects:
    """constructRedirects + the Pages asset-server matcher."""
    static: dict[str, Rule]
    dynamic: list[tuple[re.Pattern, Rule]]
    demoted: list[Rule]       # static-shaped rules filed as dynamic ("could be made more performant")
    uncompiled: list[Rule]    # dynamic rules whose regex throws: generateRulesMatcher drops them

    def resolve(self, pathname: str, search: str = "") -> tuple[int, str, Rule] | None:
        """(status, location, rule) for a same-origin request, or None (no rule matches)."""
        rule, groups = self.static.get(pathname), {}
        if rule is None:
            for regexp, candidate in self.dynamic:
                m = regexp.match(pathname)
                if m:
                    rule, groups = candidate, m.groupdict()
                    break
        if rule is None:
            return None
        to = rule.to
        for name, value in groups.items():  # replacer(): every ":name" occurrence, in group order
            to = to.replace(":" + name, value or "")
        if rule.status == 200 or url_has_host(to):
            return rule.status, to, rule
        # new URL(to, request.url): `to` is a relative path; same origin keeps the request's search.
        dest = extract_pathname(to, True, True)
        dest_path, _, dest_hash = dest.partition("#")
        dest_path, _, dest_search = dest_path.partition("?")
        location = dest_path + ("?" + dest_search if dest_search else search) + ("#" + dest_hash if dest_hash else "")
        return rule.status, location, rule


def construct(parsed: Parsed) -> Redirects:
    static: dict[str, Rule] = {}
    dynamic: list[tuple[re.Pattern, Rule]] = []
    demoted: list[Rule] = []
    uncompiled: list[Rule] = []
    can_create_static_rule = True
    for rule in parsed.rules:
        if not SPLAT_REGEX.search(rule.source) and not PLACEHOLDER_REGEX.search(rule.source):
            if can_create_static_rule:
                static[rule.source] = rule
                continue
            demoted.append(rule)
        try:
            dynamic.append((generate_rule_regexp(rule.source), rule))
        except re.error:
            uncompiled.append(rule)
        can_create_static_rule = False
    return Redirects(static, dynamic, demoted, uncompiled)


def audit(text: str, origin: str) -> tuple[list[str], Parsed, Redirects]:
    parsed = parse_redirects(text)
    redirects = construct(parsed)
    failures = [f"UNPORTED {u}" for u in parsed.unported]
    for entry in parsed.invalid:
        where = f"line {entry['lineNumber']}: " if "lineNumber" in entry else ""
        failures.append(f"INVALID {where}{entry['message']}" + (f" | {entry['line']}" if "line" in entry else ""))
    skipped = parsed.skipped_lines + sum(1 for e in parsed.invalid if "Skipping line" in e["message"])
    if skipped:
        failures.append(f"SKIPPED {skipped} rule line(s) Cloudflare would not load")
    for rule in redirects.demoted[:20]:
        failures.append(f"DEMOTED line {rule.line_number}: static rule {rule.source} follows a dynamic rule, "
                        f"so Cloudflare files it as dynamic; list every static rule first")
    if len(redirects.demoted) > 20:
        failures.append(f"DEMOTED ... and {len(redirects.demoted) - 20} more")
    for rule in redirects.uncompiled:
        failures.append(f"DEAD line {rule.line_number}: {rule.source} does not compile, so the matcher drops it")
    if not parsed.rules:
        failures.append(f"{origin} parsed 0 rules: nothing was checked")
    dynamic = len(redirects.dynamic) + len(redirects.uncompiled)
    if len(redirects.static) > MAX_STATIC_REDIRECT_RULES or dynamic > MAX_DYNAMIC_REDIRECT_RULES:
        failures.append(f"over a limit: static {len(redirects.static)}/{MAX_STATIC_REDIRECT_RULES}, "
                        f"dynamic {dynamic}/{MAX_DYNAMIC_REDIRECT_RULES}")
    elif MAX_DYNAMIC_REDIRECT_RULES - dynamic < DYNAMIC_HEADROOM_FLOOR:
        failures.append(f"dynamic headroom {MAX_DYNAMIC_REDIRECT_RULES - dynamic} is under the floor of "
                        f"{DYNAMIC_HEADROOM_FLOOR}: move wildcard retirements to static children or to the fallback")
    return failures, parsed, redirects


def summary(parsed: Parsed, redirects: Redirects) -> str:
    dynamic = len(redirects.dynamic) + len(redirects.uncompiled)
    skipped = parsed.skipped_lines + sum(1 for e in parsed.invalid if "Skipping line" in e["message"])
    return (f"static {len(redirects.static)}/{MAX_STATIC_REDIRECT_RULES} · dynamic {dynamic}/{MAX_DYNAMIC_REDIRECT_RULES} · "
            f"skipped {skipped} · parsed {len(parsed.rules)} of {parsed.rule_lines}")


def emit_from_source(directory: Path) -> Path:
    """regenerate_redirects.py into `directory`; never the checkout's own public tree."""
    code = ("import sys; from pathlib import Path; sys.path.insert(0, sys.argv[1]); "
            "import regenerate_redirects as r; r.PUBLIC_DIR = Path(sys.argv[2]); "
            "r.OUTPUT = r.PUBLIC_DIR / '_redirects'; r.main()")
    subprocess.run([sys.executable, "-B", "-c", code, str(PROJECT_ROOT / "scripts"), str(directory)],
                   check=True, cwd=PROJECT_ROOT, stdout=subprocess.DEVNULL)
    return directory / "_redirects"


# ---- the two layers: _redirects, then assets, then the middleware's fallback --------------------

def load_fallback(text: str) -> tuple[list[str], Parsed, Redirects]:
    """The fallback table, read through the same port: wildcard redirects only, in table order."""
    failures: list[str] = []
    try:
        data = json.loads(text)
    except ValueError as e:
        data = {}
        failures.append(f"FALLBACK the table is not JSON: {e}")
    rows = data.get("rules") if isinstance(data, dict) else None
    if not isinstance(data, dict) or data.get("version") != 1 or not isinstance(rows, list):
        failures.append("FALLBACK the table must be {\"version\": 1, \"rules\": [...]}")
        rows = []
    lines = []
    for n, row in enumerate(rows, 1):
        if not (isinstance(row, list) and len(row) == 3 and all(isinstance(v, str) for v in row[:2])
                and type(row[2]) is int):
            failures.append(f"FALLBACK row {n} is not [source, target, status]: {row!r}")
            continue
        lines.append(f"{row[0]} {row[1]} {row[2]}")
    parsed = parse_redirects("\n".join(lines), max_static=10**9, max_dynamic=10**9)
    redirects = construct(parsed)
    failures += [f"FALLBACK UNPORTED {u}" for u in parsed.unported]
    failures += [f"FALLBACK INVALID line {e.get('lineNumber', '?')}: {e['message']}" for e in parsed.invalid]
    failures += [f"FALLBACK row {r.line_number}: {r.source} is not a wildcard; exact rules belong in _redirects"
                 for r in redirects.static.values()]
    failures += [f"FALLBACK row {r.line_number}: {r.source} does not compile" for r in redirects.uncompiled]
    failures += [f"FALLBACK row {r.line_number}: status {r.status} is not a redirect" for _, r in redirects.dynamic
                 if r.status not in REDIRECT_STATUSES]
    return failures, parsed, redirects


class Assets:
    """Which request paths the Pages asset server answers with something other than 404."""

    def __init__(self, files: set[str], origin: str):
        self.files, self.origin = files, origin

    @classmethod
    def built(cls, public: Path) -> "Assets":
        files = {"/" + f.relative_to(public).as_posix() for f in public.rglob("*") if f.is_file()}
        return cls(files, f"{len(files)} built files under {public}")

    @classmethod
    def from_content(cls, root: Path = PROJECT_ROOT) -> "Assets":
        """What content/ builds: a flat X.html per page and an X/index.html per folder that holds
        a page. A folder with only a `.gitkeep` (Positions/Grasshopper Guard/ after its retirement)
        builds nothing, and modelling one would invent an asset that shadows its redirect."""
        sys.path.insert(0, str(root / "scripts"))
        from _slug import quartz_page_path
        content = root / "content"
        files = set()
        for md in content.rglob("*.md"):
            rel = md.relative_to(content).with_suffix("")
            files.add("/" + quartz_page_path(rel.as_posix()) + ".html")
            for folder in list(rel.parents)[:-1]:
                files.add("/" + quartz_page_path(folder.as_posix()) + "/index.html")
        return cls(files, f"{len(files)} pages and folders content/ builds")

    def answers(self, path: str) -> bool:
        """Pages' default html_handling: serve X, X.html or X/index.html, or 308 between them."""
        p = unquote(path)
        if p in self.files:
            return True
        if p.endswith("/"):
            return p + "index.html" in self.files or p[:-1] + ".html" in self.files
        return p + ".html" in self.files or p + "/index.html" in self.files

    def under(self, prefix: str) -> list[str]:
        return sorted(f for f in self.files if f.startswith(prefix))


def middleware_categories() -> tuple[str, ...]:
    sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
    import regenerate_agent_discovery
    return regenerate_agent_discovery.CATEGORIES


class Routes:
    """_routes.json: which paths invoke the Pages Functions (and so can reach the fallback)."""

    def __init__(self, include: list[str], exclude: list[str], origin: str):
        self.include, self.exclude, self.origin = include, exclude, origin
        self.categories = set(middleware_categories())

    @classmethod
    def built(cls, public: Path) -> "Routes":
        data = json.loads((public / "_routes.json").read_text())
        return cls(data["include"], data.get("exclude", []), str(public / "_routes.json"))

    @classmethod
    def from_source(cls) -> "Routes":
        # regenerate_agent_discovery.py's own derivation; the built mode reads its output instead.
        include = {"/", "/terms", "/privacy"}
        for category in middleware_categories():
            include.update({f"/{category}", f"/{category}/*"})
        return cls(sorted(include), [], "regenerate_agent_discovery.CATEGORIES")

    @staticmethod
    def _glob(pattern: str, path: str) -> bool:
        return re.fullmatch(".*".join(re.escape(part) for part in pattern.split("*")), path) is not None

    def reach_fallback(self, path: str) -> bool:
        """The request invokes the middleware AND the middleware consults the fallback for it."""
        routed = (any(self._glob(p, path) for p in self.include)
                  and not any(self._glob(p, path) for p in self.exclude))
        return routed and unquote(path).split("/")[1:2] != [] and unquote(path).split("/")[1] in self.categories


def _outcome(hit) -> tuple:
    if hit is None:
        return ("none",)
    status, location, _ = hit
    return ("rewrite", location) if status == 200 else ("redirect", status, location)


def unified_outcome(path: str, unified: Redirects, assets: Assets) -> tuple:
    hit = _outcome(unified.resolve(path))
    if hit != ("none",):
        return hit
    return ("asset",) if assets.answers(path) else ("404",)


def layered_outcome(path: str, edge: Redirects, fallback: Redirects, assets: Assets, routes: Routes) -> tuple:
    hit = _outcome(edge.resolve(path))
    if hit != ("none",):
        return hit
    if assets.answers(path):
        return ("asset",)
    if routes.reach_fallback(path):
        hit = _outcome(fallback.resolve(path))
        if hit != ("none",):
            return hit
    return ("404",)


def probe_paths(rules: list[Rule]) -> list[str]:
    paths = []
    for rule in rules:
        if "*" in rule.source or PLACEHOLDER_REGEX.search(rule.source):
            for child in SAMPLE_CHILDREN:
                paths.append(PLACEHOLDER_REGEX.sub("x", rule.source).replace("*", child, 1).replace("*", ""))
        else:
            paths += [rule.source, rule.source.rstrip("/") + "/"]
    return list(dict.fromkeys(paths))


def retired_ordinal_paths(root: Path = PROJECT_ROOT) -> list[str]:
    retired = json.loads((root / "node_ordinals.json").read_text())["retired"]
    return ["/" + node for node in sorted(retired)]


def unified_rules(root: Path = PROJECT_ROOT) -> list[str]:
    sys.path.insert(0, str(root / "scripts"))
    import regenerate_redirects
    authored, alias, case = regenerate_redirects.collect_rules()
    return authored + alias + case


def audit_layers(edge: Redirects, fallback_parsed: Parsed, fallback: Redirects, assets: Assets, routes: Routes,
                 unified_lines: list[str], retired: list[str] | None = None) -> tuple[list[str], dict]:
    failures: list[str] = []
    unified_parsed = parse_redirects("\n".join(unified_lines), max_static=10**9, max_dynamic=10**9)
    unified = construct(unified_parsed)
    failures += [f"UNIFIED INVALID {e['message']}" for e in unified_parsed.invalid]
    for _, rule in fallback.dynamic:
        prefix = rule.source.split("*")[0]
        sample = prefix + "Attacker"
        if not routes.reach_fallback(sample):
            failures.append(f"FALLBACK row {rule.line_number}: {rule.source} is outside {routes.origin}, "
                            f"so the middleware never sees {sample}")
        shadowed = assets.under(prefix)
        if shadowed:
            failures.append(f"FALLBACK row {rule.line_number}: {len(shadowed)} built file(s) under {prefix} "
                            f"(e.g. {shadowed[0]}) would now be served instead of redirected")
    paths = probe_paths(unified_parsed.rules)
    retired = retired_ordinal_paths() if retired is None else retired
    paths = list(dict.fromkeys(paths + retired))
    counts = {"compared": 0, "redirect": 0, "rewrite": 0, "asset": 0, "404": 0, "differ": 0,
              "retired": len(retired), "retired_redirect": 0}
    retired_set = set(retired)
    for path in paths:
        try:
            before = unified_outcome(path, unified, assets)
            after = layered_outcome(path, edge, fallback, assets, routes)
        except UnportedURL as e:
            failures.append(f"UNPORTED probe {path}: {e}")
            continue
        counts["compared"] += 1
        counts[before[0]] += 1
        if path in retired_set and after[0] == "redirect":
            counts["retired_redirect"] += 1
        if before != after:
            counts["differ"] += 1
            if counts["differ"] <= 20:
                failures.append(f"DIFFER {path}: one unlimited list gives {before}, the two layers give {after}")
    if counts["differ"] > 20:
        failures.append(f"DIFFER ... and {counts['differ'] - 20} more")
    if counts["compared"] == 0 or counts["redirect"] == 0:
        failures.append("the layer comparison compared nothing")
    missing = [p for p in retired if layered_outcome(p, edge, fallback, assets, routes)[0] != "redirect"]
    for path in missing[:20]:
        failures.append(f"RETIRED ordinal {path} does not redirect: a retired identity's URL must keep resolving")
    return failures, counts


# ---- the live probe ---------------------------------------------------------------------------

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # report the 3xx itself, never follow it
        return None


FALLBACK_HEADER = "X-Redirect-Source"   # site/redirect-fallback.mjs sets it to "fallback"
CATEGORY_PROBE_ROOTS = ("Positions", "Transitions", "Submissions")
# Must stay a plain 404: a fallback that redirected everything would pass every positive probe.
UNKNOWN_PROBE = "/Positions/No-Such-Page-rdr546-probe"


def choose_probes(edge: Redirects, fallback: Redirects) -> list[tuple[str, str, str]]:
    """(label, request path, layer): the LAST static rule, the LAST dynamic rule with a child, one
    alias rule, the last exact category rule (an edge redirect passing through the middleware), and
    the LAST fallback wildcard with a child plus the last one that keeps :splat. probe() adds an
    unknown category path that must stay a plain 404."""
    probes: list[tuple[str, str, str]] = []
    redirecting = [r for r in edge.static.values() if r.status in REDIRECT_STATUSES]
    if redirecting:
        last = max(redirecting, key=lambda r: r.line_number)
        probes.append((f"last static rule (line {last.line_number})", last.source, "edge"))
    wild = [r for _, r in edge.dynamic if r.status in REDIRECT_STATUSES and r.source.endswith("/*")]
    if wild:
        last = max(wild, key=lambda r: r.line_number)
        probes.append((f"last dynamic rule (line {last.line_number}) with a child", last.source[:-1] + "Attacker", "edge"))
    alias = next((r for r in sorted(redirecting, key=lambda r: -r.line_number)
                  if r.source == r.source.lower() and r.to != r.to.lower()
                  and r.source.rsplit("/", 1)[-1] != r.to.rsplit("/", 1)[-1].lower()), None)
    if alias:
        probes.append((f"alias rule (line {alias.line_number})", alias.source, "edge"))
    category = [r for r in redirecting if r.source != r.source.lower() and r.source.split("/")[1:2]
                and r.source.split("/")[1] in CATEGORY_PROBE_ROOTS]
    if category:
        last = max(category, key=lambda r: r.line_number)
        probes.append((f"exact category rule (line {last.line_number}) through the middleware", last.source, "edge"))
    rows = [r for _, r in fallback.dynamic if r.source.endswith("/*")]
    if rows:
        probes.append((f"last fallback rule (row {rows[-1].line_number}) with a child", rows[-1].source[:-1] + "Attacker",
                       "fallback"))
        splat = [r for r in rows if ":splat" in r.to]
        if splat and splat[-1] is not rows[-1]:
            probes.append((f"last fallback :splat rule (row {splat[-1].line_number})", splat[-1].source[:-1] + "Defender",
                           "fallback"))
    return probes


def probe(base_url: str, edge: Redirects, fallback: Redirects, extra: list[str], attempts: int, wait: float) -> int:
    opener = urllib.request.build_opener(_NoRedirect)
    expected: list[tuple[str, str, str, str]] = []
    for label, path, layer in choose_probes(edge, fallback):
        hit = (edge if layer == "edge" else fallback).resolve(path)
        if hit is None or hit[0] not in (301, 308):
            print(f"{TAG} FAIL the port does not resolve its own probe {path} to a 301/308", file=sys.stderr)
            return 1
        expected.append((label, path, hit[1], layer))
    for item in extra:
        path, _, location = item.partition("=")
        if not path.startswith("/") or not location.startswith("/"):
            print(f"{TAG} FAIL --probe-path wants /path=/location, got {item!r}", file=sys.stderr)
            return 1
        expected.append(("extra path", path, location, "any"))
    if not expected:
        print(f"{TAG} FAIL 0 probes chosen: nothing would be requested", file=sys.stderr)
        return 1
    if edge.resolve(UNKNOWN_PROBE) is None and fallback.resolve(UNKNOWN_PROBE) is None:
        expected.append(("unknown category path", UNKNOWN_PROBE, "404", "none"))

    def request(url: str) -> tuple[int, str, str]:
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": "bjjgraph-redirect-probe"})
        try:
            with opener.open(req, timeout=20) as resp:
                return resp.status, resp.headers.get("Location") or "", resp.headers.get(FALLBACK_HEADER) or ""
        except urllib.error.HTTPError as e:
            return e.code, e.headers.get("Location") or "", e.headers.get(FALLBACK_HEADER) or ""
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            return 0, str(e), ""

    def verdict(result: tuple[int, str, str], location: str, layer: str) -> bool:
        status, got, source = result
        if layer == "none":
            return status == 404 and not got and not source
        if status not in (301, 308) or re.sub(r"^https?://[^/]+", "", got) != location:
            return False
        return layer == "any" or (source == "fallback") == (layer == "fallback")

    failures, passed = [], 0
    for label, path, location, layer in expected:
        url = base_url.rstrip("/") + path
        for attempt in range(attempts):
            result = request(url)
            if verdict(result, location, layer) or attempt + 1 == attempts:
                break
            time.sleep(wait)
        ok = verdict(result, location, layer)
        passed += ok
        print(f"{TAG} {'ok  ' if ok else 'FAIL'} {label}: {path} -> {result[0]} {result[1] or '-'}"
              f"{' [' + FALLBACK_HEADER + ': ' + result[2] + ']' if result[2] else ''} "
              f"(expected {'a plain 404' if layer == 'none' else f'301/308 {location} from the {layer} layer'})")
        if not ok:
            failures.append(path)
    print(f"{TAG} live probe: {passed} of {len(expected)} probes answered as the parser port predicts on {base_url}")
    if failures or passed == 0:
        print(f"{TAG} FAIL {len(failures)} of {len(expected)} probe(s) did not redirect as expected", file=sys.stderr)
        return 1
    return 0


def main_probe_url(url: str) -> int | None:
    """1 (and why) when --probe was given something that is not a deployment URL, else None.

    An empty value is the failure that matters: `${{ steps.cf.outputs.deployment-url }}` renders as
    "" when the step id or the output name changes, and a probe that requested nothing must not
    read as a probe that passed."""
    if re.match(r"^https?://[^/\s]+", url or ""):
        return None
    print(f"{TAG} FAIL --probe needs the deployment URL (http(s)://host); got {url!r}, so nothing would be requested",
          file=sys.stderr)
    return 1


def run(args) -> int:
    if args.probe is not None and main_probe_url(args.probe):
        return 1
    failures: list[str] = []
    with tempfile.TemporaryDirectory(prefix="redirect-limits-") as tmp:
        if args.source:
            public = emit_from_source(Path(tmp)).parent
            origin = "regenerate_redirects.py's emit"
        elif args.file:
            public, origin = None, str(args.file)
        else:
            public = args.public or DEFAULT_PUBLIC
            origin = str(public / "_redirects")
        path = args.file or public / "_redirects"
        if not path.is_file():
            print(f"{TAG} FAIL {path} is missing: nothing was checked", file=sys.stderr)
            return 1
        edge_failures, parsed, edge = audit(path.read_text(encoding="utf-8"), origin)
        failures += edge_failures
        print(f"{TAG} {summary(parsed, edge)} · headroom static "
              f"{MAX_STATIC_REDIRECT_RULES - len(edge.static)}, dynamic "
              f"{MAX_DYNAMIC_REDIRECT_RULES - len(edge.dynamic) - len(edge.uncompiled)} "
              f"(workers-sdk {UPSTREAM_COMMIT[:9]}) — {origin}")
        fallback = None
        if public is not None:
            table = public / FALLBACK_REL
            if not table.is_file():
                failures.append(f"FALLBACK {table} is missing: the middleware would redirect nothing")
            else:
                fallback_failures, fallback_parsed, fallback = load_fallback(table.read_text(encoding="utf-8"))
                failures += fallback_failures
                if args.source:
                    assets, routes = Assets.from_content(), Routes.from_source()
                else:
                    assets = Assets.built(public)
                    routes = Routes.built(public) if (public / "_routes.json").is_file() else None
                    if routes is None:
                        failures.append(f"{public / '_routes.json'} is missing: run this after "
                                        f"regenerate_agent_discovery.py, which writes it")
                if routes is not None:
                    layer_failures, counts = audit_layers(edge, fallback_parsed, fallback, assets, routes,
                                                          unified_rules())
                    failures += layer_failures
                    print(f"{TAG} fallback {len(fallback.dynamic)} wildcard rule(s) · "
                          f"{counts['compared']} paths compared against the one unlimited list "
                          f"({counts['redirect']} redirect, {counts['rewrite']} rewrite, {counts['asset']} asset, "
                          f"{counts['404']} 404) · {counts['differ']} differ · retired ordinals "
                          f"{counts['retired_redirect']} of {counts['retired']} redirect — {assets.origin}")
    if failures:
        for f in failures:
            print(f"{TAG} FAIL {f}", file=sys.stderr)
        print(f"{TAG} {len(failures)} failure(s)", file=sys.stderr)
        return 1
    if args.probe is not None:
        if fallback is None:
            print(f"{TAG} FAIL --probe needs the built tree's fallback table", file=sys.stderr)
            return 1
        return probe(args.probe, edge, fallback, args.probe_path, max(1, args.attempts), args.wait)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    where = ap.add_mutually_exclusive_group()
    where.add_argument("--public", type=Path, help="built site root (default source/public)")
    where.add_argument("--file", type=Path, help="one _redirects file: the parser checks only")
    where.add_argument("--source", action="store_true", help="emit regenerate_redirects.py into a temp dir and check that")
    ap.add_argument("--probe", metavar="BASE_URL", help="then request the probes on this live deployment")
    ap.add_argument("--probe-path", action="append", default=[], metavar="/PATH=/LOCATION")
    ap.add_argument("--attempts", type=int, default=6, help="tries per probe (a fresh deployment can lag)")
    ap.add_argument("--wait", type=float, default=10.0, help="seconds between tries")
    return run(ap.parse_args())


if __name__ == "__main__":
    sys.exit(main())
