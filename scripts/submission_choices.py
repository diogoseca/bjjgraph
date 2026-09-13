"""Compile playable submission choices from authored records, independently of visual adjacency.

The projection catalog records deliberate state aliases and continuations. Authored defensive
responses carry attacker-relative outcome targets; flip them exactly once for the defender.
Names remain durable identities. Short labels are presentation metadata, never graph IDs.
"""
import json
import re
from pathlib import Path

from _slug import slugify


def short_response(action):
    """Keep the authored imperative, removing its explanatory subordinate clauses."""
    text = re.split(r":|[—–;]|\s+(?:by|when|before|while|to prevent|to create|to break|to reduce|to relieve|to block)\s+", action, maxsplit=1, flags=re.I)[0].strip()
    if len(text) > 48:
        text = re.split(r",|\s+-\s+|\s+(?:using|with|and|to|during|as|toward|away from|exploiting)\s+", text, maxsplit=1, flags=re.I)[0].strip()
    if len(text) > 64:
        text = text[:60].rsplit(" ", 1)[0] + "…"
    return text[:1].upper() + text[1:]


def compile_defenses(source, positions, catalog):
    defenses = catalog["defense_overrides"].get(source["name"])
    if defenses is None:
        defenses = []
        seen = set()
        for index, response in enumerate(source.get("defender", {}).get("defensive_options", [])):
            target = response.get("targets_outcome", "")
            if "/" not in target:
                continue
            position, role = target.rsplit("/", 1)
            if (positions is not None and slugify(position) not in positions) or role.lower() not in ("top", "bottom"):
                raise ValueError(f"Invalid defense destination {target}: {source['name']}")
            label = short_response(response["action"])
            if label in seen:
                continue
            seen.add(label)
            defenses.append({"label": label, "to": slugify(position) + "/" + ("bottom" if role.lower() == "top" else "top"), "detail": index})
    if not defenses:
        raise ValueError(f"No authored defenses for {source['name']}")
    return defenses


def compile_choices(root, nodes):
    root = Path(root)
    catalog = json.loads((root / "neural/submission-states.json").read_text())
    records = {}
    for path in [*(root / "content/Submissions").rglob("*.json"), *(root / "content/Transitions").rglob("*.json")]:
        data = json.loads(path.read_text())
        if isinstance(data, dict) and data.get("outcomes") and not data.get("is_family"):
            records[data["name"]] = data
    by_name = {n["t"]: n for n in nodes if n["ty"] != "positions"}
    positions = {n["posId"] for n in nodes if n["ty"] == "positions"}
    aliases = {slugify(p): name for p, name in catalog["aliases"].items()}
    covered = 0
    for node in nodes:
        if node["ty"] == "positions":
            target = aliases.get(node["posId"])
            if target:
                if target not in by_name:
                    raise ValueError(f"Submission alias target missing: {target}")
                node.setdefault("cal", {})["stateAlias"] = slugify(target)
            continue
        source = records.get(node["t"])
        if not source:
            raise ValueError(f"Choice source missing: {node['t']}")
        label = catalog["labels"].get(node["t"])
        if label:
            node.setdefault("cal", {})["choiceLabel"] = label
        if node["ty"] != "submissions":
            continue
        terminals = [o for o in source["outcomes"] if o.get("to") == "game-over"]
        if len(terminals) != 1 or terminals[0].get("result") != "success":
            raise ValueError(f"Submission needs exactly one successful finish: {node['t']}")
        covered += 1
        moves = catalog["continuations"].get(node["t"], [])
        for name in moves:
            if name not in by_name:
                raise ValueError(f"Unknown continuation {name} from {node['t']}")
            if records[name]["from_position"].rsplit("/", 1)[1] != source["from_position"].rsplit("/", 1)[1]:
                raise ValueError(f"Continuation belongs to the opponent: {name} from {node['t']}")
            if name == node["t"]:
                raise ValueError(f"Finish must not also be a continuation: {name}")
        node["cal"]["stateMoves"] = [slugify(n) for n in moves]
        compile_defenses(source, positions, catalog) # validate eagerly; choices load per state
    if not covered:
        raise ValueError("No submission states compiled")
    print(f"  submission states: {covered} with finish/defense choices, {len(aliases)} control aliases")


def write_details(root, out):
    """Read-on-demand explanations, excluded from the graph's boot payload."""
    out = Path(out) / "submission-details"
    out.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((Path(root) / "neural/submission-states.json").read_text())
    from _neural_content import fnv1a32
    buckets = {}
    for path in (Path(root) / "content/Submissions").rglob("*.json"):
        data = json.loads(path.read_text())
        if data.get("is_family") or not data.get("outcomes"):
            continue
        rows = {"choices": compile_defenses(data, None, catalog), "details": catalog["defense_overrides"].get(data["name"], data.get("defender", {}).get("defensive_options", []))}
        buckets.setdefault(fnv1a32(data["name"]), {})[data["name"]] = rows
    for old in out.glob("*.json"):
        old.unlink()
    for key, rows in buckets.items():
        (out / (key + ".json")).write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
