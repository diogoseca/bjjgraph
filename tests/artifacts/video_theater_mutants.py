#!/usr/bin/env python3
"""VIDEO1: exact-source controls, locked builds and unlocked focused journeys.

Set TMPDIR, PW_PORT and BUILD_WAIT=1; --output must be programme scratch.
Every selected mutant needs a passing baseline and an unaffected passing case.
Only its named assertion counts as a kill, never a setup error or timeout.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PROGRAMME = Path("/home/user/bjj-orchestrator")


def rows(suites):
    for suite in suites:
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                yield spec["title"], test["results"][-1]
        yield from rows(suite.get("suites", []))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--only", default="")
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(PROGRAMME / "scratch"):
        parser.error("Use the programme scratch directory")
    if not os.environ.get("PW_PORT") or not os.environ.get("TMPDIR"):
        parser.error("Set TMPDIR and a verified-free private PW_PORT")
    output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(Path(__file__).with_suffix(".json").read_text())
    mutants = [m for m in manifest["mutants"] if not args.only or re.search(args.only, m["name"])]
    assert mutants, "No mutants selected"
    originals = {m["file"]: (ROOT / m["file"]).read_bytes() for m in mutants}
    hashes = {name: hashlib.sha256(data).hexdigest() for name, data in originals.items()}
    (output / "source-hashes.json").write_text(json.dumps(hashes, indent=2) + "\n")

    def restore():
        for name, data in originals.items():
            (ROOT / name).write_bytes(data)
            assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == hashes[name]

    def build(label):
        with (output / (label + "-build.log")).open("w") as log:
            subprocess.run(["bash", "-c", 'source "$1" video "$2" && npm run dev:neural:app',
                "video-build", str(PROGRAMME / "quartz/acquire-build-lock.sh"), label],
                cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)

    def run(label, pattern):
        subprocess.run(["bash", str(PROGRAMME / "quartz/heavy-advisory.sh"), "1200", label], cwd=ROOT, check=True)
        with (output / (label + ".json")).open("w") as out, (output / (label + "-stderr.log")).open("w") as err:
            result = subprocess.run(["node", "node_modules/@playwright/test/cli.js", "test", "-c", "e2e/playwright.private.config.ts",
                manifest["spec"], "--workers=1", "--timeout=30000", "--reporter=json", "--grep", pattern],
                cwd=ROOT, stdout=out, stderr=err)
        data = json.loads((output / (label + ".json")).read_text())
        assert not data.get("errors"), data.get("errors")
        observed = list(rows(data["suites"]))
        assert observed and all(r["status"] in ("passed", "failed") for _, r in observed), observed
        return result.returncode, observed

    results = []
    try:
        build("baseline")
        pattern = "|".join({m["test"] for m in mutants} | {m.get("control", manifest["control"]) for m in mutants})
        code, baseline = run("baseline", pattern)
        assert code == 0 and all(r["status"] == "passed" for _, r in baseline), baseline
        for m in mutants:
            restore()
            source = originals[m["file"]].decode()
            assert source.count(m["old"]) == m.get("count", 1), (m["name"], "source anchor count")
            (ROOT / m["file"]).write_text(source.replace(m["old"], m["new"]))
            build(m["name"])
            control = m.get("control", manifest["control"])
            code, observed = run(m["name"], m["test"] + "|" + control)
            red = [(t, r) for t, r in observed if re.search(m["test"], t)]
            green = [(t, r) for t, r in observed if re.search(control, t)]
            assert code != 0 and red and all(r["status"] == "failed" for _, r in red), (m["name"], "not killed", observed)
            for title, result in red:
                errors = "\n".join(e.get("message", "") for e in result.get("errors", []))
                assert m["assertion"] in errors, (m["name"], "wrong assertion", errors)
                assert "Test timeout of" not in errors, (m["name"], "setup timeout", errors)
            assert green and all(r["status"] == "passed" for _, r in green), (m["name"], "control failed", observed)
            results.append({"mutant": m["name"], "assertion": m["assertion"], "failed": [t for t, _ in red], "passed": [t for t, _ in green]})
            print(m["name"] + ": killed at named assertion; unaffected control passed", flush=True)
    finally:
        restore()
        build("restored")
        (output / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    print(str(len(results)) + " mutants killed; exact source and healthy bundle restored", flush=True)


if __name__ == "__main__":
    main()
