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
       perspectives:{attacker:{summary,steps[],principles[],counters[],mistakes[{err,fix}]},
                     defender:{authored,summary,recognition[],principles[],options[{move,when,leadsTo}],
                               bestOutcomes[],mistakes[{err,fix}]}}}
Numbers come from the calibrated graph.json (no-gi default frame); prose from content/.
"""
import glob
import json
import os
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


def _tech_node(graph, name):
    """Find the attacker role-node in graph.json for a technique by name (successRate/outcomes)."""
    from _slug import slugify

    slug = slugify(name)
    for section in ("transitions", "submissions"):
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


def _position_dossier(role_data, role_label):
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
    return {
        "cat": "Position",
        "role": role_label,
        "def": (role_data.get("description") or role_data.get("overview") or "").strip(),
        "principles": _strlist(role_data.get("key_principles"))[:6],
        "decisionTree": dt[:6],
        "mistakes": _mistakes(role_data.get("common_errors")),
        "metrics": metrics,
    }


def _perspective_attacker(att):
    return {
        "summary": (att.get("overview") or att.get("description") or "").strip(),
        "steps": _steps(att.get("execution_steps")),
        "principles": _strlist(att.get("key_principles"))[:6],
        "counters": _strlist(att.get("common_counters"), key="counter"),
        "mistakes": _mistakes(att.get("common_errors")),
    }


def _perspective_defender(dfn):
    opts = []
    for o in dfn.get("defensive_options", []) or []:
        if isinstance(o, dict) and o.get("action"):
            opts.append({"move": o.get("action"), "when": o.get("when_to_use") or "", "leadsTo": _clean_pos(o.get("leads_to") or o.get("targets_outcome") or "")})
    return {
        "authored": True,
        "summary": (dfn.get("overview") or dfn.get("description") or "").strip(),
        "recognition": _strlist(dfn.get("recognition_cues")),
        "principles": _strlist(dfn.get("key_principles"))[:6],
        "options": opts[:5],
        "bestOutcomes": _strlist(dfn.get("favorable_outcomes"), key="outcome"),
        "mistakes": _mistakes(dfn.get("common_errors")),
    }


def _technique_dossier(d, cat, graph):
    name = d.get("name")
    node = _tech_node(graph, name)
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
    persp = {}
    if isinstance(d.get("attacker"), dict):
        persp["attacker"] = _perspective_attacker(d["attacker"])
    if isinstance(d.get("defender"), dict):
        persp["defender"] = _perspective_defender(d["defender"])
    if persp:
        doss["perspectives"] = persp
    return doss


def build_ng_content(graph) -> dict:
    """Return the NG_CONTENT.decks dossier map."""
    decks = {}

    # positions -> "<Name>|<Role>"
    for f in glob.glob(str(ROOT / "content/Positions/**/*.json"), recursive=True):
        if "TEMPLATE" in f:
            continue
        d = _load(f)
        if not isinstance(d, dict) or "name" not in d:
            continue
        for role in ("top", "bottom"):
            rd = d.get(role)
            if isinstance(rd, dict):
                decks[f"{d['name']}|{role.capitalize()}"] = _position_dossier(rd, role.capitalize())

    # transitions + submissions -> "<Name>"
    for section, cat in (("Transitions", "Transition"), ("Submissions", "Submission")):
        for f in glob.glob(str(ROOT / f"content/{section}/**/*.json"), recursive=True):
            if "TEMPLATE" in f:
                continue
            d = _load(f)
            if not isinstance(d, dict) or "name" not in d or d.get("is_family"):
                continue
            decks[d["name"]] = _technique_dossier(d, cat, graph)

    return decks


def write_ng_content(graph, out_path: Path) -> int:
    decks = build_ng_content(graph)
    payload = "window.NG_CONTENT = " + json.dumps({"decks": decks}, ensure_ascii=False, separators=(",", ":")) + ";\n"
    out_path.write_text(payload, encoding="utf-8")
    return len(decks)
