#!/usr/bin/env python3
"""
Apply Link Suggestions - Agent Worker Script

This script is designed to be run by individual agents in parallel.
Each agent processes a chunk of link suggestions and applies them to markdown files.

Usage:
    python3 apply_suggestions.py <chunk_file> [--dry-run]

Example:
    python3 apply_suggestions.py reports/link_optimizer/agent_chunks/chunk_001_of_010.json
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, field


# Paths
BASE_DIR = Path(__file__).parent.parent.parent
CONTENT_DIR = BASE_DIR / "source" / "content"


@dataclass
class SuggestionResult:
    """Result of processing a single suggestion."""
    suggestion_index: int
    source_file: str
    target_file: str
    confidence: float
    section: str
    status: str  # applied, skipped_exists, skipped_no_target, skipped_no_file, error
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    error_message: Optional[str] = None


@dataclass
class ChunkReport:
    """Report for entire chunk processing."""
    chunk_number: int
    total_chunks: int
    start_index: int
    end_index: int
    total_processed: int = 0
    applied: int = 0
    skipped_exists: int = 0
    skipped_no_target: int = 0
    skipped_no_file: int = 0
    errors: int = 0
    results: List[SuggestionResult] = field(default_factory=list)

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'chunk_metadata': {
                'chunk_number': self.chunk_number,
                'total_chunks': self.total_chunks,
                'start_index': self.start_index,
                'end_index': self.end_index
            },
            'summary': {
                'total_processed': self.total_processed,
                'applied': self.applied,
                'skipped_exists': self.skipped_exists,
                'skipped_no_target': self.skipped_no_target,
                'skipped_no_file': self.skipped_no_file,
                'errors': self.errors
            },
            'details': [
                {
                    'index': r.suggestion_index,
                    'source': r.source_file,
                    'target': r.target_file,
                    'confidence': r.confidence,
                    'section': r.section,
                    'status': r.status,
                    'file_path': r.file_path,
                    'line_number': r.line_number,
                    'error': r.error_message
                }
                for r in self.results
            ]
        }


class SuggestionApplier:
    """Apply link suggestions to markdown files."""

    def __init__(self, dry_run: bool = False):
        """
        Initialize applier.

        Args:
            dry_run: If True, don't actually modify files
        """
        self.dry_run = dry_run
        self.content_dirs = [
            CONTENT_DIR / "Positions",
            CONTENT_DIR / "Transitions",
            CONTENT_DIR / "Submissions",
            CONTENT_DIR / "Concepts",
            CONTENT_DIR / "Systems"
        ]

    def find_file(self, filename: str) -> Optional[Path]:
        """
        Find a markdown file by name.

        Args:
            filename: Name of file (without .md extension)

        Returns:
            Path to file if found, None otherwise
        """
        # Try with .md extension
        for content_dir in self.content_dirs:
            file_path = content_dir / f"{filename}.md"
            if file_path.exists():
                return file_path

        return None

    def check_link_exists(self, content: str, target: str) -> bool:
        """
        Check if wikilink already exists in content.

        Args:
            content: Markdown content
            target: Target file name

        Returns:
            True if link exists
        """
        # Check for [[target]] or [[target|alias]]
        pattern = rf'\[\[{re.escape(target)}(?:\|[^\]]+)?\]\]'
        return bool(re.search(pattern, content, re.IGNORECASE))

    def find_section(self, content: str, section_name: str) -> Optional[int]:
        """
        Find the line number of a section heading.

        Args:
            content: Markdown content
            section_name: Section heading to find

        Returns:
            Line number of section (0-indexed), or None if not found
        """
        lines = content.split('\n')

        # Try exact match first
        for i, line in enumerate(lines):
            if line.strip().startswith('##') and section_name.lower() in line.lower():
                return i

        # Try fuzzy match
        section_words = set(section_name.lower().split())
        for i, line in enumerate(lines):
            if line.strip().startswith('##'):
                line_words = set(line.lower().split())
                # If more than 50% of words match, consider it a match
                if len(section_words & line_words) / len(section_words) > 0.5:
                    return i

        return None

    def add_link_to_section(self, content: str, section_name: str, target: str) -> tuple[str, int]:
        """
        Add wikilink to specified section.

        Args:
            content: Markdown content
            section_name: Section to add link to
            target: Target file name

        Returns:
            Tuple of (modified_content, line_number_added)
        """
        lines = content.split('\n')
        section_line = self.find_section(content, section_name)

        if section_line is None:
            # Section not found - add at end of file
            lines.append(f"\n## {section_name}\n")
            lines.append(f"- [[{target}]]")
            return '\n'.join(lines), len(lines) - 1

        # Find where to insert the link (after section heading)
        insert_line = section_line + 1

        # Skip any blank lines
        while insert_line < len(lines) and not lines[insert_line].strip():
            insert_line += 1

        # Check if there's already a list starting
        if insert_line < len(lines) and lines[insert_line].strip().startswith('-'):
            # Add to existing list
            lines.insert(insert_line, f"- [[{target}]]")
        else:
            # Start new list
            lines.insert(insert_line, f"- [[{target}]]")

        return '\n'.join(lines), insert_line

    def apply_suggestion(self, suggestion: Dict, index: int) -> SuggestionResult:
        """
        Apply a single suggestion.

        Args:
            suggestion: Suggestion dictionary
            index: Index in chunk

        Returns:
            SuggestionResult
        """
        source = suggestion['source_file']
        target = suggestion['target_file']
        confidence = suggestion['confidence']
        section = suggestion['suggested_section']

        result = SuggestionResult(
            suggestion_index=index,
            source_file=source,
            target_file=target,
            confidence=confidence,
            section=section,
            status='unknown'
        )

        try:
            # Find source file
            source_path = self.find_file(source)
            if not source_path:
                result.status = 'skipped_no_file'
                result.error_message = f"Source file not found: {source}"
                return result

            result.file_path = str(source_path)

            # Check if target exists
            target_path = self.find_file(target)
            if not target_path:
                result.status = 'skipped_no_target'
                result.error_message = f"Target file not found: {target}"
                return result

            # Read source file
            content = source_path.read_text(encoding='utf-8')

            # Check if link already exists
            if self.check_link_exists(content, target):
                result.status = 'skipped_exists'
                result.error_message = f"Link [[{target}]] already exists in {source}"
                return result

            # Add link to specified section
            modified_content, line_number = self.add_link_to_section(content, section, target)
            result.line_number = line_number

            # Write back (unless dry run)
            if not self.dry_run:
                source_path.write_text(modified_content, encoding='utf-8')
                result.status = 'applied'
            else:
                result.status = 'applied_dry_run'

        except Exception as e:
            result.status = 'error'
            result.error_message = str(e)

        return result

    def process_chunk(self, chunk_data: Dict) -> ChunkReport:
        """
        Process entire chunk of suggestions.

        Args:
            chunk_data: Chunk dictionary with metadata and suggestions

        Returns:
            ChunkReport
        """
        metadata = chunk_data['chunk_metadata']
        suggestions = chunk_data['suggestions']

        report = ChunkReport(
            chunk_number=metadata['chunk_number'],
            total_chunks=metadata['total_chunks'],
            start_index=metadata['start_index'],
            end_index=metadata['end_index']
        )

        print(f"\n{'='*70}")
        print(f"Processing Chunk {metadata['chunk_number']} of {metadata['total_chunks']}")
        print(f"Suggestions: {len(suggestions)} (indices {metadata['start_index']}-{metadata['end_index']})")
        print(f"Mode: {'DRY RUN' if self.dry_run else 'APPLY CHANGES'}")
        print(f"{'='*70}\n")

        for i, suggestion in enumerate(suggestions):
            result = self.apply_suggestion(suggestion, metadata['start_index'] + i)
            report.results.append(result)
            report.total_processed += 1

            # Update counters
            if result.status == 'applied' or result.status == 'applied_dry_run':
                report.applied += 1
                status_symbol = '✓'
            elif result.status == 'skipped_exists':
                report.skipped_exists += 1
                status_symbol = '⊙'
            elif result.status == 'skipped_no_target':
                report.skipped_no_target += 1
                status_symbol = '⊘'
            elif result.status == 'skipped_no_file':
                report.skipped_no_file += 1
                status_symbol = '⊗'
            elif result.status == 'error':
                report.errors += 1
                status_symbol = '✗'
            else:
                status_symbol = '?'

            # Print progress
            print(f"{status_symbol} [{i+1:02d}/{len(suggestions):02d}] {result.source_file} → [[{result.target_file}]] ({result.status})")

        return report


def main():
    """Main execution."""
    if len(sys.argv) < 2:
        print("Usage: python3 apply_suggestions.py <chunk_file> [--dry-run]")
        print("\nExample:")
        print("  python3 apply_suggestions.py reports/link_optimizer/agent_chunks/chunk_001_of_010.json")
        sys.exit(1)

    chunk_file = Path(sys.argv[1])
    dry_run = '--dry-run' in sys.argv

    if not chunk_file.exists():
        print(f"Error: Chunk file not found: {chunk_file}")
        sys.exit(1)

    # Load chunk data
    print(f"Loading chunk from {chunk_file}...")
    with open(chunk_file, 'r') as f:
        chunk_data = json.load(f)

    # Process chunk
    applier = SuggestionApplier(dry_run=dry_run)
    report = applier.process_chunk(chunk_data)

    # Print summary
    print(f"\n{'='*70}")
    print("CHUNK PROCESSING COMPLETE")
    print(f"{'='*70}")
    print(f"Total processed: {report.total_processed}")
    print(f"Applied: {report.applied}")
    print(f"Skipped (exists): {report.skipped_exists}")
    print(f"Skipped (no target): {report.skipped_no_target}")
    print(f"Skipped (no file): {report.skipped_no_file}")
    print(f"Errors: {report.errors}")
    print(f"{'='*70}\n")

    # Save report
    report_file = chunk_file.parent / f"report_{chunk_file.stem}.json"
    with open(report_file, 'w') as f:
        json.dump(report.to_dict(), f, indent=2)
    print(f"Report saved to: {report_file}")

    # Return report as JSON to stdout (for agent to capture)
    print("\n=== AGENT REPORT START ===")
    print(json.dumps(report.to_dict(), indent=2))
    print("=== AGENT REPORT END ===")


if __name__ == "__main__":
    main()
