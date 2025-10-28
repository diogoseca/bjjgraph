#!/usr/bin/env python3
"""
BJJ Graph Link Optimizer - Main CLI

Command-line interface for the link validation and AI-powered suggestion system.

Usage:
    python link_optimizer_cli.py --mode validate
    python link_optimizer_cli.py --mode suggest --max-claude-calls 100
    python link_optimizer_cli.py --mode full --verbose
    python link_optimizer_cli.py --mode random-walk --walk-length 1000
    python link_optimizer_cli.py --mode optimize --strategy pagerank

Modes:
    validate: Validate all wikilinks and generate broken link report
    suggest: Generate AI-powered link suggestions using Claude
    full: Run both validation and suggestions
    random-walk: Validate using random walk traversal
    optimize: Process files using specific graph strategy
    visualize: Generate graph visualization
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

import config
import utils
from graph_builder import GraphBuilder
from link_validator import LinkValidator
from semantic_suggester import SemanticSuggester
from graph_optimizer import GraphOptimizer


def setup_logging(verbose: bool = False):
    """Set up logging configuration."""
    return utils.setup_logging(verbose)


def validate_mode(args):
    """Run link validation mode."""
    logger = logging.getLogger(__name__)
    logger.info("=== Link Validation Mode ===")

    # Build graph
    logger.info("Building graph from content files...")
    graph_builder = GraphBuilder()
    graph_builder.build_graph(verbose=args.verbose)

    # Compute metrics
    graph_builder.compute_metrics(verbose=args.verbose)

    # Validate links
    logger.info("Validating links...")
    validator = LinkValidator(graph_builder)
    result = validator.validate_all(verbose=args.verbose)

    # Save report
    report_path = config.REPORTS_DIR / config.BROKEN_LINKS_REPORT
    validator.save_report(report_path)

    # Print summary
    print("\n" + "="*80)
    print("VALIDATION COMPLETE")
    print("="*80)
    print(f"Total links: {result.total_links}")
    print(f"Valid links: {result.valid_links}")
    print(f"Broken links: {result.broken_count}")
    print(f"Orphan pages: {result.orphan_count}")
    print(f"Dead-end pages: {result.dead_end_count}")
    print(f"\nReport saved to: {report_path}")


async def suggest_mode(args):
    """Run link suggestion mode with Claude AI."""
    logger = logging.getLogger(__name__)
    logger.info("=== Link Suggestion Mode ===")

    # Build graph
    logger.info("Building graph from content files...")
    graph_builder = GraphBuilder()
    graph_builder.build_graph(verbose=args.verbose)
    graph_builder.compute_metrics(verbose=args.verbose)

    # Generate suggestions
    logger.info("Generating link suggestions with Claude AI...")
    logger.info(f"Rate limit: {args.max_concurrent} concurrent calls")

    suggester = SemanticSuggester(graph_builder, max_concurrent=args.max_concurrent)
    result = await suggester.suggest_for_all(
        max_suggestions_per_file=args.max_suggestions,
        verbose=args.verbose
    )

    # Save report
    report_path = config.REPORTS_DIR / config.LINK_SUGGESTIONS_REPORT
    suggester.save_report(report_path)

    # Print summary
    print("\n" + "="*80)
    print("SUGGESTION GENERATION COMPLETE")
    print("="*80)
    print(f"Processed files: {result.processed_files}")
    print(f"Total suggestions: {len(result.suggestions)}")
    print(f"Claude API calls: {result.claude_calls}")
    print(f"Failed files: {len(result.failed_files)}")
    print(f"\nReport saved to: {report_path}")

    # Show top suggestions
    if result.suggestions:
        print("\nTop 10 suggestions:")
        for i, sug in enumerate(result.suggestions[:10], 1):
            print(f"{i}. [{sug.source_file}] → [[{sug.target_file}]] "
                  f"(confidence: {sug.confidence:.0f}%)")
            print(f"   Reason: {sug.reason}")


async def full_mode(args):
    """Run both validation and suggestion modes."""
    logger = logging.getLogger(__name__)
    logger.info("=== Full Mode (Validation + Suggestions) ===")

    # Build graph once
    logger.info("Building graph from content files...")
    graph_builder = GraphBuilder()
    graph_builder.build_graph(verbose=args.verbose)
    graph_builder.compute_metrics(verbose=args.verbose)

    # Save graph metrics
    metrics_path = config.REPORTS_DIR / config.GRAPH_METRICS_REPORT
    utils.save_json_report(graph_builder.metrics, config.GRAPH_METRICS_REPORT)
    logger.info(f"Graph metrics saved to: {metrics_path}")

    # Run validation
    logger.info("\n" + "="*80)
    logger.info("Running link validation...")
    logger.info("="*80)

    validator = LinkValidator(graph_builder)
    val_result = validator.validate_all(verbose=args.verbose)
    validator.save_report(config.REPORTS_DIR / config.BROKEN_LINKS_REPORT)

    # Run suggestions
    logger.info("\n" + "="*80)
    logger.info("Running link suggestions...")
    logger.info("="*80)

    suggester = SemanticSuggester(graph_builder, max_concurrent=args.max_concurrent)
    sug_result = await suggester.suggest_for_all(
        max_suggestions_per_file=args.max_suggestions,
        verbose=args.verbose
    )
    suggester.save_report(config.REPORTS_DIR / config.LINK_SUGGESTIONS_REPORT)

    # Generate summary
    summary = f"""
{'='*80}
FULL ANALYSIS COMPLETE
{'='*80}

GRAPH METRICS:
  Nodes: {graph_builder.graph.number_of_nodes()}
  Edges: {graph_builder.graph.number_of_edges()}
  Density: {graph_builder.metrics.get('density', 0):.4f}
  Components: {graph_builder.metrics.get('component_count', 0)}

LINK VALIDATION:
  Total links: {val_result.total_links}
  Valid: {val_result.valid_links}
  Broken: {val_result.broken_count}
  Orphan pages: {val_result.orphan_count}
  Dead-end pages: {val_result.dead_end_count}

LINK SUGGESTIONS:
  Processed files: {sug_result.processed_files}
  Total suggestions: {len(sug_result.suggestions)}
  Claude API calls: {sug_result.claude_calls}

REPORTS GENERATED:
  - {config.BROKEN_LINKS_REPORT}
  - {config.LINK_SUGGESTIONS_REPORT}
  - {config.GRAPH_METRICS_REPORT}

All reports saved to: {config.REPORTS_DIR}
{'='*80}
    """

    print(summary)

    # Save summary
    summary_path = config.REPORTS_DIR / config.VALIDATION_SUMMARY
    utils.save_text_report(summary, config.VALIDATION_SUMMARY)


def random_walk_mode(args):
    """Run random walk validation mode."""
    logger = logging.getLogger(__name__)
    logger.info("=== Random Walk Mode ===")

    # Build graph
    logger.info("Building graph from content files...")
    graph_builder = GraphBuilder()
    graph_builder.build_graph(verbose=args.verbose)
    graph_builder.compute_metrics()

    # Run random walk
    logger.info(f"Starting random walk (length: {args.walk_length})...")
    optimizer = GraphOptimizer(graph_builder)
    walk_result = optimizer.random_walk(walk_length=args.walk_length)

    # Print results
    print("\n" + "="*80)
    print("RANDOM WALK COMPLETE")
    print("="*80)
    print(f"Strategy: {walk_result.strategy}")
    print(f"Total steps: {walk_result.total_steps}")
    print(f"Unique nodes visited: {len(set(walk_result.nodes_visited))}")
    print(f"Coverage: {walk_result.coverage*100:.1f}%")
    print(f"Edges traversed: {len(walk_result.edges_traversed)}")

    # Save results
    report = {
        'traversal': walk_result.to_dict(),
        'nodes_in_order': walk_result.nodes_visited,
        'timestamp': utils.format_timestamp(),
    }
    report_path = config.REPORTS_DIR / "random_walk_result.json"
    utils.save_json_report(report, "random_walk_result.json")
    print(f"\nResults saved to: {report_path}")


def optimize_mode(args):
    """Run optimization mode with specific strategy."""
    logger = logging.getLogger(__name__)
    logger.info(f"=== Optimize Mode (Strategy: {args.strategy}) ===")

    # Build graph
    logger.info("Building graph from content files...")
    graph_builder = GraphBuilder()
    graph_builder.build_graph(verbose=args.verbose)
    graph_builder.compute_metrics()

    # Get optimizer
    optimizer = GraphOptimizer(graph_builder)

    # Get processing order
    if args.strategy == 'random-walk':
        walk_result = optimizer.random_walk(walk_length=args.walk_length)
        processing_order = walk_result.nodes_visited
        print(f"Random walk coverage: {walk_result.coverage*100:.1f}%")

    elif args.strategy in ['pagerank', 'in_degree', 'out_degree', 'random', 'alphabetical']:
        processing_order = optimizer.get_priority_queue(args.strategy)

    elif args.strategy == 'clusters':
        clusters = optimizer.cluster_based_order()
        # Flatten clusters
        processing_order = [node for cluster in clusters for node in cluster]
        print(f"Found {len(clusters)} clusters")

    else:
        logger.error(f"Unknown strategy: {args.strategy}")
        return

    # Print order
    print("\n" + "="*80)
    print(f"PROCESSING ORDER ({args.strategy})")
    print("="*80)
    print(f"Total nodes: {len(processing_order)}")
    print("\nFirst 20 files to process:")
    for i, node in enumerate(processing_order[:20], 1):
        pagerank = graph_builder.metrics['pagerank'].get(node, 0)
        print(f"{i:3d}. {node:40s} (PageRank: {pagerank:.6f})")

    # Save order
    report = {
        'strategy': args.strategy,
        'processing_order': processing_order,
        'total_nodes': len(processing_order),
        'timestamp': utils.format_timestamp(),
    }
    report_path = config.REPORTS_DIR / f"processing_order_{args.strategy}.json"
    utils.save_json_report(report, f"processing_order_{args.strategy}.json")
    print(f"\nProcessing order saved to: {report_path}")


def visualize_mode(args):
    """Generate graph visualization."""
    logger = logging.getLogger(__name__)
    logger.info("=== Visualization Mode ===")

    # Build graph
    logger.info("Building graph from content files...")
    graph_builder = GraphBuilder()
    graph_builder.build_graph(verbose=args.verbose)
    graph_builder.compute_metrics()

    # Export for visualization
    viz_path = config.REPORTS_DIR / config.GRAPH_VISUALIZATION
    graph_builder.export_for_visualization(viz_path)

    print("\n" + "="*80)
    print("VISUALIZATION EXPORT COMPLETE")
    print("="*80)
    print(f"Nodes: {graph_builder.graph.number_of_nodes()}")
    print(f"Edges: {graph_builder.graph.number_of_edges()}")
    print(f"\nVisualization data saved to: {viz_path}")
    print("\nUse a D3.js force-directed graph to visualize this data.")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="BJJ Graph Link Optimizer - Validate links and suggest connections",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--mode',
        choices=['validate', 'suggest', 'full', 'random-walk', 'optimize', 'visualize'],
        default='full',
        help='Operation mode (default: full)'
    )

    parser.add_argument(
        '--strategy',
        choices=['pagerank', 'in_degree', 'out_degree', 'random', 'alphabetical',
                'clusters', 'random-walk'],
        default='pagerank',
        help='Graph traversal strategy for optimize mode (default: pagerank)'
    )

    parser.add_argument(
        '--walk-length',
        type=int,
        default=1000,
        help='Length of random walk (default: 1000)'
    )

    parser.add_argument(
        '--max-concurrent',
        type=int,
        default=config.MAX_CONCURRENT_CLAUDE_CALLS,
        help=f'Max concurrent Claude API calls (default: {config.MAX_CONCURRENT_CLAUDE_CALLS})'
    )

    parser.add_argument(
        '--max-suggestions',
        type=int,
        default=config.MAX_SUGGESTIONS_PER_PAGE,
        help=f'Max suggestions per page (default: {config.MAX_SUGGESTIONS_PER_PAGE})'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Verbose output with progress bars'
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.verbose)

    try:
        # Route to appropriate mode
        if args.mode == 'validate':
            validate_mode(args)

        elif args.mode == 'suggest':
            asyncio.run(suggest_mode(args))

        elif args.mode == 'full':
            asyncio.run(full_mode(args))

        elif args.mode == 'random-walk':
            random_walk_mode(args)

        elif args.mode == 'optimize':
            optimize_mode(args)

        elif args.mode == 'visualize':
            visualize_mode(args)

    except KeyboardInterrupt:
        print("\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
