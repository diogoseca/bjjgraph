#!/usr/bin/env python3
"""
THE GRAPH-SEMANTICS REPRODUCIBILITY GATE — every lane's cheap gate, every committed artifact's
staleness, and every number the public doc prints.

    python3 -B scripts/semantics/verify_all.py                 # gates + staleness + claims (< 5 min)
    python3 -B scripts/semantics/verify_all.py --heavy         # + the full lane runs, via the heavy advisory
                                                               #   named by GS_HEAVY_ADVISORY (unset: NAMED SKIPs)
    python3 -B scripts/semantics/verify_all.py --no-gates      # staleness + claims only (~20 s)
    python3 -B scripts/semantics/verify_all.py --json out.json # also write the full report

CLAUDE.md §6.9: "a canon number nobody can reproduce is worse than no number". This file makes the
cell's numbers checkable after they are committed:

1. GATES. Every `scripts/semantics/*.py` that declares `--selfcheck` is DISCOVERED (not listed by
   hand) and run, plus two smoke runs (chains.py, payload_probe.py). A REQUIRED set (the gates the
   cell brief names) must be a subset of what was discovered, and the number of gates that ran AND
   passed must reach it — a gate that silently did not run fails the verifier. A gate PASSES only
   if it exits 0, prints a PASS/OK marker (or its check count), its CLOSING line carries no FAIL
   marker (a negative test may print FAIL on purpose earlier), and it WROTE no committed artifact:
   it runs under a write tracer that logs every open-for-write / replace / rename under
   tests/artifacts/semantics by the gate's own process, so a file another process in this shared
   worktree changes meanwhile is reported beside the gate, never charged to it. (Writes by a
   gate's CHILD processes are not traced; the before/after hashes still report them as changes.)
   Cheap producers are REGENERATED into a temp dir and compared with the committed artifact
   (chains.json, vocabulary.json, payload.json): the most direct staleness test there is.
2. STALENESS. Every 64-hex string in every committed artifact is a recorded source hash. Each is
   resolved to a file (its key is a repo path; or a `path`/`source` sibling names one; or a named
   alias like `graph_sha256`), re-hashed, and reported OK / STALE / MISSING / UNCHECKABLE. An
   artifact that records no checkable hash is reported UNHASHED, never passed; one whose hashes
   omit graph.json or its producing script is FRESH-PARTIAL.
3. CLAIMS. `tests/artifacts/semantics/claims.json` registers the doc's measured numbers: the doc
   quote that must still be present, the printed value, and the artifact pointer (RFC 6901) or a
   named recompute function here. Each is MATCH / MISMATCH / UNBACKED / QUOTE-GONE / BROKEN /
   SKIPPED; a MATCH on a STALE artifact is reported as such. Tolerance is half a unit of the last
   printed digit (a unit for '~'/'about', 1% of a printed power of ten, 1e-9 where the doc says
   "exactly"); a printed bound carries a relation (lt/le/gt/ge). Numbers in the doc that no claim
   quote and no declared definition (a parameter, an app constant, a quotation) covers are listed
   with their line — coverage is a character mask over the whole doc, so quotes may span a line
   break or overlap — so a new number cannot slip in unregistered.

Exit status: 1 (FAIL) if any gate failed, any artifact is STALE (or UNHASHED unless --allow-unhashed),
or any claim MISMATCHES, is BROKEN or lost its quote. 2 (INCOMPLETE) if nothing failed but something
could not run here — node not on PATH, the emitted wire absent (`python3 scripts/regenerate_neural_data.py`,
gitignored output), the heavy advisory absent, a gate-count claim under --no-gates — each a NAMED SKIP,
never a silent pass. 0 (PASS) only when everything ran and held. UNBACKED claims are reported and
counted but do not fail (they are the doc's honest debt, listed by name).
Deterministic: no randomness; timings are printed, never compared.
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
ART = REPO / "tests/artifacts/semantics"
DOC = REPO / "docs/GraphSemantics.md"
CLAIMS = ART / "claims.json"
# outside the repo, so both are overridable; a missing advisory SKIPS --heavy by name (never runs undeclared)
# Host paths come from the environment only: this repo is public and carries no machine path.
# GS_SCRATCH resolves a hash recorded as "scratch:<path>"; unset, such a record is UNCHECKABLE.
# GS_HEAVY_ADVISORY is the host's heavy-job advisory; unset, --heavy is a NAMED SKIP (never undeclared).
SCRATCH = Path(os.environ["GS_SCRATCH"]) if os.environ.get("GS_SCRATCH") else None
ADVISORY = Path(os.environ["GS_HEAVY_ADVISORY"]) if os.environ.get("GS_HEAVY_ADVISORY") else None
WIRE = Path(os.environ.get("GS_WIRE", REPO / "source/quartz/static/neural/graph-data.json"))  # gitignored output
WIRE_FIX = "run `python3 scripts/regenerate_neural_data.py` (its output is gitignored)"


def env_status():
    """What the environment can run. A missing piece turns the checks that need it into named SKIPs."""
    node = shutil.which("node")
    return {"node": node, "wire": WIRE.exists(),
            "reasons": ([] if node else ["node is not on PATH (needed by scalars.py --consequences)"])
            + ([] if WIRE.exists() else [f"the emitted wire {WIRE} is absent: {WIRE_FIX}"])}


def reads_wire(name):
    p = HERE / f"{name}.py"
    return p.exists() and bool(re.search(r"static/neural|graph-data\.json", p.read_text(errors="replace")))
COMMAND = "python3 -B scripts/semantics/verify_all.py"

# the gates the cell brief names; discovery must find every one of them (the floor)
REQUIRED_GATES = ("_kernel", "_absorbing", "_territory_methods", "_territory_audit", "territories",
                  "_geometry_methods", "geometry", "_tpt", "flux", "vocabulary", "naming", "scalars",
                  "app_game")
# side-effect suppression: a gate must never write the tree (measured: vocabulary --selfcheck writes
# vocabulary.json by default; atlas writes atlas.json unless --no-write; _geometry_relayout demands --out)
GATE_EXTRA = {"vocabulary": lambda tmp: ["--output", str(tmp / "vocabulary.json")],
              "atlas": lambda tmp: ["--no-write"],
              "_geometry_relayout": lambda tmp: ["--out", str(tmp / "relayout")]}
REGEN = {"vocabulary": ("vocabulary.json", "vocabulary.json")}      # gate -> (temp file, committed artifact)
SMOKE = (("chains", ["--json", "{tmp}/chains.json"], ("chains.json", "chains.json")),
         ("payload_probe", ["--json", "{tmp}/payload.json"], ("payload.json", "payload.json")))
HEAVY = (  # name, argv (after the script), declared peak MiB, (temp output, committed artifact) or None
    ("geometry", ["--json", "{tmp}/geometry.json"], 900, ("geometry.json", "geometry.json")),
    ("naming", ["--territories", "--output", "{tmp}/naming.json"], 2000, ("naming.json", "naming.json")),
    ("territories", ["--no-write"], 2000, None),
    ("flux", ["--out", "{tmp}/flux.json"], 1500, ("flux.json", "flux.json")),
    ("scalars", ["--json", "{tmp}/scalars.json"], 1500, ("scalars.json", "scalars.json")),
    ("scalars", ["--consequences", "{tmp}/scalars_consequences.json"], 1500,
     ("scalars_consequences.json", "scalars_consequences.json")),
    ("app_game", ["--json", "{tmp}/app_game.json"], 1500, None),
    ("atlas", ["--no-write"], 1500, None),
    # ~8 min, peak ~220 MiB measured (S5); fixed seed, so the regeneration must be IDENTICAL
    ("independent_sim", ["--json", "{tmp}/independent_sim.json"], 400, ("independent_sim.json", "independent_sim.json")),
)
# which script produces which artifact, when the artifact carries no top-level "recompute" field.
# An artifact in neither is reported "NO PRODUCER KNOWN" (loudly), never assumed.
# A producer that refuses any output path outside its committed file cannot be regenerated into a temp
# dir as is. Its driver re-points the module's OUTPUT constant at the temp dir and calls its own main():
# the real code runs, and nothing under the repo is written (the write tracer and the hashes still watch).
HEAVY_DRIVERS = {
    "geometry": ("import sys\nfrom pathlib import Path\nsys.path.insert(0, {here!r})\nimport geometry\n"
                 "geometry.OUTPUT = Path(sys.argv[sys.argv.index('--json') + 1]).resolve()\n"
                 "sys.exit(geometry.main())\n"),
}
PRODUCERS = {"territories.json": "scripts/semantics/territories.py",
             "territories-t1.json": "scripts/semantics/territories.py",
             "geometry.json": "scripts/semantics/geometry.py",
             "naming.json": "scripts/semantics/naming.py",
             "naming_glossary.json": "scripts/semantics/naming.py",
             "vocabulary.json": "scripts/semantics/vocabulary.py",
             "chains.json": "scripts/semantics/chains.py",
             "payload.json": "scripts/semantics/payload_probe.py",
             "scalars.json": "scripts/semantics/scalars.py",
             "claims.json": None,                    # the registry itself: an input, hashed by the report
             "naming_toy_input.json": None}          # a hand-written fixture input, not a product
HASH_ALIASES = {"graph_sha256": "graph.json", "lexicon_sha256": "tests/artifacts/semantics/vocabulary.json",
                "seeded_from_doc_sha256": "docs/GraphSemantics.md"}
PATH_ALIASES = {"flow.src.js": "neural/src/flow.src.js",
                "graph-data.json (wire)": "source/quartz/static/neural/graph-data.json",
                "lexicon (vocabulary.json)": "tests/artifacts/semantics/vocabulary.json",
                "vocabulary.json": "tests/artifacts/semantics/vocabulary.json",
                "naming.json": "tests/artifacts/semantics/naming.json",
                "territories.json": "tests/artifacts/semantics/territories.json",
                "scalars.py": "scripts/semantics/scalars.py",
                "solve_edge_values.py": "scripts/solve_edge_values.py",
                "solve_flow.py": "scripts/solve_flow.py"}
HEX64 = re.compile(r"^[0-9a-f]{64}$")
PASS_RE = re.compile(r"(^|\W)(PASS|OK)(\W|$)")
FAIL_RE = re.compile(r"(?<!\b0)(^|[\s\[])FAIL(ED)?([\s\]:]|$)")    # "0 FAILED" is a pass (atlas prints it)
COUNT_RES = (re.compile(r"(\d+) checks, 0 failed"), re.compile(r"checks=(\d+)"), re.compile(r"(\d+) checks run"),
             re.compile(r"PASS: (\d+) checks"), re.compile(r"checks: (\d+) run"), re.compile(r"(\d+) run \(floor"),
             re.compile(r"executed=(\d+)"), re.compile(r"PASS selfcheck: (\d+) checks"), re.compile(r"selfcheck: (\d+) checks"),
             re.compile(r'"assertions": (\d+)'))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def snapshot(where=None):
    d = Path(where) if where is not None else ART
    return {p.name: sha(p) for p in sorted(d.glob("*")) if p.is_file()}


def say(msg=""):
    print(msg, flush=True)


# --------------------------------------------------------------------------- #
# 1. gates
# --------------------------------------------------------------------------- #
def discover():
    found = []
    for p in sorted(HERE.glob("*.py")):
        if p.name == Path(__file__).name:
            continue
        src = p.read_text(encoding="utf-8", errors="replace")
        if re.search(r"""add_argument\(\s*["']--selfcheck["']""", src):
            found.append(p.stem)
    return found


def count_of(text):
    best = None
    for rx in COUNT_RES:
        for m in rx.finditer(text):
            v = int(m.group(1))
            best = v if best is None else max(best, v)
    return best


# The gate runs under this tracer: every write-mode open / os.replace / os.rename its OWN process makes
# under the watched directory is logged. That attributes a write to the gate itself; a file that changed
# while the gate ran but is not in the log was written by someone else (a shared worktree has other
# writers), which is reported, not failed. Pathlib and json write through io.open, which is patched too.
TRACER = r"""
import builtins, io, os, runpy, sys
LOG, WATCH = os.environ["VERIFY_WRITE_LOG"], os.environ["VERIFY_WATCH"]
_open, _rep, _ren = builtins.open, os.replace, os.rename
def _rec(p):
    try:
        ap = os.path.abspath(os.fspath(p))
        if ap.startswith(WATCH + os.sep):
            with _open(LOG, "a") as fh:
                fh.write(ap + "\n")
    except Exception:
        pass
def _o(file, mode="r", *a, **k):
    if any(c in mode for c in "wax+"):
        _rec(file)
    return _open(file, mode, *a, **k)
def _rp(src, dst, *a, **k):
    _rec(dst)
    return _rep(src, dst, *a, **k)
def _rn(src, dst, *a, **k):
    _rec(dst)
    return _ren(src, dst, *a, **k)
builtins.open = io.open = _o
os.replace, os.rename = _rp, _rn
script = sys.argv[1]
sys.argv = sys.argv[1:]
sys.path.insert(0, os.path.dirname(os.path.abspath(script)))
runpy.run_path(script, run_name="__main__")
"""


def run_one(name, argv, tmp, timeout=1500, script=None, watch=None):
    wdir = Path(watch) if watch is not None else ART
    before = snapshot(wdir)
    log = Path(tempfile.mkdtemp(prefix="verify_all_wlog_")) / "writes.log"
    t0 = time.monotonic()
    try:
        p = subprocess.run([sys.executable, "-B", "-c", TRACER, str(script or HERE / f"{name}.py")] + argv, cwd=REPO,
                           capture_output=True, text=True, timeout=timeout,
                           env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1", VERIFY_WRITE_LOG=str(log),
                                    VERIFY_WATCH=str(wdir.resolve())))
        rc, out = p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired as exc:
        rc, out = "timeout", f"TIMEOUT after {timeout}s: {exc}"
    secs = time.monotonic() - t0
    after = snapshot(wdir)
    wrote = sorted({Path(x).name for x in log.read_text().split()} if log.exists() else set())
    shutil.rmtree(log.parent, ignore_errors=True)
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    mutated = wrote                                  # attributed to THIS gate by the write trace
    concurrent = [k for k in changed if k not in wrote]
    lines = out.splitlines()
    passed_marker = any(PASS_RE.search(ln) for ln in lines)
    # A gate's verdict is its exit status and its CLOSING summary: selfchecks print FAIL lines for the
    # named failures they provoke on purpose (_absorbing's ImpossibleConditionError fixture), so only
    # the last lines may carry a failure marker.
    closing = [ln for ln in lines if ln.strip()][-1:]
    fail_lines = [ln for ln in closing if FAIL_RE.search(ln)
                  and not re.search(r"\b0 failed\b|failed=0|failures=0|FAIL(ED)?: 0\b", ln)]
    n = count_of(out)
    # positive evidence the selfcheck RAN (a script that ignores --selfcheck and exits 0 has none):
    # a PASS/OK marker, a parsed check count, or a `... selfcheck: {...}` report line (naming.py's form)
    evidence = ("PASS/OK marker" if passed_marker else "check count" if n else
                "selfcheck report line" if re.search(r"selfcheck: \{", out) else None)
    passed_marker = evidence is not None
    ok = rc == 0 and passed_marker and not fail_lines and not mutated
    why = [] if ok else ([f"exit {rc}"] if rc != 0 else []) + ([] if passed_marker else ["no evidence it ran (no PASS/OK, count or report line)"]) \
        + ([f"FAIL line: {fail_lines[0][:120]}"] if fail_lines else []) \
        + ([f"WROTE committed {mutated} (write trace of the gate's own process)"] if mutated else [])
    return {"gate": name, "argv": argv, "rc": rc, "seconds": round(secs, 1), "checks": n, "passed": ok, "evidence": evidence,
            "changed_by_others": concurrent,
            "_out": out,
            "why": why, "mutated": mutated, "tail": lines[-3:]}


def compare_json(tmp_file, committed):
    a, b = Path(tmp_file), ART / committed
    if not a.exists():
        return {"status": "NOT PRODUCED", "artifact": committed}
    if a.read_bytes() == b.read_bytes():
        return {"status": "IDENTICAL", "artifact": committed}
    # A producer may record its own command line (meta.recompute "... --json <out>"): the temp path it
    # was given is not a content difference. Only that exact string is rewritten, to the committed path.
    text = a.read_text().replace(str(a), f"tests/artifacts/semantics/{committed}")
    if text.encode() == b.read_bytes():
        return {"status": "IDENTICAL (its own output path normalised)", "artifact": committed}
    try:
        diffs = []
        _diff(json.loads(text), json.loads(b.read_text()), "", diffs)
    except Exception as exc:  # noqa: BLE001 - a non-JSON product is itself the finding
        return {"status": "DIFFERS (unparseable)", "artifact": committed, "error": str(exc)}
    if diffs and all("sha256" in d.split(" ")[0] for d in diffs):
        status = "SAME NUMBERS (only recorded source hashes differ: re-stamp, nothing moved)"
    else:
        status = "DIFFERS" if diffs else "SAME CONTENT (bytes differ)"
    return {"status": status, "artifact": committed, "differing_leaves": len(diffs), "first": diffs[:6]}


def _diff(x, y, ptr, out, cap=10_000):
    if len(out) >= cap:
        return
    if isinstance(x, dict) and isinstance(y, dict):
        for k in sorted(set(x) | set(y)):
            if k not in x or k not in y:
                out.append(ptr + "/" + _esc(k) + (" (only regenerated)" if k in x else " (only committed)"))
            else:
                _diff(x[k], y[k], ptr + "/" + _esc(k), out)
    elif isinstance(x, list) and isinstance(y, list):
        if len(x) != len(y):
            out.append(f"{ptr} (length {len(x)} vs {len(y)})")
        for i, (u, v) in enumerate(zip(x, y)):
            _diff(u, v, f"{ptr}/{i}", out)
    elif x != y:
        out.append(f"{ptr} ({_short(x)} vs committed {_short(y)})")


def _short(v):
    s = json.dumps(v)
    return s if len(s) < 40 else s[:37] + "..."


def _esc(k):
    return str(k).replace("~", "~0").replace("/", "~1")


def run_gates(only=None):
    found = discover()
    missing = [g for g in REQUIRED_GATES if g not in found]
    rows, regen = [], []
    tmp = Path(tempfile.mkdtemp(prefix="verify_all_"))
    try:
        for g in found:
            if only and g not in only:
                continue
            extra = GATE_EXTRA.get(g, lambda _t: [])(tmp)
            r = run_one(g, ["--selfcheck"] + extra, tmp)
            if not r["passed"] and not WIRE.exists() and reads_wire(g) and not r["mutated"]:
                r["skipped"] = f"failed while the emitted wire is absent, and this script reads it: {WIRE_FIX}"
            rows.append(r)
            tag = "SKIP" if r.get("skipped") else ("PASS" if r["passed"] else "FAIL")
            say(f"  gate {g:22s} {tag:4s} {r['seconds']:7.1f}s  checks={r['checks']}"
                + ("" if r["passed"] else f"  <- {r.get('skipped') or '; '.join(r['why'])}"))
            if g in REGEN and r["rc"] == 0:
                regen.append(compare_json(tmp / REGEN[g][0], REGEN[g][1]))
        for name, argv, (tmp_name, committed) in SMOKE:
            if only and name not in only:
                continue
            if not WIRE.exists() and reads_wire(name):
                rows.append({"gate": name, "smoke": True, "passed": False, "rc": None, "mutated": [], "why": [],
                             "skipped": f"reads the emitted wire, which is absent: {WIRE_FIX}", "seconds": 0.0})
                regen.append({"status": "SKIPPED (no emitted wire)", "artifact": committed})
                say(f"  smoke {name:21s} SKIP  <- reads the emitted wire, which is absent: {WIRE_FIX}")
                continue
            r = run_one(name, [a.format(tmp=tmp) for a in argv], tmp)
            r["smoke"] = True
            if r["rc"] == 0 and not r["mutated"]:          # a smoke run has no PASS marker to print
                r["passed"], r["why"] = True, []
            rows.append(r)
            say(f"  smoke {name:21s} {'PASS' if r['passed'] else 'FAIL':4s} {r['seconds']:7.1f}s"
                + ("" if r["passed"] else f"  <- {'; '.join(r['why'])}"))
            if r["rc"] == 0:
                regen.append(compare_json(tmp / tmp_name, committed))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    ran = sum(1 for r in rows if r["rc"] == 0 and not r.get("smoke"))
    skipped = [(r["gate"], r["skipped"]) for r in rows if r.get("skipped")]
    floor = len(REQUIRED_GATES) if not only else 0
    return {"discovered": found, "required": list(REQUIRED_GATES), "required_missing": missing, "rows": rows,
            "gates_ran_and_passed": sum(1 for r in rows if r["passed"] and not r.get("smoke")), "gates_ran": ran,
            "floor": floor, "regenerated": regen, "skipped": skipped}


def run_heavy():
    rows = []
    env = env_status()
    tmp = Path(tempfile.mkdtemp(prefix="verify_all_heavy_"))
    try:
        for name, argv, mib, cmp_ in HEAVY:
            run = f"{name} {' '.join(argv)}"
            need = []
            if ADVISORY is None or not ADVISORY.exists():
                need.append(f"no heavy advisory ({'GS_HEAVY_ADVISORY is unset' if ADVISORY is None else f'{ADVISORY} is absent'}): "
                            "set GS_HEAVY_ADVISORY to the host's advisory script; heavy jobs never run undeclared")
            if "--consequences" in argv and not env["node"]:
                need.append("node is not on PATH")
            if (reads_wire(name) or "--consequences" in argv) and not env["wire"]:
                need.append(f"the emitted wire is absent: {WIRE_FIX}")
            if need:
                rows.append({"run": run, "status": "SKIPPED", "reason": "; ".join(need)})
                say(f"  heavy {name:10s} SKIP  <- {'; '.join(need)}")
                continue
            what = f"gs-2 verify_all --heavy: {name} {' '.join(argv)}"
            adv = subprocess.run(["bash", str(ADVISORY), str(mib), what], capture_output=True, text=True)
            if adv.returncode != 0:
                rows.append({"run": f"{name} {' '.join(argv)}", "status": "DEFERRED by the heavy advisory",
                             "advisory": (adv.stdout + adv.stderr).strip()[-200:]})
                say(f"  heavy {name:10s} DEFERRED ({(adv.stdout + adv.stderr).strip()[-120:]})")
                continue
            driver = None
            if name in HEAVY_DRIVERS:
                driver = tmp / f"_{name}_driver.py"
                driver.write_text(HEAVY_DRIVERS[name].format(here=str(HERE)))
            r = run_one(name, [a.format(tmp=tmp) for a in argv], tmp, timeout=3600, script=driver)
            r["passed"] = r["rc"] == 0 and not r["mutated"]
            row = {"run": f"{name} {' '.join(argv)}", "status": "PASS" if r["passed"] else "FAIL", "seconds": r["seconds"],
                   # a full run need not print a selfcheck marker: only exit status and writes decide it
                   "why": [w for w in r["why"] if w.startswith(("WROTE", "exit", "TIMEOUT", "timeout"))],
                   "mutated": r["mutated"]}
            if cmp_ and r["rc"] == 0:
                row["regenerated"] = compare_json(tmp / cmp_[0], cmp_[1])
            rows.append(row)
            say(f"  heavy {name:10s} {row['status']} {r['seconds']:7.1f}s {row.get('regenerated', {}).get('status', '')}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return rows


# --------------------------------------------------------------------------- #
# 2. staleness
# --------------------------------------------------------------------------- #
def _hashes(o, path, out):
    if isinstance(o, dict):
        for k, v in o.items():
            _hashes(v, path + [str(k)], out)
            if isinstance(v, str) and HEX64.match(v):
                sib = {kk: vv for kk, vv in o.items() if isinstance(vv, str)}
                out[-1] = out[-1] + (sib,)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            _hashes(v, path + [str(i)], out)
    elif isinstance(o, str) and HEX64.match(o):
        out.append((path, o))


def resolve_target(path, siblings):
    key = path[-1]
    cands = []
    joined = "/".join(path)
    # the key itself names the file ("source_sha256" -> {"graph.json": sha}), possibly nested by "/"
    for k in {key, "/".join(path[1:]), "/".join(path[2:])}:
        if k:
            cands.append(PATH_ALIASES.get(k, k))
    if key in HASH_ALIASES:
        cands.append(HASH_ALIASES[key])
    for s in ("path", "source", "file", "artifact"):
        v = siblings.get(s)
        if isinstance(v, str):
            cands.append(v)
            cands.extend(t for t in v.split() if "." in t)     # "graph.json only" names graph.json
    for c in cands:
        if c.startswith("scratch:"):
            p = SCRATCH / c[len("scratch:"):] if SCRATCH else None
            if p is not None and p.exists():
                return str(p), joined
            continue
        p = REPO / c
        if p.is_file():
            return str(p.relative_to(REPO)), joined
        p = ART / c
        if p.is_file():
            return str(p.relative_to(REPO)), joined
    return None, joined


def producer_of(name, data):
    """The producing script: the artifact's own `recompute` field (top level, or one level down, e.g.
    meta.recompute), else the PRODUCERS table, else UNKNOWN (reported, never assumed)."""
    fields = []
    if isinstance(data, dict):
        fields.append(data.get("recompute"))
        fields += [v.get("recompute") for v in data.values() if isinstance(v, dict)]
    for rc in fields:
        if isinstance(rc, str):
            m = re.search(r"scripts/semantics/[\w_]+\.py", rc)
            if m:
                return m.group(0)
    return PRODUCERS.get(name, "UNKNOWN")


SYNTHETIC_SCOPE = re.compile(r"\bno (real graph|corpus|kernel)", re.I)


def declares_synthetic(data):
    """A receipt that says it reads no corpus: "graph": "none (synthetic)", or a `scope` naming no real
    graph / corpus / kernel. Only a DECLARATION plus a fresh producer hash makes it FRESH-SYNTHETIC."""
    g = str(data.get("graph", "")) if isinstance(data, dict) else ""
    sc = str(data.get("scope", "")) if isinstance(data, dict) else ""
    return (g.lower().startswith("none") and "synthetic" in g.lower()) or bool(SYNTHETIC_SCOPE.search(sc))


def staleness():
    rows = []
    for p in sorted(ART.glob("*.json")):
        try:
            data = json.loads(p.read_text())
        except Exception as exc:  # noqa: BLE001
            rows.append({"artifact": p.name, "verdict": "UNREADABLE", "error": str(exc)})
            continue
        found = []
        _hashes(data, [], found)
        recs = []
        for item in found:
            path, h = item[0], item[1]
            sib = item[2] if len(item) > 2 else {}
            target, joined = resolve_target(path, sib)
            if target is None:
                recs.append({"at": joined, "status": "UNCHECKABLE (no file named)"})
                continue
            cur = sha(REPO / target) if not target.startswith("/") else sha(target)
            recs.append({"at": joined, "file": target, "status": "OK" if cur == h else "STALE",
                         "recorded": h[:12], "current": cur[:12]})
        checkable = [r for r in recs if r["status"] in ("OK", "STALE")]
        prod = producer_of(p.name, data)
        files = {r["file"] for r in checkable}
        if p.name == "claims.json":
            verdict = "REGISTRY (input)" + ("" if not any(r["status"] == "STALE" for r in checkable)
                                            else "; seeded from another doc, see its claims")
        elif prod is None:
            verdict = "FIXTURE (input, not a product)"
        elif any(r["status"] == "STALE" for r in checkable):
            verdict = "STALE"
        elif not checkable:
            verdict = "UNHASHED"
        elif declares_synthetic(data) and prod in files:
            verdict = "FRESH-SYNTHETIC (declares no graph; producer hashed)"
        else:
            need = (prod,) if declares_synthetic(data) else ("graph.json", prod)
            missing = [f for f in need if f and f not in files]
            verdict = "FRESH" if not missing else "FRESH-PARTIAL (not hashed: " + ", ".join(missing) + ")"
        rows.append({"artifact": p.name, "bytes": p.stat().st_size, "producer": prod, "verdict": verdict,
                     "records": recs, "hashes_found": len(found)})
    return rows


# --------------------------------------------------------------------------- #
# 3. claims
# --------------------------------------------------------------------------- #
NUM = re.compile(r"[-−+]?\d[\d,]*(?:\.\d+)?(?:e[-−+]?\d+)?")      # incl. "1e-16", "7.8e-14"


WORDS = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve".split())}
WORDS.update({"a quarter": 0.25, "a third": 1 / 3, "half": 0.5, "a half": 0.5, "once": 1, "twice": 2})


def parse_printed(s):
    """'38.0%' -> (38.0, 0.05); '12,827' -> (12827, 0.5); '~2.1' -> (2.1, 0.1); '11.2 M' -> (11.2e6, 0.05e6)."""
    t = str(s).strip()
    m = re.fullmatch(r"(?:about )?one in (\w+)", t.lower())
    if m:                                  # "one in seven": 1/7, tolerance half-way to 1/6.5 and 1/7.5
        n = WORDS.get(m.group(1)) or float(m.group(1))
        return 1.0 / n, 1.0 / (n - 0.5) - 1.0 / n
    if t.lower().replace("about ", "") in WORDS:
        w = WORDS[t.lower().replace("about ", "")]
        return float(w), (0.05 if isinstance(w, float) and not float(w).is_integer() else 1e-12)
    approx = t.startswith(("~", "≈", "about")) or t.endswith("…")
    t = t.replace("≈", "").replace("~", "").replace("about", "").replace("−", "-").replace("×", "").replace(",", "")
    t = t.replace("%", "").replace("+", "").replace("½", "0.5").strip()
    mult = 1.0
    if t.endswith("M"):
        mult, t = 1e6, t[:-1].strip()
    val = float(t)
    if "e" in t.lower():                            # "1e-5": a power-of-ten bound, tolerance 1% of it
        return val * mult, abs(val) * 0.01 * mult
    dec = len(t.split(".")[1]) if "." in t else 0
    tol = 0.5 * 10 ** (-dec) * (2 if approx else 1)
    return val * mult, tol * mult + 1e-12


EXACT_TOL = 1e-9     # "exactly 0", "exactly ½": numerical equality, not half a printed unit


def exact_in(quote, printed):
    """The doc says 'exactly <printed>' (markdown emphasis allowed): check to EXACT_TOL."""
    return re.search(r"exactly[\s*]+" + re.escape(printed), quote) is not None


def pointer_get(data, ptr):
    if ptr in ("", "/"):
        return data
    cur = data
    for raw in ptr.lstrip("/").split("/"):
        if raw.endswith("#len"):
            raw = raw[:-4]
            cur = cur[int(raw)] if isinstance(cur, list) else cur[raw.replace("~1", "/").replace("~0", "~")]
            return len(cur)
        k = raw.replace("~1", "/").replace("~0", "~")
        cur = cur[int(k)] if isinstance(cur, list) else cur[k]
    return cur


_ART_CACHE = {}


def artifact(name):
    if name not in _ART_CACHE:
        _ART_CACHE[name] = json.loads((ART / name).read_text())
    return _ART_CACHE[name]


RECOMPUTE = {}          # name -> function(args, context) -> value; filled below


class SkipClaim(Exception):
    """A recompute that cannot run in this environment (named reason); never a MATCH."""


def recompute(name):
    def deco(fn):
        RECOMPUTE[name] = fn
        return fn
    return deco


def value_of(src, ctx):
    if "unbacked" in src:
        return None, "UNBACKED"
    if "recompute" in src:
        fn = RECOMPUTE.get(src["recompute"])
        if fn is None:
            return None, f"BROKEN (no recompute function {src['recompute']!r})"
        v = fn(src.get("args", {}), ctx)
        if v is None:
            return None, "SKIPPED (recompute needs --gates output)"
        return float(v) * float(src.get("scale", 1.0)) + float(src.get("offset", 0.0)), None
    data = artifact(src["artifact"])
    ptrs = src.get("pointers") or [src["pointer"]]
    vals = [pointer_get(data, p) for p in ptrs]
    agg = src.get("agg")
    if agg == "min":
        v = min(vals)
    elif agg == "max":
        v = max(vals)
    elif agg == "abs":
        v = abs(vals[0])
    elif agg == "maxabs":                     # a printed bound "under x" / "at most ±x" over several values
        v = max(abs(float(x)) for x in vals)
    elif agg == "sum":
        v = sum(vals)
    elif agg == "mean":
        v = sum(vals) / len(vals)
    elif agg == "len":
        v = len(vals[0])
    elif agg == "diff":
        v = vals[0] - vals[1]
    elif agg == "ratio":
        v = vals[0] / vals[1]
    elif agg == "share_times_range":          # [share, [lo, hi]] -> share x (hi - lo + 1)
        v = vals[0] * (vals[1][1] - vals[1][0] + 1)
    elif agg == "range_count":                # [lo, hi] -> hi - lo + 1
        v = vals[0][1] - vals[0][0] + 1
    else:
        v = vals[0]
    if isinstance(v, (list, dict)):
        return None, "BROKEN (pointer names a container)"
    if src.get("transform") == "jaccard_to_changed_share":
        v = (1.0 - v) / (1.0 + v)             # two k-sets with Jaccard J share 2kJ/(1+J); the rest changed
    return float(v) * float(src.get("scale", 1.0)) + float(src.get("offset", 0.0)), None


UNBACKED_CATEGORIES = ("run-cost", "prose-count", "external-constant")   # closed: anything else is a finding


def claims_failures(rows, uncovered):
    """What in the claims check fails the run. Every doc number must end MATCH, in `definitions`, or
    UNBACKED in one of UNBACKED_CATEGORIES: an uncategorised UNBACKED or an unregistered number fails."""
    fail = []
    by = {}
    for r in rows:
        by.setdefault(r["status"].split(" (")[0], []).append(r)
    for k in ("MISMATCH", "BROKEN", "QUOTE-GONE"):
        if by.get(k):
            fail.append(f"{len(by[k])} claims {k}")
    bad = [r["id"] for r in by.get("UNBACKED", []) if r.get("category") not in UNBACKED_CATEGORIES]
    if bad:
        fail.append(f"{len(bad)} claims UNBACKED outside {UNBACKED_CATEGORIES}: {bad[:5]}")
    if uncovered:
        fail.append(f"{len(uncovered)} doc numbers registered by no claim and no definition "
                    f"(first: line {uncovered[0]['line']} {uncovered[0]['number']!r})")
    if not rows:
        fail.append("claims.json registers 0 claims")
    return fail


def check_claims(stale_rows, gates):
    reg = json.loads(CLAIMS.read_text())
    doc = DOC.read_text(encoding="utf-8")
    stale = {r["artifact"] for r in stale_rows if r["verdict"] == "STALE"}
    ctx = {"gates": {r["gate"]: r for r in (gates or {}).get("rows", [])}}
    out = []
    for c in reg["claims"]:
        row = {"id": c["id"], "section": c["section"], "printed": c["printed"]}
        if c["quote"] not in doc:
            row["status"] = "QUOTE-GONE (the doc no longer carries this sentence)"
            out.append(row)
            continue
        if c["printed"] not in c["quote"]:
            row["status"] = "BROKEN (printed value not inside its quote)"
            out.append(row)
            continue
        try:
            v, why = value_of(c["source"], ctx)
        except SkipClaim as exc:
            out.append({**row, "status": f"SKIPPED ({exc})"})
            continue
        except Exception as exc:  # noqa: BLE001 - a pointer that no longer resolves is the finding
            out.append({**row, "status": f"BROKEN ({type(exc).__name__}: {exc})"})
            continue
        if why:
            cat = c["source"].get("category")
            tag = (f" ({cat})" if cat else " (uncategorised)") if why == "UNBACKED" else ""
            out.append({**row, "status": why + tag, "category": cat, "reason": c["source"].get("unbacked")})
            continue
        want, tol = parse_printed(c["printed"])
        if c.get("sign") == "abs":
            v, want = abs(v), abs(want)
        tol = max(tol, float(c.get("tolerance", 0.0)))
        if c.get("exact") or exact_in(c["quote"], c["printed"]):   # "exactly 0" is not "0 ± 0.5"
            tol = EXACT_TOL
        row["value"] = v
        rel = c.get("relation", "eq")               # a printed BOUND ("q < 1e-5", "NMI >= 0.958") is a relation
        ok = {"eq": abs(v - want) <= tol, "lt": v < want + tol, "le": v <= want + tol,
              "gt": v > want - tol, "ge": v >= want - tol}[rel]
        art = c["source"].get("artifact")
        row["status"] = ("MATCH" if ok else "MISMATCH") + (" (artifact STALE)" if art in stale else "")
        if not ok:
            row["expected"] = want
            row["where"] = f"{art}:{c['source'].get('pointer') or c['source'].get('pointers') or c['source'].get('recompute')}"
        out.append(row)
    # coverage: numbers on doc lines that no claim quote and no declared definition covers
    # A character MASK over the whole doc, not per-line deletion: a quote may span a line break, and two
    # quotes may overlap ("... you win" / "win and 29% ..."); deleting one would orphan the other.
    covered = reg.get("definitions", []) + [c["quote"] for c in reg["claims"]]
    mask = bytearray(len(doc))
    for q in covered:
        j = doc.find(q) if q else -1
        while j >= 0:
            mask[j:j + len(q)] = b"\x01" * len(q)
            j = doc.find(q, j + 1)
    uncovered = []
    in_code = False
    off = 0
    for i, line in enumerate(doc.split("\n"), 1):
        start, off = off, off + len(line) + 1
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code or line.startswith("#"):
            continue
        text = re.sub(r"`[^`]*`", lambda m: " " * len(m.group(0)), line)   # inline code: commands, paths, flags
        for m in NUM.finditer(text):
            if mask[start + m.start()]:
                continue                                     # inside a claim quote or a definition
            tok = m.group(0).rstrip(",")
            before, after = text[:m.start()], text[m.end():]
            if re.fullmatch(r"[-−+]?\d", tok) or re.search(r"§\s*[\d.]*[–-]?$", before):
                continue                                     # single digits, section references, "§6.1–6.2"
            if re.fullmatch(r"\s*(?:[-*]\s+)?\*\*", before) and re.fullmatch(r"\d+\.\d+", tok):
                continue                                     # a bold paragraph number: "**2.1 Every roll ends"
            if re.fullmatch(r"\s*", before) and re.match(r"\.\s", after):
                continue                                     # an ordered-list marker: "10. **The map**"
            if tok[0] in "-−" and re.search(r"\d$", before):
                continue                                     # the second half of a compound: "50-50"
            if re.search(r"\brows?\s+(\d+,?\s+(and\s+)?)*$", before) or re.fullmatch(r"\|\s*", before):
                continue                                     # a table's row number, "rows 5, 6 and 12"
            if re.search(r"[A-Za-z_/.]$", before) or re.match(r"-?[A-Za-z]", after) or re.match(r"-\d", after):
                continue                                     # inside an identifier: backside-50-50, 3-4-mount, v1.176.0
            uncovered.append({"line": i, "number": tok, "text": line.strip()[:100]})
    return out, uncovered, sha(CLAIMS), sha(DOC)


# --------------------------------------------------------------------------- #
# named recompute functions (numbers that live only in a printout)
# --------------------------------------------------------------------------- #
_OPS = {"eq": lambda a, b: a == b, "ne": lambda a, b: a != b, "lt": lambda a, b: a < b, "le": lambda a, b: a <= b,
        "gt": lambda a, b: a > b, "ge": lambda a, b: a >= b, "startswith": lambda a, b: str(a).startswith(b),
        "endswith": lambda a, b: str(a).endswith(b)}


def _rows(args):
    rows = pointer_get(artifact(args["artifact"]), args["pointer"])
    rows = list(rows.values()) if isinstance(rows, dict) else list(rows)
    if not rows:
        raise ValueError("examined 0 rows")
    return rows


def _match(row, where):
    for field, op, val in where:
        try:
            x = pointer_get(row, "/" + field)
        except (KeyError, IndexError, TypeError):
            return False
        if not _OPS[op](x, val):
            return False
    return True


@recompute("count_where")
def _count_where(args, ctx):
    """Count the rows of a list (or the values of a dict) at an artifact pointer that satisfy EVERY
    condition [field-path, op, value]; op in eq ne lt le gt ge startswith endswith ("negate": count the
    rows that do NOT). A condition whose field is missing makes the row not match."""
    rows = _rows(args)
    hit = sum(1 for r in rows if _match(r, args["where"]))
    return len(rows) - hit if args.get("negate") else hit


@recompute("select")
def _select(args, ctx):
    """The `field` of the ONE row matching `where` — a key lookup, never a position in a sorted list
    (an index pointer re-points silently when the list reorders). 0 or >1 matches is an error."""
    hits = [r for r in _rows(args) if _match(r, args["where"])]
    if len(hits) != 1:
        raise ValueError(f"select matched {len(hits)} rows (need exactly 1) for {args['where']}")
    v = float(pointer_get(hits[0], "/" + str(args["field"])))
    return v * float(args.get("scale", 1.0))


@recompute("select_agg")
def _select_agg(args, ctx):
    """min/max/sum of `field` over the rows matching EACH of `wheres` (each must match exactly one)."""
    vals = [_select({**args, "where": w}, ctx) for w in args["wheres"]]
    return {"min": min, "max": max, "sum": sum, "mean": lambda v: sum(v) / len(v)}[args["agg"]](vals)


@recompute("gate_line")
def _gate_line(args, ctx):
    """A number a gate printed in THIS run: every match of `regex` (one capture group) in the gate's
    output, reduced by `agg` (max|min|sum|first). None under --no-gates; 0 matches is an error."""
    r = ctx["gates"].get(args["gate"])
    if r is None:
        return None
    vals = [float(m.group(1).replace(",", "")) for m in re.finditer(args["regex"], r.get("_out", ""))]
    if not vals:
        raise ValueError(f"gate {args['gate']}: regex matched nothing in its output")
    return {"max": max, "min": min, "sum": sum, "first": lambda v: v[0]}[args.get("agg", "first")](vals)


@recompute("listing_count")
def _listing_count(args, ctx):
    """How many position role-nodes LIST a technique with a positive attempt cell in `frame` (the
    corpus's listing, before the origin filter)."""
    g = _kernel()._graph if hasattr(_kernel(), "_graph") else _kernel().graph
    fr = args.get("frame", "nogi")
    n = 0
    for key, node in g["positions"].items():
        if node.get("role") not in ("top", "bottom"):
            continue
        for t in node.get("transitions") or []:
            v = (t.get("attemptProbabilityByRuleset") or {}).get(fr)
            if t.get("target") == args["target"] and v is not None and v > 0:
                n += 1
                break
    return n


@recompute("chains")
def _chains(args, ctx):
    """A pointer into a FRESH `chains.py --start <start> --json` run (5 s, cached per start)."""
    key = "chains:" + args.get("start", "standing")
    if key not in ctx:
        tmp = Path(tempfile.mkdtemp(prefix="verify_all_chains_"))
        try:
            r = run_one("chains", ["--start", args.get("start", "standing"), "--json", str(tmp / "c.json")], tmp)
            if r["rc"] != 0 or not (tmp / "c.json").exists():
                raise RuntimeError(f"chains --json failed (exit {r['rc']}): {r['tail']}")
            ctx[key] = json.loads((tmp / "c.json").read_text())
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    vals = [pointer_get(ctx[key], p) for p in (args.get("pointers") or [args["pointer"]])]
    return {"min": min, "max": max, None: lambda v: v[0]}[args.get("agg")](vals)


@recompute("gate_checks")
def _gate_checks(args, ctx):
    """The check count a gate printed in THIS run (None when gates were skipped)."""
    r = ctx["gates"].get(args["gate"])
    return None if r is None else r.get("checks")


_KERNELS = {}


def _kernel(frame="nogi", initiative="shipped", rates="shipped", origin=True):
    sys.path.insert(0, str(HERE))
    from _kernel import load_kernel
    if "base" not in _KERNELS:
        _KERNELS["base"] = load_kernel()
    key = (frame, initiative, rates, bool(origin))
    if key not in _KERNELS:
        _KERNELS[key] = load_kernel(frame, initiative, rates, graph=_KERNELS["base"].graph, origin=bool(origin))
    return _KERNELS[key]


def _standing(K):
    import numpy as np
    s0 = K.start("standing", "me")
    B, _ = K.absorption()
    N = K.fundamental()
    steps = N.solve(np.ones(K.n_t))
    plies = N.solve(1.0 - np.asarray(K.Q0.sum(axis=1)).ravel())
    Bf, _ = K.exit_law()
    return {"P_W": float(s0 @ B[:, 0]), "P_L": float(s0 @ B[:, 1]), "P_D": float(s0 @ B[:, 2]),
            "E_steps": float(s0 @ steps), "E_plies": float(s0 @ plies),
            "fin": dict(zip(K.fin_cols, s0 @ Bf))}


@recompute("kernel")
def _kernel_quantity(args, ctx):
    """Numbers the doc quotes from `_kernel.py --structure`-style printouts, recomputed from the kernel.
    args: frame, initiative, rates, origin, quantity (+ field for coverage)."""
    K = _kernel(args.get("frame", "nogi"), args.get("initiative", "shipped"), args.get("rates", "shipped"),
                args.get("origin", True))
    q = args["quantity"]
    if q == "n_role_nodes":
        return K.n_r
    if q == "n_positions":
        return len(K.hubs)
    if q == "n_transient":
        return K.n_t
    if q == "coverage":
        return K.coverage[args["field"]]
    if q == "reachable_role_nodes":
        return len(K.reachable)
    if q in ("P_W", "P_L", "P_D", "E_steps", "E_plies"):
        return _standing(K)[q]
    if q in ("origin_dP_W", "origin_fin_tv", "origin_off_E_steps"):
        Ko = _kernel(args.get("frame", "nogi"), args.get("initiative", "shipped"), args.get("rates", "shipped"), False)
        a, b = _standing(K), _standing(Ko)
        if q == "origin_dP_W":
            return abs(b["P_W"] - a["P_W"])
        if q == "origin_off_E_steps":
            return b["E_steps"]
        keys = set(a["fin"]) | set(b["fin"])                 # joined on finisher identity, never index
        return 0.5 * sum(abs(a["fin"].get(k, 0.0) - b["fin"].get(k, 0.0)) for k in keys)
    if q in ("P_W_coin", "origin_dP_W_coin", "gi_minus_nogi_P_W_coin"):
        def coin_pw(k):
            return float(k.start("standing", "coin") @ k.absorption()[0][:, 0])
        if q == "P_W_coin":
            return coin_pw(K)
        if q == "gi_minus_nogi_P_W_coin":            # the frame change at a fair start (`frame` is ignored)
            g_, n_ = (_kernel(fr, args.get("initiative", "shipped"), args.get("rates", "shipped"), args.get("origin", True))
                      for fr in ("gi", "nogi"))
            return coin_pw(g_) - coin_pw(n_)
        Ko = _kernel(args.get("frame", "nogi"), args.get("initiative", "shipped"), args.get("rates", "shipped"), False)
        return coin_pw(Ko) - coin_pw(K)
    if q == "min_absorption_rowsum":
        B, _ = K.absorption()
        return float(B.sum(axis=1).min())
    if q == "origin_dropped_occupancy_share":
        # authored, positive, role-matching attempt points per role-node vs those on cards the Model dealt
        # there (the kernel's own census, per node), weighted by expected plays of each hand per roll from
        # standing, me first: my turn at r plays r's hand; their turn at r plays flip(r)'s hand.
        import numpy as np
        g, fr = K.graph, K.frame
        auth, dropped = {}, {}
        for r, s0 in enumerate(K.role_nodes):
            node = g["positions"][s0]
            here = {x.target for x in K.model.hands[r]}
            a = d = 0.0
            for t in node.get("transitions") or []:
                v = (t.get("attemptProbabilityByRuleset") or {}).get(fr)
                if v is None or v <= 0:
                    continue
                cat = "submissions" if t.get("isSubmission") else "transitions"
                tech = g[cat].get(t["target"] + "/attacker")
                if tech is None or tech.get("fromRole") != node["role"]:
                    continue
                a += v
                d += v if t["target"] not in here else 0.0
            auth[r], dropped[r] = a, d
        vis = K.fundamental().solve(K.start("standing", "me"), "T")
        w = np.zeros(K.n_r)
        for r in range(K.n_r):
            w[r] += vis[r]
            w[int(K.flipidx[r])] += vis[K.n_r + r]
        num = sum(w[r] * dropped[r] for r in range(K.n_r) if auth[r] > 0)
        den = sum(w[r] * auth[r] for r in range(K.n_r) if auth[r] > 0)
        return num / den
    if q == "frame_forked_dealt_techniques":
        g = K.graph
        seen = set()
        for x in K.actions:
            t = g[x["cat"]].get(x["target"] + "/attacker") or {}
            rb = t.get("successRateByRuleset") or {}
            v = rb.get(args.get("frame", "gi"))
            if v is not None and t.get("successRate") is not None and abs(v - t["successRate"]) > 1e-9:
                seen.add(x["target"])
        return len(seen)
    raise KeyError(f"unknown kernel quantity {q!r}")


@recompute("outcome_labels")
def _outcome_labels(args, ctx):
    """Census of outcome-cell LABELS and chained hub cells on the kernel's graph (the §10 fidelity
    findings, which live in no artifact). quantity:
      duplicate_targets        how many listings at `state` deal `target` (the kernel deals every copy)
      chained_cells            /attacker outcome cells whose `to` is a technique hub (a chained finish)
      chained_role_mismatch    of those, cells whose performer (the actor on 'success', the actor's
                               opponent otherwise) does not sit in the chained submission's fromRole
      nonchained_counter_cells 'counter' cells that are NOT chained (to a role-node or game-over)
      relabel_max_abs_change   max |dQ|, |dR| after relabelling those cells 'failure' (frame, default both)"""
    import copy
    sys.path.insert(0, str(REPO / "scripts"))
    from solve_edge_values import _chain_target, is_role
    other = {"top": "bottom", "bottom": "top"}         # a bare seat (solve_edge_values.flip flips a KEY)
    g = ctx.get("graph") or _kernel().graph               # ctx["graph"]: the selfcheck's toy
    q = args["quantity"]
    if q == "duplicate_targets":
        return sum(t["target"] == args["target"] for t in g["positions"][args["state"]]["transitions"])
    chained, counters = [], 0
    for sec in ("transitions", "submissions"):
        for k, n in g[sec].items():
            for o in n.get("outcomes") or []:
                plain = o["to"] == "game-over" or is_role(o["to"])
                counters += plain and o["result"] == "counter"
                if k.endswith("/attacker") and not plain:
                    chained.append((n, o, _chain_target(g, o["to"])))
    if not chained or not counters:
        raise ValueError(f"label census found {len(chained)} chained cells / {counters} counter cells: never looked")
    if q == "chained_cells":
        return len(chained)
    if q == "chained_role_mismatch":
        return sum((n["fromRole"] if o["result"] == "success" else other[n["fromRole"]]) != ch["fromRole"]
                   for n, o, ch in chained)
    if q == "nonchained_counter_cells":
        return counters
    if q == "relabel_max_abs_change":
        from _kernel import load_kernel
        g2 = copy.deepcopy(g)
        n_rel = 0
        for sec in ("transitions", "submissions"):
            for n in g2[sec].values():
                for o in n.get("outcomes") or []:
                    if o["result"] == "counter" and (o["to"] == "game-over" or is_role(o["to"])):
                        o["result"], n_rel = "failure", n_rel + 1
        if n_rel != counters:
            raise ValueError(f"relabelled {n_rel} cells, the census counted {counters}")
        frames = ("nogi", "gi") if args.get("frame", "both") == "both" else (args["frame"],)
        worst = 0.0
        for fr in frames:
            K, K2 = _kernel(fr), load_kernel(fr, "shipped", "shipped", graph=g2)
            worst = max(worst, abs(K2.Q - K.Q).max(), abs(K2.R - K.R).max())
        return worst
    raise KeyError(f"unknown outcome_labels quantity {q!r}")


@recompute("content_outcomes")
def _content_outcomes(args, ctx):
    """Authored outcome cells in content/Transitions and content/Submissions (the {gi,nogi} source,
    which graph.json folds away): total, with a {gi,nogi} map, and forked (gi != nogi)."""
    n = maps = fork = 0
    files = sorted(glob.glob(str(REPO / "content/Transitions/*.json"))
                   + glob.glob(str(REPO / "content/Submissions/**/*.json"), recursive=True))
    for f in files:
        for o in json.loads(Path(f).read_text()).get("outcomes") or []:
            n += 1
            pr = o.get("probability")
            if isinstance(pr, dict):
                maps += 1
                fork += pr.get("gi") != pr.get("nogi")
    if n == 0 or maps == 0:
        raise ValueError(f"content scan found {n} cells / {maps} maps in {len(files)} files: never looked")
    return {"cells": n, "maps": maps, "forked": fork}[args["what"]]


@recompute("app_game")
def _app_game(args, ctx):
    """A pointer into a FRESH `app_game.py --json` run (12 s, once per verification). Needs the emitted
    wire (app_game reads its submission-details): absent, the claim is a named SKIP."""
    if not WIRE.exists():
        raise SkipClaim(f"app_game.py reads the emitted wire, which is absent: {WIRE_FIX}")
    if "app_game" not in ctx:
        tmp = Path(tempfile.mkdtemp(prefix="verify_all_app_"))
        try:
            r = run_one("app_game", ["--json", str(tmp / "app_game.json")], tmp)
            if r["rc"] != 0 or not (tmp / "app_game.json").exists():     # needs only its own output
                raise RuntimeError(f"app_game --json failed (exit {r['rc']}): {r['tail']}")
            ctx["app_game"] = json.loads((tmp / "app_game.json").read_text())
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    vals = [float(pointer_get(ctx["app_game"], p)) for p in (args.get("pointers") or [args["pointer"]])]
    agg = args.get("agg")
    v = (1.0 - sum(vals) if agg == "complement" else vals[0] - vals[1] if agg == "diff"
         else max(abs(x) for x in vals) if agg == "maxabs" else vals[0])
    return v * float(args.get("scale", 1.0))


# --------------------------------------------------------------------------- #
# selfcheck: known answers for every mechanism above (no real gate, no real artifact written)
# --------------------------------------------------------------------------- #
def selfcheck():
    results = []

    def ok(name, cond, detail=""):
        results.append((name, bool(cond)))
        say(f"  [{'OK' if cond else 'FAIL'}] {name}" + (f"  {detail}" if detail else ""))

    for printed, want in (("38.0%", (38.0, 0.05)), ("12,827", (12827, 0.5)), ("−0.49", (-0.49, 0.005)),
                          ("~60%", (60, 1.0)), ("11.2 M", (11.2e6, 0.05e6)), ("½", (0.5, 0.05)), ("seven", (7, 0)),
                          ("about a quarter", (0.25, 0.05)), ("1e-5", (1e-5, 1e-7)), ("+2,921", (2921, 0.5)),
                          ("about one in seven", (1 / 7, 1 / 6.5 - 1 / 7))):
        v, t = parse_printed(printed)
        ok(f"parse_printed({printed!r})", abs(v - want[0]) < 1e-9 * max(1, abs(want[0])) and abs(t - want[1]) < 1e-9 * max(1, want[1]) + 1e-11,
           f"-> {v}, tol {t}")
    doc = {"a/b": {"x~y": [10, 20, {"n": "p", "v": 3}]}, "rows": [{"n": "p", "v": 3, "k": "top"}, {"n": "q", "v": 5, "k": "bottom"}],
           "hubs": {"h1": {"r": {"f": 1.0, "o": {"holds": True}}}, "h2": {"r": {"f": 0.5, "o": {"holds": True}}},
                    "h3": {"r": {"f": 1.0, "o": {"holds": False}}}},
           "seeds": [0, 19], "share": 1.0, "n": 5, "neg": -7}
    ok("pointer_get: '~1' and '~0' escapes", pointer_get(doc, "/a~1b/x~0y/1") == 20)
    ok("pointer_get: '#len'", pointer_get(doc, "/a~1b/x~0y#len") == 3)
    _ART_CACHE["__toy__.json"] = doc
    try:
        ok("select: key lookup, not position", _select({"artifact": "__toy__.json", "pointer": "/rows", "where": [["n", "eq", "q"]], "field": "v"}, {}) == 5)
        try:
            _select({"artifact": "__toy__.json", "pointer": "/rows", "where": [["n", "ne", "zzz"]], "field": "v"}, {})
            ok("select: two matches are an error", False)
        except ValueError:
            ok("select: two matches are an error", True)
        cw = {"artifact": "__toy__.json", "pointer": "/hubs", "where": [["r/f", "ge", 0.95], ["r/o/holds", "eq", True]]}
        ok("count_where over dict values (AND)", _count_where(cw, {}) == 1)
        ok("count_where negate", _count_where({**cw, "negate": True}, {}) == 2)
        v, _w = value_of({"artifact": "__toy__.json", "agg": "range_count", "pointers": ["/seeds"]}, {})
        ok("agg range_count [0, 19] -> 20", v == 20)
        v, _w = value_of({"artifact": "__toy__.json", "agg": "share_times_range", "pointers": ["/share", "/seeds"]}, {})
        ok("agg share_times_range -> 20", v == 20)
        v, _w = value_of({"artifact": "__toy__.json", "pointer": "/a~1b/x~0y/0", "scale": -1, "offset": 100}, {})
        ok("scale and offset", v == 90)
        v, _ = value_of({"artifact": "__toy__.json", "pointers": ["/n", "/neg"], "agg": "maxabs"}, {})
        ok("agg maxabs takes the largest magnitude", v == 7, str(v))
    finally:
        _ART_CACHE.pop("__toy__.json", None)
    # claim evaluation on a toy doc and registry
    tmpd = Path(tempfile.mkdtemp(prefix="verify_all_selfcheck_"))
    try:
        (tmpd / "toy.json").write_text(json.dumps({"x": 0.3804, "n": 22, "q": 3.9e-6, "nmi": 0.95778, "r": 9.61,
                                                   "w": 0.6, "l": 0.29}))
        tdoc = ("38.0% of rolls. It is 22 positions. all q < 1e-5. NMI ≥ 0.958. We print 0.41 here. Gone number 7.7.\n"
                "It moves by exactly 0 here.\n| 12 | after rows 9 and 15 | 342 s |\n"
                "against a roll of\n    9.6 steps. In 60% of the rolls you win and 29% of those you lose.\n"
                "**2.1 Every roll** ends at backside 50-50 (§6.1–6.2).\n10. **The map**\nreproduced to 1e-16 here.\n")
        reg = {"claims": [
            {"id": "m", "section": "t", "quote": "38.0% of rolls", "printed": "38.0%", "source": {"artifact": "toy.json", "pointer": "/x", "scale": 100}},
            {"id": "n", "section": "t", "quote": "22 positions", "printed": "22", "source": {"artifact": "toy.json", "pointer": "/n"}},
            {"id": "b", "section": "t", "quote": "all q < 1e-5", "printed": "1e-5", "relation": "lt", "source": {"artifact": "toy.json", "pointer": "/q"}},
            {"id": "g", "section": "t", "quote": "NMI ≥ 0.958", "printed": "0.958", "relation": "ge", "source": {"artifact": "toy.json", "pointer": "/nmi"}},
            {"id": "x", "section": "t", "quote": "We print 0.41 here", "printed": "0.41", "source": {"artifact": "toy.json", "pointer": "/x"}},
            {"id": "q", "section": "t", "quote": "this sentence is not in the doc 5.5", "printed": "5.5", "source": {"artifact": "toy.json", "pointer": "/x"}},
            {"id": "u", "section": "t", "quote": "Gone number 7.7", "printed": "7.7", "source": {"unbacked": "lives in scratch"}},
            {"id": "k", "section": "t", "quote": "22 positions", "printed": "22", "source": {"artifact": "toy.json", "pointer": "/nope"}},
            {"id": "z", "section": "t", "quote": "by exactly 0 here", "printed": "0", "source": {"artifact": "toy.json", "pointer": "/q"}},
            {"id": "s", "section": "t", "quote": "a roll of\n    9.6", "printed": "9.6", "source": {"artifact": "toy.json", "pointer": "/r"}},
            {"id": "w", "section": "t", "quote": "60% of the rolls you win", "printed": "60%", "source": {"artifact": "toy.json", "pointer": "/w", "scale": 100}},
            {"id": "o", "section": "t", "quote": "win and 29% of those", "printed": "29%", "source": {"artifact": "toy.json", "pointer": "/l", "scale": 100}}],
            "definitions": []}
        (tmpd / "claims.json").write_text(json.dumps(reg))
        (tmpd / "doc.md").write_text(tdoc)
        global ART, CLAIMS, DOC
        saved = (ART, CLAIMS, DOC)
        ART, CLAIMS, DOC = tmpd, tmpd / "claims.json", tmpd / "doc.md"
        _ART_CACHE.clear()
        try:
            rows, unc, _c, _d = check_claims([], None)
        finally:
            ART, CLAIMS, DOC = saved
            _ART_CACHE.clear()
        st = {r["id"]: r["status"].split(" (")[0] for r in rows}
        want = {"m": "MATCH", "n": "MATCH", "b": "MATCH", "g": "MATCH", "x": "MISMATCH", "q": "QUOTE-GONE",
                "u": "UNBACKED", "k": "BROKEN", "z": "MISMATCH", "s": "MATCH", "w": "MATCH", "o": "MATCH"}
        ok("claim statuses: MATCH, bound relations, MISMATCH, QUOTE-GONE, UNBACKED, BROKEN, 'exactly 0' vs 3.9e-6",
           st == want, str(st))
        ok("uncovered numbers: only the unclaimed 342 (a row number, 'rows 9 and 15', a quote across a line break, "
           "two OVERLAPPING quotes, a bold paragraph number, a list marker, '50-50' and '§6.1–6.2' are not flagged; "
           "an unclaimed 1e-16 is)",
           [u["number"] for u in unc] == ["342", "1e-16"], str(unc))
        # hash resolution and staleness: a toy artifact that records graph.json correctly and wrongly
        good = {"source_sha256": {"graph.json": sha(REPO / "graph.json")}, "graph_sha256": sha(REPO / "graph.json"),
                "meta": {"sources": {"x": {"path": "graph.json", "sha256": "0" * 64}}}, "blob": {"layout_sha256": "1" * 64}}
        found = []
        _hashes(good, [], found)
        res = []
        for item in found:
            tgt, _j = resolve_target(item[0], item[2] if len(item) > 2 else {})
            res.append((tgt, (sha(REPO / tgt) == item[1]) if tgt else None))
        ok("hash records: path key, alias, sibling path, uncheckable", sorted(map(str, res)) == sorted(map(str, [
            ("graph.json", True), ("graph.json", True), ("graph.json", False), (None, None)])), str(res))
        # the tree-mutation guard: a toy gate that writes into the watched directory must fail
        gate = tmpd / "toy_gate.py"
        gate.write_text("import sys, pathlib\npathlib.Path(sys.argv[1], 'written.json').write_text('{}')\nprint('PASS toy: 1 checks, 0 failed')\n")
        r = run_one("toy_gate", [str(tmpd)], tmpd, script=gate, watch=tmpd)
        ok("a gate that writes a watched file FAILS, whatever it prints", not r["passed"] and r["mutated"] == ["written.json"], str(r["why"]))
        other = tmpd / "other_writer.py"
        other.write_text("import sys, pathlib, time\npathlib.Path(sys.argv[1], 'by_someone_else.json').write_text('{}')\n")
        gate.write_text("import subprocess, sys\nsubprocess.run([sys.executable, sys.argv[2], sys.argv[1]])\nprint('PASS toy: 1 checks, 0 failed')\n")
        r = run_one("toy_gate", [str(tmpd), str(other)], tmpd, script=gate, watch=tmpd)
        ok("a file changed by ANOTHER process is reported, not charged to the gate",
           r["passed"] and r["changed_by_others"] == ["by_someone_else.json"], str((r["why"], r["changed_by_others"])))
        gate.write_text("print('PASS toy: 3 checks, 0 failed')\n")
        r = run_one("toy_gate", [], tmpd, script=gate, watch=tmpd)
        ok("a clean gate passes, and its count is read", r["passed"] and r["checks"] == 3, str(r["why"]))
        gate.write_text("import sys\nprint('FAIL expected-failure fixture fired (a negative test)')\nprint('PASS toy: 2 checks, 0 failed')\n")
        r = run_one("toy_gate", [], tmpd, script=gate, watch=tmpd)
        ok("a FAIL line from a deliberate negative test is not the verdict", r["passed"], str(r["why"]))
        gate.write_text("import sys\nprint('PASS early')\nprint('FAIL: 1 check failed')\nsys.exit(0)\n")
        r = run_one("toy_gate", [], tmpd, script=gate, watch=tmpd)
        ok("a FAIL in the closing summary fails even at exit 0", not r["passed"], str(r["why"]))
        gate.write_text("print('PASS atlas selfcheck')\nprint('[atlas] 43 differentials, 22502 comparisons, 0 FAILED')\n")
        r0 = run_one("toy_gate", [], tmpd, script=gate, watch=tmpd)
        gate.write_text("print('PASS early')\nprint('[x] 10 FAILED')\n")
        r10 = run_one("toy_gate", [], tmpd, script=gate, watch=tmpd)
        ok("'0 FAILED' closing a run is a pass; '10 FAILED' is not", r0["passed"] and not r10["passed"],
           f"{r0['why']} | {r10['why']}")
        gate.write_text("import sys\nprint('PASS toy')\nsys.exit(3)\n")
        r = run_one("toy_gate", [], tmpd, script=gate, watch=tmpd)
        ok("a non-zero exit fails", not r["passed"], str(r["why"]))
    finally:
        shutil.rmtree(tmpd, ignore_errors=True)
    tmpc = Path(tempfile.mkdtemp(prefix="verify_all_cmp_"))
    try:
        saved_art = ART
        globals()["ART"] = tmpc
        (tmpc / "c.json").write_text('{"meta": {"recompute": "x.py --json tests/artifacts/semantics/c.json"}, "v": 1}')
        (tmpc / "out").mkdir()
        (tmpc / "out/c.json").write_text('{"meta": {"recompute": "x.py --json %s"}, "v": 1}' % (tmpc / "out/c.json"))
        same = compare_json(tmpc / "out/c.json", "c.json")["status"]
        (tmpc / "out/c.json").write_text('{"meta": {"recompute": "x.py --json %s"}, "v": 2}' % (tmpc / "out/c.json"))
        diff = compare_json(tmpc / "out/c.json", "c.json")
        (tmpc / "h.json").write_text('{"sources_sha256": {"a.py": "' + "0" * 64 + '"}, "v": 1}')
        (tmpc / "out/h.json").write_text('{"sources_sha256": {"a.py": "' + "1" * 64 + '"}, "v": 1}')
        hashes_only = compare_json(tmpc / "out/h.json", "h.json")["status"]
    finally:
        globals()["ART"] = saved_art
        shutil.rmtree(tmpc, ignore_errors=True)
    ok("regeneration: the producer's own temp output path is not a difference; a value is; a hash-only "
       "difference is SAME NUMBERS", same.startswith("IDENTICAL") and diff["status"] == "DIFFERS"
       and diff["first"][0].startswith("/v") and hashes_only.startswith("SAME NUMBERS"), f"{same}; {diff}; {hashes_only}")
    ok("producer: a nested meta.recompute names the script", producer_of("x.json", {"meta": {"recompute": "python3 -B scripts/semantics/atlas.py"}}) == "scripts/semantics/atlas.py")
    # synthetic receipts: only a DECLARATION plus a fresh producer hash passes as FRESH-SYNTHETIC
    tmps = Path(tempfile.mkdtemp(prefix="verify_all_synth_"))
    try:
        me = {"scripts/semantics/verify_all.py": sha(HERE / "verify_all.py")}
        rc = "python3 -B scripts/semantics/verify_all.py --selfcheck"
        receipts = {
            "a_graph_none.json": {"graph": "none (synthetic)", "recompute": rc, "source_sha256": me},
            "b_scope.json": {"scope": "synthetic chains only; no corpus/kernel reads", "recompute": rc, "source_sha256": me},
            "c_neither.json": {"recompute": rc, "checks": 3},
            "d_declared_unhashed.json": {"graph": "none (synthetic)", "recompute": rc},
            "e_hash_only.json": {"recompute": rc, "source_sha256": me},
            "f_declared_stale.json": {"graph": "none (synthetic)", "recompute": rc,
                                      "source_sha256": {"scripts/semantics/verify_all.py": "0" * 64}}}
        for name, body in receipts.items():
            (tmps / name).write_text(json.dumps(body))
        saved_art = ART
        globals()["ART"] = tmps
        try:
            grade = {r["artifact"]: r["verdict"].split(" (")[0] for r in staleness()}
        finally:
            globals()["ART"] = saved_art
    finally:
        shutil.rmtree(tmps, ignore_errors=True)
    want = {"a_graph_none.json": "FRESH-SYNTHETIC", "b_scope.json": "FRESH-SYNTHETIC", "c_neither.json": "UNHASHED",
            "d_declared_unhashed.json": "UNHASHED", "e_hash_only.json": "FRESH-PARTIAL", "f_declared_stale.json": "STALE"}
    ok("synthetic receipts: declared + producer hash is FRESH-SYNTHETIC; neither declaration nor hash is "
       "UNHASHED (fails); a declaration alone does not pass; a hash alone is FRESH-PARTIAL; stale is STALE",
       grade == want, str(grade))
    good = [{"id": "a", "status": "MATCH"}, {"id": "b", "status": "UNBACKED (run-cost)", "category": "run-cost"}]
    ok("claims completeness: MATCH + a categorised UNBACKED pass; an uncategorised UNBACKED, an unknown "
       "category or an unregistered number fails",
       claims_failures(good, []) == []
       and claims_failures(good + [{"id": "c", "status": "UNBACKED (uncategorised)", "category": None}], [])
       and claims_failures(good + [{"id": "d", "status": "UNBACKED (lead-scratch)", "category": "lead-scratch"}], [])
       and claims_failures(good, [{"line": 7, "number": "0.42", "text": "x"}]))
    ok("producer: unknown artifact is UNKNOWN, never assumed", producer_of("new.json", {}) == "UNKNOWN")
    try:
        parse_printed("about lots")
        ok("parse_printed refuses a non-number", False)
    except ValueError:
        ok("parse_printed refuses a non-number", True)
    global WIRE
    saved_wire = WIRE
    WIRE = Path(tempfile.gettempdir()) / "verify_all_no_such_wire.json"
    try:
        env = env_status()
        ok("absent wire is NAMED in the environment report", any("emitted wire" in r for r in env["reasons"]), str(env["reasons"]))
        try:
            _app_game({"pointer": "/x"}, {})
            ok("a recompute needing the absent wire is a SkipClaim, never a value", False)
        except SkipClaim:
            ok("a recompute needing the absent wire is a SkipClaim, never a value", True)
    finally:
        WIRE = saved_wire
    toy = {"positions": {"a/top": {"transitions": [{"target": "x"}, {"target": "x"}, {"target": "y"}]}},
           "transitions": {"x/attacker": {"fromRole": "top", "outcomes": [
               {"to": "s", "result": "counter"}, {"to": "a/bottom", "result": "counter"}]},
               "y/attacker": {"fromRole": "bottom", "outcomes": [{"to": "s2", "result": "counter"},
                                                                 {"to": "s", "result": "counter"}]}},
           "submissions": {"s/attacker": {"fromRole": "top", "outcomes": [{"to": "game-over", "result": "success"}]},
                           "s2/attacker": {"fromRole": "bottom", "outcomes": [{"to": "game-over", "result": "success"}]}}}
    # seat rule: x->s and y->s2 mismatch, y->s does not (2); performer = the actor would give 1
    got = [_outcome_labels({"quantity": q, "state": "a/top", "target": "x"}, {"graph": toy}) for q in
           ("duplicate_targets", "chained_cells", "chained_role_mismatch", "nonchained_counter_cells")]
    ok("outcome_labels: duplicates, chained cells, seat rule (a counter's performer is the actor's opponent), "
       "non-chained counters", got == [2, 3, 2, 1], str(got))
    ok("'exactly <printed>' is detected (emphasis allowed), a bare 0 is not",
       [exact_in(q, pr) for q, pr in (("by exactly 0 from", "0"), ("**exactly ½** as", "½"), ("0 of 4,110", "0"))]
       == [True, True, False])
    ok("discovery finds every required gate", not [g for g in REQUIRED_GATES if g not in discover()], str(discover()))
    n_bad = sum(1 for _n, good in results if not good)
    say(f"  {len(results)} checks, {n_bad} failed (floor 30)")
    return 0 if n_bad == 0 and len(results) >= 30 else 1


# --------------------------------------------------------------------------- #
# report
# --------------------------------------------------------------------------- #
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--heavy", action="store_true", help="also the full lane runs, each through the heavy advisory")
    ap.add_argument("--no-gates", action="store_true")
    ap.add_argument("--gate", action="append", help="run only these gates (debugging; disables the floor)")
    ap.add_argument("--allow-unhashed", action="store_true", help="report UNHASHED artifacts without failing")
    ap.add_argument("--json", help="write the full report here")
    ap.add_argument("--selfcheck", action="store_true", help="known-answer toys for every mechanism here")
    a = ap.parse_args(argv)
    if a.selfcheck:
        return selfcheck()
    t0 = time.monotonic()
    report, fail, incomplete = {"command": COMMAND}, [], []
    env = env_status()
    report["environment"] = {"node": env["node"], "emitted_wire": env["wire"], "missing": env["reasons"]}
    for reason in env["reasons"]:
        say(f"== ENVIRONMENT: {reason} -> every check that needs it is a named SKIP, and the verdict is at best INCOMPLETE")
    if not a.no_gates:
        say("== GATES (discovered, cheap)")
        g = run_gates(a.gate)
        report["gates"] = g
        if g["required_missing"]:
            fail.append(f"required gates not discovered: {g['required_missing']}")
        bad = [r["gate"] for r in g["rows"] if not r["passed"] and not r.get("skipped")]
        if bad:
            fail.append(f"gates failed: {bad}")
        for gate, why in g["skipped"]:
            incomplete.append(f"gate {gate} SKIPPED: {why}")
        if g["gates_ran_and_passed"] < g["floor"]:
            fail.append(f"only {g['gates_ran_and_passed']} gates ran and passed (floor {g['floor']})")
        say(f"  -> {g['gates_ran_and_passed']} of {len(g['discovered'])} discovered gates ran and passed "
            f"(floor {g['floor']}); required missing: {g['required_missing'] or 'none'}")
        for r in g["regenerated"]:
            say(f"  regenerated {r['artifact']:24s} {r['status']}" + (f" ({r.get('differing_leaves')} leaves, "
                f"e.g. {r.get('first', [])[:2]})" if r["status"] == "DIFFERS" else ""))
            if r["status"].startswith("DIFFERS") or r["status"] == "NOT PRODUCED":
                fail.append(f"regenerated {r['artifact']} {r['status']}")
            if r["status"].startswith("SKIPPED"):
                incomplete.append(f"regeneration of {r['artifact']} {r['status']}")
    if a.heavy:
        say("== HEAVY (full lane runs, via the heavy advisory)")
        report["heavy"] = run_heavy()
        for r in report["heavy"]:
            if r["status"] in ("SKIPPED",) or r["status"].startswith("DEFERRED"):
                incomplete.append(f"heavy {r['run']}: {r['status']} ({r.get('reason') or r.get('advisory', '')})")
                continue
            if r["status"] != "PASS" or r.get("regenerated", {}).get("status", "IDENTICAL").startswith("DIFFERS"):
                fail.append(f"heavy {r['run']}: {r['status']} {r.get('regenerated', {}).get('status', '')}")
    say("== STALENESS (every recorded source hash, recomputed)")
    st = staleness()
    report["staleness"] = st
    for r in st:
        n_ok = sum(1 for x in r.get("records", []) if x["status"] == "OK")
        n_st = [x for x in r.get("records", []) if x["status"] == "STALE"]
        n_un = sum(1 for x in r.get("records", []) if x["status"].startswith("UNCHECKABLE"))
        say(f"  {r['artifact']:28s} {r['verdict']:48s} ok={n_ok} stale={len(n_st)} uncheckable={n_un}"
            + (f"  stale: {[(x['file'], x['at']) for x in n_st][:3]}" if n_st else ""))
        if r["verdict"] == "STALE":
            fail.append(f"STALE {r['artifact']}")
        if r["verdict"] == "UNHASHED" and not a.allow_unhashed:
            fail.append(f"UNHASHED {r['artifact']}")
    if CLAIMS.exists():
        say("== CLAIMS (docs/GraphSemantics.md vs the artifacts)")
        rows, uncovered, csha, dsha = check_claims(st, report.get("gates"))
        report["claims"] = {"rows": rows, "uncovered_numbers": uncovered, "claims_sha256": csha, "doc_sha256": dsha}
        by = {}
        for r in rows:
            by.setdefault(r["status"].split(" (")[0], []).append(r)
        for r in rows:
            if not r["status"].startswith("MATCH"):
                say(f"  {r['id']:28s} §{r['section']:5s} printed {r['printed']:>10s}  {r['status']}"
                    + (f"  value {r['value']:.6g} at {r.get('where')}" if "value" in r else "")
                    + (f"  ({r['reason']})" if r.get("reason") else ""))
        cats = {}
        for r in by.get("UNBACKED", []):
            cats[r.get("category") or "uncategorised"] = cats.get(r.get("category") or "uncategorised", 0) + 1
        say(f"  -> {len(rows)} claims: " + ", ".join(f"{k} {len(v)}" for k, v in sorted(by.items()))
            + (f" (UNBACKED by category: {dict(sorted(cats.items()))})" if cats else "")
            + f"; doc numbers not covered by any claim or definition: {len(uncovered)}")
        for u in uncovered[:40]:
            say(f"  UNREGISTERED line {u['line']}: {u['number']!r} in {u['text']!r}")
        fail += claims_failures(rows, uncovered)
        if by.get("SKIPPED"):
            incomplete.append(f"{len(by['SKIPPED'])} claims SKIPPED (their recompute needs gates, node or the emitted wire)")
    else:
        fail.append(f"no claims registry at {CLAIMS.relative_to(REPO)}")
    report["seconds"] = round(time.monotonic() - t0, 1)
    report["verdict"] = "FAIL" if fail else ("INCOMPLETE" if incomplete else "PASS")
    report["failures"], report["incomplete"] = fail, incomplete
    say(f"== VERDICT {report['verdict']} in {report['seconds']}s"
        + ("" if not fail else ":\n   - " + "\n   - ".join(fail))
        + ("" if not incomplete else "\n   INCOMPLETE (named, never a pass):\n   - " + "\n   - ".join(incomplete)))
    if a.json:
        for r in (report.get("gates") or {}).get("rows", []):
            r.pop("_out", None)
        Path(a.json).write_text(json.dumps(report, indent=1, sort_keys=True, default=str) + "\n")
    return 1 if fail else (2 if incomplete else 0)


if __name__ == "__main__":
    sys.exit(main())
