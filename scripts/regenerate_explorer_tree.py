#!/usr/bin/env python3
"""
Generate explorerTree.json for the BJJGraph explorer sidebar.

Reads graph.json and produces a minimal topology file for inline semantic
graph expansion in the explorer sidebar and ?roll= URL encoding.

Usage:
    python scripts/regenerate_explorer_tree.py

Output: source/quartz/static/explorerTree.json
"""

import json
import sys
from pathlib import Path


def to_base36(num: int, width: int = 4) -> str:
    """Convert integer to zero-padded base36 string."""
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    if num == 0:
        return "0" * width
    result = ""
    n = num
    while n > 0:
        result = chars[n % 36] + result
        n //= 36
    return result.zfill(width)


def quartz_slug(name: str) -> str:
    """Convert name to URL path matching Quartz's sluggify (case-preserving)."""
    import re
    slug = name.strip()
    slug = slug.replace('&', '-and-')
    slug = slug.replace('%', '-percent')
    slug = slug.replace('?', '')
    slug = slug.replace('#', '')
    slug = re.sub(r'\s+', '-', slug)
    return slug


def main():
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    graph_file = project_root / "graph.json"

    if not graph_file.exists():
        print(f"Error: {graph_file} not found. Run 'npm run regenerate:graph' first.")
        sys.exit(1)

    with open(graph_file, "r", encoding="utf-8") as f:
        graph = json.load(f)

    positions = graph.get("positions", {})
    transitions = graph.get("transitions", {})
    submissions = graph.get("submissions", {})

    # Group positions by hub
    hubs: dict[str, dict] = {}
    for pos_key, pos_data in positions.items():
        hub = pos_data.get("hub", pos_key)
        role = pos_data.get("role", "neutral")

        if hub not in hubs:
            hubs[hub] = {"name": "", "top": [], "bottom": []}

        if role in ("top", "bottom"):
            # Derive hub name: strip trailing " Top" / " Bottom" from role name
            name = pos_data.get("name", hub)
            if name.endswith(" Top"):
                hub_name = name[:-4]
            elif name.endswith(" Bottom"):
                hub_name = name[:-7]
            else:
                hub_name = name
            if not hubs[hub]["name"]:
                hubs[hub]["name"] = hub_name

            for t in pos_data.get("transitions", []):
                hubs[hub][role].append({
                    "k": t.get("target", ""),
                    "n": t.get("technique", ""),
                    "p": t.get("attemptProbability", 0),
                    "s": t.get("isSubmission", False),
                })

        elif role in ("neutral", "terminal"):
            hubs[hub]["name"] = pos_data.get("name", hub)
            for t in pos_data.get("transitions", []):
                hubs[hub]["top"].append({
                    "k": t.get("target", ""),
                    "n": t.get("technique", ""),
                    "p": t.get("attemptProbability", 0),
                    "s": t.get("isSubmission", False),
                })

    # Remove hubs with no transitions at all
    hubs = {k: v for k, v in hubs.items() if v["top"] or v["bottom"]}

    # Build techniques from transitions + submissions
    techniques: dict[str, dict] = {}

    for t_key, t_data in transitions.items():
        outcomes = []
        for o in t_data.get("outcomes", []):
            to_slug = o.get("to", "")
            to_parts = to_slug.split("/") if to_slug else [""]
            hub_key = to_parts[0]
            role_key = to_parts[1] if len(to_parts) > 1 else ""
            result = o.get("result", "success")
            outcomes.append({
                "hub": hub_key,
                "role": role_key,
                "p": o.get("probability", 0),
                "r": result[0] if result else "s",  # s/f/c
            })

        techniques[t_key] = {
            "n": t_data.get("name", t_key),
            "path": f"Transitions/{quartz_slug(t_data.get('name', t_key))}",
            "o": outcomes,
        }

    for s_key, s_data in submissions.items():
        outcomes = []
        for o in s_data.get("outcomes", []):
            to_slug = o.get("to", "")
            to_parts = to_slug.split("/") if to_slug else [""]
            hub_key = to_parts[0]
            role_key = to_parts[1] if len(to_parts) > 1 else ""
            result = o.get("result", "success")
            outcomes.append({
                "hub": hub_key,
                "role": role_key,
                "p": o.get("probability", 0),
                "r": result[0] if result else "s",
            })

        techniques[s_key] = {
            "n": s_data.get("name", s_key),
            "path": f"Submissions/{quartz_slug(s_data.get('name', s_key))}",
            "o": outcomes,
            "sub": True,
        }

    # Assign sequential 4-char base36 IDs (sorted alphabetically for stability)
    all_position_keys = sorted(hubs.keys())
    all_technique_keys = sorted(techniques.keys())

    id_counter = 0

    for key in all_position_keys:
        hubs[key]["id"] = to_base36(id_counter)
        id_counter += 1

    for key in all_technique_keys:
        techniques[key]["id"] = to_base36(id_counter)
        id_counter += 1

    # Build output
    output = {
        "positions": {k: hubs[k] for k in all_position_keys},
        "techniques": {k: techniques[k] for k in all_technique_keys},
    }

    # Write output (compact JSON for smaller file size)
    output_file = project_root / "source" / "quartz" / "static" / "explorerTree.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"), ensure_ascii=False)

    size_kb = output_file.stat().st_size / 1024
    print(f"Generated: {output_file}")
    print(f"  Positions: {len(hubs)}")
    print(f"  Techniques: {len(techniques)}")
    print(f"  Total IDs: {id_counter}")
    print(f"  Size: {size_kb:.1f} KB")

    # Verify ID uniqueness
    all_ids = set()
    for pos in hubs.values():
        assert pos["id"] not in all_ids, f"Duplicate ID: {pos['id']}"
        all_ids.add(pos["id"])
    for tech in techniques.values():
        assert tech["id"] not in all_ids, f"Duplicate ID: {tech['id']}"
        all_ids.add(tech["id"])
    print(f"  All {len(all_ids)} IDs are unique")


if __name__ == "__main__":
    main()
