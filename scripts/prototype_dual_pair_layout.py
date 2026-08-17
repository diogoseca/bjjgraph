#!/usr/bin/env python3
"""prototype_dual_pair_layout.py — PROTOTYPE: the dual close-pair visual graph.

Owner decision (feedback-graph-dual-close-pairs): every dual state becomes TWO visual
nodes — position Top/Bottom, technique Attacker/Defender — "not exactly the same point,
but very close together". This script emits TWO candidate graph-data variants for the
Neural app to render behind `?dual=fixed` / `?dual=force`, so the owner can judge
"healthy, great-looking, representative of the truth" from screenshots.

  - graph-data-dual-fixed.json : each pair split a small FIXED distance along one
    consistent axis (top/attacker member up-right, bottom/defender down-left).
  - graph-data-dual-force.json : pair members placed by a LOCAL force relaxation —
    strong pair spring at rest length D, weak anchor to the old hub point, and
    collision repulsion against every neighbour — so each pair finds its own axis.

Inputs (all read-only): source/quartz/static/globalGraphLayout.json (hub layout,
preserve-coords — the beloved global shape is kept), graph.json (role truth),
node_ordinals.json (hub ordinals; members carry o=null — share identity for role
nodes is exactly what the migration plan mints later, NOT this prototype).

Output: tests/artifacts/dualpair/payloads/graph-data-dual-{fixed,force}.json (gitignored).
DELIBERATELY NOT under source/quartz/static/neural/: check_payload_budget.py scores that whole
directory (eager set 2.5MB raw / deferred cap 500KB), and these two 2.2MB opt-in payloads are
prototype-only — they are copied into the PRIVATE serve root (.privserve/public/static/neural/)
by the screenshot run, never into the shipped tree. The production build stays byte-identical.

Edges are ROLE-CORRECT, from graph.json rather than the hub-collapsed links:
  position member (its role)  -> technique ATTACKER member   (attempt edges)
  technique ATTACKER member   -> landing position member of the authored role
  pair-link between the two members of every pair (drawn tie, marked "pair": true)
Defender members carry only the pair link: in the data model their edges are pure
role-flipped mirrors of the attacker's, and drawing both would double every edge on
screen — an open design question for the owner, listed in the report.

NOT wired into any gate or npm script. Does not touch node_ordinals.json.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from _slug import slugify  # canonical slugify (shared with node ids)

LAYOUT = ROOT / "source/quartz/static/globalGraphLayout.json"
GRAPH = ROOT / "graph.json"
ORDINALS = ROOT / "node_ordinals.json"
OUT_DIR = ROOT / "tests/artifacts/dualpair/payloads"

# Pair geometry. Center-to-center distance between the two members of a pair, in layout
# units (the app's ingest de-overlap enforces ~r_a+r_b+3.5 ≈ 9-12 between STRANGERS and
# is patched to skip same-pair pushes, so the pair gap stays visibly tighter than any
# stranger gap — that contrast is what makes a pair read as a pair).
PAIR_DIST = 8.0
# fixed-strategy axis: one consistent direction for the whole graph. 25° keeps the pair
# mostly horizontal (labels don't stack) while clearly not axis-aligned with the grid.
AXIS_DEG = 25.0

SECTION_TY = {"positions": "positions", "transitions": "transitions", "submissions": "submissions"}


def _slug_from_id(node_id: str) -> str:
    tail = node_id.split("/", 1)[1] if "/" in node_id else node_id
    return tail.lower()


def load_inputs():
    layout = json.loads(LAYOUT.read_text())
    graph = json.loads(GRAPH.read_text())
    ordinals = (json.loads(ORDINALS.read_text()).get("ordinals") or {}) if ORDINALS.exists() else {}
    return layout, graph, ordinals


def pos_role_entry(graph: dict, slug: str, role: str):
    """graph.json position role-node for a layout slug; nested layout slugs are compound
    ('ashi-garami/50-50-guard') while graph.json keys are bare ('50-50-guard/top')."""
    cands = [slug, slug.rsplit("/", 1)[-1]] if "/" in slug else [slug]
    for c in cands:
        n = graph["positions"].get(f"{c}/{role}")
        if n:
            return n
    return None


def frame_positive(t: dict, frame: str) -> bool:
    apr = t.get("attemptProbabilityByRuleset")
    v = apr.get(frame) if isinstance(apr, dict) else t.get("attemptProbability")
    return isinstance(v, (int, float)) and v > 0


def build(strategy: str) -> dict:
    layout, graph, ordinals = load_inputs()

    # ---- index layout hubs -------------------------------------------------------
    tech_by_slug: dict[str, dict] = {}   # bare technique slug -> layout hub node
    pos_by_slug: dict[str, dict] = {}    # posId (compound) AND bare tail -> layout hub node
    for n in layout["nodes"]:
        cat = n["id"].split("/", 1)[0].lower()
        ty = SECTION_TY.get(cat)
        if ty is None:
            continue
        slug = _slug_from_id(n["id"])
        if ty == "positions":
            pos_by_slug.setdefault(slug, n)
            if "/" in slug:
                pos_by_slug.setdefault(slug.rsplit("/", 1)[-1], n)
        else:
            tech_by_slug.setdefault(slug, n)
            if "/" in slug:  # nested layout id ('armbar/from-mount') ⇄ graph slug ('armbar-from-mount')
                tech_by_slug.setdefault(slug.replace("/", "-"), n)

    # ---- decide duality + emit members ------------------------------------------
    # member node shape mirrors regenerate_neural_data.py's graph-data node, plus:
    #   role  : "top"|"bottom"|"attacker"|"defender"|None (single/neutral)
    #   pairId: the partner member's id (the app skips de-overlap between partners
    #           and draws the pair tie from the emitted pair link)
    nodes_out: list[dict] = []
    member_ids: dict[tuple[str, str], str] = {}  # (hub layout id, role) -> member id

    def tech_avail_map():
        avail = {}
        for node in graph.get("positions", {}).values():
            for t in node.get("transitions", []) or []:
                nm = t.get("technique")
                if not nm:
                    continue
                av = avail.setdefault(slugify(nm), {"gi": False, "nogi": False})
                for fr in ("gi", "nogi"):
                    if frame_positive(t, fr):
                        av[fr] = True
        return avail

    tech_avail = tech_avail_map()

    def pos_cal(slug: str, roles: list[str]):
        out, avail = {}, {"gi": False, "nogi": False}
        for role in roles:
            n = pos_role_entry(graph, slug, role)
            if n and n.get("transitions"):
                out[role] = [
                    {
                        "technique": t.get("technique"),
                        "attemptProbability": t.get("attemptProbability"),
                        "attemptProbabilityByRuleset": t.get("attemptProbabilityByRuleset"),
                        "successRate": t.get("successRate"),
                    }
                    for t in n["transitions"]
                ]
                for t in n["transitions"]:
                    for fr in ("gi", "nogi"):
                        if frame_positive(t, fr):
                            avail[fr] = True
        if not out:
            return None
        return {"moves": out, "avail": avail}

    def tech_cal(ty: str, slug: str):
        n = graph[ty].get(f"{slug}/attacker") or graph[ty].get(slug)
        if not n:
            return None, None
        e = {}
        for k in ("successRate", "successRateByRuleset", "outcomes", "endingPosition"):
            if n.get(k) is not None:
                e[k] = n[k]
        av = tech_avail.get(slug)
        if av:
            e["avail"] = av
        return (e or None), n

    def base_member(hub: dict, ty: str, role, suffix, s_idx):
        # `s` stays the FULL [top,bottom]/[attacker,defender] pair on BOTH members — the app's
        # myVal() role-indexes it, so slicing it would flip roll math. `sv` is the member's OWN
        # side's value, used only to COLOR the member (the truthful pair differentiation).
        s = hub.get("s")
        mid = hub["id"] + ("/" + suffix if suffix else "")
        out = {
            "id": mid,
            "x": hub.get("x"),
            "y": hub.get("y"),
            "t": hub.get("t"),
            "ty": ty,
            "s": s,
            "role": role,
            "o": ordinals.get(hub["id"]) if not suffix else None,
        }
        if role and isinstance(s, list) and len(s) > s_idx and isinstance(s[s_idx], (int, float)):
            out["sv"] = s[s_idx]
        return out

    n_pairs = n_single = 0
    for hub in layout["nodes"]:
        cat = hub["id"].split("/", 1)[0].lower()
        ty = SECTION_TY.get(cat)
        if ty is None:
            continue
        slug = _slug_from_id(hub["id"])
        # posId is the LEAF slug for positions (v1.103.0 convention, mirrors
        # regenerate_neural_data.py): techniques author `fromPositionId` as the position's own
        # bare slug ("rear-triangle"), so a compound path here would starve optionsFor's origin
        # filter exactly the way the 54 nested positions were starved before v1.103.0.
        pos_leaf = slug.rsplit("/", 1)[-1]
        if ty == "positions":
            has = [r for r in ("top", "bottom") if pos_role_entry(graph, slug, r)]
            if len(has) == 2:
                a = base_member(hub, ty, "top", "Top", 0)
                b = base_member(hub, ty, "bottom", "Bottom", 1)
                for m, other in ((a, b), (b, a)):
                    m["posId"] = pos_leaf
                    m["pairId"] = other["id"]
                    cal = pos_cal(slug, [m["role"]])
                    if cal:
                        m["cal"] = cal
                rn = pos_role_entry(graph, slug, "top") or pos_role_entry(graph, slug, "bottom")
                if rn and rn.get("familyHub"):
                    a["familyHub"] = b["familyHub"] = rn["familyHub"]
                member_ids[(hub["id"], "top")] = a["id"]
                member_ids[(hub["id"], "bottom")] = b["id"]
                nodes_out.extend([a, b])  # attacker-side/top FIRST (byName + bare-slug priority)
                n_pairs += 1
            else:  # neutral / single-role position stays ONE node
                m = base_member(hub, ty, None, "", 0)
                m["posId"] = pos_leaf
                m["s"] = hub.get("s")
                cal = pos_cal(slug, ["top", "bottom"])
                if cal:
                    m["cal"] = cal
                member_ids[(hub["id"], "top")] = m["id"]
                member_ids[(hub["id"], "bottom")] = m["id"]
                nodes_out.append(m)
                n_single += 1
        else:
            cal, src = tech_cal(ty, slug)
            fp = {
                "fromPosition": hub.get("fromPosition"),
                "fromPositionId": hub.get("fromPositionId"),
                "fromRole": hub.get("fromRole"),
            }
            if graph[ty].get(f"{slug}/attacker"):
                a = base_member(hub, ty, "attacker", "Attacker", 0)
                d = base_member(hub, ty, "defender", "Defender", 1)
                a.update(fp)
                d.update(fp)
                a["posId"] = hub.get("fromPositionId")
                d["posId"] = hub.get("fromPositionId")
                a["pairId"] = d["id"]
                d["pairId"] = a["id"]
                if cal:
                    a["cal"] = cal
                member_ids[(hub["id"], "attacker")] = a["id"]
                member_ids[(hub["id"], "defender")] = d["id"]
                nodes_out.extend([a, d])
                n_pairs += 1
            else:  # technique with no role-split in graph.json — keep single
                m = base_member(hub, ty, None, "", 0)
                m.update(fp)
                m["posId"] = hub.get("fromPositionId")
                m["s"] = hub.get("s")
                if cal:
                    m["cal"] = cal
                member_ids[(hub["id"], "attacker")] = m["id"]
                nodes_out.append(m)
                n_single += 1

    by_id = {n["id"]: n for n in nodes_out}

    # ---- role-correct links ------------------------------------------------------
    links: list[dict] = []
    seen: set[tuple[str, str]] = set()

    def add_link(a: str, b: str, pair: bool = False):
        if a == b or a not in by_id or b not in by_id:
            return
        key = (a, b) if a <= b else (b, a)
        if key in seen:
            return
        seen.add(key)
        l = {"source": a, "target": b}
        if pair:
            l["pair"] = True
        links.append(l)

    # pair ties
    for n in nodes_out:
        if n.get("pairId"):
            add_link(n["id"], n["pairId"], pair=True)

    # attempt edges: position member (role) -> technique attacker member
    for hub in layout["nodes"]:
        cat = hub["id"].split("/", 1)[0].lower()
        if SECTION_TY.get(cat) != "positions":
            continue
        slug = _slug_from_id(hub["id"])
        for role in ("top", "bottom"):
            entry = pos_role_entry(graph, slug, role)
            if not entry:
                continue
            src_id = member_ids.get((hub["id"], role))
            if not src_id:
                continue
            for t in entry.get("transitions", []) or []:
                tgt = (t.get("target") or "").lower()
                th = tech_by_slug.get(tgt)
                if th is None:
                    continue
                dst = member_ids.get((th["id"], "attacker"))
                if dst:
                    add_link(src_id, dst)

    # outcome edges: technique attacker member -> landing member (authored role) | technique
    for hub in layout["nodes"]:
        cat = hub["id"].split("/", 1)[0].lower()
        ty = SECTION_TY.get(cat)
        if ty in (None, "positions"):
            continue
        slug = _slug_from_id(hub["id"])
        src_entry = graph[ty].get(f"{slug}/attacker") or graph[ty].get(slug)
        if not src_entry:
            continue
        src_id = member_ids.get((hub["id"], "attacker"))
        if not src_id:
            continue
        for o in src_entry.get("outcomes", []) or []:
            to = (o.get("to") or "").strip().lower()
            if not to or to == "game-over":
                continue
            role = None
            base = to
            for suf in ("/top", "/bottom"):
                if to.endswith(suf):
                    role, base = suf[1:], to[: -len(suf)]
                    break
            if role:
                ph = pos_by_slug.get(base)
                if ph is not None:
                    dst = member_ids.get((ph["id"], role))
                    if dst:
                        add_link(src_id, dst)
                continue
            th = tech_by_slug.get(base)
            if th is not None:
                dst = member_ids.get((th["id"], "attacker"))
                if dst:
                    add_link(src_id, dst)
                continue
            ph = pos_by_slug.get(base)
            if ph is not None:  # bare position target (defensive: shouldn't occur)
                dst = member_ids.get((ph["id"], "top"))
                if dst:
                    add_link(src_id, dst)

    # ---- degree (for radii used by the force pass) -------------------------------
    deg = {n["id"]: 0 for n in nodes_out}
    for l in links:
        deg[l["source"]] += 1
        deg[l["target"]] += 1

    def radius(nid: str) -> float:
        return 2.0 + min(5.5, math.sqrt(deg[nid]) * 0.62)

    # ---- coordinates -------------------------------------------------------------
    if strategy == "fixed":
        ux, uy = math.cos(math.radians(AXIS_DEG)), math.sin(math.radians(AXIS_DEG))
        h = PAIR_DIST / 2.0
        for n in nodes_out:
            if not n.get("pairId"):
                continue
            up = n["role"] in ("top", "attacker")  # up-right member; partner down-left
            sgn = 1.0 if up else -1.0
            n["x"] = round(n["x"] + sgn * ux * h, 1)
            n["y"] = round(n["y"] - sgn * uy * h, 1)  # screen y grows downward
    else:  # force: local relaxation, pairs place themselves; singles stay put
        relax_pairs(nodes_out, radius)

    for n in nodes_out:
        n["x"] = round(float(n["x"]), 1)
        n["y"] = round(float(n["y"]), 1)

    print(f"[dual-{strategy}] {len(nodes_out)} nodes ({n_pairs} pairs, {n_single} single), {len(links)} links")
    return {"nodes": nodes_out, "links": links}


def relax_pairs(nodes: list[dict], radius, iters: int = 250):
    """Strong pair spring (rest PAIR_DIST) + weak anchor to the hub point + collision
    repulsion against everything nearby. Only pair members move."""
    import random

    rng = random.Random(42)
    xs = {n["id"]: float(n["x"]) for n in nodes}
    ys = {n["id"]: float(n["y"]) for n in nodes}
    anchor = {n["id"]: (float(n["x"]), float(n["y"])) for n in nodes}
    movable = [n["id"] for n in nodes if n.get("pairId")]
    pair = {n["id"]: n.get("pairId") for n in nodes}
    # split seed: tiny random kick so the spring has a direction to work with
    for nid in movable:
        th = rng.uniform(0, 2 * math.pi)
        xs[nid] += math.cos(th) * 0.6
        ys[nid] += math.sin(th) * 0.6

    ids = [n["id"] for n in nodes]
    rad = {nid: radius(nid) for nid in ids}
    CELL = 24.0

    for it in range(iters):
        # spatial hash over ALL nodes (movable repel against fixed singles too)
        grid: dict[tuple[int, int], list[str]] = {}
        for nid in ids:
            key = (int(xs[nid] // CELL), int(ys[nid] // CELL))
            grid.setdefault(key, []).append(nid)
        k_pair, k_anchor, k_push = 0.35, 0.03, 0.45
        for nid in movable:
            fx = fy = 0.0
            x, y = xs[nid], ys[nid]
            # pair spring
            p = pair[nid]
            dx, dy = xs[p] - x, ys[p] - y
            d = math.hypot(dx, dy) or 1e-6
            f = k_pair * (d - PAIR_DIST)
            fx += f * dx / d
            fy += f * dy / d
            # anchor to hub point
            ax, ay = anchor[nid]
            fx += (ax - x) * k_anchor
            fy += (ay - y) * k_anchor
            # collision repulsion (skip own partner)
            cx, cy = int(x // CELL), int(y // CELL)
            for gx in (cx - 1, cx, cx + 1):
                for gy in (cy - 1, cy, cy + 1):
                    for oid in grid.get((gx, gy), ()):
                        if oid == nid or oid == p:
                            continue
                        ddx, ddy = x - xs[oid], y - ys[oid]
                        dd = math.hypot(ddx, ddy)
                        gap = rad[nid] + rad[oid] + 3.5
                        if dd >= gap:
                            continue
                        if dd < 1e-3:
                            th = rng.uniform(0, 2 * math.pi)
                            ddx, ddy, dd = math.cos(th), math.sin(th), 1.0
                        f = k_push * (gap - dd) / dd
                        fx += f * ddx
                        fy += f * ddy
            xs[nid] = x + fx * 0.5
            ys[nid] = y + fy * 0.5
    for n in nodes:
        n["x"] = xs[n["id"]]
        n["y"] = ys[n["id"]]


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for strategy in ("fixed", "force"):
        data = build(strategy)
        out = OUT_DIR / f"graph-data-dual-{strategy}.json"
        out.write_text(json.dumps(data, separators=(",", ":")))
        print(f"[dual-{strategy}] wrote {out}")


if __name__ == "__main__":
    main()
