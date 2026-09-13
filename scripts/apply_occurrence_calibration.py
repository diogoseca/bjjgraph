#!/usr/bin/env python3
"""Apply Q3 panel-calibrated occurrence (attempt-probability) distributions into
content/Positions/*.json.

Reads occurrence_calibration.json (the committed provenance emitted by the Q3
aggregation: per container -> per move -> final {gi,nogi} ints summing to 100 per
frame). For each container it:
  - resolves the position file by its stored RELATIVE PATH (never by slug — two
    Crackhead Control files collide on the name slug),
  - loads RAW (never reduce_to_scalar: these are the divergent maps themselves),
  - locates the role container (data[role]["transitions"], root for neutral),
  - ABORTS the container if the move set drifted since elicitation,
  - writes attempt_probability = {"gi": int|null, "nogi": int|null} per move,
  - belt-and-braces largest_remainder_round per PRESENT frame if a sum is off 100,
  - atomic-writes the file.

--dry-run reports everything and writes nothing.

THE NULL LAYER. Under the null contract (scripts/_ruleset.py) a null cell means "this
edge does not exist in that ruleset", distinct from 0 = "exists, ~never attempted". This
script is the one that WROTE the position-level distributions, so it is also the one that
can silently REVERT them: it used to write ``int(final.get(rs, 0))`` into both frames
unconditionally, which turns every authored null back into a number. Measured on Lapel
Guard bottom (the container whose whole no-gi frame the aggregator declared unavailable
and mirrored) with its 11 no-gi cells nulled on disk: ``apply_container`` returned
``{'status': 'applied', 'moves_changed': 11}`` and the file came back with
``nogi = [18, 9, 6, 12, 8, 5, 9, 8, 10, 11, 4]``. Nulls survived 0 of 11, nothing printed,
and both frames still summed to 100 so validate:graph agreed.

So: an authored null is never overwritten where the calibration AGREES the edge is
unavailable (see _final_cell), and MINTING nulls from the calibration's own verdict is
opt-in behind --write-nulls, because the calibration's zero set and the corpus's null set
are not the same set today (see that flag's help).
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _prob_norm import largest_remainder_round  # noqa: E402
from _atomic_io import atomic_write_json  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RULESETS = ("gi", "nogi")

_ABSENT = object()  # "no cell on disk", distinguishable from a cell that IS None


def _final_cell(final: dict, current: dict, rs: str, frame_unavailable: set, mint: bool):
    """One move's cell for one frame, under the null contract (scripts/_ruleset.py).

    occurrence_moe.py's CONFIG comment is the authority on which of {null, 0} the
    aggregator meant, and it is unambiguous: ``"floor": 1`` — *no available move below 1%
    in its frame* — so every cell the panel judged AVAILABLE is floored to 1, and a final
    of 0 is the ballot-driven UNAVAILABILITY verdict rather than a very small number.
    Above that, a frame the aggregator collapsed entirely is MIRRORED from the other frame
    and named in ``frame_unavailable``; those ints are explicitly placeholders ("2.4 will
    later mark the position unavailable, at which point these mirrored numbers become
    moot"), so the list outranks the ints it ships beside.

    Two rules, and the order matters:

    1. PRESERVE (always on). Where the calibration agrees the edge is unavailable — a
       final of 0, or a frame in ``frame_unavailable`` — an authored null on disk REFINES
       that verdict and is left alone. A calibration that has since changed its mind and
       returns a real number still wins, so the null layer cannot freeze stale data.
    2. MINT (--write-nulls only). Write the null the verdict implies even where the disk
       still holds a number.

    Mint is opt-in because the two sets differ TODAY: the calibration carries 77 zero
    move-cells and 1 frame_unavailable container (11 more cells), while content/Positions
    carries 76 zero cells of which the current pass nulls 60. An unconditional mint would
    therefore write ~16 cells nobody reviewed. Recount both sides before quoting those
    figures (§6.9):
      python3 -c "import json;c=json.load(open('occurrence_calibration.json'))['containers'];print(sum(1 for x in c for m in x['moves'] for rs in ('gi','nogi') if m['final'][rs]==0), sum(len(x['frame_unavailable'])*len(x['moves']) for x in c))"

    Returns ``(value, verdict)``. The verdict is decided HERE, by the branch that
    actually chose the value, and the caller only tallies it — deriving "was that a
    preserved null or a minted one?" a second time from the before/after cells would be a
    second implementation of this decision, agreeing with it by construction (§6.3).

    verdict           meaning
    ----------------  ---------------------------------------------------------------
    number            a real number; there was no authored null here
    null_preserved    an authored null on disk, and the calibration agrees — left alone
    null_minted       a number (or no cell) on disk, replaced by null (--write-nulls)
    null_overwritten  an authored null on disk that the calibration DISAGREES with, so a
                      real number replaced it. Destructive BY DESIGN — the null layer must
                      not freeze stale data — but it is the one outcome here that loses a
                      human's assertion, so it is counted and named, never silent.
    cal_silent        the calibration has no cell for this frame at all
    cal_silent_null   the same, over an authored null
    """
    # A key MISSING from a real {gi,nogi} map is null, not "unstated" — that is as_map()'s
    # reading and this must not be a second one (§6.5). Only a wholly absent (or non-dict)
    # attempt_probability is _ABSENT, i.e. nothing to preserve. 0 of 2,543 position maps
    # are half-pairs today, so the distinction is dormant; it is here because the moment a
    # half-pair appears, the alternative silently re-animates it.
    cur = (current.get(rs) if current else _ABSENT)
    had_null = cur is None
    f = final.get(rs)
    if f is None:
        # The calibration asserts NOTHING about this frame. Silence is not a zero — and it
        # is not a null either: writing None here would mint the structural claim "this
        # edge does not exist in that ruleset" out of an absent measurement, which is the
        # §6.6 defect with its sign flipped. Leave the disk cell exactly as it is and let
        # the caller print that it happened. UNREACHABLE TODAY: 0 of 5,246 final cells in
        # occurrence_calibration.json are missing or null. Recount before quoting (§6.9):
        #   python3 -c "import json;c=json.load(open('occurrence_calibration.json'))['containers'];print(sum(1 for x in c for m in x['moves'] for rs in ('gi','nogi') if m['final'].get(rs) is None))"
        return (None if cur is _ABSENT else cur), ("cal_silent_null" if had_null else "cal_silent")
    unavailable_per_calibration = (rs in frame_unavailable) or (f == 0)
    # `mint` arrives ALREADY SCOPED TO THIS FRAME (see --null-frames). PRESERVE is unscoped on
    # purpose: an authored null in any frame is a decision somebody made and this script must never
    # silently revert it, whichever frame it is in.
    if unavailable_per_calibration and (mint or had_null):
        return None, ("null_preserved" if had_null else "null_minted")
    if had_null:
        return int(f), "null_overwritten"
    return int(f), "number"


def apply_container(entry: dict, dry_run: bool, mint_nulls=()) -> dict:
    rel = entry["file"]
    role = entry["role"]
    finals = {m["transition"]: m["final"] for m in entry["moves"]}

    path = ROOT / rel
    if not path.exists():
        return {"file": rel, "role": role, "status": "error", "reason": "file not found"}
    data = json.loads(path.read_text(encoding="utf-8"))

    if role in ("top", "bottom"):
        container = data.get(role)
        if not isinstance(container, dict) or not isinstance(container.get("transitions"), list):
            return {"file": rel, "role": role, "status": "error", "reason": f"role '{role}' has no transitions"}
        trans = container["transitions"]
    else:  # neutral: root-level transitions
        trans = data.get("transitions")
        if not isinstance(trans, list):
            return {"file": rel, "role": role, "status": "error", "reason": "no root transitions"}

    current = [t.get("transition") for t in trans if isinstance(t, dict)]
    if set(current) != set(finals):
        drift = sorted(set(current) ^ set(finals))
        return {"file": rel, "role": role, "status": "drift",
                "reason": f"move set drifted since elicitation: {drift[:6]}"}

    # The aggregator's own availability verdict for this container. Read it from the
    # entry; never infer it from the ints, which have already been mirrored by then.
    frame_unavailable = set(entry.get("frame_unavailable") or [])

    changed = 0
    tally = {k: 0 for k in ("number", "null_preserved", "null_minted",
                            "null_overwritten", "cal_silent", "cal_silent_null")}
    # Counted from the RAW dict on disk, independently of the verdicts, so the two can be
    # cross-checked below. A count derived from the same branch it is auditing would agree
    # with it no matter what that branch did (§6.3).
    nulls_seen = 0
    for t in trans:
        name = t.get("transition")
        cur = t.get("attempt_probability")
        cur = cur if isinstance(cur, dict) else {}
        nulls_seen += sum(1 for rs in RULESETS if cur.get(rs, _ABSENT) is None)
        new = {}
        for rs in RULESETS:
            new[rs], verdict = _final_cell(finals[name], cur, rs,
                                           frame_unavailable, rs in mint_nulls)
            tally[verdict] += 1
        if cur != new:
            t["attempt_probability"] = new
            changed += 1

    # THE FLOOR (§6.6). Every authored null on disk left through exactly one of two doors:
    # it was preserved, or a calibrated number replaced it. If the arithmetic does not
    # close, a null went somewhere this function cannot name — and that is the shape of
    # every silent-revert bug this file has already had, so it is a hard failure and not a
    # warning. It is also the only thing standing under the PRESERVE rule with the default
    # (mint off) flags: without it, a future edit that quietly stops preserving reports
    # `nulls preserved: 0`, which is exactly what a corpus with no nulls also reports.
    accounted = tally["null_preserved"] + tally["null_overwritten"] + tally["cal_silent_null"]
    if accounted != nulls_seen:
        return {"file": rel, "role": role, "status": "error",
                "reason": f"null accounting does not close: {nulls_seen} authored null "
                          f"cell(s) on disk vs {accounted} accounted for {tally}"}

    # Belt-and-braces: each PRESENT frame must sum to exactly 100. Iterate the cells that
    # exist, never the RULESETS pair blind — a frame with no live cell has no sum to check
    # (present_rulesets() drops it, and so does validate_graph_integrity), and
    # `t["attempt_probability"][rs]` over a nulled frame feeds None into
    # largest_remainder_round, i.e. a TypeError. That crash is not reachable on today's
    # corpus only because the unconditional int-write above overwrote every null before
    # this loop ever read one; the two fixes are one commit, never two.
    fixed_frames = []
    absent_frames = []
    for rs in RULESETS:
        idx = [i for i, t in enumerate(trans) if t["attempt_probability"].get(rs) is not None]
        if not idx:
            absent_frames.append(rs)
            continue
        vals = [float(trans[i]["attempt_probability"][rs]) for i in idx]
        if sum(vals) != 100 and sum(vals) > 0:
            for i, v in zip(idx, largest_remainder_round(vals, 100)):
                trans[i]["attempt_probability"][rs] = v
            fixed_frames.append(rs)

    if not dry_run:
        atomic_write_json(path, data, indent=2, ensure_ascii=False)
    return {"file": rel, "role": role, "status": "applied" if not dry_run else "dry_run",
            "moves_changed": changed, "renormalized_frames": fixed_frames,
            "nulls_seen": nulls_seen,
            "nulls_written": tally["null_minted"],
            "nulls_preserved": tally["null_preserved"] + tally["cal_silent_null"],
            "nulls_overwritten": tally["null_overwritten"],
            "cal_silent_cells": tally["cal_silent"] + tally["cal_silent_null"],
            "absent_frames": absent_frames,
            "declared_unavailable": sorted(frame_unavailable)}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--calibration", default=str(ROOT / "occurrence_calibration.json"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", help="comma-separated container keys to apply (default: all)")
    ap.add_argument("--write-nulls", action="store_true",
                    help="MINT nulls from the calibration's own unavailability verdict "
                         "(a final of 0, or a frame in frame_unavailable) even where the "
                         "corpus still holds a number. OFF by default: an authored null is "
                         "always PRESERVED, but the calibration's zero set is wider than "
                         "the corpus's reviewed null set, so minting is the owner's call, "
                         "not a side effect of re-running the calibration.")
    ap.add_argument("--null-frames", default="nogi",
                    help="WHICH FRAMES --write-nulls may mint into. Default `nogi`, and the default "
                         "is the decision, not a convenience: the two frames' zeros were written "
                         "for different reasons. Every no-gi zero traces to EQUIPMENT — a lapel "
                         "threaded through a leg, four fingers inside a collar — and absence is the "
                         "only honest rendering. Every gi zero is the heel-hook family, zeroed for "
                         "IBJJF LEGALITY, and several of their own availability_rulings say the ban "
                         "is ruleset-dependent (\"sub-only/ADCC-gi voices keep a floor of 1\"). "
                         "Minting a null there would assert the edge DOES NOT EXIST in gi, which is "
                         "a claim about which gi ruleset the app models — the owner's, not this "
                         "script's. Same boundary as EXCLUDING_FRAMES in "
                         "scripts/regenerate_neural_data.py; change them together or they disagree.")
    args = ap.parse_args()
    null_frames = tuple(f for f in args.null_frames.split(",") if f in RULESETS) if args.write_nulls else ()
    if args.write_nulls and not null_frames:
        print(f"[apply_occurrence_calibration] --null-frames matched no ruleset ({args.null_frames!r}) "
              f"— refusing to run a mint that can mint nothing", file=sys.stderr)
        return 1

    cal = json.loads(Path(args.calibration).read_text(encoding="utf-8"))
    containers = cal["containers"]
    if args.only:
        keys = set(args.only.split(","))
        containers = [c for c in containers if c.get("key") in keys]

    results = [apply_container(c, args.dry_run, null_frames) for c in containers]
    by_status = {}
    for r in results:
        by_status.setdefault(r["status"], []).append(r)

    print(f"containers: {len(results)}  "
          + "  ".join(f"{k}={len(v)}" for k, v in sorted(by_status.items())))
    print(f"moves changed: {sum(r.get('moves_changed', 0) for r in results)}")

    # §6.6 positive coverage for the null layer, printed EVERY run. Before this line,
    # "wrote the null layer" and "reverted the null layer" printed the same thing:
    # reverting Lapel Guard bottom's 11 authored nulls printed `moves changed: 11`, byte
    # for byte what a first-time apply prints.
    nulls_seen = sum(r.get("nulls_seen", 0) for r in results)
    nulls_written = sum(r.get("nulls_written", 0) for r in results)
    nulls_preserved = sum(r.get("nulls_preserved", 0) for r in results)
    nulls_overwritten = sum(r.get("nulls_overwritten", 0) for r in results)
    cal_silent = sum(r.get("cal_silent_cells", 0) for r in results)
    absent = sum(len(r.get("absent_frames", [])) for r in results)
    print(f"null contract: authored nulls seen: {nulls_seen}  preserved: {nulls_preserved}  "
          f"OVERWRITTEN by a calibrated number: {nulls_overwritten}  "
          f"minted: {nulls_written}  "
          f"frames skipped as absent: {absent}  "
          f"(mint {'ON --write-nulls' if args.write_nulls else 'off'})")
    if cal_silent:
        # A frame the calibration says nothing about. The disk cell is left exactly as it
        # was — see _final_cell — but silence must never pass for a measurement, so it is
        # its own line rather than folded into "preserved".
        print(f"  calibration silent about {cal_silent} cell(s); disk values left untouched")

    # Naming the containers, not just the count: an overwrite is the one outcome that
    # loses a human's assertion, and "3 nulls overwritten" somewhere in 274 containers is
    # not something anybody can act on.
    over = [r for r in results if r.get("nulls_overwritten")]
    if over:
        print(f"  authored nulls OVERWRITTEN in {len(over)} container(s) — the calibration "
              "now returns a real number where the corpus says the edge does not exist:")
        for r in over:
            print(f"    {r['file']} [{r['role']}] — {r['nulls_overwritten']} cell(s)")

    # The drift abort is the only thing standing between a re-run and every authored null
    # in a drifted container, and it protects them by ACCIDENT — it fires on the move set,
    # which has nothing to do with the null layer. Name the overlap so nobody reads a
    # green run as evidence those cells are safe.
    drift_with_nulls = []
    for bad in by_status.get("drift", []):
        p = ROOT / bad["file"]
        try:
            doc = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        cont = doc.get(bad["role"]) if bad["role"] in ("top", "bottom") else doc
        ts = (cont or {}).get("transitions") or []
        n = sum(1 for t in ts if isinstance(t.get("attempt_probability"), dict)
                for rs in RULESETS if t["attempt_probability"].get(rs) is None)
        if n:
            drift_with_nulls.append((bad["file"], bad["role"], n))
    if drift_with_nulls:
        print(f"  drift containers holding authored nulls: {len(drift_with_nulls)} "
              f"({sum(n for _, _, n in drift_with_nulls)} cells) — protected only by the "
              "drift abort, which does not check the null layer:")
        for f, r, n in drift_with_nulls:
            print(f"    {f} [{r}] — {n} null cells")

    renorm = [r for r in results if r.get("renormalized_frames")]
    if renorm:
        print(f"belt-and-braces renormalized: {len(renorm)} (should be ~0 — aggregation "
              "already sums to 100; investigate if large)")
    for bad in by_status.get("error", []) + by_status.get("drift", []):
        print(f"  {bad['status'].upper()}: {bad['file']} [{bad['role']}] — {bad['reason']}")

    # The floor: --write-nulls that wrote none had nothing to mint, or it stopped working.
    # Those must not look the same — and neither may the floor's own skip, so the branch
    # where nothing was even eligible PRINTS rather than passing quietly.
    if args.write_nulls:
        declared = [r for r in results if r.get("declared_unavailable")
                    and r["status"] in ("applied", "dry_run")]
        with_unavail = [c for c in containers if c.get("frame_unavailable")]
        if not declared:
            print(f"  mint floor SKIPPED: of {len(with_unavail)} container(s) declaring "
                  "frame_unavailable, none reached the write path (drift or missing file) — "
                  "this run is no evidence the mint works.")
        elif not (nulls_written or nulls_preserved):
            print(f"ERROR: --write-nulls processed {len(declared)} container(s) that declare "
                  "frame_unavailable and produced 0 null cells.", file=sys.stderr)
            sys.exit(1)

    if by_status.get("error") or by_status.get("drift"):
        sys.exit(1)


if __name__ == "__main__":
    main()
