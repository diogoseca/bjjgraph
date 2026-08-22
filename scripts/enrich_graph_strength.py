#!/usr/bin/env python3
"""Inject precomputed per-role strength into graph.json + globalGraphLayout.json.

Additive, idempotent, and cheap (no node2vec/UMAP): reads the strength formula
from ``score_graph_nodes`` and writes a ``strength`` field onto every position /
transition / submission node so the graph renderers can colour nodes on the
red↔white↔blue ramp keyed to the viewer's role (plan §6.6–§6.7).

Two outputs, both edited in place (positions in the layout are preserved):

  graph.json  (consumed by the local graph via renderPage.getPageGraphData)
    positions["mount/top"].strength    = 0.63            (float, that role)
    positions["mount"].strength        = {top, bottom}   (hub carries both)
    transitions[k].strength            = {attacker, defender}
    submissions[k].strength            = {attacker, defender}

  source/quartz/static/globalGraphLayout.json  (consumed by the background graph)
    nodes[i].s = [v0, v1]   # positions:[top,bottom]; transitions/submissions:[attacker,defender]

Run via ``npm run regenerate:graph-strength`` (chained into ``regenerate`` after
the layout step) or standalone: ``python scripts/enrich_graph_strength.py``.
"""

from __future__ import annotations

import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _slug import slugify  # shared single-source slugify (matches graph.json keys)
import score_graph_nodes as sgn

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRAPH_JSON = os.path.join(_REPO_ROOT, "graph.json")
LAYOUT_JSON = os.path.join(_REPO_ROOT, "source", "quartz", "static", "globalGraphLayout.json")

_ROLE_SUFFIXES = ("/top", "/bottom", "/attacker", "/defender")


def _round(x: float) -> float:
    return round(float(x), 3)


def build_position_strength_by_slug() -> dict[str, dict]:
    """{slug: {"top": float|None, "bottom": float|None, "neutral": float|None}}.

    Keyed by the same slugify() graph.json uses, so role entries resolve directly.
    """
    out: dict[str, dict] = {}
    # parent_slug → list of variation slugs, scored from the parent. That fallback was written
    # when variations "carried only name/slug/description, no metrics of their own" — and that
    # stopped being true: ALL 54 of the 54 nested files now author their own state_properties and
    # position_metrics for both roles. The glob below was non-recursive, so none of them loaded and
    # every one shipped its PARENT HUB's pair — 54 of 136 positions, 40% of the graph. Worst case:
    # `Triangle Control/Rear Triangle` inherited `Triangle Control`, which has the opposite polarity
    # (closed-guard triangle: the TOP player is the one caught), emitting [-0.366, +0.204] for a
    # position whose own numbers score [+0.645, -0.444]. The fallback stays — a variation with no
    # metrics should still inherit — but it must never again fire for one that has them.
    variation_parents: list[tuple[str, str]] = []
    for path in sorted(glob.glob(os.path.join(_REPO_ROOT, "content", "Positions", "**", "*.json"),
                                 recursive=True)):
        try:
            with open(path, encoding="utf-8") as fh:
                d = json.load(fh)
        except (json.JSONDecodeError, OSError):
            continue
        name = d.get("name") or os.path.basename(path)[:-5]
        slug = slugify(d.get("slug", name))
        entry: dict = {"top": None, "bottom": None, "neutral": None}
        has_role = False
        for role in ("top", "bottom"):
            rd = d.get(role)
            if isinstance(rd, dict):
                entry[role] = _round(sgn.position_role_strength(rd))
                has_role = True
        # Neutral positions (Open Guard, Standing) store metrics at top level.
        if not has_role and (d.get("state_properties") or d.get("position_metrics")):
            entry["neutral"] = _round(sgn.position_role_strength(d))
        out[slug] = entry
        for v in d.get("variations") or []:
            if isinstance(v, dict):
                vslug = slugify(v.get("slug") or v.get("name", ""))
                if vslug:
                    variation_parents.append((vslug, slug))

    # Variations inherit their parent's strength — but never overwrite a real
    # standalone position that already scored (e.g. Honey Hole / Saddle).
    for vslug, parent_slug in variation_parents:
        cur = out.get(vslug)
        if cur and any(cur[k] is not None for k in ("top", "bottom", "neutral")):
            continue
        parent = out.get(parent_slug)
        if parent:
            out[vslug] = dict(parent)
    return out


def _target_strength(ending_position: str, pos_by_slug: dict) -> float:
    """Strength of a transition's landing position (its top role by default)."""
    if not ending_position or ending_position == "game-over":
        return 0.0
    ep = ending_position
    role = "top"
    for suf in _ROLE_SUFFIXES:
        if ep.lower().endswith(suf):
            role = suf[1:]
            ep = ep[: -len(suf)]
            break
    e = pos_by_slug.get(ep.lower())
    if not e:
        return 0.0
    if role in ("top", "attacker"):
        v = e.get("top")
    elif role in ("bottom", "defender"):
        v = e.get("bottom")
    else:
        v = None
    if v is None:
        v = e.get("neutral")
    return float(v) if v is not None else 0.0


def transition_strength(entry: dict, pos_by_slug: dict) -> tuple[float, float]:
    """(attacker, defender) for a transition (plan §6.6.2, endingPosition proxy)."""
    try:
        sr = float(entry.get("successRate", 50)) / 100.0
    except (TypeError, ValueError):
        sr = 0.5
    target = _target_strength(entry.get("endingPosition", ""), pos_by_slug)
    att = sgn.clamp_strength(sr * target - (1.0 - sr) * sgn.TRANSITION_FAILURE_COST)
    return _round(att), _round(-att)


def submission_strength(entry: dict) -> tuple[float, float]:
    att, dfn = sgn.submission_strength(entry.get("successRate", 50))
    return _round(att), _round(dfn)


def enrich_graph_json(pos_by_slug: dict) -> dict:
    """Inject strength into graph.json (in place on disk). Returns lookup keyed
    by graph slug for the layout pass: {section: {slug: [v0, v1]}}."""
    with open(GRAPH_JSON, encoding="utf-8") as fh:
        g = json.load(fh)

    layout_strength = {"positions": {}, "transitions": {}, "submissions": {}}

    positions = g.get("positions") or {}
    for slug, e in pos_by_slug.items():
        top, bottom, neutral = e["top"], e["bottom"], e["neutral"]
        if f"{slug}/top" in positions and top is not None:
            positions[f"{slug}/top"]["strength"] = top
        if f"{slug}/bottom" in positions and bottom is not None:
            positions[f"{slug}/bottom"]["strength"] = bottom
        if slug in positions:
            if top is not None or bottom is not None:
                positions[slug]["strength"] = {"top": top, "bottom": bottom}
            elif neutral is not None:
                positions[slug]["strength"] = {"top": neutral, "bottom": neutral}
        # Layout pair (hub-level): prefer top/bottom, fall back to neutral.
        v0 = top if top is not None else neutral
        v1 = bottom if bottom is not None else neutral
        if v0 is not None or v1 is not None:
            layout_strength["positions"][slug] = [v0 if v0 is not None else 0.0,
                                                  v1 if v1 is not None else 0.0]

    # Techniques are role-split (hub + /attacker + /defender). Compute the (attacker, defender)
    # strength pair from the ATTACKER role-node (it carries successRate/endingPosition), then write
    # a SCALAR onto each role-node and the {attacker,defender} DICT onto the edgeless hub — exactly
    # mirroring how positions do it (scalar on /top,/bottom; dict on the hub). The layout pair stays
    # keyed by the bare hub slug so the hub-collapsed background graph is unchanged.
    trs = g.get("transitions") or {}
    for slug, entry in trs.items():
        if entry.get("role") in ("attacker", "defender"):
            continue  # handled via their hub
        att_node = trs.get(f"{slug}/attacker")
        att, dfn = transition_strength(att_node or entry, pos_by_slug)
        if att_node:
            trs[f"{slug}/attacker"]["strength"] = att
            trs[f"{slug}/defender"]["strength"] = dfn
        entry["strength"] = {"attacker": att, "defender": dfn}
        layout_strength["transitions"][slug] = [att, dfn]

    subs = g.get("submissions") or {}
    for slug, entry in subs.items():
        if entry.get("role") in ("attacker", "defender"):
            continue  # handled via their hub (family hubs have no role and fall through)
        att_node = subs.get(f"{slug}/attacker")
        att, dfn = submission_strength(att_node or entry)
        if att_node:
            subs[f"{slug}/attacker"]["strength"] = att
            subs[f"{slug}/defender"]["strength"] = dfn
        entry["strength"] = {"attacker": att, "defender": dfn}
        layout_strength["submissions"][slug] = [att, dfn]

    # Pretty-print graph.json (indent=2) to match regenerate_graph.py's writer, so the canonical
    # `regenerate:graph` umbrella produces ONE consistent format regardless of which step wrote last
    # (previously base wrote pretty, strength overwrote minified → spurious whole-file diffs).
    with open(GRAPH_JSON, "w", encoding="utf-8") as fh:
        json.dump(g, fh, indent=2, ensure_ascii=False)
    return layout_strength


def _layout_id_to_lookup(node_id: str) -> tuple[str, list[str]]:
    """('Positions/Mount' | 'Submissions/Can-Opener/from-Closed-Guard') →
    (section, [candidate graph_slugs]). Mirrors renderPage.getPageGraphData
    resolution, plus a parent fallback so position *variations*
    ('positions/half-guard/lockdown') inherit their hub's ('half-guard')
    strength when no standalone file exists."""
    lower = node_id.lower()
    for section, prefix in (("positions", "positions/"),
                            ("transitions", "transitions/"),
                            ("submissions", "submissions/")):
        if lower.startswith(prefix):
            rest = lower[len(prefix):]
            # Full flatten is the real key for compound submission/transition ids.
            candidates = [rest.replace("/", "-")]
            # LEAF SLUG, for positions only. A nested position variation registers under its OWN
            # `slug` ("rear-triangle"), not under the flattened path ("triangle-control-rear-
            # triangle") — so without this the flatten misses, the parent fallback fires, and the
            # variation silently wears its hub's strength. That is what made
            # `Triangle Control/Rear Triangle` emit the closed-guard triangle's pair, inverted.
            # Positions only: a submission id like `Kimura/from-Mount` has a leaf ("from-mount")
            # that is not a slug at all, and giving it a chance to collide buys nothing.
            if section == "positions" and "/" in rest:
                candidates.append(rest.rsplit("/", 1)[1])
            # Parent fallback (drop the last "/" segment) for variations with no metrics of their own.
            if "/" in rest:
                candidates.append(rest.rsplit("/", 1)[0].replace("/", "-"))
            return section, candidates
    return "", []


def enrich_layout(layout_strength: dict) -> tuple[int, int]:
    if not os.path.exists(LAYOUT_JSON):
        print(f"  WARN: {LAYOUT_JSON} not found; skipping layout enrichment", file=sys.stderr)
        return 0, 0
    with open(LAYOUT_JSON, encoding="utf-8") as fh:
        layout = json.load(fh)
    matched = 0
    misses: list[str] = []
    nodes = layout.get("nodes", [])
    for n in nodes:
        section, candidates = _layout_id_to_lookup(n.get("id", ""))
        if not candidates:
            n.pop("s", None)
            continue
        # Prefer the prefix-indicated section, but the layout's prefix can be
        # stale or mis-sectioned (a submission-entry filed under transitions/),
        # so try every candidate slug across every section before giving up.
        ordered = [section] + [s for s in ("positions", "transitions", "submissions") if s != section]
        pair = None
        for slug in candidates:
            for sect in ordered:
                pair = layout_strength.get(sect, {}).get(slug)
                if pair is not None:
                    break
            if pair is not None:
                break
        if pair is not None:
            n["s"] = pair
            matched += 1
        else:
            n.pop("s", None)  # keep idempotent: drop stale strength on misses
            misses.append(n.get("id", "?"))
    with open(LAYOUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(layout, fh, separators=(",", ":"))
    return matched, len(nodes), misses


def main() -> int:
    if not os.path.exists(GRAPH_JSON):
        print("ERROR: graph.json not found; run `npm run regenerate:graph` first", file=sys.stderr)
        return 1
    pos_by_slug = build_position_strength_by_slug()
    layout_strength = enrich_graph_json(pos_by_slug)
    n_pos = len(layout_strength["positions"])
    n_tr = len(layout_strength["transitions"])
    n_sub = len(layout_strength["submissions"])
    print(f"[enrich_graph_strength] graph.json: {n_pos} positions, {n_tr} transitions, {n_sub} submissions scored")
    matched, total, misses = enrich_layout(layout_strength)
    print(f"[enrich_graph_strength] globalGraphLayout.json: {matched}/{total} nodes carry strength")
    if misses:
        shown = ", ".join(misses[:12])
        print(f"[enrich_graph_strength] {len(misses)} node(s) fall back to default colour "
              f"(stale/merged or punctuation-slug): {shown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
