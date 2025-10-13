# Link Optimizer Scripts

**AI-powered link validation and suggestion system using Claude CLI**

## Quick Start

```bash
# Validate all links
python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate --verbose

# Generate AI suggestions
python3 scripts/link_optimizer/link_optimizer_cli.py --mode suggest --max-concurrent 10 --verbose

# Random walk analysis
python3 scripts/link_optimizer/link_optimizer_cli.py --mode random-walk --walk-length 1000 --verbose

# Full analysis (all modes)
python3 scripts/link_optimizer/link_optimizer_cli.py --mode full --verbose
```

## Files

**Scripts** (8 files):
- `link_optimizer_cli.py` - Main CLI orchestrator
- `graph_builder.py` - NetworkX graph construction
- `link_validator.py` - Wikilink validation
- `semantic_suggester.py` - Claude AI integration
- `graph_optimizer.py` - Traversal algorithms
- `utils.py` - Utility functions
- `config.py` - Configuration
- `__init__.py` - Package initialization

**Status**:
- `.status.md` - Current operational status and recovery instructions

## Documentation

📚 **Full documentation in `/docs/`**:
- `/docs/link-optimizer-guide.md` - Comprehensive guide
- `/docs/link-optimizer-quickstart.md` - Quick reference
- `/docs/link-optimizer-results.md` - Final results and metrics
- `/docs/link-optimizer-summary.md` - Implementation summary

## Reports

📊 **Generated reports in `/reports/link_optimizer/`**:
- Validation results
- AI suggestions (1,594 suggestions)
- Random walk analysis
- Summary files (digestible versions)

## Key Features

✅ Claude CLI integration with rate limiting
✅ Random walk traversal (stochastic graph navigation)
✅ PageRank-based prioritization
✅ Async processing (10-20 concurrent calls)
✅ 1,594 AI-powered link suggestions
✅ Comprehensive validation (11,351 links checked)

## Requirements

- Python 3.8+
- NetworkX
- Claude CLI (`/Users/diogo/anaconda3/bin/claude`)
- asyncio, tqdm

## Configuration

Edit `config.py` to customize:
- Claude CLI path and model
- Rate limiting (MAX_CONCURRENT_CLAUDE_CALLS)
- PageRank damping (PAGERANK_ALPHA)
- Random walk parameters (RANDOM_WALK_DAMPING)

---

**Status**: ✅ All analysis complete (2025-10-13)
**Next**: Apply 204 high-confidence suggestions
