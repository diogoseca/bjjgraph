"""
Semantic Link Suggester using Claude CLI

Uses Claude AI to analyze content and suggest intelligent internal links based on:
- Semantic similarity between pages
- BJJ domain knowledge (positions → transitions → submissions)
- Graph structure gaps (missing edges in common subgraphs)
- Content relevance and relationships

Features:
- Async processing with rate limiting (max 20 concurrent calls)
- Queue system for efficient API usage
- Confidence scoring for suggestions
- Exponential backoff on rate limits
"""

import asyncio
import json
import logging
import subprocess
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
from dataclasses import dataclass, field
import re

from tqdm.asyncio import tqdm as async_tqdm

import config
import utils
from graph_builder import GraphBuilder


logger = logging.getLogger(__name__)


@dataclass
class LinkSuggestion:
    """A suggested internal link."""
    source_file: str
    target_file: str
    confidence: float  # 0-100
    reason: str
    suggested_section: str
    relationship_type: str  # e.g., 'position-to-transition'
    existing_link: bool = False


@dataclass
class SuggestionResult:
    """Results from semantic analysis."""
    suggestions: List[LinkSuggestion] = field(default_factory=list)
    processed_files: int = 0
    failed_files: List[str] = field(default_factory=list)
    claude_calls: int = 0

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'summary': {
                'total_suggestions': len(self.suggestions),
                'processed_files': self.processed_files,
                'failed_files': len(self.failed_files),
                'claude_calls': self.claude_calls,
            },
            'suggestions': [
                {
                    'source_file': s.source_file,
                    'target_file': s.target_file,
                    'confidence': s.confidence,
                    'reason': s.reason,
                    'suggested_section': s.suggested_section,
                    'relationship_type': s.relationship_type,
                    'existing_link': s.existing_link,
                }
                for s in self.suggestions
            ],
            'failed_files': self.failed_files,
        }


class SemanticSuggester:
    """Suggest links using Claude AI semantic analysis."""

    def __init__(self, graph_builder: Optional[GraphBuilder] = None,
                 max_concurrent: int = config.MAX_CONCURRENT_CLAUDE_CALLS):
        """
        Initialize SemanticSuggester.

        Args:
            graph_builder: Existing GraphBuilder instance
            max_concurrent: Maximum concurrent Claude API calls
        """
        self.graph_builder = graph_builder or GraphBuilder()
        if not self.graph_builder.graph.number_of_nodes():
            self.graph_builder.build_graph()

        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.result = SuggestionResult()

    async def suggest_for_all(self, max_suggestions_per_file: int = 5,
                             verbose: bool = False) -> SuggestionResult:
        """
        Generate link suggestions for all content files.

        Args:
            max_suggestions_per_file: Maximum suggestions per file
            verbose: Show progress bar

        Returns:
            SuggestionResult with all suggestions
        """
        logger.info("Starting semantic link suggestion with Claude AI...")

        # Get all files
        files = utils.get_all_content_files()

        # Process files concurrently with rate limiting
        tasks = [
            self._suggest_for_file(file_path, max_suggestions_per_file)
            for file_path in files
        ]

        if verbose:
            results = await async_tqdm.gather(*tasks, desc="Analyzing with Claude")
        else:
            results = await asyncio.gather(*tasks)

        # Aggregate results
        for file_suggestions in results:
            if file_suggestions:
                self.result.suggestions.extend(file_suggestions)

        # Remove duplicates and filter by confidence
        self._filter_suggestions()

        logger.info(f"Generated {len(self.result.suggestions)} link suggestions")
        return self.result

    async def _suggest_for_file(self, file_path: Path,
                               max_suggestions: int) -> List[LinkSuggestion]:
        """Generate suggestions for a single file."""
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception as e:
            logger.warning(f"Failed to read {file_path}: {e}")
            self.result.failed_files.append(file_path.stem)
            return []

        node_id = file_path.stem

        # Get candidate pages to link to
        candidates = self._get_candidate_pages(node_id, max_candidates=20)

        if not candidates:
            return []

        # Use Claude to analyze and suggest links
        suggestions = await self._analyze_with_claude(node_id, content, candidates)

        self.result.processed_files += 1
        return suggestions

    def _get_candidate_pages(self, source_node: str, max_candidates: int = 20) -> List[str]:
        """
        Get candidate pages that might be relevant to link to.

        Uses graph structure and content type to find candidates.

        Args:
            source_node: Source node ID
            max_candidates: Maximum candidates to return

        Returns:
            List of candidate node IDs
        """
        graph = self.graph_builder.graph

        if source_node not in graph:
            return []

        # Get node data
        source_data = graph.nodes[source_node]
        source_type = source_data.get('content_type', 'Unknown')

        # Find candidates based on:
        # 1. High PageRank pages (important hubs)
        # 2. Pages of related types (positions → transitions → submissions)
        # 3. Pages with shared neighbors (common context)

        candidates = set()

        # Add high PageRank pages
        if self.graph_builder.metrics:
            top_pages = self.graph_builder.metrics.get('top_pages', [])
            candidates.update([page for page, score in top_pages[:10]])

        # Add pages based on content type relationships
        related_types = self._get_related_content_types(source_type)
        for node in graph.nodes():
            node_type = graph.nodes[node].get('content_type', 'Unknown')
            if node_type in related_types and node != source_node:
                candidates.add(node)

        # Add pages with shared neighbors (2-hop distance)
        neighbors = set(graph.successors(source_node))
        for neighbor in list(neighbors)[:10]:  # Limit to prevent explosion
            neighbors2 = set(graph.successors(neighbor))
            candidates.update(list(neighbors2)[:5])

        # Remove source node and existing links
        candidates.discard(source_node)
        candidates -= neighbors

        # Rank by PageRank and take top candidates
        if self.graph_builder.metrics:
            pagerank = self.graph_builder.metrics.get('pagerank', {})
            ranked = sorted(candidates, key=lambda x: pagerank.get(x, 0), reverse=True)
            return ranked[:max_candidates]

        return list(candidates)[:max_candidates]

    def _get_related_content_types(self, content_type: str) -> List[str]:
        """Get related content types for a given type."""
        relationships = {
            'Positions': ['Transitions', 'Submissions', 'Concepts'],
            'Transitions': ['Positions', 'Submissions'],
            'Submissions': ['Positions', 'Transitions'],
            'Concepts': ['Positions', 'Transitions', 'Submissions'],
            'Systems': ['Positions', 'Transitions', 'Submissions'],
        }
        return relationships.get(content_type, [])

    async def _analyze_with_claude(self, source_node: str, content: str,
                                   candidates: List[str]) -> List[LinkSuggestion]:
        """
        Analyze content with Claude to suggest links.

        Args:
            source_node: Source node ID
            content: Source file content
            candidates: Candidate pages to consider

        Returns:
            List of link suggestions
        """
        # Rate limiting
        async with self.semaphore:
            self.result.claude_calls += 1

            # Prepare candidate summaries
            candidate_info = []
            for candidate in candidates:
                node_data = self.graph_builder.graph.nodes[candidate]
                candidate_info.append({
                    'name': candidate,
                    'type': node_data.get('content_type', 'Unknown'),
                    'title': node_data.get('title', candidate),
                    'description': node_data.get('description', '')[:200],
                })

            # Build prompt for Claude
            prompt = self._build_suggestion_prompt(source_node, content, candidate_info)

            # Call Claude CLI with retry logic
            response = await self._call_claude_cli(prompt)

            # Parse response
            suggestions = self._parse_claude_response(source_node, response)

            return suggestions

    def _build_suggestion_prompt(self, source_node: str, content: str,
                                candidates: List[Dict]) -> str:
        """Build prompt for Claude to analyze content and suggest links."""
        # Extract key sections from content
        frontmatter, body = utils.extract_frontmatter(content)

        # Get first 1500 characters of body (enough context)
        content_excerpt = body[:1500]

        prompt = f"""You are a Brazilian Jiu-Jitsu expert analyzing content for internal link suggestions.

SOURCE PAGE: {source_node}
TITLE: {frontmatter.get('title', source_node)}

CONTENT EXCERPT:
{content_excerpt}

CANDIDATE PAGES TO CONSIDER:
"""
        for i, candidate in enumerate(candidates, 1):
            prompt += f"\n{i}. {candidate['name']} ({candidate['type']})"
            prompt += f"\n   Title: {candidate['title']}"
            prompt += f"\n   Description: {candidate['description']}"

        prompt += """

TASK:
Analyze the source page content and identify which candidate pages should be linked FROM the source page.
Consider:
1. **Relevance**: Is the candidate page directly relevant to the source content?
2. **BJJ Domain Knowledge**: Are there natural relationships (e.g., position → technique, position → submission)?
3. **Value**: Would this link help readers understand the topic better?
4. **Context**: Where in the source page would this link fit naturally?

Suggest up to 5 links maximum. For each suggestion, provide:
- target_page: The candidate page name
- confidence: Score 0-100 (only suggest if >60)
- reason: Brief explanation (1 sentence) of why this link is relevant
- section: Where to add the link ("Offensive Transitions", "Related Positions", "Expert Insights", etc.)
- relationship: Type of relationship ("position-to-transition", "position-to-submission", etc.)

OUTPUT FORMAT (JSON only, no other text):
{
  "suggestions": [
    {
      "target_page": "Page Name",
      "confidence": 85,
      "reason": "Relevant because...",
      "section": "Section Name",
      "relationship": "position-to-transition"
    }
  ]
}
"""
        return prompt

    async def _call_claude_cli(self, prompt: str, max_retries: int = 3) -> str:
        """
        Call Claude CLI with exponential backoff on failures.

        Args:
            prompt: Prompt for Claude
            max_retries: Maximum retry attempts

        Returns:
            Claude's response text
        """
        for attempt in range(max_retries):
            try:
                # Run Claude CLI with correct syntax: --print for non-interactive, --model for model selection
                # --dangerously-skip-permissions: Skip workspace trust dialogs (safe in our trusted repo)
                process = await asyncio.create_subprocess_exec(
                    config.CLAUDE_CLI_PATH,
                    '--print',
                    '--model', config.CLAUDE_MODEL,
                    '--dangerously-skip-permissions',
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                stdout, stderr = await asyncio.wait_for(
                    process.communicate(input=prompt.encode('utf-8')),
                    timeout=config.CLAUDE_TIMEOUT
                )

                if process.returncode == 0:
                    return stdout.decode('utf-8')
                else:
                    logger.warning(f"Claude CLI error (attempt {attempt + 1}): {stderr.decode('utf-8')}")

            except asyncio.TimeoutError:
                logger.warning(f"Claude CLI timeout (attempt {attempt + 1})")
            except Exception as e:
                logger.warning(f"Claude CLI exception (attempt {attempt + 1}): {e}")

            # Exponential backoff
            if attempt < max_retries - 1:
                await asyncio.sleep(config.CLAUDE_BACKOFF_BASE ** attempt)

        logger.error(f"Failed to get response from Claude CLI after {max_retries} attempts")
        return "{}"  # Return empty JSON

    def _parse_claude_response(self, source_node: str, response: str) -> List[LinkSuggestion]:
        """
        Parse Claude's JSON response into LinkSuggestion objects.

        Args:
            source_node: Source node ID
            response: Claude's response text

        Returns:
            List of link suggestions
        """
        suggestions = []

        try:
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if not json_match:
                logger.warning(f"No JSON found in Claude response for {source_node}")
                return suggestions

            data = json.loads(json_match.group(0))

            for sug in data.get('suggestions', []):
                # Validate suggestion
                if sug.get('confidence', 0) < config.MIN_CONFIDENCE_SCORE:
                    continue

                target_page = sug.get('target_page', '')
                if not target_page:
                    continue

                # Check if link already exists
                graph = self.graph_builder.graph
                existing = graph.has_edge(source_node, target_page)

                suggestion = LinkSuggestion(
                    source_file=source_node,
                    target_file=target_page,
                    confidence=float(sug.get('confidence', 0)),
                    reason=sug.get('reason', ''),
                    suggested_section=sug.get('section', 'Related Positions'),
                    relationship_type=sug.get('relationship', 'unknown'),
                    existing_link=existing,
                )

                suggestions.append(suggestion)

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse Claude response for {source_node}: {e}")
        except Exception as e:
            logger.error(f"Error parsing Claude response for {source_node}: {e}")

        return suggestions

    def _filter_suggestions(self):
        """Filter and deduplicate suggestions."""
        # Remove suggestions for existing links
        self.result.suggestions = [
            s for s in self.result.suggestions
            if not s.existing_link
        ]

        # Remove duplicates (same source+target pair)
        seen = set()
        filtered = []
        for sug in self.result.suggestions:
            key = (sug.source_file, sug.target_file)
            if key not in seen:
                seen.add(key)
                filtered.append(sug)

        # Sort by confidence
        filtered.sort(key=lambda x: x.confidence, reverse=True)

        self.result.suggestions = filtered

    def generate_report(self) -> Dict:
        """
        Generate comprehensive suggestions report.

        Returns:
            Report dictionary
        """
        report = self.result.to_dict()
        report['timestamp'] = utils.format_timestamp()

        # Group by source file
        by_source = {}
        for sug in self.result.suggestions:
            if sug.source_file not in by_source:
                by_source[sug.source_file] = []
            by_source[sug.source_file].append({
                'target': sug.target_file,
                'confidence': sug.confidence,
                'reason': sug.reason,
                'section': sug.suggested_section,
                'relationship': sug.relationship_type,
            })

        report['suggestions_by_file'] = by_source

        # Top suggestions
        report['top_suggestions'] = [
            {
                'source': s.source_file,
                'target': s.target_file,
                'confidence': s.confidence,
                'reason': s.reason,
            }
            for s in self.result.suggestions[:50]
        ]

        return report

    def save_report(self, output_path: Path):
        """Save suggestions report to file."""
        report = self.generate_report()
        utils.save_json_report(report, output_path.name)
        logger.info(f"Suggestions report saved to {output_path}")
