# BJJ Graph Content Validation - Quick Start Guide

## Installation

No installation required! The script uses only Python standard library.

**Requirements:**
- Python 3.7 or higher
- Access to `/Users/diogo/Documents/bjjgraph-org/bjjgraph/` directory

## Basic Usage

### 1. Validate All Content

```bash
cd /Users/diogo/Documents/bjjgraph-org/bjjgraph
python scripts/validate_content.py source/content/
```

**Output:**
- Summary statistics (files, pass/fail counts)
- List of files with errors
- Exit code 0 (success) or 1 (failures found)

### 2. Validate Specific Content Type

```bash
# Positions only
python scripts/validate_content.py source/content/ --type Positions

# Transitions only
python scripts/validate_content.py source/content/ --type Transitions

# Submissions only
python scripts/validate_content.py source/content/ --type Submissions

# Concepts only
python scripts/validate_content.py source/content/ --type Concepts

# Systems only
python scripts/validate_content.py source/content/ --type Systems
```

### 3. Verbose Mode (Show Warnings)

```bash
python scripts/validate_content.py source/content/ --verbose

# Short form
python scripts/validate_content.py source/content/ -v

# Combine with type filter
python scripts/validate_content.py source/content/ --type Positions -v
```

### 4. Strict Mode (Warnings = Errors)

```bash
python scripts/validate_content.py source/content/ --strict

# Short form
python scripts/validate_content.py source/content/ -s
```

### 5. Run as Executable

```bash
# First time: make executable
chmod +x scripts/validate_content.py

# Then run directly
./scripts/validate_content.py source/content/
```

## Understanding the Output

### Summary Section

```
SUMMARY:
  Total Files Validated: 254
  ✓ Passed: 105
  ✗ Failed: 149
  Total Errors: 554
  Total Warnings: 5443
  Total Info: 366
```

- **Passed**: Files with no errors (warnings are OK)
- **Failed**: Files with at least one error
- **Errors**: Critical issues that prevent validation
- **Warnings**: Issues that should be fixed but aren't critical
- **Info**: Suggestions and recommendations

### By Content Type Section

```
BY CONTENT TYPE:
  Position:
    Total: 92, Passed: 25, Failed: 67
    Errors: 154, Warnings: 3046
```

Shows breakdown by content type (Position, Transition, Submission, Concept, System).

### Files with Errors Section

```
✗ Standing up.md
  Path: source/content/Positions/Standing up.md
  Type: Position
  ERROR: Missing or invalid State ID (format: S###)
  ERROR: Missing required section: State Properties
```

Lists each file that failed with specific error messages.

### Files with Warnings Section (Verbose Only)

```
✓ Closed Guard Bottom.md
  Path: source/content/Positions/Closed Guard Bottom.md
  Type: Position
  WARNING: Only 8 transitions with full success rates found (minimum 3 recommended)
  WARNING: Description is long (175 chars, recommended 150-160)
```

Shows files that passed but have warnings (only shown with `--verbose` flag).

## Common Workflows

### Before Committing Changes

```bash
# Validate only the type you modified
python scripts/validate_content.py source/content/ --type Positions -v

# Fix any errors shown
# Re-run validation
# Commit when passing
```

### Code Review Process

```bash
# Reviewer validates all content
python scripts/validate_content.py source/content/

# If failures, ask author to fix
# Re-validate after fixes
```

### CI/CD Integration

```bash
# In GitHub Actions or similar
python scripts/validate_content.py source/content/ --strict

# Exit code 1 will fail the build if validation fails
```

### Content Creation

```bash
# After creating new Position file
python scripts/validate_content.py source/content/ --type Positions -v

# Check output for your new file
# Fix any errors or warnings
```

## Quick Fixes for Common Errors

### Missing State ID

**Error:** `Missing or invalid State ID (format: S###)`

**Fix:** Add to file:
```markdown
- **State ID**: S042
```

Format: `S###` for Positions, `T###` for Transitions, `SUB###` for Submissions

### Missing Visual Description

**Error:** `Missing required section: Visual Description`

**Fix:** Add section:
```markdown
### Visual Description
You are lying on your back with your legs wrapped around opponent's waist...
(minimum 200 characters)
```

### Missing Success Rates

**Error:** `Only 2 transitions with full success rates found`

**Fix:** Ensure format:
```markdown
- [[Hip Bump Sweep]] → [[Mount]] (Success Rate: Beginner 50%, Intermediate 70%, Advanced 85%)
```

All three levels (Beginner, Intermediate, Advanced) required.

### Duplicate ID

**Error:** `Duplicate State ID S011 (also in Butterfly Guard)`

**Fix:** Change one file to use unique ID:
```markdown
- **State ID**: S099
```

Check highest existing ID and use next available.

### Missing Safety Section (Submissions)

**Error:** `MANDATORY: Missing Safety Considerations section`

**Fix:** Add section:
```markdown
### Safety Considerations
- **Injury Risks**: Potential damage from improper application
- **Application Speed**: Proper rate of pressure increase
- **Tap Recognition**: Identifying submission signals
- **Release Technique**: How to safely disengage after tap
```

### Broken Wikilink

**Warning:** `Wikilink [[Top Position]] does not resolve to existing file`

**Fix:** Either:
1. Create the missing file (`Top Position.md`)
2. Change link to existing file: `[[Mount]]`
3. Remove the link if not needed

### Missing Expert Insights

**Warning:** `Missing Danaher expert insight`

**Fix:** Add section:
```markdown
### Expert Insights
- **John Danaher**: Technical systematic approach...
- **Gordon Ryan**: Competition-focused high-percentage...
- **Eddie Bravo**: Innovative rubber guard connections...
```

## Exit Codes

- **0**: All files passed validation (no errors)
- **1**: One or more files failed validation (has errors)

Use in scripts:
```bash
if python scripts/validate_content.py source/content/; then
    echo "Validation passed!"
else
    echo "Validation failed!"
    exit 1
fi
```

## Getting Help

1. **Script help**: `python scripts/validate_content.py --help`
2. **README**: See `scripts/README.md` for detailed documentation
3. **YAML Schema**: See `source/content/CONTRIBUTING-YAML-SCHEMA.md` for field definitions
4. **Standards**: See `source/content/Positions/000.STANDARD.md` for Position template

## Tips

- Run validation **before** committing changes
- Use `--verbose` to see all warnings, not just errors
- Use `--type` to focus on specific content type you're working on
- Fix errors first, then warnings
- Info messages are suggestions - not required

## Example Session

```bash
# Check what needs fixing
python scripts/validate_content.py source/content/ --type Positions

# Output shows 3 files with errors
# Fix the errors in those files

# Re-validate with verbose to see warnings
python scripts/validate_content.py source/content/ --type Positions -v

# All files pass! Commit the changes
git add source/content/Positions/
git commit -m "Fix validation errors in Position files"
```
