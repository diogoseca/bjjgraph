#!/usr/bin/env python3
"""Shared gi / no-gi ruleset contract for the content/graph pipeline (calibration-v2).

Every probability that forks by ruleset is stored as a two-key map
``{"gi": <scalar|null>, "nogi": <scalar|null>}`` where:

- the ruleset is always the OUTERMOST key of the forked value,
- ``null`` means "this edge does not exist in that ruleset" (distinct from ``0``
  = "exists but is ~never attempted/successful").

This module is the backward-compat seam during the migration. Legacy data stores
a bare ``int`` (or ``float``); migrated data stores a map. Because the legacy form
is a scalar and the new form is a ``dict``, a reader that forgets to fork fails
loudly (it gets a dict where it expected a number) rather than silently reading
one frame. ``as_map`` normalizes either form to a map by MIRRORING a scalar into
both frames — so during Phase 2.0/2.1 (gi == nogi everywhere) every helper here is
byte-identical to the pre-migration scalar behavior.

Nested map beats parallel ``_gi`` / ``_nogi`` fields: a writer can update one
parallel field and forget the other with no structural signal, whereas a single
map keeps the pair together.
"""

from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple

RULESETS: Tuple[str, str] = ("gi", "nogi")

Number = (int, float)


def is_ruleset_map(v: Any) -> bool:
    """True iff ``v`` is a dict whose keys are a non-empty subset of {gi, nogi}.

    A ``{"value": ..., "description": ...}`` metric dict is NOT a ruleset map.
    """
    return isinstance(v, dict) and bool(v) and set(v.keys()) <= set(RULESETS)


def as_map(v: Any) -> Dict[str, Any]:
    """Normalize a (possibly forked) value to a ``{gi, nogi}`` map.

    - a ruleset map  -> a {gi, nogi} map (missing keys filled with None),
    - a scalar       -> mirrored into both frames,
    - anything else  -> mirrored as-is into both frames (callers decide meaning).
    """
    if is_ruleset_map(v):
        return {rs: v.get(rs) for rs in RULESETS}
    return {rs: v for rs in RULESETS}


def cell(v: Any, ruleset: str) -> Any:
    """The value of one ruleset frame (None if unavailable in that frame)."""
    return as_map(v).get(ruleset)


def available(v: Any, ruleset: str) -> bool:
    """True iff ``v`` has a non-null cell in ``ruleset``."""
    return cell(v, ruleset) is not None


def any_ruleset_map(values: Iterable[Any]) -> bool:
    """True iff any value in the iterable is a ruleset map (i.e. forked data present)."""
    return any(is_ruleset_map(v) for v in values)


def iter_cells(v: Any) -> Iterator[Tuple[Optional[str], Any]]:
    """Yield ``(ruleset, scalar)`` for each present frame.

    - ruleset map -> one pair per non-null frame: ``("gi", x)``, ``("nogi", y)``,
    - scalar      -> a single ``(None, scalar)`` pair (frame-agnostic legacy value),
    - None/other  -> nothing.

    On legacy scalar data this yields exactly one ``(None, value)`` pair, so loops
    over it behave identically to reading the bare scalar.
    """
    if is_ruleset_map(v):
        for rs in RULESETS:
            c = v.get(rs)
            if c is not None:
                yield rs, c
    elif isinstance(v, Number):
        yield None, v


def sum_cells(items: Iterable[dict], key: str, ruleset: str) -> float:
    """Sum ``item[key]``'s ``ruleset`` cell over dict items (non-null numeric cells only)."""
    total = 0.0
    for it in items:
        if not isinstance(it, dict):
            continue
        c = cell(it.get(key), ruleset)
        if isinstance(c, Number):
            total += c
    return total


def present_rulesets(values: Iterable[Any]) -> List[str]:
    """The rulesets that have at least one non-null cell across ``values``.

    For all-scalar input every ruleset is present (scalars mirror into both), which
    keeps the per-ruleset sum checks equivalent to the single legacy sum.
    """
    vals = list(values)
    return [rs for rs in RULESETS if any(available(v, rs) for v in vals)]


if __name__ == "__main__":
    # Self-test: the contract, and the byte-identical-on-scalars guarantee.
    assert is_ruleset_map({"gi": 1, "nogi": 2})
    assert is_ruleset_map({"gi": 1})
    assert not is_ruleset_map({"value": 50, "description": "x"})
    assert not is_ruleset_map(50)
    assert not is_ruleset_map({})

    assert as_map(50) == {"gi": 50, "nogi": 50}
    assert as_map({"gi": 30, "nogi": 40}) == {"gi": 30, "nogi": 40}
    assert as_map({"gi": 30}) == {"gi": 30, "nogi": None}
    assert as_map(None) == {"gi": None, "nogi": None}

    assert cell(50, "gi") == 50 and cell(50, "nogi") == 50
    assert cell({"gi": 30, "nogi": 40}, "nogi") == 40
    assert cell({"gi": 30}, "nogi") is None

    assert available(0, "gi")            # 0 is available (distinct from null)
    assert not available({"gi": 1}, "nogi")
    assert not available(None, "gi")

    assert any_ruleset_map([1, 2, {"gi": 3, "nogi": 4}])
    assert not any_ruleset_map([1, 2, 3])

    assert list(iter_cells(50)) == [(None, 50)]
    assert list(iter_cells({"gi": 30, "nogi": 40})) == [("gi", 30), ("nogi", 40)]
    assert list(iter_cells({"gi": 30})) == [("gi", 30)]
    assert list(iter_cells(None)) == []

    scalars = [{"attempt_probability": 25}, {"attempt_probability": 75}]
    assert sum_cells(scalars, "attempt_probability", "gi") == 100
    assert sum_cells(scalars, "attempt_probability", "nogi") == 100  # mirrored
    maps = [{"p": {"gi": 60, "nogi": 65}}, {"p": {"gi": 40, "nogi": 35}}]
    assert sum_cells(maps, "p", "gi") == 100
    assert sum_cells(maps, "p", "nogi") == 100
    mixed = [{"p": {"gi": 50, "nogi": None}}, {"p": {"gi": 50}}]
    assert sum_cells(mixed, "p", "gi") == 100
    assert sum_cells(mixed, "p", "nogi") == 0  # both null -> 0

    assert present_rulesets([10, 20]) == ["gi", "nogi"]
    assert present_rulesets([{"gi": 5}, {"gi": 95}]) == ["gi"]

    print("_ruleset self-test: OK")
