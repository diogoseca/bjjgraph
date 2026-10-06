#!/usr/bin/env bash
# REPLAY ci-validate.yml BEFORE YOU PUSH (`npm run ci:validate`).
#
# Reads .github/workflows/ci-validate.yml at run time and runs its `run:` steps in their order, with
# each step's `working-directory` and `env`, under the shell GitHub uses (bash -eo pipefail). The
# step list is never copied here, so a step added to the workflow is replayed the day it lands —
# a hand-picked local gate list silently runs a subset of CI.
#
# Three steps cannot run as written on a seat, and each is SUBSTITUTED, out loud:
#   · `pip install …`  — would change this machine's Python. Replaced by an import check of the same
#     packages: absent is a failure that names them, never a skip.
#   · `npm ci` / `npm install` — would DELETE and reinstall node_modules, which in a worktree is a
#     symlink into the shared deps donor: every other worktree would go red at once. Replaced by a
#     check that every dependency in that directory's package.json resolves.
#   · `--baseline-ref HEAD^1` — on CI's merge ref HEAD^1 is the base branch tip; on a branch it is
#     your previous commit. Replaced by the merge-base with origin/dev (override: CI_LOCAL_BASE).
# `uses:` steps (checkout, setup-python, setup-node) are reported, with the versions CI asks for
# beside the local ones. CI=true is set for every step, as GitHub does: tests/_deps_promised.mjs
# then FAILS on an absent promised module instead of skipping it. The environment is otherwise this
# machine's: CI installs only the workflow's pip packages (no numpy, no scipy), so to match its
# Python exactly, put a shim that hides those on PYTHONPATH first, as the seats do for test:units.
#
# A step this script cannot interpret (a step `if:`, a non-bash `shell:`) fails closed, by name.
# It stops at the first red step, as GitHub does; --keep-going runs them all and summarises.
# Usage: scripts/ci-local.sh [--list] [--keep-going] [--only <substring of a step name>]
# Exit 0 only if every replayed step passed and at least one ran (a parse that found nothing to run
# is a failure, never a clean pass).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 2
exec python3 - "$@" <<'PY'
import os, re, subprocess, sys, time, json, importlib.util
from pathlib import Path

WF = Path(os.environ.get("CI_LOCAL_WORKFLOW") or ".github/workflows/ci-validate.yml")   # override: tests
args = sys.argv[1:]
LIST = "--list" in args
KEEP = "--keep-going" in args
ONLY = args[args.index("--only") + 1] if "--only" in args else None
try:
    import yaml
except ImportError:
    sys.exit("ci-local: PyYAML is required to read the workflow (python3 -m pip install PyYAML)")

wf = yaml.safe_load(WF.read_text())
jobs = wf.get("jobs") or {}
# pip package name -> import name, for the packages ci-validate installs
IMPORT_NAME = {"pyyaml": "yaml"}

def base_ref():
    if os.environ.get("CI_LOCAL_BASE"):
        return os.environ["CI_LOCAL_BASE"]
    r = subprocess.run(["git", "merge-base", "HEAD", "origin/dev"], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("ci-local: no merge-base with origin/dev (fetch it, or set CI_LOCAL_BASE)")
    return r.stdout.strip()

def plan():
    out = []
    for jname, job in jobs.items():
        for i, st in enumerate(job.get("steps") or []):
            name = st.get("name") or st.get("uses") or f"step {i + 1}"
            if "if" in st:
                out.append(dict(job=jname, name=name, kind="unsupported", why="a step `if:`"))
                continue
            if "uses" in st:
                out.append(dict(job=jname, name=name, kind="uses", uses=st["uses"], with_=st.get("with") or {}))
                continue
            run = st.get("run")
            if run is None:
                continue
            shell = st.get("shell", "bash")
            if shell != "bash":
                out.append(dict(job=jname, name=name, kind="unsupported", why=f"shell {shell!r}"))
                continue
            wd = st.get("working-directory") or job.get("defaults", {}).get("run", {}).get("working-directory") or "."
            env = {k: str(v) for k, v in (st.get("env") or {}).items()}
            s = run.strip()
            m = re.match(r"^(?:pip3?|python3? -m pip) install\s+(.+)$", s)
            if m and "\n" not in s:
                pkgs = [p for p in m.group(1).split() if not p.startswith("-")]
                out.append(dict(job=jname, name=name, kind="pip", pkgs=pkgs))
                continue
            if re.match(r"^npm (ci|install)\b", s) and "\n" not in s:
                out.append(dict(job=jname, name=name, kind="npm", wd=wd))
                continue
            note = None
            if "--baseline-ref HEAD^1" in run:
                ref = base_ref()
                run = run.replace("--baseline-ref HEAD^1", f"--baseline-ref {ref}")
                note = f"--baseline-ref HEAD^1 -> {ref[:9]} (merge-base with origin/dev)"
            out.append(dict(job=jname, name=name, kind="run", run=run, wd=wd, env=env, note=note,
                            cont=bool(st.get("continue-on-error"))))
    return out

steps = plan()
runnable = [s for s in steps if s["kind"] in ("run", "pip", "npm", "unsupported")]   # unsupported fails closed below
if ONLY:
    steps = [s for s in steps if ONLY.lower() in s["name"].lower()]
print(f"ci-local: {WF} — {len(steps)} steps, {sum(s['kind'] == 'run' for s in steps)} run as written, "
      f"{sum(s['kind'] in ('pip', 'npm') for s in steps)} substituted, {sum(s['kind'] == 'uses' for s in steps)} actions")
if not runnable:
    sys.exit("ci-local: FAILED — the workflow parsed to zero runnable steps (has its shape changed?)")

if LIST:
    for i, s in enumerate(steps, 1):
        extra = {"run": s.get("note") or "", "pip": "import check: " + " ".join(s.get("pkgs", [])),
                 "npm": f"resolve check in {s.get('wd')}", "uses": s.get("uses", ""),
                 "unsupported": s.get("why", "")}[s["kind"]]
        print(f"  {i:2d}. [{s['kind']}] {s['name']}" + (f"  — {extra}" if extra else ""))
    sys.exit(0)

def check_pip(pkgs):
    missing = [p for p in pkgs if importlib.util.find_spec(IMPORT_NAME.get(p.lower(), p.lower())) is None]
    return (not missing, f"imports {', '.join(pkgs)}" + (f" — MISSING: {', '.join(missing)}" if missing else ""))

def check_npm(wd):
    d = Path(wd)
    pj = json.loads((d / "package.json").read_text())
    deps = {**pj.get("dependencies", {}), **pj.get("devDependencies", {})}
    nm = d / "node_modules"
    if not nm.exists():
        return False, f"{nm} does not exist (provision it; never `npm ci` into a shared donor)"
    missing = [k for k in deps if not (nm / k / "package.json").exists()]
    return (not missing, f"{len(deps) - len(missing)} of {len(deps)} dependencies resolve in {nm}"
            + (f" — MISSING: {', '.join(missing[:8])}" if missing else ""))

env0 = dict(os.environ, CI="true")
results = []
for i, s in enumerate(steps, 1):
    t0 = time.time()
    head = f"[{i}/{len(steps)}] {s['name']}"
    if s["kind"] == "uses":
        w = s["with_"]
        want = w.get("python-version") or w.get("node-version")
        have = ""
        if "setup-python" in s["uses"]:
            have = "local " + sys.version.split()[0]
        elif "setup-node" in s["uses"]:
            have = "local " + subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip()
        print(f"{head}: action {s['uses'].split('@')[0]}" + (f" (CI asks {want}; {have})" if want else ""))
        continue
    if s["kind"] == "unsupported":
        print(f"{head}: FAILED — cannot replay {s['why']}; extend scripts/ci-local.sh rather than skip it")
        results.append((s["name"], False)); break
    if s["kind"] == "pip":
        ok, msg = check_pip(s["pkgs"])
        print(f"{head}: SUBSTITUTED pip install -> {msg}")
    elif s["kind"] == "npm":
        ok, msg = check_npm(s["wd"])
        print(f"{head}: SUBSTITUTED npm ci -> {msg}")
    else:
        if s["note"]:
            print(f"{head}: substitution {s['note']}")
        print(f"{head}: running (cwd {s['wd']})", flush=True)
        r = subprocess.run(["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", s["run"]],
                           cwd=s["wd"], env={**env0, **s["env"]})
        ok = r.returncode == 0 or s["cont"]
        msg = f"exit {r.returncode}"
    print(f"{head}: {'ok' if ok else 'FAILED'} ({msg}, {time.time() - t0:.1f}s)", flush=True)
    results.append((s["name"], ok))
    if not ok and not KEEP:
        break

ran = len(results)
bad = [n for n, ok in results if not ok]
print(f"ci-local: {ran} replayed, {ran - len(bad)} passed, {len(bad)} failed"
      + (f" — first red: {bad[0]}" if bad else "") + (f"; {len(runnable) - ran} not reached" if ran < len(runnable) and not ONLY else ""))
sys.exit(1 if bad or ran == 0 else 0)
PY
