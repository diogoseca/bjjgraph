"""
BJJ Graph Link Optimizer

A comprehensive link validation and AI-powered suggestion system for the BJJ Graph
knowledge base. Uses graph theory, Claude AI, and stochastic methods to optimize
internal linking structure.

Components:
- graph_builder: Build NetworkX graph from markdown files
- link_validator: Validate wikilinks and find broken links
- semantic_suggester: AI-powered link suggestions using Claude CLI
- graph_optimizer: Graph traversal strategies (PageRank, Random Walk, BFS)
- link_optimizer_cli: Main CLI orchestrator

Author: Claude Code
Version: 1.0.0
"""

__version__ = "1.0.0"
__author__ = "Claude Code"

from .graph_builder import GraphBuilder
from .link_validator import LinkValidator
from .semantic_suggester import SemanticSuggester
from .graph_optimizer import GraphOptimizer

__all__ = [
    "GraphBuilder",
    "LinkValidator",
    "SemanticSuggester",
    "GraphOptimizer",
]
