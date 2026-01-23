#!/usr/bin/env python3
"""
Generate bjj-graph.json - Public state machine export

This script reads JSON source files from source/content/ and generates
a unified graph representation with states (positions, transitions, submissions)
and edges (offensive_transitions, defensive_responses, etc.).

Output: source/content/bjj-graph.json -> builds to public/bjj-graph.json
"""

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Base path for content
CONTENT_PATH = Path("source/content")

# Categories to process
CATEGORIES = {
    "Positions": "position",
    "Transitions": "transition",
    "Submissions": "submission",
}


def slugify(name: str) -> str:
    """Convert name to URL-friendly slug."""
    slug = name.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return slug.strip("-")


def load_json_files(category_path: Path) -> list[tuple[Path, dict]]:
    """Load all JSON files in a category directory."""
    files = []
    if not category_path.exists():
        return files

    for json_file in category_path.glob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                files.append((json_file, data))
        except (json.JSONDecodeError, IOError) as e:
            print(f"  Warning: Failed to load {json_file}: {e}")

    return files


def extract_position_state(json_data: dict, file_path: Path) -> dict:
    """Extract state node from Position JSON."""
    name = json_data.get("name", file_path.stem)
    slug_id = json_data.get("slug", slugify(name))

    # Check if this position has Top/Bottom variants
    has_variants = "top" in json_data or "bottom" in json_data
    roles = []
    if "top" in json_data:
        roles.append("Top")
    if "bottom" in json_data:
        roles.append("Bottom")

    # Extract state properties from either root or first variant
    state_props = {}
    for variant_key in ["top", "bottom"]:
        if variant_key in json_data:
            variant = json_data[variant_key]
            if "state_properties" in variant:
                state_props = variant["state_properties"]
                break

    return {
        "id": slug_id,
        "name": name,
        "type": "position",
        "path": f"Positions/{name.replace(' ', '-')}",
        "sourceFile": f"source/content/{file_path.relative_to(CONTENT_PATH)}",
        "templated": True,
        "hasVariants": has_variants,
        "roles": roles if roles else None,
        "state_properties": state_props if state_props else None,
        "embedding": None,
    }


def extract_transition_state(json_data: dict, file_path: Path) -> dict:
    """Extract state node from Transition JSON."""
    name = json_data.get("name", file_path.stem)
    slug_id = slugify(name)

    return {
        "id": slug_id,
        "name": name,
        "type": "transition",
        "path": f"Transitions/{name.replace(' ', '-')}",
        "sourceFile": f"source/content/{file_path.relative_to(CONTENT_PATH)}",
        "templated": True,
        "from_state": slugify(json_data.get("starting_position", "")),
        "to_state": slugify(json_data.get("ending_position", "")),
        "success_rates": json_data.get("success_rates"),
        "embedding": None,
    }


def extract_submission_state(json_data: dict, file_path: Path) -> dict:
    """Extract state node from Submission JSON."""
    name = json_data.get("name", file_path.stem)
    slug_id = slugify(name)

    # Extract starting position(s)
    starting_position = json_data.get("starting_position", "")
    if isinstance(starting_position, list):
        from_positions = [slugify(p) for p in starting_position]
    elif starting_position:
        from_positions = [slugify(starting_position)]
    else:
        from_positions = []

    return {
        "id": slug_id,
        "name": name,
        "type": "submission",
        "path": f"Submissions/{name.replace(' ', '-')}",
        "sourceFile": f"source/content/{file_path.relative_to(CONTENT_PATH)}",
        "templated": True,
        "submission_category": json_data.get("submission_category"),
        "submission_type": json_data.get("submission_type"),
        "target_area": json_data.get("target_area"),
        "from_positions": from_positions if from_positions else None,
        "success_rates": json_data.get("success_rates"),
        "embedding": None,
    }


def extract_position_edges(
    json_data: dict, position_slug: str
) -> list[dict[str, Any]]:
    """Extract edges from Position JSON (offensive/defensive transitions)."""
    edges = []

    # Process both Top and Bottom variants
    for variant_key in ["top", "bottom"]:
        if variant_key not in json_data:
            continue

        variant = json_data[variant_key]
        role_suffix = f"-{variant_key}"

        # Offensive transitions
        for transition in variant.get("offensive_transitions", []):
            technique = transition.get("technique", "")
            target = transition.get("target_position", "")
            success_rates = transition.get("success_rates", {})

            if target:
                edges.append(
                    {
                        "from": position_slug,
                        "to": slugify(target),
                        "via": slugify(technique) if technique else None,
                        "type": "offensive_transition",
                        "role": variant_key,
                        "success_rates": success_rates if success_rates else None,
                    }
                )

        # Defensive responses
        for response in variant.get("defensive_responses", []):
            target = response.get("escape_to", response.get("target_position", ""))
            technique = response.get("technique", response.get("response", ""))
            success_rates = response.get("success_rates", {})

            if target:
                edges.append(
                    {
                        "from": position_slug,
                        "to": slugify(target),
                        "via": slugify(technique) if technique else None,
                        "type": "defensive_response",
                        "role": variant_key,
                        "success_rates": success_rates if success_rates else None,
                    }
                )

        # Submission attempts
        for submission in variant.get("submission_attempts", []):
            sub_name = submission.get("submission", submission.get("name", ""))
            success_rates = submission.get("success_rates", {})

            if sub_name:
                edges.append(
                    {
                        "from": position_slug,
                        "to": slugify(sub_name),
                        "via": None,
                        "type": "submission_attempt",
                        "role": variant_key,
                        "success_rates": success_rates if success_rates else None,
                    }
                )

    return edges


def extract_transition_edges(json_data: dict) -> list[dict[str, Any]]:
    """Extract edges from Transition JSON."""
    edges = []

    starting = json_data.get("starting_position", "")
    ending = json_data.get("ending_position", "")
    name = json_data.get("name", "")
    success_rates = json_data.get("success_rates", {})

    if starting and ending:
        edges.append(
            {
                "from": slugify(starting),
                "to": slugify(ending),
                "via": slugify(name) if name else None,
                "type": "technique",
                "success_rates": success_rates if success_rates else None,
            }
        )

    return edges


def extract_submission_edges(json_data: dict) -> list[dict[str, Any]]:
    """Extract edges from Submission JSON."""
    edges = []

    name = json_data.get("name", "")
    starting = json_data.get("starting_position", "")
    success_rates = json_data.get("success_rates", {})

    if isinstance(starting, list):
        positions = starting
    elif starting:
        positions = [starting]
    else:
        positions = []

    for pos in positions:
        edges.append(
            {
                "from": slugify(pos),
                "to": slugify(name),
                "via": None,
                "type": "submission_attempt",
                "success_rates": success_rates if success_rates else None,
            }
        )

    return edges


def main():
    """Generate bjj-graph.json from source files."""
    print("Generating bjj-graph.json...")

    states = []
    edges = []
    counts = {"positions": 0, "transitions": 0, "submissions": 0}

    for category, type_name in CATEGORIES.items():
        category_path = CONTENT_PATH / category
        print(f"\nProcessing {category}...")

        files = load_json_files(category_path)
        print(f"  Found {len(files)} JSON files")

        for file_path, json_data in files:
            # Extract state based on category
            if category == "Positions":
                state = extract_position_state(json_data, file_path)
                state_edges = extract_position_edges(json_data, state["id"])
                counts["positions"] += 1
            elif category == "Transitions":
                state = extract_transition_state(json_data, file_path)
                state_edges = extract_transition_edges(json_data)
                counts["transitions"] += 1
            elif category == "Submissions":
                state = extract_submission_state(json_data, file_path)
                state_edges = extract_submission_edges(json_data)
                counts["submissions"] += 1
            else:
                continue

            states.append(state)
            edges.extend(state_edges)

    # Remove None values from states and edges for cleaner output
    def clean_dict(d: dict) -> dict:
        return {k: v for k, v in d.items() if v is not None}

    states = [clean_dict(s) for s in states]
    edges = [clean_dict(e) for e in edges]

    # Build output structure
    output = {
        "version": "1.0",
        "generated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "metadata": {
            "total_states": len(states),
            "total_edges": len(edges),
            "positions": counts["positions"],
            "transitions": counts["transitions"],
            "submissions": counts["submissions"],
        },
        "states": sorted(states, key=lambda x: (x["type"], x["name"])),
        "edges": edges,
    }

    # Write output
    output_path = CONTENT_PATH / "bjj-graph.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"\nGenerated {output_path}")
    print(f"  States: {len(states)} ({counts['positions']} positions, "
          f"{counts['transitions']} transitions, {counts['submissions']} submissions)")
    print(f"  Edges: {len(edges)}")


if __name__ == "__main__":
    main()
