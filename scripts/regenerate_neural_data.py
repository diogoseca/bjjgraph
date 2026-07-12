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

    def enrich(node_id: str, ty: str) -> dict:
        """Pull calibrated fields for a layout node from graph.json (best-effort join)."""
        slug = _slug_from_id(node_id)
        if ty == "positions":
            # a hub layout node collapses top+bottom; carry both role distributions
            out = {}
            for role in ("top", "bottom"):
                n = graph["positions"].get(f"{slug}/{role}")
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
            return {"moves": out} if out else {}
        else:  # technique: attacker role-node carries the authored outcomes/success
            n = graph[ty].get(f"{slug}/attacker") or graph[ty].get(slug)
            if not n:
                return {}
            e = {}
            for k in ("successRate", "successRateByRuleset", "outcomes", "endingPosition"):
                if n.get(k) is not None:
                    e[k] = n[k]
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
        nodes.append(node)

    links = [{"source": l["source"], "target": l["target"]} for l in layout.get("links", [])]
    return {"nodes": nodes, "links": links}


def build_flashcards(graph: dict) -> dict:
    """Full decks from graph.json node flashcards, keyed '<Name>|<Role>'."""
    decks = {}
    for section in ("positions", "transitions", "submissions"):
        for node in graph.get(section, {}).values():
            fc = node.get("flashcards") or []
            role = node.get("role")
            name = node.get("name")
            if not fc or not role or role in ("hub", "terminal") or not name:
                continue
            cards = []
            for c in fc:
                q = c.get("q") or c.get("question")
                a = c.get("a") or c.get("answer")
                if q and a:
                    cards.append({"q": q, "a": a})
            if not cards:
                continue
            # position role-node names carry the role ("Electric Chair Top"); the app looks
            # up decks by BASE name|Role ("Electric Chair|Top"), matching NG_CONTENT. Strip the
            # trailing role word so flashcard keys align with the dossier keys + the app lookup.
            base = name
            for suf in (" Top", " Bottom", " Attacker", " Defender"):
                if base.endswith(suf):
                    base = base[: -len(suf)]
                    break
            key = f"{base}|{role.capitalize()}"
            decks[key] = {"cat": SECTION_CAT[section], "role": role.capitalize(), "cards": cards}
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
        manifest[key] = {"file": fname, "cat": deck["cat"], "role": deck["role"], "n": len(deck["cards"])}

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

    n_cal = sum(1 for n in gd["nodes"] if "cal" in n)
    print(f"graph-data.json: {len(gd['nodes'])} nodes ({n_cal} with calibrated payload), "
          f"{len(gd['links'])} links")
    print(f"flashcards/: {n_decks} per-deck chunks + _index.json manifest, {n_cards} cards")
    print(f"-> {OUT_DIR}")


if __name__ == "__main__":
    main()
