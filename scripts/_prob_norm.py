#!/usr/bin/env python3
"""Shared probability normalizer for the content/graph pipeline.

A single correct implementation, used by BOTH regenerate_content_json.py and
proofread_all_transitions.py so their probability normalization is identical:

- clamps negatives to 0 (a negative probability breaks the client's
  probability-weighted outcome selection),
- rescales all items proportionally to sum EXACTLY 100 (integers, via the
  largest-remainder method so relative weighting is preserved),
- distributes the all-zero case evenly.
"""

from typing import List


def largest_remainder_round(values: List[float], target: int = 100) -> List[int]:
    """Round floats to ints summing EXACTLY to target (largest-remainder method).

    Negatives are clamped to 0 first. Relative proportions are preserved; the
    leftover units go to the largest fractional parts. Degenerate all-zero (or
    all-negative) input is distributed as evenly as possible.
    """
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
