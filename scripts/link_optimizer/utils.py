"""
Utility functions for BJJ Graph Link Optimizer
"""

import re
import json
import logging
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from datetime import datetime

import config


def setup_logging(verbose: bool = False) -> logging.Logger:
    """Set up logging configuration."""
    level = logging.DEBUG if verbose else logging.INFO

    logging.basicConfig(
        level=level,
        format=config.LOG_FORMAT,
        handlers=[
            logging.FileHandler(config.LOG_FILE),
            logging.StreamHandler()
        ]
    )

    return logging.getLogger(__name__)


def extract_wikilinks(content: str) -> List[str]:
    """
    Extract all wikilinks from markdown content.

    Args:
        content: Markdown file content

    Returns:
        List of wikilink targets (without brackets)
    """
    pattern = re.compile(config.WIKILINK_PATTERN)
    matches = pattern.findall(content)

    # Clean links (remove display text after |)
    cleaned = []
    for match in matches:
        # Remove display text: [[Link|Display]] -> Link
        clean = match.split('|')[0].strip()
        cleaned.append(clean)

    return cleaned


def extract_frontmatter(content: str) -> Tuple[Dict, str]:
    """
    Extract YAML frontmatter and body from markdown content.

    Args:
        content: Markdown file content

    Returns:
        Tuple of (frontmatter_dict, body_content)
    """
    frontmatter = {}
    body = content

    # Check for YAML frontmatter
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter_text = parts[1]
            body = parts[2]

            # Parse simple YAML (key: value)
            for line in frontmatter_text.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    frontmatter[key.strip()] = value.strip().strip('"\'')

    return frontmatter, body


def extract_content_id(content: str, content_type: str) -> Optional[str]:
    """
    Extract content ID from markdown content.

    Args:
        content: Markdown file content
        content_type: Type of content (Positions, Transitions, etc.)

    Returns:
        Content ID (S###, T###, etc.) or None
    """
    if content_type not in config.CONTENT_TYPES:
        return None

    pattern = config.CONTENT_TYPES[content_type]['id_pattern']

    # Try to find ID in various formats
    id_patterns = [
        rf'\*\*State ID\*\*:\s*({pattern})',
        rf'\*\*Transition ID\*\*:\s*({pattern})',
        rf'\*\*Submission ID\*\*:\s*({pattern})',
        rf'\*\*Concept ID\*\*:\s*({pattern})',
        rf'\*\*Chain ID\*\*:\s*({pattern})',
    ]

    for id_pattern in id_patterns:
        match = re.search(id_pattern, content)
        if match:
            return match.group(1)

    return None


def determine_content_type(file_path: Path) -> str:
    """
    Determine content type from file path.

    Args:
        file_path: Path to markdown file

    Returns:
        Content type (Positions, Transitions, etc.)
    """
    parent = file_path.parent.name

    if parent in config.CONTENT_TYPES:
        return parent

    return "Unknown"


def normalize_link_target(link: str) -> str:
    """
    Normalize wikilink target for matching.

    Args:
        link: Wikilink target

    Returns:
        Normalized link (lowercase, stripped)
    """
    return link.strip().lower()


def file_to_link_target(file_path: Path) -> str:
    """
    Convert file path to wikilink target.

    Args:
        file_path: Path to markdown file

    Returns:
        Wikilink target (filename without extension)
    """
    return file_path.stem


def find_closest_match(target: str, candidates: List[str], threshold: float = 0.8) -> Optional[str]:
    """
    Find closest matching file for a broken link using fuzzy matching.

    Args:
        target: Broken link target
        candidates: List of valid file names
        threshold: Similarity threshold (0-1)

    Returns:
        Best matching candidate or None
    """
    from difflib import SequenceMatcher

    target_norm = normalize_link_target(target)
    best_match = None
    best_score = 0.0

    for candidate in candidates:
        candidate_norm = normalize_link_target(candidate)
        score = SequenceMatcher(None, target_norm, candidate_norm).ratio()

        if score > best_score and score >= threshold:
            best_score = score
            best_match = candidate

    return best_match


def extract_keywords(content: str, num_keywords: int = 10) -> List[str]:
    """
    Extract key terms from markdown content.

    Args:
        content: Markdown file content
        num_keywords: Number of keywords to extract

    Returns:
        List of keywords
    """
    # Remove markdown syntax
    text = re.sub(r'[#*_\[\]()]', ' ', content)
    # Remove special sections
    text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL)
    # Split into words
    words = text.lower().split()
    # Filter common words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been'}
    words = [w for w in words if w not in stop_words and len(w) > 3]

    # Count frequency
    from collections import Counter
    word_counts = Counter(words)

    # Return most common
    return [word for word, count in word_counts.most_common(num_keywords)]


def load_checkpoint() -> Optional[Dict]:
    """Load checkpoint data if exists."""
    checkpoint_path = config.CACHE_DIR / config.CHECKPOINT_FILE
    if checkpoint_path.exists():
        with open(checkpoint_path, 'r') as f:
            return json.load(f)
    return None


def save_checkpoint(data: Dict):
    """Save checkpoint data."""
    checkpoint_path = config.CACHE_DIR / config.CHECKPOINT_FILE
    with open(checkpoint_path, 'w') as f:
        json.dump(data, f, indent=2)


def format_timestamp() -> str:
    """Get formatted timestamp for reports."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def should_skip_file(file_path: Path) -> bool:
    """
    Check if file should be skipped during processing.

    Args:
        file_path: Path to markdown file

    Returns:
        True if file should be skipped
    """
    filename = file_path.name

    # Skip CONTRIBUTING files
    if filename.startswith('CONTRIBUTING-'):
        return True

    # Skip STANDARD files
    if 'STANDARD' in filename:
        return True

    # Skip index files
    if filename == 'index.md':
        return True

    # Skip hidden files
    if filename.startswith('.'):
        return True

    return False


def get_all_content_files() -> List[Path]:
    """
    Get all markdown content files to process.

    Returns:
        List of Path objects for all content files
    """
    files = []

    for content_dir in [config.POSITIONS_DIR, config.TRANSITIONS_DIR,
                        config.SUBMISSIONS_DIR, config.CONCEPTS_DIR,
                        config.SYSTEMS_DIR]:
        if content_dir.exists():
            for md_file in content_dir.glob('*.md'):
                if not should_skip_file(md_file):
                    files.append(md_file)

    return files


def save_json_report(data: Dict, filename: str):
    """Save report data as JSON."""
    report_path = config.REPORTS_DIR / filename
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return report_path


def save_text_report(content: str, filename: str):
    """Save report as text file."""
    report_path = config.REPORTS_DIR / filename
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(content)
    return report_path
