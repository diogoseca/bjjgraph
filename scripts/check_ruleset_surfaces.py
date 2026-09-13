#!/usr/bin/env python3
"""check_ruleset_surfaces.py — every node enumeration in the app either obeys the ruleset or is
named, with a reason, in a committed allow-list.

WHY THIS EXISTS. v1.153.0 added the per-ruleset exclusion mask (`giAllows` -> `_rulesetMask` ->
`rsAllows`) and applied it at the surfaces its author could enumerate BY HAND. A later four-lens
sweep of the same file found 38 more that a player could reach — the escape tray you pick from while
caught, the drill queue built from a shared class, a URL arrival straight onto a gi-only technique's
page, the whole FLOW weak-spots engine in a sibling file. The list was not wrong; it was
HAND-MAINTAINED, and CLAUDE.md §6.7 says a hand-maintained enumeration has a new member missing by
default. That is the same defect that left `.ng-seemore` dead to the mouse for its entire existence,
and the same one `attachInput`'s early-return list still carries.

So the list is DERIVED here instead, and a new enumeration fails CI until somebody decides about it.

WHAT COUNTS AS A SITE. Anything that turns an index or an id into a node, or walks a node
collection: `for (… of this.nodes)`, `this.nodes.filter/map/some/find/forEach`, `for (… of
this.adj[…])`, `_idIndex.get(…)`, and — in the sibling bundle files — the bare `nodes[i]` /
`app.nodes` forms, which a `this.nodes` matcher cannot see. Strings, template literals, regexes and
comments are blanked before matching, so a mention of `rsAllows` in prose never counts as a guard.

WHAT COUNTS AS OBEYING. A mask token (`rsAllows(`, `rsAllowsIdx(`, `rsOk[`, `_rulesetMask(`) inside
the site's OWN BLOCK — brace-matched for a `for` loop, statement-scoped for an expression. Function
scope would be too coarse: `draw()` has six enumerations and a seventh unfiltered one would inherit
a green from its neighbours.

DECLARED BLIND SPOTS — this gate is a ratchet, not a proof, and these are the shapes it provably
cannot see (each was found by hand in the sweep that motivated it):
  · a node array aliased across a module boundary and then indexed with no `nodes` token in scope;
  · a closure that stores `nodeAt = (i) => nodes[i]` and is dereferenced in another function;
  · a producer/consumer split — `this.optionIdxs = opts.map(o => o.idx)` written 1,500 lines from
    the pass that draws it, where neither line can be classified locally;
  · an index Set with no node token at all (`_dangerSet`, `_focusIdxSet`);
  · deck-key space: a surface that deals material keyed by deck key never touches a node index.
Those are why `tests/ruleset_availability.test.mjs` drives the real app and asserts on what the
surfaces EMITTED. This script is the cheap half; that suite is the half that can actually see a user.

Usage:  python3 scripts/check_ruleset_surfaces.py [--list] [--json]
Exit:   0 = every site classified · 1 = an unclassified site, a rotted allow-list entry, or a
        coverage floor breach (a matcher that matched nothing prints what a clean run prints).
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "tests/artifacts/ruleset_surfaces.json"
TARGETS = ["neural/src/app.src.jsx", "neural/src/flow.src.js"]

MASK_TOKENS = ("rsAllows(", "rsAllowsIdx(", "rsOk[", "_rulesetMask(", "rsOk(")

# Each pattern names a way a node becomes reachable. `kind` is only for the report.
SITE_PATTERNS = [
    ("nodes-of",   re.compile(r"for\s*\(\s*(?:const|let|var)\s+[\w{}\[\],\s]+\s+of\s+(?:this|app)\.nodes\b")),
    ("nodes-call", re.compile(r"(?:this|app)\.nodes\.(?:filter|map|some|find|findIndex|forEach|reduce)\s*\(")),
    ("adj-of",     re.compile(r"for\s*\(\s*(?:const|let|var)\s+[\w{}\[\],\s]+\s+of\s+(?:this|app)\.adj\[")),
    ("adj-call",   re.compile(r"(?:this|app)\.adj\[[^\]]+\]\.(?:filter|map|some|find|forEach|reduce)\s*\(")),
    ("idindex",    re.compile(r"(?:this|app)\._idIndex\s*(?:\?\s*)?\.?\s*get\s*\(")),
    ("bare-nodes", re.compile(r"(?<![\w.])nodes\[[^\]]+\]")),          # sibling files: `const nodes = app.nodes`
    ("alias",      re.compile(r"(?:const|let|var)\s+\w+\s*=\s*app\.nodes\b")),
]

_TOKEN = re.compile(r"""(//[^\n]*)|(/\*.*?\*/)|('(?:\\.|[^'\\])*')|("(?:\\.|[^"\\])*")|(`(?:\\.|[^`\\])*`)""", re.S)


def blank_noncode(src: str) -> str:
    """Replace comment/string/template bodies with spaces, preserving length and newlines.

    Index-preserving on purpose: every offset computed on the blanked text addresses the same
    character in the original, so line numbers and slices stay honest. Without this a `rsAllows`
    written in a COMMENT would count as a guard — which is precisely the kind of check that reports
    clean because it matched the documentation instead of the code.
    """
    out = list(src)
    for m in _TOKEN.finditer(src):
        for i in range(m.start(), m.end()):
            if out[i] != "\n":
                out[i] = " "
    return "".join(out)


def enclosing_fn(blank: str, pos: int) -> str:
    """Nearest preceding method/function header at 2-4 space indent, else '<top>'."""
    head = blank[:pos]
    best, best_at = "<top>", -1
    # KEYWORDS ARE NOT METHODS. `for (...) {` at method indent matches the same shape as a method
    # header, and without this every loop reported its enclosing function as "for" — which would
    # have made every allow-list key collide and the ledger meaningless.
    kw = {"for", "if", "while", "switch", "catch", "return", "function", "do", "else", "try", "with"}
    for m in re.finditer(r"\n {2,4}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)\n]*\)\s*\{", head):
        if m.group(1) not in kw:
            best, best_at = m.group(1), m.start()
    for m in re.finditer(r"\n(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(", head):
        if m.start() > best_at:
            best, best_at = m.group(1), m.start()
    return best


def scope_of(blank: str, start: int, kind: str) -> tuple:
    """(scope_start, scope_end) — the block a guard would have to live in to cover this site."""
    n = len(blank)
    if kind in ("nodes-of", "adj-of"):
        b = blank.find("{", start)
        if b == -1 or b - start > 400:
            return (start, min(n, start + 400))
        depth, i = 0, b
        while i < n:
            if blank[i] == "{":
                depth += 1
            elif blank[i] == "}":
                depth -= 1
                if depth == 0:
                    return (b, i + 1)
            i += 1
        return (b, n)
    if kind in ("idindex", "bare-nodes", "alias"):
        # THE ENCLOSING BLOCK, not the statement. These forms resolve an id or an index on one line
        # and decide about the node on the NEXT — `const i = _idIndex.get(id); if (i != null &&
        # this.rsAllows(this.nodes[i])) …` is the idiom in this file. Statement scope reported every
        # one of those as unguarded, which would have driven the ledger to exempt code that is
        # already correct: an allow-list full of false positives is worse than no allow-list, because
        # the real entries stop being read.
        depth, i = 0, start
        while i > 0:
            c = blank[i]
            if c == "}":
                depth += 1
            elif c == "{":
                if depth == 0:
                    break
                depth -= 1
            i -= 1
        b = i
        depth, j = 0, b
        while j < n:
            if blank[j] == "{":
                depth += 1
            elif blank[j] == "}":
                depth -= 1
                if depth == 0:
                    return (b, j + 1)
            j += 1
        return (b, n)
    # expression: to the end of the statement, following paren depth out of the call
    depth, i = 0, start
    while i < n:
        c = blank[i]
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
            if depth < 0:
                break
        elif c == ";" and depth == 0:
            i += 1
            break
        elif c == "\n" and depth == 0 and i > start:
            break
        i += 1
    return (start, min(n, max(i + 1, start + 40)))


def key_of(rel: str, fn: str, snippet: str) -> str:
    """Stable across line drift: file + enclosing function + the normalised expression."""
    norm = re.sub(r"\s+", " ", snippet).strip()
    return rel + "::" + fn + "::" + norm


def scan():
    sites = []
    for rel in TARGETS:
        p = ROOT / rel
        src = p.read_text(encoding="utf-8")
        blank = blank_noncode(src)
        for kind, pat in SITE_PATTERNS:
            for m in pat.finditer(blank):
                s, e = scope_of(blank, m.start(), kind)
                guarded = any(t in blank[s:e] for t in MASK_TOKENS)
                fn = enclosing_fn(blank, m.start())
                snippet = src[m.start():m.end()]
                sites.append({
                    "file": rel,
                    "line": src[:m.start()].count("\n") + 1,
                    "fn": fn,
                    "kind": kind,
                    "snippet": snippet,
                    "guarded": guarded,
                    "key": key_of(rel, fn, snippet),
                })
    # one row per key: the same expression twice in a function is one decision
    seen, uniq = set(), []
    for s in sorted(sites, key=lambda x: (x["file"], x["line"])):
        if s["key"] in seen:
            continue
        seen.add(s["key"])
        uniq.append(s)
    return uniq


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--list", action="store_true", help="print every site and its verdict")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    sites = scan()
    ledger = json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else {"exempt": {}}
    exempt = ledger.get("exempt", {})

    guarded = [s for s in sites if s["guarded"]]
    unguarded = [s for s in sites if not s["guarded"]]
    allowed = [s for s in unguarded if s["key"] in exempt]
    unclassified = [s for s in unguarded if s["key"] not in exempt]
    rotted = sorted(set(exempt) - {s["key"] for s in sites})

    if a.json:
        print(json.dumps({"sites": sites, "unclassified": unclassified, "rotted": rotted}, indent=1))
        return 0

    print("[check_ruleset_surfaces] node enumerations in the app bundle")
    print(f"  files scanned           : {len(TARGETS)} -> {', '.join(TARGETS)}")
    print(f"  enumeration sites found : {len(sites)}")
    print(f"  consulting the mask     : {len(guarded)}")
    print(f"  allow-listed with reason: {len(allowed)}")
    print(f"  UNCLASSIFIED            : {len(unclassified)}")
    if a.list:
        for s in sites:
            tag = "guarded " if s["guarded"] else ("exempt  " if s["key"] in exempt else "UNCLASSED")
            print(f"    {tag} {s['file'].split('/')[-1]}:{s['line']:<6} {s['fn']:<28} {s['snippet'][:56]}")
    for s in unclassified:
        print(f"    !! {s['file']}:{s['line']} in {s['fn']}(): {s['snippet'][:70]}")
    for k in rotted:
        print(f"    !! allow-list entry matches NOTHING: {k[:120]}")

    fail = []
    # A matcher that matched nothing prints what a clean run prints (CLAUDE.md §6.6). These floors
    # are counts, not opinions — measured at v1.167.0: 48 sites, 26 guarded, 22 exempt. Re-derive
    # with --list before changing one, and never lower one to make a run go green.
    if len(sites) < 40:
        fail.append(f"only {len(sites)} enumeration sites found across {len(TARGETS)} files — the "
                    f"patterns stopped matching, which looks exactly like a clean app")
    if len(guarded) < 18:
        fail.append(f"only {len(guarded)} sites consult the mask — the ruleset filter has been "
                    f"removed or renamed, and every remaining site would then read as 'exempt'")
    if unclassified:
        fail.append(f"{len(unclassified)} node enumeration(s) neither consult the ruleset mask nor "
                    f"appear in {LEDGER.relative_to(ROOT)}. Either filter with rsAllows/rsAllowsIdx, "
                    f"or add the key with a REASON a reader can act on.")
    if rotted:
        fail.append(f"{len(rotted)} allow-list entr(ies) match no site. A stale exemption is an "
                    f"un-reviewed decision that survives the code it was about — delete them.")
    if fail:
        print("\n[check_ruleset_surfaces] FAILED:", file=sys.stderr)
        for f in fail:
            print(f"  - {f}", file=sys.stderr)
        return 1
    print("\n[check_ruleset_surfaces] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
