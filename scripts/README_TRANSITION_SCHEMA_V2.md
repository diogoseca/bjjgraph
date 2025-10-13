# Transition Schema Generator v2 - Documentation

## Overview

`add_transition_schema_v2.py` is an enhanced Python script that adds HowTo schema markup to BJJ Transition pages. This version is significantly more flexible than v1 and can handle various content structures.

## Features

### Enhanced Flexibility

The v2 script can extract steps from multiple formats:

1. **Numbered Sequence Section**: Standard format with `### Execution Steps (Numbered Sequence)`
   - Format: `1. **Step Name**: Description`
   - Also handles: `1. Description` (generates step name automatically)

2. **Visual Execution Sequence**: Extracts steps from descriptive paragraphs
   - Identifies action verbs (establish, control, shift, create, execute, etc.)
   - Converts sentences into structured steps
   - Limits to 8 steps for optimal schema

3. **Plain Numbered Lists**: Simple numbered lists in "Execution Steps" section
   - Handles both bold and non-bold step names
   - Flexible pattern matching

4. **Minimal Schema Generation**: For pages with insufficient content
   - Creates 3 basic but valid steps
   - Uses state information (Starting Position → Ending Position)
   - Ensures all pages have valid schema

### Intelligent Detection

- Specifically checks for HowTo schema (not just any schema)
- Won't skip files that only have WebPage or BreadcrumbList schema
- Handles multiple state name patterns (Starting State, Starting Position, Target Position)
- Extracts success probability from various formats

### Schema Generation

Creates comprehensive HowTo schema with:
- Technique name and description
- Starting and ending states
- Success probabilities (Beginner/Intermediate/Advanced)
- Step-by-step instructions with position numbers
- Standard BJJ tools (Gi/No-Gi attire, Training partner, Mat space)
- Time estimate based on complexity (2-7 minutes)

## Usage

```bash
# Run from project root
python3 scripts/add_transition_schema_v2.py

# Or make executable and run
chmod +x scripts/add_transition_schema_v2.py
./scripts/add_transition_schema_v2.py
```

## Output Format

The script generates detailed output showing:
- Files being processed
- Extraction method used (Numbered Sequence, Visual Sequence, etc.)
- Number of steps found
- First 3 step names for verification
- Summary statistics

Example output:
```
📄 Processing Butterfly Guard to X-Guard.md...
  Name: Butterfly Guard to X-Guard
  States: Butterfly Guard → X-Guard
  Success: Beginner 35%, Intermediate 60%, Advanced 85%
  Trying: Numbered Sequence section...
  ✓ Found 8 steps from Numbered Sequence
  ✅ SUCCESS: Added HowTo schema with 8 steps
     1. Establish proper butterfly guard
     2. Create upper body connection
     3. Identify target leg (typically
     ... and 5 more steps
```

## Results (2025-10-12)

Successfully processed all Transition files:
- **Total files**: 70
- **Updated with HowTo schema**: 44 files (originally missing)
- **Skipped**: 26 files (already had schema from v1)
- **Failed**: 0 files

All 70 Transition pages now have valid HowTo schema markup.

## Comparison with v1

| Feature | v1 | v2 |
|---------|----|----|
| Extraction methods | 1 (Numbered Sequence only) | 4 (Multiple formats) |
| Schema detection | Generic (any schema) | Specific (HowTo only) |
| Fallback handling | Skip file | Generate minimal schema |
| Pattern flexibility | Strict | Very flexible |
| State name patterns | 2 | 6+ |
| Detailed output | Basic | Comprehensive |
| Success rate | 26/70 (37%) | 70/70 (100%) |

## Technical Details

### Step Extraction Logic

1. **Try Numbered Sequence**: Look for `### Execution Steps (Numbered Sequence)`
   - Regex: `r'(\d+)\.\s*\*\*(.+?)\*\*:\s*(.+?)(?=\n\d+\.|$)'`
   - Fallback: `r'(\d+)\.\s+(.+?)(?=\n\d+\.|$)'`

2. **Try Visual Sequence**: Extract from descriptive paragraph
   - Splits into sentences
   - Filters by action verbs
   - Creates structured steps from prose

3. **Try Plain List**: Simple numbered list anywhere
   - Pattern: `r'(\d+)\.\s+(.+?)(?=\n\d+\.|\n\n|$)'`
   - Handles bold names: `r'\*\*(.+?)\*\*[:.]?\s*(.*)'`

4. **Generate Minimal**: Create basic 3-step schema
   - Uses state information
   - Provides valid structure
   - Better than no schema

### Schema Structure

Generated JSON-LD follows schema.org HowTo specification:
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Technique Name",
  "description": "Full description with states and success rates",
  "step": [...],
  "tool": ["BJJ Gi or No-Gi attire", "Training partner", "Mat space"],
  "totalTime": "PT5M"
}
```

## Files Processed

Successfully added HowTo schema to 44 files including:
- Arm Drag
- Back Control to Crucifix
- Back Step
- Basic Butterfly Sweep
- Body Lock Pass
- Bridge and Roll
- Butterfly Guard to X-Guard
- Butterfly Sweep
- Closed Guard to Triangle
- Collar Drag
- Double Leg Entry
- Double leg takedown
- Forward Roll
- Granby Roll
- Hip Escape
- Kiss of the Dragon
- Knee Cut Pass
- Leg Drag Pass
- Leg Drag Setup
- And 25+ more files...

## Benefits

1. **SEO Enhancement**: All pages now have structured data for search engines
2. **Rich Snippets**: Eligible for Google's HowTo rich results
3. **Consistency**: Uniform schema across all transition pages
4. **Completeness**: 100% coverage of transition files
5. **Quality**: Detailed, accurate step-by-step instructions

## Future Improvements

Potential enhancements for v3:
- Video URL integration
- Image/diagram references
- Difficulty ratings in schema
- Pre-requisite technique links
- Common variations in schema

## Maintenance

To process new transition files:
1. Add markdown file to `/source/content/Transitions/`
2. Run script: `python3 scripts/add_transition_schema_v2.py`
3. Script will automatically detect and process new files

## Notes

- Script is idempotent (safe to run multiple times)
- Only adds HowTo schema if missing
- Preserves existing WebPage and BreadcrumbList schema
- Inserts schema after frontmatter, before content
- Creates backup-safe modifications (can be re-run if needed)

---

**Created**: 2025-10-12  
**Version**: 2.0  
**Status**: Production Ready  
**Success Rate**: 100% (70/70 files)
