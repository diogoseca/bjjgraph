#!/usr/bin/env python3
"""CLAUDE.md budget gate — a ratchet on the file that is loaded into EVERY session.

Why this exists (v1.130.0, the canon/changelog split): CLAUDE.md reached 349,512 chars —
roughly 87k tokens spent before a single word of work, against a 150k-char limit. It grew
that way because every shipped change was written into it as a full post-mortem: owner
quote, symptom, root cause, measurement tables, mutation kill tables, gate snapshot, byte
deltas. None of that is wrong to write down; it was only ever wrong to write it HERE, in
the one document every session pays for.

Splitting it once is easy; keeping it split is the hard part, and the growth rate is the
argument: +52,643 chars in 2 days across 12 commits, and a further +12,161 in the 28 hours
while the split itself was being planned. That is one target-sized CLAUDE.md every few
days. Without a ratchet the trim is undone inside a fortnight and the next reader
reasonably concludes the split failed.

WHERE IT RUNS:
  - `npm run validate:claudemd`        — the direct entry point.
  - .github/workflows/ci-validate.yml  — step "CLAUDE.md budget (gate)".
NB the ci-validate `paths:` filter MUST list CLAUDE.md and docs/**. It did not when this
gate was written, which would have made it dead on arrival for exactly the pull request
that breaks it — a gate wired to a path filter that excludes its own subject is not a gate.

What it measures, and why it is not only a size check:

  1. SIZE. CLAUDE.md against the ceiling in tests/artifacts/budget_docs.json. A ceiling is
     a MAX, so shrinking always passes; --update RAISES it and belongs in its own justified
     commit.

  2. NO `@`-PREFIXED IMPORTS. Claude Code auto-loads `@path` imports recursively, so one
     such line silently re-attaches everything this split moved out and the budget becomes
     a lie while still reading green.

  3. THE TRAP CATALOGUE IS STILL THERE, AND IS STILL BIG. Section 6 is the whole point of
     the file; a rewrite that quietly drops it would otherwise sail through on size alone —
     the budget would in fact look BETTER.

  4. THE SCOPED HALF OF THE CANON (v1.224.3). §5 and most of §6 moved into path-scoped files
     under .claude/rules/, which Claude Code loads only when a session reads or writes a path
     their `paths:` globs match. Every way that split can quietly come undone is a check here:
       - each file has its own ceiling, and a ceiling naming a file that is GONE fails: deleting
         a rules file deletes its traps, and the root shrinking would read as a win;
       - each file must carry `paths:` globs: without them Claude Code loads it in EVERY
         session, so it is root weight the root's ceiling cannot see (the @-import problem in
         (2) in a new coat);
       - each glob must match at least one tracked file: a rule that matches nothing never
         loads, and reads exactly like a rule nobody needed;
       - each file must be named in CLAUDE.md: Grep and Glob do not trigger a load (measured on
         Claude Code 2.1.293), so the root's §6 index is how a reader who has not opened a
         file in that folder finds the traps at all;
       - no @-imports there either, and the catalogue floor in (3) counts the trap entries
         under `### 6.N` headings in these files together with the root's.

On (3), and on why every check prints a positive count: this repo's single largest failure
class is "absence produces a plausible answer" — a check that never ran reads as a pass. It
has 17 recorded instances in 5 vocabularies (a NameError swallowed by a bare except that
reported 0 disagreements; a harness rule naming a URL the app never fetches; two build
rewrites whose `from` strings were absent; a join that shipped fabricated odds on ~289 of
1,204 option cards). The fix the repo independently reinvented five separate times is the
same one: emit a positive coverage count and fail on zero. So this gate never reports "no
problems found" — it reports how many traps, how many sections and how many bytes it
actually saw, and it fails when a count is zero.

Deliberately stdlib-only, and takes no arguments beyond --update.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "CLAUDE.md"
BUDGET = ROOT / "tests" / "artifacts" / "budget_docs.json"
RULES_DIR = ROOT / ".claude" / "rules"
RULES_PREFIX = ".claude/rules/"

# The companion documents the split created. They are budgeted loosely: they are read on
# demand, so their cost is paid only when relevant. They are listed at all so that "shrink
# CLAUDE.md" cannot be satisfied by moving weight into a file nobody is watching.
COMPANIONS = ("docs/Neural.md", "docs/Changelog-Archive.md")

# A trap entry opens with its trigger in backticks or bold caps, under a "### N." group
# heading inside the catalogue. Counting the group headings is the stable signal; counting
# entries is the useful one.
TRAP_SECTION_RE = re.compile(r"^##\s+\d*\.?\s*THOUGHT TRAPS", re.M | re.I)
TRAP_ENTRY_RE = re.compile(r"^-\s+\*\*", re.M)
TRAP_FLOOR = 20
AT_IMPORT_RE = re.compile(r"^\s*@[A-Za-z0-9_./-]+\s*$")
FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)


def rule_files() -> list[Path]:
    return sorted(RULES_DIR.glob("*.md")) if RULES_DIR.is_dir() else []


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def measure() -> dict:
    text = DOC.read_text(encoding="utf-8")
    out = {"CLAUDE.md": len(text)}
    for rel_ in COMPANIONS:
        p = ROOT / rel_
        out[rel_] = len(p.read_text(encoding="utf-8")) if p.exists() else 0
    for p in rule_files():
        out[rel(p)] = len(p.read_text(encoding="utf-8"))
    return out


def rule_globs(text: str) -> list[str] | None:
    """The `paths:` globs of a rules file's YAML frontmatter, or None when it has no
    frontmatter at all. Reads the two shapes YAML gives a list of strings (a block list, one
    `- "glob"` per line, or a flow list `["a", "b"]`) and nothing cleverer: stdlib only."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    globs: list[str] = []
    lines = m.group(1).splitlines()
    for i, ln in enumerate(lines):
        head = re.match(r"^paths:\s*(.*)$", ln)
        if not head:
            continue
        if head.group(1).startswith("["):
            globs += [g.strip().strip("'\"") for g in head.group(1).strip("[] ").split(",")
                      if g.strip()]
        for nxt in lines[i + 1:]:
            item = re.match(r"^\s+-\s+(.+?)\s*$", nxt)
            if not item:
                break
            globs.append(item.group(1).strip("'\""))
    return globs


def glob_re(glob: str) -> re.Pattern:
    """A `paths:` glob as Claude Code reads it: `**/` is zero or more directories, `**` any
    run of characters, `*` and `?` stop at a slash."""
    out, i = "", 0
    while i < len(glob):
        if glob.startswith("**/", i):
            out, i = out + "(?:.*/)?", i + 3
        elif glob.startswith("**", i):
            out, i = out + ".*", i + 2
        elif glob[i] == "*":
            out, i = out + "[^/]*", i + 1
        elif glob[i] == "?":
            out, i = out + "[^/]", i + 1
        else:
            out, i = out + re.escape(glob[i]), i + 1
    return re.compile(out + r"\Z")


def tracked_files() -> list[str]:
    """The tracked tree, which is what CI checks out. No git, or an empty answer, is a hard
    failure: every glob would then match nothing, and the honest reading of that is 'cannot
    tell', not 'every rule is dead'."""
    try:
        out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True,
                             check=True, timeout=60).stdout
    except (OSError, subprocess.SubprocessError) as e:
        sys.exit(f"[check_claudemd_budget] FAILED: cannot list the tracked tree with git ({e}); "
                 "the `paths:` globs of .claude/rules/ cannot be checked without it")
    files = [f for f in out.decode("utf-8", "surrogateescape").split("\0") if f]
    if not files:
        sys.exit("[check_claudemd_budget] FAILED: git listed ZERO tracked files, so no "
                 "`paths:` glob can match; this is indistinguishable from a broken matcher")
    return files


def count_rule_traps(text: str) -> int:
    """Trap entries under a `### 6.N` heading, up to the next `## ` heading."""
    n, inside = 0, False
    for ln in text.splitlines():
        if ln.startswith("## "):
            inside = False
        elif re.match(r"^###\s+6\.\d", ln):
            inside = True
        elif inside and TRAP_ENTRY_RE.match(ln):
            n += 1
    return n


def rules_checks(root_text: str) -> tuple[list[str], list[dict]]:
    """Section (4) of the docstring. Returns (errors, one report row per rules file)."""
    errors: list[str] = []
    rows: list[dict] = []
    files = rule_files()
    tracked = tracked_files() if files else []
    for p in files:
        name, text = rel(p), p.read_text(encoding="utf-8")
        row = {"file": name, "globs": 0, "matched": 0, "traps": count_rule_traps(text)}
        globs = rule_globs(text)
        if not globs:
            errors.append(
                f"{name} has no `paths:` globs in its frontmatter, so Claude Code loads it in "
                "EVERY session: it is root weight the CLAUDE.md ceiling cannot see. Scope it, "
                "or move its text into CLAUDE.md where the budget counts it.")
        for g in globs or []:
            hits = sum(1 for f in tracked if glob_re(g).match(f))
            row["globs"] += 1
            row["matched"] += hits
            if hits == 0:
                errors.append(
                    f"{name}: `paths:` glob {g!r} matches no tracked file, so this rule never "
                    "loads for it, which reads exactly like a rule nobody needed.")
        imports = [ln.strip() for ln in text.splitlines() if AT_IMPORT_RE.match(ln)]
        if imports:
            errors.append(f"{name} contains @-prefixed import line(s): {', '.join(imports[:5])} "
                          "— they auto-load recursively, so the scoping above stops meaning "
                          "anything.")
        if name not in root_text:
            errors.append(
                f"{name} is not named in CLAUDE.md. Grep and Glob do not load a rules file, "
                "so the root's §6 index is the only way a reader who has not opened a file in "
                "its folder finds it; add it there.")
        rows.append(row)
    return errors, rows


def structural_checks(text: str) -> tuple[list[str], dict]:
    """Returns (errors, counts). Counts are printed on success — see the docstring."""
    errors: list[str] = []
    counts: dict = {}

    # (2) auto-loading imports
    imports = [
        ln for ln in text.splitlines()
        if re.match(r"^\s*@[A-Za-z0-9_./-]+\s*$", ln)
    ]
    counts["at_imports"] = len(imports)
    if imports:
        errors.append(
            "CLAUDE.md contains @-prefixed import line(s): "
            + ", ".join(i.strip() for i in imports[:5])
            + " — these auto-load recursively, which silently re-attaches everything the "
              "canon/changelog split moved out and makes this budget meaningless."
        )

    # (3) the catalogue
    counts["trap_sections"] = len(TRAP_SECTION_RE.findall(text))
    if counts["trap_sections"] == 0:
        errors.append(
            "no THOUGHT TRAPS section found — that catalogue is the reason this file is "
            "loaded every session; a rewrite that drops it would otherwise pass on size."
        )
        counts["trap_entries"] = 0
    else:
        seg = text[TRAP_SECTION_RE.search(text).start():]
        nxt = re.search(r"^## (?!.*THOUGHT TRAPS)", seg[3:], re.M)
        if nxt:
            seg = seg[: nxt.start() + 3]
        counts["trap_entries"] = len(TRAP_ENTRY_RE.findall(seg))
        counts["trap_chars"] = len(seg)

    counts["sections"] = len(re.findall(r"^## ", text, re.M))
    if counts["sections"] == 0:
        errors.append("CLAUDE.md has no '## ' sections at all — the file is not structured")
    return errors, counts


def fmt(n: int) -> str:
    return f"{n:,}"


def main() -> None:
    ap = argparse.ArgumentParser(description="CLAUDE.md budget ratchet")
    ap.add_argument("--update", action="store_true",
                    help="RAISE the ceilings to the current sizes (own commit, please)")
    args = ap.parse_args()

    if not DOC.exists():
        print(f"ERROR: {DOC} does not exist", file=sys.stderr)
        sys.exit(1)

    sizes = measure()
    text = DOC.read_text(encoding="utf-8")

    if args.update:
        BUDGET.parent.mkdir(parents=True, exist_ok=True)
        prev = json.loads(BUDGET.read_text()) if BUDGET.exists() else {}
        ceilings = dict(prev.get("ceilings", {}))
        for k, v in sizes.items():
            ceilings[k] = max(ceilings.get(k, 0), v)
        BUDGET.write_text(json.dumps(
            {"_comment": "Char ceilings for the always-loaded canon and its companions. "
                         "A ceiling is a MAX: shrinking always passes. Raising one needs "
                         "--update in its own justified commit. See "
                         "scripts/check_claudemd_budget.py.",
             "ceilings": ceilings}, indent=1, sort_keys=True) + "\n")
        print(f"[check_claudemd_budget] wrote {BUDGET.relative_to(ROOT)}")
        for k in sorted(ceilings):
            print(f"    {k:<32} {fmt(ceilings[k])}")
        return

    if not BUDGET.exists():
        print(f"ERROR: no budget at {BUDGET}; run with --update first", file=sys.stderr)
        sys.exit(1)

    ceilings = json.loads(BUDGET.read_text())["ceilings"]
    errors, counts = structural_checks(text)
    rule_errors, rule_rows = rules_checks(text)
    errors += rule_errors

    # (3) the floor counts the WHOLE catalogue: the root's §6 plus the scoped files' `### 6.N`
    # sections. Moving a trap between them changes neither total; deleting one does.
    counts["rule_trap_entries"] = sum(r["traps"] for r in rule_rows)
    total_traps = counts.get("trap_entries", 0) + counts["rule_trap_entries"]
    if counts["trap_sections"] and total_traps < TRAP_FLOOR:
        errors.append(
            f"the trap catalogue holds only {total_traps} entries (CLAUDE.md "
            f"{counts.get('trap_entries', 0)} + .claude/rules/ {counts['rule_trap_entries']}); "
            "44 were verified against HEAD when it was written. A catalogue this "
            "small has been gutted, not edited."
        )

    # A ceiling for a rules file that no longer exists: the file and its traps are gone, and
    # nothing else here would say so (the root just got smaller, which reads as a win).
    for name in sorted(ceilings):
        if name.startswith(RULES_PREFIX) and not (ROOT / name).exists():
            errors.append(
                f"{name} has a committed ceiling but no longer exists; deleting a rules file "
                "deletes its traps. Restore it, or move its entries and drop the ceiling in "
                "the same commit.")

    for name, size in sizes.items():
        cap = ceilings.get(name)
        if cap is None:
            errors.append(f"{name}: no ceiling committed; add one to "
                          f"{BUDGET.relative_to(ROOT)} BY HAND (--update rewrites its _comment "
                          f"and note, which hold the only record of why each ceiling moved)")
            continue
        if size > cap:
            errors.append(
                f"{name}: {fmt(size)} chars exceeds the ceiling {fmt(cap)} "
                f"(+{fmt(size - cap)}). Move the narrative to docs/Changelog-Archive.md, "
                f"or raise the ceiling with --update in its own justified commit."
            )

    if errors:
        print("[check_claudemd_budget] FAILED", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    # Positive coverage, never a bare "OK" — see the docstring.
    print("[check_claudemd_budget] OK")
    for name, size in sizes.items():
        cap = ceilings.get(name, 0)
        head = cap - size
        print(f"    {name:<34} {fmt(size):>9} / {fmt(cap):<9} ({fmt(head)} spare)")
    print(f"    sections {counts['sections']} · trap groups {counts['trap_sections']} · "
          f"trap entries {counts['trap_entries'] + counts['rule_trap_entries']} "
          f"(CLAUDE.md {counts['trap_entries']} + .claude/rules/ {counts['rule_trap_entries']}) · "
          f"@-imports {counts['at_imports']}")
    for r in rule_rows:
        print(f"    {r['file']:<34} {r['globs']} glob(s) matching {r['matched']:,} tracked "
              f"files · {r['traps']} trap entries")
    if not rule_rows:
        print("    .claude/rules/: no scoped files")


if __name__ == "__main__":
    main()
