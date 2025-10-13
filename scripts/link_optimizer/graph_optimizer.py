"""
Graph Optimizer with Multiple Traversal Strategies

Implements various graph traversal algorithms for optimizing link validation
and suggestion processes:

1. PageRank Priority: Process high-value hub pages first
2. Random Walk: Stochastic traversal following random links (as requested)
3. BFS (Breadth-First Search): Systematic level-by-level traversal
4. DFS (Depth-First Search): Deep path exploration
5. Cluster-Based: Process each connected component separately
6. Degree-Based: Prioritize pages with few connections

These strategies help optimize processing order and discover patterns in the
graph structure.
"""

import random
import logging
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple, Iterator
from collections import deque
from dataclasses import dataclass, field

import networkx as nx

import config
from graph_builder import GraphBuilder


logger = logging.getLogger(__name__)


@dataclass
class TraversalResult:
    """Results from a graph traversal."""
    strategy: str
    nodes_visited: List[str] = field(default_factory=list)
    edges_traversed: List[Tuple[str, str]] = field(default_factory=list)
    total_steps: int = 0
    coverage: float = 0.0  # Percentage of nodes visited

    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            'strategy': self.strategy,
            'total_steps': self.total_steps,
            'nodes_visited_count': len(self.nodes_visited),
            'edges_traversed_count': len(self.edges_traversed),
            'coverage_percent': self.coverage * 100,
        }


class GraphOptimizer:
    """Optimize graph traversal for link validation and suggestion."""

    def __init__(self, graph_builder: GraphBuilder):
        """
        Initialize GraphOptimizer.

        Args:
            graph_builder: GraphBuilder instance with built graph
        """
        self.graph_builder = graph_builder
        self.graph = graph_builder.graph

        if not self.graph_builder.metrics:
            self.graph_builder.compute_metrics()

    def pagerank_priority_order(self) -> List[str]:
        """
        Get nodes ordered by PageRank (most important first).

        Returns:
            List of node IDs in priority order
        """
        logger.info("Computing PageRank priority order...")

        pagerank = self.graph_builder.metrics.get('pagerank', {})
        sorted_nodes = sorted(pagerank.items(), key=lambda x: x[1], reverse=True)

        return [node for node, score in sorted_nodes]

    def random_walk(self, start_node: Optional[str] = None,
                   walk_length: int = 1000,
                   restart_prob: float = config.RANDOM_WALK_DAMPING) -> TraversalResult:
        """
        Perform random walk traversal (as requested by user).

        At each step:
        - With probability (1 - restart_prob): Follow a random outgoing edge
        - With probability restart_prob: Jump to a random node

        This implements the "random order processing with random link following"
        requested in the spec.

        Args:
            start_node: Starting node (random if None)
            walk_length: Number of steps to take
            restart_prob: Probability of random restart (damping factor)

        Returns:
            TraversalResult with visited nodes and edges
        """
        logger.info(f"Starting random walk for {walk_length} steps...")

        result = TraversalResult(strategy="random_walk")
        all_nodes = list(self.graph.nodes())

        if not all_nodes:
            return result

        # Random starting node if not specified
        current = start_node or random.choice(all_nodes)
        visited_nodes = set()
        visited_edges = set()

        for step in range(walk_length):
            visited_nodes.add(current)
            result.nodes_visited.append(current)
            result.total_steps += 1

            # Get outgoing edges
            successors = list(self.graph.successors(current))

            # Decide: follow edge or restart?
            if successors and random.random() > restart_prob:
                # Follow random outgoing edge
                next_node = random.choice(successors)
                edge = (current, next_node)
                visited_edges.add(edge)
                result.edges_traversed.append(edge)
                current = next_node
            else:
                # Random restart (jump to random node)
                current = random.choice(all_nodes)

        # Calculate coverage
        result.coverage = len(visited_nodes) / len(all_nodes)

        logger.info(f"Random walk completed: visited {len(visited_nodes)}/{len(all_nodes)} nodes "
                   f"({result.coverage*100:.1f}% coverage)")

        return result

    def bfs_traversal(self, start_node: Optional[str] = None) -> TraversalResult:
        """
        Breadth-First Search traversal.

        Visits nodes level by level from the starting node.

        Args:
            start_node: Starting node (highest PageRank if None)

        Returns:
            TraversalResult with visited nodes in BFS order
        """
        logger.info("Starting BFS traversal...")

        result = TraversalResult(strategy="bfs")

        if not self.graph.nodes():
            return result

        # Choose starting node
        if start_node is None:
            # Use highest PageRank node
            pagerank = self.graph_builder.metrics.get('pagerank', {})
            start_node = max(pagerank.items(), key=lambda x: x[1])[0]

        visited = set()
        queue = deque([start_node])

        while queue:
            current = queue.popleft()

            if current in visited:
                continue

            visited.add(current)
            result.nodes_visited.append(current)
            result.total_steps += 1

            # Add successors to queue
            for successor in self.graph.successors(current):
                if successor not in visited:
                    queue.append(successor)
                    edge = (current, successor)
                    result.edges_traversed.append(edge)

        result.coverage = len(visited) / self.graph.number_of_nodes()

        logger.info(f"BFS completed: visited {len(visited)} nodes")

        return result

    def dfs_traversal(self, start_node: Optional[str] = None) -> TraversalResult:
        """
        Depth-First Search traversal.

        Explores as deep as possible before backtracking.

        Args:
            start_node: Starting node (highest PageRank if None)

        Returns:
            TraversalResult with visited nodes in DFS order
        """
        logger.info("Starting DFS traversal...")

        result = TraversalResult(strategy="dfs")

        if not self.graph.nodes():
            return result

        # Choose starting node
        if start_node is None:
            pagerank = self.graph_builder.metrics.get('pagerank', {})
            start_node = max(pagerank.items(), key=lambda x: x[1])[0]

        visited = set()

        def dfs_recursive(node):
            if node in visited:
                return

            visited.add(node)
            result.nodes_visited.append(node)
            result.total_steps += 1

            for successor in self.graph.successors(node):
                if successor not in visited:
                    edge = (node, successor)
                    result.edges_traversed.append(edge)
                    dfs_recursive(successor)

        dfs_recursive(start_node)

        result.coverage = len(visited) / self.graph.number_of_nodes()

        logger.info(f"DFS completed: visited {len(visited)} nodes")

        return result

    def cluster_based_order(self) -> List[List[str]]:
        """
        Get nodes grouped by connected components.

        Returns list of clusters, each cluster is a list of nodes.

        Returns:
            List of clusters (each cluster is a list of node IDs)
        """
        logger.info("Computing cluster-based order...")

        # Use undirected version for connected components
        undirected = self.graph.to_undirected()
        components = list(nx.connected_components(undirected))

        # Sort components by size (largest first)
        sorted_components = sorted(components, key=len, reverse=True)

        # Convert sets to lists
        clusters = [list(comp) for comp in sorted_components]

        logger.info(f"Found {len(clusters)} clusters")
        logger.info(f"Largest cluster: {len(clusters[0])} nodes")

        return clusters

    def degree_based_order(self, order_by: str = 'in_degree',
                          ascending: bool = True) -> List[str]:
        """
        Get nodes ordered by degree centrality.

        Useful for finding pages that need more connections.

        Args:
            order_by: 'in_degree', 'out_degree', or 'total_degree'
            ascending: If True, low degree first (needs connections)
                      If False, high degree first (important hubs)

        Returns:
            List of node IDs in degree order
        """
        logger.info(f"Computing degree-based order ({order_by})...")

        if order_by == 'in_degree':
            degrees = dict(self.graph.in_degree())
        elif order_by == 'out_degree':
            degrees = dict(self.graph.out_degree())
        else:  # total_degree
            degrees = dict(self.graph.degree())

        sorted_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=not ascending)

        return [node for node, degree in sorted_nodes]

    def get_priority_queue(self, strategy: str = 'pagerank',
                          **kwargs) -> List[str]:
        """
        Get prioritized node processing order based on strategy.

        Args:
            strategy: Traversal strategy
                - 'pagerank': Order by PageRank scores
                - 'in_degree': Order by incoming links (low first = orphans)
                - 'out_degree': Order by outgoing links (low first = dead ends)
                - 'random': Random shuffle
                - 'alphabetical': Alphabetical order
            **kwargs: Additional arguments for specific strategies

        Returns:
            List of node IDs in processing order
        """
        logger.info(f"Building priority queue with strategy: {strategy}")

        if strategy == 'pagerank':
            return self.pagerank_priority_order()

        elif strategy == 'in_degree':
            ascending = kwargs.get('ascending', True)
            return self.degree_based_order('in_degree', ascending)

        elif strategy == 'out_degree':
            ascending = kwargs.get('ascending', True)
            return self.degree_based_order('out_degree', ascending)

        elif strategy == 'random':
            nodes = list(self.graph.nodes())
            random.shuffle(nodes)
            return nodes

        elif strategy == 'alphabetical':
            return sorted(self.graph.nodes())

        else:
            logger.warning(f"Unknown strategy '{strategy}', using alphabetical")
            return sorted(self.graph.nodes())

    def find_missing_edges(self, min_shared_neighbors: int = 2) -> List[Tuple[str, str, int]]:
        """
        Find potential missing edges based on shared neighbors.

        If nodes A and B both link to C, D, E (shared neighbors), but don't
        link to each other, they might be related and should link.

        Args:
            min_shared_neighbors: Minimum shared neighbors to suggest link

        Returns:
            List of (node_a, node_b, shared_count) tuples
        """
        logger.info(f"Finding missing edges (min shared neighbors: {min_shared_neighbors})...")

        missing = []

        for node_a in self.graph.nodes():
            neighbors_a = set(self.graph.successors(node_a))

            for node_b in self.graph.nodes():
                if node_a >= node_b:  # Avoid duplicates and self-loops
                    continue

                # Check if edge already exists
                if self.graph.has_edge(node_a, node_b) or self.graph.has_edge(node_b, node_a):
                    continue

                neighbors_b = set(self.graph.successors(node_b))

                # Count shared neighbors
                shared = neighbors_a & neighbors_b
                shared_count = len(shared)

                if shared_count >= min_shared_neighbors:
                    missing.append((node_a, node_b, shared_count))

        # Sort by shared count (most shared first)
        missing.sort(key=lambda x: x[2], reverse=True)

        logger.info(f"Found {len(missing)} potential missing edges")

        return missing

    def get_hub_pages(self, top_n: int = 20) -> List[Tuple[str, float]]:
        """
        Get top hub pages by PageRank.

        Args:
            top_n: Number of top pages to return

        Returns:
            List of (node_id, pagerank_score) tuples
        """
        top_pages = self.graph_builder.metrics.get('top_pages', [])
        return top_pages[:top_n]

    def get_bridge_pages(self, top_n: int = 20) -> List[Tuple[str, float]]:
        """
        Get top bridge pages by betweenness centrality.

        Bridge pages connect different clusters of content.

        Args:
            top_n: Number of top pages to return

        Returns:
            List of (node_id, betweenness_score) tuples
        """
        bridge_pages = self.graph_builder.metrics.get('bridge_pages', [])
        return bridge_pages[:top_n]

    def get_isolated_components(self) -> List[List[str]]:
        """
        Get isolated components (clusters with < 5 nodes).

        These are small groups of pages that aren't well-connected to the main graph.

        Returns:
            List of isolated components
        """
        isolated = self.graph_builder.metrics.get('isolated_components', [])
        return isolated

    def shuffle_with_bias(self, nodes: List[str], pagerank_bias: float = 0.3) -> List[str]:
        """
        Shuffle nodes with bias toward high PageRank pages.

        Combines randomness with importance scoring.

        Args:
            nodes: List of node IDs
            pagerank_bias: Weight for PageRank (0=pure random, 1=pure PageRank)

        Returns:
            Shuffled list with bias
        """
        pagerank = self.graph_builder.metrics.get('pagerank', {})

        # Assign weights: pagerank + random component
        weighted = []
        for node in nodes:
            pr_score = pagerank.get(node, 0)
            random_score = random.random()
            combined_score = (pagerank_bias * pr_score +
                            (1 - pagerank_bias) * random_score)
            weighted.append((node, combined_score))

        # Sort by combined score
        weighted.sort(key=lambda x: x[1], reverse=True)

        return [node for node, score in weighted]
