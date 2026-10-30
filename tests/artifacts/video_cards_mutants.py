#!/usr/bin/env python3
"""Discriminating red proofs for video cards and shared grading credit.

Run under the programme build lock, with TMPDIR and a verified-free PW_PORT.
The output directory must be outside /tmp. Every source anchor is counted;
every restore verifies the exact pre-run bytes, including uncommitted edits.
Mutations change source and rebuild the served bundle before each browser run.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
APP = "neural/src/app.src.jsx"
CSS = "neural/src/choice-value.css"
VIDEO = "e2e/journeys/video-cards.spec.ts"
MC = "e2e/journeys/mc-flashcards.spec.ts"
WATCH = r"only the play circle.*1440px"
PEEK = r"current card:.*1440px"
DRAG = r"dragging the hand across a card"
# Front/play mutations do not depend on the current reel's placement. A real
# drag through the same hand is their unaffected control while sections integrates.
MUTANTS = [
    ("poster_margin", CSS, "margin:0; border-radius:0; object-position:center;",
     "margin:16px 0; border-radius:0; object-position:center;",
     VIDEO, r"U8 posters.*1440px", WATCH),
    ("poster_track", CSS, "grid-template: minmax(0,1fr) / minmax(0,1fr);", "",
     VIDEO, r"U8 posters.*1440px", WATCH),
    ("win_alignment", CSS, "text-align:right;", "text-align:left;",
     VIDEO, r"U8 posters.*1440px", WATCH),
    ("front_required", APP, "return clip?.front === true ? clip : null;", "return clip || null;",
     VIDEO, r"an none front", DRAG),
    ("own_role", APP, "info.perspectives?.[target.role]", "info.perspectives?.[target.role === 'attacker' ? 'defender' : 'attacker']",
     VIDEO, r"an opposite front", DRAG),
    ("curated_order", APP, "const clip = block?.clips?.[0];", "const clip = block?.clips?.slice().sort((a,b) => (a.duration || 0) - (b.duration || 0))[0];",
     VIDEO, WATCH, DRAG),
    ("watch_commits", APP, "e.stopPropagation(); this._openChoiceWatch(clip, target, watch);", "e.stopPropagation(); this.activateOption(job.card._choiceOpt, this._optPick, job.card); this._openChoiceWatch(clip, target, watch);",
     VIDEO, WATCH, DRAG),
    ("autoplay", APP, "playerVars: { autoplay: theater ? 1 : 0, controls: 1,", "playerVars: { autoplay: 1, controls: 1,",
     VIDEO, WATCH, DRAG),
    ("shortcut_is_odds", APP, "num && num <= 9 && this.get(\"cardNumbers\", true) ? num : ''", "'58'",
     VIDEO, WATCH, DRAG),
    ("face_dead_zone", APP, 'card.addEventListener("click", () => this.activateOption(opt, onPick, card));',
     'card.addEventListener("click", e => { if (e.target.closest(".ng-choice-media,.ngcv-card")) return; this.activateOption(opt, onPick, card); });',
     VIDEO, r"clicking the (poster|statistics) outside Play", WATCH),
    ("wide_peek", CSS, "calc(90.9090909% - 7.272727px)", "calc(60% - 8px)",
     VIDEO, PEEK, WATCH),
    ("close_tabstop", APP, 'dialog.querySelector("[data-watch-close]").focus();',
     'dialog.querySelector("[data-watch-close]").tabIndex = -1; dialog.querySelector("[data-watch-close]").focus();',
     VIDEO, r"keyboard can leave cross-origin", WATCH),
    ("viewer_focus_wrap", APP, 'if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;',
     'if (true) return;', VIDEO, r"keyboard can leave cross-origin", WATCH),
    ("mc_double_credit", APP, "const stage = result.effects.stage;", "this.prep[key] = (this.prep[key] || 0) + 1; const stage = result.effects.stage;",
     MC, r"correct answer: full credit", r"wrong answer: no credit"),
]


def rows(suites):
    for suite in suites:
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                yield spec["title"], test["results"][-1]["status"]
        yield from rows(suite.get("suites", []))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--only", default="")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.is_relative_to(Path("/tmp")):
        parser.error("Use the programme scratch directory, never /tmp")
    if not os.environ.get("PW_PORT") or not os.environ.get("TMPDIR"):
        parser.error("Set TMPDIR and a verified-free private PW_PORT")
    output.mkdir(parents=True, exist_ok=True)
    originals = {name: (ROOT / name).read_bytes() for name in (APP, CSS)}
    hashes = {name: hashlib.sha256(data).hexdigest() for name, data in originals.items()}
    (output / "source-hashes.json").write_text(json.dumps(hashes, indent=2) + "\n")

    def restore():
        for name, data in originals.items():
            (ROOT / name).write_bytes(data)
            assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == hashes[name], name

    def build(label):
        with (output / (label + "-build.log")).open("w") as log:
            subprocess.run(["npm", "run", "dev:neural:app"], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)

    def run(label, file, pattern):
        report = output / (label + ".json")
        with report.open("w") as out, (output / (label + "-stderr.log")).open("w") as err:
            result = subprocess.run(["npx", "playwright", "test", "-c", "e2e/playwright.private.config.ts", file,
                "--workers=1", "--timeout=30000", "--reporter=json", "--grep", pattern], cwd=ROOT, stdout=out, stderr=err)
        data = json.loads(report.read_text())
        assert not data.get("errors"), data.get("errors")
        return result.returncode, list(rows(data["suites"]))

    results = []
    try:
        build("control")
        for name, file, old, new, spec, red, green in MUTANTS:
            if args.only and not re.search(args.only, name):
                continue
            restore()
            code, before = run(name + "-control", spec, red + "|" + green)
            assert code == 0 and before and all(s == "passed" for _, s in before), (name, "control", before)
            source = originals[file].decode()
            count = source.count(old)
            assert count == (2 if name in ("wide_peek", "win_alignment") else 1), (name, "anchor", count)
            (ROOT / file).write_text(source.replace(old, new))
            build(name)
            code, observed = run(name, spec, red + "|" + green)
            reds = [(t, s) for t, s in observed if re.search(red, t)]
            greens = [(t, s) for t, s in observed if re.search(green, t)]
            assert code != 0 and reds and all(s == "failed" for _, s in reds), (name, "expected failure", observed)
            assert greens and all(s == "passed" for _, s in greens), (name, "unaffected control", observed)
            results.append({"mutant": name, "failed": reds, "passed": greens})
            print(name + ": killed; independent control passed", flush=True)
            restore()
            build("restored-" + name)
    finally:
        restore()
        build("restored")
        (output / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    assert results, "No mutants selected"
    print(str(len(results)) + " mutants killed; source and healthy bundle restored")


if __name__ == "__main__":
    main()
