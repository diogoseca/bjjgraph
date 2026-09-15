#!/usr/bin/env python3
"""
BJJ Graph Connection Exploder
================================
Bidirectional graph consistency enforcer. No LLM required.
Modifies JSON files in-place to fix orphans and connectivity gaps.

Four phases:
1. INDEX  — build bidirectional graph from all JSON
2. DIAGNOSE — orphaned positions, orphaned transitions, forward mismatches, low connectivity
3. PLAN   — generate fix actions (add_ref, create_stub, create_file)
4. APPLY  — execute fixes in-place, write report

Usage:
    python3 scripts/explode_graph_connections.py              # full run
    python3 scripts/explode_graph_connections.py --diagnose   # report only
    python3 scripts/explode_graph_connections.py --dry-run    # show planned actions
"""

import argparse
import json
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parent))  # make the shared helper importable
from _atomic_io import atomic_write_json
from _ruleset import reduce_to_scalar, as_map, RULESETS  # {gi,nogi} contract (calibration-v2)
from _prob_norm import largest_remainder_round

CONTENT_PATH = Path("content")
POSITIONS_PATH = CONTENT_PATH / "Positions"
TRANSITIONS_PATH = CONTENT_PATH / "Transitions"
SUBMISSIONS_PATH = CONTENT_PATH / "Submissions"
REPORT_PATH = Path("tests/artifacts/explode_report.json")


def load_json(path):
    """Diagnostic load: divergent {gi,nogi} maps reduce to the no-gi headline frame
    (bare reduce_to_scalar would raise on real divergence, Q3+). NEVER save data
    loaded through here — use load_json_raw for any mutate-then-write path."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return reduce_to_scalar(json.load(f), frame="nogi")
    except Exception as e:
        print(f"  WARNING: Could not load {path}: {e}", file=sys.stderr)
        return None


def load_json_raw(path):
    """Raw load (maps intact) — required before mutating + saving, else a divergent
    {gi,nogi} map would be flattened to one frame and the other frame destroyed."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  WARNING: Could not load {path}: {e}", file=sys.stderr)
        return None


def save_json(path, data):
    atomic_write_json(path, data, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Phase 1: INDEX
# ---------------------------------------------------------------------------

def build_graph_index():
    """Build bidirectional graph from all JSON files."""
    positions = {}     # name -> {path, roles, transitions_out}
    transitions = {}   # name -> {path, from_position, outcomes}
    submissions = {}   # name -> {path, from_position, outcomes}

    # Index positions
    for path in sorted(POSITIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data or not data.get("name"):
            continue
        name = data["name"]
        roles = []
        transitions_out = []

        for role in ["top", "bottom"]:
            if role in data:
                roles.append(role)
                for t in data[role].get("transitions", []):
                    transitions_out.append({
                        "transition": t.get("transition", ""),
                        "role": role,
                        # `, 0` survives here deliberately: this index is DIAGNOSTIC only. Nothing
                        # reads this field arithmetically — Phase 2 reads t_out["transition"] and
                        # len(transitions_out), and nothing else (grep "transitions_out" in this file)
                        # — and the value has already been through load_json's
                        # reduce_to_scalar(frame="nogi"), so a nulled no-gi cell arrives here as None
                        # whatever this default says. It fires only on a MISSING key: 0 of 5,086 cells.
                        "attempt_probability": t.get("attempt_probability", 0),
                    })

        # Neutral positions
        if "transitions" in data and "top" not in data:
            roles.append("neutral")
            for t in data["transitions"]:
                transitions_out.append({
                    "transition": t.get("transition", ""),
                    "role": "neutral",
                    # `, 0` survives here deliberately: this index is DIAGNOSTIC only. Nothing
                    # reads this field arithmetically — Phase 2 reads t_out["transition"] and
                    # len(transitions_out), and nothing else (grep "transitions_out" in this file)
                    # — and the value has already been through load_json's
                    # reduce_to_scalar(frame="nogi"), so a nulled no-gi cell arrives here as None
                    # whatever this default says. It fires only on a MISSING key: 0 of 5,086 cells.
                    "attempt_probability": t.get("attempt_probability", 0),
                })

        related = data.get("related_positions", data.get("related_content", []))

        positions[name] = {
            "path": str(path),
            "roles": roles,
            "transitions_out": transitions_out,
            "related": related,
        }

    # Index transitions
    for path in sorted(TRANSITIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data or not data.get("name"):
            continue
        name = data["name"]
        transitions[name] = {
            "path": str(path),
            "from_position": data.get("from_position", ""),
            "outcomes": data.get("outcomes", []),
        }

    # Index submissions (include family hubs for reference resolution)
    for path in sorted(SUBMISSIONS_PATH.rglob("*.json")):
        data = load_json(path)
        if not data or not data.get("name"):
            continue
        name = data["name"]
        submissions[name] = {
            "path": str(path),
            "from_position": data.get("from_position", ""),
            "outcomes": data.get("outcomes", []),
            "is_family": data.get("is_family", False),
        }

    return positions, transitions, submissions


# ---------------------------------------------------------------------------
# Phase 2: DIAGNOSE
# ---------------------------------------------------------------------------

def diagnose(positions, transitions, submissions):
    """Find all graph inconsistencies."""
    issues = []

    # All transitions referenced by positions
    referenced_transitions = set()
    for pos_name, pos_data in positions.items():
        for t_out in pos_data["transitions_out"]:
            referenced_transitions.add(t_out["transition"])

    transition_names = set(transitions.keys())
    submission_names = set(submissions.keys())
    position_names = set(positions.keys())

    # Orphaned transitions (file exists, not referenced by any position)
    orphaned_transitions = transition_names - referenced_transitions
    for name in sorted(orphaned_transitions):
        issues.append({
            "type": "orphaned_transition",
            "name": name,
            "file": transitions[name]["path"],
            "from_position": transitions[name]["from_position"],
        })

    # Missing transitions (referenced but no file)
    missing_transitions = referenced_transitions - transition_names - submission_names
    for name in sorted(missing_transitions):
        issues.append({
            "type": "missing_transition",
            "name": name,
        })

    # Orphaned positions (not reachable from any transition outcome or from_position)
    reachable = {"Standing Position"}
    for t_name, t_data in {**transitions, **submissions}.items():
        from_pos = t_data["from_position"]
        if from_pos:
            base = from_pos.split("/")[0]
            reachable.add(base)
        for outcome in t_data["outcomes"]:
            to_pos = outcome.get("to", "")
            if to_pos and to_pos.lower() != "game-over":
                base = to_pos.split("/")[0]
                reachable.add(base)
                # Outcomes pointing to submissions are valid targets
                if base in submission_names:
                    reachable.add(base)

    orphaned_positions = position_names - reachable
    for name in sorted(orphaned_positions):
        issues.append({
            "type": "orphaned_position",
            "name": name,
            "file": positions[name]["path"],
            "related": positions[name]["related"],
        })

    # Low connectivity (< 3 connections)
    connection_counts = defaultdict(int)
    for pos_name, pos_data in positions.items():
        connection_counts[pos_name] += len(pos_data["transitions_out"])
    for t_data in {**transitions, **submissions}.values():
        for outcome in t_data["outcomes"]:
            to_pos = outcome.get("to", "")
            if to_pos and to_pos.lower() != "game-over":
                base = to_pos.split("/")[0]
                connection_counts[base] += 1

    for pos_name in sorted(position_names):
        count = connection_counts.get(pos_name, 0)
        if count < 3:
            issues.append({
                "type": "low_connectivity",
                "name": pos_name,
                "connections": count,
            })

    # Missing files (outcome targets that don't exist as positions or submissions)
    all_known_targets = position_names | submission_names | transition_names
    for t_name, t_data in {**transitions, **submissions}.items():
        for outcome in t_data["outcomes"]:
            to_pos = outcome.get("to", "")
            if not to_pos or to_pos.lower() == "game-over" or to_pos == "TODO":
                continue
            base = to_pos.split("/")[0]
            if base not in all_known_targets:
                issues.append({
                    "type": "missing_position",
                    "name": base,
                    "referenced_by": t_name,
                    "file": t_data["path"],
                })

    return issues


# ---------------------------------------------------------------------------
# Phase 3: PLAN
# ---------------------------------------------------------------------------

def plan_fixes(issues, positions, transitions):
    """Generate fix actions from diagnosed issues."""
    actions = []

    for issue in issues:
        if issue["type"] == "orphaned_position":
            # Score related_positions to find best parent
            related = issue.get("related", [])
            best_parent = None
            best_score = 0
            relationship_scores = {
                "parent": 10, "base": 9, "primary": 8,
                "entry": 7, "precursor": 6, "related": 5,
                "variant": 4, "alternative": 3, "similar": 2,
            }
            for rel in related:
                rel_name = rel.get("name", "") if isinstance(rel, dict) else str(rel)
                relationship = rel.get("relationship", "") if isinstance(rel, dict) else ""
                score = 0
                for keyword, points in relationship_scores.items():
                    if keyword in relationship.lower():
                        score = max(score, points)
                if score > best_score and rel_name in positions:
                    best_score = score
                    best_parent = rel_name

            if best_parent:
                actions.append({
                    "action": "create_stub",
                    "type": "transition",
                    "name": f"Transition to {issue['name']}",
                    "from_position": f"{best_parent}/Top",
                    "to_position": f"{issue['name']}/Top",
                    "reason": f"Orphan resolution: connect '{issue['name']}' via parent '{best_parent}'",
                })
            else:
                actions.append({
                    "action": "create_stub",
                    "type": "transition",
                    "name": f"Transition to {issue['name']}",
                    "from_position": "Standing Position",
                    "to_position": f"{issue['name']}/Top",
                    "reason": f"Orphan resolution: connect '{issue['name']}' from Standing (no parent found)",
                })

        elif issue["type"] == "orphaned_transition":
            # Add reference to the from_position's transitions array
            from_pos = issue.get("from_position", "")
            base_pos = from_pos.split("/")[0] if "/" in from_pos else from_pos
            role = from_pos.split("/")[1].lower() if "/" in from_pos else "top"

            if base_pos and base_pos in positions:
                actions.append({
                    "action": "add_ref",
                    "position": base_pos,
                    "role": role,
                    "transition": issue["name"],
                    "reason": f"Connect orphaned transition '{issue['name']}' to {base_pos}/{role}",
                })

    return actions


# ---------------------------------------------------------------------------
# Phase 4: APPLY
# ---------------------------------------------------------------------------

def renormalize_probabilities(transitions_array):
    """Renormalize probabilities after appending a new entry (last element), PER FRAME.

    New entry gets min(existing)/2, floored to 1%, per ruleset; existing entries
    scale proportionally with largest-remainder rounding so each frame sums to 100.
    Accepts legacy scalar or {gi,nogi} map values; always writes maps back.

    Returns the per-frame coverage record ``{"scaled": [...], "absent": [...],
    "allzero": [...], "skipped_cells": <int>}`` — every frame this function looked at
    lands in exactly one of the first three, so the caller can print a POSITIVE count and
    refuse a run that renormalized nothing (CLAUDE.md §6.6). The old signature returned
    None and printed nothing, so a frame that was skipped and a frame that was never
    reached produced identical output.

    ``skipped_cells`` is the count of null cells this call EXCLUDED from a distribution it
    still scaled — the mixed case, where the frame exists but some of its edges do not. It
    is separate from ``absent`` (a frame with no live cell at all) because that is the only
    one of the two the caller can see from the other keys, and because the mixed case is
    the common one: a role with 2 nulls among 13 live cells rescales the other 11 and the
    two nulls silently do not participate. §6.6 says a skip path PRINTS, and "scaled every
    cell" must not read the same as "scaled the cells that were left".

    THE NULL CONTRACT (scripts/_ruleset.py). A ``null`` cell means "this edge does not
    exist in that ruleset", which is NOT ``0`` ("exists, ~never attempted"). A null must
    therefore never be summed, never be scaled, and never be the target of a positional
    write-back. The pre-null code did all three: ``.get(rs) or 0`` coerced a null into the
    arithmetic on the loop's first line, and ``zip(existing, scaled)`` then wrote the
    scaler's integer straight back into the cell that coercion had invented. Measured on
    a Lapel Guard TOP fixture with its two ``nogi: 0`` cells nulled and one entry
    appended: ``{'gi': 15, 'nogi': None}`` -> ``{'gi': 14, 'nogi': 0}`` and
    ``{'gi': 10, 'nogi': None}`` -> ``{'gi': 10, 'nogi': 0}``. Both frames still summed to
    exactly 100 afterwards, so validate:graph agreed — and this script runs THIRD in
    ``npm run regenerate``, ahead of that gate, so the resurrection was laundered through
    it. Hence the ``live`` partition below: it carries (transition, cell) pairs so the
    write-back is keyed to the cell whose value was actually read, and there is no
    "skip the nulls" branch left for a later reader to forget.
    """
    if len(transitions_array) < 2:
        # A first-and-only edge OWNS its role's whole distribution, so it has to say so.
        # This used to be reachable-but-harmless: the caller seeded {gi:0, nogi:0} and a
        # lone {0,0} entry made validate_graph_integrity ERROR LOUDLY on a frame summing
        # to 0. Once the caller seeds nulls instead (see add_ref), a lone {None,None}
        # entry makes present_rulesets() read [] — the role has no frames, so NO per-frame
        # sum check runs on it at all and the gate goes quietly green on an edge that
        # exists in no ruleset. Loud wrong -> silent wrong is the worst trade in this repo,
        # so write the only value that is both well-formed and checkable.
        # UNREACHABLE TODAY: 0 of 272 role containers in content/Positions have an empty
        # transitions array, so nothing takes this branch on the current corpus. Recount
        # before quoting that (§6.9):
        #   python3 -c "import json,glob;print(sum(1 for p in glob.glob('content/Positions/**/*.json',recursive=True) for d in [json.load(open(p))] for c in [d.get('top'),d.get('bottom'),d] if isinstance(c,dict) and isinstance(c.get('transitions'),list) and not c['transitions']))"
        if len(transitions_array) == 1:
            transitions_array[0]["attempt_probability"] = {rs: 100 for rs in RULESETS}
            print("  renormalize: sole transition in this role — set to 100 in both frames "
                  "(no distribution to scale against)")
            return {"scaled": list(RULESETS), "absent": [], "allzero": [], "skipped_cells": 0}
        return {"scaled": [], "absent": [], "allzero": [], "skipped_cells": 0}

    existing = transitions_array[:-1]
    new_entry = transitions_array[-1]

    for t in transitions_array:
        # No `, 0` default: a MISSING attempt_probability asserts nothing, and as_map(0)
        # would turn that silence into "this edge exists in both rulesets and is never
        # attempted". as_map(None) is {gi:None, nogi:None} — unasserted, which is honest.
        # Zero instances today (0 of 5,086 cells in content/Positions lack the key), so
        # this is a contract fix on a dormant path, not a change to any current output.
        t["attempt_probability"] = as_map(t.get("attempt_probability"))

    scaled_frames, absent_frames, allzero_frames = [], [], []
    skipped_cells = 0   # null cells excluded from a frame that was still scaled

    for rs in RULESETS:
        cells = [(t, t["attempt_probability"].get(rs)) for t in existing]
        live = [(t, c) for t, c in cells if c is not None]

        if not live:
            # The role has no edges at all in this ruleset. A new edge cannot exist in a
            # frame the role it hangs off does not have, so the new entry stays null here.
            absent_frames.append(rs)
            new_entry["attempt_probability"][rs] = None
            print(f"  renormalize: frame '{rs}' absent for this role "
                  f"({len(cells)} null cells) — new edge nulled too")
            continue

        probs = [c for _, c in live]
        if not any(probs):
            # Every live cell is a real, authored 0: there is no distribution to scale
            # (and `p / total` would divide by zero). Distinct from `not live` above, and
            # keeping the two apart is the whole point of the contract — the pre-null code
            # collapsed both into one silent `continue` and could not tell them apart.
            #
            # The new edge gets 0, NOT null, and the difference is the whole ABSENT-vs-ZERO
            # distinction this file is about: the frame EXISTS here (its cells are 0, and 0
            # is available), so an edge inside it exists too, at 0% — whereas in the `not
            # live` branch above the frame does not exist at all and the new edge must not
            # either. Writing None here would say "this edge is unavailable in a ruleset
            # where every sibling edge is available", which no input asserted; it would also
            # be a gratuitous divergence from the pre-null behaviour on a frame that has no
            # nulls in it. (An all-zero frame sums to 0 and validate_graph_integrity fails
            # it either way — this branch chooses which KIND of wrong the exploder hands the
            # gate, and 0 is the loud one.)
            allzero_frames.append(rs)
            skipped_cells += len(cells) - len(live)
            new_entry["attempt_probability"][rs] = 0
            print(f"  renormalize: frame '{rs}' all-zero over {len(live)} live cells "
                  f"({len(cells) - len(live)} null) — nothing to scale, new edge set to 0")
            continue

        if len(live) < len(cells):
            # The mixed case, and the one this function is most often in: the frame exists,
            # but some of its edges do not. Those cells are out of `total`, out of the
            # largest-remainder split and out of the zip that writes the result back — so
            # nothing about them is inferable from the numbers that come out. Say it, or
            # "renormalized the whole frame" and "renormalized what was left of it" print
            # the same line (§6.6).
            skipped_cells += len(cells) - len(live)
            print(f"  renormalize: frame '{rs}' — {len(cells) - len(live)} of {len(cells)} "
                  f"cells absent (null); scaling the remaining {len(live)}")
        smallest = min(p for p in probs if p > 0)
        new_prob = max(1, int(smallest) // 2)
        target = 100 - new_prob
        total = sum(probs)
        scaled = largest_remainder_round([p / total * target for p in probs], target)
        for (t, _), v in zip(live, scaled):
            t["attempt_probability"][rs] = v
        new_entry["attempt_probability"][rs] = new_prob
        scaled_frames.append(rs)

    return {"scaled": scaled_frames, "absent": absent_frames, "allzero": allzero_frames,
            "skipped_cells": skipped_cells}


def apply_actions(actions, positions, transitions, dry_run=False):
    """Execute planned fix actions."""
    results = []

    for action in actions:
        if action["action"] == "add_ref":
            pos_name = action["position"]
            role = action["role"]
            transition_name = action["transition"]

            if pos_name not in positions:
                results.append({"action": action, "status": "skip", "reason": "position not found"})
                continue

            pos_path = Path(positions[pos_name]["path"])
            data = load_json_raw(pos_path)  # raw: this path mutates + saves
            if not data:
                results.append({"action": action, "status": "skip", "reason": "could not load"})
                continue

            # Find the right transitions array
            if role in ("top", "bottom") and role in data:
                trans_array = data[role].get("transitions", [])
            elif "transitions" in data and role == "neutral":
                trans_array = data["transitions"]
            else:
                results.append({"action": action, "status": "skip", "reason": f"role '{role}' not found"})
                continue

            # Check if already referenced
            existing = {t.get("transition", "") for t in trans_array}
            if transition_name in existing:
                results.append({"action": action, "status": "skip", "reason": "already referenced"})
                continue

            # Add new reference (probability set by renormalize). Seed with NULLS, not
            # zeros: under the null contract a 0 claims "this edge exists in this ruleset
            # and is ~never attempted", which is a claim this code has no basis to make
            # about an edge it is inventing. renormalize_probabilities fills in one cell
            # per frame the role actually has and leaves the rest None. The old {gi:0,
            # nogi:0} seed MINTED a cell in frames the role does not have — measured on a
            # Lapel Guard bottom fixture with all 11 nogi cells nulled, the appended entry
            # came out {'gi': 2, 'nogi': 0}: a no-gi edge in a role with no no-gi edges,
            # inherited straight from this literal because the frame loop skipped it.
            # SURVIVING MUTANT, recorded here so nobody later reads this line as covered
            # (CLAUDE.md §6.3): flipping this seed back to {"gi": 0, "nogi": 0} turns NO
            # claim red. It is unobservable by construction now — every branch of
            # renormalize_probabilities writes this entry's cell explicitly (a number when
            # the frame scales, 0 when the frame is all-zero, None when the frame is
            # absent), so the seed is belt-and-braces, not the fix. Keep it null anyway: a
            # branch added later that forgets to write leaves "unasserted" behind instead
            # of "exists in both rulesets at 0%", and unasserted is the safe default.
            new_entry = {"transition": transition_name,
                         "attempt_probability": {rs: None for rs in RULESETS}}
            trans_array.append(new_entry)
            coverage = renormalize_probabilities(trans_array)

            if not dry_run:
                save_json(pos_path, data)

            results.append({
                "action": action,
                "status": "applied" if not dry_run else "dry_run",
                "file": str(pos_path),
                "renormalized": coverage,
            })

        elif action["action"] == "create_stub":
            name = action["name"]
            stub_path = TRANSITIONS_PATH / f"{name}.json"

            if stub_path.exists():
                results.append({"action": action, "status": "skip", "reason": "file already exists"})
                continue

            from_pos = action.get("from_position", "")
            to_pos = action.get("to_position", "TODO")
            failure_pos = from_pos if "/" in from_pos else f"{from_pos}/Top"

            stub = {
                "name": name,
                "description": f"TODO: Add description for {name} - must be 140-180 characters for SEO meta description validation requirements here.",
                "tags": ["bjj", "technique", "TODO"],
                "from_position": from_pos,
                # {gi,nogi} maps, not bare scalars. Every forked probability in the corpus
                # is a map (calibration-v2, scripts/_ruleset.py); this stub emitted legacy
                # scalars and got away with it only because `npm run regenerate` happens to
                # run migrate:ruleset immediately after this script, which mirrors them
                # into exactly these maps. That is a schedule, not a contract: run the
                # exploder alone (or under --strict-ruleset) and the stub is off-contract
                # the moment it lands. A mirrored pair is the honest seed for a TODO stub —
                # it asserts the edge exists in both rulesets, which is what an unreviewed
                # placeholder means; a null would assert the opposite, that it exists in
                # neither, and no human has said that yet.
                "outcomes": [
                    {"to": to_pos, "probability": {"gi": 70, "nogi": 70}, "result": "success"},
                    {"to": failure_pos, "probability": {"gi": 20, "nogi": 20}, "result": "failure"},
                    {"to": "TODO", "probability": {"gi": 10, "nogi": 10}, "result": "counter"},
                ],
                "success_rate": {"gi": 50, "nogi": 50},
                "overview": "TODO" * 100,
                "related_content": [
                    {"name": "TODO", "relationship": "TODO"},
                    {"name": "TODO", "relationship": "TODO"},
                    {"name": "TODO", "relationship": "TODO"},
                ],
                "attacker": {
                    "name": f"{name} Attacker",
                    "description": f"How to execute {name} in BJJ.",
                    "overview": "TODO" * 50,
                    "key_principles": ["TODO"] * 5,
                    "setup_requirements": ["TODO"] * 4,
                    "execution_steps": [
                        {"step_number": i, "action": "TODO", "description": "TODO" * 13}
                        for i in range(1, 7)
                    ],
                    "common_counters": [
                        {"counter": "TODO", "effectiveness": "Medium", "targets_outcome": "TODO"}
                        for _ in range(3)
                    ],
                    "common_errors": [
                        {"error": "TODO", "consequence": "TODO", "correction": "TODO"}
                        for _ in range(5)
                    ],
                    "training_progressions": [
                        {"phase": "TODO", "focus": "TODO", "description": "TODO"}
                        for _ in range(4)
                    ],
                    "flashcards": [
                        {"question": "TODO?", "answer": "TODO" * 13}
                        for _ in range(5)
                    ],
                    "safety_considerations": "TODO" * 25,
                },
                "defender": {
                    "name": f"{name} Defender",
                    "description": f"How to defend against {name} in BJJ.",
                    "overview": "TODO" * 50,
                    "key_principles": ["TODO"] * 5,
                    "recognition_cues": ["TODO"] * 3,
                    "defensive_options": [
                        {"action": "TODO", "when_to_use": "TODO", "targets_outcome": "TODO"}
                        for _ in range(3)
                    ],
                    "favorable_outcomes": [{"outcome": "TODO", "how": "TODO"}],
                    "common_errors": [
                        {"error": "TODO", "consequence": "TODO", "correction": "TODO"}
                        for _ in range(3)
                    ],
                    "flashcards": [
                        {"question": "TODO?", "answer": "TODO" * 13}
                        for _ in range(3)
                    ],
                    "training_progressions": [
                        {"phase": "TODO", "focus": "TODO", "description": "TODO"}
                        for _ in range(3)
                    ],
                },
            }

            if not dry_run:
                save_json(stub_path, stub)

            results.append({
                "action": action,
                "status": "created" if not dry_run else "dry_run",
                "file": str(stub_path),
            })

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="BJJ Graph Connection Exploder — bidirectional consistency enforcer"
    )
    parser.add_argument("--diagnose", action="store_true", help="Report only, no fixes")
    parser.add_argument("--dry-run", action="store_true", help="Show planned actions without applying")
    args = parser.parse_args()

    print("=" * 70)
    print("BJJ GRAPH CONNECTION EXPLODER")
    print("=" * 70)

    # Phase 1: INDEX
    print("\n[1/4] Building graph index...")
    positions, transitions, submissions = build_graph_index()
    print(f"  Positions: {len(positions)}")
    print(f"  Transitions: {len(transitions)}")
    print(f"  Submissions: {len(submissions)}")

    # Phase 2: DIAGNOSE
    print("\n[2/4] Diagnosing issues...")
    issues = diagnose(positions, transitions, submissions)

    by_type = defaultdict(list)
    for issue in issues:
        by_type[issue["type"]].append(issue)

    print(f"  Orphaned transitions: {len(by_type['orphaned_transition'])}")
    print(f"  Missing transitions: {len(by_type['missing_transition'])}")
    print(f"  Orphaned positions: {len(by_type['orphaned_position'])}")
    print(f"  Low connectivity: {len(by_type['low_connectivity'])}")
    print(f"  Missing positions: {len(by_type['missing_position'])}")

    if args.diagnose:
        # Print details and exit
        for issue_type, items in sorted(by_type.items()):
            print(f"\n--- {issue_type.upper()} ({len(items)}) ---")
            for item in items[:30]:
                print(f"  {item.get('name', '?')}: {item}")
            if len(items) > 30:
                print(f"  ... and {len(items) - 30} more")
        return 0

    # Phase 3: PLAN
    print("\n[3/4] Planning fixes...")
    actions = plan_fixes(issues, positions, transitions)
    print(f"  Planned actions: {len(actions)}")
    for action in actions[:10]:
        print(f"    {action['action']}: {action.get('name', action.get('transition', '?'))}")
    if len(actions) > 10:
        print(f"    ... and {len(actions) - 10} more")

    if args.dry_run:
        print("\n[DRY RUN] No changes made.")
        return 0

    # Phase 4: APPLY
    print("\n[4/4] Applying fixes...")
    results = apply_actions(actions, positions, transitions, dry_run=False)

    applied = [r for r in results if r["status"] == "applied" or r["status"] == "created"]
    skipped = [r for r in results if r["status"] == "skip"]
    print(f"  Applied: {len(applied)}")
    print(f"  Skipped: {len(skipped)}")

    # §6.6 positive coverage for the null contract. Every add_ref renormalizes at least one
    # frame or the edge it just appended exists in no ruleset at all, so print the tally
    # every run and hard-fail on a zero that had work to do. Without this, "renormalized
    # every frame" and "silently skipped every frame" printed the same two lines above.
    renorms = [r["renormalized"] for r in results if r.get("renormalized")]
    fr_scaled = sum(len(c["scaled"]) for c in renorms)
    fr_absent = sum(len(c["absent"]) for c in renorms)
    fr_allzero = sum(len(c["allzero"]) for c in renorms)
    fr_skipped = sum(c.get("skipped_cells", 0) for c in renorms)
    print(f"  Frames renormalized: {fr_scaled}  "
          f"(absent: {fr_absent}  all-zero: {fr_allzero}  "
          f"null cells excluded from a scaled frame: {fr_skipped}  "
          f"over {len(renorms)} add_ref)")
    null_contract_failed = bool(renorms) and not fr_scaled
    if null_contract_failed:
        print("ERROR: every add_ref renormalized 0 frames — the appended edges live in no "
              "ruleset. Refusing to report success on a corpus write that asserted nothing.",
              file=sys.stderr)

    # Save report
    report = {
        "issues": issues,
        "actions": actions,
        "results": results,
        "summary": {
            "issues_found": len(issues),
            "actions_planned": len(actions),
            "applied": len(applied),
            "skipped": len(skipped),
            # the null-contract coverage, banked in the artifact as well as printed, so a
            # later reader can tell a run that scaled nothing from a run with nothing to do
            "frames_scaled": fr_scaled,
            "frames_absent": fr_absent,
            "frames_all_zero": fr_allzero,
            "null_cells_excluded": fr_skipped,
        },
    }

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nReport saved to: {REPORT_PATH}")

    return 1 if null_contract_failed else 0


if __name__ == "__main__":
    sys.exit(main())
