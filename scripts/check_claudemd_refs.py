#!/usr/bin/env python3
"""CLAUDE.md reference-integrity gate — every path, script and spec it names must exist.

Why this exists (v1.130.0): documentation outlives its code, and confident prose is the
best camouflage a wrong reference has. When the canon/changelog split was planned, EVERY
`app.src.jsx:NNNN` line citation in the file was checked and every one was wrong — six for
six — in a 13,066-line file that changes on most commits. Line numbers were dropped from
the rewrite for that reason; this gate guards what replaced them.

It checks three classes of reference, all of them cheap and all of them things a reader
would act on:

  1. REPO PATHS in backticks (anything containing a `/` or ending in a known source
     extension). A path that no longer resolves sends a reader — or an agent — hunting
     through a tree for a file that was renamed or deleted.
  2. `npm run <script>` invocations, against the real scripts in package.json. A documented
     command that does not exist is worse than an undocumented one: it looks authoritative
     and fails at the shell.
  3. `SYMBOL` (file.ext:LINE) citations, if any survive. These are permitted ONLY when the
     named symbol is genuinely on that line; otherwise cite the symbol alone.

WHERE IT RUNS:
  - `npm run validate:claudemd`        — beside the budget gate.
  - .github/workflows/ci-validate.yml  — step "CLAUDE.md references (gate)".

Like its sibling it prints a positive coverage count rather than a bare "OK": a checker
that silently matched nothing is indistinguishable from a clean run, which is this repo's
most-repeated failure class. Exit 1 on any dangling reference, and exit 1 if it somehow
resolved zero references at all.

Scope: CLAUDE.md by default; pass paths to check other documents (docs/*.md).
Deliberately stdlib-only.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# A backticked token is a PATH candidate if it has a directory separator or a known
# extension. Everything else in backticks is a code identifier and is not our business.
EXTS = (".py", ".mjs", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".yml", ".yaml",
        ".html", ".css", ".scss", ".sh", ".jinja2")
BACKTICK_RE = re.compile(r"`([^`\n]+)`")
NPM_RUN_RE = re.compile(r"`npm run ([a-zA-Z0-9:_-]+)`")
LINE_CITE_RE = re.compile(r"`([A-Za-z_][A-Za-z0-9_.]*)`[^\n]{0,40}?\(?([\w./-]+\.(?:jsx?|tsx?|py|mjs)):(\d+)")

# Paths that are legitimately named but deliberately absent from the tree.
# Named legitimately but absent from a clean tree. Two kinds, and both are deliberate:
# BUILD OUTPUTS (emitted into source/public, which is generated and gitignored) and
# DELETED MODULES that the canon names precisely BECAUSE they were removed and must not
# come back. Anything added here must be one of those two — it is not a place to silence
# a reference that is simply wrong.
ALLOW_ABSENT = {
    # build outputs
    "l.html", "l-manifest.json", "sitemap.xml", "llms.txt", "neural.js", "neural.css",
    "graph-data.json", "sound-catalog.json", "questionBank.json", "graphAdjacency.json",
    "postscript.js", "prescript.js", "index.css", "globalGraphLayout.json",
    # deleted on purpose (v1.80.0 legacy excision, v1.126.0 prototype retirement)
    "trainingSession.ts", "srs.ts", "settings.ts", "explored.ts", "known.ts",
    "dateUtil.ts", "gameAudio.ts", "explorerGraphExpand.ts", "Graph.tsx",
    "graph.inline.ts", "BackgroundGraph.tsx", "backgroundGraph.inline.ts",
}

TOP_DIRS = ("scripts/", "e2e/", "neural/", "source/", "docs/", "tests/", "content/",
            "templates/", "functions/", "forward/", ".github/", "workers/", "supabase/",
            "branding/")


def _index_basenames() -> dict:
    """basename -> count, over the tracked tree. Lets a BARE filename (`build.mjs`) be
    validated as 'exists somewhere' without demanding a full path in the prose."""
    idx = {}
    skip = {"node_modules", ".git", ".quartz-cache", "public", "dist", ".claude"}
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if any(part in skip for part in p.parts):
            continue
        idx[p.name] = idx.get(p.name, 0) + 1
    return idx


def path_candidates(text: str):
    """Yields (token, offset, kind). kind is 'path' (contains a separator, must resolve
    exactly) or 'name' (a bare filename, must exist somewhere in the tree)."""
    for m in BACKTICK_RE.finditer(text):
        tok = m.group(1).strip().rstrip(".,;:")
        if not tok or " " in tok or any(c in tok for c in "()<>|*${},"):
            continue
        if tok.startswith(("http", "~", ".")) or tok.startswith(("npm ", "python", "node ", "git ")):
            continue
        if "/" in tok:
            # Only treat it as a repo path when it is rooted at a real top-level dir.
            # Otherwise it is prose: `Mount/Top`, `success|failure|counter`, `gi/nogi`.
            if not any(tok.startswith(pre) for pre in TOP_DIRS):
                continue
            yield tok, m.start(), "path"
        elif tok.endswith(EXTS):
            yield tok, m.start(), "name"


def line_of(text: str, off: int) -> int:
    return text.count("\n", 0, off) + 1


def check(doc: Path) -> tuple[list[str], dict]:
    text = doc.read_text(encoding="utf-8")
    errors, counts = [], {"paths": 0, "npm": 0, "cites": 0}

    names = _index_basenames()
    for tok, off, kind in path_candidates(text):
        counts["paths"] += 1
        if kind == "path":
            if not (ROOT / tok).exists() and Path(tok).name not in ALLOW_ABSENT:
                errors.append(f"{doc.name}:{line_of(text, off)} dangling path `{tok}`")
        elif tok not in names and tok not in ALLOW_ABSENT:
            errors.append(
                f"{doc.name}:{line_of(text, off)} names `{tok}`, which exists nowhere "
                f"in the tree — renamed or deleted?")

    # Root AND the source/ sub-package: the docs legitimately name commands from both
    # (`cd source && npm run check` is the TypeScript gate), so a name resolving in either
    # is a real command.
    pkg = set(json.loads((ROOT / "package.json").read_text()).get("scripts", {}))
    sub = ROOT / "source" / "package.json"
    if sub.exists():
        pkg |= set(json.loads(sub.read_text()).get("scripts", {}))
    for m in NPM_RUN_RE.finditer(text):
        counts["npm"] += 1
        if m.group(1) not in pkg:
            errors.append(
                f"{doc.name}:{line_of(text, m.start())} `npm run {m.group(1)}` "
                f"is not a script in package.json or source/package.json")

    for m in LINE_CITE_RE.finditer(text):
        sym, rel, num = m.group(1), m.group(2), int(m.group(3))
        p = ROOT / rel
        if not p.exists():
            continue  # already reported by the path pass
        counts["cites"] += 1
        lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        window = "\n".join(lines[max(0, num - 3): num + 2])
        if sym not in window:
            errors.append(
                f"{doc.name}:{line_of(text, m.start())} cites `{sym}` at {rel}:{num} "
                f"but that symbol is not within +/-2 lines there — cite the SYMBOL, not "
                f"the line number (every such citation in the pre-split file was wrong)")
    return errors, counts


def main() -> None:
    docs = [Path(a) for a in sys.argv[1:]] or [ROOT / "CLAUDE.md"]
    all_errors, total = [], {"paths": 0, "npm": 0, "cites": 0}
    for d in docs:
        d = d if d.is_absolute() else ROOT / d
        if not d.exists():
            all_errors.append(f"{d}: does not exist")
            continue
        errs, counts = check(d)
        all_errors += errs
        for k in total:
            total[k] += counts[k]

    checked = sum(total.values())
    if all_errors:
        print("[check_claudemd_refs] FAILED", file=sys.stderr)
        for e in all_errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)
    if checked == 0:
        print("[check_claudemd_refs] FAILED: resolved ZERO references — the matcher is "
              "broken, which is indistinguishable from a clean run", file=sys.stderr)
        sys.exit(1)

    print(f"[check_claudemd_refs] OK — {total['paths']} repo paths, "
          f"{total['npm']} npm scripts, {total['cites']} symbol@line citations, "
          f"all resolve ({', '.join(d.name for d in docs)})")


if __name__ == "__main__":
    main()
