# BJJ Graph Link Optimizer - Quick Start Guide

Get started with the link optimizer in 5 minutes!

## Installation

```bash
# 1. Navigate to bjjgraph root
cd /Users/diogo/Documents/bjjgraph-org/bjjgraph

# 2. Install dependencies (if not already installed)
pip install networkx tqdm

# 3. Verify Claude CLI is installed
which claude
# Should output: /Users/diogo/anaconda3/bin/claude

# 4. Make CLI executable
chmod +x scripts/link_optimizer/link_optimizer_cli.py
```

## Quick Commands

### 1. Validate All Links (Fast - No AI)

```bash
python scripts/link_optimizer/link_optimizer_cli.py --mode validate --verbose
```

**What it does:**
- Validates all 3,750+ wikilinks
- Finds broken links
- Suggests fixes with confidence scores
- Identifies orphan and dead-end pages
- Takes ~15 seconds

**Output:**
```
reports/link_optimizer/broken_links_report.json
```

### 2. Generate AI Link Suggestions (Slow - Uses Claude)

```bash
python scripts/link_optimizer/link_optimizer_cli.py --mode suggest \
  --max-concurrent 20 \
  --max-suggestions 5 \
  --verbose
```

**What it does:**
- Analyzes 352 files with Claude AI
- Suggests intelligent internal links
- Provides confidence scores and reasons
- Rate-limited to 20 concurrent calls
- Takes ~5-10 minutes

**Output:**
```
reports/link_optimizer/link_suggestions_report.json
```

### 3. Full Analysis (Complete Report)

```bash
python scripts/link_optimizer/link_optimizer_cli.py --mode full --verbose
```

**What it does:**
- Runs both validation AND suggestions
- Generates graph metrics
- Creates comprehensive reports
- Takes ~10-15 minutes

**Outputs:**
```
reports/link_optimizer/broken_links_report.json
reports/link_optimizer/link_suggestions_report.json
reports/link_optimizer/graph_metrics_report.json
reports/link_optimizer/validation_summary.txt
```

### 4. Random Walk Exploration

```bash
python scripts/link_optimizer/link_optimizer_cli.py --mode random-walk \
  --walk-length 1000 \
  --verbose
```

**What it does:**
- Performs stochastic random walk
- Follows random links with 15% restart probability
- Discovers rare paths through the graph
- Takes ~2 seconds

### 5. Optimize Processing Order

```bash
# Process by PageRank (most important first)
python scripts/link_optimizer/link_optimizer_cli.py --mode optimize \
  --strategy pagerank

# Process orphan pages first
python scripts/link_optimizer/link_optimizer_cli.py --mode optimize \
  --strategy in_degree

# Random order
python scripts/link_optimizer/link_optimizer_cli.py --mode optimize \
  --strategy random
```

## Understanding the Reports

### Broken Links Report

Shows all broken links with suggested fixes:

```json
{
  "summary": {
    "total_links": 3754,
    "broken_links": 767
  },
  "broken_links": [
    {
      "source_file": "Mount",
      "target_link": "High Mount",
      "suggested_fix": "Technical Mount",
      "confidence": 85.5
    }
  ]
}
```

**What to do:**
1. Review high-confidence fixes (>80%)
2. Manually check suggested fixes
3. Update broken links in source files
4. Re-run validation

### Link Suggestions Report

Shows AI-recommended links:

```json
{
  "suggestions": [
    {
      "source_file": "Mount",
      "target_file": "Americana",
      "confidence": 92,
      "reason": "Americana is a high-percentage submission from mount",
      "suggested_section": "Offensive Transitions",
      "relationship_type": "position-to-submission"
    }
  ]
}
```

**What to do:**
1. Review suggestions with confidence >80%
2. Add links in suggested sections
3. Consider relationship types
4. Test new links work correctly

### Graph Metrics Report

Shows graph statistics:

```json
{
  "node_count": 352,
  "edge_count": 3247,
  "orphan_pages": ["Page1", "Page2"],
  "dead_end_pages": ["Page3", "Page4"],
  "top_pages": [
    ["Mount", 0.024567],
    ["Closed Guard Bottom", 0.019834]
  ]
}
```

**What to do:**
1. Fix orphan pages (add incoming links)
2. Fix dead-end pages (add outgoing links)
3. Study top pages (important hubs)
4. Check component count (should be 1-3)

## Common Use Cases

### Find Pages Needing Links

```bash
# Find orphan pages (no incoming links)
python scripts/link_optimizer/link_optimizer_cli.py --mode optimize \
  --strategy in_degree | head -30
```

### Find Important Pages

```bash
# Get top 20 pages by PageRank
python scripts/link_optimizer/link_optimizer_cli.py --mode optimize \
  --strategy pagerank | head -30
```

### Validate Specific Content Type

Use the validation script with grep:

```bash
python scripts/link_optimizer/link_optimizer_cli.py --mode validate | \
  grep -A 5 "Mount"
```

## Troubleshooting

### "Claude CLI not found"

```bash
# Check installation
which claude

# Should output: /Users/diogo/anaconda3/bin/claude
# If not, install Claude CLI from: https://claude.ai/cli
```

### "Import Error: No module named 'networkx'"

```bash
pip install networkx tqdm
```

### "Rate limit exceeded"

Reduce concurrent calls:

```bash
--max-concurrent 10  # Instead of 20
```

### "Timeout errors"

Increase timeout in `config.py`:

```python
CLAUDE_TIMEOUT = 120  # 2 minutes instead of 60
```

## Next Steps

1. **Run validation** to find broken links
2. **Fix high-confidence broken links** (>80% confidence)
3. **Run full analysis** to get AI suggestions
4. **Review top suggestions** (>80% confidence)
5. **Add suggested links** to content files
6. **Re-run validation** to verify fixes

## Performance Tips

- Run validation first (fast) before suggestions (slow)
- Use `--max-concurrent 10` for slower but safer API usage
- Process in batches if you have many files
- Save checkpoint data if running long jobs

## Advanced Usage

See README.md for:
- Custom batch processing with Python API
- Graph analysis functions
- Missing edge detection
- Visualization export
- Integration with other tools

## Getting Help

```bash
# Show all options
python scripts/link_optimizer/link_optimizer_cli.py --help

# Read full documentation
cat scripts/link_optimizer/README.md

# Check example reports
ls reports/link_optimizer/
```

---

**Quick Reference Card**

| Command | Purpose | Time |
|---------|---------|------|
| `--mode validate` | Check broken links | ~15 sec |
| `--mode suggest` | AI link suggestions | ~5-10 min |
| `--mode full` | Complete analysis | ~10-15 min |
| `--mode random-walk` | Stochastic traversal | ~2 sec |
| `--mode optimize` | Processing order | ~5 sec |
| `--mode visualize` | Export for D3.js | ~5 sec |

**Rate Limiting Options**

| Flag | Default | Purpose |
|------|---------|---------|
| `--max-concurrent` | 20 | Concurrent Claude calls |
| `--max-suggestions` | 10 | Suggestions per file |
| `--walk-length` | 1000 | Random walk steps |

---

*Happy optimizing! 🥋*
