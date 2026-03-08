#!/usr/bin/env python3
"""
BJJ Position Tree CSV Generator V2 (BJJ-Aware Diagnostics)
===========================================================
Reads the knowledge graph JSON and outputs a diagnostic CSV showing each
position/role with connectivity metrics, technique direction breakdown,
health scores, and role-aware flags.

Key improvement over V1: Uses point_value (not position_type) to classify
roles and determine what techniques each role SHOULD have. This eliminates
false positives like guard-passer roles flagged for missing submissions.

Output: tests/artifacts/position_tree.csv

Column Groups (14 columns):
  Identity:     role, position, pts
  Connectivity: t_out, s_out, inc, total_out, cross_sys
  Direction:    n_finish, n_advance, n_maintain, n_retreat
  Diagnostics:  health, flags

Sorting: health ASC (most broken first), inc DESC, role ASC

Usage:
    python3 scripts/generate_position_tree.py
    python3 scripts/generate_position_tree.py --stdout   # Print to stdout instead of file
"""

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

CONTENT_PATH = Path("content")
POSITIONS_PATH = CONTENT_PATH / "Positions"
TRANSITIONS_PATH = CONTENT_PATH / "Transitions"
SUBMISSIONS_PATH = CONTENT_PATH / "Submissions"
OUTPUT_PATH = Path("tests/artifacts/position_tree.csv")

FIELDNAMES = [
    "role", "position", "pts",
    "t_out", "s_out", "inc", "total_out", "cross_sys",
    "n_finish", "n_advance", "n_maintain", "n_retreat",
    "health", "flags",
]


def load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def build_position_roles():
    """Build dict of all position/role paths with metadata including point_value.

    Returns: {"Mount/Top": {"position": "Mount", "pts": 4}, ...}
    Also returns pts_map: {"Mount/Top": 4, "Mount/Bottom": -4, ...}
    """
    roles = {}
    pts_map = {}
    for path in sorted(POSITIONS_PATH.rglob("*.json")):
        if "TEMPLATE" in path.name:
            continue
        data = load_json(path)
        if not data or not data.get("name"):
            continue
        name = data["name"]
        root_sp = data.get("state_properties") or {}

        if data.get("top"):
            sp = data["top"].get("state_properties") or root_sp
            pts_raw = sp.get("point_value")
            pts = int(pts_raw) if pts_raw is not None and pts_raw != "TODO" else None
            role_key = f"{name}/Top"
            roles[role_key] = {"position": name, "pts": pts}
            if pts is not None:
                pts_map[role_key] = pts

        if data.get("bottom"):
            sp = data["bottom"].get("state_properties") or root_sp
            pts_raw = sp.get("point_value")
            pts = int(pts_raw) if pts_raw is not None and pts_raw != "TODO" else None
            role_key = f"{name}/Bottom"
            roles[role_key] = {"position": name, "pts": pts}
            if pts is not None:
                pts_map[role_key] = pts

        # If no top/bottom sections, add as bare position
        if not data.get("top") and not data.get("bottom"):
            pts_raw = root_sp.get("point_value")
            pts = int(pts_raw) if pts_raw is not None and pts_raw != "TODO" else None
            roles[name] = {"position": name, "pts": pts}
            if pts is not None:
                pts_map[name] = pts

    return roles, pts_map


def load_transitions():
    """Load all transitions with from_position and outcomes."""
    transitions = []
    for path in sorted(TRANSITIONS_PATH.rglob("*.json")):
        if "TEMPLATE" in path.name:
            continue
        data = load_json(path)
        if not data:
            continue
        name = data.get("name", path.stem)
        from_pos = data.get("from_position", "")
        outcomes = data.get("outcomes", [])
        if not from_pos or from_pos == "TODO":
            continue
        transitions.append({
            "name": name,
            "from_position": from_pos,
            "outcomes": outcomes,
        })
    return transitions


def load_submissions():
    """Load all submissions with from_position and outcomes."""
    submissions = []
    for path in sorted(SUBMISSIONS_PATH.rglob("*.json")):
        if "TEMPLATE" in path.name:
            continue
        data = load_json(path)
        if not data:
            continue
        name = data.get("name", path.stem)
        from_pos = data.get("from_position", "")
        starting_pos = data.get("starting_position", "")
        outcomes = data.get("outcomes", [])
        pos_field = from_pos
        if not pos_field or pos_field == "TODO":
            if starting_pos and starting_pos != "TODO":
                pos_field = f"{starting_pos}/Top"
            else:
                continue
        submissions.append({
            "name": name,
            "from_position": pos_field,
            "outcomes": outcomes,
        })
    return submissions


def classify_direction(from_role, outcomes, pts_map, sub_control_roles=None):
    """Classify a technique as finish/advance/maintain/retreat based on success outcome.

    Looks at the 'success' outcome's target point_value vs origin point_value.
    Transitions to submission control positions (those with game-over outcomes)
    are classified as 'advance' even if to_pts < from_pts.
    """
    if sub_control_roles is None:
        sub_control_roles = set()
    for o in outcomes:
        if o.get("result") == "success":
            to = o.get("to", "")
            if to == "game-over":
                return "finish"
            from_pts = pts_map.get(from_role)
            to_pts = pts_map.get(to)
            if from_pts is None or to_pts is None:
                return "maintain"
            if to_pts > from_pts:
                return "advance"
            elif to_pts < from_pts:
                if to in sub_control_roles:
                    return "advance"
                return "retreat"
            else:
                return "maintain"
    return "maintain"


def build_indices(transitions, submissions, pts_map, position_roles):
    """Build outgoing/incoming indices, cross-system connectivity, and direction counts.

    Returns: (trans_out, sub_out, incoming, cross_sys, direction_counts, sub_control_roles)
      - trans_out:  role -> set of transition names FROM this role
      - sub_out:    role -> set of submission names FROM this role
      - incoming:   role -> set of technique names leading TO this role
      - cross_sys:  role -> set of distinct base positions reachable (excl. self)
      - direction_counts: role -> Counter({finish: N, advance: N, maintain: N, retreat: N})
      - sub_control_roles: set of roles that have any outgoing edge to game-over
    """
    trans_out = defaultdict(set)
    sub_out = defaultdict(set)
    incoming = defaultdict(set)
    cross_sys = defaultdict(set)
    direction_counts = defaultdict(Counter)
    sub_control_roles = set()

    def _add_complementary_incoming(to, technique_name):
        """If to is 'X/Top', also add incoming edge to 'X/Bottom' and vice versa."""
        if "/" in to:
            base, role_suffix = to.rsplit("/", 1)
            if role_suffix in ("Top", "Bottom"):
                opposite = "Bottom" if role_suffix == "Top" else "Top"
                complementary = f"{base}/{opposite}"
                if complementary in position_roles:
                    incoming[complementary].add(technique_name)

    for t in transitions:
        fp = t["from_position"]
        trans_out[fp].add(t["name"])
        fp_base = fp.split("/")[0]
        for o in t.get("outcomes", []):
            to = o.get("to", "")
            if to == "game-over":
                sub_control_roles.add(fp)
            elif to:
                incoming[to].add(t["name"])
                _add_complementary_incoming(to, t["name"])
                to_base = to.split("/")[0]
                if to_base != fp_base:
                    cross_sys[fp].add(to_base)

    for s in submissions:
        fp = s["from_position"]
        sub_out[fp].add(s["name"])
        fp_base = fp.split("/")[0]
        for o in s.get("outcomes", []):
            to = o.get("to", "")
            if to == "game-over":
                sub_control_roles.add(fp)
            elif to:
                incoming[to].add(s["name"])
                _add_complementary_incoming(to, s["name"])
                to_base = to.split("/")[0]
                if to_base != fp_base:
                    cross_sys[fp].add(to_base)

    # Classify directions after sub_control_roles is fully built
    for t in transitions:
        fp = t["from_position"]
        direction = classify_direction(fp, t.get("outcomes", []), pts_map, sub_control_roles)
        direction_counts[fp][direction] += 1

    for s in submissions:
        fp = s["from_position"]
        direction = classify_direction(fp, s.get("outcomes", []), pts_map, sub_control_roles)
        direction_counts[fp][direction] += 1

    return trans_out, sub_out, incoming, cross_sys, direction_counts, sub_control_roles


def compute_health(total_out, inc, n_finish, n_advance, n_retreat, cross_sys_count, pts):
    """Compute composite health score 0-100 using point_value-based role expectations."""
    health = 0
    is_dominant = pts is not None and pts >= 2
    is_dominated = pts is not None and pts <= -2
    is_neutral = pts is not None and -1 <= pts <= 1

    # 1. Outgoing options (0-25 pts)
    if total_out >= 5:
        health += 25
    elif total_out >= 3:
        health += 15
    elif total_out >= 1:
        health += 5

    # 2. Incoming connections (0-20 pts)
    if inc >= 5:
        health += 20
    elif inc >= 1:
        health += 10

    # 3. Role-appropriate offense (0-20 pts)
    if is_dominant:
        if n_finish >= 3:
            health += 20
        elif n_finish >= 1:
            health += 10
    elif is_neutral:
        if n_advance >= 3:
            health += 20
        elif n_advance >= 1:
            health += 10
        elif n_finish >= 1:
            health += 10
    else:
        health += 20

    # 4. Role-appropriate defense (0-20 pts)
    if is_dominated:
        if n_advance >= 3:
            health += 20
        elif n_advance >= 1:
            health += 10
    else:
        health += 20

    # 5. Cross-system connectivity (0-15 pts)
    if cross_sys_count >= 5:
        health += 15
    elif cross_sys_count >= 2:
        health += 10
    elif cross_sys_count >= 1:
        health += 5

    return health


def compute_flags(total_out, inc, n_finish, n_advance, pts, role=""):
    """Compute role-aware diagnostic flags. Returns comma-separated string."""
    flags = []

    # Submission control bottoms: survival IS the goal, not advancement
    is_sub_control_bottom = role.endswith("/Bottom") and any(
        kw in role for kw in ["Control", "Lock", "Choke", "Trap"]
    )

    if total_out == 0 and inc > 0:
        flags.append("DEAD_END")
    if inc == 0 and total_out > 0:
        flags.append("ORPHAN")
    if pts is not None and pts >= 2 and n_finish == 0 and total_out > 0:
        flags.append("NEED_FINISH")
    if pts is not None and pts <= -2 and n_advance == 0 and inc >= 3:
        flags.append("NEED_ESCAPE")
    if (pts is not None and -1 <= pts <= 1 and n_advance == 0 and n_finish == 0
            and total_out > 0 and not is_sub_control_bottom):
        flags.append("NEED_ADVANCE")
    if 0 < total_out <= 2:
        flags.append("LOW_VARIETY")

    return ",".join(flags)


def generate_csv(position_roles, pts_map, trans_out, sub_out, incoming, cross_sys, direction_counts):
    """Generate CSV rows with 14 diagnostic columns."""
    all_roles = set(position_roles.keys())
    all_roles.update(trans_out.keys())
    all_roles.update(sub_out.keys())
    all_roles.update(incoming.keys())

    rows = []
    for role in all_roles:
        # Skip terminal state node — no diagnostic value
        if role in ("Game Over", "game-over"):
            continue

        meta = position_roles.get(role, {})
        pos_name = meta.get("position", role.split("/")[0]) if isinstance(meta, dict) else role.split("/")[0]
        pts = meta.get("pts") if isinstance(meta, dict) else pts_map.get(role)

        t_names = trans_out.get(role, set())
        s_names = sub_out.get(role, set())
        inc_names = incoming.get(role, set())
        cs = cross_sys.get(role, set())
        dc = direction_counts.get(role, Counter())

        t_out = len(t_names)
        s_out = len(s_names)
        inc_count = len(inc_names)
        total_out = t_out + s_out
        cross_sys_count = len(cs)

        n_finish = dc.get("finish", 0)
        n_advance = dc.get("advance", 0)
        n_maintain = dc.get("maintain", 0)
        n_retreat = dc.get("retreat", 0)

        health = compute_health(total_out, inc_count, n_finish, n_advance, n_retreat, cross_sys_count, pts)
        flags = compute_flags(total_out, inc_count, n_finish, n_advance, pts, role)

        rows.append({
            "role": role,
            "position": pos_name,
            "pts": pts if pts is not None else "?",
            "t_out": t_out,
            "s_out": s_out,
            "inc": inc_count,
            "total_out": total_out,
            "cross_sys": cross_sys_count,
            "n_finish": n_finish,
            "n_advance": n_advance,
            "n_maintain": n_maintain,
            "n_retreat": n_retreat,
            "health": health,
            "flags": flags,
        })

    rows.sort(key=lambda r: (r["health"], -r["inc"], r["role"]))
    return rows


def print_health_report(rows, num_transitions, num_submissions):
    """Print diagnostic summary to stderr."""
    err = sys.stderr
    total = len(rows)
    total_edges = num_transitions + num_submissions

    # Flag counts
    flag_names = ["DEAD_END", "ORPHAN", "NEED_FINISH", "NEED_ESCAPE", "NEED_ADVANCE", "LOW_VARIETY"]
    flag_counts = {f: 0 for f in flag_names}
    for r in rows:
        for f in r["flags"].split(","):
            f = f.strip()
            if f in flag_counts:
                flag_counts[f] += 1

    # Health distribution
    critical = sum(1 for r in rows if r["health"] < 25)
    poor = sum(1 for r in rows if 25 <= r["health"] < 50)
    fair = sum(1 for r in rows if 50 <= r["health"] < 75)
    good = sum(1 for r in rows if r["health"] >= 75)
    healths = sorted(r["health"] for r in rows)
    median = healths[len(healths) // 2] if healths else 0

    print(f"\n=== BJJ Graph Health Report (V2) ===", file=err)
    print(f"Nodes: {total} roles | Edges: {num_transitions}T + {num_submissions}S = {total_edges}", file=err)

    print(f"\n--- Flag Counts ---", file=err)
    print(f"DEAD_END:     {flag_counts['DEAD_END']} roles (total_out=0, inc>0)", file=err)
    print(f"ORPHAN:       {flag_counts['ORPHAN']} roles (inc=0, total_out>0)", file=err)
    print(f"NEED_FINISH:  {flag_counts['NEED_FINISH']} roles (pts>=2, 0 finishers)", file=err)
    print(f"NEED_ESCAPE:  {flag_counts['NEED_ESCAPE']} roles (pts<=-2, 0 escapes, inc>=3)", file=err)
    print(f"NEED_ADVANCE: {flag_counts['NEED_ADVANCE']} roles (pts neutral, 0 advances/finishers)", file=err)
    print(f"LOW_VARIETY:  {flag_counts['LOW_VARIETY']} roles (1-2 outgoing)", file=err)

    print(f"\n--- Health Distribution ---", file=err)
    print(f"0-24: {critical} critical | 25-49: {poor} poor | 50-74: {fair} fair | 75-100: {good} good", file=err)
    print(f"Median: {median}", file=err)

    print(f"\n--- Top 5 Most Urgent (lowest health, highest traffic) ---", file=err)
    for i, r in enumerate(rows[:5], 1):
        flag_str = r["flags"] if r["flags"] else "none"
        print(f"{i}. {r['role']}  health={r['health']}  inc={r['inc']}  out={r['total_out']}  flags={flag_str}", file=err)

    flagged = [r for r in rows if r["flags"]]
    flagged.sort(key=lambda r: -r["inc"])
    if flagged:
        print(f"\n--- Top 5 Highest-Traffic Flagged ---", file=err)
        for i, r in enumerate(flagged[:5], 1):
            print(f"{i}. {r['role']}  inc={r['inc']}  flags={r['flags']}", file=err)


def main():
    parser = argparse.ArgumentParser(
        description="Generate diagnostic position tree CSV with health scores and flags (V2)"
    )
    parser.add_argument("--stdout", action="store_true",
                        help="Print CSV to stdout instead of writing to file")
    args = parser.parse_args()

    # Load data
    print("Loading positions...", file=sys.stderr, flush=True)
    position_roles, pts_map = build_position_roles()
    print(f"  {len(position_roles)} position/role entries", file=sys.stderr)

    print("Loading transitions...", file=sys.stderr, flush=True)
    transitions = load_transitions()
    print(f"  {len(transitions)} transitions", file=sys.stderr)

    print("Loading submissions...", file=sys.stderr, flush=True)
    submissions = load_submissions()
    print(f"  {len(submissions)} submissions", file=sys.stderr)

    # Build indices
    trans_out, sub_out, incoming, cross_sys, direction_counts, sub_control_roles = build_indices(
        transitions, submissions, pts_map, position_roles
    )

    # Generate rows
    rows = generate_csv(position_roles, pts_map, trans_out, sub_out, incoming, cross_sys, direction_counts)

    # Write CSV
    if args.stdout:
        writer = csv.DictWriter(sys.stdout, fieldnames=FIELDNAMES)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    else:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
            writer.writeheader()
            for row in rows:
                writer.writerow(row)

    # Health report to stderr
    print_health_report(rows, len(transitions), len(submissions))

    if not args.stdout:
        print(f"\nSaved to {OUTPUT_PATH} ({len(rows)} rows)", file=sys.stderr)


if __name__ == "__main__":
    main()
