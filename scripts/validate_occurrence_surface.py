#!/usr/bin/env python3
"""validate_occurrence_surface.py — the ruleset-availability surface, REPORTED, not gated.

This script exists because of a specific near-miss. `Cross Collar Choke from Invisible Collar`
is dealt no-gi at `{gi:16, nogi:4}` and was handed round as an obvious live data error: a collar
choke served to a player with no collar. It is not an error. It is the output of the Q3 occurrence
calibration, which in the SAME hand, on the SAME run, zeroed its two siblings -- `Bow and Arrow`
and `Clock Choke` both sit at `nogi: 0` on unanimous ballots. The machinery zeroes when the ballots
say to; the 4 is what it produced when they did not.

The near-miss was the fix that almost shipped: a validator asserting "no gi-dependent technique may
carry a nonzero no-gi weight", with gi-dependence inferred from the technique's NAME. The panel
wrote the rebuttal before anyone proposed it, on `collar-sleeve-guard__bottom`:

    Move-name/mechanism mismatch on 'Collar Sleeve to De La Riva': labeled collar-sleeve but ruled
    available no-gi as a positional transition. Consumers keying availability off the move name
    (collar/lapel substring) would wrongly zero it -- flag for the apply step.

A name regex also flags `Rear Naked Choke from Invisible Collar` at `nogi 37` -- the canonical
no-gi choke -- because the POSITION's name contains "Collar". So:

  NOTHING HERE KEYS ON A TECHNIQUE NAME. Availability is read from two places that are allowed to
  assert it: the calibration's own per-frame verdict, and the `prerequisites` / `state_invariants`
  fields, whose authored purpose is to state what a position requires. Nothing reads the
  " Control" string either (panel ruling P3a).

What it reports, and the claim behind each section:

  1. CALIBRATION <-> CONTENT FIDELITY. Content should equal `occurrence_calibration.json`'s
     `moves[].final`, MODULO the per-frame renormalization that `apply_occurrence_calibration.py`
     performs after dropping calibration moves absent from content. Skip that renormalization step
     and a naive diff reports ~308 false mismatches -- which is exactly the shape of bug this file
     is meant to catch, so it must not commit it. Residuals are bucketed by magnitude: +-1 is a
     rounding tie-break against our re-derivation, >=+-2 is unexplained and worth a look.

  2. FRAME-COLLAPSE MIRRORS. Where the calibration zeroes an entire frame, content still carries a
     full 100-sum distribution for it. This is CORRECT per policy, not a bug: occurrence_moe.py
     mirrors a collapsed frame deliberately because validate_graph_integrity.py errors on any frame
     not summing to 100. The row is reported so the mirror is visible, and labelled so nobody
     "fixes" it into a validator failure.

  3. INBOUND REACHABILITY. Outcome cells that route INTO a frame section 2 calls unavailable. This
     is the operational cost of the mirror: `lapel-guard__bottom`'s own flag reads "the engine must
     never route a no-gi session into this node", and this counts the cells that do.

  4. REQUIREMENT CONTRADICTIONS. Role-frames whose own authored prerequisites state a garment
     requirement while the frame carries attempt mass. TIER A (explicit garment) and TIER B (names
     a cloth grip) are a TRIAGE LIST FOR A HUMAN, printed with the quote, never auto-classified --
     Tier A knowingly contains false positives such as `Closed Guard/top`, whose prerequisite reads
     "hips, biceps, collar, or lapels" and names cloth as one option among grip-agnostic ones.

REPORTING ONLY. Exits 0 whatever it finds. `--gate` makes findings fatal and is deliberately wired
into no workflow: whether any of these sections is a DEFECT class is the owner's call, and this
script exists to size them before that call is made. Adding a validate:* key to package.json puts
it in zero workflows anyway -- promoting this needs an explicit ci-validate.yml step plus its
inputs in that file's `paths:` filter.

Zero-coverage is ALWAYS fatal, even in reporting mode (CLAUDE.md 6.6): a matcher that matched
nothing must never print what a clean run prints.

Usage:  python3 scripts/validate_occurrence_surface.py [CONTENT_ROOT] [CALIBRATION_JSON] [--gate]
Exit:   0 = reported (or gated and clean), 1 = zero coverage, or --gate with findings.
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _prob_norm import largest_remainder_round  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ("gi", "nogi")

# Saddle / Honey Hole / Inside Sankaku are reserved for a separate ten-juror panel and are not
# adjudicated here. Excluded by calibration container key, and the exclusion is PRINTED -- a
# silent skip is indistinguishable from a clean run.
RESERVED_KEYS = {
    "ashi-garamisaddle__top", "ashi-garamisaddle__bottom",
    "ashi-garamihoney-hole__top", "ashi-garamihoney-hole__bottom",
    "inside-sankaku__top", "inside-sankaku__bottom",
}

# Read ONLY against `prerequisites` / `state_invariants` -- fields whose authored purpose is to
# state what the position requires. Never against a technique or position NAME.
HARD_REQ = re.compile(
    r"(wearing (a )?gi\b|gi with\b|gi material|collar material|lapel|opponent[^.]{0,15}\bgi\b)", re.I)
GRIP_REQ = re.compile(
    r"\b(sleeve grip|collar grip|gi grip|cuff grip|collar[- ]and[- ]sleeve|cross[- ]collar grip)\b", re.I)


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def load_positions(content_root):
    """Every position role-block, indexed BY FILE PATH and by slug.

    The path index is what the calibration join uses. An earlier draft of this script joined on
    the position SLUG and silently misrouted `crackhead-control__{top,bottom}` -- two containers
    whose `file` still points at `content/Positions/Crackhead Control.json`, moved under
    `Rubber Guard/` since the calibration ran -- onto the live file already covered by
    `rubber-guardcrackhead-control__*`. The wrong join found a partial move list, renormalized it,
    and printed plausible integers (`renorm=47` against `content=22`). No exception, no blank:
    exactly the failure this script reports on. Join on the path, and NAME what fails to resolve.
    """
    by_path, by_slug, name_to_slug = {}, {}, {}
    for f in sorted((content_root / "Positions").rglob("*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(d, dict):
            continue
        slug = d.get("slug") or slugify(d.get("name") or f.stem)
        name_to_slug[d.get("name") or f.stem] = slug
        for role in ("top", "bottom"):
            r = d.get(role)
            if isinstance(r, dict) and (r.get("transitions") or []):
                by_path[(str(f.resolve()), role)] = (f, slug, r)
                by_slug[(slug, role)] = (f, slug, r)
    return by_path, by_slug, name_to_slug


def frame_mass(role_block, frame):
    return sum((t.get("attempt_probability") or {}).get(frame, 0) or 0
               for t in (role_block.get("transitions") or []))


def section1(containers, positions, out):
    """Calibration <-> content fidelity, with renormalization accounted for."""
    exact = renorm = 0
    off_by_one, unexplained = [], []
    resolvable = 0
    for c in containers:
        entry = positions.get((c["_path"], c["role"]))
        if entry is None:
            continue
        _, _slug, block = entry
        cm = {t.get("transition"): (t.get("attempt_probability") or {})
              for t in (block.get("transitions") or [])}
        present = [m for m in c["moves"] if m["transition"] in cm]
        if not present:
            continue
        for frame in FRAMES:
            vals = [float((m.get("final") or {}).get(frame, 0) or 0) for m in present]
            total = sum(vals)
            expected = (largest_remainder_round([v * 100.0 / total for v in vals])
                        if total > 0 else [0] * len(vals))
            for m, exp in zip(present, expected):
                resolvable += 1
                got = cm[m["transition"]].get(frame)
                fin = (m.get("final") or {}).get(frame)
                if got == fin:
                    exact += 1
                elif got == exp:
                    renorm += 1
                else:
                    delta = abs((got or 0) - exp)
                    row = (c["key"], c["role"], frame, m["transition"], fin, exp, got, delta)
                    (off_by_one if delta <= 1 else unexplained).append(row)

    out.append("SECTION 1 - calibration <-> content fidelity")
    out.append(f"  resolvable cells                : {resolvable}")
    if resolvable:
        out.append(f"  exact match to cal.final        : {exact} ({100.0*exact/resolvable:.1f}%)")
        out.append(f"  explained by frame renorm       : {renorm} ({100.0*renorm/resolvable:.1f}%)")
        out.append(f"  residual +-1 (rounding tie)     : {len(off_by_one)}")
        out.append(f"  residual >=+-2 (UNEXPLAINED)    : {len(unexplained)}")
    for r in unexplained[:20]:
        out.append(f"    {r[2]:<5} {r[1]:<7} {r[3]:<44} cal={r[4]} renorm={r[5]} content={r[6]}")
    if len(unexplained) > 20:
        out.append(f"    ... {len(unexplained)-20} more")
    return resolvable, len(unexplained)


def section2(containers, positions, out):
    """Frame-collapse mirrors: calibration zeroes a whole frame, content carries a distribution."""
    hits = []
    for c in containers:
        entry = positions.get((c["_path"], c["role"]))
        if entry is None:
            continue
        _, slug, block = entry
        declared = set(c.get("frame_unavailable") or [])
        for frame in FRAMES:
            vals = [(m.get("final") or {}).get(frame, 0) or 0 for m in c["moves"]]
            collapsed = bool(vals) and all(v == 0 for v in vals)
            if not (collapsed or frame in declared):
                continue
            mass = frame_mass(block, frame)
            if mass > 0:
                hits.append((c["key"], slug, c["role"], frame, mass,
                             "flagged" if frame in declared else "derived (all moves zero)"))
    out.append("")
    out.append("SECTION 2 - frame-collapse mirrors  [CORRECT PER POLICY, not authoring bugs]")
    out.append(f"  containers examined             : {len(containers)}")
    out.append(f"  collapsed frames still populated: {len(hits)}")
    for k, _slug, _role, frame, mass, how in hits:
        out.append(f"    {k:<34} frame={frame:<5} content sums to {mass:<4} [{how}]")
    out.append("    occurrence_moe.py mirrors a collapsed frame ON PURPOSE: validate_graph_integrity.py")
    out.append("    errors on any frame not summing to 100. Do not 'fix' these into a validator failure.")
    return hits


def section3(hits, positions, name_to_slug, content_root, out):
    """Outcome cells routing INTO a frame section 2 calls unavailable."""
    targets = {(slug, role): (key, frame)
               for key, slug, role, frame, _mass, _how in hits}
    cells, scanned = [], 0
    globs = list((content_root / "Transitions").rglob("*.json")) + \
            list((content_root / "Submissions").rglob("*.json"))
    for f in sorted(globs):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(d, dict):
            continue
        for o in (d.get("outcomes") or []):
            to = o.get("to") or ""
            if "/" not in to:
                continue
            scanned += 1
            pos, role = to.rsplit("/", 1)
            k = (name_to_slug.get(pos, slugify(pos)), role.lower())
            if k not in targets:
                continue
            key, frame = targets[k]
            p = (o.get("probability") or {}).get(frame) or 0
            if p > 0:
                cells.append((d.get("name"), to, frame, p, key))
    out.append("")
    out.append("SECTION 3 - inbound reachability into an unavailable frame")
    out.append(f"  outcome cells scanned           : {scanned}")
    out.append(f"  routing INTO an unavailable frame: {len(cells)}")
    for name, to, frame, p, key in sorted(cells, key=lambda x: -x[3]):
        out.append(f"    {str(name):<44} -> {to:<24} {frame}={p:<4} [{key}]")
    return scanned, cells


def section4(positions, ledger, out):
    """Role-frames whose own prerequisites state a garment requirement while the frame is populated."""
    tier_a, tier_b, adjudicated = [], [], []
    scanned = 0
    for (slug, role), (f, _slug, block) in sorted(positions.items()):
        scanned += 1
        lines = [str(x) for x in list(block.get("prerequisites") or [])
                 + list(block.get("state_invariants") or [])]
        mass = frame_mass(block, "nogi")
        if mass <= 0:
            continue
        hard = [ln for ln in lines if HARD_REQ.search(ln)]
        grip = [ln for ln in lines if GRIP_REQ.search(ln) and ln not in hard]
        if not (hard or grip):
            continue
        key = f"{slug}__{role}"
        row = (key, role, mass, (hard or grip)[0][:96], f)
        if key in ledger:
            adjudicated.append((key, ledger[key]))
        elif hard:
            tier_a.append(row)
        else:
            tier_b.append(row)
    out.append("")
    out.append("SECTION 4 - requirement contradictions  [TRIAGE LIST, not a defect list]")
    out.append(f"  role-frames scanned             : {scanned}")
    out.append(f"  TIER A explicit garment req     : {len(tier_a)}")
    for key, role, mass, quote, _f in tier_a:
        out.append(f"    {key:<34} nogi mass={mass:<4} \"{quote}\"")
    out.append(f"  TIER B names a cloth grip       : {len(tier_b)}")
    for key, role, mass, quote, _f in tier_b:
        out.append(f"    {key:<34} nogi mass={mass:<4} \"{quote}\"")
    by_owner = sum(1 for _k, v in adjudicated if v.get("decided_by") == "owner_decision")
    by_llm = len(adjudicated) - by_owner
    out.append(f"  already adjudicated (ledger)    : {len(adjudicated)} "
               f"({by_owner} owner-decided, {by_llm} llm-adjudicated)")
    out.append("    Tier A knowingly contains false positives (a prerequisite may name cloth as ONE")
    out.append("    option among grip-agnostic ones). Adjudicate into tests/artifacts/occurrence_reviewed.json.")
    return scanned, tier_a, tier_b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("content_root", nargs="?", default=str(ROOT / "content"))
    ap.add_argument("calibration", nargs="?", default=str(ROOT / "occurrence_calibration.json"))
    ap.add_argument("--ledger", default=str(ROOT / "tests/artifacts/occurrence_reviewed.json"))
    ap.add_argument("--gate", action="store_true", help="make findings fatal (wired into no workflow)")
    a = ap.parse_args()

    content_root = Path(a.content_root)
    cal = json.loads(Path(a.calibration).read_text(encoding="utf-8"))
    try:
        ledger = json.loads(Path(a.ledger).read_text(encoding="utf-8")).get("reviewed", {})
    except FileNotFoundError:
        ledger = {}

    by_path, by_slug, name_to_slug = load_positions(content_root)

    containers, skipped, unresolvable = [], [], []
    repo_root = content_root.parent
    for c in cal.get("containers", []):
        if c["key"] in RESERVED_KEYS:
            skipped.append(c["key"])
            continue
        p = (repo_root / c["file"]).resolve()
        if (str(p), c["role"]) not in by_path:
            unresolvable.append((c["key"], c["file"]))
            continue
        c["_path"] = str(p)
        containers.append(c)

    out = ["[validate_occurrence_surface] ruleset-availability surface report", ""]
    resolvable, unexplained = section1(containers, by_path, out)
    hits = section2(containers, by_path, out)
    scanned3, cells = section3(hits, by_slug, name_to_slug, content_root, out)
    scanned4, tier_a, tier_b = section4(by_slug, ledger, out)

    out.append("")
    out.append("COVERAGE")
    out.append(f"  position role-frames loaded     : {len(by_slug)}")
    out.append(f"  calibration containers examined : {len(containers)}")
    out.append(f"  reserved containers EXCLUDED    : {len(skipped)} -> {', '.join(sorted(skipped)) or '(none)'}")
    out.append(f"  containers UNRESOLVABLE (stale path, joined to nothing): {len(unresolvable)}")
    for k, f in unresolvable:
        out.append(f"    {k:<40} {f}")
    print("\n".join(out))

    # Zero coverage is fatal in EVERY mode: a matcher that matched nothing must not print what a
    # clean run prints. This is the one failure this script can have that reporting mode cannot mask.
    floors = [("position role-frames", len(by_slug)),
              ("calibration containers", len(containers)),
              ("resolvable cells", resolvable),
              ("outcome cells scanned", scanned3)]
    dead = [n for n, v in floors if v == 0]
    if dead:
        print(f"\n[validate_occurrence_surface] FAILED: zero coverage on {', '.join(dead)} — "
              f"the matcher is broken, which is indistinguishable from a clean run", file=sys.stderr)
        return 1

    if a.gate:
        findings = unexplained + len(cells) + len(tier_a)
        if findings:
            print(f"\n[validate_occurrence_surface] GATE FAIL: {unexplained} unexplained cells, "
                  f"{len(cells)} inbound cells, {len(tier_a)} tier-A rows", file=sys.stderr)
            return 1
    print("\n[validate_occurrence_surface] OK — reported (reporting mode; --gate not wired to CI)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
