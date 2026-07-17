#!/usr/bin/env python3
"""Q-Neural data bridge (Phase 0.1) — emit the data files the Neural Graph front-end
fetches, generated from our LIVE calibrated sources so the new UI shows the same numbers
as the legacy site (page == graph == game invariant).

Outputs (into source/quartz/static/neural/, mirroring how globalGraphLayout.json is a
generated+committed static asset):
  - graph-data.json : {nodes, links} — a reshape of source/quartz/static/globalGraphLayout
    .json (the visual projection) into the Neural app's node shape
    {id,x,y,t,ty,s,fromPosition,fromPositionId,fromRole,posId}. Each node is additionally
    enriched (coherence-ready) with the calibrated numbers from graph.json:
    successRate/successRateByRuleset/outcomes for technique nodes, attemptProbability
    distribution for position nodes. (The current prototype reads only `s`; the enriched
    fields are what Phase 1 wires the gameplay onto — see project_neural_graph_migration.)
  - flashcards/<slug>.json : one file PER DECK ({cat,role,cards:[{q,a}]}) — the full
    calibrated decks from graph.json, chunked so the app fetches only the deck it opens
    (the monolith was 13.5 MB; each deck is a few KB).
  - flashcards/_index.json : manifest {_meta, decks:{"<Name>|<Role>":{file,cat,role,n}}}
    resolving each deck key -> its chunk file + card count (the "what decks exist" list).

Deterministic (stable ordering) so re-runs diff cleanly; safe to wire into `regenerate`.
Read-only w.r.t. all existing content/graph.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from _slug import slugify  # canonical slugify (shared with node ids)
LAYOUT = ROOT / "source/quartz/static/globalGraphLayout.json"
GRAPH = ROOT / "graph.json"
OUT_DIR = ROOT / "source/quartz/static/neural"

SECTION_TY = {"positions": "positions", "transitions": "transitions", "submissions": "submissions"}
SECTION_CAT = {"positions": "Position", "transitions": "Transition", "submissions": "Submission"}


def _slug_from_id(node_id: str) -> str:
    """'Positions/Gogoplata-Control' -> 'gogoplata-control' (the app's posId convention)."""
    tail = node_id.split("/", 1)[1] if "/" in node_id else node_id
    return tail.lower()


def build_graph_data(layout: dict, graph: dict) -> dict:
    """Reshape globalGraphLayout nodes/links into the Neural graph-data.json shape,
    enriching each node with its calibrated numbers from graph.json."""
    # index graph.json role-nodes by their display id used in the layout:
    #   layout id 'Positions/Mount' hub collapses top/bottom; techniques -> attacker node.
    # We match on the lowercased slug carried in each graph node's own id space.
    by_slug = {}
    for section in ("positions", "transitions", "submissions"):
        for nid, node in graph.get(section, {}).items():
            by_slug[(section, nid)] = node

    def _frame_positive(t, frame):
        """True if this transition entry is attempted in `frame` (attemptProbability > 0)."""
        apr = t.get("attemptProbabilityByRuleset")
        v = apr.get(frame) if isinstance(apr, dict) else t.get("attemptProbability")
        return isinstance(v, (int, float)) and v > 0

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

    def enrich(node_id: str, ty: str) -> dict:
        """Pull calibrated fields for a layout node from graph.json (best-effort join)."""
        slug = _slug_from_id(node_id)
        if ty == "positions":
            # a hub layout node collapses top+bottom; carry both role distributions
            out = {}
            avail = {"gi": False, "nogi": False}
            for role in ("top", "bottom"):
                n = _pos_role(slug, role)
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
                            if _frame_positive(t, fr):
                                avail[fr] = True
            if not out:
                return {}
            return {"moves": out, "avail": avail}
        else:  # technique: attacker role-node carries the authored outcomes/success
            n = graph[ty].get(f"{slug}/attacker") or graph[ty].get(slug)
            if not n:
                return {}
            e = {}
            for k in ("successRate", "successRateByRuleset", "outcomes", "endingPosition"):
                if n.get(k) is not None:
                    e[k] = n[k]
            av = tech_avail.get(slug)
            if av:
                e["avail"] = av
            return e

    nodes = []
    for n in layout["nodes"]:
        ty = SECTION_TY.get(n["id"].split("/", 1)[0].lower(), "positions")
        pos_id = n.get("fromPositionId") if ty != "positions" else _slug_from_id(n["id"])
        node = {
            "id": n["id"],
            "x": n.get("x"),
            "y": n.get("y"),
            "t": n.get("t"),
            "ty": ty,
            "s": n.get("s"),
            "fromPosition": n.get("fromPosition"),
            "fromPositionId": n.get("fromPositionId"),
            "fromRole": n.get("fromRole"),
            "posId": pos_id,
        }
        cal = enrich(n["id"], ty)
        if cal:
            node["cal"] = cal  # calibrated payload (Phase 1 gameplay reads this)
        if ty == "positions":  # family membership so the app can resolve the <Family>|Family tier deck
            pslug = _slug_from_id(n["id"])
            rn = _pos_role(pslug, "top") or _pos_role(pslug, "bottom")
            if rn and rn.get("familyHub"):
                node["familyHub"] = rn["familyHub"]
        nodes.append(node)

    links = [{"source": l["source"], "target": l["target"]} for l in layout.get("links", [])]
    return {"nodes": nodes, "links": links}


def _qa_cards(fc: list) -> list:
    out = []
    for c in fc or []:
        q = c.get("q") or c.get("question")
        a = c.get("a") or c.get("answer")
        if q and a:
            out.append({"q": q, "a": a})
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
            pos_h.append({"q": c["q"], "a": c["a"], "tag": pos_tag})
            seen.add(c["q"])
    for c in fam_cards:
        if c["q"] not in seen:
            fam_h.append({"q": c["q"], "a": c["a"], "tag": fam_tag})
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
    Transitions/submissions keep their own attacker/defender cards (no position tiers apply)."""
    decks = {}
    for section in ("positions", "transitions", "submissions"):
        for node in graph.get(section, {}).values():
            role = node.get("role")
            name = node.get("name")
            if not role or role in ("hub", "terminal") or not name:
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
                continue
            decks[f"{base}|{role.capitalize()}"] = {"cat": SECTION_CAT[section], "role": role.capitalize(), "cards": cards}
    return decks


def write_flashcards(decks: dict, out_dir: Path) -> tuple[int, int]:
    """Write one chunk file per deck + a manifest. Returns (deck_count, card_count)."""
    fc_dir = out_dir / "flashcards"
    # clean stale chunks so removed decks don't linger
    if fc_dir.exists():
        for old in fc_dir.glob("*.json"):
            old.unlink()
    fc_dir.mkdir(parents=True, exist_ok=True)

    manifest = {}
    seen = {}
    for key in sorted(decks):
        deck = decks[key]
        base = f"{slugify(deck_name(key))}__{deck['role'].lower()}"
        fname = base + ".json"
        if fname in seen:  # slug collision -> disambiguate deterministically
            seen[fname] += 1
            fname = f"{base}-{seen[fname]}.json"
        else:
            seen[fname] = 1
        (fc_dir / fname).write_text(
            json.dumps({"cat": deck["cat"], "role": deck["role"], "cards": deck["cards"]},
                       ensure_ascii=False, separators=(",", ":")))
        entry = {"file": fname, "cat": deck["cat"], "role": deck["role"], "n": len(deck["cards"])}
        if deck.get("tier"):
            entry["tier"] = deck["tier"]
        if deck.get("ancestors"):
            entry["ancestors"] = deck["ancestors"]  # {position?, family?} deck keys for the drill toggle
        manifest[key] = entry

    (fc_dir / "_index.json").write_text(json.dumps({
        "_meta": {
            "status": "generated",
            "note": "Generated by scripts/regenerate_neural_data.py from graph.json. Per-deck "
                    "chunks live beside this manifest; fetch decks[key].file on demand.",
            "keyFormat": "<Name>|<Role>  (Top|Bottom for positions, Attacker|Defender for techniques)",
            "cardShape": {"q": "question", "a": "answer"},
        },
        "decks": {k: manifest[k] for k in sorted(manifest)},
    }, ensure_ascii=False, indent=1))
    return len(decks), sum(len(d["cards"]) for d in decks.values())


def deck_name(key: str) -> str:
    """'Closed Guard|Bottom' -> 'Closed Guard'."""
    return key.rsplit("|", 1)[0]


def build_curriculum(out_dir: Path) -> int:
    """Validate then emit the Belt Path curriculum. Returns belt count (0 = no curriculum,
    which is legal — the app falls back to tree view)."""
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
    (out_dir / "curriculum.json").write_text(
        json.dumps(cur, ensure_ascii=False, separators=(",", ":")))
    return len(cur["belts"])


def main() -> None:
    if not LAYOUT.exists() or not GRAPH.exists():
        print(f"ERROR: need {LAYOUT} and {GRAPH} (run regenerate:graph first)", file=sys.stderr)
        sys.exit(1)
    layout = json.loads(LAYOUT.read_text())
    graph = json.loads(GRAPH.read_text())

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    gd = build_graph_data(layout, graph)
    (OUT_DIR / "graph-data.json").write_text(json.dumps(gd, ensure_ascii=False, separators=(",", ":")))

    decks = build_flashcards(graph)
    n_decks, n_cards = write_flashcards(decks, OUT_DIR)
    # Monolith flashcards.json — the Neural app fetches this today for its DRILL decks
    # (this.flashcards.decks). The per-deck chunks above are the production optimization
    # (pending an app patch to fetch on demand); both are emitted during the transition.
    (OUT_DIR / "flashcards.json").write_text(
        json.dumps({"decks": decks}, ensure_ascii=False, separators=(",", ":")))
    # technique-content.js — window.NG_CONTENT: the full per-node DOSSIER map generated from
    # content/ + calibrated graph.json (replaces the 3-entry design seed so node detail shows
    # real content everywhere; unmapped fields still fall back gracefully in the app).
    from _neural_content import write_ng_content
    n_ng = write_ng_content(graph, OUT_DIR / "technique-content.js")
    print(f"technique-content.js: window.NG_CONTENT with {n_ng} node dossiers")

    # curriculum.json — the Belt Path (belts -> units -> lessons -> checkpoint -> test).
    # Validated first (a bad curriculum must never be emitted), then enriched with resolved
    # per-lesson live frames + computed per-belt opponent pools (never authored).
    n_belts = build_curriculum(OUT_DIR)
    if n_belts:
        print(f"curriculum.json: {n_belts} belts emitted")

    n_cal = sum(1 for n in gd["nodes"] if "cal" in n)
    print(f"graph-data.json: {len(gd['nodes'])} nodes ({n_cal} with calibrated payload), "
          f"{len(gd['links'])} links")
    print(f"flashcards/: {n_decks} per-deck chunks + _index.json manifest, {n_cards} cards")
    print(f"-> {OUT_DIR}")


if __name__ == "__main__":
    main()
