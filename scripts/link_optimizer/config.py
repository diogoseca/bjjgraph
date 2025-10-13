"""
Configuration settings for BJJ Graph Link Optimizer
"""

import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent  # bjjgraph root
CONTENT_DIR = BASE_DIR / "source" / "content"
REPORTS_DIR = BASE_DIR / "reports" / "link_optimizer"
CACHE_DIR = BASE_DIR / ".cache" / "link_optimizer"

# Content directories
POSITIONS_DIR = CONTENT_DIR / "Positions"
TRANSITIONS_DIR = CONTENT_DIR / "Transitions"
SUBMISSIONS_DIR = CONTENT_DIR / "Submissions"
CONCEPTS_DIR = CONTENT_DIR / "Concepts"
SYSTEMS_DIR = CONTENT_DIR / "Systems"

# Create directories if they don't exist
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Claude CLI settings
CLAUDE_CLI_PATH = "/Users/diogo/anaconda3/bin/claude"
MAX_CONCURRENT_CLAUDE_CALLS = 20  # Rate limiting
CLAUDE_MODEL = "sonnet"  # Model alias: 'sonnet', 'opus', or 'haiku'
CLAUDE_TIMEOUT = 60  # seconds
CLAUDE_MAX_RETRIES = 3
CLAUDE_BACKOFF_BASE = 2  # exponential backoff base

# Link validation settings
WIKILINK_PATTERN = r'\[\[([^\]]+)\]\]'
SPECIAL_PAGES = [
    "Won by Submission",
    "Guard Opening Sequence",
    "Posture and Base",
]

# Graph optimization settings
PAGERANK_ALPHA = 0.85  # damping factor
RANDOM_WALK_DAMPING = 0.15  # probability of random jump
MIN_CONFIDENCE_SCORE = 60  # minimum confidence for link suggestions

# Content type identifiers
CONTENT_TYPES = {
    'Positions': {'id_prefix': 'S', 'id_pattern': r'S\d{3}'},
    'Transitions': {'id_prefix': 'T', 'id_pattern': r'T\d{3}'},
    'Submissions': {'id_prefix': 'SUB', 'id_pattern': r'SUB\d{3}|S\d{3}'},
    'Concepts': {'id_prefix': 'C', 'id_pattern': r'C\d{3}'},
    'Systems': {'id_prefix': 'SC', 'id_pattern': r'SC\d{3}'},
}

# BJJ domain knowledge - position hierarchies
BJJ_POSITION_HIERARCHY = {
    'dominant': ['Mount', 'Back Control', 'Side Control', 'North-South', 'Knee on Belly'],
    'neutral': ['Standing Position', 'Clinch Position', 'Neutral Position'],
    'guard': ['Closed Guard', 'Open Guard', 'Half Guard', 'Butterfly Guard', 'X-Guard'],
    'submission_control': ['Armbar Control', 'Triangle Control', 'Kimura Control'],
}

# Relationship types for link suggestions
LINK_RELATIONSHIP_TYPES = [
    'position-to-transition',  # Position → Technique
    'transition-to-position',  # Technique → Position
    'position-to-submission',  # Position → Submission
    'submission-to-control',   # Submission → Control Position
    'position-to-position',    # Related positions
    'concept-to-position',     # Concept → Positions where it applies
    'system-to-technique',     # System → Techniques in chain
]

# Logging settings
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
LOG_FILE = REPORTS_DIR / "link_optimizer.log"

# Performance settings
BATCH_SIZE = 10  # files to process in parallel
CHECKPOINT_INTERVAL = 50  # save progress every N files
MAX_SUGGESTIONS_PER_PAGE = 10  # maximum link suggestions per page

# Graph visualization settings
GRAPH_VIZ_WIDTH = 1200
GRAPH_VIZ_HEIGHT = 800
GRAPH_NODE_SIZE_RANGE = (10, 100)  # min, max based on PageRank
GRAPH_EDGE_WIDTH_RANGE = (1, 5)    # min, max based on edge weight

# Report file names
BROKEN_LINKS_REPORT = "broken_links_report.json"
LINK_SUGGESTIONS_REPORT = "link_suggestions_report.json"
GRAPH_METRICS_REPORT = "graph_metrics_report.json"
VALIDATION_SUMMARY = "validation_summary.txt"
GRAPH_VISUALIZATION = "graph_visualization.html"
CHECKPOINT_FILE = "checkpoint.json"
