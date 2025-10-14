# Random Walk Analysis Summary

## Configuration

- **Strategy**: random_walk
- **Walk length**: 1000 steps
- **Restart probability**: 15% (damping factor)

## Results

- **Total steps taken**: 1000
- **Unique nodes visited**: 318/677
- **Coverage**: 47.0%
- **Edges traversed**: 832

## Coverage Analysis

**Nodes reached in 1,000 steps**: 318 (47.0%)  
**Nodes not reached**: 359 (53.0%)

### Interpretation

The random walk achieved **47.0% coverage** of the graph in 1,000 steps. This indicates:

- **Moderate connectivity**: About half the graph is reachable through random navigation
- **Isolated clusters**: ~53.0% of nodes were not reached, suggesting disconnected or weakly connected components
- **Navigation bottlenecks**: Some regions of the graph may have few entry/exit points

### Top 20 Most Visited Nodes

- Back Control: 34 visits
- Side Control: 31 visits
- Won by Submission: 26 visits
- Mount: 26 visits
- Top Position: 25 visits
- Guard Recovery: 19 visits
- Half Guard Bottom: 18 visits
- Guard Retention: 15 visits
- Neutral Position: 15 visits
- Standing Position: 13 visits
- Defensive Posture: 13 visits
- Base Maintenance: 12 visits
- Frame Creation: 11 visits
- Rear Naked Choke: 11 visits
- Closed Guard Bottom: 11 visits
- Bridge and Roll: 11 visits
- Technical Stand-up: 11 visits
- Hip Escape: 10 visits
- North-South: 10 visits
- Space Management: 10 visits

## Random Walk Algorithm

The random walk uses a **stochastic traversal strategy**:

1. Start at a random node
2. At each step:
   - **85% chance**: Follow a random outgoing link from current node
   - **15% chance**: Jump to a completely random node (restart)
3. Track all visited nodes and edges
4. Calculate coverage statistics

This simulates how a user might navigate the knowledge base by following links randomly, with occasional "fresh starts" to discover disconnected areas.

## Recommendations

Based on the coverage analysis:

1. **Improve connectivity** for the unreached nodes
2. **Add bridge links** to connect isolated clusters
3. **Review orphan pages** (50 pages with no incoming links)
4. **Check dead-end pages** (14 pages with no outgoing links)
5. **Apply AI suggestions** to increase graph density

---

**Full data**: `random_walk_result.json`
