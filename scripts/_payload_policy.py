#!/usr/bin/env python3
"""The three-band payload policy — target · action · delta cap.

WHY THIS REPLACED A SINGLE HARD CEILING (owner's call, v1.189.0), in his words:

    "wrt ceiling, it's a soft ceiling, moore an indication so let's add another rule like,
     target is <300k, but we take action when it reaches >400k otherwise, small additions
     are ok as functionality improves right? i think that's a great way to go about things
     long term since the app will inevitably add more features and progress, but we want to
     avoid bloating too much makes sense?"

A single hard ceiling on a payload that legitimately grows has one behaviour and it is the
wrong one: it goes red on the commit that happens to cross it, whoever that is, and the only
way through is to raise the ceiling. The record of that is in tests/artifacts/budget_neural.json,
whose `raising_a_ceiling` note is now three full post-mortems long — two of them raises of
~1,000 bytes that each cost a CI round trip and, in v1.175.1, SKIPPED THE DEPLOY (a red curated
gate skips the deploy step, so it presents as a stale preview rather than as a failing test).

So: growth is allowed, a cliff is not.

    band                              behaviour
    ------------------------------    ---------------------------------------------------
    value <= target                   silent pass
    target < value <= action          WARN — prints the figure, the target and the delta.
                                      Never fails. It is an indication, not a gate.
    value > action                    HARD FAIL
    delta > delta_cap                 HARD FAIL, whatever the absolute figure

THE DELTA CAP IS THE PART THAT DOES THE WORK. A flat "act at 400k" lets one commit add 70,000
bytes and pass in silence — precisely the fat-wire regression the ceiling was built to catch
(check_payload_budget.py records it was ratcheted DOWN in v1.107.1 to make "a return of the fat
wire (or any new eager payload of that class) a hard red"). The two bands say where you are;
the delta cap says how fast you got there.

WHAT THE DELTA IS MEASURED AGAINST, and why it is not "the previous commit". Nothing in CI or
in a local build can measure a previous ref without rebuilding it (~11 min), so the baseline is
STATE: the last measurement somebody ACCEPTED, committed in tests/artifacts/payload_policy.json
with a reason. The cap therefore reads "growth since the last accepted checkpoint", not "growth
in this commit" — a weaker claim, and the honest one. Two consequences worth knowing before you
are surprised by them:

  · Growth accumulates. Three innocent +2,000 ships against a 5,000 cap turn the THIRD one red
    even though it added 2,000. That is the policy working: it is asking for a checkpoint every
    ~5,000 bytes of drift, not accusing the third author of anything. Read the figure the gate
    prints, decide the growth is fine, and accept it:
        python3 scripts/check_payload_budget.py --accept-baseline <metric> --reason "..."
  · Accepting is DELIBERATE and never automatic. A gate that rewrote its own baseline on every
    green run would make the cap vacuous — the baseline would always equal the current figure,
    the delta would always be 0, and a 70k cliff would sail through a check that technically ran.
    That is this repo's single largest failure class (CLAUDE.md §6.6: absence produces a plausible
    answer), reached the long way round, so it is worth naming: A SELF-ADVANCING BASELINE IS A
    DELTA CHECK THAT NEVER RUNS.

A MISSING BASELINE IS A HARD FAIL, NOT A SKIP, for the same reason. `evaluate()` has no code
path that returns "pass" without a comparison, and every caller prints a positive coverage
count ("delta checked against a committed baseline for N/N metrics") so "the check found
nothing wrong" and "the check never looked" can never produce the same output.

TWO IMPLEMENTATIONS, PINNED EQUAL. The python gate (scripts/check_payload_budget.py) and the
browser gate (e2e/journeys/payload-first-hand.spec.ts) both enforce this policy, and neither can
call the other's language. scripts/_payload_policy.js is the JS twin of this file, and
tests/payload_policy.test.mjs runs BOTH over the same committed case table
(tests/artifacts/payload_policy_cases.json) and fails on the first disagreement — the repo's
standing remedy for two names for one value (CLAUDE.md §6.5).

Stdlib-only, like every other gate helper here.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POLICY_PATH = ROOT / "tests/artifacts/payload_policy.json"
FORMAT = 1

PASS, WARN, FAIL = "pass", "warn", "fail"


class PolicyError(Exception):
    """The policy file itself is missing, unreadable or malformed. Always fatal: a gate that
    cannot read its own policy has not checked anything, and must not say it has."""


def fmt(n: int) -> str:
    return f"{n:,} B"


def load(path: Path = POLICY_PATH) -> dict:
    """Read and STRUCTURALLY VALIDATE the policy. Raises PolicyError rather than returning a
    default — a default here would silently re-invent the hard ceiling this replaced."""
    if not path.exists():
        raise PolicyError(f"no payload policy at {path} — it is committed state, not a cache")
    try:
        doc = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise PolicyError(f"{path} is not valid JSON: {e}") from e
    if not isinstance(doc, dict):
        raise PolicyError(f"{path} must be a JSON object")
    if doc.get("format") != FORMAT:
        raise PolicyError(f"{path} is format {doc.get('format')!r}, this gate needs {FORMAT}")
    metrics = doc.get("metrics")
    if not isinstance(metrics, dict) or not metrics:
        raise PolicyError(f"{path} carries no metrics — a policy over nothing is not a policy")
    for name, spec in metrics.items():
        _validate_spec(name, spec)
    return doc


def _validate_spec(name: str, spec) -> None:
    if not isinstance(spec, dict):
        raise PolicyError(f"metric {name!r}: expected an object, got {type(spec).__name__}")
    for k in ("target", "action", "delta_cap"):
        v = spec.get(k)
        if not isinstance(v, int) or isinstance(v, bool) or v <= 0:
            raise PolicyError(f"metric {name!r}: {k} must be a positive integer, got {v!r}")
    if spec["target"] > spec["action"]:
        raise PolicyError(
            f"metric {name!r}: target {spec['target']} is above action {spec['action']} — "
            "the warn band would be empty and every overage would be a hard fail"
        )
    if not isinstance(spec.get("gate"), str) or not spec["gate"]:
        raise PolicyError(f"metric {name!r}: `gate` must name the script that enforces it")


def metrics_for(doc: dict, gate: str) -> dict:
    """The metrics this gate is responsible for. The count is the coverage floor: a gate that
    finds zero of its own metrics is misconfigured and must say so, not pass."""
    return {k: v for k, v in doc["metrics"].items() if v.get("gate") == gate}


def evaluate(name: str, spec: dict, value: int, delta_value: int) -> dict:
    """Apply the three bands plus the delta cap to one metric.

    `value` is the absolute figure the bands judge. `delta_value` is the figure the DELTA is
    measured on, which is the same number for most metrics but deliberately is not for
    first_hand_gzip_bytes — see `delta_measured_on` in the policy file.

    Returns {verdict, delta, lines, failures} where verdict is pass|warn|fail. There is no
    fourth verdict and no early return: every call either compares against a baseline or fails.
    """
    target, action, cap = spec["target"], spec["action"], spec["delta_cap"]
    baseline = spec.get("baseline")
    lines: list[str] = []
    failures: list[str] = []

    if not isinstance(baseline, int) or isinstance(baseline, bool):
        failures.append(
            f"{name}: NO DELTA BASELINE — `baseline` is {baseline!r} in "
            f"{POLICY_PATH.relative_to(ROOT)}. The delta cap cannot run without one, and a "
            f"delta check that did not run must not look like one that passed. Seed it with "
            f"`--accept-baseline {name} --reason \"...\"`."
        )
        return {"verdict": FAIL, "delta": None, "lines": lines, "failures": failures}

    delta = delta_value - baseline
    sign = "+" if delta >= 0 else "−"
    delta_txt = f"{sign}{abs(delta):,} B since baseline {fmt(baseline)}"
    if spec.get("baseline_ref"):
        delta_txt += f" ({spec['baseline_ref']})"

    if delta > cap:
        failures.append(
            f"{name}: GREW {delta_txt}, over the {fmt(cap)} per-change cap. Absolute figure "
            f"{fmt(value)} is {'under' if value <= action else 'over'} the {fmt(action)} action "
            f"threshold — the cap is about the SIZE OF THE STEP, not where it landed. Either "
            f"shed the bytes or accept the step deliberately: "
            f"`--accept-baseline {name} --reason \"...\"`."
        )

    if value > action:
        failures.append(
            f"{name}: {fmt(value)} is over the {fmt(action)} ACTION threshold "
            f"(target {fmt(target)}). This band is a hard stop, not an indication."
        )
        verdict = FAIL
    elif value > target:
        lines.append(
            f"⚠ {name}: {fmt(value)} is over the {fmt(target)} target "
            f"(action at {fmt(action)}, {fmt(action - value)} of room) · {delta_txt}"
        )
        verdict = WARN
    else:
        lines.append(f"{name}: {fmt(value)} / target {fmt(target)} · {delta_txt}")
        verdict = PASS

    if failures:
        verdict = FAIL
    return {"verdict": verdict, "delta": delta, "lines": lines, "failures": failures}


def _selftest(cases_path: str) -> int:
    """Print `name<TAB>verdict` for every case in the shared table. tests/payload_policy.test.mjs
    runs the JS twin over the same table and diffs this output, so the two implementations
    cannot drift apart unnoticed."""
    cases = json.loads(Path(cases_path).read_text())["cases"]
    for c in cases:
        spec = dict(c["spec"])
        try:
            _validate_spec(c["name"], spec)
            r = evaluate(c["name"], spec, c["value"], c["delta_value"])
            print(f"{c['name']}\t{r['verdict']}")
        except PolicyError:
            print(f"{c['name']}\tpolicy-error")
    return 0


if __name__ == "__main__":
    import sys

    if len(sys.argv) == 3 and sys.argv[1] == "--selftest":
        raise SystemExit(_selftest(sys.argv[2]))
    doc = load()
    for n, s in doc["metrics"].items():
        print(
            f"{n}: target {fmt(s['target'])} · action {fmt(s['action'])} · "
            f"delta cap {fmt(s['delta_cap'])} · baseline {s.get('baseline')!r} "
            f"({s.get('baseline_ref', 'no ref')}) · gate {s['gate']}"
        )
