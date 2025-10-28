"""
Link Validator for BJJ Graph Knowledge Base

Validates all wikilinks in markdown files:
- Checks if links resolve to existing files
- Flags broken links with suggestions for fixes
- Identifies orphan pages (no incoming links)
- Identifies dead-end pages (no outgoing links)
- Checks link reciprocity
- Generates comprehensive validation report
"""

import logging
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict
from dataclasses import dataclass, field

from tqdm import tqdm

import config
import utils
from graph_builder import GraphBuilder


logger = logging.getLogger(__name__)


@dataclass
class BrokenLink:
    """Information about a broken link."""
    source_file: str
    target_link: str
    line_number: Optional[int] = None
    suggested_fix: Optional[str] = None
    confidence: float = 0.0


@dataclass
class ValidationResult:
    """Results from link validation."""
    total_links: int = 0
    valid_links: int = 0
    broken_links: List[BrokenLink] = field(default_factory=list)
    orphan_pages: List[str] = field(default_factory=list)
    dead_end_pages: List[str] = field(default_factory=list)
    non_reciprocal_links: List[Tuple[str, str]] = field(default_factory=list)
    special_pages: Set[str] = field(default_factory=set)

    @property
    def broken_count(self) -> int:
        return len(self.broken_links)

    @property
    def orphan_count(self) -> int:
        return len(self.orphan_pages)

    @property
    def dead_end_count(self) -> int:
        return len(self.dead_end_pages)

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'summary': {
                'total_links': self.total_links,
                'valid_links': self.valid_links,
                'broken_links': self.broken_count,
                'orphan_pages': self.orphan_count,
                'dead_end_pages': self.dead_end_count,
                'non_reciprocal_links': len(self.non_reciprocal_links),
            },
            'broken_links': [
                {
                    'source_file': bl.source_file,
                    'target_link': bl.target_link,
                    'line_number': bl.line_number,
                    'suggested_fix': bl.suggested_fix,
                    'confidence': bl.confidence,
                }
                for bl in self.broken_links
            ],
            'orphan_pages': self.orphan_pages,
            'dead_end_pages': self.dead_end_pages,
            'non_reciprocal_links': [
                {'from': src, 'to': tgt}
                for src, tgt in self.non_reciprocal_links
            ],
        }


class LinkValidator:
    """Validate wikilinks in BJJ Graph content."""

    def __init__(self, graph_builder: Optional[GraphBuilder] = None):
        """
        Initialize LinkValidator.

        Args:
            graph_builder: Existing GraphBuilder instance (builds new one if None)
        """
        self.graph_builder = graph_builder or GraphBuilder()
        if not self.graph_builder.graph.number_of_nodes():
            self.graph_builder.build_graph()

        self.result = ValidationResult()

    def validate_all(self, verbose: bool = False) -> ValidationResult:
        """
        Validate all links in content.

        Args:
            verbose: Show progress bar

        Returns:
            ValidationResult with all findings
        """
        logger.info("Starting link validation...")

        # Get all files
        files = utils.get_all_content_files()
        iterator = tqdm(files, desc="Validating links") if verbose else files

        # Validate each file
        for file_path in iterator:
            self._validate_file(file_path)

        # Find orphan and dead-end pages from graph
        self._find_orphan_pages()
        self._find_dead_end_pages()

        # Find non-reciprocal links
        self._find_non_reciprocal_links()

        # Log summary
        self._log_summary()

        return self.result

    def _validate_file(self, file_path: Path):
        """Validate all links in a single file."""
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception as e:
            logger.warning(f"Failed to read {file_path}: {e}")
            return

        # Extract wikilinks
        wikilinks = utils.extract_wikilinks(content)
        node_id = file_path.stem

        # Validate each link
        for link in wikilinks:
            self.result.total_links += 1

            if self._is_valid_link(link):
                self.result.valid_links += 1
            else:
                # Broken link - try to suggest fix
                broken_link = BrokenLink(
                    source_file=node_id,
                    target_link=link,
                )

                # Find closest match
                all_files = list(self.graph_builder.file_map.keys())
                suggested = utils.find_closest_match(link, all_files)
                if suggested:
                    broken_link.suggested_fix = suggested
                    broken_link.confidence = self._calculate_match_confidence(link, suggested)

                self.result.broken_links.append(broken_link)

    def _is_valid_link(self, link: str) -> bool:
        """
        Check if a wikilink is valid.

        Args:
            link: Wikilink target

        Returns:
            True if link is valid
        """
        # Check special pages
        if link in config.SPECIAL_PAGES:
            self.result.special_pages.add(link)
            return True

        # Normalize
        normalized = utils.normalize_link_target(link)

        # Check file map
        if link in self.graph_builder.file_map:
            return True
        if normalized in self.graph_builder.file_map:
            return True

        # Check ID map
        if link in self.graph_builder.id_map:
            return True

        return False

    def _calculate_match_confidence(self, original: str, suggested: str) -> float:
        """Calculate confidence score for suggested match."""
        from difflib import SequenceMatcher
        original_norm = utils.normalize_link_target(original)
        suggested_norm = utils.normalize_link_target(suggested)
        ratio = SequenceMatcher(None, original_norm, suggested_norm).ratio()
        return ratio * 100

    def _find_orphan_pages(self):
        """Find pages with no incoming links."""
        if not self.graph_builder.metrics:
            self.graph_builder.compute_metrics()

        self.result.orphan_pages = self.graph_builder.metrics.get('orphan_pages', [])

    def _find_dead_end_pages(self):
        """Find pages with no outgoing links."""
        if not self.graph_builder.metrics:
            self.graph_builder.compute_metrics()

        self.result.dead_end_pages = self.graph_builder.metrics.get('dead_end_pages', [])

    def _find_non_reciprocal_links(self):
        """Find links that aren't reciprocated (A→B but not B→A)."""
        graph = self.graph_builder.graph

        for source, target in graph.edges():
            # Check if reverse edge exists
            if not graph.has_edge(target, source):
                self.result.non_reciprocal_links.append((source, target))

    def _log_summary(self):
        """Log validation summary."""
        logger.info("\n=== Link Validation Summary ===")
        logger.info(f"Total links checked: {self.result.total_links}")
        logger.info(f"Valid links: {self.result.valid_links}")
        logger.info(f"Broken links: {self.result.broken_count}")
        logger.info(f"Orphan pages (no incoming links): {self.result.orphan_count}")
        logger.info(f"Dead-end pages (no outgoing links): {self.result.dead_end_count}")
        logger.info(f"Non-reciprocal links: {len(self.result.non_reciprocal_links)}")

        if self.result.broken_count > 0:
            logger.info("\nTop 10 broken links:")
            for i, broken in enumerate(self.result.broken_links[:10], 1):
                fix_info = f" (suggested: {broken.suggested_fix}, confidence: {broken.confidence:.1f}%)" if broken.suggested_fix else ""
                logger.info(f"  {i}. [{broken.source_file}] → [[{broken.target_link}]]{fix_info}")

    def generate_report(self) -> Dict:
        """
        Generate comprehensive validation report.

        Returns:
            Report dictionary
        """
        report = self.result.to_dict()
        report['timestamp'] = utils.format_timestamp()

        # Add statistics
        if self.result.total_links > 0:
            report['statistics'] = {
                'validation_rate': (self.result.valid_links / self.result.total_links) * 100,
                'broken_rate': (self.result.broken_count / self.result.total_links) * 100,
            }

        # Group broken links by source file
        broken_by_file = defaultdict(list)
        for broken in self.result.broken_links:
            broken_by_file[broken.source_file].append({
                'target': broken.target_link,
                'suggested_fix': broken.suggested_fix,
                'confidence': broken.confidence,
            })

        report['broken_links_by_file'] = dict(broken_by_file)

        # Find files with most broken links
        files_ranked = sorted(
            broken_by_file.items(),
            key=lambda x: len(x[1]),
            reverse=True
        )
        report['files_needing_attention'] = [
            {'file': file, 'broken_count': len(links)}
            for file, links in files_ranked[:20]
        ]

        return report

    def save_report(self, output_path: Path):
        """
        Save validation report to file.

        Args:
            output_path: Path to save report
        """
        report = self.generate_report()
        utils.save_json_report(report, output_path.name)
        logger.info(f"Validation report saved to {output_path}")

    def get_broken_links_for_file(self, file_name: str) -> List[BrokenLink]:
        """
        Get all broken links from a specific file.

        Args:
            file_name: File name (without path)

        Returns:
            List of broken links
        """
        return [bl for bl in self.result.broken_links if bl.source_file == file_name]

    def get_fixable_links(self, min_confidence: float = 60.0) -> List[BrokenLink]:
        """
        Get broken links with high-confidence fixes.

        Args:
            min_confidence: Minimum confidence threshold

        Returns:
            List of fixable broken links
        """
        return [
            bl for bl in self.result.broken_links
            if bl.suggested_fix and bl.confidence >= min_confidence
        ]
