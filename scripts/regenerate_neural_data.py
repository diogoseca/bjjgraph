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
            # `o` = this node's PERMANENT share-link ordinal (node_ordinals.json). The wire
            # format for a shared list encodes ordinals, never this array's index — the
            # array is filesystem-ordered and one new content file renumbers it.
            "o": ordinals[n["id"]],
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


MC_LINE_BUDGET = 36  # one-line MC option cap; keep in sync with app.src.jsx MC_LINE


def _mc_clip(a: str):
    """First sentence, <=160 chars (mirrors app.src.jsx mcClip) — the display-answer fallback
    for cards that have no authored one-line `answer_line` yet."""
    m = re.match(r"[\s\S]*?[.!?]", a or "")
    seg = (m.group(0) if m else (a or "")).strip()
    return seg if 0 < len(seg) <= 160 else None


def _qa_cards(fc: list) -> list:
    """Neural card: {q, a, d?, mc?}. `a` = the DISPLAY answer (authored one-line `answer_line`
    when present, else the clipped first sentence, else the full answer). `d` = the full
    explanation, emitted only when it differs from `a` (the post-reveal "more" tooltip). `mc` =
    {p,t} authored one-line distractor tiers when present (graded plausible/trap)."""
    out = []
    for c in fc or []:
        q = c.get("q") or c.get("question")
        full = c.get("a") or c.get("answer")
        if not (q and full):
            continue
        line = c.get("answer_line") or _mc_clip(full) or full
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
    return out


def build_curriculum(out_dir: Path, graph: dict) -> int:
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
    cur["weights"] = build_technique_weights(graph)
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
    {title, instructor, affiliate_url}; the Neural contract wants {name, instructor, url}.
    An entry without a real URL is dropped (a product card that links nowhere earns nothing
    and misleads), and NOTHING here is ever synthesized — no URL, no product."""
    out = []
    for p in data.get("products") or []:
        if not isinstance(p, dict):
            continue
        name = (p.get("title") or p.get("name") or "").strip()
        url = (p.get("affiliate_url") or p.get("url") or "").strip()
        if not (name and url):
            print(f"  systems: skipped product without name+url in {sys_name}")
            continue
        out.append({"name": name, "instructor": (p.get("instructor") or "").strip(), "url": url})
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
    n_belts = build_curriculum(OUT_DIR, graph)
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
