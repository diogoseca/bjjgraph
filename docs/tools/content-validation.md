# Content Validation Guide
#documentation #validation #tools #scripts #quality-assurance

## Overview

The `validate_content.py` script is a comprehensive validation tool that ensures all BJJ Graph content files meet the project's quality standards. It validates markdown files across five content types (Positions, Transitions, Submissions, Concepts, Systems) against the YAML schema defined in `CONTRIBUTING-YAML-SCHEMA.md`.

### Why Validation Matters

**Content Quality**: Ensures all technical content is complete, accurate, and follows standardized formats.

**State Machine Integrity**: Validates that position transitions, success rates, and IDs are properly structured for the BJJ state machine.

**SEO Compliance**: Checks that titles, descriptions, and schema markup meet SEO standards.

**Safety Assurance**: For submissions, ensures mandatory safety sections are present and comprehensive.

**Link Integrity**: Validates that all wikilinks resolve to existing content files.

### What It Validates

- **ID Format & Uniqueness**: S###, T###, SUB###, C###, SC### formats with duplicate detection
- **Required Sections**: Ensures all mandatory content sections are present
- **Success Rates**: Validates format, ordering (Beginner ≤ Intermediate ≤ Advanced), and realistic values (0-100%)
- **Wikilink Resolution**: Verifies all `[[wikilinks]]` point to existing files
- **Expert Insights**: Checks for presence of all three experts (Danaher, Gordon Ryan, Eddie Bravo)
- **SEO Elements**: Validates title/description format, length, and keyword integration
- **Safety Sections**: For submissions, ensures comprehensive safety documentation
- **Physical Requirements**: Checks that all four requirements are specified (Strength, Flexibility, Coordination, Speed)
- **State Properties**: Validates position type, risk level, energy cost, and other metadata

**Validation Coverage**: 214+ content files across 5 categories with 50+ distinct validation checks.

---

## Quick Start

### Installation

The script is part of the BJJ Graph repository and requires Python 3.7+. No external dependencies needed.

```bash
# Make script executable (optional)
chmod +x scripts/validate_content.py

# Test script runs correctly
python3 scripts/validate_content.py --help
```

### Basic Commands

```bash
# Validate all content (recommended before commits)
python3 scripts/validate_content.py source/content/

# Validate specific content type
python3 scripts/validate_content.py source/content/ --type Positions
python3 scripts/validate_content.py source/content/ --type Transitions
python3 scripts/validate_content.py source/content/ --type Submissions

# Verbose mode (shows warnings and info messages)
python3 scripts/validate_content.py source/content/ --verbose

# Strict mode (warnings become errors)
python3 scripts/validate_content.py source/content/ --strict

# Combined flags
python3 scripts/validate_content.py source/content/ --type Positions -v
```

### Exit Codes

- **0**: All files passed validation
- **1**: One or more files failed validation (errors found)

**CI/CD Integration**: Use exit codes to fail builds when validation errors are detected.

---

## Validation Rules

### Positions (S### IDs)

#### Required Sections

1. **State Properties** - Core position metadata
   - State ID: S### format (3 digits with leading zeros)
   - Point Value: 0-4 (IBJJF scoring)
   - Position Type: Offensive/Defensive/Neutral/Controlling
   - Risk Level: Low/Medium/High
   - Energy Cost: Low/Medium/High
   - Time Sustainability: Short/Medium/Long

2. **Visual Description** - Detailed body positioning
   - Minimum 200 characters
   - Should describe body configuration, weight distribution, contact points
   - Example: "Top player establishes chest-to-chest contact with hips perpendicular to bottom player's torso..."

3. **Offensive Transitions** - Available techniques from this position
   - Minimum 3 transitions with full success rates
   - Format: `[[Technique]] → [[Position]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)`
   - Must link to existing technique and position files

4. **Decision Tree** - Probabilistic state machine logic
   - If/else structure covering major scenarios
   - Includes probability estimates for each branch
   - Example: "If opponent establishes strong posture: Execute [[Hip Bump Sweep]] → [[Mount]] (Probability: 55%)"

5. **Expert Insights** - All three authorities required
   - John Danaher (systematic/technical)
   - Gordon Ryan (competitive/modern)
   - Eddie Bravo (innovative/unorthodox)
   - Each 2-3 sentences

6. **Common Errors** - Minimum 5 errors with corrections
   - Format: Error → Consequence → Correction
   - Should include recognition tips

#### Validation Checks

**ID Format**:
- Must match pattern: `S\d{3}` (e.g., S002, S042, S099)
- Leading zeros required (S002, not S2)
- Must be unique across all position files
- Script detects duplicates automatically

**Success Rates**:
- All transitions must have three skill levels
- Format: `Beginner X%, Intermediate Y%, Advanced Z%`
- Values must be integers 0-100
- Ordering: Beginner ≤ Intermediate ≤ Advanced (5% tolerance for unusual cases)
- Realistic ranges: Beginner 20-60%, Intermediate 40-75%, Advanced 60-95%

**State Properties**:
- All six properties must be present
- Point Value must be integer 0-4
- Energy Cost, Risk Level use Low/Medium/High values

**Position Metrics** (recommended):
- Position Retention Rate (by skill level)
- Advancement Probability (by skill level)
- Submission Probability (by skill level)
- Position Loss Probability (by skill level)

#### Example Validation Output

```
✗ Standing up.md
  Path: source/content/Positions/Standing up.md
  Type: Position
  ERROR: Missing or invalid State ID (format: S###)
  ERROR: Missing required section: State Properties
  ERROR: Missing required section: Visual Description
  WARNING: Only 2 transitions with full success rates found (minimum 3 recommended)
  WARNING: Missing John Danaher expert insight
```

---

### Transitions (T### IDs)

#### Required Sections

1. **Core Identifiers**
   - Transition ID: T### format
   - Transition Name: Official technique name
   - Alternative Names: Common variations

2. **State Machine Properties**
   - Starting State: `[[Position Where Transition Begins]]` (must be wikilink)
   - Ending State: `[[Position Where Transition Ends]]` (must be wikilink)
   - Transition Type: Escape/Attack/Advancement/Counter/Setup

3. **Visual Execution Sequence**
   - Step-by-step visual description
   - Should complement numbered execution steps

4. **Execution Steps**
   - Minimum 6 numbered steps
   - Format: `1. **Step Name**: Description with timing`
   - Each step should include setup, movement, completion

5. **Common Counters**
   - Minimum 3 counters with success rates
   - Format: `- **Counter Name**: Description → [[Resulting Position]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)`

6. **Expert Insights** - All three required

7. **Common Errors** - Minimum 5 errors

8. **Knowledge Assessment Questions**
   - Minimum 5 questions covering:
     - Mechanical Understanding
     - Timing Recognition
     - Error Prevention
     - Setup Requirements
     - Adaptation

#### Validation Checks

**ID Format**:
- Must match pattern: `T\d{3}` (e.g., T045, T904)
- Leading zeros required
- Must be unique across all transition files

**State Links**:
- Starting State must be valid wikilink to position file
- Ending State must be valid wikilink to position file
- Warning if not formatted as wikilinks

**Success Probability**:
- Must be present in Transition Properties section
- All three skill levels required
- Same format and ordering rules as positions

**Physical Requirements** (all four required):
- Strength Requirements: Low/Medium/High
- Flexibility Requirements: Low/Medium/High
- Coordination Requirements: Low/Medium/High
- Speed Requirements: Low/Medium/High

**Execution Steps**:
- Minimum 6 numbered steps recommended
- Script counts steps matching pattern: `^\d+\.\s+\*\*`

**Counters**:
- Minimum 3 common counters recommended
- Each should link to resulting position with success rates

#### Example Validation Output

```
✗ Hip Escape.md
  Path: source/content/Transitions/Hip Escape.md
  Type: Transition
  ERROR: Missing or invalid Transition ID (format: T###)
  WARNING: Starting State should be a wikilink
  WARNING: Only 4 execution steps found (minimum 6 recommended)
  WARNING: Only 2 common counters found (minimum 3 recommended)
  WARNING: Missing physical requirements: Coordination Requirements, Speed Requirements
  WARNING: Only 3 knowledge questions found (minimum 5 recommended)
```

---

### Submissions (SUB### or S### IDs)

#### Required Sections

1. **Core Identifiers**
   - Submission ID: SUB### format (or legacy S### format)
   - Submission Name
   - Alternative Names

2. **State Machine Properties**
   - Starting State: Required control position
   - Ending State: Must be `[[Won by Submission]]` (terminal state)
   - Submission Type: Choke/Joint Lock/Compression/Crank
   - Target Area: Specific anatomical region

3. **Safety Considerations** (MANDATORY)
   - Injury Risks: Potential damage from improper application
   - Application Speed: Proper rate of pressure increase
   - Tap Recognition: Identifying submission signals
   - Release Technique: How to safely disengage after tap
   - Training Protocols: Safe drilling and sparring guidelines

4. **Visual Execution Sequence**

5. **Execution Steps**
   - Minimum 6 setup/execution steps
   - Must include timing considerations

6. **Expert Insights** - All three required with safety emphasis

7. **Common Errors**
   - Minimum 5 errors
   - Must include dedicated safety errors with DANGER labels

#### Validation Checks

**ID Format**:
- Preferred: `SUB\d{3}` (e.g., SUB001, SUB049)
- Legacy: `S\d{3}` (e.g., S201) - script recommends updating to SUB### format
- Must be unique across all submission files

**Safety Section (MANDATORY)**:
- Script checks for patterns: "Safety Considerations", "Safety"
- Case-insensitive search
- Missing safety section is an ERROR, not a warning
- Critical for user safety and liability

**Ending State**:
- Must be `[[Won by Submission]]`
- Script validates and warns if different ending state found
- This is the terminal state in the state machine

**Submission Properties**:
- Starting State, Ending State, Submission Type must be present
- Success Probability with all three skill levels required

**Setup/Execution Steps**:
- Minimum 6 numbered steps recommended
- Should include timing windows for application

#### Example Validation Output

```
✗ Rear Naked Choke.md
  Path: source/content/Submissions/Rear Naked Choke.md
  Type: Submission
  ERROR: MANDATORY: Missing Safety Considerations section
  WARNING: Only 4 setup/execution steps found (minimum 6 recommended)
  WARNING: Ending State should be [[Won by Submission]], found [[Back Control]]
  INFO: Consider updating to SUB### format (current S### is legacy)
```

---

### Concepts (C### IDs)

#### Recommended Sections

1. **Concept Properties**
   - Concept ID: C### format (recommended, not required)
   - Application Level: Fundamental/Intermediate/Advanced
   - Complexity Level: Low/Medium/High
   - Development Timeline: Beginner to Advanced / White Belt to Black Belt

2. **Key Principles** - Bulleted list of core ideas

3. **Application Contexts** - Where/when principle applies

4. **Developmental Metrics** - How to measure understanding

5. **Expert Insights** - Recommended but not required

6. **Concept Relationships** - Links to related concepts

#### Validation Checks

**ID Format**:
- Pattern: `C\d{3}` (e.g., C111)
- Warning if missing (not error - recommended for consistency)
- Must be unique if present

**No Success Rates**:
- Concepts are principles, not techniques
- Should NOT have success rate data
- Script warns if success rates found

**Relationships**:
- Info message if Concept Relationships section missing
- Recommended for providing context

**Expert Insights**:
- Info messages if experts missing
- Not required but recommended for comprehensive coverage

#### Example Validation Output

```
✓ Base Maintenance.md
  Path: source/content/Concepts/Base Maintenance.md
  Type: Concept
  INFO: Missing Eddie Bravo expert insight - recommended for comprehensive coverage
  INFO: Missing Concept Relationships section - recommended for context
```

---

### Systems (SC### IDs)

#### Recommended Sections

1. **Chain Properties**
   - Chain ID: SC### format (recommended)
   - Primary Submissions: Minimum 2 submissions in chain
   - Starting Positions: Where to initiate system
   - Difficulty Level: Beginner/Intermediate/Advanced
   - Strategic Value: Low/Medium/High

2. **Decision Tree** - If/then logic with → transitions

3. **Submission Sequence** - Ordered chain of techniques

4. **Expert Insights** - Multiple authorities recommended

5. **Core Mechanical Principles**

6. **Setup Positions** - Entry points for system

7. **Common Defensive Reactions** - And appropriate responses

#### Validation Checks

**ID Format**:
- Pattern: `SC\d{3}` (e.g., SC002)
- Warning if missing (recommended for consistency)
- Must be unique if present

**Primary Submissions**:
- Minimum 2 submissions recommended
- Script extracts submissions from Primary Submissions property
- Each should be a valid wikilink

**Decision Tree Structure**:
- Should include if/then logic with → transitions
- Warning if missing structural elements
- Example: "If opponent defends X → apply Y"

**Expert Insights**:
- Info message if fewer than 2 experts present
- Systems benefit from multiple strategic perspectives

#### Example Validation Output

```
✓ Kimura Trap System.md
  Path: source/content/Systems/Kimura Trap System.md
  Type: System
  WARNING: Only 1 primary submission found (minimum 2 recommended)
  WARNING: Decision Tree section should include if/then logic with → transitions
  INFO: Consider adding expert insights from multiple authorities
```

---

## Understanding Output

### Report Structure

The validation report contains four main sections:

1. **Summary Statistics** - High-level overview
2. **By Content Type Breakdown** - Results grouped by category
3. **Files with Errors** - Failed validations with details
4. **Files with Warnings** - Passed files with recommendations (verbose mode only)

### Example Full Report

```
================================================================================
BJJ GRAPH CONTENT VALIDATION REPORT
================================================================================

SUMMARY:
  Total Files Validated: 214
  ✓ Passed: 147
  ✗ Failed: 67
  Total Errors: 154
  Total Warnings: 892
  Total Info: 238

BY CONTENT TYPE:
  Position:
    Total: 92, Passed: 25, Failed: 67
    Errors: 134, Warnings: 541
  Transition:
    Total: 71, Passed: 68, Failed: 3
    Errors: 12, Warnings: 189
  Submission:
    Total: 49, Passed: 46, Failed: 3
    Errors: 6, Warnings: 148
  Concept:
    Total: 2, Passed: 2, Failed: 0
    Errors: 0, Warnings: 14

================================================================================
FILES WITH ERRORS:
================================================================================

✗ Standing up.md
  Path: source/content/Positions/Standing up.md
  Type: Position
  ERROR: Missing or invalid State ID (format: S###)
  ERROR: Missing required section: State Properties
  ERROR: Missing required section: Visual Description
  ERROR: Missing required section: Offensive Transitions
  ERROR: Missing required section: Decision Tree
  ERROR: Missing required section: Expert Insights
  ERROR: Missing required section: Common Errors

✗ Mount.md
  Path: source/content/Positions/Mount.md
  Type: Position
  ERROR: Duplicate State ID S001 (also in Mount Control)
  WARNING: Only 2 transitions with full success rates found (minimum 3 recommended)

================================================================================
FILES WITH WARNINGS (Verbose Mode):
================================================================================

✓ Closed Guard Bottom.md
  Path: source/content/Positions/Closed Guard Bottom.md
  Type: Position
  WARNING: Visual Description is too short (minimum 200 characters recommended)
  WARNING: Only 5 transitions with full success rates found (minimum 6 recommended)
  INFO: Missing position metric: Position Loss Probability

================================================================================
✗ 67 file(s) failed validation
================================================================================
```

### Message Severity Levels

**ERROR** (red, blocks validation):
- Missing required sections
- Invalid ID format
- Duplicate IDs
- Missing safety sections (submissions)
- Broken structure

**WARNING** (yellow, validation passes):
- Recommended sections missing
- Insufficient content count (too few errors, steps, etc.)
- Suboptimal formatting
- Missing expert insights
- Description length issues

**INFO** (blue, informational only):
- Suggestions for improvement
- Optional sections missing
- Format recommendations
- Legacy format notices

### Interpreting Success Rates

The script validates success rate ordering with 5% tolerance for unusual cases:

```
# Valid examples
Beginner 50%, Intermediate 70%, Advanced 85%  ✓ (proper ordering)
Beginner 60%, Intermediate 60%, Advanced 70%  ✓ (equal beginner/intermediate acceptable)
Beginner 55%, Intermediate 50%, Advanced 65%  ✓ (within 5% tolerance)

# Invalid examples
Beginner 70%, Intermediate 50%, Advanced 85%  ✗ (beginner > intermediate by >5%)
Beginner 50%, Intermediate 80%, Advanced 60%  ✗ (intermediate > advanced)
Beginner 150%, Intermediate 80%, Advanced 90% ✗ (value out of range)
```

**Unusual ordering triggers INFO message, not error** - Some defensive techniques may have lower intermediate success than beginner due to increased opponent skill.

---

## Common Errors & Fixes

### Top 10 Validation Errors

#### 1. Missing State ID

**Error Message**: `Missing or invalid State ID (format: S###)`

**Problem**: Position file doesn't have properly formatted State ID.

**Fix**:
```markdown
## State Properties
- **State ID**: S042
- **Point Value**: 4
...
```

**Common Mistakes**:
- Using `S42` instead of `S042` (missing leading zero)
- Using `state_id` or `StateID` (wrong capitalization)
- Placing ID outside State Properties section

---

#### 2. Missing Visual Description

**Error Message**: `Missing required section: Visual Description`

**Problem**: Position file doesn't have detailed body positioning description.

**Fix**:
```markdown
## State Properties
...

### Visual Description

Top player establishes chest-to-chest contact with hips perpendicular to
bottom player's torso. Weight is distributed across the bottom player's
chest and hips, with knees positioned near the bottom player's armpits.
The top player's head is positioned near the bottom player's head to
control posture and maintain balance. Hands are posted on the mat for
base or controlling the bottom player's arms.
```

**Minimum Requirements**:
- 200+ characters
- Describes body configuration
- Includes weight distribution
- Mentions contact points
- Uses anatomical detail

---

#### 3. Incomplete Success Rates

**Error Message**: `Incomplete success rates (found 2/3 levels)`

**Problem**: Transition or position link missing one or more skill levels.

**Fix**:
```markdown
## Offensive Transitions
- [[Hip Bump Sweep]] → [[Mount]] (Success Rate: Beginner 50%, Intermediate 70%, Advanced 85%)
```

**Common Mistakes**:
- Only listing "Success Rate: 70%" (no skill levels)
- Listing only "Beginner 50%, Advanced 85%" (missing Intermediate)
- Misspelling skill level names ("Intermediary", "Novice", "Expert")

---

#### 4. Broken Wikilinks

**Error Message**: `Wikilink [[Triangle Setup]] does not resolve to existing file`

**Problem**: Internal link points to non-existent file.

**Fix**:
1. Check if file exists with exact name (case-sensitive)
2. Verify spelling and spacing
3. Use correct filename without .md extension
4. Create missing file if necessary

**Example Resolution**:
```markdown
# Wrong (file doesn't exist)
[[Triangle Setup]] → [[Triangle Control]]

# Correct (file exists as "Triangle Choke.md")
[[Triangle Choke]] → [[Triangle Control]]
```

**Special Cases** (automatically skipped by validator):
- `[[Won by Submission]]` (terminal state, doesn't need file)
- `[[Guard Opening Sequence]]` (conceptual state)
- `[[Posture and Base]]` (conceptual state)

---

#### 5. Missing Safety Section (Submissions)

**Error Message**: `MANDATORY: Missing Safety Considerations section`

**Problem**: Submission file doesn't have comprehensive safety documentation.

**Fix**:
```markdown
### Safety Considerations

⚠️ **SAFETY FIRST**: This submission can cause serious injury if applied
incorrectly or too quickly.

**Injury Risks**:
- Elbow dislocation or hyperextension (severe, 6-12 week recovery)
- Ligament damage (moderate to severe, 3-6 month recovery)
- Joint capsule damage (moderate, 4-8 week recovery)

**Application Speed**: Apply pressure SLOWLY over 3-5 seconds minimum.
Never "crank" or "snap" the submission.

**Tap Signals**:
- Verbal tap: "TAP" or "STOP"
- Physical tap: 2+ taps on opponent or mat
- Emergency tap: Any frantic/unusual movement

**Release Protocol**:
1. Immediately release all pressure when tap detected
2. Slowly return arm to neutral position
3. Allow opponent to move freely
4. Check for injury before resuming training
```

**Critical Elements**:
- ⚠️ emoji and safety-first language
- Specific injury risks with severity and recovery time
- Explicit application speed guidance (3-5 seconds minimum)
- All valid tap signals documented
- Step-by-step release protocol
- Training progression that emphasizes safety

---

#### 6. Missing Expert Insights

**Error Message**: `Missing John Danaher expert insight`

**Problem**: Technical page doesn't include insights from all three experts.

**Fix**:
```markdown
### Expert Insights

- **John Danaher**: "The closed guard represents a complete defensive
  framework where the guard player's legs become a shield that prevents
  all passing attempts while simultaneously offering offensive opportunities.
  The key is maintaining constant tension in the legs to prevent opening
  while keeping the opponent's posture broken."

- **Gordon Ryan**: "In competition, I use closed guard primarily as a
  holding position when I'm ahead on points or when I need to recover
  energy. It's one of the safest positions in BJJ where you can control
  the pace and choose your moments to attack."

- **Eddie Bravo**: "The closed guard becomes exponentially more dangerous
  when you start adding rubber guard, invisible collar, and other 10th
  Planet modifications. Don't just think of it as a defensive position -
  it's a submission factory if you develop the flexibility and understand
  the angles."
```

**Expert Characterization**:
- **Danaher**: Technical precision, biomechanical analysis, systematic approach
- **Gordon Ryan**: Competition application, winning strategies, modern meta
- **Eddie Bravo**: Innovation, unorthodox variations, 10th Planet methodology

**Length**: 2-3 sentences per expert, distinct perspectives.

---

#### 7. Insufficient Execution Steps

**Error Message**: `Only 4 execution steps found (minimum 6 recommended)`

**Problem**: Transition doesn't have detailed enough step-by-step instructions.

**Fix**:
```markdown
### Execution Steps

1. **Establish Closed Guard Control**: Lock your legs around opponent's
   waist with ankles crossed. Break their posture by pulling them forward
   with collar grip.

2. **Create Off-Balance Angle**: Post your left hand on the mat beside
   your hip. Sit up at 45-degree angle toward your left side.

3. **Release Guard and Frame**: Open your guard and place right foot on
   opponent's left hip. Maintain collar grip and create distance.

4. **Position for Sweep**: Slide left knee across opponent's chest while
   maintaining hip distance with right foot.

5. **Execute Hip Bump**: Drive your hips up and forward into opponent's
   chest while pulling their head over your left shoulder.

6. **Complete Sweep**: Use momentum to sweep opponent backward onto their
   back. Follow them over to establish mount position.

7. **Secure Top Position**: Land in mount with knees tight to opponent's
   sides. Establish base and begin mount control sequence.
```

**Step Requirements**:
- 6-8 steps for complex techniques
- 4-5 steps for simple techniques
- Each step includes timing or positioning cues
- Format: `N. **Step Name**: Description`

---

#### 8. Invalid ID Format

**Error Message**: `Missing or invalid Transition ID (format: T###)`

**Problem**: ID doesn't follow required format with leading zeros.

**Fix**:
```markdown
# Wrong formats
- **Transition ID**: T45        ✗ (missing leading zero)
- **Transition ID**: T-045      ✗ (hyphen not allowed)
- **Transition ID**: TRANS045   ✗ (wrong prefix)

# Correct format
- **Transition ID**: T045       ✓ (proper format)
```

**ID Prefixes**:
- Positions: `S###` (e.g., S002, S042, S099)
- Transitions: `T###` (e.g., T001, T045, T904)
- Submissions: `SUB###` or legacy `S###` (e.g., SUB001, S201)
- Concepts: `C###` (e.g., C111)
- Systems: `SC###` (e.g., SC002)

---

#### 9. Missing Physical Requirements

**Error Message**: `Missing physical requirements: Coordination Requirements, Speed Requirements`

**Problem**: Transition doesn't specify all four physical requirements.

**Fix**:
```markdown
### Physical Requirements

- **Strength Requirements**: Medium
- **Flexibility Requirements**: Low
- **Coordination Requirements**: Medium
- **Speed Requirements**: Low
```

**All Four Required**:
- Strength Requirements
- Flexibility Requirements
- Coordination Requirements
- Speed Requirements

**Valid Values**: Low, Medium, High (only)

---

#### 10. Missing Knowledge Assessment

**Error Message**: `Only 3 knowledge questions found (minimum 5 recommended)`

**Problem**: Transition doesn't have comprehensive knowledge testing.

**Fix**:
```markdown
### Knowledge Assessment Questions

- **Mechanical Understanding**: What is the mechanical principle that makes
  the hip bump sweep effective? (Answer: Creating an angle and using hip
  momentum to disrupt opponent's base)

- **Timing Recognition**: When is the optimal time to execute this sweep?
  (Answer: When opponent's posture is broken and they are leaning forward
  with hands posted)

- **Error Prevention**: What is the most common mistake that causes this
  sweep to fail? (Answer: Attempting the sweep without first breaking
  opponent's posture)

- **Setup Requirements**: What are the three critical setup requirements?
  (Answer: 1) Broken posture, 2) Collar grip, 3) Angle creation with posted hand)

- **Adaptation**: How would you modify this technique if opponent has
  extremely strong posture? (Answer: Use collar drag to break posture first,
  or transition to pendulum sweep)
```

**Five Categories**:
1. Mechanical Understanding (biomechanics)
2. Timing Recognition (when to execute)
3. Error Prevention (common mistakes)
4. Setup Requirements (prerequisites)
5. Adaptation (variations/counters)

---

## Integration

### Pre-Commit Hooks

**Automatically validate content before commits:**

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Run content validation
python3 scripts/validate_content.py source/content/

# Check exit code
if [ $? -ne 0 ]; then
    echo "❌ Content validation failed. Fix errors before committing."
    exit 1
fi

echo "✓ Content validation passed"
exit 0
```

**Setup**:
```bash
chmod +x .git/hooks/pre-commit
```

**Benefits**:
- Prevents invalid content from entering repository
- Immediate feedback during development
- Reduces PR review time

---

### CI/CD Pipelines (GitHub Actions)

**Validate content on every pull request:**

Create `.github/workflows/validate-content.yml`:

```yaml
name: Validate Content

on:
  pull_request:
    paths:
      - 'source/content/**/*.md'
  push:
    branches:
      - main
    paths:
      - 'source/content/**/*.md'

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'

      - name: Validate content
        run: |
          python3 scripts/validate_content.py source/content/ --verbose

      - name: Comment on PR with results
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '❌ Content validation failed. Please fix errors before merging.'
            })
```

**Validation Triggers**:
- Pull requests modifying markdown files
- Pushes to main branch
- Manual workflow dispatch

---

### Editor Integration (VS Code)

**Run validation from VS Code tasks:**

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Validate All Content",
      "type": "shell",
      "command": "python3",
      "args": [
        "scripts/validate_content.py",
        "source/content/",
        "--verbose"
      ],
      "group": {
        "kind": "test",
        "isDefault": true
      },
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "Validate Positions",
      "type": "shell",
      "command": "python3",
      "args": [
        "scripts/validate_content.py",
        "source/content/",
        "--type",
        "Positions",
        "--verbose"
      ],
      "group": "test",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "Validate Current File Type",
      "type": "shell",
      "command": "python3",
      "args": [
        "scripts/validate_content.py",
        "source/content/",
        "--type",
        "${fileDirname}",
        "--verbose"
      ],
      "group": "test",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    }
  ]
}
```

**Usage**:
1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Tasks: Run Task"
3. Select validation task

**Keyboard Shortcut** (optional):

Add to `.vscode/keybindings.json`:
```json
[
  {
    "key": "cmd+shift+v",
    "command": "workbench.action.tasks.runTask",
    "args": "Validate All Content"
  }
]
```

---

### Documentation Builds

**Fail documentation builds on validation errors:**

Add to `package.json` or build script:

```json
{
  "scripts": {
    "validate": "python3 scripts/validate_content.py source/content/",
    "prebuild": "npm run validate",
    "build": "npx quartz build"
  }
}
```

**Build Process**:
1. `npm run build` → runs `prebuild` hook first
2. `prebuild` → runs content validation
3. If validation fails (exit code 1), build stops
4. If validation passes (exit code 0), Quartz build proceeds

---

## Advanced Usage

### Custom Validation Profiles

**Create focused validation for specific needs:**

```bash
# Validate only positions with verbose output
python3 scripts/validate_content.py source/content/ --type Positions -v

# Strict mode for CI/CD (warnings become errors)
python3 scripts/validate_content.py source/content/ --strict

# Validate specific category without seeing warnings
python3 scripts/validate_content.py source/content/ --type Submissions
```

---

### Filtering Output

**Use grep to filter validation output:**

```bash
# Show only errors (not warnings)
python3 scripts/validate_content.py source/content/ 2>&1 | grep "ERROR:"

# Show only files that failed
python3 scripts/validate_content.py source/content/ 2>&1 | grep "^✗"

# Show only safety-related issues (submissions)
python3 scripts/validate_content.py source/content/ --type Submissions -v 2>&1 | grep -i "safety"

# Count total errors
python3 scripts/validate_content.py source/content/ 2>&1 | grep -c "ERROR:"
```

---

### Batch Processing

**Validate subsets of content efficiently:**

```bash
# Validate each content type separately
for type in Positions Transitions Submissions Concepts Systems; do
  echo "Validating $type..."
  python3 scripts/validate_content.py source/content/ --type $type
done

# Validate and save reports
for type in Positions Transitions Submissions Concepts Systems; do
  python3 scripts/validate_content.py source/content/ --type $type -v \
    > "validation_reports/${type}_$(date +%Y%m%d).txt"
done
```

---

### Programmatic Integration

**Use validator in Python scripts:**

```python
from pathlib import Path
import sys

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent / 'scripts'))

from validate_content import ContentValidator

# Initialize validator
validator = ContentValidator(
    content_dir='source/content/',
    verbose=True,
    strict=False
)

# Run validation
summary = validator.validate_all(content_type='Positions')

# Check results
if summary['failed'] > 0:
    print(f"❌ {summary['failed']} files failed validation")

    # Get failed files
    failed_files = [r for r in summary['results'] if not r.passed]

    # Process each failed file
    for result in failed_files:
        print(f"\nFile: {result.file_path}")
        for error in result.errors:
            print(f"  - {error.message}")

    sys.exit(1)
else:
    print("✓ All files passed validation")
    sys.exit(0)
```

---

### Validation Report Export

**Export validation results for analysis:**

```bash
# Export to JSON (requires script modification)
python3 scripts/validate_content.py source/content/ -v \
  --format json > validation_report.json

# Export to CSV (manual processing)
python3 scripts/validate_content.py source/content/ -v 2>&1 \
  | grep "^✗\|ERROR:\|WARNING:" \
  | sed 's/  /,/g' > validation_report.csv

# Export summary only
python3 scripts/validate_content.py source/content/ 2>&1 \
  | grep -A 10 "SUMMARY:" > validation_summary.txt
```

---

## Troubleshooting

### Common Issues

#### Issue: Script fails with "No module named 'validate_content'"

**Cause**: Running script from wrong directory.

**Solution**:
```bash
# Run with correct path
python3 scripts/validate_content.py source/content/
```

---

#### Issue: "FileNotFoundError: source/content/ does not exist"

**Cause**: Content directory path is incorrect.

**Solution**:
```bash
# Check current directory
pwd

# Should be in repository root, not source/ directory
# If in source/:
cd ..

# Then run validation
python3 scripts/validate_content.py source/content/
```

---

#### Issue: Unicode errors when reading files

**Cause**: Files contain invalid UTF-8 characters.

**Solution**:
```bash
# Find files with invalid UTF-8
find source/content/ -name "*.md" -exec file {} \; | grep -v "UTF-8"

# Convert files to UTF-8
iconv -f ISO-8859-1 -t UTF-8 problematic_file.md -o fixed_file.md
```

---

#### Issue: Too many warnings obscure important errors

**Cause**: Verbose mode shows all warnings.

**Solution**:
```bash
# Run without verbose mode to see only errors
python3 scripts/validate_content.py source/content/

# Or filter output to show errors first
python3 scripts/validate_content.py source/content/ -v 2>&1 \
  | grep -A 20 "FILES WITH ERRORS:"
```

---

#### Issue: Validation is too slow

**Cause**: Validating 200+ files can take time.

**Solution**:
```bash
# Validate only specific type
python3 scripts/validate_content.py source/content/ --type Positions

# Or validate only recently modified files
find source/content/ -name "*.md" -mtime -1 -print \
  | while read file; do
      python3 scripts/validate_content.py "$(dirname "$file")"
    done
```

---

#### Issue: False positive wikilink errors

**Cause**: Validator doesn't recognize valid special cases.

**Solution**:
Check validator code line 618-619 for special case handling:

```python
# Skip common special cases
if clean_link in ['Won by Submission', 'Guard Opening Sequence', 'Posture and Base']:
    continue
```

Add new special cases if needed.

---

#### Issue: Validator doesn't detect duplicate IDs across types

**Cause**: IDs are only checked within same content type.

**Expected Behavior**: This is intentional - S001 (position) can coexist with S001 (submission) because they use different naming contexts. However, within positions, all State IDs must be unique.

---

### Getting Help

**Documentation Resources**:
- This guide: `/docs/tools/content-validation.md`
- YAML Schema: `/source/content/CONTRIBUTING-YAML-SCHEMA.md`
- Position Standards: `/source/content/Positions/CONTRIBUTING-POSITIONS.md`
- Transition Standards: `/source/content/Transitions/CONTRIBUTING-TRANSITIONS.md`
- Submission Standards: `/source/content/Submissions/CONTRIBUTING-SUBMISSIONS.md`

**Command Help**:
```bash
python3 scripts/validate_content.py --help
```

**Testing Validation**:
```bash
# Test on single file by validating its directory
python3 scripts/validate_content.py source/content/Positions/ --type Positions -v
```

---

## Version History

**v1.0** (Current)
- Comprehensive validation for all 5 content types
- ID format and uniqueness validation
- Success rate format and ordering validation
- Wikilink resolution validation
- Expert insight presence validation
- SEO element validation
- Safety section validation for submissions
- Physical requirements validation
- Section completeness validation
- Support for verbose and strict modes
- Content-type filtering
- Exit code reporting for CI/CD

**Future Enhancements**:
- JSON export format for programmatic consumption
- Performance optimization for large repositories
- Integration with content improvement bot
- Custom validation rule configuration
- Automated fix suggestions for common errors
- Integration with VS Code extension
- Real-time validation during editing
- Validation result caching

---

## Related Documentation

**Scripts**:
- `/scripts/README.md` - Scripts overview
- `/scripts/seo/README.md` - SEO schema scripts
- `/scripts/link_optimizer/README.md` - Link validation and optimization

**Content Standards**:
- `/source/content/CONTRIBUTING-YAML-SCHEMA.md` - Complete YAML schema
- `/source/content/Positions/CONTRIBUTING-POSITIONS.md` - Position standards
- `/source/content/Transitions/CONTRIBUTING-TRANSITIONS.md` - Transition standards
- `/source/content/Submissions/CONTRIBUTING-SUBMISSIONS.md` - Submission standards
- `/source/content/Concepts/CONTRIBUTING-CONCEPTS.md` - Concept standards
- `/source/content/Systems/CONTRIBUTING-SYSTEMS.md` - System standards

**Project Docs**:
- `/docs/CONTRIBUTING.md` - Developer guide
- `/docs/seo-implementation-complete.md` - SEO implementation status
- `/docs/content-standardization-guide.md` - V2 content standards

---

*Last updated: 2025-10-14 | Validation script version: 1.0*
