#!/usr/bin/env python3
"""Shared probability normalizer for the content/graph pipeline.

A single correct implementation, used by BOTH regenerate_content_json.py and
proofread_all_transitions.py so their probability normalization is identical:

- clamps negatives to 0 (a negative probability breaks the client's
  probability-weighted outcome selection),
- rescales all items proportionally to sum EXACTLY 100 (integers, via the
  largest-remainder method so relative weighting is preserved),
- distributes the all-zero case evenly,
- passes a NULL cell straight through as null (see the contract below).

The null contract (scripts/_ruleset.py, calibration-v2)
-------------------------------------------------------
``None`` in a value vector means "this edge does not exist in this ruleset
frame" -- it is NOT the quantity zero, and it is not a missing measurement to be
filled in. So a null cell is EXCLUDED from the distribution entirely and comes
back as ``None`` at its own index; the target is divided across the cells that
actually exist. Two properties make that safe for every caller:

- LENGTH-PRESERVING. The result is always ``len(values)`` long. 10 of the 12 call
  sites consume the result via ``zip(items, ints)`` or ``ints[i]``, so a shorter
  return list would write each value onto the WRONG item -- silently, with no
  exception and a plausible number on every row (CLAUDE.md 6.6, the positional-join
  trap).
- NULL-PRESERVING, so a skipped cell is visible in the return value at its own
  index rather than inferred. A caller writing the result back cannot resurrect a
  null as 0, and a caller that sums the result gets a loud ``TypeError`` instead of
  a total that quietly lost mass. Pass ``null_cells=[]`` to also collect the
  skipped indices when you want to print a count.

Before this, ``float(None)`` raised ``TypeError`` inside the list comprehension --
which is why every caller pre-coerced with ``or 0`` / ``if c is not None else 0``.
That coercion is the actual damage: measured on real content, nulling all 11 no-gi
cells of Lapel Guard bottom and running it through the normalizer returned
``[10,9,9,9,9,9,9,9,9,9,9]`` -- a frame the corpus says does not exist, RESURRECTED
with fabricated numbers summing to 100. The mixed case (some cells null, some live)
is the variant that actually fires and it never reaches the all-zero branch, so it
is exercised explicitly in the self-test below.
"""

from typing import List, Optional


def largest_remainder_round(
    values: List[Optional[float]],
    target: int = 100,
    null_cells: Optional[List[int]] = None,
) -> List[Optional[int]]:
    """Round floats to ints summing EXACTLY to target (largest-remainder method).

    Negatives are clamped to 0 first. Relative proportions are preserved; the
    leftover units go to the largest fractional parts. Degenerate all-zero (or
    all-negative) input is distributed as evenly as possible.

    ``None`` cells are skipped (see the module docstring): they are excluded from
    the distribution, returned as ``None`` at their own index, and their indices are
    appended to ``null_cells`` when that list is supplied. An ALL-null vector returns
    all nulls -- the frame does not exist, so there is nothing to distribute and the
    target is deliberately NOT placed anywhere.

    On a vector with no nulls this is byte-identical to the pre-null implementation
    (``live`` is every index and ``m == n``), which is what keeps it a no-op on
    today's corpus.
    """
    n = len(values)
    if n == 0:
        return []

    live = [i for i, v in enumerate(values) if v is not None]
    if null_cells is not None:
        null_cells.extend(i for i, v in enumerate(values) if v is None)

    out: List[Optional[int]] = [None] * n
    if not live:
        # Every cell is null: the frame carries no edges at all. Returning [None]*n
        # (rather than an even spread of `target`) is the whole point -- an even spread
        # here is exactly how a deleted frame came back to life summing to 100.
        return out

    m = len(live)
    clamped = [max(0.0, float(values[i])) for i in live]
    total = sum(clamped)
    if total <= 0:
        # All-zero but PRESENT: real authored zeros, spread evenly over the live cells
        # only. `m`, never `n` -- dividing by n would hand units to indices that do not
        # exist in this frame and leave the live cells short of the target.
        base, rem = divmod(target, m)
        for k, i in enumerate(live):
            out[i] = base + (1 if k < rem else 0)
        return out

    scaled = [v * target / total for v in clamped]
    floored = [int(s) for s in scaled]
    remainder = target - sum(floored)
    order = sorted(range(m), key=lambda k: scaled[k] - floored[k], reverse=True)
    for k in range(remainder):
        floored[order[k % m]] += 1
    for k, i in enumerate(live):
        out[i] = floored[k]
    return out


if __name__ == "__main__":
    # Self-test: the null contract, and the byte-identical-on-non-null guarantee.
    # Run: python3 scripts/_prob_norm.py
    import random

    # --- unchanged behaviour on vectors with no nulls -----------------------------
    def _legacy(values, target=100):
        """The pre-null implementation, verbatim, as the differential control."""
        n = len(values)
        if n == 0:
            return []
        clamped = [max(0.0, float(v)) for v in values]
        total = sum(clamped)
        if total <= 0:
            base, rem = divmod(target, n)
            return [base + (1 if i < rem else 0) for i in range(n)]
        scaled = [v * target / total for v in clamped]
        floored = [int(s) for s in scaled]
        remainder = target - sum(floored)
        order = sorted(range(n), key=lambda i: scaled[i] - floored[i], reverse=True)
        for k in range(remainder):
            floored[order[k % n]] += 1
        return floored

    rnd = random.Random(20260901)
    checked = 0
    for _ in range(20000):
        k = rnd.randint(1, 14)
        kind = rnd.random()
        if kind < 0.10:
            vals = [0.0] * k                                  # all-zero branch
        elif kind < 0.20:
            vals = [rnd.uniform(-5, 0) for _ in range(k)]      # all-negative branch
        elif kind < 0.30:
            vals = [rnd.randint(0, 40) for _ in range(k)]      # ints, ties likely
        else:
            vals = [rnd.uniform(0, 100) for _ in range(k)]
        tgt = rnd.choice([100, 100, 100, 97, 12])
        assert largest_remainder_round(vals, tgt) == _legacy(vals, tgt), vals
        checked += 1
    assert checked == 20000
    print(f"_prob_norm self-test: {checked} non-null vectors identical to the legacy result")

    # --- the null contract --------------------------------------------------------
    # length-preserving and null-preserving; the target lands on the live cells only
    assert largest_remainder_round([40.0, None, 60.0]) == [40, None, 60]
    assert largest_remainder_round([1.0, None, 1.0]) == [50, None, 50]
    # all-null: nothing exists, so nothing is distributed (NOT an even spread of 100)
    assert largest_remainder_round([None] * 11) == [None] * 11
    assert largest_remainder_round([None]) == [None]
    # the MIXED case, which never reaches the all-zero branch and is the one that fires:
    # the real Lapel Guard top no-gi hand with its two zero cells nulled and the rest
    # summing to 94 -- the nulls must stay null while the live cells renormalize to 100.
    mixed = [None, None, 16, 23, 13, 14, 22, 10, 2]
    got = largest_remainder_round(mixed)
    assert got[0] is None and got[1] is None, got
    assert sum(v for v in got if v is not None) == 100, got
    # all-zero but PRESENT still spreads, over the live cells only
    assert largest_remainder_round([0, 0, None, 0]) == [34, 33, None, 33]
    # every live cell null-free -> untouched semantics, including target != 100
    assert largest_remainder_round([1.0, 1.0, 1.0], 10) == [4, 3, 3]
    # empty in, empty out
    assert largest_remainder_round([]) == []
    # skipped indices are reportable, not merely inferable
    skipped: List[int] = []
    largest_remainder_round([None, 5.0, None, 5.0], 100, null_cells=skipped)
    assert skipped == [0, 2], skipped

    # A null must never be resurrected by a zip-back round trip (the positional join).
    items = [{"n": "a"}, {"n": "b"}, {"n": "c"}]
    for it, nv in zip(items, largest_remainder_round([None, 30.0, 70.0])):
        it["p"] = nv
    assert [it["p"] for it in items] == [None, 30, 70], items

    print("_prob_norm self-test: OK")
