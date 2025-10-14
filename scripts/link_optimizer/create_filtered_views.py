#!/usr/bin/env python3
"""
Create Filtered Views and Agent Chunks from Link Suggestions

Splits the large link_suggestions_report.json into:
1. Filtered views by confidence level
2. Agent chunks for parallel processing
3. Summary statistics file
"""

import json
import sys
from pathlib import Path
from typing import List, Dict

# Paths
BASE_DIR = Path(__file__).parent.parent.parent
REPORTS_DIR = BASE_DIR / "reports" / "link_optimizer"
SUGGESTIONS_FILE = REPORTS_DIR / "link_suggestions_report.json"
BY_CONFIDENCE_DIR = REPORTS_DIR / "suggestions_by_confidence"
AGENT_CHUNKS_DIR = REPORTS_DIR / "agent_chunks"


def load_suggestions() -> Dict:
    """Load the full suggestions report."""
    print(f"Loading suggestions from {SUGGESTIONS_FILE}...")
    with open(SUGGESTIONS_FILE, 'r') as f:
        return json.load(f)


def create_confidence_filters(data: Dict):
    """Create filtered JSON files by confidence level."""
    print("\nCreating confidence-based filters...")

    suggestions = data['suggestions']

    # Filter by confidence ranges
    high = [s for s in suggestions if s['confidence'] >= 95]
    medium = [s for s in suggestions if 80 <= s['confidence'] < 95]
    low = [s for s in suggestions if 60 <= s['confidence'] < 80]

    # Save high confidence (≥95%)
    high_file = BY_CONFIDENCE_DIR / "high_confidence_95plus.json"
    with open(high_file, 'w') as f:
        json.dump({
            'filter': 'confidence >= 95%',
            'count': len(high),
            'suggestions': high
        }, f, indent=2)
    print(f"  ✓ Created {high_file} ({len(high)} suggestions)")

    # Save medium confidence (80-94%)
    medium_file = BY_CONFIDENCE_DIR / "medium_confidence_80-94.json"
    with open(medium_file, 'w') as f:
        json.dump({
            'filter': '80% <= confidence < 95%',
            'count': len(medium),
            'suggestions': medium
        }, f, indent=2)
    print(f"  ✓ Created {medium_file} ({len(medium)} suggestions)")

    # Save low confidence (60-79%)
    low_file = BY_CONFIDENCE_DIR / "low_confidence_60-79.json"
    with open(low_file, 'w') as f:
        json.dump({
            'filter': '60% <= confidence < 80%',
            'count': len(low),
            'suggestions': low
        }, f, indent=2)
    print(f"  ✓ Created {low_file} ({len(low)} suggestions)")

    return high, medium, low


def create_summary(data: Dict, high: List, medium: List, low: List):
    """Create summary statistics file."""
    print("\nCreating summary statistics...")

    summary = {
        'overview': data['summary'],
        'confidence_breakdown': {
            'high_95plus': len(high),
            'medium_80_94': len(medium),
            'low_60_79': len(low)
        },
        'relationship_types': {},
        'top_20_suggestions': data['suggestions'][:20]
    }

    # Count by relationship type
    for sug in data['suggestions']:
        rel_type = sug.get('relationship_type', 'unknown')
        summary['relationship_types'][rel_type] = summary['relationship_types'].get(rel_type, 0) + 1

    summary_file = REPORTS_DIR / "suggestions_summary.json"
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f"  ✓ Created {summary_file}")


def create_agent_chunks(high_suggestions: List, num_agents: int = 10):
    """Split high-confidence suggestions into chunks for parallel agent processing."""
    print(f"\nCreating {num_agents} agent chunks...")

    total = len(high_suggestions)
    chunk_size = (total + num_agents - 1) // num_agents  # Ceiling division

    for i in range(num_agents):
        start_idx = i * chunk_size
        end_idx = min((i + 1) * chunk_size, total)
        chunk = high_suggestions[start_idx:end_idx]

        chunk_data = {
            'chunk_metadata': {
                'chunk_number': i + 1,
                'total_chunks': num_agents,
                'start_index': start_idx,
                'end_index': end_idx - 1,
                'count': len(chunk),
                'confidence_filter': '≥95%'
            },
            'suggestions': chunk,
            'instructions': {
                'task': 'Apply these wikilink suggestions to markdown files',
                'validation': [
                    'Check if wikilink already exists',
                    'Verify target file exists',
                    'Add to specified section only',
                    'Maintain markdown formatting'
                ],
                'reporting': [
                    'Track: applied, skipped_exists, skipped_no_target, error',
                    'Report file paths modified',
                    'Report line numbers where links added',
                    'Report any errors encountered'
                ]
            }
        }

        chunk_file = AGENT_CHUNKS_DIR / f"chunk_{i+1:03d}_of_{num_agents:03d}.json"
        with open(chunk_file, 'w') as f:
            json.dump(chunk_data, f, indent=2)

        print(f"  ✓ Chunk {i+1:02d}: {len(chunk)} suggestions (indices {start_idx}-{end_idx-1})")

    print(f"\n✅ Created {num_agents} chunks in {AGENT_CHUNKS_DIR}")
    print(f"   Each chunk contains ~{chunk_size} suggestions")
    print(f"   Ready for parallel agent processing!")


def main():
    """Main execution."""
    print("=" * 70)
    print("Creating Filtered Views and Agent Chunks")
    print("=" * 70)

    # Ensure directories exist
    BY_CONFIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    AGENT_CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

    # Load full data
    data = load_suggestions()

    # Create filtered views
    high, medium, low = create_confidence_filters(data)

    # Create summary
    create_summary(data, high, medium, low)

    # Create agent chunks from high-confidence suggestions
    create_agent_chunks(high, num_agents=10)

    print("\n" + "=" * 70)
    print("✅ ALL FILTERED VIEWS AND AGENT CHUNKS CREATED")
    print("=" * 70)
    print(f"\nNext step: Run parallel agents to process chunks")
    print(f"Command: python3 scripts/link_optimizer/run_parallel_agents.py")


if __name__ == "__main__":
    main()
