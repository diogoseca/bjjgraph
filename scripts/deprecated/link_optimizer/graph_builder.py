"""
Graph Builder for BJJ Graph Knowledge Base

Builds a NetworkX graph from markdown files where:
- Nodes = markdown files (positions, transitions, submissions, concepts, systems)
- Edges = wikilinks between files
- Node attributes = metadata (type, ID, title, keywords, content length)
- Edge attributes = weight (link frequency), bidirectional flag

Computes graph metrics:
- PageRank (importance scores)
- Degree centrality (connection counts)
- Betweenness centrality (bridge identification)
- Connected components (isolated clusters)
"""

import logging
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict
import re

import networkx as nx
from tqdm import tqdm

import config
import utils


logger = logging.getLogger(__name__)


class GraphBuilder:
    """Build and analyze NetworkX graph from BJJ content."""

    def __init__(self, content_dir: Path = config.CONTENT_DIR):
        """
        Initialize GraphBuilder.

        Args:
            content_dir: Root content directory
        """
        self.content_dir = Path(content_dir)
        self.graph = nx.DiGraph()  # Directed graph (links have direction)
        self.file_map: Dict[str, Path] = {}  # Normalized name -> file path
        self.id_map: Dict[str, str] = {}  # ID -> normalized name
        self.metrics: Dict = {}

    def build_graph(self, verbose: bool = False) -> nx.DiGraph:
        """
        Build complete graph from all content files.

        Args:
            verbose: Show progress bar

        Returns:
            NetworkX directed graph
        """
        logger.info("Building graph from content files...")

        # Get all content files
        files = utils.get_all_content_files()
        logger.info(f"Found {len(files)} content files")

        # Build file map first
        self._build_file_map(files)

        # Add nodes and edges
        iterator = tqdm(files, desc="Building graph") if verbose else files

        for file_path in iterator:
            self._process_file(file_path)

        logger.info(f"Graph built: {self.graph.number_of_nodes()} nodes, "
                   f"{self.graph.number_of_edges()} edges")

        return self.graph

    def _build_file_map(self, files: List[Path]):
        """Build mapping from normalized names to file paths."""
        for file_path in files:
            normalized = utils.normalize_link_target(file_path.stem)
            self.file_map[normalized] = file_path

            # Also map by actual stem for exact matching
            self.file_map[file_path.stem] = file_path

    def _process_file(self, file_path: Path):
        """Process a single file: add node and edges."""
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception as e:
            logger.warning(f"Failed to read {file_path}: {e}")
            return

        # Extract metadata
        frontmatter, body = utils.extract_frontmatter(content)
        content_type = utils.determine_content_type(file_path)
        content_id = utils.extract_content_id(content, content_type)
        keywords = utils.extract_keywords(body, num_keywords=10)
        wikilinks = utils.extract_wikilinks(content)

        # Add node
        node_id = file_path.stem
        self.graph.add_node(
            node_id,
            file_path=str(file_path),
            content_type=content_type,
            content_id=content_id,
            title=frontmatter.get('title', file_path.stem),
            description=frontmatter.get('description', ''),
            keywords=keywords,
            content_length=len(content),
            wikilink_count=len(wikilinks),
        )

        # Map ID to node if exists
        if content_id:
            self.id_map[content_id] = node_id

        # Add edges for wikilinks
        for link in wikilinks:
            self._add_edge(node_id, link)

    def _add_edge(self, source: str, target_link: str):
        """Add edge for a wikilink."""
        # Normalize target
        normalized = utils.normalize_link_target(target_link)

        # Find target node
        target_node = None

        # Try exact match first
        if target_link in self.file_map:
            target_node = self.file_map[target_link].stem
        # Try normalized match
        elif normalized in self.file_map:
            target_node = self.file_map[normalized].stem
        # Try as ID
        elif target_link in self.id_map:
            target_node = self.id_map[target_link]

        if target_node:
            # Add or update edge
            if self.graph.has_edge(source, target_node):
                # Increment weight if edge exists
                self.graph[source][target_node]['weight'] += 1
            else:
                # Create new edge
                self.graph.add_edge(source, target_node, weight=1)

    def compute_metrics(self, verbose: bool = False) -> Dict:
        """
        Compute graph metrics.

        Args:
            verbose: Log detailed metrics

        Returns:
            Dictionary of graph metrics
        """
        logger.info("Computing graph metrics...")

        metrics = {}

        # Basic stats
        metrics['node_count'] = self.graph.number_of_nodes()
        metrics['edge_count'] = self.graph.number_of_edges()
        metrics['average_degree'] = sum(dict(self.graph.degree()).values()) / metrics['node_count'] if metrics['node_count'] > 0 else 0

        # PageRank (importance scores)
        logger.info("Computing PageRank...")
        pagerank = nx.pagerank(self.graph, alpha=config.PAGERANK_ALPHA)
        metrics['pagerank'] = pagerank
        metrics['top_pages'] = sorted(pagerank.items(), key=lambda x: x[1], reverse=True)[:20]

        # Degree centrality
        logger.info("Computing degree centrality...")
        in_degree = dict(self.graph.in_degree())
        out_degree = dict(self.graph.out_degree())
        metrics['in_degree'] = in_degree
        metrics['out_degree'] = out_degree

        # Identify orphan pages (no incoming links)
        metrics['orphan_pages'] = [node for node, degree in in_degree.items() if degree == 0]
        # Identify dead-end pages (no outgoing links)
        metrics['dead_end_pages'] = [node for node, degree in out_degree.items() if degree == 0]

        # Betweenness centrality (bridge pages)
        logger.info("Computing betweenness centrality...")
        betweenness = nx.betweenness_centrality(self.graph)
        metrics['betweenness'] = betweenness
        metrics['bridge_pages'] = sorted(betweenness.items(), key=lambda x: x[1], reverse=True)[:20]

        # Connected components (using underlying undirected graph)
        logger.info("Finding connected components...")
        undirected = self.graph.to_undirected()
        components = list(nx.connected_components(undirected))
        metrics['component_count'] = len(components)
        metrics['component_sizes'] = [len(c) for c in components]
        metrics['largest_component_size'] = max(metrics['component_sizes']) if components else 0

        # Find isolated components (size < 5)
        metrics['isolated_components'] = [list(c) for c in components if len(c) < 5 and len(c) > 1]

        # Reciprocity (bidirectional links)
        logger.info("Computing reciprocity...")
        reciprocity = nx.reciprocity(self.graph)
        metrics['reciprocity'] = reciprocity

        # Density (actual edges / possible edges)
        density = nx.density(self.graph)
        metrics['density'] = density

        if verbose:
            self._log_metrics(metrics)

        self.metrics = metrics
        return metrics

    def _log_metrics(self, metrics: Dict):
        """Log detailed metrics."""
        logger.info("\n=== Graph Metrics ===")
        logger.info(f"Nodes: {metrics['node_count']}")
        logger.info(f"Edges: {metrics['edge_count']}")
        logger.info(f"Average degree: {metrics['average_degree']:.2f}")
        logger.info(f"Density: {metrics['density']:.4f}")
        logger.info(f"Reciprocity: {metrics['reciprocity']:.4f}")
        logger.info(f"Connected components: {metrics['component_count']}")
        logger.info(f"Largest component: {metrics['largest_component_size']} nodes")
        logger.info(f"Orphan pages: {len(metrics['orphan_pages'])}")
        logger.info(f"Dead-end pages: {len(metrics['dead_end_pages'])}")

        logger.info("\nTop 10 pages by PageRank:")
        for i, (page, score) in enumerate(metrics['top_pages'][:10], 1):
            logger.info(f"  {i}. {page}: {score:.6f}")

    def get_node_neighbors(self, node_id: str, include_incoming: bool = True,
                          include_outgoing: bool = True) -> Dict[str, List[str]]:
        """
        Get neighbors of a node.

        Args:
            node_id: Node identifier
            include_incoming: Include nodes that link TO this node
            include_outgoing: Include nodes that this node links TO

        Returns:
            Dict with 'incoming' and 'outgoing' neighbor lists
        """
        neighbors = {}

        if include_incoming:
            neighbors['incoming'] = list(self.graph.predecessors(node_id))

        if include_outgoing:
            neighbors['outgoing'] = list(self.graph.successors(node_id))

        return neighbors

    def find_shortest_path(self, source: str, target: str) -> Optional[List[str]]:
        """
        Find shortest path between two nodes.

        Args:
            source: Source node ID
            target: Target node ID

        Returns:
            List of nodes in path, or None if no path exists
        """
        try:
            return nx.shortest_path(self.graph, source, target)
        except nx.NetworkXNoPath:
            return None

    def get_page_score(self, node_id: str, metric: str = 'pagerank') -> float:
        """
        Get score for a page.

        Args:
            node_id: Node identifier
            metric: Metric to use ('pagerank', 'betweenness', 'in_degree', 'out_degree')

        Returns:
            Score value
        """
        if not self.metrics:
            self.compute_metrics()

        if metric in self.metrics:
            return self.metrics[metric].get(node_id, 0.0)

        return 0.0

    def export_for_visualization(self, output_path: Path):
        """
        Export graph in format suitable for D3.js visualization.

        Args:
            output_path: Path to save JSON file
        """
        logger.info(f"Exporting graph for visualization to {output_path}")

        # Prepare nodes
        nodes = []
        for node_id in self.graph.nodes():
            node_data = self.graph.nodes[node_id]
            pagerank = self.get_page_score(node_id, 'pagerank')
            in_degree = self.get_page_score(node_id, 'in_degree')
            out_degree = self.get_page_score(node_id, 'out_degree')

            nodes.append({
                'id': node_id,
                'title': node_data.get('title', node_id),
                'type': node_data.get('content_type', 'Unknown'),
                'pagerank': pagerank,
                'in_degree': int(in_degree),
                'out_degree': int(out_degree),
            })

        # Prepare edges
        edges = []
        for source, target, edge_data in self.graph.edges(data=True):
            edges.append({
                'source': source,
                'target': target,
                'weight': edge_data.get('weight', 1),
            })

        # Save as JSON
        import json
        with open(output_path, 'w') as f:
            json.dump({
                'nodes': nodes,
                'edges': edges,
                'metrics': {
                    'node_count': self.metrics.get('node_count', 0),
                    'edge_count': self.metrics.get('edge_count', 0),
                    'density': self.metrics.get('density', 0),
                }
            }, f, indent=2)

        logger.info(f"Exported {len(nodes)} nodes and {len(edges)} edges")

    def save_graph(self, output_path: Path):
        """
        Save graph to file for later loading.

        Args:
            output_path: Path to save graph
        """
        import pickle
        with open(output_path, 'wb') as f:
            pickle.dump({
                'graph': self.graph,
                'file_map': self.file_map,
                'id_map': self.id_map,
                'metrics': self.metrics,
            }, f)
        logger.info(f"Graph saved to {output_path}")

    def load_graph(self, input_path: Path):
        """
        Load graph from file.

        Args:
            input_path: Path to load graph from
        """
        import pickle
        with open(input_path, 'rb') as f:
            data = pickle.load(f)
            self.graph = data['graph']
            self.file_map = data['file_map']
            self.id_map = data['id_map']
            self.metrics = data.get('metrics', {})
        logger.info(f"Graph loaded from {input_path}: "
                   f"{self.graph.number_of_nodes()} nodes, "
                   f"{self.graph.number_of_edges()} edges")
