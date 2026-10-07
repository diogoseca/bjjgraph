#!/usr/bin/env python3
"""Graph-only vocabulary and an explicitly separate structured-content survey.

    python3 -B scripts/semantics/vocabulary.py --selfcheck
    python3 -B scripts/semantics/vocabulary.py --selfcheck --full-out DIR/vocabulary_full.json \
        --survey --survey-out DIR/vocabulary_survey.json

vocabulary.json reads ONLY graph.json. vocabulary_survey.json additionally reads
authored content and the curriculum template, with provenance on every relation.

ARTIFACT SIZE (public repo). The committed vocabulary.json is the SLIM projection of
the full build (budget < 1 MB, asserted): lexicon, coverage, label sets and one record
per technique/role/hub/system, with bulky per-node dumps omitted and NAMED in its
`slimming` section — per-technique result mixes, per-row system member joins, and the
technique-scope name-token inverted index (recoverable from each record's
`name_tokens`). The full build is unchanged; its SHA-256 is recorded in the slim
artifact on every run and it is written only to an explicit --full-out path. The
survey (~23 MB) is written only to an explicit --survey-out path. Neither may be
written under tests/artifacts/ (refused). The slim writer puts every list of scalars
on one line and indents dicts; json.loads round-trips it exactly (selfchecked).
No chain, availability walk, success-rate recalibration or app emitter is built.
Sets cover all authored role-nodes/hubs/attacker techniques, not just live or
reachable states. Future kernel lanes must explicitly choose their universe.

Hub state properties preserve BOTH roles, because graph hub records have none.
Result mixes are authored outcome marginals, NOT calibrated Model branch weights.
System family membership stays on the family hub; optional prefix expansion is
separately marked name-derived and never silently treated as structural evidence.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "scripts"))
from _slug import slugify  # noqa: E402 — the emitter's canonical ID constructor

FIELDS = ("positionType", "pointValue", "riskLevel", "energyCost")
FRAMES = ("gi", "nogi")
RESULTS = ("success", "failure", "counter")
CLASSES = ("LEG", "ARM", "SHOULDER", "CHOKE", "SPINE/COMPRESSION", "HIP/GROIN")
# One row per exact structured type; at least one targetArea token must agree.
# Anatomy takes precedence over the generic word "compression": calf -> LEG,
# bicep -> ARM, hip/groin -> HIP/GROIN. The spinal bucket is not a catch-all.
# No submission NAME participates in this classification.
LEXICON = (
    ("Ankle Lock", "ankle achilles foot", "LEG", "Ankle/foot ligaments and Achilles are lower-leg targets."),
    ("Arm Crush", "elbow forearm", "ARM", "Elbow/forearm compression belongs to the arm, not the spine."),
    ("Arm Lock", "elbow", "ARM", "Authored arm locks target the elbow even when the shoulder also loads."),
    ("Arm-Triangle Choke", "neck carotid", "CHOKE", "The arm-triangle type constricts the neck rather than locking an arm."),
    ("Bicep Compression Lock", "bicep elbow", "ARM", "Bicep/elbow compression is an arm attack."),
    ("Blood Choke", "carotid neck", "CHOKE", "Blood-choke type and neck/carotid target identify a strangle."),
    ("Calf Crush", "calf knee", "LEG", "Calf/knee compression is a leg attack."),
    ("Foot Lock", "foot ankle", "LEG", "Foot/ankle locking belongs to leg attacks."),
    ("Groin Compression", "hip groin adductors", "HIP/GROIN", "Groin/adductor targets need a separate hip/groin class."),
    ("Groin Stretch", "hip groin adductors", "HIP/GROIN", "Groin stretching remains distinct from knee/ankle locks despite back loading."),
    ("Guillotine Choke", "neck", "CHOKE", "The authored guillotine choke targets the neck."),
    ("Heel Hook", "knee heel", "LEG", "Heel rotation attacks knee structures; it remains a leg lock."),
    ("Hip Lock", "hip groin", "HIP/GROIN", "Hip/groin joint targets are not knee or ankle targets."),
    ("Hyperextension", "elbow", "ARM", "This generic type is disambiguated by its authored elbow target."),
    ("Knee Compression", "knee calf", "LEG", "Knee/calf compression belongs to leg attacks."),
    ("Knee and Hip Compression", "knee", "LEG", "The explicit knee target makes this mixed knee/hip attack a leg attack."),
    ("Lapel Choke", "carotid trachea", "CHOKE", "Lapel compression targets the neck's vascular/airway structures."),
    ("Leg Compression Lock", "calf knee", "LEG", "Calf/knee compression is explicitly a leg lock."),
    ("Leg Compression", "calf achilles shin ankle", "LEG", "Lower-leg tissue compression stays in the leg class."),
    ("Leg Lock", "achilles ankle knee foot", "LEG", "The leg-lock type is confirmed by its lower-limb joint targets."),
    ("Neck Crank", "cervical spine", "SPINE/COMPRESSION", "A cervical crank is spinal loading, not a choke."),
    ("Shin Choke", "trachea carotid", "CHOKE", "The shin is the tool; the neck is the target."),
    ("Shoulder Lock", "shoulder", "SHOULDER", "Shoulder-lock type selects the shoulder even when elbow loading is listed."),
    ("Spinal Compression", "spine vertebrae", "SPINE/COMPRESSION", "Cervical/lumbar/thoracic compression targets the spine."),
    ("Spinal Lock", "spine", "SPINE/COMPRESSION", "The explicit spinal target identifies a spinal lock."),
    ("Straight Ankle Lock", "ankle", "LEG", "The explicit ankle target identifies a leg lock."),
    ("Triangle Choke", "neck", "CHOKE", "The triangle choke's target is the neck, not the attacking legs."),
    ("Wrist Hyperflexion", "wrist carpal", "ARM", "Wrist/carpal hyperflexion is grouped with arm locks."),
)
FLOORS = {"position_role_nodes": 260, "position_hubs": 130,
          "transition_attacker_nodes": 1000, "submission_attacker_nodes": 280,
          "technique_origin_joins": 1280, "outcome_cells_examined": 4000,
          "systems_examined": 80, "system_member_rows_examined": 1400,
          "system_member_rows_joined": 1400, "principles_examined": 60,
          "attempt_rows_examined": 2000, "lexicon_rules_used": len(LEXICON),
          "position_family_references_joined": 120, "position_family_labels": 10}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def tokens(text: str) -> list[str]:
    # Slash is a token separator, not slugify's punctuation deletion.
    return sorted(set(slugify(text.replace("/", " ")).split("-")) - {""})


def name_evidence(node: dict) -> dict:
    return {"evidence": "name-derived", "from_name": tokens(node["name"]),
            "from_path": tokens(node.get("path", "")),
            "tokens": tokens(node["name"] + " " + node.get("path", ""))}


def classify(node: dict) -> dict:
    target = set(tokens(node.get("targetArea", "")))
    matches = [(kind, region, reason) for kind, terms, region, reason in LEXICON
               if node.get("type") == kind and target & set(terms.split())]
    require(len(matches) == 1,
            f"UNMAPPED_OR_AMBIGUOUS_SUBMISSION: type={node.get('type')!r}, targetArea={node.get('targetArea')!r}")
    kind, region, reason = matches[0]
    return {"class": region, "lexicon_rule": kind, "evidence": "structured",
            "name_derived": False, "reason": reason}


def result_mix(outcomes: list[dict]) -> dict:
    require(bool(outcomes), "EMPTY_OUTCOMES")
    frames = {}
    for frame in FRAMES:
        sums = {result: [] for result in RESULTS}
        nulls = 0
        present = 0
        for cell in outcomes:
            require(cell.get("result") in RESULTS, f"UNKNOWN_RESULT: {cell}")
            value = cell["probabilityByRuleset"][frame] if "probabilityByRuleset" in cell else cell["probability"]
            if value is None:
                nulls += 1
                continue
            require(isinstance(value, (int, float)) and not isinstance(value, bool)
                    and math.isfinite(value) and 0 <= value <= 100, f"INVALID_OUTCOME: {cell}")
            present += 1
            sums[cell["result"]].append(value / 100)
        mix = {key: math.fsum(values) for key, values in sums.items()}
        if present:
            require(math.isclose(math.fsum(mix.values()), 1, abs_tol=1e-12),
                    f"OUTCOME_MIX_NOT_NORMALISED: {frame}: {mix}")
        frames[frame] = {"mix": mix if present else None, "present_cells": present,
                         "null_cells_dropped": nulls}
    return {"evidence": "structured", "meaning": "Authored outcome result marginals; not calibrated kernel branch probabilities.",
            "source": "probabilityByRuleset where present, otherwise common probability scalar",
            "by_ruleset": frames}


class GraphIndex:
    """Exact ID/path/name identity joins, with ambiguity reported rather than guessed."""

    CATS = {"position": "positions", "transition": "transitions", "submission": "submissions",
            "principle": "principles", "system": "systems"}

    def __init__(self, graph: dict):
        self.graph = graph
        self.names = defaultdict(set)
        self.paths = defaultdict(set)
        for cat in self.CATS.values():
            for key, node in graph.get(cat, {}).items():
                if cat in ("positions", "transitions", "submissions") and "/" in key:
                    continue
                self.names[cat, node["name"].casefold().strip()].add(key)
                if node.get("path"):
                    self.paths[cat, node["path"].replace(" ", "-").casefold()].add(key)

    def resolve(self, reference: str, kind: str = "", path: str = "") -> dict:
        kind = kind.casefold()
        prefix, sep, tail = (path or reference).partition("/")
        if prefix.casefold() in self.CATS.values() and sep:
            cat = prefix.casefold()
            if kind and self.CATS.get(kind) != cat:
                return {"status": "unresolved", "reason": "TYPE_PATH_CONFLICT"}
            cats = [cat]
            address = tail
        else:
            if kind and kind not in self.CATS:
                return {"status": "unresolved", "reason": "NON_GRAPH_CONTENT_TYPE"}
            cats = [self.CATS[kind]] if kind else list(self.CATS.values())
            address = path or reference
        found = []
        for cat in cats:
            entries = self.graph.get(cat, {})
            exact = address.casefold().replace(" ", "-")
            candidates = [
                ("exact-id", {exact} if exact in entries else set()),
                ("exact-graph-path", self.paths[cat, exact]),
                ("path-flattened-id", {slugify(address.replace("/", "-"))} & set(entries)),
                ("exact-declared-name", self.names[cat, reference.casefold().strip()]),
            ]
            for route, hits in candidates:
                if hits:
                    found.extend((cat, key, route) for key in sorted(hits))
                    break
        if len(found) != 1:
            return {"status": "unresolved", "reason": "AMBIGUOUS_REFERENCE" if found else "NO_EXACT_IDENTITY",
                    "candidates": [f"{cat}:{key}" for cat, key, _ in found]}
        cat, key, route = found[0]
        return {"status": "joined", "category": cat, "id": key, "join_route": route}

    def project(self, match: dict) -> dict:
        out = {k: [] for k in ("role_nodes", "hubs", "techniques", "family_hubs", "principles", "systems")}
        if match["status"] != "joined":
            return out
        cat, key = match["category"], match["id"]
        node = self.graph[cat][key]
        if cat == "positions":
            if node.get("role") in ("top", "bottom"):
                out["role_nodes"] = [key]
                out["hubs"] = [node["hub"]]
            elif node.get("role") == "hub":
                out["hubs"] = [key]
                out["role_nodes"] = [f"{key}/{role}" for role in ("bottom", "top")]
                require(all(r in self.graph[cat] for r in out["role_nodes"]), f"MISSING_PAIR: {key}")
        elif cat in ("transitions", "submissions"):
            if node.get("isFamily"):
                out["family_hubs"] = [key]
            else:
                attacker = key if key.endswith("/attacker") else f"{node['hub']}/attacker"
                require(attacker in self.graph[cat], f"MISSING_ATTACKER: {key}")
                out["techniques"] = [attacker]
        else:
            out[cat] = [key]
        return out


def _label(store: dict, scope: str, key: str, nodes, definition: str,
           evidence: str = "structured") -> None:
    store.setdefault(scope, {})[key] = {"nodes": sorted(set(nodes)), "definition": definition,
                                       "evidence": evidence}


def build_vocabulary(graph: dict, *, enforce_floors: bool = True) -> dict:
    positions = graph["positions"]
    roles = {key: node for key, node in positions.items() if node.get("role") in ("top", "bottom")}
    hubs = {key: node for key, node in positions.items() if node.get("role") == "hub"}
    require(bool(roles) and bool(hubs), "EMPTY_POSITION_SETS")
    require(set(roles) == {f"{hub}/{role}" for hub in hubs for role in ("top", "bottom")}, "POSITION_PAIR_SET_MISMATCH")
    coverage = Counter(position_role_nodes=len(roles), position_hubs=len(hubs))
    role_records, hub_records = {}, {}
    for key, node in sorted(roles.items()):
        require(node["hub"] in hubs and key == f"{node['hub']}/{node['role']}", f"BAD_ROLE_ID: {key}")
        require(all(f in node and node[f] is not None for f in FIELDS), f"MISSING_STATE_FIELD: {key}")
        role_records[key] = {"hub": node["hub"], "role": node["role"], "name": node["name"],
                             "path": node["path"], **{f: node[f] for f in FIELDS},
                             "name_evidence": name_evidence(node)}
    for key, node in sorted(hubs.items()):
        hub_records[key] = {"name": node["name"], "path": node["path"],
                            "role_nodes": [f"{key}/bottom", f"{key}/top"],
                            "field_semantics": "Per-role values preserved; bare hub has no state properties.",
                            **{f: {r: roles[f"{key}/{r}"][f] for r in ("bottom", "top")} for f in FIELDS},
                            "name_evidence": name_evidence(node)}
    techniques, unmapped = {}, []
    class_counts, rule_counts = Counter(), Counter()
    for cat in ("transitions", "submissions"):
        for key, node in sorted(graph[cat].items()):
            if node.get("role") != "attacker":
                continue
            require(key == f"{node['hub']}/attacker", f"BAD_ATTACKER_ID: {key}")
            require(key not in techniques, f"CROSS_CATEGORY_ID_COLLISION: {key}")
            origin = f"{node['fromPositionId']}/{node['fromRole']}"
            require(origin in roles, f"UNRESOLVED_ORIGIN: {key}: {origin}")
            coverage["technique_origin_joins"] += 1
            coverage[f"{cat[:-1]}_attacker_nodes"] += 1
            coverage["outcome_cells_examined"] += len(node["outcomes"])
            record = {"name": node["name"], "kind": cat[:-1], "hub": node["hub"],
                      "fromPositionId": node["fromPositionId"], "fromRole": node["fromRole"],
                      "origin_role_node": origin, "result_mix": result_mix(node["outcomes"]),
                      "name_evidence": name_evidence(node)}
            coverage["outcome_null_frame_cells_dropped"] += sum(
                frame["null_cells_dropped"] for frame in record["result_mix"]["by_ruleset"].values())
            if cat == "submissions":
                record.update({f: node.get(f) for f in ("category", "type", "targetArea")})
                try:
                    require(all(isinstance(record[f], str) and record[f] for f in ("category", "type", "targetArea")),
                            "MISSING_SUBMISSION_STRUCTURED_FIELDS")
                    record["body_region"] = classify(node)
                    class_counts[record["body_region"]["class"]] += 1
                    rule_counts[record["body_region"]["lexicon_rule"]] += 1
                except ValueError as exc:
                    unmapped.append({"id": key, "reason": str(exc)})
            techniques[key] = record
    require(not unmapped, "UNMAPPED_SUBMISSIONS: " + json.dumps(unmapped, sort_keys=True))
    require(sum(class_counts.values()) == coverage["submission_attacker_nodes"], "CLASS_PARTITION_FAILURE")
    coverage["lexicon_rules_used"] = len(rule_counts)
    coverage["submission_name_derived_classifications"] = 0

    index = GraphIndex(graph)
    position_families = defaultdict(set)
    for role, node in sorted(roles.items()):
        family = node.get("familyHub")
        role_records[role]["familyHub"] = family
        role_records[role]["family_hub_id"] = None
        if family is not None:
            coverage["position_family_reference_rows_examined"] += 1
            match = index.resolve(family, "position")
            require(match["status"] == "joined" and match["id"] in hubs,
                    f"UNRESOLVED_POSITION_FAMILY: {role}: {family}")
            coverage["position_family_references_joined"] += 1
            role_records[role]["family_hub_id"] = match["id"]
            position_families[match["id"]].add(role)
    for hub in hub_records:
        family_ids = {role_records[f"{hub}/{role}"]["family_hub_id"] for role in ("top", "bottom")}
        require(len(family_ids) == 1, f"ROLE_FAMILY_DISAGREEMENT: {hub}")
        hub_records[hub]["family_hub_id"] = next(iter(family_ids))
    coverage["position_family_labels"] = len(position_families)
    systems = {}
    for key, node in sorted(graph["systems"].items()):
        coverage["systems_examined"] += 1
        members, unresolved, routes = [], [], Counter()
        combined = {scope: set() for scope in ("role_nodes", "hubs", "techniques", "family_hubs", "principles", "systems")}
        expanded = set()
        for member in sorted(node["members"], key=lambda m: (m["type"], m["slug"], m["name"])):
            coverage["system_member_rows_examined"] += 1
            coverage[f"system_member_{member['type']}_rows_examined"] += 1
            match = index.resolve(member["name"], member["type"], member["path"])
            row = {"reference": member, "join": match, "projected": index.project(match)}
            if match["status"] == "joined":
                coverage["system_member_rows_joined"] += 1
                routes[match["join_route"]] += 1
                for scope, ids in row["projected"].items():
                    combined[scope].update(ids)
                if row["projected"]["family_hubs"]:
                    family = match["id"]
                    ids = sorted(t for t in techniques if techniques[t]["kind"] == "submission" and t.startswith(family + "-from-"))
                    require(bool(ids), f"EMPTY_FAMILY_PREFIX_EXPANSION: {family}")
                    row["optional_family_expansion"] = {"evidence": "name-derived", "techniques": ids,
                                                        "definition": "Submission attacker IDs starting <family-id>-from-; excluded from primary projected techniques."}
                    expanded.update(ids)
                    coverage["system_member_name_derived_family_expansion_rows"] += 1
            else:
                unresolved.append({"reference": member, "reason": match["reason"]})
            members.append(row)
        require(bool(members), f"EMPTY_SYSTEM_MEMBERS: {key}")
        require(len(members) > len(unresolved), f"SYSTEM_JOIN_FLOOR: {key} has zero joined members; floor=1")
        systems[key] = {"name": node["name"], "tags": sorted(node.get("tags", [])),
                        "members": members, "member_count": len(members),
                        "joined_count": len(members) - len(unresolved),
                        "unresolved_count": len(unresolved), "unresolved": unresolved,
                        "join_route_counts": dict(sorted(routes.items())),
                        "joined_sets": {scope: sorted(ids) for scope, ids in combined.items()},
                        "name_derived_family_expansion_techniques": sorted(expanded)}
    coverage["system_member_rows_unresolved"] = sum(s["unresolved_count"] for s in systems.values())
    coverage["principles_examined"] = len(graph["principles"])
    principles = {key: {"name": node["name"], "tags": sorted(node.get("tags", [])),
                        "position_membership": None,
                        "limitation": "graph.json emits tags but no principle-to-node references."}
                  for key, node in sorted(graph["principles"].items())}

    labels = {scope: {} for scope in ("role_nodes", "hubs", "techniques")}
    for family, ids in sorted(position_families.items()):
        _label(labels, "role_nodes", f"position-family:{family}", ids,
               f"Position role-nodes whose explicit graph.json familyHub identity resolves to {family}; no path-prefix inference.")
        _label(labels, "hubs", f"position-family:{family}", {roles[r]["hub"] for r in ids},
               f"Position hubs of role-nodes whose explicit familyHub resolves to {family}.")
    for field in FIELDS:
        for value in sorted({roles[r][field] for r in roles}, key=str):
            ids = {r for r in roles if roles[r][field] == value}
            _label(labels, "role_nodes", f"{field}:{value}", ids, f"All authored position role-nodes whose {field} equals {value!r}.")
            _label(labels, "hubs", f"either-role:{field}:{value}", {roles[r]["hub"] for r in ids},
                   f"Position hubs with at least one role whose {field} equals {value!r}; not a property of both roles.")
    for region in sorted(class_counts):
        ids = {key for key, node in techniques.items() if node.get("body_region", {}).get("class") == region}
        origins = {techniques[key]["origin_role_node"] for key in ids}
        _label(labels, "techniques", f"body-region:{region}", ids, f"All submission /attacker nodes classified {region} by structured type + targetArea.")
        _label(labels, "role_nodes", f"submission-origin:{region}", origins,
               f"Canonical fromPositionId/fromRole origins of any {region} submission; authored structural set, not reachability or a dealt-hand claim.")
        _label(labels, "hubs", f"submission-origin:{region}", {roles[r]["hub"] for r in origins},
               f"Hubs of canonical origin role-nodes of {region} submissions; either role suffices.")
    # Compare two structural definitions rather than silently equating origins and
    # authored positive attempt listings. No filtering/fallback or transition matrix.
    listed = {frame: defaultdict(set) for frame in FRAMES}
    for role, node in sorted(roles.items()):
        for entry in node["transitions"]:
            coverage["attempt_rows_examined"] += 1
            target = entry["target"]
            attacker = target if target.endswith("/attacker") else target + "/attacker"
            require(attacker in techniques, f"UNRESOLVED_ATTEMPT_TARGET: {role}: {target}")
            technique = techniques[attacker]
            region = technique.get("body_region", {}).get("class")
            for frame in FRAMES:
                value = entry["attemptProbabilityByRuleset"][frame]
                if value is None:
                    coverage[f"attempt_null_cells_dropped_{frame}"] += 1
                    continue
                require(isinstance(value, (int, float)) and math.isfinite(value) and 0 <= value <= 100,
                        f"INVALID_ATTEMPT_CELL: {role}: {frame}")
                coverage[f"attempt_numeric_cells_examined_{frame}"] += 1
                if region and value > 0:
                    listed[frame][region].add(role)
    comparisons = {}
    for region in sorted(class_counts):
        origins = set(labels["role_nodes"][f"submission-origin:{region}"]["nodes"])
        comparisons[region] = {}
        for frame in FRAMES:
            ids = listed[frame][region]
            key = f"listed-positive-submission:{frame}:{region}"
            _label(labels, "role_nodes", key, ids,
                   f"Position role-nodes listing a {region} submission with numeric attemptProbabilityByRuleset.{frame} > 0; BEFORE Model origin/role filtering and reachability.")
            _label(labels, "hubs", key, {roles[r]["hub"] for r in ids},
                   f"Hubs with either role in {key}; authored positive listing, not a kernel deal or reachable-set claim.")
            comparisons[region][frame] = {"origin_role_count": len(origins), "listed_role_count": len(ids),
                                          "intersection": len(origins & ids),
                                          "only_origins": sorted(origins - ids), "only_listed": sorted(ids - origins)}
            origin_hubs, listed_hubs = ({roles[r]["hub"] for r in group} for group in (origins, ids))
            comparisons[region][frame]["hubs"] = {"origin_hub_count": len(origin_hubs),
                                                  "listed_hub_count": len(listed_hubs),
                                                  "intersection": len(origin_hubs & listed_hubs),
                                                  "only_origins": sorted(origin_hubs - listed_hubs),
                                                  "only_listed": sorted(listed_hubs - origin_hubs)}
    for key, system in systems.items():
        for scope in labels:
            _label(labels, scope, f"system:{key}", system["joined_sets"][scope],
                   f"Direct structured members of system {key}, projected to {scope}; no family-prefix or technique-origin propagation.")
    for scope, records in (("role_nodes", role_records), ("hubs", hub_records), ("techniques", techniques)):
        vocabulary = sorted({t for node in records.values() for t in node["name_evidence"]["tokens"]})
        for token in vocabulary:
            _label(labels, scope, f"name-token:{token}", [key for key, node in records.items() if token in node["name_evidence"]["tokens"]],
                   f"{scope} with normalized name/path token {token!r}; secondary lexical evidence only.", "name-derived")
        require(all(set(label["nodes"]) <= set(records) for label in labels[scope].values()), f"LABEL_UNIVERSE_MISMATCH: {scope}")
        coverage[f"{scope}_label_sets"] = len(labels[scope])
    if enforce_floors:
        for key, floor in FLOORS.items():
            require(coverage[key] >= floor, f"COVERAGE_FLOOR: {key}={coverage[key]} < {floor}")
        require(set(rule_counts) == {row[0] for row in LEXICON}, "UNEXERCISED_LEXICON_RULE")
    return {"schema": "graph-semantics.vocabulary.v1", "source": "graph.json only",
            "set_definition": "All authored position top/bottom role-nodes, their bare hubs, and transition/submission attacker nodes; terminal, defender and family hubs excluded from these universes; no live/reachable filter.",
            "position_role_nodes": role_records, "position_hubs": hub_records,
            "techniques": techniques, "systems": systems, "principles": principles,
            "lexicon": [{"type": kind, "targetArea_any_token": terms.split(), "class": cls,
                         "reason": reason, "name_derived": False, "matched_nodes": rule_counts[kind]}
                        for kind, terms, cls, reason in LEXICON],
            "class_counts": dict(sorted(class_counts.items())), "unmapped_submissions": unmapped,
            "label_sets": labels, "label_definition_comparisons": comparisons,
            "coverage": dict(sorted(coverage.items())), "coverage_floors": FLOORS,
            "per_system_coverage_floors": {"members_examined": 1, "members_joined": 1},
            "limits": ["State fields are authored categories, not derived probabilistic values.",
                       "Canonical origins and positive authored listings are distinct label definitions; neither proves an actual kernel hand or reachability.",
                       "Systems are partial pedagogical references, not exhaustive memberships or dynamical territories.",
                       "HIP/GROIN refines the taxonomy for dedicated hip/groin attacks; calf/bicep compression stay with their body region.",
                       "No region or territory-name fit is claimed by this vocabulary alone."]}


def survey_content(graph: dict, root: Path = ROOT) -> dict:
    """Supplemental authored relations; never a source for vocabulary.json's labels."""
    from regenerate_graph import quartz_slug  # Pure identity constructor; no emitter is run.

    folders = {"Positions": "position", "Transitions": "transition", "Submissions": "submission",
               "Principles": "principle", "Systems": "system", "Learning": "learning"}
    index = GraphIndex(graph)
    docs, by_name, by_page = {}, defaultdict(set), {}
    fields_by_folder = defaultdict(Counter)
    digest = hashlib.sha256()
    for folder, kind in folders.items():
        files = sorted((root / "content" / folder).rglob("*.json"))
        require(bool(files), f"EMPTY_CONTENT_FOLDER: {folder}")
        for path in files:
            relative = path.relative_to(root).as_posix()
            raw = path.read_bytes()
            digest.update(relative.encode() + b"\0" + raw + b"\0")
            data = json.loads(raw)
            require(isinstance(data, dict) and isinstance(data.get("name"), str), f"BAD_CONTENT: {relative}")
            fields_by_folder[folder].update(data.keys())
            page = "/".join(quartz_slug(part) for part in path.relative_to(root / "content").with_suffix("").parts)
            require(page not in by_page, f"DUPLICATE_CONTENT_PATH: {page}")
            by_page[page] = relative
            match = index.resolve(data["name"], kind, page)
            if match["status"] == "joined":
                require(graph[match["category"]][match["id"]]["name"] == data["name"],
                        f"CONTENT_GRAPH_NAME_MISMATCH: {relative}: {match}")
            docs[relative] = {"kind": kind, "folder": folder, "data": data, "page": page, "join": match}
            for name in [data["name"], *data.get("aliases", [])]:
                require(isinstance(name, str), f"BAD_ALIAS: {relative}")
                by_name[kind, name.strip().casefold()].add(relative)
                by_name["", name.strip().casefold()].add(relative)

    def resolve(reference: str, kind: str = "", page: str = "") -> dict:
        kind = kind.casefold()
        paths = {by_page[page]} if page in by_page else by_name[kind, reference.strip().casefold()]
        if len(paths) == 1:
            target = docs[next(iter(paths))]
            if kind and kind != target["kind"]:
                return {"status": "unresolved", "reason": "TYPE_PATH_CONFLICT"}
            if target["join"]["status"] == "joined":
                return {**target["join"], "content_source": next(iter(paths)),
                        "identity_evidence": "declared-content-name/alias/path"}
            if target["kind"] == "learning":
                return {"status": "content-only", "content_source": next(iter(paths)),
                        "reason": "Learning pages have no graph.json node"}
        if len(paths) > 1:
            return {"status": "unresolved", "reason": "AMBIGUOUS_CONTENT_IDENTITY", "candidates": sorted(paths)}
        return index.resolve(reference, kind, page)

    references, counts, tagged, aliases = [], defaultdict(Counter), [], []
    metadata, rejected = {}, []

    def add(source: str, field: str, name: str, kind: str = "", page: str = "", detail: str = ""):
        require(isinstance(name, str) and bool(name.strip()), f"EMPTY_REFERENCE: {source}:{field}")
        match = resolve(name, kind, page)
        counts[field]["examined"] += 1
        counts[field][match["status"]] += 1
        references.append({"source": source, "field": field, "reference": name, "declared_type": kind,
                           "relationship": detail, "join": match,
                           "projected": index.project(match) if match["status"] == "joined" else {}})

    for source, record in sorted(docs.items()):
        data, kind = record["data"], record["kind"]
        metadata[source] = {"name": data["name"], "kind": kind, "page": record["page"],
                            "graph_join": record["join"],
                            "projected": index.project(record["join"]),
                            "fields": sorted(data),
                            "structured_attributes": {f: data[f] for f in (
                                "system_type", "difficulty_level", "application_level", "complexity_level", "category") if f in data}}
        for alias in data.get("aliases", []):
            aliases.append({"source": source, "alias": alias, "canonical_name": data["name"],
                            "graph_join": record["join"],
                            "use": "Identity resolution only; not independent semantic evidence."})
        containers = [("", data)] + [(role + ".", data[role]) for role in ("top", "bottom", "attacker", "defender") if role in data]
        for prefix, container in containers:
            if "tags" in container:
                tags = container["tags"]
                require(isinstance(tags, list) and all(isinstance(t, str) for t in tags), f"INVALID_TAGS: {source}:{prefix}")
                projected = index.project(record["join"])
                if prefix in ("top.", "bottom.") and projected["hubs"]:
                    projected["role_nodes"] = [h + "/" + prefix[:-1] for h in projected["hubs"]]
                tagged.append({"source": source, "field": prefix + "tags", "tags": sorted(set(tags)),
                               "projected": projected,
                               "evidence": "structured authored tags; sentence-valued tags remain atomic, no token inference",
                               "perspective": prefix[:-1] if prefix else "page"})
            for field, default_kind in (("related_content", ""), ("related_positions", "position"),
                                         ("related_submissions", "submission")):
                for ref in container.get(field, []):
                    if isinstance(ref, str):
                        add(source, prefix + field, ref, default_kind)
                    else:
                        add(source, prefix + field, ref["name"], ref.get("content_type", default_kind),
                            detail=ref.get("relationship", ""))
        for ref in data.get("from_positions", []):
            add(source, "from_positions", ref, "position")
        for ref in data.get("principle_relationships", []):
            add(source, "principle_relationships", ref["principle_name"], "principle",
                detail=ref.get("relationship_type", ""))
        for ref in data.get("application_contexts", []):
            # "context" is not typed as Position: it may name a technique.
            add(source, "application_contexts", ref["context"])
        for ref in data.get("variations", []):
            # A variation can be an explicitly relative child of a family file.
            child = (root / source).with_suffix("") / (ref["name"] + ".json")
            child_source = child.relative_to(root).as_posix()
            if child_source in docs:
                child_record = docs[child_source]
                add(source, "variations", child_record["data"]["name"], kind, child_record["page"])
            else:
                add(source, "variations", ref["name"], kind)
        if "graph_applicability" in data:
            applicability = data["graph_applicability"]
            metadata[source]["graph_applicability"] = applicability
            for family in applicability.get("families", []):
                add(source, "graph_applicability.families", family, "submission")
            if applicability.get("terms"):
                rejected.append({"source": source, "field": "graph_applicability.terms",
                                 "reason": "Term selectors are structured instructions for prose matching, not pre-existing structural node membership; retained as metadata, not applied."})
        if data.get("references"):
            rejected.append({"source": source, "field": "references",
                             "reason": "External bibliographic references, not graph-ID relations."})

    curriculum_path = root / "templates/curriculum.json"
    raw = curriculum_path.read_bytes()
    digest.update(b"templates/curriculum.json\0" + raw)
    curriculum = json.loads(raw)
    lessons, curriculum_unresolved = [], []
    for level, belt in enumerate(curriculum["belts"]):
        for unit in belt["units"]:
            for lesson in unit["lessons"]:
                match = resolve("", page=lesson["nodeId"])
                projected = index.project(match)
                seat = lesson["deckKey"].rsplit("|", 1)[-1].casefold()
                if match["status"] == "joined":
                    require(lesson["deckKey"].rsplit("|", 1)[0] == graph[match["category"]][match["id"]]["name"],
                            f"CURRICULUM_DECK_IDENTITY_MISMATCH: {lesson}")
                if seat in ("top", "bottom"):
                    projected["role_nodes"] = [h + "/" + seat for h in projected["hubs"]]
                # Defender lessons retain their explicit seat even though this lane's
                # technique universe is the canonical /attacker representation.
                row = {"belt": belt["id"], "belt_order": level, "unit": unit["id"],
                       "nodeId": lesson["nodeId"], "deckKey": lesson["deckKey"], "seat": seat,
                       "authored_frames": lesson.get("frames"), "join": match, "projected": projected}
                if match["status"] != "joined":
                    curriculum_unresolved.append(row)
                lessons.append(row)
    # Cross-check every graph identity set against independently enumerated source
    # documents, rather than accepting a merely complete-looking index join.
    source_joins = Counter(record["join"]["status"] for record in docs.values())
    for cat, kind in GraphIndex.CATS.items():
        expected = {key for key, node in graph[kind].items()
                    if "/" not in key and node.get("role") != "terminal"}
        actual = {r["join"]["id"] for r in docs.values()
                  if r["kind"] == cat and r["join"]["status"] == "joined"}
        require(actual == expected, f"CONTENT_GRAPH_ID_SET_MISMATCH: {kind}: missing={sorted(expected-actual)} extra={sorted(actual-expected)}")
    coverage = {"documents_examined": len(docs), "documents_graph_joined": source_joins["joined"],
                "learning_documents_without_graph_node": sum(r["kind"] == "learning" for r in docs.values()),
                "documents_by_folder": dict(sorted(Counter(r["folder"] for r in docs.values()).items())),
                "reference_rows_examined": len(references),
                "reference_rows_graph_joined": sum(r["join"]["status"] == "joined" for r in references),
                "reference_rows_content_only": sum(r["join"]["status"] == "content-only" for r in references),
                "reference_rows_unresolved": sum(r["join"]["status"] == "unresolved" for r in references),
                "tag_containers_examined": len(tagged), "tag_entries": sum(len(t["tags"]) for t in tagged),
                "distinct_tags": len({tag for t in tagged for tag in t["tags"]}),
                "alias_rows_examined": len(aliases), "curriculum_belts_examined": len(curriculum["belts"]),
                "curriculum_lessons_examined": len(lessons),
                "curriculum_lessons_joined": len(lessons) - len(curriculum_unresolved),
                "curriculum_lessons_unresolved": len(curriculum_unresolved)}
    floors = {"documents_examined": 1600, "documents_graph_joined": 1600,
              "reference_rows_examined": 1000, "reference_rows_graph_joined": 1000,
              "tag_containers_examined": 1000, "alias_rows_examined": 50,
              "curriculum_belts_examined": 5, "curriculum_lessons_joined": 100}
    for key, floor in floors.items():
        require(coverage[key] >= floor, f"SURVEY_COVERAGE_FLOOR: {key}={coverage[key]} < {floor}")
    for field in ("related_positions", "related_content", "variations", "principle_relationships",
                  "application_contexts", "graph_applicability.families", "from_positions"):
        require(counts[field]["examined"] > 0 and counts[field]["joined"] > 0, f"EMPTY_REFERENCE_JOIN: {field}")
    return {"schema": "graph-semantics.vocabulary-survey.v1",
            "source": "Supplementary content/{Positions,Transitions,Submissions,Principles,Systems,Learning}/**/*.json and templates/curriculum.json; kept separate from graph-only vocabulary.",
            "source_sha256": digest.hexdigest(), "documents": metadata, "references": references,
            "aliases": aliases, "tags": tagged,
            "coverage": coverage, "coverage_floors": floors,
            "field_join_counts": {k: dict(sorted(v.items())) for k, v in sorted(counts.items())},
            "field_census_by_folder": {k: dict(sorted(v.items())) for k, v in sorted(fields_by_folder.items())},
            "curriculum": {"provisional": curriculum.get("provisional"), "lessons": lessons,
                           "unresolved": curriculum_unresolved,
                           "meaning": "Authored belt/unit lesson membership and seat, not learned difficulty or kernel occupancy.",
                           "weights": {"status": "excluded", "field": "scoreWeightsByRuleset",
                                       "source": "scripts/regenerate_neural_data.py:build_score_weights / _compact_score_weights",
                                       "reason": "Emitter-derived deck weights, not semantic labels; its position/attacker/defender blocks are not the shared kernel's role-node stationary measure. No emitter or independent chain was run."}},
            "rejected": rejected,
            "policy": ["Exact declared names, aliases and paths resolve identities; ambiguous and absent targets stay unresolved.",
                       "No prose, overview, flashcards, relationship descriptions or lexical applicability terms are mined into primary labels.",
                       "Family and related-content references are pedagogical relations; no claim of exhaustive membership.",
                       "Tags are kept at their original page/role/seat; no silent propagation to origins or neighboring nodes.",
                       "Structured state_properties, origin and outcome fields already live in graph.json and are not re-modelled here.",
                       "Aliases are identity evidence; variations are explicit relations; both retain authored provenance."]}


def audit_vocabulary(graph: dict, result: dict) -> dict:
    """Independent ID-suffix enumeration and reverse joins audit the emitted sets.

    Not a second taxonomy or chain: a declared taxonomy cannot independently prove
    anatomical truth. This checks exact extraction, partitioning and arithmetic.
    """
    roles = {key for key in graph["positions"] if key.endswith(("/top", "/bottom"))}
    attackers = {key for cat in ("transitions", "submissions") for key in graph[cat]
                 if key.endswith("/attacker")}
    require(roles == set(result["position_role_nodes"]), "AUDIT_ROLE_SET_MISMATCH")
    require(attackers == set(result["techniques"]), "AUDIT_ATTACKER_SET_MISMATCH")
    field_checks = 0
    family_checks = 0
    hub_names = {node["name"]: key for key, node in graph["positions"].items() if node.get("role") == "hub"}
    for role in sorted(roles):
        hub, side = role.rsplit("/", 1)
        for field in FIELDS:
            expected = graph["positions"][role][field]
            require(expected == result["position_role_nodes"][role][field] == result["position_hubs"][hub][field][side],
                    f"AUDIT_STATE_FIELD: {role}: {field}")
            field_checks += 1
        family = graph["positions"][role].get("familyHub")
        if family is not None:
            require(result["position_role_nodes"][role]["family_hub_id"] == hub_names[family], f"AUDIT_POSITION_FAMILY: {role}")
            family_checks += 1
    mixes = 0
    for cat in ("transitions", "submissions"):
        for key in sorted(set(graph[cat]) & attackers):
            raw = graph[cat][key]
            record = result["techniques"][key]
            require((record["fromPositionId"], record["fromRole"]) == (raw["fromPositionId"], raw["fromRole"]), f"AUDIT_ORIGIN: {key}")
            for frame in FRAMES:
                cells = [(c["result"], c["probabilityByRuleset"][frame] if "probabilityByRuleset" in c else c["probability"])
                         for c in raw["outcomes"]]
                numeric = [(kind, value) for kind, value in cells if value is not None]
                got = record["result_mix"]["by_ruleset"][frame]
                require(got["present_cells"] == len(numeric) and got["null_cells_dropped"] == len(cells)-len(numeric), f"AUDIT_NULLS: {key}")
                if numeric:
                    # Sum raw percentage cells before division, a separate route
                    # from the extractor's sum of individually divided cells.
                    expected = {kind: sum(value for label, value in numeric if label == kind)/100 for kind in RESULTS}
                    require(all(math.isclose(got["mix"][k], v, abs_tol=1e-14) for k, v in expected.items()), f"AUDIT_RESULT_MIX: {key}")
                else:
                    require(got["mix"] is None, f"AUDIT_ABSENT_FRAME: {key}")
                mixes += 1
    partition = []
    origin_joins = 0
    for cls in result["class_counts"]:
        techs = set(result["label_sets"]["techniques"][f"body-region:{cls}"]["nodes"])
        partition.extend(techs)
        # Invert the join: ask EACH role which submissions originate there.
        reverse = set()
        for role in sorted(roles):
            for technique in sorted(techs):
                origin_joins += 1
                raw = graph["submissions"][technique]
                if role == raw["fromPositionId"] + "/" + raw["fromRole"]:
                    reverse.add(role)
                    break
        require(reverse == set(result["label_sets"]["role_nodes"][f"submission-origin:{cls}"]["nodes"]), f"AUDIT_ORIGIN_LABEL: {cls}")
        require(len(techs) == result["class_counts"][cls], f"AUDIT_CLASS_COUNT: {cls}")
    expected_submissions = {key for key in graph["submissions"] if key.endswith("/attacker")}
    require(len(partition) == len(set(partition)) and set(partition) == expected_submissions, "AUDIT_CLASS_PARTITION")
    by_type = Counter(graph["submissions"][key]["type"] for key in expected_submissions)
    require({r["type"]: r["matched_nodes"] for r in result["lexicon"] if r["matched_nodes"]} == dict(by_type), "AUDIT_LEXICON_COUNTS")
    members = 0
    for key, system in graph["systems"].items():
        expected = sorted(json.dumps(m, sort_keys=True) for m in system["members"])
        got = sorted(json.dumps(m["reference"], sort_keys=True) for m in result["systems"][key]["members"])
        require(got == expected, f"AUDIT_SYSTEM_REFERENCE_SET: {key}")
        members += len(expected)
    return {"state_field_equalities": field_checks, "explicit_family_refs_checked": family_checks,
            "authored_result_frame_mixes_checked": mixes,
            "attacker_ids_checked": len(attackers), "submission_partition_nodes_checked": len(partition),
            "reverse_origin_comparisons": origin_joins, "system_member_references_preserved": members}


def selfcheck() -> dict:
    # All lexical rules must discriminate without a name, including misleading names.
    for kind, terms, region, _ in LEXICON:
        assert classify({"type": kind, "targetArea": terms.split()[0], "name": "Misleading Neck Arm Leg"})["class"] == region
    for node in ({"type": "Unknown", "targetArea": "knee"},
                 {"type": "Leg Lock", "targetArea": "neck"}):
        try:
            classify(node)
        except ValueError as exc:
            assert "UNMAPPED_OR_AMBIGUOUS" in str(exc)
        else:
            raise AssertionError("unmapped submission was accepted")
    absent = result_mix([{"result": "success", "probabilityByRuleset": {"gi": 100, "nogi": None}}])
    assert absent["by_ruleset"]["nogi"]["mix"] is None
    assert absent["by_ruleset"]["nogi"]["null_cells_dropped"] == 1
    mixed = result_mix([{"result": "success", "probability": 20},
                        {"result": "success", "probability": 30},
                        {"result": "failure", "probability": 40},
                        {"result": "counter", "probability": 10}])
    assert mixed["by_ruleset"]["gi"]["mix"] == {"success": .5, "failure": .4, "counter": .1}
    assert tokens("Mata Leão/Top & 100%") == ["100", "and", "leao", "mata", "percent", "top"]
    positions = {"a": {"name": "A", "role": "hub", "hub": "a", "path": "A"}}
    for role in ("top", "bottom"):
        positions[f"a/{role}"] = {"name": "A " + role, "role": role, "hub": "a", "path": "A/" + role,
                                  "familyHub": "A",
                                  "positionType": "Offensive" if role == "top" else "Defensive",
                                  "pointValue": 4 if role == "top" else 0, "riskLevel": "Low", "energyCost": "Low",
                                  "transitions": [{"target": "lock-from-a", "attemptProbabilityByRuleset": {"gi": 100, "nogi": None}}]}
    submission = {"name": "Lock from A", "hub": "lock-from-a", "role": "attacker", "type": "Leg Lock",
                  "targetArea": "Knee", "category": "Joint Lock", "fromPositionId": "a", "fromRole": "top",
                  "outcomes": [{"to": "game-over", "result": "success", "probability": 100}]}
    graph = {"positions": positions, "transitions": {},
             "submissions": {"lock-from-a/attacker": submission,
                             "lock-from-a": {"name": "Lock from A", "hub": "lock-from-a", "role": "hub"},
                             "lock": {"name": "Lock", "isFamily": True}},
             "principles": {"principle": {"name": "Principle", "tags": ["toy"]}},
             "systems": {"toy": {"name": "Toy", "tags": [], "members": [
                 {"name": "A", "type": "position", "path": "Positions/A", "slug": "positions/a"},
                 {"name": "Lock", "type": "submission", "path": "Submissions/Lock", "slug": "submissions/lock"},
                 {"name": "Missing", "type": "position", "path": "Positions/Missing", "slug": "positions/missing"}]}}}
    toy = build_vocabulary(graph, enforce_floors=False)
    audit = audit_vocabulary(graph, toy)
    assert audit["state_field_equalities"] == 8
    assert audit["explicit_family_refs_checked"] == 2
    assert toy["label_sets"]["hubs"]["position-family:a"]["nodes"] == ["a"]
    assert toy["position_hubs"]["a"]["pointValue"] == {"bottom": 0, "top": 4}
    assert toy["class_counts"] == {"LEG": 1}
    assert toy["systems"]["toy"]["joined_count"] == 2
    assert toy["systems"]["toy"]["unresolved_count"] == 1
    assert toy["systems"]["toy"]["joined_sets"]["techniques"] == []
    assert toy["systems"]["toy"]["name_derived_family_expansion_techniques"] == ["lock-from-a/attacker"]
    assert toy["label_sets"]["role_nodes"]["submission-origin:LEG"]["nodes"] == ["a/top"]
    assert toy["label_sets"]["role_nodes"]["listed-positive-submission:nogi:LEG"]["nodes"] == []
    assert toy["coverage"]["attempt_null_cells_dropped_nogi"] == 2
    assert GraphIndex(graph).resolve("Lock from A", "submission", "Submissions/Lock/from-A")["id"] == "lock-from-a"
    try:
        build_vocabulary(graph)
    except ValueError as exc:
        assert "COVERAGE_FLOOR" in str(exc)
    else:
        raise AssertionError("coverage floors accepted a tiny graph")
    # The slim projection: known-answer on the toy, then mutants the audit must refuse.
    slim = slim_vocabulary(toy, full_bytes(toy))
    assert slim["techniques"]["lock-from-a/attacker"]["body_region"]["class"] == "LEG"
    assert slim["techniques"]["lock-from-a/attacker"]["name_tokens"] == ["a", "from", "lock"]
    assert slim["slimming"]["omitted"]["systems.*.members (per-row reference/join/projection)"] == 3
    slim_mutants = 0
    for mutate in (lambda s: s["techniques"]["lock-from-a/attacker"]["body_region"].update({"class": "ARM"}),
                   lambda s: s["techniques"]["lock-from-a/attacker"].update({"name_tokens": ["lock"]}),
                   lambda s: s["label_sets"]["role_nodes"]["submission-origin:LEG"].update({"nodes": []}),
                   lambda s: s["lexicon"].pop()):
        bad = json.loads(json.dumps(slim))
        mutate(bad)
        try:
            audit_slim(toy, bad)
        except ValueError:
            slim_mutants += 1
        else:
            raise AssertionError("slim audit accepted a mutated projection")
    # The compact writer must round-trip exactly and refuse non-finite numbers.
    sample = {"b": [1, 2.5, "ã", None, True], "a": {"z": [], "y": {}, "x": [{"k": [0.1]}, [1, [2]]]}, "c": -0.0}
    assert json.loads(dumps_compact(sample)) == sample
    assert dumps_compact({"k": [1, 2]}) == '{\n "k": [1, 2]\n}'
    assert dumps_compact({"r": {"b": {"y": 1}, "a": [2]}}) == '{\n "r": {"a": [2], "b": {"y": 1}}\n}'
    try:
        dumps_compact({"k": float("nan")})
    except ValueError:
        pass
    else:
        raise AssertionError("compact writer accepted NaN")
    try:
        refuse_committed_path(COMMITTED_DIR / "semantics" / "x.json", "probe")
    except ValueError:
        pass
    else:
        raise AssertionError("bulky dump allowed under tests/artifacts")
    summary = {"lexicon_rules_checked": len(LEXICON), "synthetic_role_nodes": 2,
               "synthetic_system_members_examined": 3, "synthetic_null_attempt_cells_dropped": 2,
               "unmapped_cases_refused": 2, "coverage_collapse_refused": 1,
               "slim_projection_mutants_refused": slim_mutants, "compact_writer_roundtrips": 3,
               "committed_dir_bulky_write_refused": 1}
    print("vocabulary selfcheck: " + json.dumps(summary, sort_keys=True))
    return summary


ARTIFACT_BUDGET_BYTES = 1_000_000
COMMITTED_DIR = ROOT / "tests" / "artifacts"


def full_bytes(data: dict) -> bytes:
    """The N1 serialisation of the FULL build (indent 2, sorted keys), unchanged."""
    return (json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False) + "\n").encode()


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(full_bytes(data))


def _flat(value) -> bool:
    return not isinstance(value, (dict, list, tuple)) or (
        isinstance(value, (list, tuple)) and all(not isinstance(x, (dict, list, tuple)) for x in value))


def _record(value) -> bool:
    """A dict whose values are flat, or dicts of flat values: one line in the compact form."""
    return isinstance(value, dict) and all(
        _flat(v) or (isinstance(v, dict) and all(_flat(w) for w in v.values())) for v in value.values())


def dumps_compact(data, indent: int = 0) -> str:
    """Deterministic, reviewable, small: sorted keys everywhere; a flat RECORD (see _record)
    and any list of scalars go on ONE line; everything else is indented one space per
    level. One record per line keeps diffs readable. NaN/inf refused."""
    def scalar(value):
        return json.dumps(value, ensure_ascii=False, allow_nan=False)
    if isinstance(data, dict):
        if not data:
            return "{}"
        require(all(isinstance(k, str) for k in data), "NON_STRING_JSON_KEY")
        if indent > 0 and _record(data):
            return json.dumps(data, sort_keys=True, ensure_ascii=False, allow_nan=False)
        pad = " " * (indent + 1)
        body = ",\n".join(pad + scalar(k) + ": " + dumps_compact(data[k], indent + 1) for k in sorted(data))
        return "{\n" + body + "\n" + " " * indent + "}"
    if isinstance(data, (list, tuple)):
        if all(not isinstance(x, (dict, list, tuple)) for x in data):
            return json.dumps(list(data), ensure_ascii=False, allow_nan=False)
        pad = " " * (indent + 1)
        return "[\n" + ",\n".join(pad + dumps_compact(x, indent + 1) for x in data) + "\n" + " " * indent + "]"
    return scalar(data)


def write_compact(path: Path, data: dict, budget: int | None = ARTIFACT_BUDGET_BYTES) -> int:
    text = (dumps_compact(data) + "\n").encode()
    require(json.loads(text) == json.loads(json.dumps(data, allow_nan=False)), f"COMPACT_ROUNDTRIP_FAILED: {path}")
    if budget is not None:
        require(len(text) < budget, f"ARTIFACT_OVER_BUDGET: {path} is {len(text)} bytes >= {budget}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text)
    return len(text)


def refuse_committed_path(path: Path, what: str) -> None:
    """A bulky dump must never land where the public repo commits artifacts."""
    resolved = path.resolve()
    require(COMMITTED_DIR.resolve() not in (resolved, *resolved.parents),
            f"BULKY_DUMP_IN_COMMITTED_DIR: {what} -> {path}; write it to a scratch directory")


SLIM_TECHNIQUE_FIELDS = ("name", "kind", "origin_role_node", "category", "type", "targetArea")
SLIM_ROLE_FIELDS = ("hub", "role", "name", "path", *FIELDS, "familyHub", "family_hub_id")
SLIM_HUB_FIELDS = ("name", "path", "role_nodes", *FIELDS, "family_hub_id")
SLIM_SYSTEM_DROPPED = ("members", "name_derived_family_expansion_techniques", "joined_sets")
# joined_sets scopes that label_sets[scope]["system:<key>"] already carries verbatim
SLIM_SYSTEM_SCOPES_IN_LABELS = ("role_nodes", "hubs", "techniques")


def slim_vocabulary(full: dict, full_dump: bytes) -> dict:
    """The committed projection of the full build. Every omission is named, counted and
    recoverable: from graph.json (result mixes, member rows) or from the kept records
    (name_tokens -> the technique-scope name-token index)."""
    techniques = {}
    for key, node in full["techniques"].items():
        record = {f: node[f] for f in SLIM_TECHNIQUE_FIELDS if f in node}
        record["name_tokens"] = node["name_evidence"]["tokens"]
        if "body_region" in node:
            record["body_region"] = {k: v for k, v in node["body_region"].items() if k != "reason"}
        techniques[key] = record
    labels = {scope: dict(sets) for scope, sets in full["label_sets"].items()}
    dropped_labels = sorted(k for k in labels["techniques"] if k.startswith("name-token:"))
    for key in dropped_labels:
        del labels["techniques"][key]
    systems = {}
    for key, s in full["systems"].items():
        record = {k: v for k, v in s.items() if k not in SLIM_SYSTEM_DROPPED}
        record["joined_sets"] = {k: v for k, v in s["joined_sets"].items() if k not in SLIM_SYSTEM_SCOPES_IN_LABELS}
        record["name_derived_family_expansion_count"] = len(s["name_derived_family_expansion_techniques"])
        systems[key] = record
    keep = ("schema", "source", "set_definition", "lexicon", "class_counts", "unmapped_submissions",
            "label_definition_comparisons", "coverage", "coverage_floors", "per_system_coverage_floors",
            "limits", "principles", "extraction_audit", "source_sha256", "selfcheck")
    out = {k: full[k] for k in keep if k in full}
    out.update({
        "schema": "graph-semantics.vocabulary.v2-slim",
        "techniques": techniques,
        "position_role_nodes": {k: {f: r[f] for f in SLIM_ROLE_FIELDS} for k, r in full["position_role_nodes"].items()},
        "position_hubs": {k: {f: r[f] for f in SLIM_HUB_FIELDS} for k, r in full["position_hubs"].items()},
        "systems": systems, "label_sets": labels,
        "record_semantics": {
            "position_hubs": "Per-role values preserved; bare hub has no state properties.",
            "techniques.name_tokens": "name-derived: normalized name/path tokens (secondary lexical evidence only).",
            "techniques.origin_role_node": "fromPositionId + '/' + fromRole of the attacker node (canonical origin).",
            "techniques.<key>": "The key is '<technique hub id>/attacker'; the hub id is the key without '/attacker' (asserted by the build).",
            "techniques.body_region": "Structured type + targetArea lexicon class; the rule's reason is in `lexicon`.",
            "systems.joined_sets": "family_hubs / principles / systems only; the role_nodes / hubs / techniques projections are label_sets[scope]['system:<key>'].nodes, verbatim."},
        "slimming": {
            "budget_bytes": ARTIFACT_BUDGET_BYTES,
            "full_build_sha256": hashlib.sha256(full_dump).hexdigest(),
            "full_build_bytes": len(full_dump),
            "full_build_how": "python3 -B scripts/semantics/vocabulary.py --selfcheck --full-out <scratch>/vocabulary_full.json",
            "omitted": {
                "techniques.*.result_mix": len(full["techniques"]),
                "techniques.*.fromPositionId/fromRole (== origin_role_node)": len(full["techniques"]),
                "techniques.*.name_evidence.from_name/from_path (tokens kept as name_tokens)": len(full["techniques"]),
                "techniques.*.body_region.reason (in lexicon)": sum("body_region" in t for t in full["techniques"].values()),
                "position_role_nodes.*.name_evidence": len(full["position_role_nodes"]),
                "position_hubs.*.name_evidence": len(full["position_hubs"]),
                "systems.*.members (per-row reference/join/projection)": sum(len(s["members"]) for s in full["systems"].values()),
                "systems.*.name_derived_family_expansion_techniques (count kept)": sum(
                    len(s["name_derived_family_expansion_techniques"]) for s in full["systems"].values()),
                "systems.*.joined_sets.{role_nodes,hubs,techniques} (== label_sets system:*)": len(full["systems"]),
                "techniques.*.hub (== key without /attacker)": len(full["techniques"]),
                "label_sets.techniques[name-token:*] (== inverse of techniques.*.name_tokens)": len(dropped_labels)}},
    })
    audit_slim(full, out)
    return out


def audit_slim(full: dict, slim: dict) -> dict:
    """The slim artifact is a PROJECTION: every kept value equals the full build's."""
    require(slim["lexicon"] == full["lexicon"] and slim["class_counts"] == full["class_counts"], "SLIM_LEXICON_DRIFT")
    require(set(slim["techniques"]) == set(full["techniques"]), "SLIM_TECHNIQUE_SET")
    classes = 0
    for key, record in slim["techniques"].items():
        node = full["techniques"][key]
        require(key == node["hub"] + "/attacker", f"SLIM_HUB_KEY: {key}")
        require(record["origin_role_node"] == f"{node['fromPositionId']}/{node['fromRole']}", f"SLIM_ORIGIN: {key}")
        require(("body_region" in record) == ("body_region" in node), f"SLIM_CLASS_PRESENCE: {key}")
        if "body_region" in record:
            require(record["body_region"]["class"] == node["body_region"]["class"], f"SLIM_CLASS: {key}")
            classes += 1
    kept = 0
    for scope, sets in slim["label_sets"].items():
        for key, label in sets.items():
            require(label == full["label_sets"][scope][key], f"SLIM_LABEL: {scope}:{key}")
            kept += 1
    rebuilt = defaultdict(set)
    for key, record in slim["techniques"].items():
        for token in record["name_tokens"]:
            rebuilt[token].add(key)
    for key, label in full["label_sets"]["techniques"].items():
        if key.startswith("name-token:"):
            require(set(label["nodes"]) == rebuilt[key.split(":", 1)[1]], f"SLIM_TOKEN_INDEX: {key}")
    require(set(slim["systems"]) == set(full["systems"]), "SLIM_SYSTEM_SET")
    for key, system in slim["systems"].items():
        whole = full["systems"][key]["joined_sets"]
        for scope, ids in whole.items():
            got = (slim["label_sets"][scope][f"system:{key}"]["nodes"] if scope in SLIM_SYSTEM_SCOPES_IN_LABELS
                   else system["joined_sets"][scope])
            require(got == ids, f"SLIM_SYSTEM: {key}: {scope}")
    require(classes == sum(full["class_counts"].values()) and classes > 0, "SLIM_CLASS_COVERAGE")
    return {"classes_checked": classes, "label_sets_checked": kept}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--graph", type=Path, default=ROOT / "graph.json")
    parser.add_argument("--output", type=Path, default=ROOT / "tests/artifacts/semantics/vocabulary.json")
    parser.add_argument("--selfcheck", action="store_true", help="Check synthetic known-answer fixtures before reading real data.")
    parser.add_argument("--full-out", type=Path, help="Also write the FULL build (~4.4 MB) here; refused under tests/artifacts/.")
    parser.add_argument("--survey", action="store_true", help="Also build the separately sourced content survey.")
    parser.add_argument("--survey-out", type=Path, help="Where the survey (~23 MB) goes; required with --survey, refused under tests/artifacts/.")
    args = parser.parse_args()
    try:
        # Cheap and always first: methods meet known-answer checks before real data.
        checked = selfcheck()
        if args.survey and args.survey_out is None:
            raise ValueError("SURVEY_OUT_REQUIRED: the survey is ~23 MB and never goes to the committed artifact dir; pass --survey-out <scratch path>")
        for path, what in ((args.full_out, "full build"), (args.survey_out, "survey")):
            if path is not None:
                refuse_committed_path(path, what)
        raw = args.graph.read_bytes()
        graph = json.loads(raw)
        result = build_vocabulary(graph)
        result["extraction_audit"] = audit_vocabulary(graph, result)
        result["source_sha256"] = hashlib.sha256(raw).hexdigest()
        result["selfcheck"] = checked
        result["recompute"] = "python3 -B scripts/semantics/vocabulary.py --selfcheck --full-out <path>" if args.graph == ROOT / "graph.json" else f"python3 -B scripts/semantics/vocabulary.py --selfcheck --graph {args.graph} --full-out <path>"
        print("vocabulary coverage: " + json.dumps(result["coverage"], sort_keys=True))
        print("coverage floors: " + json.dumps(FLOORS, sort_keys=True))
        print("submission attacker classes (type + targetArea): " + json.dumps(result["class_counts"], sort_keys=True))
        print("independent extraction audit: " + json.dumps(result["extraction_audit"], sort_keys=True))
        for key, system in result["systems"].items():
            print(f"system {key}: examined={system['member_count']} joined={system['joined_count']} unresolved={system['unresolved_count']}")
        supplement = None
        if args.survey:
            supplement = survey_content(graph)
            supplement["graph_sha256"] = result["source_sha256"]
            supplement["recompute"] = "python3 -B scripts/semantics/vocabulary.py --selfcheck --survey --survey-out <path>"
            print("survey coverage: " + json.dumps(supplement["coverage"], sort_keys=True))
            print("survey reference joins: " + json.dumps(supplement["field_join_counts"], sort_keys=True))
        dump = full_bytes(result)
        slim = slim_vocabulary(result, dump)
        slim["recompute"] = "python3 -B scripts/semantics/vocabulary.py --selfcheck" if args.graph == ROOT / "graph.json" else f"python3 -B scripts/semantics/vocabulary.py --selfcheck --graph {args.graph}"
        # The N1 key source_sha256 stays the graph.json string that readers take as the graph hash; this
        # script's own hash sits beside it, keyed by its repo path, so a stale METHOD shows too. Slim only:
        # the full build (and so full_build_sha256) does not carry it.
        me = Path(__file__).resolve()
        slim["producer_sha256"] = {me.relative_to(ROOT).as_posix(): hashlib.sha256(me.read_bytes()).hexdigest()}
        require(all((ROOT / k).is_file() for k in slim["producer_sha256"]), "PRODUCER_PATH_UNRESOLVED")
        # Do not emit half a successful run if a requested supplement failed.
        size = write_compact(args.output, slim)
        print(f"wrote {args.output} ({size} bytes, budget {ARTIFACT_BUDGET_BYTES}; slim projection of a "
              f"{len(dump)}-byte full build, sha256 {slim['slimming']['full_build_sha256']})")
        print("slim omissions: " + json.dumps(slim["slimming"]["omitted"], sort_keys=True))
        if args.full_out is not None:
            args.full_out.parent.mkdir(parents=True, exist_ok=True)
            args.full_out.write_bytes(dump)
            print(f"wrote {args.full_out} ({len(dump)} bytes)")
        if supplement is not None:
            write_json(args.survey_out, supplement)
            print(f"wrote {args.survey_out}")
        return 0
    except (ValueError, KeyError) as exc:
        print(f"vocabulary refused: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    # This research lane must not create unowned __pycache__ files while importing
    # the existing slug/emitter identity helpers.
    raise SystemExit(main())
