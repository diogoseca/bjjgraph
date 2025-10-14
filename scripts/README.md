# BJJ Graph Scripts

This directory contains Python scripts for validating, maintaining, and automating BJJ Graph content.

## Directory Structure

```
scripts/
├── README.md                          # This file
├── validate_content.py                # Content validation (root tool)
├── select_oldest_files.sh             # Utility script
│
├── seo/                               # SEO & schema markup scripts
│   ├── README.md
│   ├── add_breadcrumb_schema.py       # V2 breadcrumb schema
│   ├── add_webpage_schema.py          # V2 webpage schema
│   ├── add_position_schema_v2.py      # V2 position HowTo + FAQ
│   └── add_transition_schema_v2.py    # V2 transition HowTo + FAQ
│
├── link_optimizer/                    # Link validation & optimization
│   ├── README.md
│   ├── link_optimizer_cli.py          # Main CLI
│   ├── graph_builder.py
│   ├── link_validator.py
│   ├── semantic_suggester.py
│   └── ... (see link_optimizer/README.md)
│
└── deprecated/                        # Archived/superseded scripts
    ├── README.md
    ├── add_position_schema.py         # V1 (superseded)
    ├── add_transition_schema.py       # V1 (superseded)
    └── ... (one-time fix scripts)
```

**Documentation**: Script-specific docs are in `/docs/scripts/` (QUICK_START.md, VALIDATION_SUMMARY.md, etc.)

---

## Quick Start

### Content Validation
```bash
# Validate all content
python3 scripts/validate_content.py source/content/

# Validate specific type
python3 scripts/validate_content.py source/content/ --type Positions --verbose
```

### SEO Schema Markup
```bash
# Add all schema to new pages
python3 scripts/seo/add_webpage_schema.py
python3 scripts/seo/add_breadcrumb_schema.py
python3 scripts/seo/add_position_schema_v2.py
python3 scripts/seo/add_transition_schema_v2.py
```

### Link Optimization
```bash
# Full validation + AI suggestions
python3 scripts/link_optimizer/link_optimizer_cli.py --mode full --verbose

# Validation only
python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate --verbose
```

---

## validate_content.py

A comprehensive validation script that checks markdown content files against the BJJ Graph YAML schema standards.

### Features

- **Multi-Type Validation**: Validates all 5 content types (Positions, Transitions, Submissions, Concepts, Systems)
- **Schema Compliance**: Checks against `/source/content/CONTRIBUTING-YAML-SCHEMA.md`
- **ID Format Validation**: Ensures correct ID formats (S###, T###, SUB###, C###, SC###)
- **Duplicate Detection**: Identifies duplicate IDs across files
- **Wikilink Resolution**: Verifies all internal links resolve to existing files
- **Success Rate Validation**: Checks success rates are 0-100% and properly ordered (Beginner ≤ Intermediate ≤ Advanced)
- **SEO Compliance**: Validates title/description format and length
- **Section Completeness**: Ensures all required sections are present
- **Expert Insights**: Checks for all three experts (Danaher, Gordon Ryan, Eddie Bravo)

### Usage

```bash
# Validate all content
python scripts/validate_content.py source/content/

# Validate specific content type
python scripts/validate_content.py source/content/ --type Positions
python scripts/validate_content.py source/content/ --type Transitions
python scripts/validate_content.py source/content/ --type Submissions
python scripts/validate_content.py source/content/ --type Concepts
python scripts/validate_content.py source/content/ --type Systems

# Verbose mode (shows warnings and info messages)
python scripts/validate_content.py source/content/ --verbose
python scripts/validate_content.py source/content/ --type Positions -v

# Strict mode (warnings become errors)
python scripts/validate_content.py source/content/ --strict
```

### Validation Checks by Content Type

#### Positions (S### IDs)

**Required Sections:**
- State Properties (with Point Value, Position Type, Risk Level, Energy Cost, Time Sustainability)
- Visual Description (minimum 200 characters)
- Offensive Transitions (minimum 3 with full success rates)
- Decision Tree
- Expert Insights (all 3 experts)
- Common Errors

**Checks:**
- State ID format: `S###` (3 digits with leading zeros)
- Duplicate ID detection
- Minimum 3 transitions with success rates (Beginner/Intermediate/Advanced)
- Success rates in proper format and realistic ranges
- All three expert insights present

#### Transitions (T### IDs)

**Required Sections:**
- Visual Execution Sequence
- Execution Steps (minimum 6 numbered steps)
- Common Counters (minimum 3 with success rates)
- Expert Insights (all 3 experts)
- Common Errors
- Knowledge Assessment Questions (minimum 5)

**Checks:**
- Transition ID format: `T###`
- Starting State and Ending State (should be wikilinks)
- Success Probability present
- Physical Requirements (Strength, Flexibility, Coordination, Speed)
- Execution steps count
- Counter attacks count

#### Submissions (SUB### or S### IDs)

**Required Sections:**
- Visual Execution Sequence
- Execution Steps (minimum 6)
- Safety Considerations (MANDATORY)
- Expert Insights (all 3 experts)
- Common Errors

**Checks:**
- Submission ID format: `SUB###` (or legacy `S###`)
- Safety section is mandatory
- Ending State should be `[[Won by Submission]]`
- Starting State, Submission Type, Target Area present
- Success rates validation

#### Concepts (C### IDs)

**Recommended Sections:**
- Concept Properties (with Application Level, Complexity Level)
- Key Principles
- Application Contexts
- Developmental Metrics
- Expert Insights
- Concept Relationships

**Checks:**
- Concept ID format: `C###`
- Should NOT have success rates (concepts are principles, not techniques)
- Relationship links to other concepts

#### Systems (SC### IDs)

**Recommended Sections:**
- Chain Properties (with Primary Submissions, Starting Positions)
- Decision Tree (with if/then logic)
- Submission Sequence (minimum 2 submissions)
- Expert Insights

**Checks:**
- Chain ID format: `SC###`
- Primary Submissions count (minimum 2)
- Decision tree has if/then structure with → transitions
- Expert insights from multiple authorities

### Output Format

The script provides a comprehensive report including:

1. **Summary Statistics**
   - Total files validated
   - Pass/fail counts
   - Error/warning/info counts

2. **By Content Type Breakdown**
   - Counts per type (Position, Transition, etc.)
   - Errors and warnings per type

3. **Files with Errors**
   - File name and path
   - Specific error messages
   - Line numbers (when applicable)

4. **Files with Warnings** (verbose mode)
   - Warning messages
   - Info messages

### Exit Codes

- `0`: All files passed validation
- `1`: One or more files failed validation

### Integration

This script can be integrated into:
- **Pre-commit hooks**: Validate content before commits
- **CI/CD pipelines**: GitHub Actions workflow
- **Editor integration**: VS Code tasks
- **Documentation builds**: Fail builds on validation errors

**GitHub Actions Integration Example:**

```yaml
name: Validate Content

on:
  pull_request:
    paths:
      - 'source/content/**/*.md'
  push:
    branches:
      - main

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'

      - name: Validate Content
        run: |
          python scripts/validate_content.py source/content/ --verbose
```

### Common Issues

**Missing Visual Description**
- Add a detailed `### Visual Description` section under State Properties
- Should be minimum 200 characters describing body positioning

**Duplicate IDs**
- Check for ID conflicts across all files of same type
- Use unique sequential IDs

**Missing Success Rates**
- Format: `(Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)`
- All three levels required
- Beginner ≤ Intermediate ≤ Advanced

**Broken Wikilinks**
- Ensure `[[Target File]]` matches exact filename (without .md)
- Common special cases are automatically skipped

**Missing Expert Insights**
- Include sections for all three: Danaher, Gordon Ryan, Eddie Bravo
- Each should be 2-3 sentences

### Example Output

```
================================================================================
BJJ GRAPH CONTENT VALIDATION REPORT
================================================================================

SUMMARY:
  Total Files Validated: 92
  ✓ Passed: 25
  ✗ Failed: 67
  Total Errors: 154
  Total Warnings: 3046
  Total Info: 238

BY CONTENT TYPE:
  Position:
    Total: 92, Passed: 25, Failed: 67
    Errors: 154, Warnings: 3046

================================================================================
FILES WITH ERRORS:
================================================================================

✗ Standing up.md
  Path: source/content/Positions/Standing up.md
  Type: Position
  ERROR: Missing or invalid State ID (format: S###)
  ERROR: Missing required section: State Properties
  ERROR: Missing required section: Visual Description
```

## Related Files

- `/source/content/CONTRIBUTING-YAML-SCHEMA.md` - Complete schema documentation
- `/source/content/Positions/CONTRIBUTING-POSITIONS.md` - Position contributor guide
- `/source/content/Transitions/CONTRIBUTING-TRANSITIONS.md` - Transition contributor guide
- `/source/content/Submissions/CONTRIBUTING-SUBMISSIONS.md` - Submission contributor guide
- `/source/content/Systems/CONTRIBUTING-SYSTEMS.md` - Systems contributor guide
- `/source/content/Concepts/CONTRIBUTING-CONCEPTS.md` - Concepts contributor guide

**Note**: The CONTRIBUTING-*.md files are excluded from the website (see quartz.config.ts) and serve as references for content creators and the automated improvement bot.

## Link Optimizer Scripts

Located in `scripts/link_optimizer/` - A comprehensive link validation and optimization system.

### Quick Commands

```bash
# Full validation + AI suggestions
python3 scripts/link_optimizer/link_optimizer_cli.py --mode full --verbose

# Validation only (fast)
python3 scripts/link_optimizer/link_optimizer_cli.py --mode validate --verbose

# AI Suggestions only
python3 scripts/link_optimizer/link_optimizer_cli.py --mode suggest --max-concurrent 20

# Random walk traversal
python3 scripts/link_optimizer/link_optimizer_cli.py --mode random-walk --walk-length 1000
```

### Scripts Overview

- **link_optimizer_cli.py** - Main CLI interface for all operations
- **graph_builder.py** - Builds NetworkX graph from markdown files
- **link_validator.py** - Validates wikilinks and finds broken links
- **semantic_suggester.py** - Claude AI-powered link suggestions
- **graph_optimizer.py** - Graph traversal strategies (PageRank, random walk, etc.)
- **apply_suggestions.py** - Apply link fixes automatically
- **create_filtered_views.py** - Filter suggestions by confidence level
- **config.py** - Configuration settings
- **utils.py** - Utility functions

### Documentation

- **Complete Guide**: `/docs/link-optimizer.md` - Comprehensive documentation (consolidated from 5 files)
- **Reports**: `/reports/link_optimizer/` - All analysis reports and session results
- **Status**: `/reports/link_optimizer/04_STATUS/` - Current status and next steps

### Features

- **Link Validation**: Validates 11,351+ wikilinks, identifies broken links with fuzzy matching
- **AI Suggestions**: Claude AI analyzes content to suggest relevant internal links
- **Graph Theory**: PageRank, centrality, connected components analysis
- **Random Walk**: Stochastic graph traversal (47% coverage achieved)
- **Session Results**: 4 cleanup sessions completed, 124 broken links fixed, 98%+ consistency achieved

**See**: `/docs/link-optimizer.md` for complete guide and `/scripts/link_optimizer/README.md` for detailed module documentation

---

## Contributing

When adding new validation rules:
1. Update the appropriate `_validate_*` method
2. Add error/warning/info messages with clear descriptions
3. Include line numbers when possible
4. Update this README with new checks
5. Test against sample files
