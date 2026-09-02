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

THE NULL LAYER. Per `scripts/_ruleset.py`, an attempt cell of `null` means "this edge does not
exist in that ruleset" -- a STRUCTURAL fact, distinct from `0` = "exists but is ~never attempted".
Nothing here may spell a null as a zero: `or 0` re-animates an edge the corpus says is gone and
turns a structure into a plausible number, which is the exact defect class this file reports on.
Reading goes through `frame_state()` (positions) and `_ruleset.cell()` (outcomes), and every null
lands in a NAMED, PRINTED bucket rather than being folded away. Three of them are new here --
section 1's `content NULL, ...` triple, section 2's `content frame NULLED`, section 4's
`nogi frame ABSENT (skipped)` -- and all three read 0 on a corpus with no nulls, which is what the
whole report did before. The corpus carries zero nulls today, so none of those branches has a
witness in the content: `--selftest` is the only thing that exercises them, and it is the red-proof
for all of them -- every numbered claim in its docstring is phrased so that reverting the fix it
guards turns `--selftest` red. It prints its own assertion count; do not quote a mutant count here,
because nothing in the tree recomputes one.

REPORTING ONLY. Exits 0 whatever it finds. `--gate` makes findings fatal and is deliberately wired
into no workflow: whether any of these sections is a DEFECT class is the owner's call, and this
script exists to size them before that call is made. Adding a validate:* key to package.json puts
it in zero workflows anyway -- promoting this needs an explicit ci-validate.yml step plus its
inputs in that file's `paths:` filter.

Zero-coverage is ALWAYS fatal, even in reporting mode (CLAUDE.md 6.6): a matcher that matched
nothing must never print what a clean run prints. WHICH counts are floors and which are only
printed is argued at the `floors` list in main() -- flooring a FINDING count fails a clean tree,
which is the same rule inverted, and one candidate for it turned `tests/occurrence_gate.test.mjs`
red on a correct build before it was caught.

Usage:  python3 scripts/validate_occurrence_surface.py [CONTENT_ROOT] [CALIBRATION_JSON] [--gate]
        python3 scripts/validate_occurrence_surface.py --selftest      # the null-layer contract
Exit:   0 = reported (or gated and clean), 1 = zero coverage, or --gate with findings.
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _prob_norm import largest_remainder_round  # noqa: E402
from _ruleset import cell  # noqa: E402

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


def frame_state(role_block, frame):
    """One role-block's ONE ruleset frame, as a PAIR: ``(mass, n_present)``. Never a bare scalar.

    `scripts/_ruleset.py` is explicit that a null cell means "this edge does not exist in that
    ruleset", which is a DIFFERENT fact from 0 = "exists but is ~never attempted" -- and every
    caller below branches on the difference. The predecessor summed `.get(frame, 0) or 0`, which
    folded the two into one number: a frame that does not exist and a frame where every move is 0%
    produced an identical mass, so `if mass > 0` (section 2) and `if mass <= 0` (section 4) took
    the same path for both. That is the defect class this file exists to REPORT (CLAUDE.md 6.6 --
    absence produces a plausible answer), so it must not commit it.

    `n_present == 0` is the same statement `_ruleset.present_rulesets()` makes by omitting the
    frame; it is spelled per-frame here because the callers want the mass in the same pass.
    `mass` stays an int on int input -- section 2 prints it, and the report is byte-stable.

    Two shapes behave differently from the predecessor, both unreachable on today's corpus (2543
    position attempt cells, all well-formed two-key maps, 0 nulls -- recompute with
    `_ruleset.is_ruleset_map` over `content/Positions/**`). A legacy BARE SCALAR now reads as the
    mirrored value where `.get` used to raise AttributeError; and a dict carrying a key outside
    {gi, nogi} is not a ruleset map, so `cell()` hands back the dict and `mass +=` raises
    TypeError where the predecessor silently returned one key's number. That TypeError is
    `_ruleset.py`'s documented "a reader that forgets to fork fails loudly" contract, not a
    regression -- fix the DATA, or the reader that produced it.
    """
    mass = 0
    n_present = 0
    for t in (role_block.get("transitions") or []):
        c = cell(t.get("attempt_probability"), frame)
        if c is None:
            continue          # the edge does not exist in this frame. NOT a zero. Not summable.
        n_present += 1
        mass += c
    return mass, n_present


def section1(containers, positions, out):
    """Calibration <-> content fidelity, with renormalization accounted for."""
    exact = renorm = 0
    off_by_one, unexplained, contradicts = [], [], []
    null_declared = null_agreed = 0
    resolvable = 0
    for c in containers:
        entry = positions.get((c["_path"], c["role"]))
        if entry is None:
            continue
        _, _slug, block = entry
        declared = set(c.get("frame_unavailable") or [])
        cm = {t.get("transition"): t.get("attempt_probability")
              for t in (block.get("transitions") or [])}
        present = [m for m in c["moves"] if m["transition"] in cm]
        if not present:
            continue
        for frame in FRAMES:
            # CALIBRATION-side `or 0`, kept DELIBERATELY -- this pass nulls content, not the
            # calibration. Measured on occurrence_calibration.json: 5246 `final` cells, 0 null,
            # 0 missing frame keys, so it coerces nothing today. Recompute before quoting that:
            #   python3 -c "import json;c=json.load(open('occurrence_calibration.json'));\
            #     print(sum(1 for k in c['containers'] for m in k['moves'] for f in ('gi','nogi')\
            #               if (m.get('final') or {}).get(f) is None))"
            # If calibration nulls ever land, the damage is CONTAINED TO THE NULL CELL'S OWN ROW:
            # a null contributing 0 to `total` is arithmetically identical to dropping it, so the
            # surviving moves still renormalize correctly -- only the null move's own `expected`
            # becomes 0 instead of None, and content's real value is then scored against that 0.
            # The fix at that point is `largest_remainder_round(vals, null_cells=[])`, which already
            # returns None at a null index, plus a fourth bucket beside the three `content NULL`
            # ones below. Doing it NOW would move the renorm baseline on a corpus that has no nulls
            # -- a behaviour change wearing a null-safety label, which is what this pass forbids.
            vals = [float((m.get("final") or {}).get(frame, 0) or 0) for m in present]
            total = sum(vals)
            expected = (largest_remainder_round([v * 100.0 / total for v in vals])
                        if total > 0 else [0] * len(vals))
            for m, exp in zip(present, expected):
                resolvable += 1
                got = cell(cm[m["transition"]], frame)
                fin = (m.get("final") or {}).get(frame)
                # A NULL content cell is a STRUCTURAL statement -- "no such edge in this frame" --
                # never a quantity, so it is classified before any arithmetic touches it. The
                # predecessor computed `abs((got or 0) - exp)`, which read every null as a 0 and
                # then compared it against a nonzero cal.final. Measured on the 71-cell null pass:
                # 60 phantom `residual +-1 (rounding tie)` (delta 0, never listed) and 11 rows
                # reading `cal=18 renorm=18 content=None` promoted to UNEXPLAINED -- a false red on
                # precisely the edges the null layer exists to express. Three named buckets, all
                # printed, because "agrees" and "never looked" must not share an output.
                if got is None:
                    if frame in declared:
                        # The calibration's own `frame_unavailable` verdict already says this frame
                        # is gone, so content nulling it AGREES. Its `final` cells still carry the
                        # mirror occurrence_moe.py wrote to keep validate_graph_integrity.py's
                        # sum-to-100 happy (section 2) -- so `final` is not evidence against the
                        # null here, and the flag outranks it. Bucketing these as contradictions
                        # would reproduce the false red one layer down.
                        null_declared += 1
                    elif fin in (0, None):
                        null_agreed += 1
                    else:
                        contradicts.append((c["key"], c["role"], frame, m["transition"], fin))
                    continue
                if got == fin:
                    exact += 1
                elif got == exp:
                    renorm += 1
                else:
                    delta = abs(got - exp)      # `got` is non-null here, by the branch above
                    row = (c["key"], c["role"], frame, m["transition"], fin, exp, got, delta)
                    (off_by_one if delta <= 1 else unexplained).append(row)

    out.append("SECTION 1 - calibration <-> content fidelity")
    out.append(f"  resolvable cells                : {resolvable}")
    if resolvable:
        out.append(f"  exact match to cal.final        : {exact} ({100.0*exact/resolvable:.1f}%)")
        out.append(f"  explained by frame renorm       : {renorm} ({100.0*renorm/resolvable:.1f}%)")
        out.append(f"  residual +-1 (rounding tie)     : {len(off_by_one)}")
        out.append(f"  residual >=+-2 (UNEXPLAINED)    : {len(unexplained)}")
        out.append(f"  content NULL, cal frame declared: {null_declared}")
        out.append(f"  content NULL, cal final 0 too   : {null_agreed}")
        out.append(f"  content NULL, cal CARRIES MASS  : {len(contradicts)}  <- disagreement")
    for r in unexplained[:20]:
        out.append(f"    {r[2]:<5} {r[1]:<7} {r[3]:<44} cal={r[4]} renorm={r[5]} content={r[6]}")
    if len(unexplained) > 20:
        out.append(f"    ... {len(unexplained)-20} more")
    for k, role, frame, tr, fin in contradicts[:20]:
        out.append(f"    {frame:<5} {role:<7} {tr:<44} cal={fin} content=NULL  [{k}]")
    if len(contradicts) > 20:
        out.append(f"    ... {len(contradicts)-20} more")
    return resolvable, len(unexplained), len(contradicts)


def section2(containers, positions, out):
    """The calibration zeroed a whole frame. What did CONTENT do about it -- three answers.

    `mirrored` is the documented policy state: occurrence_moe.py writes a full 100-sum
    distribution because validate_graph_integrity.py errors on any frame not summing to 100.
    `NULLED` is what the null layer makes expressible -- content now says the frame does not
    exist, which AGREES with the calibration and RESOLVES the mirror. `zeroed` is neither: the
    frame exists and every move is 0%.

    Returning only the mirrors, as the predecessor did, is what made section 3 blind. Its target
    set is built from this return value, so nulling the corpus's one mirror emptied it and
    section 3 printed `routing INTO an unavailable frame: 0` while all twelve inbound cells sat
    untouched in content, now aimed at a frame that does not exist. Measured on the 71-cell null
    pass: 12 -> 0, with every coverage floor in this file still green. All three states are
    returned; the printed `still populated` headline keeps counting mirrors only, which is what
    that line has always meant.
    """
    frames = []
    for c in containers:
        entry = positions.get((c["_path"], c["role"]))
        if entry is None:
            continue
        _, slug, block = entry
        declared = set(c.get("frame_unavailable") or [])
        for frame in FRAMES:
            # CALIBRATION-side `or 0` again (0 null `final` cells today -- see section1's note),
            # and here it is also the SEMANTICALLY right answer rather than merely a harmless one:
            # `collapsed` asks "does the calibration carry no mass in this frame", and a null cal
            # cell says the move does not exist there, which is the same verdict. null -> 0 ->
            # collapsed is what this section wants. The CONTENT side of the same question is read
            # through frame_state(), which never coerces and reports n_present separately.
            vals = [(m.get("final") or {}).get(frame, 0) or 0 for m in c["moves"]]
            collapsed = bool(vals) and all(v == 0 for v in vals)
            if not (collapsed or frame in declared):
                continue
            mass, n_present = frame_state(block, frame)
            state = "nulled" if n_present == 0 else ("mirrored" if mass > 0 else "zeroed")
            frames.append((c["key"], slug, c["role"], frame, mass, n_present, state,
                           "flagged" if frame in declared else "derived (all moves zero)"))
    mirrored = [r for r in frames if r[6] == "mirrored"]
    nulled = [r for r in frames if r[6] == "nulled"]
    zeroed = [r for r in frames if r[6] == "zeroed"]
    out.append("")
    out.append("SECTION 2 - frame-collapse mirrors  [CORRECT PER POLICY, not authoring bugs]")
    out.append(f"  containers examined             : {len(containers)}")
    # A positive count of what was EXAMINED, beside the count of what was found. Without it the
    # three state counts below all read 0 both when the calibration collapses nothing and when the
    # collapse detector is broken. NOT a floor, though -- see the floors block in main(): a corpus
    # whose calibration collapses no frame at all is legitimate, and flooring this would invert the
    # 6.6 rule into a false red.
    out.append(f"  collapsed frames examined       : {len(frames)}")
    out.append(f"  collapsed frames still populated: {len(mirrored)}")
    for k, _slug, _role, frame, mass, _n, _st, how in mirrored:
        out.append(f"    {k:<34} frame={frame:<5} content sums to {mass:<4} [{how}]")
    out.append(f"  content frame NULLED (resolved) : {len(nulled)}")
    for k, _slug, _role, frame, _mass, _n, _st, how in nulled:
        out.append(f"    {k:<34} frame={frame:<5} content NULLED  n_present=0  [{how}, resolved]")
    out.append(f"  content frame exists, all zeros : {len(zeroed)}")
    for k, _slug, _role, frame, mass, npres, _st, how in zeroed:
        out.append(f"    {k:<34} frame={frame:<5} content sums to {mass:<4} n_present={npres} [{how}]")
    out.append("    occurrence_moe.py mirrors a collapsed frame ON PURPOSE: validate_graph_integrity.py")
    out.append("    errors on any frame not summing to 100. Do not 'fix' these into a validator failure.")
    out.append("    A NULLED row is the mirror RESOLVED, not a new bug: content and calibration now")
    out.append("    agree the frame is gone. Section 3 still has to be told about it -- see below.")
    return frames


def section3(frames, positions, name_to_slug, content_root, out):
    """Outcome cells routing INTO a frame section 2 calls unavailable.

    The target set is EVERY collapsed frame, whatever content did about it -- mirrored, NULLED or
    zeroed. Building it from the mirrors alone is how this section went quiet: null the one mirror
    in the corpus and the targets vanish, so the headline printed 0 with all twelve inbound cells
    still in the content, now aimed at a frame that does not exist. A finding that disappears
    because its INPUT disappeared is the 6.6 failure this file reports on, and the null layer is
    exactly what triggers it. Nulling a frame RESOLVES the mirror (section 2) but makes the
    inbound routing WORSE, not better -- the same twelve cells, now provably unreachable.

    A (slug, role) can collapse in both frames at once, so targets maps to a LIST. The predecessor's
    dict-of-one silently kept whichever frame was written last.

    `positions` (the by-slug index) is what the join-coverage count is read from, and it was an
    unused parameter until now. `scanned` counts every `to` carrying a slash and stays healthy even
    when the name->slug join is completely broken; `resolved` is the term that dies with the join,
    so read it whenever this section reports nothing. It is PRINTED, not floored -- the floors block
    in main() argues why, and `tests/occurrence_gate.test.mjs` is the reason.
    """
    targets = {}
    for key, slug, role, frame, _mass, _n, state, _how in frames:
        targets.setdefault((slug, role), []).append((key, frame, state))
    cells, scanned, resolved = [], 0, 0
    inbound_absent = inbound_zero = 0
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
            if k in positions:
                resolved += 1
            for key, frame, state in targets.get(k, ()):
                # Three outcomes, and the first two are NOT the same. `None` = this outcome does not
                # exist in that frame, which is the GOOD state and the one the null layer is for --
                # it is counted and printed rather than folded into the zeros. `0` = the edge exists
                # and is never routed. Only a positive cell is the finding. The predecessor wrote
                # `... .get(frame) or 0`, which merged the first two and reported neither.
                pr = cell(o.get("probability"), frame)
                if pr is None:
                    inbound_absent += 1
                elif pr == 0:
                    inbound_zero += 1
                else:
                    cells.append((d.get("name"), to, frame, pr, key, state))
    out.append("")
    out.append("SECTION 3 - inbound reachability into an unavailable frame")
    out.append(f"  outcome cells scanned           : {scanned}")
    out.append(f"  ... resolved to a role-frame    : {resolved}")
    out.append(f"  unavailable role-frames targeted: {len(targets)}")
    out.append(f"  routing INTO an unavailable frame: {len(cells)}")
    for name, to, frame, pr, key, state in sorted(cells, key=lambda x: -x[3]):
        # The mirror is this section's documented default -- it is what the header describes -- so a
        # mirrored row keeps the bare key and only the exceptional states are named. That also keeps
        # this block byte-identical on a zero-null corpus, which is the invariant the null migration
        # is landing under.
        tag = key if state == "mirrored" else f"{key} | content frame {state.upper()}"
        out.append(f"    {str(name):<44} -> {to:<24} {frame}={pr:<4} [{tag}]")
    out.append(f"  inbound cell ABSENT in that frame: {inbound_absent}  (null -- the good state)")
    out.append(f"  inbound cell present but zero   : {inbound_zero}")
    return scanned, resolved, cells


def section4(positions, ledger, out):
    """Role-frames whose own prerequisites state a garment requirement while the frame is populated."""
    tier_a, tier_b, adjudicated = [], [], []
    scanned = absent = zero_mass = 0
    for (slug, role), (f, _slug, block) in sorted(positions.items()):
        scanned += 1
        lines = [str(x) for x in list(block.get("prerequisites") or [])
                 + list(block.get("state_invariants") or [])]
        mass, n_present = frame_state(block, "nogi")
        if n_present == 0:
            # The frame does not exist here at all, so there is nothing for a garment prerequisite
            # to contradict: this is a finding RESOLVED, and it prints. Dropping the row silently is
            # how "the contradiction is gone" and "the reader stopped seeing cells" come back as the
            # same number -- measured on the 71-cell null pass, `already adjudicated (ledger)` went
            # 24 -> 23 with no line saying why.
            absent += 1
            continue
        if mass <= 0:
            zero_mass += 1
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
    out.append(f"  nogi frame ABSENT (skipped)     : {absent}")
    out.append(f"  nogi frame present, zero mass   : {zero_mass}")
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


def selftest():
    """The null-layer contract, on a corpus small enough to hold in your head.

    It exists because the corpus cannot prove any of this: content carries ZERO nulls today, so
    every null branch above is unreachable from the real tree and a mutant of it survives every
    run (CLAUDE.md 6.3 -- a surviving mutant is a missing spec, not a passing build). The SIX
    numbered claims below are the red-proof (10 `assert` statements; the count this prints on
    success is that number, so it cannot drift from the code). Each fails on the pre-null code:

      1/2  frame_state must separate "the frame does not exist" (n_present 0) from "the frame
           exists and every move is 0%" (n_present 1). `frame_mass` returned 0 for both.
      3    section 3 must still find an inbound cell when the target frame is NULLED in content.
           This is the regression that motivated the file: 12 inbound cells -> 0 findings.
      4    section 1 must bucket a null against a declared-unavailable frame as agreement, not as
           an UNEXPLAINED residual. `abs((got or 0) - exp)` scored it 18.
      5    a NULL outbound probability cell must be counted as ABSENT, not folded in with the
           zeros. No technique-level null exists in the corpus yet, so this branch has no other
           witness anywhere -- it is asserted here or it is asserted nowhere.
      6    a corpus whose every attempt cell is null must exit NON-ZERO on the coverage floor.
           This is the one the pre-existing floors cannot see: role-frames, containers, resolvable
           cells and outcome cells scanned all stay green while nothing is read at all.

    Run:  python3 scripts/validate_occurrence_surface.py --selftest
    """
    import subprocess
    import tempfile

    ok = frame_state({"transitions": [{"transition": "A",
                                       "attempt_probability": {"gi": 100, "nogi": None}}]}, "nogi")
    assert ok == (0, 0), f"1. a NULLED frame must report n_present=0, got {ok}"
    ok = frame_state({"transitions": [{"transition": "A",
                                       "attempt_probability": {"gi": 100, "nogi": 0}}]}, "nogi")
    assert ok == (0, 1), f"2. an all-zero frame EXISTS: n_present must be 1, got {ok}"

    pos = {"name": "Pos A", "bottom": {"prerequisites": [], "transitions": [
        {"transition": "T1", "attempt_probability": {"gi": 100, "nogi": None}}]}}
    tech = {"name": "T0", "outcomes": [
        {"to": "Pos A/Bottom", "probability": {"gi": 40, "nogi": 60}, "result": "success"}]}
    tech_absent = {"name": "T9", "outcomes": [
        {"to": "Pos A/Bottom", "probability": {"gi": 40, "nogi": None}, "result": "success"}]}
    cal = {"containers": [{"key": "pos-a__bottom", "role": "bottom",
                           "file": "content/Positions/Pos A.json",
                           "frame_unavailable": ["nogi"],
                           "moves": [{"transition": "T1", "final": {"gi": 100, "nogi": 18}}]}]}
    with tempfile.TemporaryDirectory() as td:
        root = Path(td) / "content"
        (root / "Positions").mkdir(parents=True)
        (root / "Transitions").mkdir(parents=True)
        (root / "Submissions").mkdir(parents=True)
        (root / "Positions" / "Pos A.json").write_text(json.dumps(pos), encoding="utf-8")
        (root / "Transitions" / "T0.json").write_text(json.dumps(tech), encoding="utf-8")
        (root / "Transitions" / "T9.json").write_text(json.dumps(tech_absent), encoding="utf-8")
        by_path, by_slug, name_to_slug = load_positions(root)
        containers, _sk, unres = resolve_containers(cal, by_path, root.parent)
        assert not unres and len(containers) == 1, f"selftest join broke: {unres}"
        out = []
        resolvable, unexplained, contradicts = section1(containers, by_path, out)
        frames = section2(containers, by_path, out)
        scanned3, resolved3, cells = section3(frames, by_slug, name_to_slug, root, out)

        assert len(cells) == 1 and cells[0][3] == 60 and cells[0][5] == "nulled", (
            f"3. an inbound cell into a NULLED frame must still be found, got {cells}")
        assert resolved3 == 2, f"3b. join coverage must count both outcome cells, got {resolved3}"
        assert "  inbound cell ABSENT in that frame: 1" in "\n".join(out), (
            "5. a NULL outbound probability cell must be counted ABSENT, not folded into the "
            "zeros:\n" + "\n".join(out))
        assert (unexplained, contradicts) == (0, 0), (
            f"4. a null against a declared-unavailable frame is agreement, not a residual; "
            f"got unexplained={unexplained} contradicts={contradicts}")
        assert resolvable == 2, f"4b. both frames must be resolvable, got {resolvable}"

        # And the disagreement direction still fires: drop the calibration's own flag and the same
        # null becomes a real contradiction against a `final` of 18.
        cal["containers"][0].pop("frame_unavailable")
        containers, _sk, _u = resolve_containers(cal, by_path, root.parent)
        _r, _u2, contradicts2 = section1(containers, by_path, [])
        assert contradicts2 == 1, (
            f"4c. an UNDECLARED null against cal=18 must contradict, got {contradicts2}")

        # 6. The coverage floor, end to end -- it lives in main(), so this is the one assertion
        # that has to re-enter the script. Null every attempt cell and nothing is read, while the
        # four pre-existing floors stay green: role-frames 1, containers 1, resolvable 2, outcome
        # cells scanned 2. Exit must be non-zero anyway.
        pos["bottom"]["transitions"][0]["attempt_probability"] = {"gi": None, "nogi": None}
        (root / "Positions" / "Pos A.json").write_text(json.dumps(pos), encoding="utf-8")
        calf = Path(td) / "cal.json"
        calf.write_text(json.dumps(cal), encoding="utf-8")
        r = subprocess.run([sys.executable, str(Path(__file__).resolve()), str(root), str(calf),
                            "--ledger", str(Path(td) / "absent.json")],
                           capture_output=True, text=True)
        assert r.returncode != 0 and "non-null attempt cells read" in (r.stdout + r.stderr), (
            f"6. a corpus with every attempt cell nulled must fail the coverage floor; "
            f"got exit {r.returncode}\n{r.stdout}{r.stderr}")

    print("[validate_occurrence_surface] selftest OK - 10 assertions on the null layer")
    return 0


def resolve_containers(cal, by_path, repo_root):
    """Calibration containers joined to live role-blocks BY PATH, plus what did not join.

    One named seam because two callers ask this question -- main() and selftest() -- and a second
    copy is the CLAUDE.md 6.5 shape (one question answered in two places, one of them already
    wrong). load_positions()' own docstring records what the wrong join did the last time.
    """
    containers, skipped, unresolvable = [], [], []
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
    return containers, skipped, unresolvable


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("content_root", nargs="?", default=str(ROOT / "content"))
    ap.add_argument("calibration", nargs="?", default=str(ROOT / "occurrence_calibration.json"))
    ap.add_argument("--ledger", default=str(ROOT / "tests/artifacts/occurrence_reviewed.json"))
    ap.add_argument("--gate", action="store_true", help="make findings fatal (wired into no workflow)")
    ap.add_argument("--selftest", action="store_true",
                    help="run the null-layer contract on a synthetic corpus and exit")
    a = ap.parse_args()

    if a.selftest:
        return selftest()

    content_root = Path(a.content_root)
    cal = json.loads(Path(a.calibration).read_text(encoding="utf-8"))
    try:
        ledger = json.loads(Path(a.ledger).read_text(encoding="utf-8")).get("reviewed", {})
    except FileNotFoundError:
        ledger = {}

    by_path, by_slug, name_to_slug = load_positions(content_root)

    containers, skipped, unresolvable = resolve_containers(cal, by_path, content_root.parent)

    out = ["[validate_occurrence_surface] ruleset-availability surface report", ""]
    resolvable, unexplained, contradicts = section1(containers, by_path, out)
    frames = section2(containers, by_path, out)
    scanned3, resolved3, cells = section3(frames, by_slug, name_to_slug, content_root, out)
    scanned4, tier_a, tier_b = section4(by_slug, ledger, out)

    # How many attempt cells this run actually READ -- the floor that measures the thing that can
    # go to zero. Every section above reads content through frame_state(); if that reader ever
    # stops seeing cells (a shape change, a renamed key, a bad import) all four sections go quiet
    # at once while every PRE-EXISTING floor stays green, because not one of them counts a VALUE.
    # The motivating measurement, taken with the predecessor against a 2,543-cell no-gi wipe:
    # `routing INTO an unavailable frame` and `TIER A` both printed 0 -- silently, the wrong
    # reason -- while `role-frames 272 / containers 266 / resolvable cells 4956 / outcome cells
    # scanned 3831` did not move a digit.
    # It does NOT fire on that wipe, and must not: a corpus carrying no no-gi frame anywhere is a
    # legitimate state, and the 2,543 gi cells are still read. What it catches is the READER dying.
    cells_read = sum(frame_state(b, fr)[1]
                     for (_s, _r), (_f, _sl, b) in by_slug.items() for fr in FRAMES)

    out.append("")
    out.append("COVERAGE")
    out.append(f"  position role-frames loaded     : {len(by_slug)}")
    out.append(f"  calibration containers examined : {len(containers)}")
    out.append(f"  outcome cells resolved to a role: {resolved3}")
    out.append(f"  non-null attempt cells read     : {cells_read}")
    out.append(f"  reserved containers EXCLUDED    : {len(skipped)} -> {', '.join(sorted(skipped)) or '(none)'}")
    out.append(f"  containers UNRESOLVABLE (stale path, joined to nothing): {len(unresolvable)}")
    for k, f in unresolvable:
        out.append(f"    {k:<40} {f}")
    print("\n".join(out))

    # Zero coverage is fatal in EVERY mode: a matcher that matched nothing must not print what a
    # clean run prints. This is the one failure this script can have that reporting mode cannot mask.
    # DELIBERATELY NOT FLOORED, and each for a measured reason:
    #   `collapsed frames examined` / `unavailable role-frames targeted` / the tier counts /
    #   `routing INTO an unavailable frame` are FINDING counts. Each is legitimately 0 on a corpus
    #   whose calibration collapses no frame and whose content nulls none, and flooring a finding
    #   inverts the 6.6 rule into a false red on a clean tree.
    #   `outcome cells resolved to a role-frame` LOOKS like coverage (it is 3831 of 3831 on the real
    #   corpus, and it is the term that dies when the name->slug join breaks while `scanned` stays
    #   healthy) but it is not safe to floor either: an outcome may legitimately route to a role
    #   that load_positions() does not index, because that role carries no transitions. Flooring it
    #   turned `tests/occurrence_gate.test.mjs` "section 4 keys on the authored requirement" red on
    #   a correct build -- its fixture routes into `Lapel Guard A/Top` and authors only `bottom`.
    #   It is PRINTED in COVERAGE instead; read it when section 3 reports nothing.
    # Floor the COVERAGE: the four joins, plus the one READER every section is downstream of.
    floors = [("position role-frames", len(by_slug)),
              ("calibration containers", len(containers)),
              ("resolvable cells", resolvable),
              ("outcome cells scanned", scanned3),
              ("non-null attempt cells read", cells_read)]
    dead = [n for n, v in floors if v == 0]
    if dead:
        print(f"\n[validate_occurrence_surface] FAILED: zero coverage on {', '.join(dead)} — "
              f"the matcher is broken, which is indistinguishable from a clean run", file=sys.stderr)
        return 1

    if a.gate:
        # A DELIBERATE null is a report row, not a gate failure: `null_declared` and `null_agreed`
        # are content and the calibration AGREEING that an edge does not exist in a ruleset, and
        # gating on them would fail the tree for doing exactly what the null layer is for. Only
        # `contradicts` -- content nulled a cell the calibration still prices -- is a real
        # disagreement, and it is fatal. `len(cells)` stays fatal because inbound routing into an
        # absent frame gets WORSE once the null lands, not better.
        findings = unexplained + contradicts + len(cells) + len(tier_a)
        if findings:
            print(f"\n[validate_occurrence_surface] GATE FAIL: {unexplained} unexplained cells, "
                  f"{len(cells)} inbound cells, {len(tier_a)} tier-A rows, "
                  f"{contradicts} null-vs-calibration contradictions", file=sys.stderr)
            return 1
    print("\n[validate_occurrence_surface] OK — reported (reporting mode; --gate not wired to CI)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
