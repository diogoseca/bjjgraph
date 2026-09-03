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
  - concepts.json : the Principles + Learning libraries — the INDEX only ({_meta,
    concepts:[{id,key,name,cat,url,summary,meta,nodes,unresolved}]}), i.e. exactly what the list
    and the graph highlight need. Each concept's READABLE BODY (overview, points, contexts,
    errors, drills, plus glue and related) is a dossier in the content/ chunk space above,
    addressed by `key` = "<Name>|<Principle|Learning>", so the app reads it through the same
    _ngc() cache as a node dossier. Deferred: nothing on the roll path fetches it.
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


# The two seats a real roll begins from. `frame_reachable` walks OUT from here; anything the walk
# never touches is a state that ruleset cannot produce.
ROLL_SEEDS = ("standing-position/top", "standing-position/bottom")

# WHICH FRAMES THE WALK IS ALLOWED TO EMPTY, and why this is not simply both.
#
# The walk answers "can a session in F arrive here". It is honest in both columns, but the two
# columns mean different things, because the per-frame zeros they stand on were written for
# different reasons:
#
#   no-gi — EQUIPMENT. All 104 techniques and 18 role-nodes it isolates trace to cloth: a lapel
#           threaded through a leg, four fingers inside a collar. No garment, no state. Absence is
#           the only honest rendering.
#   gi    — LEGALITY. All 21 are the heel-hook family plus kneebar/aoki/buggy, zeroed because
#           IBJJF bans them, and several of their own `availability_rulings` say so conditionally
#           ("sub-only/ADCC-gi voices keep a floor of 1"). That is a choice about which gi ruleset
#           the app models, not a fact about a jacket — and the owner's scope for this feature was
#           explicit: gear vs no gear, exclusion applies to the IMPOSSIBLE class, heel-hooks-in-gi
#           are RESTRICTED and are not to be touched.
#
# IT IS ALSO NOT SAFE TODAY, which is how the distinction got measured rather than argued.
# `backside-50-50/bottom` has exactly ONE gi move that survives `optionsFor`'s role AND origin
# filters, and it is `Heel Hook from Backside 50-50`. Excluding it empties the main pass, and the
# hand falls through to the ORIGIN-RELAXED fallback — five cards from other origins carrying no
# `ord` and no `ordOdds`, i.e. an unranked hand with no EDGE. graph.json cannot see this coming:
# its per-frame sums say the state still has live moves, because they do not apply role or origin.
#
# So the gi column is REPORTED by `frame_reachable`, ledgered by `validate:availability`, and NOT
# excluded. Adding "gi" here is a one-token change and a product decision, not a cleanup.
EXCLUDING_FRAMES = ("nogi",)


def frame_reachable(graph: dict, frame: str) -> dict:
    """Every position role-node and technique a session in `frame` can ACTUALLY ARRIVE AT.

    THE QUESTION THIS REPLACED WAS THE WRONG ONE. `tech_avail` used to ask "does any position
    offer this move with attemptProbability[frame] > 0", which is a question about one edge. It
    cannot see the case that matters: a technique whose only origin is a position that ruleset
    cannot produce. Worm Guard/Bottom deals a full no-gi hand (X-Guard Sweep 33, Omoplata 21) —
    honest numbers CONDITIONAL on standing in worm guard, which requires threading the opponent's
    lapel through their own legs. Every no-gi entry into it is 0, so the condition never holds.
    The old question answered "available"; the walk answers "unreachable", and the second is the
    one the player experiences.

    MEASURED at the switch (`graph.json` at v1.148.0, walked from ROLL_SEEDS):

        frame   unreachable techniques   unreachable position role-nodes
        gi                          21                                 0
        nogi                       104                                18

    The 18 are Lapel / Worm / Squid / Ringworm / Piranha / Lasso / Collar-Sleeve / Inverted-Lasso
    / Russian-Leg-Lasso guard, both seats — nine cloth-defined guards, each independently carrying
    an explicit garment requirement in its own authored `prerequisites`. NOTHING HERE READS A NAME
    (ruling P3a): the panel refuted the name regex in advance on `collar-sleeve-guard__bottom`
    ("consumers keying availability off the move name would wrongly zero it"), and a name sweep
    flags `Rear Naked Choke from Invisible Collar` — the canonical no-gi choke — because the
    POSITION contains "Collar". The walk reads edges.

    The gi column is NOT equipment. All 21 are the heel-hook family plus kneebar/aoki/buggy, zeroed
    by the calibration for IBJJF LEGALITY, and several of their own rulings say the ban is
    ruleset-dependent ("sub-only/ADCC-gi voices keep a floor of 1"). They are reported by the same
    mechanism because the mechanism is about edges, not about why an edge is zero; whether gi mode
    should hide them is a ruleset-policy choice, not a fact about a garment.

    Cost: two BFS passes over ~1.5k nodes at build time, ~10ms. Not memoised on purpose — it is
    called twice, once per frame.
    """
    positions = graph.get("positions", {})
    out = {}
    for key, node in positions.items():
        if node.get("role") not in ("top", "bottom"):
            continue
        dst = out.setdefault(key, set())
        for t in (node.get("transitions") or []):
            tgt = t.get("target")
            if tgt and _frame_positive(t, frame):
                dst.add("T:" + tgt)
    for section in ("transitions", "submissions"):
        for node in graph.get(section, {}).values():
            hub = node.get("hub")
            if not hub or node.get("role") == "hub":
                continue
            dst = out.setdefault("T:" + hub, set())
            for o in (node.get("outcomes") or []):
                to = o.get("to") or ""
                # `game-over` and bare hubs are not walkable states; only role-nodes carry edges.
                if to in positions:
                    dst.add(to)

    seeds = [s for s in ROLL_SEEDS if s in positions]
    if not seeds:
        raise SystemExit(f"[regenerate_neural_data] frame_reachable: none of {ROLL_SEEDS} is in "
                         f"graph.json — the walk would report EVERYTHING unavailable, which is "
                         f"exactly what a clean run looks like from the outside")
    seen, stack = set(seeds), list(seeds)
    while stack:
        for nxt in out.get(stack.pop(), ()):
            if nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    return {"positions": {k for k in seen if not k.startswith("T:")},
            "techniques": {k[2:] for k in seen if k.startswith("T:")}}

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

    # per-frame availability, REACHABILITY-CLOSED (v1.153.0). See `frame_reachable` for why
    # "attempted somewhere" was the wrong question and what the walk costs.
    walk = {fr: frame_reachable(graph, fr) for fr in ("gi", "nogi")}
    # A frame the exclusion layer does not act on is admitted WHOLE — see EXCLUDING_FRAMES.
    reach = {fr: (walk[fr] if fr in EXCLUDING_FRAMES else
                  {"positions": set(graph.get("positions", {})),
                   "techniques": {v["hub"] for sec in ("transitions", "submissions")
                                  for v in graph.get(sec, {}).values() if v.get("hub")}})
             for fr in ("gi", "nogi")}
    tech_avail = {}
    for fr in ("gi", "nogi"):
        for hub in reach[fr]["techniques"]:
            tech_avail.setdefault(hub, {"gi": False, "nogi": False})[fr] = True
    # every technique a position offers gets a row even if it is reachable in NEITHER frame, so a
    # fully-isolated node ships `{gi:false,nogi:false}` rather than no `avail` at all — absent
    # availability falls through to giAllows' fail-open branch, which is the opposite answer.
    for node in graph.get("positions", {}).values():
        for t in node.get("transitions", []) or []:
            if t.get("technique"):
                tech_avail.setdefault(slugify(t["technique"]), {"gi": False, "nogi": False})

    def _pos_role(slug: str, role: str):
        """Resolve a graph.json position role-node: nested layout slugs are compound
        ('mount/high-mount') but graph.json keys them bare ('high-mount/top')."""
        for c in ([slug, slug.rsplit("/", 1)[-1]] if "/" in slug else [slug]):
            nn = graph["positions"].get(f"{c}/{role}")
            if nn:
                return nn
        return None

    # ── `aka`: the position's FIRST authored alias (v1.171.0) ─────────────────────────────
    # The static page has rendered `aliases[]` as "Also known as" since the synonym epic; the app
    # never saw it, so a player standing on Kesa Gatame had no way to learn it is the Scarf Hold
    # they were taught. Only the first alias ships (~20 bytes on ~16 of 133 positions), only on
    # positions (a technique's qualifier slot is already taken by "from <origin>"), and only
    # to DOM surfaces — the canvas label is width-bound (halfW, _fitText). Read from the
    # authored JSON, not graph.json, which does not carry the field. Keyed by the position's
    # own `slug` because that is what `posId` is (leaf slug, see the node loop below).
    pos_aka = {}
    for pf in sorted((ROOT / "content/Positions").rglob("*.json")):
        try:
            pd = json.loads(pf.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        al = pd.get("aliases") if isinstance(pd, dict) else None
        if isinstance(al, list) and al and isinstance(al[0], str) and al[0].strip():
            pos_aka[slugify(pd.get("slug") or pd.get("name") or pf.stem)] = al[0].strip()

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
            # A layout position node is a HUB: it collapses top+bottom, so its `avail` is the OR
            # over both seats. That is only honest while the two seats agree — a position you can
            # reach on the bottom but not the top would need a per-role field, and `_avail_split`
            # below fails the build if one ever appears rather than letting the OR paper over it.
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
                    key = f"{n.get('hub') or slug.rsplit('/', 1)[-1]}/{role}"
                    for fr in ("gi", "nogi"):
                        if key in reach[fr]["positions"]:
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
            aka = pos_aka.get(node["posId"])
            if aka:
                node["aka"] = aka
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

    # ── AVAILABILITY COVERAGE, PRINTED EVERY RUN ────────────────────────────────────────────
    # `avail` is the only thing that removes a node from a ruleset, so an empty or all-true table
    # is indistinguishable from "no move is gi-only" — the exact shape of failure this repo has
    # rediscovered 17 times. Count it, name the seat-split case, and refuse both degenerate ends.
    _av = {"positions": {"gi": 0, "nogi": 0, "n": 0}, "techniques": {"gi": 0, "nogi": 0, "n": 0}}
    for nd in nodes:
        bucket = _av["positions"] if nd["ty"] == "positions" else _av["techniques"]
        av = (nd.get("cal") or {}).get("avail")
        if not isinstance(av, dict):
            continue
        bucket["n"] += 1
        for fr in ("gi", "nogi"):
            if not av.get(fr):
                bucket[fr] += 1
    for _k, _b in _av.items():
        print(f"  availability: {_k} {_b['n']} with a verdict — "
              f"{_b['gi']} absent in gi, {_b['nogi']} absent in nogi")
    if _av["techniques"]["n"] == 0:
        raise SystemExit("[neural] availability: not one technique carries `avail`. The join is "
                         "broken, and a broken join prints what a clean run prints.")
    if all(_av["techniques"][fr] == 0 for fr in EXCLUDING_FRAMES):
        raise SystemExit("[neural] availability: every technique is available in BOTH frames. The "
                         "corpus has authored ruleset zeros; a table that finds none is a matcher "
                         "that matched nothing, not a corpus without gi-only moves.")
    # `aka` is a join by slug too, and a join that matched nothing looks exactly like a corpus
    # with no aliases. The authored count is the floor: every position that carries aliases[]
    # must land on exactly one wire node, or the key changed and the surface went silently blank.
    _aka_n = sum(1 for nd in nodes if nd["ty"] == "positions" and nd.get("aka"))
    print(f"  aka: {_aka_n} positions carry an alias on the wire ({len(pos_aka)} authored)")
    if _aka_n != len(pos_aka):
        raise SystemExit(f"[neural] aka join: {len(pos_aka)} positions author aliases[] but "
                         f"{_aka_n} wire nodes carry one. `posId` and the authored `slug` no "
                         f"longer agree for {len(pos_aka) - _aka_n} of them.")

    # A position's wire node is a HUB — one `avail` for both seats. That is only sound while the
    # seats agree. They do today (9 cloth guards, 18 role-nodes, always in pairs); if one ever
    # splits, the OR above would silently re-admit the unreachable seat, so refuse instead.
    _seats = {}
    for _key, _node in graph.get("positions", {}).items():
        if _node.get("role") not in ("top", "bottom") or not _node.get("transitions"):
            continue
        _hub = _node.get("hub") or _key.rsplit("/", 1)[0]
        for fr in ("gi", "nogi"):
            _seats.setdefault((_hub, fr), set()).add(_key in reach[fr]["positions"])
    _split = sorted({h for (h, fr), vals in _seats.items() if len(vals) > 1})
    if _split:
        raise SystemExit(
            f"[neural] availability: {len(_split)} position(s) are reachable on one seat and not "
            f"the other ({_split[:5]}). The wire carries ONE `avail` per position hub, so the OR "
            f"would re-admit the unreachable seat. Emit a per-role availability field first."
        )
    print(f"  availability: {len(_seats) // 2} position hubs, both seats agree in both frames")

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


def build_technique_weights(graph: dict, frame: str, iters: int = 240, damp: float = 0.85) -> dict:
    """How often a roll ACTUALLY passes through each technique IN `frame` — the graph's
    stationary distribution, not a cutoff.

    THE FRAME IS REQUIRED, WITH NO DEFAULT, ON PURPOSE. This read `edge["attemptProbability"]`
    — the folded NO-GI scalar — for 77 versions while `attemptProbabilityByRuleset` sat on the
    same dict on all 2,541 edges. 52 techniques are attemptable ONLY in gi, which is the app's
    DEFAULT ruleset, so they scored ZERO; once v1.145.13 widened the table to both seats that
    was 104 decks and 739 authored cards. A default here would let a caller re-acquire the bug
    by omission, which is how it survived 77 versions in the first place — so callers say it.
    Both returned tables are driven by the SAME walk, so the frame fixes occupancy too.

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
                ap = _frame_attempt(edge, frame)
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
    print(f"  weights ({frame}): {len(out)} techniques by stationary frequency; heaviest {[(k.split('|')[0], round(v, 4)) for k, v in top]}")
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


def build_score_weights(graph: dict, frame: str) -> dict:
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
    att, occ = build_technique_weights(graph, frame)
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
    print(f"  score weights ({frame}): {len(out)} decks over {len(SCORE_BLOCKS)} blocks "
          f"({', '.join(f'{n} {len(blocks[n])}' for n in SCORE_BLOCKS)}); "
          f"heaviest {[(k, round(v, 4)) for k, v in list(out.items())[:3]]}")
    return out



# Wire divisor for a score weight: each value ships as round(weight * WEIGHT_DIV) and the app
# divides. An INTEGER divisor, not a float unit, so the wire can represent its own round numbers.
# 1e7 keeps three significant figures on the lightest deck in the corpus with room to spare, and
# `_compact_score_weights` refuses rather than letting a real weight round away.
WEIGHT_DIV = 10_000_000


def _compact_score_weights(tables: dict) -> dict:
    """The wire for `build_score_weights`, BOTH RULESETS: position keys once, technique names
    once, one integer per frame each — {div, p:{k, gi, nogi}, t:{k, gi, nogi}} — where every `t`
    name carries both seats at the same value.

    WHY KEYS ONCE. Spelled as a plain 2,810-key dict this table is 168,616 raw / 25,756 gzip and
    lands the first hand at 382,197 of a 385,000 ceiling. The key strings are the entire cost, and
    1,269 of the 2,810 are a second spelling of a name already present. Shipping each name once
    and hanging one integer array per frame off it means the SECOND ruleset costs only integers.

    WHY THE UNION, AND WHY A ZERO IS MEANINGFUL. The two frames do not span the same techniques:
    52 are attemptable only in gi and 16 only in no-gi. `k` is therefore the union and a ZERO in a
    frame's array means "not attemptable in this ruleset" — the app skips it rather than storing a
    key with no mass in `gameScore`'s own denominator. A weight that is real but rounds to zero at
    this divisor means something else entirely and is refused below, not shipped.

    THE MIRROR IS A CONSTRUCTION, NOT AN ESTIMATE, so it is safe to spell once: the defender block
    IS the attacker block re-keyed, both normalised the same way, so the two values are equal for
    every technique. The round-trip asserts exactly that, per frame, against the table it was built
    from — the day anyone makes the seats differ this refuses to emit rather than silently halving
    one.

    A NEW KEY, NOT A NEW SHAPE UNDER THE OLD ONE. `scoreWeights` (v1.145.13) and `weights` before
    it are both left unwritten. An older bundle meeting a changed shape under a key it already
    reads would do arithmetic on an object and render `Mastered NaN%`; under a new key it finds
    nothing, scores 0, and recovers on the next reload. That is the failure worth having, and it
    is v1.145.13's own reasoning applied to v1.145.13.
    """
    frames = tuple(sorted(tables))
    def split(t):
        pos = {k: v for k, v in t.items() if not k.endswith(("|Attacker", "|Defender"))}
        att = {k[: -len("|Attacker")]: v for k, v in t.items() if k.endswith("|Attacker")}
        return pos, att
    parts = {fr: split(tables[fr]) for fr in frames}
    pk = sorted({k for fr in frames for k in parts[fr][0]},
                key=lambda k: -max(parts[fr][0].get(k, 0.0) for fr in frames))
    tk = sorted({k for fr in frames for k in parts[fr][1]},
                key=lambda k: -max(parts[fr][1].get(k, 0.0) for fr in frames))
    wire = {"div": WEIGHT_DIV, "p": {"k": pk}, "t": {"k": tk}}
    for fr in frames:
        pos, att = parts[fr]
        for slot, keys, src in (("p", pk, pos), ("t", tk, att)):
            vals = [round(src.get(k, 0.0) * WEIGHT_DIV) for k in keys]
            lost = [k for i, k in enumerate(keys) if src.get(k, 0.0) > 0 and vals[i] == 0]
            if lost:
                raise SystemExit(
                    f"[neural] score weights ({fr}/{slot}): {len(lost)} key(s) carry real "
                    f"stationary mass that rounds to zero at the wire divisor {WEIGHT_DIV:,}, "
                    f"e.g. {lost[:3]}. A zero weight is INVISIBLE to gameScore, not merely small, "
                    f"and in this wire it positively means 'not attemptable in this ruleset'. "
                    f"Raise WEIGHT_DIV rather than shipping a silent hole."
                )
            wire[slot][fr] = vals
    # ROUND-TRIP OR REFUSE, PER FRAME. Expand the wire exactly as the app does and compare to the
    # table it was built from. A compaction that silently drops or halves a block is the same
    # defect class this whole ledger exists for, so it is checked, every run, for both rulesets.
    for fr in frames:
        full = tables[fr]
        back = {}
        for k, v in zip(wire["p"]["k"], wire["p"][fr]):
            if v:
                back[k] = v / WEIGHT_DIV
        for k, v in zip(wire["t"]["k"], wire["t"][fr]):
            if v:
                back[f"{k}|Attacker"] = back[f"{k}|Defender"] = v / WEIGHT_DIV
        lost = sorted(k for k in full if full[k] > 0 and not back.get(k))
        drift = max((abs(back.get(k, 0.0) - full[k]) for k in full), default=0.0)
        if set(back) != set(full) or lost or drift > 1.0 / WEIGHT_DIV:
            raise SystemExit(
                f"[neural] score weights ({fr}): the compact wire does not round-trip — "
                f"{len(set(full) - set(back))} key(s) missing, {len(set(back) - set(full))} "
                f"invented, {len(lost)} rounded to zero, max drift {drift:.2e} against a "
                f"{1.0 / WEIGHT_DIV:.0e} tolerance. The defender seat is spelled once on the "
                f"assumption that it equals the attacker seat; if that stopped being true, spell "
                f"both. Refusing to emit."
            )
    print(f"  score weights wire: {len(pk)} position + {len(tk)} technique keys x {len(frames)} "
          f"frames at 1/{WEIGHT_DIV:,} ("
          + ", ".join(f"{fr} {sum(1 for v in wire['t'][fr] if v)} tech" for fr in frames) + ")")
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
    tables = {fr: build_score_weights(graph, fr) for fr in ("gi", "nogi")}
    cur["scoreWeightsByRuleset"] = _compact_score_weights(tables)
    # PRINTED EVERY RUN, never fatal here — `validate_score_coverage.py` owns the definition and
    # this is the same call the standalone check makes, so the two can never report different
    # numbers. It is handed the REAL per-frame pair: until v1.146.0 both arguments were the one
    # folded no-gi table, which is why its ruleset row read 104 decks / 739 cards. The gate that
    # makes that fatal is `npm run validate:score-coverage -- --gate`, armed in ci-validate.yml.
    from validate_score_coverage import score_coverage
    score_coverage(decks, graph, tables)
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


def _resolve_member(name: str, ctype: str, path: str | None, ids: set,
                    idx: dict, stats: dict | None = None) -> tuple[list[str], bool]:
    """Map one related_content reference onto the graph node ids it lights up.

    Returns (node ids, was_family_expanded); ([], False) = unresolved.

    `path` is graph.json's already-resolved member page path, tried first. It is not enough on
    its own: process_systems() drops a reference whose page was already claimed by an earlier
    one, so a System listing both "Knee Slice Pass" and its synonym "Knee Cut Pass" has only the
    first in members[] — hence the slug layers, plus the authored aliases[] retry below.

    THE SECOND RETURN VALUE IS LOAD-BEARING. A ref resolving through the `variant` or `children`
    layer named a FAMILY ("Calf Slicer"), not a node — those layers exist because a family hub is
    not in the graph — so one authored word becomes every "from X" finish in the family. That set
    is a candidate list AND a membership list — every instance is a member — but the caller needs
    to know it was a family so the panel can collapse it to one row with a variant count instead
    of printing eleven near-identical rows. It must NOT be used to filter: v1.151.0 narrowed the
    set to instances whose from-position the System also authored and deleted real members
    (`Inside Heel Hook` out of the Craig Jones Leg Lock System); reverted in v1.161.0.
    A `flat` or `leaf` hit is the author naming ONE exact node.

    `stats` is the COVERAGE COUNTER for the last rung (CLAUDE.md section 6.6): the authored
    `content_type` is a claim about which SECTION a name lives in, and an author who is right
    about the move and wrong about the drawer resolves to nothing — invisibly, because an
    unresolved ref is a legitimate outcome. Measured before this rung existed: `Submission
    Chains` names "Triangle from Guard" as a Submission and the node is
    `Transitions/Triangle-from-Guard`, so the ref was dropped while `build_node_index` (the
    resolver two files over) had it all along. The typed prefix is still tried FIRST and alone —
    this is the retry, not a widening — and every fire is counted into `stats["crossType"]` and
    printed, so a rung that stops firing cannot rot in silence."""
    if path:
        if path in ids:
            return [path], False
        kids = idx["children"].get(path)
        if kids:
            return sorted(set(kids)), True
    slug = slugify(name)
    candidates = [slug] + ([idx["alias"][slug]] if slug in idx["alias"] else [])
    typed = [GRAPH_REF_PREFIX[ctype]] if ctype in GRAPH_REF_PREFIX else list(GRAPH_REF_PREFIX.values())
    # rung 2 is EMPTY for an untyped ref (rung 1 already tried all three, in this order), so an
    # untyped ref resolves exactly as it did before this rung existed.
    for cross, prefixes in ((False, typed), (True, [p for p in GRAPH_REF_PREFIX.values() if p not in typed])):
        for cand in candidates:
            for pre in prefixes:
                for layer in ("flat", "variant", "leaf"):
                    hit = idx[layer].get((pre, cand))
                    if hit:
                        if cross and stats is not None:
                            stats["crossType"] = stats.get("crossType", 0) + 1
                        hits = sorted(set(hit))
                        # `variant` IS the family layer; a multi-hit `leaf` is an
                        # expansion too (one bare name, several nested nodes).
                        return hits, (layer == "variant" or len(hits) > 1)
    return [], False


# WHY THERE IS NO ANCHORING FILTER HERE (v1.152.0, reverting v1.151.0)
# ------------------------------------------------------------------------------------------
# v1.151.0 narrowed a family-expanded ref to the instances whose from-position the System also
# authored. The owner rejected the premise outright: "systems aren't perfect perspectives.
# usually they cover some transitions, some positions, some submissions, they're not exhaustive
# by rule on anything... it doesn't need to cover the entire family of variants of a position."
#
# The filter therefore deleted real members. Measured over the 47 Systems it dropped 759 of 1711
# member nodes and removed 31 authored refs ENTIRELY: the Craig Jones Leg Lock System lost
# `Inside Heel Hook` AND `Straight Ankle Lock`, the Marcelo Garcia Guillotine System lost `Darce
# Choke` and `Anaconda Choke`, the Ryan Hall Triangle System lost `Triangle Choke Side`, the
# Twister System lost `Electric Chair`. A leg-lock system with no heel hook is not a fix.
#
# MEMBERSHIP IS INCLUSIVE: every instance an authored ref resolves to is a member. The owner's
# actual complaint — one ref becoming eleven near-identical rows — is a PRESENTATION problem and
# is solved where it lives, in the panel, by collapsing a family to ONE row carrying its variant
# count. `glue[].fam` is what lets the panel do that; it is emitted here and never filters.


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


# ── SYSTEM BODIES: the authored half of a System that had never left content/ ─────────────────
# A System's JSON is ~20KB of authored prose and 145,746 words across the 47 — overview,
# key_principles, key_components, common_obstacles, assessment_metrics, training_methodology —
# and until now the app read exactly two of those fields: `summary` (240 chars) and
# `implementation_sequence` (phase + 220-char detail). Everything else reached nobody, in the app
# that is 100% of default traffic.
#
# It ships the SAME WAY a concept body does (build_concepts, below), for the same reason: the
# INDEX (systems.json, deferred, shared 500,000-byte ceiling with concepts.json) carries what the
# LIST and the graph HIGHLIGHT need, and everything only the OPEN PANEL reads rides in a dossier
# chunk in the per-node content/ chunk space, keyed "<Name>|System" and fetched through the SAME
# window.NG_CONTENT chunk cache a node dossier uses (app.src.jsx `_docBody` -> `_hydrateContent`).
# So systems.json grows by the `key` that addresses the body and by nothing else (+2,124 B across
# the 47), and the boot payload does not grow at all.
#
# `|System` keeps the key out of the technique key space (bare display names) and out of the
# concepts' `|Principle` / `|Learning` space; write_ng_chunks() refuses a collision rather than
# letting one dossier overwrite another.
#
# EVERY CAP BELOW SITS AT OR ABOVE THE AUTHORED MAXIMUM, so nothing an author wrote is cut today —
# they are a ceiling against future growth. Measured across all 47 files; recompute before
# quoting:
#
#   python3 - <<'EOF'
#   import json, glob
#   mx = {}
#   for f in glob.glob('content/Systems/*.json'):
#       d = json.load(open(f))
#       def n(k, v): mx[k] = max(mx.get(k, 0), v)
#       def w(t): return len(" ".join(str(t or "").split()))
#       n("overview", w(d.get("overview"))); n("points", len(d.get("key_principles") or []))
#       n("components", len(d.get("key_components") or [])); n("obstacles", len(d.get("common_obstacles") or []))
#       n("metrics", len(d.get("assessment_metrics") or []))
#       for c in d.get("key_components") or []: n("comp_desc", w(c.get("description")))
#       for o in d.get("common_obstacles") or []: n("solution", w(o.get("solution")))
#       tm = d.get("training_methodology") or {}
#       n("drilling", w(tm.get("drilling_approach"))); n("stages", len(tm.get("progression_path") or []))
#       n("mistakes", len(tm.get("common_mistakes") or []))
#   print(mx)
#   EOF
#
# As of v1.155.3: overview 2,071 · principles 8 (longest 175) · components 6 (description 800,
# purpose 133) · obstacles 7 (solution 520) · metrics 5 (description 249, indicator 191) ·
# drilling_approach 1,290 · progression stages 7 (focus 419) · common mistakes 8 (longest 223).
SYS_OVERVIEW_CAP = 2400
SYS_COMPONENTS_MAX, SYS_OBSTACLES_MAX, SYS_METRICS_MAX = 8, 10, 8
SYS_SIGNS_MAX, SYS_MISTAKES_MAX, SYS_STAGES_MAX = 6, 10, 8


def _system_body(data: dict) -> dict:
    """The readable dossier for one System, in the SAME normalised shape a concept body uses.

    One shape means ONE renderer in the app (app.src.jsx `_bodyDocHTML`) rather than a second
    panel that drifts from the first — the section LABELS differ per library and the blocks do
    not. `metrics` and `mistakes` are the two blocks only a System authors; a concept simply
    never emits them, so the renderer's block list is the union and each surface fills its own.
    """
    body: dict = {}
    ov = _clip((data.get("overview") or "").strip(), SYS_OVERVIEW_CAP)
    if ov:
        body["overview"] = ov

    points = [_clip(str(x).strip(), POINT_CAP) for x in (data.get("key_principles") or []) if str(x).strip()]
    if points:
        body["points"] = points[:POINTS_MAX]

    # key_components -> the `contexts` block. `purpose` is a one-line "what it is FOR" beside the
    # description, and it is the only place the authored corpus says that, so it rides as `why`
    # (the same optional slot an error's consequence uses).
    comps = []
    for item in (data.get("key_components") or [])[:SYS_COMPONENTS_MAX]:
        if not isinstance(item, dict):
            continue
        c = _clip((item.get("component_name") or "").strip(), 90)
        how = _clip((item.get("description") or "").strip(), 900)
        if c and how:
            entry = {"c": c, "how": how}
            why = _clip((item.get("purpose") or "").strip(), 200)
            if why:
                entry["why"] = why
            comps.append(entry)
    if comps:
        body["contexts"] = comps

    errors = []
    for item in (data.get("common_obstacles") or [])[:SYS_OBSTACLES_MAX]:
        if not isinstance(item, dict):
            continue
        err = _clip((item.get("obstacle") or "").strip(), 260)
        fix = _clip((item.get("solution") or "").strip(), 600)
        if err and fix:
            errors.append({"err": err, "fix": fix})
    if errors:
        body["errors"] = errors

    metrics = []
    for item in (data.get("assessment_metrics") or [])[:SYS_METRICS_MAX]:
        if not isinstance(item, dict):
            continue
        name = _clip((item.get("metric_name") or "").strip(), 90)
        how = _clip((item.get("description") or "").strip(), 300)
        if not (name and how):
            continue
        signs = [_clip(str(x).strip(), 220) for x in (item.get("proficiency_indicators") or []) if str(x).strip()]
        entry = {"name": name, "how": how}
        if signs:
            entry["signs"] = signs[:SYS_SIGNS_MAX]
        metrics.append(entry)
    if metrics:
        body["metrics"] = metrics

    tm = data.get("training_methodology") or {}
    if isinstance(tm, dict):
        mistakes = [_clip(str(x).strip(), 260) for x in (tm.get("common_mistakes") or []) if str(x).strip()]
        if mistakes:
            body["mistakes"] = mistakes[:SYS_MISTAKES_MAX]
        # drills = how you actually train it: the drilling approach first, then the authored
        # progression stages in order (stage -> name, focus -> how, timeframe -> focus), which is
        # exactly the {name, how, focus} shape the concept drills already draw through.
        drills = []
        drilling = _clip((tm.get("drilling_approach") or "").strip(), 1400)
        if drilling:
            drills.append({"name": "Drilling approach", "how": drilling})
        for st in (tm.get("progression_path") or [])[:SYS_STAGES_MAX]:
            if not isinstance(st, dict):
                continue
            name = _clip((st.get("stage") or "").strip(), 90)
            how = _clip((st.get("focus") or "").strip(), 460)
            if not (name and how):
                continue
            entry = {"name": name, "how": how}
            focus = _clip((st.get("timeframe") or "").strip(), 140)
            if focus:
                entry["focus"] = focus
            drills.append(entry)
        if drills:
            body["drills"] = drills
    return body


def build_systems(graph: dict, nodes: list[dict]) -> tuple[dict, dict]:
    """The Systems library: (index payload, dossier map keyed for the chunk writer).

    One entry per content/Systems/*.json, each carrying the graph nodes it teaches so the app can
    list all 47 AND highlight a System's members on the graph, plus `key` — the address of that
    System's readable body in the content/ chunk space (see _system_body above).

    Membership comes from related_content (the authored edge list) resolved against the ids
    in graph-data.json. Unresolvable graph-typed references are REPORTED per system in
    `unresolved`, never dropped and never faked.

    Membership is INCLUSIVE — see the note above _products(). A ref naming a submission family
    contributes every instance it resolves to, and `glue[].fam` marks it as a family so the panel
    can render it as one row with a variant count instead of N near-identical rows."""
    from regenerate_graph import build_alias_maps, quartz_slug  # page path + authored synonyms

    node_ids = [n["id"] for n in nodes]
    byid = {n["id"]: n for n in nodes}
    ids = set(node_ids)
    idx = _node_indexes(node_ids)
    # aliases[] is the authored synonym set (Knee Cut Pass -> Knee Slice Pass); without it a
    # System that writes the synonym reports a false "unresolved" for a node it already lights.
    pos_alias, tech_alias = build_alias_maps(ROOT / "content")
    idx["alias"] = {**pos_alias, **{a: v["slug"] for a, v in tech_alias.items()}}
    gsystems = graph.get("systems") or {}

    systems, dossiers, non_graph, n_products = [], {}, 0, 0
    stats: dict = {}                    # rung coverage, printed and shipped in _meta
    for path in sorted(SYSTEMS_DIR.glob("*.json")):
        data = json.loads(path.read_text())
        # the page path (and therefore the node id) is derived from the FILE, not the JSON name
        page = f"Systems/{quartz_slug(path.stem)}"
        name = (data.get("name") or path.stem).strip()
        members = {
            (m.get("name") or "").strip().lower(): m.get("path")
            for m in (gsystems.get(slugify(name)) or {}).get("members") or []
        }

        # ---- pass 1: resolve every authored ref, keeping family expansions as CANDIDATES ----
        resolved, unresolved = [], []
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
            hit, is_family = _resolve_member(ref, ctype, members.get(ref.lower()), ids, idx, stats)
            if hit:
                resolved.append((ref, hit, is_family, _clip(item.get("relationship") or "", 180)))
            elif ref not in unresolved:
                unresolved.append(ref)

        # ---- pass 2: every resolved instance is a member; families are MARKED, never filtered ----
        member_nodes, glue = [], []
        for ref, hit, is_family, role in resolved:
            member_nodes.extend(hit)
            # THE GLUE. A System is not a node, it is a set of nodes plus the reason they
            # belong together — the authored `relationship` says what each one DOES in the
            # system ("primary finishing position", "entry when they refuse the leg"). Lighting
            # nodes up without it just shows a constellation; this is what makes it a system.
            # One entry per authored ref (not per resolved id) so the text is never duplicated
            # across a hub's expanded children. `fam` marks a family-expanded ref and carries how
            # many instances it offered, so check_systems_payload.py can SEE the anchoring rule
            # rather than infer it from a node count (a family narrowed to one node otherwise
            # looks exactly like a direct ref).
            entry = {"ref": ref, "nodes": hit, "role": role}
            if is_family:
                # THE PANEL CONTRACT. `fam` says "the author named a family, not a node", so
                # renderSystemDetail collapses these instances into ONE row carrying the variant
                # count instead of listing eleven calf slicers. It is a presentation marker; it
                # never removes a member.
                entry["fam"] = len(hit)
            glue.append(entry)

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
        # THE BODY, and the same duplicate-key rule the concept bodies carry: two files authoring
        # one `name` would share this slot and last-write-wins would ship one System's prose under
        # another's row. Loud, not silent (CLAUDE.md section 6.6).
        key = f"{name}|System"
        if key in dossiers:
            raise SystemExit(
                f"[neural] system key {key!r} is authored twice ({path.name} collides with an "
                f"earlier file of the same `name`). One body would overwrite the other."
            )
        dossiers[key] = dict(_system_body(data), cat="System", name=name, url=f"/{page}")
        systems.append({
            "id": page,
            "key": key,
            "name": name,
            "url": f"/{page}",
            "summary": _clip(data.get("summary") or data.get("description") or ""),
            "type": (data.get("system_type") or "").strip(),
            "difficulty": (data.get("difficulty_level") or "").strip(),
            "nodes": sorted(set(member_nodes)),
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
            "famRefs": sum(1 for s in systems for g in s["glue"] if g.get("fam")),
            "nonGraphRefs": non_graph,
            "crossTypeRefs": stats.get("crossType", 0),
            "products": n_products,
            "note": "Generated by scripts/regenerate_neural_data.py from content/Systems/*.json + "
                    "graph.json membership; `nodes` are graph-data.json ids. Membership is "
                    "INCLUSIVE: a ref naming a submission family contributes every instance, and "
                    "glue[].fam marks it so the panel can show one row plus a variant count. "
                    "nonGraphRefs counts Principle/System cross-references, which are pages and "
                    "never graph nodes. "
                    "`key` addresses the System's readable body in the content/ chunk space.",
        },
        "systems": systems,
    }, dossiers


# ── CONCEPTS: the two authored libraries the app had never been able to open ────────────────
# content/Principles/*.json (59) and content/Learning/*.json (23) are pages, not graph nodes —
# which is exactly why they had no route into the app. Explore carried SIX hardcoded rows under
# "Principles" and FOUR under "Learning", and every one of them was a SEARCH SHORTCUT: clicking
# "Angles" wrote "back" into the search box, so the reader who asked for a concept got a ranked
# list of transitions and no concept at all. (Owner, v1.152.0: "I wasn't searching. The intent
# was to open a content page on the side panel." And: "I remember seeing 20-something or 30
# principles. Now I'm just seeing 6.")
#
# TWO PAYLOADS, THE SAME SPLIT THE REST OF THIS FILE ALREADY USES:
#   · concepts.json          — the INDEX: every concept, its summary, and the graph nodes it
#                              lights. Deferred (nothing on the roll path reads it), 63,074 B —
#                              which with systems.json's 323,544 sits under the shared
#                              `deferred_raw_bytes` ceiling of 500,000. Carrying `glue` here too
#                              cost 160,170 B and left 16,286 B of headroom, so everything only
#                              the OPEN PANEL reads went into the chunk it already fetches.
#   · content/<hash>.json    — the BODY, one dossier per concept, in the SAME chunk space the
#                              per-node dossiers already use, keyed "<Name>|<Principle|Learning>".
#                              The app's `_ngc()` fetches, caches and renders it with no new
#                              machinery — one seam, not two (CLAUDE.md section 6.5).
#
# WHAT IS DELIBERATELY NOT HERE. The full prose (content/Principles/*.md is ~2.4MB of authored
# reading) needs a reading surface this pane is not, and the flashcards these files carry still
# reach no deck — that is the UNACCOUNTED figure build_flashcards() prints every run, and it is
# unchanged by this. What ships is the concept's own spine: summary, overview, the key points,
# where it applies, what goes wrong, and how to train it.
PRINCIPLES_DIR = ROOT / "content/Principles"
LEARNING_DIR = ROOT / "content/Learning"

# (cat, page folder, source dir). `cat` is the app's per-row vocabulary; the Explore section
# label is the folder name, which is also what `exploreOpenSections` has always persisted —
# so a reader's expanded "Principles" fold survives this change.
CONCEPT_LIBS = (
    ("Principle", "Principles", PRINCIPLES_DIR),
    ("Learning", "Learning", LEARNING_DIR),
)

# Body caps. The chunk ceiling is 40,000 bytes (tests/artifacts/budget_site.json) and the fattest
# per-node dossier already emitted is 21,349; the fattest concept under these caps is PRINTED by
# the emit line in main(), every run, so it cannot drift past that gate in silence.
#
# EVERY CAP SITS AT OR ABOVE THE AUTHORED MAXIMUM, so nothing an author wrote is currently cut —
# they are a ceiling against future growth, not an editorial decision. Measured across all 82
# files; recompute before quoting:
#
#   python3 - <<'EOF'
#   import json, glob
#   F = {"Principles": ("key_principles","application_contexts","common_errors","training_approaches"),
#        "Learning":   ("key_takeaways","bjj_applications","common_mistakes","training_exercises")}
#   mx = {}
#   for d_, (p,c,e,t) in F.items():
#       for f in glob.glob(f"content/{d_}/*.json"):
#           d = json.load(open(f))
#           for k, v in (("overview", len(" ".join((d.get("overview") or "").split()))),
#                        ("points", len(d.get(p) or [])), ("contexts", len(d.get(c) or [])),
#                        ("errors", len(d.get(e) or [])), ("drills", len(d.get(t) or [])),
#                        ("point_len", max([0]+[len(" ".join(str(x).split())) for x in (d.get(p) or [])]))):
#               mx[k] = max(mx.get(k, 0), v)
#   print(mx)
#   EOF
#
# As of v1.152.0: overview 2,334 · points 9 (longest 237 chars) · contexts 18 · errors 8 · drills 6.
OVERVIEW_CAP = 2600
POINT_CAP, POINTS_MAX = 300, 12
CTX_MAX, ERR_MAX, DRILL_MAX = 18, 8, 6

# Per library, the authored field names for one normalised body shape. Principles and Learning
# were authored by different templates and say the same things with different words; normalising
# HERE (not in the app) means the renderer has one shape to draw and a third library would only
# add a row to this table.
CONCEPT_FIELDS = {
    "Principle": {
        "points": ("key_principles", None),
        "contexts": ("application_contexts", ("context", "how_applied")),
        "errors": ("common_errors", ("error", "consequence", "correction")),
        "drills": ("training_approaches", ("approach_name", "description", "focus")),
    },
    "Learning": {
        "points": ("key_takeaways", None),
        "contexts": ("bjj_applications", ("scenario", "application")),
        "errors": ("common_mistakes", ("mistake", "consequence", "correction")),
        "drills": ("training_exercises", ("name", "description", "focus")),
    },
}


def _concept_body(data: dict, cat: str) -> dict:
    """The readable dossier for one concept, normalised out of whichever template authored it."""
    spec = CONCEPT_FIELDS[cat]
    body: dict = {}
    ov = _clip((data.get("overview") or "").strip(), OVERVIEW_CAP)
    if ov:
        body["overview"] = ov

    src, _ = spec["points"]
    points = [_clip(str(p).strip(), POINT_CAP) for p in (data.get(src) or []) if str(p).strip()]
    if points:
        body["points"] = points[:POINTS_MAX]

    src, keys = spec["contexts"]
    contexts = []
    for item in (data.get(src) or [])[:CTX_MAX]:
        if not isinstance(item, dict):
            continue
        c, how = _clip((item.get(keys[0]) or "").strip(), 90), _clip((item.get(keys[1]) or "").strip(), 420)
        if c and how:
            contexts.append({"c": c, "how": how})
    if contexts:
        body["contexts"] = contexts

    src, keys = spec["errors"]
    errors = []
    for item in (data.get(src) or [])[:ERR_MAX]:
        if not isinstance(item, dict):
            continue
        err = _clip((item.get(keys[0]) or "").strip(), 260)
        fix = _clip((item.get(keys[2]) or "").strip(), 340)
        if err and fix:
            errors.append({"err": err, "why": _clip((item.get(keys[1]) or "").strip(), 300), "fix": fix})
    if errors:
        body["errors"] = errors

    src, keys = spec["drills"]
    drills = []
    for item in (data.get(src) or [])[:DRILL_MAX]:
        if not isinstance(item, dict):
            continue
        name, how = _clip((item.get(keys[0]) or "").strip(), 90), _clip((item.get(keys[1]) or "").strip(), 420)
        if name and how:
            drills.append({"name": name, "how": how, "focus": _clip((item.get(keys[2]) or "").strip(), 220)})
    if drills:
        body["drills"] = drills
    return body


def build_concepts(node_ids: list[str]) -> tuple[dict, dict]:
    """The Principles + Learning libraries: (index payload, dossier map keyed for the chunk writer).

    Membership is `related_content` resolved against graph-data.json's own ids, the SAME resolver
    build_systems uses — so a concept lights exactly the techniques its author linked, and a
    reference that resolves to nothing is REPORTED per concept in `unresolved`, never dropped and
    never faked.

    Concept-to-concept references (content_type Principle/Learning/System) are not graph nodes and
    were previously counted only as `nonGraphRefs` and thrown away. They are the cross-links a
    reader actually follows between concepts, so they are kept in `related` — resolved against the
    concepts THIS function emits, so a link can never point at a page that is not in the payload."""
    from regenerate_graph import build_alias_maps, quartz_slug

    ids = set(node_ids)
    idx = _node_indexes(node_ids)
    pos_alias, tech_alias = build_alias_maps(ROOT / "content")
    idx["alias"] = {**pos_alias, **{a: v["slug"] for a, v in tech_alias.items()}}

    # PASS 1: read every file, so pass 2 can resolve a cross-reference against the concepts that
    # actually exist rather than minting a link to a page nobody emitted.
    raw = []
    for cat, folder, src_dir in CONCEPT_LIBS:
        for path in sorted(src_dir.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            name = (data.get("name") or path.stem).strip()
            raw.append((cat, folder, path, name, data))
    # `by_slug` is what a concept-to-concept reference resolves through, so a slug shared by two
    # concepts would silently send every link to whichever was read last. Zero collisions today
    # (the two libraries do not overlap); asserted rather than believed, because the failure is a
    # link that opens the WRONG page and reports nothing.
    by_slug = {}
    for cat, folder, path, name, data in raw:
        sl, page = slugify(name), f"{folder}/{quartz_slug(path.stem)}"
        if sl in by_slug and by_slug[sl] != page:
            raise SystemExit(
                f"[neural] concept slug {sl!r} names two pages ({by_slug[sl]} and {page}). Every "
                f"cross-reference to it would resolve to one of them arbitrarily."
            )
        by_slug[sl] = page

    # A REFERENCE AUTHORED AS A PAGE PATH IS THE SAME REFERENCE, SPELLED DIFFERENTLY.
    # Most files write a bare display name ("Side Control"); at least one writes the page path
    # ("Positions/Side Control", "Principles/Frames"). `slugify` folds the whole string to
    # `positions-side-control`, which matches nothing — and the miss is invisible, because an
    # unresolved ref is a legitimate outcome. Measured before this ladder existed: 8 unresolved
    # graph refs, of which 6 were this one spelling in a single file, plus that file's entire set
    # of concept cross-links. Same class as `_tech_keys` (CLAUDE.md section 6.6): try every
    # spelling, then COUNT how often the extra rung fired so it can never rot in silence.
    PATH_CTYPE = {v: k for k, v in GRAPH_REF_PREFIX.items()}      # "Positions" -> "Position"
    CONCEPT_PREFIXES = {folder for _, folder, _ in CONCEPT_LIBS}  # "Principles", "Learning"

    concepts, dossiers = [], {}
    stats: dict = {}                    # rung coverage, printed and shipped in _meta
    non_graph = md_only = path_spelled = fam_expanded = 0
    for cat, folder, path, name, data in raw:
        page = f"{folder}/{quartz_slug(path.stem)}"
        nodes, unresolved, glue, related = [], [], [], []
        for item in data.get("related_content") or []:
            if not isinstance(item, dict):
                continue
            ref = (item.get("name") or "").strip()
            ctype = (item.get("content_type") or "").strip()
            if not ref:
                continue
            pre, sep, tail = ref.partition("/")
            if sep and tail and (pre in PATH_CTYPE or pre in CONCEPT_PREFIXES):
                ref = tail.strip()
                if pre in PATH_CTYPE:
                    ctype = ctype or PATH_CTYPE[pre]
                path_spelled += 1
            if ctype and ctype not in GRAPH_REF_PREFIX:
                # a concept-to-concept (or concept-to-system) link. Kept when it names a page in
                # THIS payload; a System is a page too but lives in systems.json, so it is counted
                # and dropped rather than linked to a row that does not exist here.
                non_graph += 1
                hit = by_slug.get(slugify(ref))
                if hit and hit != page and hit not in related:
                    related.append(hit)
                continue
            # _resolve_member's second return value says whether the ref named a FAMILY and was
            # expanded to its instances. NOTHING is narrowed by it — not here and not in
            # build_systems. v1.151.0 narrowed a System's members to the instances whose
            # from-position it also authored; the owner rejected the premise ("systems arent
            # perfect prespectives... they're not exhaustive by rule on anything") and it had
            # deleted real members, so it was reverted in v1.161.0. A System collapses a family
            # to one PANEL ROW; a concept does not even do that, because "Levers" naming "Kimura"
            # is a claim about every kimura. The expansion is measured and printed
            # (`_meta.familyExpandedRefs`) so this stays a decision on record.
            hit, is_family = _resolve_member(ref, ctype, None, ids, idx, stats)
            if hit:
                fam_expanded += 1 if is_family else 0
                nodes.extend(hit)
                # THE GLUE, exactly as a System carries it: the authored `relationship` is what
                # says why this technique is here. A lit constellation with no reason attached is
                # the thing that made the six search shortcuts feel like an answer.
                glue.append({"ref": ref, "nodes": hit, "role": _clip(item.get("relationship") or "", 180)})
            elif ref not in unresolved:
                unresolved.append(ref)

        # The chunk key. `|Principle` / `|Learning` keeps it out of the technique key space, which
        # is bare display names — two libraries authoring "Base" would otherwise share a slot.
        key = f"{name}|{cat}"
        body = _concept_body(data, cat)
        # THE INDEX/BODY LINE, and it is a byte budget, not a taste call. `concepts.json` is
        # DEFERRED and shares a 500,000-byte ceiling with systems.json (323,544). Everything the
        # LIST and the graph HIGHLIGHT need stays in the index so a click lights up instantly;
        # everything only the open panel reads — the glue, the cross-links, the misses — rides in
        # the chunk the panel already fetches. Measured: carrying `glue` in the index made
        # concepts.json 160,170 B and left 16,286 B of headroom under that ceiling; without it,
        # 63,074 B.
        #
        # A DUPLICATE KEY WOULD BE A SILENT DROP, so it is a build error. Two files under one
        # library authoring the same `name` would share this slot, and last-write-wins would ship
        # one concept's body under the other's row — the same shape as the deck-key collision the
        # flashcard join refuses (CLAUDE.md section 6.6).
        if key in dossiers:
            raise SystemExit(
                f"[neural] concept key {key!r} is authored twice ({path.name} collides with an "
                f"earlier file of the same `name`). One body would overwrite the other. Rename "
                f"one in content/ — there is no baseline to add it to, by design."
            )
        dossiers[key] = dict(body, cat=cat, name=name, url=f"/{page}",
                             glue=glue, related=related, unresolved=unresolved)
        concepts.append({
            "id": page,
            "key": key,
            "name": name,
            "cat": cat,
            "url": f"/{page}",
            "summary": _clip(data.get("summary") or data.get("description") or ""),
            "meta": _clip(" · ".join(
                x for x in ((data.get("application_level") or "").strip(),
                            (data.get("complexity_level") or "").strip(),
                            (data.get("category") or "").strip()) if x), 60),
            "nodes": sorted(set(nodes)),
            "unresolved": unresolved,
        })

    # Editorial Learning pages authored as .md with no .json beside them (3 today) carry no
    # structured body this emitter can read, so they are COUNTED and named rather than listed as
    # rows that would open an empty panel. Printed every run: a silent omission is how the six
    # shortcuts survived (CLAUDE.md section 6.6).
    md_missing = []
    for cat, folder, src_dir in CONCEPT_LIBS:
        for md in sorted(src_dir.glob("*.md")):
            if not (src_dir / f"{md.stem}.json").exists():
                md_only += 1
                md_missing.append(f"{folder}/{md.stem}")

    concepts.sort(key=lambda c: (c["cat"] != "Principle", c["name"].lower()))
    return (
        {
            "_meta": {
                "count": len(concepts),
                "principles": sum(1 for c in concepts if c["cat"] == "Principle"),
                "learning": sum(1 for c in concepts if c["cat"] == "Learning"),
                "nodes": sum(len(c["nodes"]) for c in concepts),
                "unresolved": sum(len(c["unresolved"]) for c in concepts),
                "related": sum(len(d["related"]) for d in dossiers.values()),
                "nonGraphRefs": non_graph,
                "pathSpelledRefs": path_spelled,
                "crossTypeRefs": stats.get("crossType", 0),
                "familyExpandedRefs": fam_expanded,
                "mdOnly": md_only,
                "mdOnlyPages": md_missing,
                "note": "Generated by scripts/regenerate_neural_data.py from content/Principles/*.json "
                        "+ content/Learning/*.json; `nodes` are graph-data.json ids and `key` "
                        "addresses the concept's dossier in the content/ chunk space. mdOnlyPages "
                        "are authored .md with no .json beside them: no structured body to emit.",
            },
            "concepts": concepts,
        },
        dossiers,
    )


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
    # concepts.json + the concept dossiers — the Principles and Learning libraries. Built BEFORE
    # the chunk write because its bodies share that chunk space (see write_ng_chunks(extra=...)).
    conceptd, concept_dossiers = build_concepts([n["id"] for n in gd["nodes"]])
    (OUT_DIR / "concepts.json").write_text(
        json.dumps(conceptd, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    cm = conceptd["_meta"]
    _cmax = max((len(json.dumps(v, ensure_ascii=False, separators=(",", ":")))
                 for v in concept_dossiers.values()), default=0)
    print(f"concepts.json: {cm['principles']} principles + {cm['learning']} learning = "
          f"{cm['count']} concepts, {cm['nodes']} lit nodes, {cm['related']} cross-links, "
          f"{cm['unresolved']} unresolved refs "
          f"({cm['nonGraphRefs']} non-graph refs seen, {cm['pathSpelledRefs']} written as a page "
          f"path, {cm['crossTypeRefs']} resolved under a section the author did not type, "
          f"{cm['familyExpandedRefs']} family-expanded and deliberately NOT anchored, "
          f"{cm['mdOnly']} .md-only page(s) skipped)")
    print(f"concepts/: {len(concept_dossiers)} readable bodies into the content/ chunk space, "
          f"fattest {_cmax} bytes (chunk ceiling 40,000)")
    # POSITIVE COVERAGE, HARD FLOOR (CLAUDE.md section 6.6). Every concept must reach a body: this
    # payload exists because a click used to open a search instead of content, and "the section is
    # empty" and "the section renders stubs" look identical from the outside. A file that stops
    # parsing, a renamed authored field, a template drift — each of them lands here, loudly.
    if len(concept_dossiers) < cm["count"]:
        raise SystemExit(
            f"[neural] concepts: {len(concept_dossiers)}/{cm['count']} carry a readable body. "
            f"A concept row with no dossier opens an empty panel — the exact failure this payload "
            f"was added to end. Check CONCEPT_FIELDS against the authored template."
        )

    # systems.json — the 47-System library + the graph nodes each System highlights. Resolved
    # against gd["nodes"] (the ids the app actually renders), so a highlight can never point at
    # a node the graph does not have. Built BEFORE the chunk write for the same reason concepts
    # are: the System BODIES share that chunk space (see write_ng_chunks(extra=...)).
    sysd, system_dossiers = build_systems(graph, gd["nodes"])
    (OUT_DIR / "systems.json").write_text(json.dumps(sysd, ensure_ascii=False, separators=(",", ":")))
    sm = sysd["_meta"]
    print(f"systems.json: {sm['count']} systems, {sm['nodes']} member nodes, "
          f"{sm['unresolved']} unresolved refs, {sm['famRefs']} family refs, "
          f"{sm['products']} products ({sm['nonGraphRefs']} non-graph cross-refs skipped, "
          f"{sm['crossTypeRefs']} resolved under a section the author did not type)")
    _smax = max((len(json.dumps(v, ensure_ascii=False, separators=(",", ":")))
                 for v in system_dossiers.values()), default=0)
    _sfull = sum(1 for v in system_dossiers.values() if v.get("overview") and v.get("points"))
    print(f"systems/: {len(system_dossiers)} readable bodies into the content/ chunk space "
          f"({_sfull} with an overview AND key principles), fattest {_smax} bytes "
          f"(chunk ceiling 40,000)")
    # POSITIVE COVERAGE, HARD FLOOR (CLAUDE.md section 6.6) — the same floor the concepts carry,
    # for the same reason: 145,746 authored words reached nobody for want of an emit pass, and a
    # System panel that renders its summary and nothing else looks exactly like one whose authored
    # body silently stopped parsing. A renamed authored field lands here, loudly.
    if _sfull < sm["count"]:
        raise SystemExit(
            f"[neural] systems: {_sfull}/{sm['count']} carry a readable body (overview + key "
            f"principles). A System with no body opens a panel that is a title and a link. Check "
            f"_system_body against the authored template."
        )

    # Per-node dossiers, one chunk each, replacing the 21.2MB technique-content.js. Both page-shaped
    # libraries ride in the SAME chunk space (one fetch/cache seam in the app — `_ngc`), keyed
    # "<Name>|<Principle|Learning|System>" so they cannot land in the technique key space.
    from _neural_content import write_ng_chunks
    n_ng, n_files, n_coll = write_ng_chunks(
        graph, OUT_DIR / "content", extra={**concept_dossiers, **system_dossiers})
    print(f"content/: {n_ng} node dossiers in {n_files} chunks"
          + (f" ({n_coll} sharing a hashed file)" if n_coll else ""))

    # curriculum.json — the Belt Path (belts -> units -> lessons -> checkpoint -> test).
    # Validated first (a bad curriculum must never be emitted), then enriched with resolved
    # per-lesson live frames + computed per-belt opponent pools (never authored).
    n_belts = build_curriculum(OUT_DIR, graph, decks)
    if n_belts:
        print(f"curriculum.json: {n_belts} belts emitted")


    n_cal = sum(1 for n in gd["nodes"] if "cal" in n)
    print(f"graph-data.json: {len(gd['nodes'])} nodes ({n_cal} with calibrated payload, "
          f"all carrying share ordinals 0-{max(ordinals.values())}), "
          f"{len(gd['links'])} links")
    print(f"flashcards/: {n_decks} per-deck chunks + _index.json manifest, {n_cards} cards")
    print(f"-> {OUT_DIR}")


if __name__ == "__main__":
    main()
