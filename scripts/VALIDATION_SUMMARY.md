# BJJ Graph Content Validation Summary

## Script Overview

The `validate_content.py` script provides comprehensive validation of all BJJ Graph markdown content against the YAML schema defined in `/Users/diogo/Documents/bjjgraph-org/bjjgraph/source/content/CONTRIBUTING-YAML-SCHEMA.md`.

## Current Validation Status

As of the latest run, the content validation shows:

- **Total Files**: 254
- **Passed**: 105 (41.3%)
- **Failed**: 149 (58.7%)
- **Total Errors**: 554
- **Total Warnings**: 5,443
- **Total Info**: 366

### By Content Type

| Content Type | Total | Passed | Failed | Errors | Warnings |
|-------------|-------|--------|--------|--------|----------|
| **Positions** | 92 | 25 | 67 | 155 | 2,428 |
| **Transitions** | 65 | 9 | 56 | 317 | 1,132 |
| **Submissions** | 47 | 21 | 26 | 82 | 1,061 |
| **Concepts** | 29 | 29 | 0 | 0 | 380 |
| **Systems** | 21 | 21 | 0 | 0 | 442 |

### Key Findings

#### ✅ Strengths
- **Concepts**: 100% pass rate (all 29 files)
- **Systems**: 100% pass rate (all 21 files)
- **Submissions**: 44.7% pass rate (21/47 files)

#### ⚠️ Areas for Improvement
- **Positions**: Many missing Visual Description sections
- **Transitions**: Missing required sections (Visual Execution Sequence, Execution Steps, Common Counters)
- **Duplicate IDs**: Several State IDs are duplicated across files
- **Wikilink Resolution**: Many internal links don't resolve to existing files
- **Success Rates**: Incomplete success rate data (missing Beginner/Intermediate/Advanced breakdown)

## Common Validation Errors

### 1. Missing Required Sections

**Positions:**
- Visual Description (most common)
- State Properties
- Decision Tree

**Transitions:**
- Visual Execution Sequence
- Execution Steps (minimum 6)
- Common Counters (minimum 3)
- Knowledge Assessment Questions (minimum 5)

**Submissions:**
- Safety Considerations (MANDATORY)
- Visual Execution Sequence

### 2. Duplicate IDs

Examples:
- `S011`: Spider Guard vs. Butterfly Guard
- `S012`: Saddle Position vs. X-Guard
- `S016`: Game Over Position vs. North-South
- `S061`: Guard Recovery vs. Knee Cut Position

### 3. Incomplete Success Rates

Many files have:
- Missing skill level breakdowns
- Only partial data (e.g., "Beginner 50%" without Intermediate/Advanced)
- Format issues (not matching pattern: "Beginner X%, Intermediate Y%, Advanced Z%")

### 4. Broken Wikilinks

Common patterns:
- Links to non-existent positions (e.g., `[[Top Position]]`, `[[Neutral Position]]`)
- Links to techniques not yet created
- Typos in link names

### 5. Missing SEO Elements

Many files lack:
- YAML frontmatter (title and description)
- Proper title format: `"[Name] | BJJ [Type] | BJJ Graph"`
- Meta descriptions (150-160 characters)
- Success rates in descriptions

## Validation Rules Summary

### ID Formats

| Content Type | ID Format | Example | Pattern |
|-------------|-----------|---------|---------|
| Position | S### | S002 | `S\d{3}` |
| Transition | T### | T045 | `T\d{3}` |
| Submission | SUB### or S### | SUB201, S201 | `SUB\d{3}` or `S\d{3}` |
| Concept | C### | C111 | `C\d{3}` |
| System | SC### | SC002 | `SC\d{3}` |

### Success Rate Validation

- **Range**: 0-100%
- **Ordering**: Beginner ≤ Intermediate ≤ Advanced (with 5% tolerance)
- **Format**: `Success Rate: Beginner X%, Intermediate Y%, Advanced Z%`
- **Completeness**: All three levels required

### Section Requirements

#### Positions (Required)
1. State Properties
2. Visual Description (min 200 chars)
3. Offensive Transitions (min 3 with success rates)
4. Decision Tree
5. Expert Insights (all 3 experts)
6. Common Errors

#### Transitions (Required)
1. Visual Execution Sequence
2. Execution Steps (min 6)
3. Common Counters (min 3)
4. Expert Insights (all 3 experts)
5. Common Errors
6. Knowledge Assessment Questions (min 5)

#### Submissions (Required)
1. Visual Execution Sequence
2. Execution Steps (min 6)
3. **Safety Considerations** (MANDATORY)
4. Expert Insights (all 3 experts)
5. Common Errors

#### Concepts (Recommended)
1. Concept Properties
2. Key Principles
3. Application Contexts
4. Developmental Metrics
5. Expert Insights

#### Systems (Recommended)
1. Chain Properties
2. Decision Tree (with if/then logic)
3. Submission Sequence (min 2 submissions)
4. Expert Insights

## Recommendations

### Immediate Actions (High Priority)

1. **Fix Duplicate IDs**
   - Reassign unique IDs to conflicting files
   - Update registry to prevent future conflicts

2. **Add Safety Sections to Submissions**
   - All submission files must have Safety Considerations
   - Include: Injury Risks, Application Speed, Tap Recognition, Release Technique

3. **Complete Visual Descriptions**
   - Add detailed visual descriptions to all Position files
   - Minimum 200 characters describing body positioning

### Short-term Improvements (Medium Priority)

4. **Standardize Success Rates**
   - Ensure all transitions include Beginner/Intermediate/Advanced breakdown
   - Validate ordering (Beginner ≤ Intermediate ≤ Advanced)

5. **Fix Broken Wikilinks**
   - Create missing position files OR
   - Update links to point to existing files

6. **Add SEO Frontmatter**
   - Add title and description to all files
   - Follow template formats
   - Include success rates in descriptions

### Long-term Enhancements (Low Priority)

7. **Expert Insights Completeness**
   - Ensure all three experts (Danaher, Gordon Ryan, Eddie Bravo) in all files
   - Minimum 2-3 sentences per expert

8. **Knowledge Assessment Questions**
   - Add 5 questions to all Transition files
   - Cover: Mechanical Understanding, Timing Recognition, Error Prevention, Setup Requirements, Adaptation

9. **Standardize Concepts and Systems**
   - Add IDs to all Concept files (C###)
   - Add IDs to all System files (SC###)

## Integration with CI/CD

The validation script can be integrated into GitHub Actions:

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
          cd bjjgraph
          python scripts/validate_content.py source/content/ --verbose
```

## Usage Examples

```bash
# Validate all content
python scripts/validate_content.py source/content/

# Validate specific type with details
python scripts/validate_content.py source/content/ --type Positions --verbose

# Check only errors (no warnings)
python scripts/validate_content.py source/content/ --type Submissions

# Strict mode (warnings become errors)
python scripts/validate_content.py source/content/ --strict

# Make executable and run directly
chmod +x scripts/validate_content.py
./scripts/validate_content.py source/content/
```

## Next Steps

1. Review this summary with the team
2. Prioritize fixes based on recommendations
3. Set up pre-commit hooks for validation
4. Integrate into CI/CD pipeline
5. Establish content creation guidelines referencing validation rules
6. Schedule regular validation runs to track progress

## Related Documentation

- **Validation Script**: `/Users/diogo/Documents/bjjgraph-org/bjjgraph/scripts/validate_content.py`
- **YAML Schema**: `/Users/diogo/Documents/bjjgraph-org/bjjgraph/source/content/CONTRIBUTING-YAML-SCHEMA.md`
- **Position Standard**: `/Users/diogo/Documents/bjjgraph-org/bjjgraph/source/content/Positions/000.STANDARD.md`
- **Transition Standard**: `/Users/diogo/Documents/bjjgraph-org/bjjgraph/source/content/Transitions/000.STANDARD.md`
- **Script README**: `/Users/diogo/Documents/bjjgraph-org/bjjgraph/scripts/README.md`
