#!/usr/bin/env python3
"""Q-Neural data bridge (Phase 0.1) — emit the data files the Neural Graph front-end
fetches, generated from our LIVE calibrated sources so the new UI shows the same numbers
as the legacy site (page == graph == game invariant).

Outputs (into source/quartz/static/neural/, mirroring how globalGraphLayout.json is a
generated+committed static asset):
  - graph-data.json : {nodes, links, toTab, evLam, evFrame} — a reshape of source/quartz/static/globalGraphLayout
    .json (the visual projection) into the Neural app's node shape
    {id,x,y,t,ty,s,fromPositionId,fromRole,posId?,o,cal?} with null keys omitted. Each node
    is additionally enriched with the calibrated numbers from graph.json: for technique
    nodes successRate + successRateByRuleset (differing frames only) + outcomes as
    [toTabIdx, probability, s|f|c] tuples — slot 0 is an INDEX into the top-level `toTab`
    string table, not the destination id itself (interned v1.144.0; the client resolves it
    on ingest) — + avail; for position nodes `ew` (precomputed
    [nodeIdx, weight*10000] edge-lighting pairs, replacing the raw per-move tables) + avail
    + `ev`, the EDGE table that ranks the option cards (one independent MDP solve per
    loss-aversion preset — see build_move_edge, and the file-level `evLam`/`evFrame` that say
    which presets and which ruleset the table describes).
    Links are [sourceIdx, targetIdx] pairs. This is the largest BOOT payload; the wire is
    compact and app.src.jsx ingest() expands it back into the legacy shapes (v1.107.0).
  - flashcards/<slug>.json : one file PER DECK ({cat,role,cards:[{q,a}]}) — the full
    calibrated decks from graph.json, chunked so the app fetches only the deck it opens
    (the monolith was 13.5 MB; each deck is a few KB).
  - flashcards/_index.json : manifest {_meta, decks:{"<Name>|<Role>": [cat, n]}, shared}
    resolving each deck key -> its card count (the "what decks exist" list; the chunk address is
    derived from the key). `shared` maps fnv1a32(question) -> the deck indexes carrying that
    question, for the 451 questions the blended hierarchy duplicates across decks, so the app's
    cross-deck credit does not depend on which chunks have landed.
  - systems.json : the 47 expert Systems as the app's library + graph-highlight source
    ({_meta, systems:[{id,name,url,summary,type,difficulty,nodes,unresolved,products}]}).
    `nodes` are graph-data.json node ids, so selecting a System can light up exactly the
    part of the graph it teaches; `products` carries the curated BJJFanatics affiliate
    entries VERBATIM from content (never synthesized — a fabricated affiliate URL is a
    broken promise to a paying customer).

Deterministic (stable ordering) so re-runs diff cleanly; safe to wire into `regenerate`.
Read-only w.r.t. all existing content/graph.
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from _slug import slugify  # canonical slugify (shared with node ids)
LAYOUT = ROOT / "source/quartz/static/globalGraphLayout.json"
GRAPH = ROOT / "graph.json"
ORDINALS = ROOT / "node_ordinals.json"
SYSTEMS_DIR = ROOT / "content/Systems"
OUT_DIR = ROOT / "source/quartz/static/neural"

SECTION_TY = {"positions": "positions", "transitions": "transitions", "submissions": "submissions"}
SECTION_CAT = {"positions": "Position", "transitions": "Transition", "submissions": "Submission"}

# ── JOIN STRICTNESS ────────────────────────────────────────────────────────────────────────────
# The join checks below REPORT by default and raise only under BJJ_JOIN_STRICT=1. Nothing wires
# that variable up yet, deliberately.
#
# They are written as gates and mutation-proven as gates: every one has been watched to fail on a
# deliberate break. What holds them at exit 0 is not doubt about the checks, it is that the defect
# they found is real and UNFIXED — 10 deck keys and 5 dossier keys collide today — and the fix is a
# per-key content ruling (rename / drop / add a dealt edge) that changes what a player is dealt.
# Failing the build before that ruling lands would turn CI red on every branch in the repo for a
# decision none of those branches can make.
#
# So this ships as MEASUREMENT: the loss is named, counted and printed on every run, which is the
# thing that was missing when 90 cards went silently missing. Flip the variable in the same commit
# that lands the content ruling, and delete this block when it is on by default.
JOIN_STRICT = os.environ.get("BJJ_JOIN_STRICT") == "1"


def _join_report(errs: list, what: str) -> None:
    """Raise under BJJ_JOIN_STRICT=1, otherwise print the same finding and carry on.

    The wording differs between the two modes on purpose: under report-only the emitter did NOT
    refuse anything, and a log line claiming it did would be the third false-authority note this
    week."""
    if not errs:
        return
    head = (f"[neural] {what} REFUSING TO EMIT" if JOIN_STRICT else
            f"[neural] {what} REPORT-ONLY, emitting anyway (set BJJ_JOIN_STRICT=1 to fail)")
    body = head + ":\n    " + "\n    ".join(errs)
    if JOIN_STRICT:
        raise SystemExit(body)
    print(body)



def _slug_from_id(node_id: str) -> str:
    """'Positions/Gogoplata-Control' -> 'gogoplata-control' (the app's posId convention)."""
    tail = node_id.split("/", 1)[1] if "/" in node_id else node_id
    return tail.lower()


def load_ordinals() -> dict:
    """node_ordinals.json's id -> permanent ordinal map (the share-link identity space).

    HARD requirement, not best-effort: a share link encodes ordinals, so a node shipped to
    the browser WITHOUT one can never appear in a shared class list. The lockfile is
    committed, so the only way to get here is a layout regenerated without
    `npm run regenerate:ordinals` — fail loudly rather than silently ship holes.
    """
    if not ORDINALS.exists():
        print(f"ERROR: {ORDINALS} missing — run `npm run regenerate:ordinals`", file=sys.stderr)
        sys.exit(1)
    lock = json.loads(ORDINALS.read_text())
    ords = lock.get("ordinals") or {}
    if not ords:
        print(f"ERROR: {ORDINALS} has no ordinals", file=sys.stderr)
        sys.exit(1)
    return ords


def _frame_attempt(t, frame: str):
    """This position edge's attempt probability in `frame`, or None if it carries no number.

    THE ONE PLACE THE {gi, nogi} PAIR IS READ. `attemptProbability` is the folded NO-GI scalar and
    `attemptProbabilityByRuleset` is the pair, on the same dict on every edge. Reading the scalar
    where the frame is known is a defect this function exists to make unspellable — see
    `_frame_positive`, and `scripts/validate_score_coverage.py` for the one that is still open.
    """
    apr = t.get("attemptProbabilityByRuleset")
    v = apr.get(frame) if isinstance(apr, dict) else t.get("attemptProbability")
    return v if isinstance(v, (int, float)) else None


def _frame_positive(t, frame: str) -> bool:
    """True if this position edge is attempted in `frame` (attemptProbability > 0).

    MODULE SCOPE ON PURPOSE. Two readers ask this question now — `tech_avail` below (which drives
    the app's `giAllows`) and `validate_score_coverage.frame_avail_by_deck` (which sizes what the
    score can see). When one question is answered in two places one of them is already wrong.
    """
    v = _frame_attempt(t, frame)
    return v is not None and v > 0

def build_graph_data(layout: dict, graph: dict, ordinals: dict) -> dict:
    """Reshape globalGraphLayout nodes/links into the Neural graph-data.json shape,
    enriching each node with its calibrated numbers from graph.json."""
    # index graph.json role-nodes by their display id used in the layout:
    #   layout id 'Positions/Mount' hub collapses top/bottom; techniques -> attacker node.
    # We match on the lowercased slug carried in each graph node's own id space.
    by_slug = {}
    for section in ("positions", "transitions", "submissions"):
        for nid, node in graph.get(section, {}).items():
            by_slug[(section, nid)] = node

    # per-technique ruleset availability: available in frame F if ANY position offers it with
    # attemptProbability[F] > 0 (Q3's per-frame-0 policy zeroes ruleset-unavailable moves). Drives
    # the app's giAllows filter from data instead of a brittle name regex.
    tech_avail = {}
    for node in graph.get("positions", {}).values():
        for t in node.get("transitions", []) or []:
            nm = t.get("technique")
            if not nm:
                continue
            av = tech_avail.setdefault(slugify(nm), {"gi": False, "nogi": False})
            for fr in ("gi", "nogi"):
                if _frame_positive(t, fr):
                    av[fr] = True

    def _pos_role(slug: str, role: str):
        """Resolve a graph.json position role-node: nested layout slugs are compound
        ('mount/high-mount') but graph.json keys them bare ('high-mount/top')."""
        for c in ([slug, slug.rsplit("/", 1)[-1]] if "/" in slug else [slug]):
            nn = graph["positions"].get(f"{c}/{role}")
            if nn:
                return nn
        return None

    # ── WIRE COMPACTION (v1.107.0) ──────────────────────────────────────────────────────────
    # graph-data.json is the largest BOOT payload (was 1.55MB raw / 144KB gzip), and 46% of it
    # was `cal`. The wire is now compact and `ingest()` (app.src.jsx) EXPANDS it back into the
    # exact legacy shapes, so every downstream reader (drawOutcome, resolve, calSuccess,
    # giAllows, _edgeW) is untouched and no RNG draw can move. What changed on the wire:
    #   · technique `outcomes` -> [to, probability, resultCode] tuples (s/f/c),
    #   · `successRateByRuleset` -> only frames that DIFFER from the scalar `successRate`
    #     (calSuccess already falls back per-frame, so semantics are identical),
    #   · `endingPosition` -> DROPPED (zero consumers anywhere — app, scripts, e2e),
    #   · position `moves` -> `ew`, the precomputed [nodeIdx, weight*10000] edge-weight list
    #     (see below): the app only ever read moves to derive these exact products.
    _RESULT_CODE = {"success": "s", "failure": "f", "counter": "c"}

    # ── ONE JOIN LADDER FOR EVERY TECHNIQUE (v1.115.0) ──────────────────────────────────────
    # `graph.json` keys a technique by `slugify(<display name>)` — ONE flat kebab token. A layout
    # id keeps the authored PATH, so `Submissions/Kimura/from-Front-Headlock` arrives here as
    # `kimura/from-front-headlock`, and that `/` is the `-` the key was built with. Only the first
    # rung below existed, so the join missed every submission whose name carries a "from".
    #
    # MEASURED, and it is why this is a correctness bug and not a tidy-up: 294 of 297 submissions
    # shipped NO `cal` at all. `calSuccess()` returned null, `moveChance` fell back to
    # `0.36 + dom*0.1`, and because every submission's dominance sits in a narrow band they all
    # printed ~45.5-45.7% — a FABRICATED success rate on ~289 of 1,204 dealt cards, standing in
    # for authored rates of 46-68%. `graph.json` was right the whole time; only the wire was starved.
    #
    # Three rungs, cheapest first, and the last is the key's OWN CONSTRUCTOR rather than one more
    # guess about spelling:
    #   as-is           3 submissions + 1031 transitions   already-flat ids (`wrist-lock`)
    #   slash -> hyphen       291 submissions              the authored-path ids
    #   slugify(title)  3 submissions +    3 transitions   punctuation an id cannot carry
    #                                                      (`100%-Sweep` -> `100-percent-sweep`;
    #                                                       "Fireman's-Carry" loses its apostrophe)
    # Together: 1331 of 1331. The SAME ladder feeds `tech_avail` (which `giAllows` reads), lifting
    # it 1033 -> 1327 of 1331; the 4 that stay unmatched are techniques no position offers, so
    # there is no availability for them to carry.
    #
    # Positions keep their own resolver (`_pos_role`): a position's leaf IS a slug, a technique's
    # leaf ("from-mount") is not one — which is exactly why they cannot share a ladder.
    def _tech_keys(slug: str, title: str) -> list:
        out = []
        for c in (slug, slug.replace("/", "-"), slugify(title or "")):
            if c and c not in out:
                out.append(c)
        return out

    def enrich(node_id: str, ty: str, title: str = "") -> dict:
        """Pull calibrated fields for a layout node from graph.json (best-effort join)."""
        slug = _slug_from_id(node_id)
        if ty == "positions":
            # a hub layout node collapses top+bottom; both role distributions feed `ew`+avail.
            # The raw per-move table is NOT emitted (it was 336KB and its only app consumer
            # was the ingest edge-weight pass) — `_moves_stash` carries it to the ew pass.
            out = {}
            avail = {"gi": False, "nogi": False}
            for role in ("top", "bottom"):
                n = _pos_role(slug, role)
                if n and n.get("transitions"):
                    out[role] = [
                        {
                            "technique": t.get("technique"),
                            "attemptProbability": t.get("attemptProbability"),
                            "successRate": t.get("successRate"),
                        }
                        for t in n["transitions"]
                    ]
                    for t in n["transitions"]:
                        for fr in ("gi", "nogi"):
                            if _frame_positive(t, fr):
                                avail[fr] = True
            if not out:
                return {}
            return {"_moves_stash": out, "avail": avail}
        else:  # technique: attacker role-node carries the authored outcomes/success
            keys = _tech_keys(slug, title)
            n = None
            for c in keys:
                n = graph[ty].get(f"{c}/attacker") or graph[ty].get(c)
                if n:
                    break
            if not n:
                return {}
            e = {}
            if n.get("successRate") is not None:
                e["successRate"] = n["successRate"]
            br = n.get("successRateByRuleset")
            if isinstance(br, dict):
                trimmed = {fr: v for fr, v in br.items() if v is not None and v != n.get("successRate")}
                if trimmed:
                    e["successRateByRuleset"] = trimmed
            if n.get("outcomes") is not None:
                e["outcomes"] = [
                    [o.get("to"), o.get("probability"), _RESULT_CODE.get(o.get("result"), o.get("result"))]
                    for o in n["outcomes"]
                ]
            for c in keys:  # same ladder — `tech_avail` is keyed by slugify(display name) too
                av = tech_avail.get(c)
                if av:
                    e["avail"] = av
                    break
            return e

    nodes = []
    for n in layout["nodes"]:
        ty = SECTION_TY.get(n["id"].split("/", 1)[0].lower(), "positions")
        # NESTED POSITIONS ARE KEYED BY THEIR OWN SLUG, NOT THEIR PATH. `_slug_from_id` keeps the
        # whole tail, so `Positions/Triangle-Control/Rear-Triangle` became the path
        # "triangle-control/rear-triangle" — while every technique authored from it carries
        # `fromPositionId: "rear-triangle"` (the position's own `slug`). `optionsFor`'s origin
        # filter compares those two and rejects EVERYTHING: measured, 54 of 136 positions had an
        # empty hand and were running entirely on the no-candidates fallback, which relaxes origin.
        # The app already indexes nested positions by their bare leaf (app.src.jsx:544-548); this
        # makes the emitted value agree with it. Leaf ONLY for positions — a technique id like
        # `Submissions/Kimura/from-Mount` has a leaf ("from-mount") that is not a slug at all.
        node = {
            "id": n["id"],
            "x": n.get("x"),
            "y": n.get("y"),
            "t": n.get("t"),
            "ty": ty,
            "s": n.get("s"),
            "fromPositionId": n.get("fromPositionId"),
            "fromRole": n.get("fromRole"),
            # `posId` is emitted for POSITIONS only (their leaf slug). A technique's posId is
            # fromPositionId by construction, so `ingest()` reconstructs it there instead of
            # the wire carrying the same string twice per node (~30KB).
            "posId": _slug_from_id(n["id"]).rsplit("/", 1)[-1] if ty == "positions" else None,
            # `o` = this node's PERMANENT share-link ordinal (node_ordinals.json). The wire
            # format for a shared list encodes ordinals, never this array's index — the
            # array is filesystem-ordered and one new content file renumbers it.
            "o": ordinals[n["id"]],
        }
        # null-valued keys are OMITTED: ingest() reads every one of them with `|| null`, and
        # `"fromPositionId":null` on 136 position hubs is pure wire weight. (`fromPosition`
        # is gone entirely — ingest never copied it and no graph-data consumer reads it.)
        node = {k: v for k, v in node.items() if v is not None}
        cal = enrich(n["id"], ty, n.get("t"))
        if cal:
            node["cal"] = cal  # calibrated payload (Phase 1 gameplay reads this)
        if ty == "positions":  # family membership so the app can resolve the <Family>|Family tier deck
            pslug = _slug_from_id(n["id"])
            rn = _pos_role(pslug, "top") or _pos_role(pslug, "bottom")
            if rn and rn.get("familyHub"):
                node["familyHub"] = rn["familyHub"]
        nodes.append(node)

    # ── THE JOIN MUST NEVER ROT SILENTLY AGAIN ──────────────────────────────────────────────
    # The `cal` join failed for 294 of 297 submissions for months and NOTHING went red: the app
    # degrades to a heuristic success rate rather than crashing, so every gate stayed green while
    # a fabricated number sat on ~289 of 1,204 option cards. A missing join is invisible by
    # construction — so it gets counted here, at the one place that can see it, and the emitter
    # refuses to write a wire that has quietly lost its calibration.
    _cov = {}
    for nd in nodes:
        if nd["ty"] == "positions":
            continue
        tot, hit = _cov.setdefault(nd["ty"], [0, 0])
        _cov[nd["ty"]][0] = tot + 1
        if isinstance(nd.get("cal"), dict) and nd["cal"].get("successRate") is not None:
            _cov[nd["ty"]][1] = hit + 1
    for _ty, (_tot, _hit) in sorted(_cov.items()):
        _pct = (100.0 * _hit / _tot) if _tot else 100.0
        print(f"  cal coverage: {_ty} {_hit}/{_tot} ({_pct:.1f}%)")
        if _pct < 95.0:
            raise SystemExit(
                f"[neural] cal join regressed: only {_hit}/{_tot} ({_pct:.1f}%) {_ty} carry a "
                f"successRate. graph.json keys techniques by slugify(<display name>); see "
                f"_tech_keys. Refusing to emit a wire whose odds would be fabricated."
            )

    # ── position `ew` = the precomputed edge-weight list (replaces `cal.moves` on the wire).
    # This is EXACTLY the arithmetic ingest()'s edge-weight pass used to run over cal.moves:
    #   byName  : technique title -> FIRST non-position node (array order), same as the app's
    #   weight  : attemptProbability/100 x successRate/100, MAX across roles/duplicate titles
    # emitted as [nodeIdx, round(w*10000)] pairs (the consumer divides by 10000; the value
    # only scales edge lighting alpha/width, where 1e-4 is far below one alpha step).
    by_name = {}
    for i, nd in enumerate(nodes):
        if nd["ty"] != "positions" and nd["t"] not in by_name:
            by_name[nd["t"]] = i

    # THE INVERSE OF THE `cal` JOIN. `enrich` walks layout node -> graph.json key; `build_move_edge`
    # needs graph.json key -> layout node INDEX, because the EDGE solver's actions are named by
    # graph.json `target` slugs while the app's hand is a list of node indices. Same `_tech_keys`
    # ladder in reverse, so the two directions can never drift apart: if a spelling is added to the
    # ladder, both joins learn it at once. First node wins (array order), matching `by_name`.
    tech_idx = {}
    for i, nd in enumerate(nodes):
        if nd["ty"] == "positions":
            continue
        for c in _tech_keys(_slug_from_id(nd["id"]), nd.get("t")):
            tech_idx.setdefault((nd["ty"], c), i)
    for nd in nodes:
        cal = nd.get("cal")
        if not cal or "_moves_stash" not in cal:
            continue
        moves = cal.pop("_moves_stash")
        best = {}
        for role in ("top", "bottom"):
            for m in moves.get(role) or []:
                ti = by_name.get(m.get("technique"))
                if ti is None:
                    continue
                w = max(0.0, (m.get("attemptProbability") or 0) / 100.0) * max(0.0, (m.get("successRate") or 0) / 100.0)
                if w > best.get(ti, 0.0):
                    best[ti] = w
        ew = [[ti, round(w * 10000)] for ti, w in sorted(best.items()) if round(w * 10000) > 0]
        if ew:
            cal["ew"] = ew
        if not cal.get("ew") and not cal.get("avail"):
            nd.pop("cal", None)

    # links ride as [sourceIdx, targetIdx] pairs into THIS file's nodes array (self-consistent:
    # both halves are regenerated together; array indices never leave the file — share links
    # use the permanent ordinals, never these). Unresolvable ids and self-loops are dropped
    # here exactly as ingest() dropped them client-side.
    id_idx = {nd["id"]: i for i, nd in enumerate(nodes)}
    links = []
    for l in layout.get("links", []):
        a, b = id_idx.get(l["source"]), id_idx.get(l["target"])
        if a is None or b is None or a == b:
            continue
        links.append([a, b])
    # ── OUTCOME DESTINATIONS ARE 293 STRINGS WRITTEN 4,160 TIMES (v1.144.0) ─────────────────
    # Every technique's `outcomes` names where each branch lands — `half-guard/bottom`,
    # `game-over`, `side-control/top` — and the whole corpus only ever names 293 distinct
    # destinations. Written out in place they were 64,272 B raw / 2,809 B gzip of the largest
    # boot payload, which is the single biggest lever left in this file after v1.107.0 took
    # `cal.moves` out.
    #
    # So they are INTERNED: `toTab` carries each destination once, and an outcome's first slot
    # becomes its index. `ingest()` (app.src.jsx) resolves it back to the same string in the
    # same expansion pass that already turns the tuple into {to, probability, result}, so every
    # downstream reader (drawOutcome, resolve, the outcome-kernel gate) sees exactly what it saw
    # before and no RNG draw can move. A wire without `toTab`, or an outcome whose slot is
    # already a string, still expands — that is what keeps a spec-authored fixture working.
    #
    # Ordered by DESCENDING USE, tie-broken by name: it is deterministic (a re-run diffs clean)
    # and it spends the one- and two-digit indexes on the destinations that occur most.
    to_freq = {}
    for nd in nodes:
        for o in (nd.get("cal") or {}).get("outcomes") or []:
            to_freq[o[0]] = to_freq.get(o[0], 0) + 1
    to_tab = sorted(to_freq, key=lambda s: (-to_freq[s], s))
    to_idx = {s: i for i, s in enumerate(to_tab)}
    _interned = 0
    for nd in nodes:
        for o in (nd.get("cal") or {}).get("outcomes") or []:
            o[0] = to_idx[o[0]]
            _interned += 1
    # POSITIVE COVERAGE, NOT SILENCE (§6.6). An interning pass that quietly matched nothing
    # emits a perfectly valid wire — with every outcome still a string and the saving gone —
    # and nothing downstream would notice, because the expansion tolerates both shapes by design.
    #
    # SO CHECK THE OUTPUT, NOT THE LOOP. The first cut of this guard compared `_interned` against
    # `sum(to_freq.values())`, and those two count the SAME traversal of the same structure: they
    # are equal by construction, so the clause could not fire and "the rewrite ran" printed exactly
    # what "the rewrite did nothing" would print — §6.6's headline class, inside the guard written
    # to prevent it. Found by review. The scan below reads what is actually about to be written:
    # every slot 0 must now be an int that indexes `to_tab`, and a single string survivor fails.
    _bad = [
        (nd.get("id"), o[0])
        for nd in nodes
        for o in ((nd.get("cal") or {}).get("outcomes") or [])
        if not isinstance(o[0], int) or not (0 <= o[0] < len(to_tab))
    ]
    if not to_tab or _bad:
        raise SystemExit(
            f"[neural] outcome interning left {len(_bad)} of {_interned} outcome row(s) unresolved "
            f"against a {len(to_tab)}-entry table (first: {_bad[:3]}) — refusing to emit a "
            f"half-interned wire."
        )
    print(f"  outcome destinations: {len(to_tab)} interned, {_interned} references rewritten")
    out = {"nodes": nodes, "links": links, "toTab": to_tab}
    # EDGE — the option card's ranking value. Attached to the POSITION nodes (see build_move_edge);
    # the two top-level keys below are the table's self-description, carried ONCE for the file.
    out.update(build_move_edge(graph, nodes, tech_idx))
    return out


# ── EDGE: what a move is worth from where you are standing ────────────────────────────────────
# `scripts/solve_edge_values.py` solves a finite-horizon MDP over the 272 position role-nodes in
# graph.json (you argmax, the opponent samples the PAIRED role-node's authored moves, 9-12 plies,
# WIN/LOSS from who performed the finishing submission) and scores every dealt move:
#
#     EDGE(s,a) = 100 * ( Q(s,a) - base(s) )      base(s) = SUM attempt%(a') * Q(s,a')
#     Q(s,a)    = p * A(s,a) + (1-p) * B(s,a)     A = success branch, B = miss branch
#
# 0 = "the ordinary choice from here". This is what replaces `movePotential`, which prints +100 on
# every submission (app.src.jsx:10411) and therefore sorts ten identical-looking cards.
#
# ── THE SHAPE, AND WHY IT IS THIS SHAPE ───────────────────────────────────────────────────────
#
# 1. IT IS A VALUE AND A SLOPE, NOT ONE PRECOMPUTED EDGE. Q is LINEAR in p, so the whole curve
#    is two numbers, and it is written anchored at the authored odds `p0`:
#
#        EDGE(p) = e0 + (p - p0) * c1     e0 = EDGE at p0 (the integer the card shows at rest)
#                                         c1 = 100 * (A - B)   (EDGE points per unit odds)
#
#    keeping `p` a RUNTIME input. That is not elegance, it is correctness: `p` on the card is
#    `moveChance()` (app.src.jsx:10367), which is the calibrated rate PLUS `stateBonus` (what
#    drilling a deck buys), the momentum bonus, the landing-question `_qMod`, the opponent's
#    resistance and any user override. A single frozen integer is EDGE at the authored odds and
#    at no other moment, so it could not move when a deck is drilled — measured across 1246
#    (state,action) pairs, +10pp of odds moves EDGE by a median of 2.7 points and 94.8% of moves
#    shift by at least a full point. `base(s)` is deliberately NOT re-weighted at runtime and is
#    folded into `e0`: "the ordinary choice from here" is a property of the position and of what
#    people attempt from it, not of how sharp you happen to be today.
#      `p0` costs no wire bytes because the app already has it: `moveChance` opens by reading
#      `calSuccess(act)`, which is `cal.successRate` selected per frame — the very field this
#      solve reads. VERIFIED, not assumed: 0 of 1331 technique nodes carry a no-gi rate that
#      differs from the scalar, so in the frame this table is stamped for the two are the same
#      number. (146 carry a differing GI rate, which is precisely why point 5 exists.)
#      Anchoring on `e0` also settles a self-inconsistency in the spec: it asks for an
#      EDGE x1000 sort key (§4.1) while its own worked hand (§4.6) breaks ties by odds. At rest
#      EDGE is exactly the displayed integer and the odds tie-break decides, which is §4.6; the
#      moment any modifier moves `p` the value is continuous again and sorts at full resolution.
#
# 2. IT HANGS OFF THE POSITION NODE, keyed by graph-data node INDEX. A top-level
#    `{"<hub>/<role>": [...]}` map would respell all 272 state slugs once per lambda — ~16KB of
#    pure key bytes for an identity the position node already carries. Node index is the join the
#    app can actually perform: `optionsFor()` (:8036) hands back `{idx, node, res}` and `cal.ew`
#    already addresses techniques exactly this way.
#      NB the spec this implements proposes arrays "parallel to graph.json's transitions[] order,
#      which is what `_edgeW` already joins on". BOTH halves of that are wrong and it is worth
#      recording: `_edgeW` joins by technique TITLE -> node index (`byName`, app.src.jsx:790), and
#      since v1.107.0 the wire does not carry `cal.moves` at all, so there is no transitions array
#      on the client for anything to be parallel to. Such a table would be unjoinable.
#
# 3. MEMBERSHIP IS THE INDEX LIST, so a missing value is STRUCTURALLY missing. 0 is a meaningful
#    EDGE — it is the definition of "the ordinary choice" — so it can never double as "no data",
#    and a dense array would need a sentinel that a manifest-boot race could read as a real value.
#    This is the v1.80.4 lesson (the manifest's card count `n`) applied to a second payload: a card
#    whose node index is absent from the list has NO edge and must render its odds row alone,
#    never a fabricated 0. MEASURED: `optionsFor` deals 82 of 1204 cards (6.8%) that this table
#    legitimately cannot value — gi-only moves zeroed in the no-gi frame plus techniques adjacent
#    in the layout that the role-node's authored `transitions[]` never offers — so that path is
#    real and gets walked on the very first hand, not a defensive hypothetical.
#
# 4. LAMBDA IS A DIMENSION OF THE TABLE, NEVER BAKED INTO A NUMBER. The loss-aversion dial changes
#    the OPTIMAL POLICY downstream, so re-weighting one solve at display time is measurably wrong
#    (the spec measures up to 0.0033 of V and 6 top-card flips). Each preset is an independent
#    solve. The preset list ships ONCE as `evLam` rather than as a positional convention, so the
#    app reads which lambdas exist instead of assuming three.
#
# 5. THE FRAME IS STAMPED (`evFrame`). The solve is no-gi. `giAllows` is not applied to the hand
#    (its only caller is buildExplorer, :4512), so a gi roll deals moves this table scored under
#    no-gi rules; saying so on the wire lets the app decide, and lets a gi table be added later as
#    a value of this key rather than a wire change.
#
# 6. THE ATTEMPT SHARE RIDES ALONG, because the documented rank is EDGE -> odds -> attempt% ->
#    name and the app has had no access to attempt probabilities since v1.107.0 dropped
#    `cal.moves`. It is not decoration: MEASURED, 76 card pairs across 45 of the 272 hands tie on
#    BOTH edge and odds, and the spec's own worked hand is ordered by this key (North-South Choke
#    over Breadcutter, both +5 at 58%, 5.0% vs 1.0% attempted). Without it those fall through to
#    alphabetical. It is the same Q3 Delphi occurrence distribution that defines `base(s)`, so
#    carrying it also makes EDGE's zero point auditable from the wire alone. Whole percent, not
#    permille: its only consumer is an ordering, and permille costs 866 more gzip bytes to
#    separate 14.5 from 14.7 — a distinction that decides nothing. It is lambda-INDEPENDENT, so
#    it is carried once, not three times.
#
# LAYOUT.  cal.ev[role] = [ nodeIdxs, attemptPct, ...one [e0,c1, e0,c1, ...] array per evLam ]
#          so the lambda block is at index `2 + evLam.indexOf(lossAversion)`, the k-th listed
#          node's pair is at [2k, 2k+1], and a node index absent from `nodeIdxs` HAS NO VALUE.
#
# Both numbers are WHOLE EDGE POINTS. `e0` is the solver's own displayed integer, so §4.6's
# published hands are reproducible from the wire exactly, with no rounding anywhere; `c1`'s
# rounding is the only approximation and it is scaled by |p - p0|, which the emitter measures over
# a +/-20pp drill sweep rather than bounding on paper (see the coverage lines).
# MEASURED alternatives, whole-file gzip -9, so the choice is visible and reversible:
#   [c0 x10, c1 x10] (p-anchored, needs a nudge to pin the display)   +43,150 raw  +21,478 gzip
#   [e0 x10, c1 x10]                                                  +39,091 raw  +20,189 gzip
#   [e0,     c1    ]  <- shipped                                      +32,177 raw  +15,093 gzip
#   ...with delta-coded indexes                                       +30,183 raw  +13,459 gzip
#   ...with delta-coded indexes AND lambda-delta values               +29,944 raw  +12,565 gzip
# The last two are NOT taken. They save 0.5% of the gzip budget in exchange for a decode step at
# ingest, and the one failure this table cannot survive is being decoded wrong: every value here
# is an ORDERING, so an off-by-one in a prefix sum reorders a hand and reads as a bad model rather
# than as a bug. Plain arrays are readable with no decode at all.
#   The obvious remaining saving — carry ONE slope and share it across the three lambdas, since
#   only the value needs to be per-lambda — is REJECTED BY MEASUREMENT, not by taste. c1 is
#   100*[(Aw-Bw) - lambda*(Al-Bl)], so it moves with the dial: reusing lambda=2's slope misstates
#   a 20pp drill by a MEDIAN of 2.60 EDGE points (p90 9.00, p99 17.40, max 27.80) on a scale where
#   93% of all values sit inside +/-15. That is a different answer, not a rounding.
# The "Winning vs not losing" dial, shipped in Settings -> Rolling as v1.124.0.
# V = p_win - lam*p_loss, so lam=1 IS the balanced point (a tap you get is worth exactly what a
# tap you give away costs) and lam=2 is already twice as afraid of losing as it is keen to win.
# The rungs are therefore Sport (1) / Slightly cautious (2, the DEFAULT the owner chose) /
# Self-defence (4).  Calling lam=2 "Balanced" -- as this line did until v1.124.0 -- named the
# default after a posture it does not hold, and it was the one thing about the presets that was
# actually wrong: the NUMBERS already sat where the owner meant, so nothing was re-emitted.
EV_LAMBDAS = (1, 2, 4)
EV_FRAME = "nogi"
EV_DRILL_SWEEP = (-0.20, -0.10, 0.10, 0.20)   # odds offsets the fidelity check samples


def build_move_edge(graph: dict, nodes: list, tech_idx: dict) -> dict:
    """Solve EDGE once per lambda preset and attach it to the position nodes.

    Mutates `nodes` (adds `cal.ev`), returns the file-level self-description keys.
    """
    from solve_edge_values import HORIZON_MIX, Opts, selfcheck, solve_mixture

    # The structural facts the solve depends on (attempt sums, outcome sums, the 1331-pair
    # attacker/defender mirror, game-over only from submissions, no second-level chain). All pass
    # today, so this gate ships green and only fires on a CONTENT regression — at which point the
    # honest move is to refuse the wire rather than ship a ranking derived from broken data.
    bad = [(n, d) for n, ok, d in selfcheck(graph) if not ok]
    if bad:
        raise SystemExit("[neural] EDGE self-check failed, refusing to emit: "
                         + "; ".join(f"{n} ({d})" for n, d in bad))

    opts = Opts(frame=EV_FRAME)
    sols = [solve_mixture(graph, float(lam), HORIZON_MIX, opts) for lam in EV_LAMBDAS]
    model = sols[0].model
    pos_idx = {nd["posId"]: i for i, nd in enumerate(nodes)
               if nd["ty"] == "positions" and nd.get("posId")}

    n_state = n_pair = n_join = n_dupe = 0
    lin = 0.0                       # max |Q - (p*A + (1-p)*B)| over the mixture: the form's own residual
    swept = agree = 0               # drill-sweep fidelity of the rounded slope
    worst_drift = 0.0
    miss_state, miss_tech = [], []
    for s in model.states:
        hub, role = s.rsplit("/", 1)
        pi = pos_idx.get(hub)
        if pi is None:
            miss_state.append(s)
            continue
        # rows are sorted by q, which DIFFERS per lambda — join the three solves by action name.
        by_lam = [{r["name"]: r for r in sol.q[s]} for sol in sols]
        rows, att = {}, {}
        for r0 in sols[0].q[s]:
            n_pair += 1
            j = tech_idx.get((r0["cat"], r0["target"]))
            if j is None:
                miss_tech.append((s, r0["cat"], r0["target"]))
                continue
            n_join += 1
            coeffs = []
            for k, sol in enumerate(sols):
                r = by_lam[k][r0["name"]]
                base, p0 = sol.baseline[s], r["odds"]
                lin = max(lin, abs(r["q"] - (p0 * r["A"] + (1.0 - p0) * r["B"])))
                c1 = int(round(100.0 * (r["A"] - r["B"])))
                coeffs += [r["edge"], c1]
                # WHAT DRILLING WILL ACTUALLY SHOW. Anchoring on `e0` puts a fixed offset of up to
                # half a point between the card and the real-valued curve — that is the DESIGN (it
                # is what makes the value at rest exactly the solver's integer), and being fixed it
                # is invisible: the user reads the CHANGE. So measure the change, where c1's
                # rounding is the only error, over the move sizes drilling really produces.
                e_at_p0 = 100.0 * (r["q"] - base)
                for d in EV_DRILL_SWEEP:
                    p = max(0.05, min(0.95, p0 + d))
                    moved_exact = 100.0 * ((p * r["A"] + (1.0 - p) * r["B"]) - base) - e_at_p0
                    moved_wire = (p - p0) * c1
                    swept += 1
                    agree += round(moved_wire) == round(moved_exact)
                    worst_drift = max(worst_drift, abs(moved_wire - moved_exact))
            if j in rows:
                # two authored transitions naming ONE technique (measured: exactly one, the
                # duplicate `Aoki Lock` entry at aoki-lock-control/top). Same technique node means
                # the same p/A/B and therefore the same coefficients — assert rather than assume,
                # because a disagreement here would mean the join, not the content, is wrong. The
                # ATTEMPT SHARES do differ and are SUMMED: the position really does reach for that
                # technique with their combined probability, whatever the entries are called.
                n_dupe += 1
                if rows[j] != coeffs:
                    raise SystemExit(f"[neural] EDGE: {s} maps two actions with DIFFERENT values "
                                     f"onto node {j} ({nodes[j]['id']}) — the join is wrong")
                att[j] += r0["attempt"]
                continue
            rows[j] = coeffs
            att[j] = r0["attempt"]
        if not rows:
            continue
        n_state += 1
        # ascending node index: deterministic, independent of lambda, and it keeps the index list
        # monotone so gzip sees a ramp instead of adjacency noise.
        order = sorted(rows)
        cal = nodes[pi].setdefault("cal", {})
        cal.setdefault("ev", {})[role] = [
            order,
            [int(round(att[j] * 100)) for j in order],
        ] + [
            [c for j in order for c in rows[j][2 * k:2 * k + 2]] for k in range(len(sols))
        ]

    pct = (100.0 * n_join / n_pair) if n_pair else 100.0
    print(f"  move edge: {n_state}/{len(model.states)} states solved for lambda {list(EV_LAMBDAS)} "
          f"({EV_FRAME}, horizons {list(HORIZON_MIX)})")
    print(f"  move edge: {n_pair} (state,move) pairs, {n_join} joined to a node ({pct:.1f}%), "
          f"{n_dupe} duplicate target(s) deduped")
    print(f"  move edge: linear form exact to {lin:.2e}; value at rest IS the solver's own integer")
    print(f"  move edge: drill sweep {[int(d * 100) for d in EV_DRILL_SWEEP]}pp — the movement "
          f"matches the exact curve to {worst_drift:.3f} of a point ({agree}/{swept} land on the "
          f"same whole-point change)")
    if miss_state:
        print(f"  move edge: {len(miss_state)} state(s) with no layout node: {miss_state[:5]}")
    if miss_tech:
        print(f"  move edge: {len(miss_tech)} move(s) with no layout node: {miss_tech[:5]}")
    # Same refusal the `cal` join learned in v1.115.0, for the same reason: a join that rots is
    # INVISIBLE downstream — the app just stops showing EDGE on some cards and every gate stays
    # green. Count it here, at the one place that can see it, and refuse to ship a hollow table.
    if pct < 95.0:
        raise SystemExit(f"[neural] EDGE join regressed: only {n_join}/{n_pair} moves ({pct:.1f}%) "
                         f"reached a graph-data node. Refusing to emit a hollow ranking table.")
    if lin > 1e-9:
        raise SystemExit(f"[neural] EDGE: Q is not p*A+(1-p)*B (residual {lin:.2e}) — the two-number "
                         f"wire cannot represent this solve. Refusing to emit.")
    return {"evLam": list(EV_LAMBDAS), "evFrame": EV_FRAME}


MC_LINE_BUDGET = 36  # one-line MC option cap; keep in sync with app.src.jsx MC_LINE


def _mc_clip(a: str):
    """First sentence, <=160 chars (mirrors app.src.jsx mcClip) — the display-answer fallback
    for cards that have no authored one-line `answer_line` yet."""
    m = re.match(r"[\s\S]*?[.!?]", a or "")
    seg = (m.group(0) if m else (a or "")).strip()
    return seg if 0 < len(seg) <= 160 else None


def _hard_clip(a: str):
    """Word-boundary truncation to <=150 chars + an ellipsis — the bridge for cards whose FIRST
    SENTENCE overruns _mc_clip's 160-char cap and that carry no authored `answer_line` yet.
    WHY IT EXISTS (v1.132.2, owner: "It should have shown me multiple choice"): falling through
    to the FULL answer shipped 1,707 paragraph-length display answers across 532 decks (18%),
    and a 411-char `a` starves the app's MC length filters — every distractor fails the 0.4
    ratio floor against it, so those decks could never build a multiple choice and the card
    degraded to recall at stage 0, inverting the recognise-first progression. A truncated line
    is not beautiful; it is honest, comparable in length to every other option, and the full
    text still shows post-reveal via `d`. The QUALITY fix stays Phase B: authored answer_line."""
    t = (a or "").strip()
    if len(t) <= 160:
        return t or None
    cut = t[:150].rsplit(" ", 1)[0].rstrip(" ,;:.—-")
    return (cut + "…") if cut else None


def _qa_cards(fc: list) -> list:
    """Neural card: {q, a, d?, mc?}. `a` = the DISPLAY answer (authored one-line `answer_line`
    when present, else the clipped first sentence, else a word-boundary hard clip — NEVER the
    full paragraph, see _hard_clip). `d` = the full explanation, emitted only when it differs
    from `a` (the post-reveal "more" tooltip). `mc` = {p,t} authored one-line distractor tiers
    when present (graded plausible/trap)."""
    out = []
    for c in fc or []:
        q = c.get("q") or c.get("question")
        full = c.get("a") or c.get("answer")
        if not (q and full):
            continue
        line = c.get("answer_line") or _mc_clip(full) or _hard_clip(full) or full
        card = {"q": q, "a": line}
        if full != line:
            card["d"] = full
        d = c.get("distractors") or {}
        p = [x for x in (d.get("plausible") or []) if x]
        t = [x for x in (d.get("trap") or []) if x]
        if p or t:
            card["mc"] = {"p": p, "t": t}
        out.append(card)
    return out


def _blend_deck(role_cards: list, pos_cards: list, fam_cards: list, pos_tag: str, fam_tag: str, frac: float = 0.22) -> list:
    """A position's drilled deck is MOSTLY its own role-specific cards (untagged — they're already
    shown in the context of the current state:role), seasoned with ~`frac` higher-tier cards spread
    through the deck. Each higher card carries a `tag` naming its SCOPE — the position's own name
    for position-level cards, the family name for family-level cards — so the user knows a general
    card is about (e.g.) "High Mount" or "Mount", not the specific top/bottom state. A base position
    with no role cards yet (e.g. Mount) falls back to the tagged higher-tier cards."""
    seen = set(c["q"] for c in role_cards)
    pos_h, fam_h = [], []
    for c in pos_cards:
        if c["q"] not in seen:
            pos_h.append({**c, "tag": pos_tag})
            seen.add(c["q"])
    for c in fam_cards:
        if c["q"] not in seen:
            fam_h.append({**c, "tag": fam_tag})
            seen.add(c["q"])
    # interleave position + family so the ~20% seasoning is a MIX of both scopes (a "High Mount"
    # card and a "Mount" card), not all of one tier
    higher = []
    for i in range(max(len(pos_h), len(fam_h))):
        if i < len(pos_h):
            higher.append(pos_h[i])
        if i < len(fam_h):
            higher.append(fam_h[i])
    if not role_cards:
        return higher[:8]
    if not higher:
        return role_cards
    k = min(len(higher), max(1, round(len(role_cards) * frac / (1 - frac))))
    picks = higher[:k]
    out = list(role_cards)  # own role cards stay untagged
    step = max(1, len(role_cards) // (k + 1))
    for i, c in enumerate(picks):
        out.insert(min(len(out), (i + 1) * step + i), c)
    return out


def build_flashcards(graph: dict) -> dict:
    """Drill decks keyed '<Name>|<Role>'. Position decks are BLENDED — mostly the node's own
    role cards + ~20% higher-tier (position-level + family-level) cards from flashcardTiers — so a
    single deck teaches the specific state and seasons in the general position/family concepts.
    Transitions/submissions keep their own attacker/defender cards (no position tiers apply).

    THE JOIN IS TOTAL, AND A COLLISION IS A BUILD ERROR — NOT A STATISTIC.
    Every node in the three sections this join reads ends in exactly ONE bucket: a deck, or a NAMED
    exclusion that is proved non-lossy below. The buckets must sum to the node count; any residue is
    an unaccounted drop and fails. There is no collision allowlist, because a collision is never
    benign: `<Name>|<Role>` carries no section term (neither does the app's `deckKeyFor`), so two
    sections authoring one display name file two DIFFERENT state machines under one id, and the
    later write leaves with the earlier one's cards.

    v1.144.2 COUNTED that loss and baselined the 10 keys it found; this makes it impossible. Those
    10 were 5 moves authored as both a transition and a submission — resolved in content/ by
    renaming the transition side, since the submission's success outcome reaches the sink and the
    transition's does not, i.e. they are an entry and a finish, not one move written twice.
    `scripts/validate_graph_integrity.py` catches the same thing a stage earlier, on content/,
    before a graph exists to collide in.

    WHY THE RE-HOME ASSERTION EARNS ITS LINES. Three exclusion buckets carry authored cards — bare
    hubs, the terminal, family hubs — and hubs are AGGREGATORS, not owners: every card on them also
    lives on a role node. That was measured once (21,798 of 21,798) and is now asserted per hub
    instead of believed, because without it "excluded" and "lost" print identically, which is
    exactly how the tenth collision hid among 1,531 skips.

    NOT ACCOUNTED FOR AT ALL, AND DELIBERATELY LEFT VISIBLE: `principles` and `systems`. This join
    has never read them — not since the original data-bridge commit. docs/Content.md instructs
    authors to write cards "at the flat root for principles/systems" and they did; those cards reach
    no deck, and deckCat() in neural/src/app.src.jsx has no branch that could render one. No comment,
    gate or baseline anywhere records a decision to exclude them, so this PRINTS the figure every run
    rather than exempting it. A gap that stops being visible becomes policy."""
    SECTIONS = ("positions", "transitions", "submissions")
    UNREAD = ("principles", "systems")
    # An exclusion bucket that must never be empty: if its guard stops matching, its nodes flow into
    # the deck loop and collide en masse, and a zero here would read exactly like "nothing to skip".
    FLOORS = {"hub": 1, "terminal": 1, "family-hub": 1}

    decks = {}
    owner = {}                # deck key -> (section, node id, n_cards) currently holding it
    collisions = []           # (key, kept, dropped) — MUST stay empty
    excluded = {}             # bucket -> node count
    excluded_cards = {}       # bucket -> authored cards sitting on those nodes
    per_section = {}          # section -> decks emitted

    for section in SECTIONS:
        for nid, node in graph.get(section, {}).items():
            # .items(), not .values(): the graph id is the DICT KEY and is absent from the value, so
            # a collision report built from the value could only name the display name — the one
            # thing both sides of a collision share, and therefore useless for finding either.
            role = node.get("role")
            name = node.get("name")
            bucket = ("family-hub" if not role else
                      "hub" if role == "hub" else
                      "terminal" if role == "terminal" else
                      "unnamed" if not name else None)
            if bucket:
                excluded[bucket] = excluded.get(bucket, 0) + 1
                excluded_cards[bucket] = excluded_cards.get(bucket, 0) + len(node.get("flashcards") or [])
                continue
            base = name
            if section == "positions":
                for suf in (" Top", " Bottom"):
                    if base.endswith(suf):
                        base = base[: -len(suf)]
                        break
                tiers = node.get("flashcardTiers") or {}
                cards = _blend_deck(
                    _qa_cards(node.get("flashcards")), _qa_cards(tiers.get("position")), _qa_cards(tiers.get("family")),
                    pos_tag=base, fam_tag=node.get("familyHub") or base)
            else:
                cards = _qa_cards(node.get("flashcards"))
            if not cards:
                # A role node nobody has authored yet. Zero is the healthy value, so this carries no
                # floor — but it is still printed, so it can never grow in silence.
                excluded["no-cards"] = excluded.get("no-cards", 0) + 1
                continue
            key = f"{base}|{role.capitalize()}"
            if key in decks:
                # LAST WRITE WINS (`decks[key] = ...` below is unconditional), so the node arriving
                # NOW is the survivor and `owner[key]` is the one losing its cards. Naming them the
                # wrong way round sends the next reader to the file that is fine.
                collisions.append((key, (section, nid, len(cards)), owner[key]))
            owner[key] = (section, nid, len(cards))
            per_section[section] = per_section.get(section, 0) + 1
            decks[key] = {"cat": SECTION_CAT[section], "role": role.capitalize(), "cards": cards}

    # ── The hubs' cards are re-homed, not dropped. Asserted, per hub, on the emitter's own card
    #    builder (_qa_cards) rather than on a spec-side copy of it (CLAUDE.md section 6.3).
    ROLE_SUFFIXES = ("/attacker", "/defender", "/top", "/bottom")
    rehome_hubs = rehome_cards = 0
    orphaned = []
    for section in SECTIONS:
        sec_nodes = graph.get(section, {})
        for nid, node in sec_nodes.items():
            role = node.get("role")
            if role not in (None, "hub", "terminal"):
                continue
            hub_q = {c["q"] for c in _qa_cards(node.get("flashcards"))}
            if not hub_q:
                continue
            if role:
                members = [sec_nodes.get(nid + suf) for suf in ROLE_SUFFIXES]
            else:  # a family hub's members are its own variants, not role suffixes
                members = [v for k, v in sec_nodes.items()
                           if v.get("familyHub") == nid or k.startswith(nid + "-from-")]
            member_q = set()
            for m in members:
                if not m:
                    continue
                member_q |= {c["q"] for c in _qa_cards(m.get("flashcards"))}
                for tier in (m.get("flashcardTiers") or {}).values():
                    member_q |= {c["q"] for c in _qa_cards(tier)}
            rehome_hubs += 1
            rehome_cards += len(hub_q)
            missing = hub_q - member_q
            if missing:
                orphaned.append((section, nid, len(missing), sorted(missing)[0][:70]))

    # ── POSITIVE COVERAGE, PRINTED EVERY RUN — never let "found no problems" and "never looked"
    #    produce the same output (CLAUDE.md section 6.6).
    total_nodes = sum(len(graph.get(s, {})) for s in SECTIONS)
    accounted = len(decks) + len(collisions) + sum(excluded.values())
    print(f"  flashcard join: {total_nodes} nodes in {len(SECTIONS)} sections -> {len(decks)} decks "
          f"({', '.join(f'{per_section.get(s, 0)} {s}' for s in SECTIONS)}); excluded "
          f"{', '.join(f'{excluded.get(b, 0)} {b}' for b in sorted(excluded))}; "
          f"{len(collisions)} collided; {accounted}/{total_nodes} accounted")
    print(f"  flashcard join: hub cards re-homed {rehome_cards}/{rehome_cards} across {rehome_hubs} "
          f"aggregator(s)" if not orphaned else
          f"  flashcard join: {len(orphaned)} aggregator(s) hold cards that reach NO role node")
    _un_nodes = sum(len(graph.get(s, {})) for s in UNREAD)
    _un_cards = sum(len(n.get("flashcards") or []) for s in UNREAD for n in graph.get(s, {}).values())
    if _un_nodes:
        print(f"  flashcard join: UNACCOUNTED — {_un_nodes} node(s) / {_un_cards} authored card(s) in "
              f"{'/'.join(UNREAD)} are never read by this join and reach no deck. Not an exclusion: "
              f"nothing on record decided it (docs/Content.md tells authors to write them; deckCat() "
              f"has no branch that renders them). Open question, printed so it stays one.")

    errs = []
    for key, kept, dropped in sorted(collisions):
        errs.append(f"deck key {key!r} collided: kept {kept[0]}:{kept[1]} ({kept[2]} cards), "
                    f"DROPPED {dropped[0]}:{dropped[1]} ({dropped[2]} cards)")
    if collisions:
        errs.append("One display name is authored in two sections. The key has no section term, so "
                    "one deck overwrites the other and its cards never ship. Rename one side in "
                    "content/ — there is no baseline to add it to, by design.")
    if accounted != total_nodes:
        errs.append(f"join is NOT total: {accounted} of {total_nodes} nodes accounted for "
                    f"({total_nodes - accounted} unexplained). Every node must be a deck, a "
                    f"collision, or a named exclusion.")
    for b, floor in sorted(FLOORS.items()):
        if excluded.get(b, 0) < floor:
            errs.append(f"exclusion bucket {b!r} counted {excluded.get(b, 0)}, floor is {floor}. "
                        f"A guard that stops matching reads exactly like a clean run.")
    for s in SECTIONS:
        if not per_section.get(s):
            errs.append(f"section {s!r} emitted 0 decks — the join stopped seeing a whole section.")
    if orphaned:
        for sec, nid, n, sample in orphaned[:5]:
            errs.append(f"aggregator {sec}:{nid} holds {n} card(s) present on no role node, "
                        f"e.g. {sample!r} — excluding it DOES lose cards.")
    if not rehome_cards:
        errs.append("the re-home assertion checked 0 cards; it cannot fail, so it is not a check.")
    _join_report(errs, "flashcard join")
    return decks


def write_flashcards(decks: dict, out_dir: Path) -> tuple[int, int]:
    """Write one chunk file per deck + a manifest. Returns (deck_count, card_count)."""
    fc_dir = out_dir / "flashcards"
    # clean stale chunks so removed decks don't linger
    if fc_dir.exists():
        for old in fc_dir.glob("*.json"):
            old.unlink()
    fc_dir.mkdir(parents=True, exist_ok=True)

    # Chunks are addressed by fnv1a32(deckKey) — the same hash the app's qhash() computes, and
    # the same scheme the per-node dossier chunks use. Two reasons, both load-bearing:
    #   · the manifest is the ONE deck file every visitor fetches, so its own bytes are on the
    #     critical path. Carrying a per-deck filename cost ~110KB of pure redundancy (the key
    #     already names the deck); a derived address costs zero.
    #   · a hash needs no collision bookkeeping: a chunk holds a {key: deck} MAP, so two keys
    #     landing on one hash share the file and both still resolve. The old slug scheme needed
    #     "-2" suffixes and a manifest field to remember them.
    from _neural_content import fnv1a32
    manifest = {}
    buckets: dict[str, dict] = {}
    for key in sorted(decks):
        deck = decks[key]
        buckets.setdefault(fnv1a32(key), {})[key] = {
            "cat": deck["cat"], "role": deck["role"], "cards": deck["cards"],
        }
        # format 3 entry: a COMPACT TUPLE [cat, n]. `n` is not decoration — it is what keeps
        # mastery, crowns, lesson goals and the belt score EXACT before a deck's cards land
        # (see deckMastery in app.src.jsx).
        manifest[key] = [deck["cat"], len(deck["cards"])]
    for h, payload in buckets.items():
        (fc_dir / f"{h}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    collisions = sum(len(v) - 1 for v in buckets.values())

    # SHARED-QUESTION INDEX. The blended hierarchy duplicates one position/family card into every
    # variant deck, and answering it anywhere credits all of them (noteCardDone). The app used to
    # discover that by scanning the decks it happened to have RESIDENT, so the same answer paid
    # different credit depending on load order. The corpus knows the answer, so ship it: only
    # questions carried by 2+ decks are listed, addressed by fnv1a32(question) -> deck INDEXES
    # into the ordered `decks` map below (451 of 21,334 questions — ~10.6KB raw / 4.3KB gzip,
    # which is what makes it affordable on the eager path).
    order = {k: i for i, k in enumerate(sorted(manifest))}
    q_decks: dict[str, list[int]] = {}
    for key in sorted(decks):
        for card in decks[key]["cards"]:
            q_decks.setdefault(card["q"], []).append(order[key])
    shared: dict[str, list[int]] = {}
    for q, idxs in q_decks.items():
        if len(idxs) > 1:
            shared.setdefault(fnv1a32(q), []).extend(idxs)
    shared = {h: sorted(set(v)) for h, v in shared.items()}

    (fc_dir / "_index.json").write_text(json.dumps({
        "_meta": {
            "status": "generated",
            "format": 3,
            "note": "Generated by scripts/regenerate_neural_data.py from graph.json. The app boots "
                    "from this file alone and fetches a deck's chunk on demand; a chunk is "
                    "<fnv1a32(deckKey)>.json beside this manifest, holding {deckKey: {cat, role, "
                    "cards}} (a map, so a hash collision shares a file instead of losing a deck).",
            "keyFormat": "<Name>|<Role>  (Top|Bottom for positions, Attacker|Defender for techniques)",
            "entry": "[cat, n] — category, card count",
            "cardShape": {"q": "question", "a": "answer"},
            "shared": "fnv1a32(question) -> indexes into `decks` (in this file's order) for every "
                      "question carried by 2+ decks — the blended hierarchy's shared cards. Makes "
                      "cross-deck credit residency-independent (see noteCardDone).",
        },
        "decks": {k: manifest[k] for k in sorted(manifest)},
        "shared": {h: shared[h] for h in sorted(shared)},
    }, ensure_ascii=False, separators=(",", ":")))
    if collisions:
        print(f"flashcards/: {collisions} deck(s) sharing a hashed chunk file")
    return len(decks), sum(len(d["cards"]) for d in decks.values())


def deck_name(key: str) -> str:
    """'Closed Guard|Bottom' -> 'Closed Guard'."""
    return key.rsplit("|", 1)[0]


def build_technique_weights(graph: dict, iters: int = 240, damp: float = 0.85) -> dict:
    """How often a roll ACTUALLY passes through each technique — the graph's stationary
    distribution, not a cutoff.

    The state machine is a Markov chain: position-role --attempt_probability--> technique
    --outcome probability--> position-role. Power-iterate the position distribution, then read
    off each technique's expected visit rate. Damping (PageRank-style teleport to uniform) keeps
    it ergodic despite absorbing finishes and dead ends.

    Replaces the earlier "drop the rare 20% tail" canon, which was arbitrary: attempt_probability
    is normalised PER POSITION across ~10-20 options, so the distribution is flat and any mass
    cutoff is meaningless (80% of the mass kept 724 of 1270 techniques). Weighting keeps every
    technique and lets its real frequency decide how much it counts.

    Returns {deckKey: weight} normalised to sum 1. Consumed by the app's gameScore():
    score = SUM(weight_i * mastery_i) — 1.0 means you have proven the whole game."""
    positions = graph.get("positions") or {}
    tech_tables: dict[str, list] = {}          # technique id -> [(dest position id, p)]
    tech_name: dict[str, str] = {}
    for bucket in ("transitions", "submissions"):
        for tid, node in (graph.get(bucket) or {}).items():
            if node.get("role") != "attacker":
                continue
            base = tid.rsplit("/", 1)[0]
            tech_name[base] = node.get("name") or base
            outs = []
            for o in node.get("outcomes") or []:
                to, p = o.get("to"), o.get("probability")
                if not isinstance(p, (int, float)):
                    continue
                outs.append((to, float(p) / 100.0))
            tech_tables[base] = outs

    live = [pid for pid, p in positions.items() if p.get("role") in ("top", "bottom") and p.get("transitions")]
    if not live:
        return {}
    uni = 1.0 / len(live)
    pi = {pid: uni for pid in live}
    visits: dict[str, float] = {}

    for it in range(iters):
        nxt = {pid: 0.0 for pid in live}
        visits = {}
        leaked = 0.0
        for pid, mass in pi.items():
            if mass <= 0:
                continue
            for edge in positions[pid].get("transitions") or []:
                ap = edge.get("attemptProbability")
                tgt = edge.get("target")
                if not tgt or not isinstance(ap, (int, float)):
                    continue
                flow = mass * (float(ap) / 100.0)
                if flow <= 0:
                    continue
                visits[tgt] = visits.get(tgt, 0.0) + flow
                for dest, p in tech_tables.get(tgt, []):
                    if dest in nxt:
                        nxt[dest] += flow * p
                    else:
                        leaked += flow * p          # game-over / unresolvable → restart uniformly
                if tgt not in tech_tables:
                    leaked += flow
        total = sum(nxt.values()) + leaked
        if total <= 0:
            break
        for pid in nxt:
            nxt[pid] = damp * (nxt[pid] + leaked * uni) / total + (1.0 - damp) * uni
        s = sum(nxt.values()) or 1.0
        pi = {pid: v / s for pid, v in nxt.items()}

    out: dict[str, float] = {}
    for tid, v in visits.items():
        out[f"{tech_name.get(tid, tid)}|Attacker"] = v
    s = sum(out.values()) or 1.0
    out = {k: round(v / s, 8) for k, v in sorted(out.items(), key=lambda kv: -kv[1]) if v / s >= 1e-7}
    s2 = sum(out.values()) or 1.0
    out = {k: round(v / s2, 8) for k, v in out.items()}
    top = list(out.items())[:3]
    print(f"  weights: {len(out)} techniques by stationary frequency; heaviest {[(k.split('|')[0], round(v, 4)) for k, v in top]}")
    # `pi` — where the roll SPENDS ITS TIME, keyed the way `build_flashcards` keys a position deck
    # (the graph names every position hub "... Top"/"... Bottom"; the deck key strips that tail).
    # It was computed and thrown away for 77 versions while `gameScore` weighted all 272 position
    # decks at zero. Returned, not re-derived: one power iteration, two readings of it.
    occ: dict[str, float] = {}
    for pid, m in pi.items():
        nm = (positions[pid].get("name") or "")
        for suf in (" Top", " Bottom"):
            if nm.endswith(suf):
                nm = nm[: -len(suf)]
                break
        occ[f"{nm}|{(positions[pid].get('role') or '').capitalize()}"] = \
            occ.get(f"{nm}|{(positions[pid].get('role') or '').capitalize()}", 0.0) + m
    so = sum(occ.values()) or 1.0
    return out, {k: round(v / so, 8) for k, v in sorted(occ.items(), key=lambda kv: -kv[1])}


# One roll STEP exercises three separable kinds of knowledge, and each happens once per step:
# where you are, what you do from there, and what is being done to you. So each block is its own
# distribution summing to 1, and the score is their mean — no free parameter, and no block can be
# tuned without saying so here.
SCORE_BLOCKS = ("position", "attacker", "defender")


def build_score_weights(graph: dict) -> dict:
    """The table `gameScore` sums: EVERY authored deck the state machine can reach, not just the
    attacking third of it.

    WHY THIS IS NOT A TUNING KNOB. `sum(pi)` and `sum(visits)` are both exactly 1.0 because
    attempt probabilities sum to 100 on 272 of 272 position role-nodes in both rulesets — measured,
    and `validate_graph_integrity` errors on any frame that does not. Occupancy and visit-rate are
    therefore two readings of the SAME unit step, not different units, which is what makes a plain
    mean of three blocks a statement rather than a weighting choice. (A previous session, mine,
    called them "different units" and used that to argue the split was arbitrary. It was wrong.)

    THE DEFENDER BLOCK MIRRORS THE ATTACKER ONE. Every technique visit is one exchange with two
    seats: someone performs it and someone receives it. The stationary rate at which you defend
    technique i is the rate at which it is attempted, so the mirror is the symmetric reading, not
    an estimate. `docs/Neural.md` used to justify excluding it with "your drilling does not change
    the opponent's rates" — true, and about the ODDS model. This is a KNOWLEDGE score: knowing the
    escape is knowledge whether or not it moves their success rate.

    NOTHING HERE DECAYS OR EXPIRES. The score moves only on answers — `deckMastery` is stage-based
    and the belt cannot drop because time passed. This adds weight to what you have studied; it
    takes nothing away for not studying. The retention/pressure choice does not arise in a weights
    table and would arise in `_schedule` (SRS intervals), which is a separate change.
    """
    att, occ = build_technique_weights(graph)
    blocks = {
        "position": occ,
        "attacker": att,
        "defender": {k.replace("|Attacker", "|Defender"): v for k, v in att.items()},
    }
    assert set(blocks) == set(SCORE_BLOCKS)
    out: dict[str, float] = {}
    for name in SCORE_BLOCKS:
        b = blocks[name]
        sb = sum(b.values()) or 1.0
        if not b:
            raise SystemExit(
                f"[neural] score weights: the {name!r} block is EMPTY. A block that stops "
                f"producing keys makes a third of the corpus silently unscoreable again, which "
                f"is the exact defect this table exists to close. Refusing to emit."
            )
        for k, v in b.items():
            out[k] = out.get(k, 0.0) + (v / sb) / len(SCORE_BLOCKS)
    s = sum(out.values()) or 1.0
    out = {k: round(v / s, 8) for k, v in sorted(out.items(), key=lambda kv: -kv[1])}
    print(f"  score weights: {len(out)} decks over {len(SCORE_BLOCKS)} blocks "
          f"({', '.join(f'{n} {len(blocks[n])}' for n in SCORE_BLOCKS)}); "
          f"heaviest {[(k, round(v, 4)) for k, v in list(out.items())[:3]]}")
    return out



# Wire divisor for a score weight: each value ships as round(weight * WEIGHT_DIV) and the app
# divides. An INTEGER divisor, not a float unit, so the wire can represent its own round numbers.
# 1e7 keeps three significant figures on the lightest deck in the corpus with room to spare, and
# `_compact_score_weights` refuses rather than letting a real weight round away.
WEIGHT_DIV = 10_000_000


def _compact_score_weights(full: dict) -> dict:
    """The wire for `build_score_weights`: position keys once, technique names once, one integer
    each — {div, p:{k,v}, t:{k,v}} — where every `t` name carries BOTH seats at the same value.

    WHY. Spelled as a plain 2,810-key dict this table is 168,616 raw / 25,756 gzip and lands the
    first hand at 382,197 of a 385,000 ceiling — inside the band `payload-first-hand.spec.ts` calls
    unknown until CI has spoken. The key strings are the entire cost, and 1,269 of the 2,810 are a
    second spelling of a name already present. Shipping each name once puts it at 88,360 raw /
    16,708 gzip, which is SMALLER than the attacker-only table it replaces (17,417): the score more
    than doubles its reach and the boot payload goes DOWN 709 bytes.

    THE MIRROR IS A CONSTRUCTION, NOT AN ESTIMATE, so it is safe to spell once: the defender block
    IS the attacker block re-keyed, both normalised the same way, so the two values are equal for
    all 1,269 techniques. The round-trip below asserts exactly that against the expanded dict, so
    the day anyone makes the seats differ this refuses to emit rather than silently halving one.

    `weights` is deliberately NOT written any more. An older bundle iterating this shape would do
    `total += w["div"]` and `score += w["p"] * mastery` — arithmetic on an object — and render
    `Mastered NaN%`. Under a NEW key the same bundle finds nothing, scores 0 and recovers on the
    next reload, which is the failure worth having.
    """
    pos = {k: v for k, v in full.items() if not k.endswith(("|Attacker", "|Defender"))}
    att = {k[: -len("|Attacker")]: v for k, v in full.items() if k.endswith("|Attacker")}
    wire = {
        "div": WEIGHT_DIV,
        "p": {"k": list(pos), "v": [round(v * WEIGHT_DIV) for v in pos.values()]},
        "t": {"k": list(att), "v": [round(v * WEIGHT_DIV) for v in att.values()]},
    }
    # ROUND-TRIP OR REFUSE. Expand the wire exactly as the app does and compare to the table this
    # was built from. A compaction that silently drops or halves a block is the same defect class
    # the whole ledger exists for, so it may not be assumed — it is checked, every run.
    back = {}
    for k, v in zip(wire["p"]["k"], wire["p"]["v"]):
        back[k] = v / WEIGHT_DIV
    for k, v in zip(wire["t"]["k"], wire["t"]["v"]):
        back[f"{k}|Attacker"] = back[f"{k}|Defender"] = v / WEIGHT_DIV
    lost = sorted(k for k in full if full[k] > 0 and not back.get(k))
    drift = max((abs(back.get(k, 0.0) - full[k]) for k in full), default=0.0)
    if set(back) != set(full) or lost or drift > 1.0 / WEIGHT_DIV:
        raise SystemExit(
            f"[neural] score weights: the compact wire does not round-trip — "
            f"{len(set(full) - set(back))} key(s) missing, {len(set(back) - set(full))} invented, "
            f"{len(lost)} rounded to zero, max drift {drift:.2e} against a {1.0 / WEIGHT_DIV:.0e} "
            f"tolerance. The defender seat is spelled once on the assumption that it equals the "
            f"attacker seat; if that stopped being true, spell both. Refusing to emit."
        )
    print(f"  score wire: {len(wire['p']['k'])} position + {len(wire['t']['k'])} technique keys "
          f"-> {len(back)} decks, round-trip exact to {drift:.1e}")
    return wire

def build_curriculum(out_dir: Path, graph: dict, decks: dict) -> int:
    """Validate then emit the Belt Path curriculum. Returns belt count (0 = no curriculum,
    which is legal — the app falls back to tree view).

    Takes `decks` so the score-coverage ledger can join against the deck set THIS run just built,
    in process. It must not re-read `flashcards/_index.json`: `source/quartz/static/neural/` is
    gitignored in its entirety (.gitignore:71), so a check reading the emitted artifact is a check
    that silently does not run on a fresh checkout."""
    from _curriculum import CURRICULUM, compute_pools, lesson_frames, load_curriculum, load_graph_index
    if not CURRICULUM.exists():
        return 0
    import validate_curriculum
    if validate_curriculum.main() != 0:
        print("ERROR: curriculum invalid — not emitted", file=sys.stderr)
        sys.exit(1)
    cur = load_curriculum()
    nodes, _sizes = load_graph_index()
    for bi, belt in enumerate(cur["belts"]):
        for unit in belt["units"]:
            for lesson in unit["lessons"]:
                node = nodes.get(lesson["nodeId"])
                lf = lesson_frames(lesson, node)
                lesson["frames"] = [f for f in ("gi", "nogi") if lf[f]]
        belt["pool"] = compute_pools(cur["belts"], bi, nodes)
    _score_w = build_score_weights(graph)
    cur["scoreWeights"] = _compact_score_weights(_score_w)
    # PRINTED EVERY RUN, never fatal. The score's own reach is the one thing about `weights` that
    # nothing counted; `validate_score_coverage.py` owns the definition and this is the same call
    # the standalone check makes, so the two can never report different numbers. It reports rather
    # than gates because the fix for what it finds moves every gi player's score — see that file.
    from validate_score_coverage import score_coverage
    score_coverage(decks, graph, {"gi": _score_w, "nogi": _score_w})
    (out_dir / "curriculum.json").write_text(
        json.dumps(cur, ensure_ascii=False, separators=(",", ":")))
    return len(cur["belts"])


SUMMARY_CAP = 240  # contract: systems.json summary is at most 240 chars (card-sized)

# related_content content_type -> the graph-data.json id prefix it must resolve under.
# Types NOT in this map (Principle, System, ...) are pages, not graph nodes — they are
# excluded from BOTH `nodes` and `unresolved` and counted in _meta.nonGraphRefs, because
# calling the ~440 by-design cross-references "unresolved" would drown the real misses (3).
GRAPH_REF_PREFIX = {"Position": "Positions", "Transition": "Transitions", "Submission": "Submissions"}


def _clip(text: str, cap: int = SUMMARY_CAP) -> str:
    """Word-boundary clip to `cap` chars INCLUDING the ellipsis (29 of 47 summaries run long)."""
    t = " ".join((text or "").split())
    if len(t) <= cap:
        return t
    cut = t[: cap - 1].rstrip()
    sp = cut.rfind(" ")
    return (cut[:sp].rstrip() if sp > cap // 2 else cut) + "…"


def _node_indexes(node_ids: list[str]) -> dict:
    """Slug lookups over the ids ACTUALLY PRESENT in graph-data.json (never guessed).

    Four layers, because a content page path and a visual node id legitimately diverge:
      flat     'Positions/Side-Control'            -> ('Positions', 'side-control')
               'Submissions/Kimura/from-Mount'     -> ('Submissions', 'kimura-from-mount')
      leaf     last segment only, so a nested position ('Positions/Half-Guard/Deep-Half-
               Guard') resolves from the bare name a System actually writes ('Deep Half Guard')
      variant  first segment only, so a family name ('Rear Naked Choke') expands to every
               real finish node ('Submissions/Rear-Naked-Choke/from-*') — the hub is not a node
      children page path -> the nodes nested under it (same expansion, keyed by path)
    """
    idx = {"flat": {}, "leaf": {}, "variant": {}, "children": {}}
    for nid in node_ids:
        if "/" not in nid:
            continue
        pre, tail = nid.split("/", 1)
        segs = tail.split("/")
        idx["flat"].setdefault((pre, "-".join(slugify(s) for s in segs)), []).append(nid)
        idx["leaf"].setdefault((pre, slugify(segs[-1])), []).append(nid)
        if len(segs) > 1:
            idx["variant"].setdefault((pre, slugify(segs[0])), []).append(nid)
            for depth in range(1, len(segs)):
                idx["children"].setdefault(f"{pre}/{'/'.join(segs[:depth])}", []).append(nid)
    return idx


def _resolve_member(name: str, ctype: str, path: str | None, ids: set, idx: dict) -> list[str]:
    """Map one related_content reference onto the graph node ids it lights up ([] = unresolved).

    `path` is graph.json's already-resolved member page path, tried first. It is not enough on
    its own: process_systems() drops a reference whose page was already claimed by an earlier
    one, so a System listing both "Knee Slice Pass" and its synonym "Knee Cut Pass" has only the
    first in members[] — hence the slug layers, plus the authored aliases[] retry below."""
    if path:
        if path in ids:
            return [path]
        kids = idx["children"].get(path)
        if kids:
            return sorted(set(kids))
    slug = slugify(name)
    candidates = [slug] + ([idx["alias"][slug]] if slug in idx["alias"] else [])
    prefixes = [GRAPH_REF_PREFIX[ctype]] if ctype in GRAPH_REF_PREFIX else list(GRAPH_REF_PREFIX.values())
    for cand in candidates:
        for pre in prefixes:
            for layer in ("flat", "variant", "leaf"):
                hit = idx[layer].get((pre, cand))
                if hit:
                    return sorted(set(hit))
    return []


def _products(data: dict, sys_name: str) -> list[dict]:
    """The curated BJJFanatics entries, VERBATIM. Content authors them as
    {title, instructor, affiliate_url}; the Neural contract wants {name, instructor, url}
    plus {id, vendor} for the affiliate funnel's utm_term / data-vendor.

    Two ways an entry is DROPPED rather than shipped:
      * no name or no URL — a card that links nowhere earns nothing and misleads;
      * link_status != "live" — the URL was not opened and confirmed to resolve to that exact
        instructional (or was confirmed DEAD). Verified 2026-08-09: two of the three authored
        products 404. A 404 CTA earns exactly as much as no CTA and costs the reader's trust,
        so the system degrades to its no-product surface until a human re-verifies the link.
        Fail-safe: an entry with no link_status at all is treated as unverified.
    NOTHING here is ever synthesized — no URL, no product.
    """
    out = []
    for p in data.get("products") or []:
        if not isinstance(p, dict):
            continue
        name = (p.get("title") or p.get("name") or "").strip()
        url = (p.get("affiliate_url") or p.get("url") or "").strip()
        if not (name and url):
            print(f"  systems: skipped product without name+url in {sys_name}")
            continue
        status = (p.get("link_status") or "unverified").strip().lower()
        if status != "live":
            print(f"  systems: skipped product '{name}' in {sys_name} — link_status={status!r} "
                  f"(last checked {p.get('link_checked') or 'never'}); an unverified or dead "
                  f"affiliate link must not render")
            continue
        out.append({
            "name": name,
            "instructor": (p.get("instructor") or "").strip(),
            "url": url,
            "id": (p.get("id") or "").strip(),
            "vendor": (p.get("vendor") or "BJJFanatics").strip(),
        })
    return out


def build_systems(graph: dict, node_ids: list[str]) -> dict:
    """The Systems library: one entry per content/Systems/*.json, each carrying the graph
    nodes it teaches so the app can list all 47 AND highlight a System's members on the graph.

    Membership comes from related_content (the authored edge list) resolved against the ids
    in graph-data.json. Unresolvable graph-typed references are REPORTED per system in
    `unresolved`, never dropped and never faked."""
    from regenerate_graph import build_alias_maps, quartz_slug  # page path + authored synonyms

    ids = set(node_ids)
    idx = _node_indexes(node_ids)
    # aliases[] is the authored synonym set (Knee Cut Pass -> Knee Slice Pass); without it a
    # System that writes the synonym reports a false "unresolved" for a node it already lights.
    pos_alias, tech_alias = build_alias_maps(ROOT / "content")
    idx["alias"] = {**pos_alias, **{a: v["slug"] for a, v in tech_alias.items()}}
    gsystems = graph.get("systems") or {}

    systems, non_graph, n_products = [], 0, 0
    for path in sorted(SYSTEMS_DIR.glob("*.json")):
        data = json.loads(path.read_text())
        # the page path (and therefore the node id) is derived from the FILE, not the JSON name
        page = f"Systems/{quartz_slug(path.stem)}"
        name = (data.get("name") or path.stem).strip()
        members = {
            (m.get("name") or "").strip().lower(): m.get("path")
            for m in (gsystems.get(slugify(name)) or {}).get("members") or []
        }

        nodes, unresolved, glue = [], [], []
        for item in data.get("related_content") or []:
            if not isinstance(item, dict):
                continue
            ref = (item.get("name") or "").strip()
            ctype = (item.get("content_type") or "").strip()
            if not ref:
                continue
            if ctype and ctype not in GRAPH_REF_PREFIX:
                non_graph += 1
                continue
            hit = _resolve_member(ref, ctype, members.get(ref.lower()), ids, idx)
            if hit:
                nodes.extend(hit)
                # THE GLUE. A System is not a node, it is a set of nodes plus the reason they
                # belong together — the authored `relationship` says what each one DOES in the
                # system ("primary finishing position", "entry when they refuse the leg"). Lighting
                # nodes up without it just shows a constellation; this is what makes it a system.
                # One entry per authored ref (not per resolved id) so the text is never duplicated
                # across a hub's expanded children.
                glue.append({"ref": ref, "nodes": hit, "role": _clip(item.get("relationship") or "", 180)})
            elif ref not in unresolved:
                unresolved.append(ref)

        # The ordered spine: implementation_sequence is the system's narrative, and it is what
        # turns a lit set into "do this, then this". Carried verbatim, clipped, phases only.
        sequence = [
            {
                "n": step.get("step_number") or i + 1,
                "phase": _clip((step.get("phase") or "").strip(), 80),
                "detail": _clip((step.get("description") or "").strip(), 220),
            }
            for i, step in enumerate(data.get("implementation_sequence") or [])
            if isinstance(step, dict) and (step.get("phase") or step.get("description"))
        ]

        prods = _products(data, name)
        n_products += len(prods)
        systems.append({
            "id": page,
            "name": name,
            "url": f"/{page}",
            "summary": _clip(data.get("summary") or data.get("description") or ""),
            "type": (data.get("system_type") or "").strip(),
            "difficulty": (data.get("difficulty_level") or "").strip(),
            "nodes": sorted(set(nodes)),
            "glue": glue,
            "sequence": sequence,
            "unresolved": unresolved,
            "products": prods,
        })

    return {
        "_meta": {
            "count": len(systems),
            "unresolved": sum(len(s["unresolved"]) for s in systems),
            "nodes": sum(len(s["nodes"]) for s in systems),
            "nonGraphRefs": non_graph,
            "products": n_products,
            "note": "Generated by scripts/regenerate_neural_data.py from content/Systems/*.json + "
                    "graph.json membership; `nodes` are graph-data.json ids. nonGraphRefs counts "
                    "Principle/System cross-references, which are pages and never graph nodes.",
        },
        "systems": systems,
    }


def main() -> None:
    if not LAYOUT.exists() or not GRAPH.exists():
        print(f"ERROR: need {LAYOUT} and {GRAPH} (run regenerate:graph first)", file=sys.stderr)
        sys.exit(1)
    layout = json.loads(LAYOUT.read_text())
    graph = json.loads(GRAPH.read_text())
    ordinals = load_ordinals()
    unminted = sorted({n["id"] for n in layout.get("nodes", [])} - set(ordinals))
    if unminted:
        print(
            f"ERROR: {len(unminted)} layout node(s) have no share-link ordinal "
            f"(first few: {unminted[:5]}). Run `npm run regenerate:ordinals` and commit "
            "node_ordinals.json.",
            file=sys.stderr,
        )
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    gd = build_graph_data(layout, graph, ordinals)
    (OUT_DIR / "graph-data.json").write_text(json.dumps(gd, ensure_ascii=False, separators=(",", ":")))

    # Retired payloads: delete them if an older tree still has them. These are the two files the
    # whole first-run defect was made of (16.4MB + 21.2MB), the output dir is gitignored, and a
    # stale copy would keep failing the payload gate long after the code stopped emitting them.
    for stale in ("flashcards.json", "technique-content.js"):
        f = OUT_DIR / stale
        if f.exists():
            f.unlink()
            print(f"removed retired payload: {stale}")

    decks = build_flashcards(graph)
    n_decks, n_cards = write_flashcards(decks, OUT_DIR)
    # The 16.4MB flashcards.json monolith is GONE (v1.80.4). It was the app's deck payload and it
    # shipped every card for all 2,924 decks before the visitor could make a move; the app now
    # boots from flashcards/_index.json and fetches chunks. Nothing reads a monolith any more —
    # tests and the MC audit assemble the corpus from the chunks (scripts/_neural_decks.py,
    # e2e/decks.ts), so there is exactly ONE source of truth for a deck's cards.
    # Per-node dossiers, one chunk each, replacing the 21.2MB technique-content.js.
    from _neural_content import write_ng_chunks
    n_ng, n_files, n_coll = write_ng_chunks(graph, OUT_DIR / "content")
    print(f"content/: {n_ng} node dossiers in {n_files} chunks"
          + (f" ({n_coll} sharing a hashed file)" if n_coll else ""))

    # curriculum.json — the Belt Path (belts -> units -> lessons -> checkpoint -> test).
    # Validated first (a bad curriculum must never be emitted), then enriched with resolved
    # per-lesson live frames + computed per-belt opponent pools (never authored).
    n_belts = build_curriculum(OUT_DIR, graph, decks)
    if n_belts:
        print(f"curriculum.json: {n_belts} belts emitted")

    # systems.json — the 47-System library + the graph nodes each System highlights. Resolved
    # against gd["nodes"] (the ids the app actually renders), so a highlight can never point at
    # a node the graph does not have.
    sysd = build_systems(graph, [n["id"] for n in gd["nodes"]])
    (OUT_DIR / "systems.json").write_text(json.dumps(sysd, ensure_ascii=False, separators=(",", ":")))
    sm = sysd["_meta"]
    print(f"systems.json: {sm['count']} systems, {sm['nodes']} member nodes, "
          f"{sm['unresolved']} unresolved refs, {sm['products']} products "
          f"({sm['nonGraphRefs']} non-graph cross-refs skipped)")

    n_cal = sum(1 for n in gd["nodes"] if "cal" in n)
    print(f"graph-data.json: {len(gd['nodes'])} nodes ({n_cal} with calibrated payload, "
          f"all carrying share ordinals 0-{max(ordinals.values())}), "
          f"{len(gd['links'])} links")
    print(f"flashcards/: {n_decks} per-deck chunks + _index.json manifest, {n_cards} cards")
    print(f"-> {OUT_DIR}")


if __name__ == "__main__":
    main()
