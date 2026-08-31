#!/usr/bin/env python3
"""Generate window.NG_CONTENT — the Neural app's per-node DOSSIER map — from our content/
JSON + the calibrated graph.json. Replaces the 3-entry design seed so node detail shows
real content everywhere instead of the "cards coming soon" fallback.

Two dossier shapes the app renders (see neural/src/technique-content.js exemplars):
  - POSITION (single-perspective), keyed "<Name>|<Role>":
      {cat:"Position", role, def, principles[], decisionTree[{cond,acts:[[tech,prob,target]]}],
       mistakes[{err,fix}], metrics{label:val}}
  - TRANSITION/SUBMISSION (dual-perspective), keyed "<Name>":
      {cat, from, target, successRate, def, context, outcomes[{result,position,prob,tone}],
       variations[], related[],
       perspectives:{attacker:{summary,recognition[],prerequisites[],steps[],principles[],
                               counters[],mistakes[{err,fix}]},
                     defender:{authored,summary,recognition[],principles[],options[{move,when,leadsTo}],
                               bestOutcomes[],mistakes[{err,fix}]}}}
Numbers come from the calibrated graph.json (no-gi default frame); prose from content/.
Dossier enrichment (Slice 4) maps existing content-JSON fields:
  variations <- variants_and_adaptations[].variant_name (names only), related <-
  related_content[].name (positions: related_positions[].name), attacker.prerequisites <-
  attacker.setup_requirements[], attacker.recognition <- top-level conditions[], and
  attacker.counters gains the first sentence (<=120ch) of common_counters[].your_response.
Caps are tuned to a size budget: technique-content.js raw growth <= +10%.
"""
import glob
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _ruleset import reduce_to_scalar  # collapse {gi,nogi} -> no-gi default frame

ROOT = Path(__file__).resolve().parent.parent
TONE = {"success": "good", "failure": "bad", "counter": "mid"}


def _load(path):
    try:
        return reduce_to_scalar(json.load(open(path, encoding="utf-8")), frame="nogi")
    except Exception:
        return None


def _clean_pos(to):
    """'Armbar Control/Top' -> 'Armbar Control'; 'game-over' -> 'Game Over'."""
    if not to:
        return ""
    if to == "game-over":
        return "Game Over"
    return to.split("/", 1)[0]


# Mirrors JOIN_STRICT in scripts/regenerate_neural_data.py — same variable, same reasoning, kept
# local because that module imports this one and the dependency cannot run the other way.
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


def _tech_node(graph, name, cat=None):
    """Find the attacker role-node in graph.json for a technique by name (successRate/outcomes).

    SECTION-EXPLICIT, AND IT MUST STAY THAT WAY. `graph.json` keys a technique by
    slugify(<display name>) with NO section term (regenerate_graph.py:579, :749), so a name authored
    in both content/Transitions/ and content/Submissions/ produces the SAME key in two sibling
    dicts. Searching transitions-first therefore handed a SUBMISSION's dossier the TRANSITION's
    node — and it did not look wrong, because calibration keys the shared slug too, so both nodes
    carry the same successRate. What differed is what the reader actually sees: `endingPosition`
    and the whole outcome list. Measured on 5 dossiers, e.g. `kimura-from-half-guard` rendered
    kimura-trap/bottom · half-guard/bottom · side-control/bottom where the submission's own outcomes
    are game-over · half-guard/top · closed-guard/bottom. A submission dossier that can never show a
    tap, on a product whose whole claim is that the card is true for the seat.

    The caller always knows which section it is reading, so it passes `cat` and this never guesses.
    `cat=None` keeps the old order for any caller that genuinely has no section — there are none
    today, and a new one should think twice before adding itself.
    """
    from _slug import slugify

    slug = slugify(name)
    sections = {"Transition": ("transitions",), "Submission": ("submissions",)}.get(
        cat, ("transitions", "submissions"))
    for section in sections:
        n = graph.get(section, {}).get(f"{slug}/attacker") or graph.get(section, {}).get(slug)
        if n:
            return n
    return None


def _steps(execution_steps):
    out = []
    for s in execution_steps or []:
        if isinstance(s, dict):
            a = s.get("action") or ""
            d = s.get("description") or ""
            out.append(f"{a}: {d}" if a and d else (a or d))
        elif isinstance(s, str):
            out.append(s)
    return [x for x in out if x][:8]


def _mistakes(errs):
    out = []
    for e in errs or []:
        if isinstance(e, dict):
            err = e.get("error") or e.get("err") or ""
            fix = e.get("correction") or e.get("fix") or e.get("your_response") or ""
            if err:
                out.append({"err": err, "fix": fix})
        elif isinstance(e, str):
            out.append({"err": e, "fix": ""})
    return out[:6]


def _strlist(xs, key=None):
    out = []
    for x in xs or []:
        if isinstance(x, str):
            out.append(x)
        elif isinstance(x, dict) and key:
            v = x.get(key)
            if v:
                out.append(v)
    return out[:8]


def _first_sentence(text):
    """First sentence of a prose blob ('Pin the wrist. If they roll...' -> 'Pin the wrist.')."""
    text = (text or "").strip() if isinstance(text, str) else ""
    if not text:
        return ""
    return re.split(r"(?<=[.!?])\s", text, maxsplit=1)[0]


def _variations(va):
    """variants_and_adaptations[] -> variant names only (when_to_use/description dropped: size budget)."""
    out = []
    for v in va or []:
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, dict):
            name = v.get("variant_name") or v.get("name") or v.get("variation") or ""
            if name:
                out.append(name)
    return out[:6]


def _related(entries, exclude=()):
    """related_content[]/related_positions[] -> names only, deduped (incl. vs from/target)."""
    seen = {e.strip().lower() for e in exclude if isinstance(e, str) and e.strip()}
    out = []
    for r in entries or []:
        name = r.get("name") if isinstance(r, dict) else (r if isinstance(r, str) else None)
        if not name or not isinstance(name, str):
            continue
        k = name.strip().lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(name)
    return out[:6]


def _counters(xs):
    """common_counters[] -> 'counter — first sentence of your_response' (plain counter otherwise)."""
    out = []
    for x in xs or []:
        if isinstance(x, str):
            out.append(x)
        elif isinstance(x, dict):
            c = x.get("counter")
            if not c:
                continue
            resp = _first_sentence(x.get("your_response"))
            if len(resp) > 120:  # size budget: keep the gist, not the paragraph
                resp = resp[:119].rstrip() + "…"
            out.append(f"{c} — {resp}" if resp else c)
    return out[:8]


_CLIP_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
# Front-end clip fields only — provenance (channel/duration/verified) stays in content JSON.
_CLIP_FIELDS = ("id", "start", "end", "vertical", "title", "by")


def _clips(raw, extra=None):
    """Sanitize curated clips arrays for the bundle: keep player fields only, drop
    invalid ids, dedup by id (primary list wins over `extra` fallback), cap 4."""
    out, seen = [], set()
    for source in (raw or []), (extra or []):
        for c in source:
            if not isinstance(c, dict):
                continue
            cid = c.get("id")
            if not isinstance(cid, str) or not _CLIP_ID_RE.match(cid) or cid in seen:
                continue
            seen.add(cid)
            out.append({k: c[k] for k in _CLIP_FIELDS if c.get(k) is not None})
    return out[:4]


def _position_dossier(role_data, role_label, related=None, hub_clips=None):
    dt = []
    for node in role_data.get("decision_tree", []) or []:
        if not isinstance(node, dict):
            continue
        acts = []
        for a in node.get("actions", []) or []:
            if isinstance(a, dict) and a.get("technique"):
                acts.append([a.get("technique"), a.get("success_rate") or a.get("probability"), _clean_pos(a.get("to") or a.get("leads_to"))])
        if node.get("condition"):
            dt.append({"cond": node["condition"], "acts": acts[:4]})
    metrics = {}
    pm = role_data.get("position_metrics") or {}
    label_map = {"retention_rate": "Retention", "advancement_probability": "Advance",
                 "submission_probability": "Submission", "average_time": "Avg time"}
    for k, label in label_map.items():
        v = pm.get(k)
        if isinstance(v, dict):  # {value, description} shape
            v = v.get("value")
        if v is None:
            continue
        if k == "average_time":
            metrics[label] = str(v)
        elif isinstance(v, (int, float)):
            metrics[label] = f"{round(v)}%"
        else:
            metrics[label] = str(v)
    doss = {
        "cat": "Position",
        "role": role_label,
        "def": (role_data.get("description") or role_data.get("overview") or "").strip(),
        "principles": _strlist(role_data.get("key_principles"))[:6],
        "decisionTree": dt[:6],
        "mistakes": _mistakes(role_data.get("common_errors")),
        "metrics": metrics,
    }
    rel = _related(related)
    if rel:
        doss["related"] = rel
    # Role clips first, then position-hub overview clips as fallback (hub has no own key).
    clips = _clips(role_data.get("clips"), extra=hub_clips)
    if clips:
        doss["clips"] = clips
    return doss


def _perspective_attacker(att, conditions=None):
    p = {
        "summary": (att.get("overview") or att.get("description") or "").strip(),
        "steps": _steps(att.get("execution_steps")),
        "principles": _strlist(att.get("key_principles"))[:6],
        "counters": _counters(att.get("common_counters")),
        "mistakes": _mistakes(att.get("common_errors")),
    }
    recog = _strlist(conditions)[:4]
    if recog:
        p["recognition"] = recog
    prereq = _strlist(att.get("setup_requirements"))[:4]
    if prereq:
        p["prerequisites"] = prereq
    clips = _clips(att.get("clips"))
    if clips:
        p["clips"] = clips
    return p


def _perspective_defender(dfn):
    opts = []
    for o in dfn.get("defensive_options", []) or []:
        if isinstance(o, dict) and o.get("action"):
            opts.append({"move": o.get("action"), "when": o.get("when_to_use") or "", "leadsTo": _clean_pos(o.get("leads_to") or o.get("targets_outcome") or "")})
    p = {
        "authored": True,
        "summary": (dfn.get("overview") or dfn.get("description") or "").strip(),
        "recognition": _strlist(dfn.get("recognition_cues")),
        "principles": _strlist(dfn.get("key_principles"))[:6],
        "options": opts[:5],
        "bestOutcomes": _strlist(dfn.get("favorable_outcomes"), key="outcome"),
        "mistakes": _mistakes(dfn.get("common_errors")),
    }
    clips = _clips(dfn.get("clips"))
    if clips:
        p["clips"] = clips
    return p


def _technique_dossier(d, cat, graph):
    name = d.get("name")
    node = _tech_node(graph, name, cat)
    succ = None
    outcomes = []
    target = ""
    if node:
        succ = node.get("successRate")
        target = _clean_pos(node.get("endingPosition"))
        for o in node.get("outcomes", []) or []:
            outcomes.append({
                "result": (o.get("result") or "").capitalize() or "Outcome",
                "position": _clean_pos(o.get("to")),
                "prob": o.get("probability"),
                "tone": TONE.get(o.get("result"), "mid"),
            })
    if succ is None:
        succ = d.get("success_rate")
    doss = {
        "cat": cat,
        "from": _clean_pos(d.get("from_position") or d.get("starting_position") or ""),
        "target": target,
        "successRate": int(round(succ)) if isinstance(succ, (int, float)) else succ,
        "def": (d.get("description") or d.get("overview") or "").strip(),
        "context": (d.get("overview") or d.get("description") or "").strip(),
        "outcomes": outcomes,
    }
    variations = _variations(d.get("variants_and_adaptations"))
    if variations:
        doss["variations"] = variations
    clips = _clips(d.get("clips"))
    if clips:
        doss["clips"] = clips  # general fallback: app renders blk.clips || rc.clips
    rel = _related(d.get("related_content"), exclude=(doss["from"], target))
    if rel:
        doss["related"] = rel
    persp = {}
    if isinstance(d.get("attacker"), dict):
        persp["attacker"] = _perspective_attacker(d["attacker"], d.get("conditions"))
    if isinstance(d.get("defender"), dict):
        persp["defender"] = _perspective_defender(d["defender"])
    if persp:
        doss["perspectives"] = persp
    return doss


def build_ng_content(graph) -> dict:
    """Return the NG_CONTENT.decks dossier map.

    THE JOIN IS TOTAL, AND A COLLISION IS A BUILD ERROR. A technique dossier is keyed by its BARE
    display name — no section, no role — so two sections authoring one name file two dossiers under
    one key and Submissions, iterating second, walks off with the slot. That is the same defect as
    the flashcard join in scripts/regenerate_neural_data.py, one key space over, and until now this
    one reported nothing at all: no count, no warning, no baseline. Every file read here ends in
    exactly one bucket and the buckets must sum, so a drop cannot be mistaken for a skip."""
    decks = {}
    owner = {}                # key -> (section, file) currently holding it
    collisions = []           # (key, kept, dropped) — MUST stay empty
    excluded = {}             # bucket -> file count
    read = 0
    resolved = unresolved = 0
    dual_authored = []         # names that still resolve in BOTH sections (a type error)

    def _excl(bucket):
        excluded[bucket] = excluded.get(bucket, 0) + 1

    # positions -> "<Name>|<Role>"
    for f in sorted(glob.glob(str(ROOT / "content/Positions/**/*.json"), recursive=True)):
        read += 1
        if "TEMPLATE" in f:
            _excl("template")
            continue
        d = _load(f)
        if not isinstance(d, dict) or "name" not in d:
            _excl("unnamed-or-unreadable")
            continue
        got = False
        for role in ("top", "bottom"):
            rd = d.get(role)
            if isinstance(rd, dict):
                got = True
                key = f"{d['name']}|{role.capitalize()}"
                if key in decks:
                    collisions.append((key, ("Positions", f), owner[key]))
                owner[key] = ("Positions", f)
                decks[key] = _position_dossier(
                    rd, role.capitalize(), related=d.get("related_positions"),
                    hub_clips=d.get("clips")
                )
        if not got:
            _excl("position-with-no-authored-role")

    # transitions + submissions -> "<Name>"
    for section, cat in (("Transitions", "Transition"), ("Submissions", "Submission")):
        for f in sorted(glob.glob(str(ROOT / f"content/{section}/**/*.json"), recursive=True)):
            read += 1
            if "TEMPLATE" in f:
                _excl("template")
                continue
            d = _load(f)
            if not isinstance(d, dict) or "name" not in d:
                _excl("unnamed-or-unreadable")
                continue
            if d.get("is_family"):
                # A family hub is an edgeless aggregator; its variants carry the dossiers.
                _excl("family-hub")
                continue
            key = d["name"]
            if key in decks:
                collisions.append((key, (section, f), owner[key]))
            owner[key] = (section, f)
            decks[key] = _technique_dossier(d, cat, graph)
            own = _tech_node(graph, key, cat)          # the node the dossier above used
            other = _tech_node(graph, key)             # section-blind: transitions before submissions
            if own is None:
                unresolved += 1
            else:
                resolved += 1
            if own is not other:
                dual_authored.append(key)

    # POSITIVE COVERAGE, PRINTED EVERY RUN (CLAUDE.md section 6.6). `_technique_dossier` falls back
    # to the file's own success_rate when no node resolves — a plausible value that says nothing, so
    # the fallback is counted rather than trusted.
    accounted = len(decks) + len(collisions) + sum(excluded.values())
    print(f"  dossier join: {read} content file(s) -> {len(decks)} dossiers; excluded "
          f"{', '.join(f'{excluded.get(b, 0)} {b}' for b in sorted(excluded)) or 'none'}; "
          f"{len(collisions)} collided; technique nodes resolved {resolved}/{resolved + unresolved}; "
          f"{len(dual_authored)} dual-authored id(s)")
    if dual_authored:
        # A TYPE ERROR, and the count of how many are left. A move that reaches the game-over sink
        # IS a submission; it must not also exist as a transition record. These names resolve in
        # BOTH sections, so the two records are two state machines under one id. The dossier no
        # longer mis-renders them — it resolves within its own section now — but the duplicate
        # records are still there, and this is the number that has to reach zero.
        print(f"    dual-authored ({len(dual_authored)}): "
              + ", ".join(repr(k) for k in sorted(dual_authored)))
        for k in sorted(dual_authored)[:3]:
            _t = _tech_node(graph, k)
            print(f"      {k!r} also exists as a transition ending {_t.get('endingPosition')!r} "
                  f"-> " + " / ".join(str(o.get("to")) for o in (_t.get("outcomes") or [])))

    errs = []
    for key, kept, dropped in sorted(collisions):
        errs.append(f"dossier key {key!r} collided: kept {kept[1]}, DROPPED {dropped[1]}")
    if collisions:
        errs.append("A technique dossier is keyed by bare display name. Two sections authoring one "
                    "name means one dossier is overwritten and its prose, clips and outcomes never "
                    "ship. Rename one side in content/ — there is no baseline to add it to.")
    # `accounted` counts position files once but they may emit two dossiers, so compare the parts
    # that ARE one-to-one rather than inventing an equality that cannot hold.
    if accounted < read:
        errs.append(f"dossier join is NOT total: {read} files read but only {accounted} accounted "
                    f"for as a dossier, a collision or a named exclusion.")
    if unresolved:
        errs.append(f"{unresolved} technique(s) resolved to no graph node, so their dossier shows "
                    f"the file's own success_rate and an EMPTY outcome list. Was 0 when this count "
                    f"was added; a non-zero value is a join that has started rotting.")
    if not resolved:
        errs.append("the technique-node join resolved 0 nodes; it cannot fail, so it is not a check.")
    _join_report(errs, "dossier join")
    return decks


def fnv1a32(s: str) -> str:
    """FNV-1a over UTF-16 code units — byte-identical to qhash() in neural/src/app.src.jsx.

    The app addresses a node's dossier chunk by hashing its key, so this MUST agree with the JS
    exactly. JS iterates charCodeAt (UTF-16 code units), so we do too rather than hashing bytes.
    """
    h = 0x811C9DC5
    units = s.encode("utf-16-le")
    for i in range(0, len(units), 2):
        h ^= units[i] | (units[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def write_ng_chunks(graph, out_dir: Path, extra: dict | None = None) -> tuple[int, int, int]:
    """Write ONE dossier chunk per node, addressed by fnv1a32(key).

    Replaces the 21.2MB technique-content.js (window.NG_CONTENT for every node in the graph,
    shipped to every visitor to render at most one node at a time). Each chunk holds a
    {key: dossier} MAP rather than a bare dossier, so a hash collision merely puts two dossiers
    in one file instead of losing one — the app looks up by key after fetching.

    `extra` is a second dossier map merged into the SAME chunk space — today the Principles and
    Learning concept bodies (regenerate_neural_data.build_concepts), which are pages rather than
    graph nodes and so cannot come out of `graph`. Merging rather than adding a second chunk
    directory keeps ONE fetch/cache seam in the app (`_ngc`), one chunk ceiling and one address
    scheme. A key collision between the two maps is a BUILD ERROR, not a last-write-wins: concept
    keys carry a `|Principle` / `|Learning` suffix precisely so they cannot land in the technique
    key space, and if that ever stops being true the drop must be loud.

    Returns (nodes, files, collisions).
    """
    decks = build_ng_content(graph)
    if extra:
        clash = sorted(set(decks) & set(extra))
        if clash:
            raise SystemExit(
                f"[neural] dossier chunk key collision between the node map and the concept map: "
                f"{clash[:5]} — one dossier would silently overwrite the other."
            )
        decks = {**decks, **extra}
    if out_dir.exists():
        for old in out_dir.glob("*.json"):
            old.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)
    buckets: dict[str, dict] = {}
    for key in sorted(decks):
        buckets.setdefault(fnv1a32(key), {})[key] = decks[key]
    for h, payload in buckets.items():
        (out_dir / f"{h}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    collisions = sum(len(v) - 1 for v in buckets.values())
    return len(decks), len(buckets), collisions
