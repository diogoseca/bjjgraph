# BJJ Graph Content Standardization Guide

## Table of Contents
1. [Overview](#overview)
2. [For Content Creators](#for-content-creators)
3. [For the Bot](#for-the-bot)
4. [For Developers](#for-developers)
5. [Migration Plan](#migration-plan)
6. [Quality Assurance](#quality-assurance)
7. [FAQs](#faqs)

---

## Overview

### What the V2 Standard Achieves

The V2 content standard transforms BJJ Graph from a documentation site into a **dual-purpose knowledge base** that serves both human learning and AI/game engine consumption. Every position and transition file becomes a structured data source while maintaining rich educational content.

**Key Achievements:**

1. **Machine-Readable State Machine**: Structured YAML frontmatter enables programmatic parsing for the BJJ game engine
2. **Probabilistic Modeling**: Success rates by skill level (Beginner/Intermediate/Advanced) enable realistic simulations
3. **Decision Tree Logic**: Clear if/else branching enables AI opponent behavior
4. **Expert Knowledge Integration**: Systematic insights from Danaher, Gordon Ryan, and Eddie Bravo
5. **SEO Optimization**: Schema.org markup (HowTo, FAQ) for better search rankings
6. **Educational Depth**: Common errors, prerequisites, and training progressions for learners

### Why This Matters

**For the Website:**
- Consistent structure improves user navigation
- Rich metadata enables better search functionality
- Internal linking strengthens SEO
- Schema markup increases Google feature snippet eligibility

**For the Game Engine:**
- Probabilistic state machine enables turn-based BJJ simulation
- Energy costs and success modifiers create realistic gameplay
- Decision trees drive AI opponent behavior
- System mastery bonuses reward systematic play (Danaher philosophy)

**For Content Quality:**
- Standards eliminate placeholder content
- Validation catches broken links and missing data
- Templates ensure comprehensive coverage
- Expert insights add authentic technical depth

### Current State vs Target State

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Total Files** | 264 | 264 | ✅ |
| **Placeholder Instances** | 446 | 0 | 🚧 In Progress |
| **Broken Links** | 1,767 | <50 | 🚧 In Progress |
| **Standardized Positions** | ~10 | 93 | 🚧 Phase 2 |
| **Standardized Transitions** | ~5 | 69 | 🚧 Phase 2 |
| **SEO Schema Markup** | ~15 files | 162 files | 🚧 Phase 2 |

---

## For Content Creators

### How to Create New Files Following V2 Standard

#### Step 1: Choose Your Content Type

**Position Files** (90+ files in `/bjjgraph/source/content/Positions/`)
- BJJ positions as graph nodes (e.g., "Mount.md", "Closed Guard Bottom.md")
- Read the contributor guide: `/bjjgraph/source/content/Positions/CONTRIBUTING-POSITIONS.md`

**Transition Files** (70+ files in `/bjjgraph/source/content/Transitions/`)
- Techniques as graph edges (e.g., "Hip Bump Sweep.md", "Armbar.md")
- Read the contributor guide: `/bjjgraph/source/content/Transitions/CONTRIBUTING-TRANSITIONS.md`

**Note**: The CONTRIBUTING-*.md files are excluded from the website and are used by content creators and the improvement bot.

#### Step 2: Start with YAML Frontmatter

**Position Example:**
```yaml
---
title: "Mount | BJJ Position Guide | BJJ Graph"
description: "Master Mount in BJJ. Complete guide covering control, submissions, and transitions. Point value: 4. Success rates: Beginner 60%, Intermediate 75%, Advanced 85%."
state_machine:
  state_id: "S001"
  point_value: 4
  position_type: "Offensive"
  risk_level: "Low"
  energy_cost: "Medium"
  time_sustainability: "Long"
  retention_rate:
    beginner: 60
    intermediate: 75
    advanced: 85
  advancement_probability:
    beginner: 40
    intermediate: 55
    advanced: 70
---
```

**Transition Example:**
```yaml
---
title: "Hip Bump Sweep | BJJ Technique | BJJ Graph"
description: "Learn Hip Bump Sweep in BJJ. Step-by-step execution from Closed Guard Bottom to Mount. Success: Beginner 50%, Intermediate 70%, Advanced 85%."
state_machine:
  transition_id: "T045"
  starting_state: "Closed Guard Bottom"
  ending_state: "Mount"
  transition_type: "Attack"
  success_probability:
    beginner: 50
    intermediate: 70
    advanced: 85
  execution_complexity: "Low"
  energy_cost: "Low"
  time_required: "Quick"
  risk_level: "Low"
  physical_requirements:
    strength: "Low"
    flexibility: "Low"
    coordination: "Medium"
    speed: "Medium"
---
```

#### Step 3: Add Schema Markup for SEO

**HowTo Schema** (for techniques/transitions):
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Hip Bump Sweep",
  "description": "Learn how to execute Hip Bump Sweep in Brazilian Jiu-Jitsu from Closed Guard Bottom to Mount.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Setup Requirements",
      "text": "Establish collar grip and post hand on mat beside your hip",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Initial Movement",
      "text": "Begin sit-up motion while maintaining closed guard",
      "position": 2
    }
  ],
  "tool": ["BJJ Gi or No-Gi attire", "Training partner", "Mat space"],
  "totalTime": "PT5M"
}
</script>
```

**FAQ Schema** (for common errors):
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is a common mistake in maintaining mount?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Crossing your ankles under opponent's body makes you vulnerable to ankle lock sweeps. The correction is: Keep your knees spread wide with feet hooked under opponent's thighs for base."
      }
    }
  ]
}
</script>
```

#### Step 4: Write Core Content Sections

**Required for Positions:**
1. **State Properties** - IDs, point values, risk levels, energy costs
2. **Visual Description** - Detailed body positioning (4+ sentences)
3. **Key Principles** - 3-5 fundamental concepts
4. **Prerequisites** - Required skills before attempting
5. **State Invariants** - Conditions that must remain true
6. **Defensive Responses** - What opponent can do (when they have this position)
7. **Offensive Transitions** - What you can do (3+ options with success rates)
8. **Decision Tree** - If/else logic with probabilities
9. **Expert Insights** - Danaher, Gordon Ryan, Eddie Bravo (2-3 sentences each)
10. **Common Errors** - 5+ mistakes with consequences and corrections
11. **Training Drills** - Practice progressions

**Required for Transitions:**
1. **Core Identifiers** - Transition ID, names, alternatives
2. **State Machine Properties** - Starting state, ending state, type
3. **Transition Properties** - Success probabilities, complexity, costs
4. **Physical Requirements** - Strength, flexibility, coordination, speed
5. **Visual Execution Sequence** - Detailed movement description (4+ sentences)
6. **Execution Steps** - Numbered 6-step sequence
7. **Key Technical Details** - Grips, base, timing, leverage
8. **Success Modifiers** - Factors affecting probability (+/-%)
9. **Common Counters** - Opponent responses with success rates
10. **Decision Logic** - If/else opponent behavior
11. **Expert Insights** - Danaher, Gordon Ryan, Eddie Bravo
12. **Common Errors** - 3+ mistakes with corrections
13. **Timing Considerations** - When to attempt, when to avoid
14. **Prerequisites** - Technical skills needed first
15. **Knowledge Assessment Questions** - 5 technical questions
16. **Variants and Adaptations** - Gi/No-Gi/Competition differences
17. **Training Progressions** - Solo → Cooperative → Resistant → Live

#### Step 5: Use Wikilinks for State Machine

**Format:**
```markdown
[[Technique Name]] → [[Resulting Position]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)
```

**Examples:**
```markdown
- [[Hip Bump Sweep]] → [[Mount]] (Success Rate: Beginner 50%, Intermediate 70%, Advanced 85%)
- [[Triangle Choke]] → [[Triangle Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 55%)
- [[Armbar]] → [[Armbar Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 55%)
```

**Decision Tree Format:**
```markdown
## Decision Tree

If opponent establishes strong posture:
- Execute [[Hip Bump Sweep]] → [[Mount]] (Probability: 55%)
- Or Execute [[Scissor Sweep]] → [[Mount]] or [[Side Control Top]] (Probability: 50%)

Else if opponent drives forward with pressure:
- Execute [[Pendulum Sweep]] → [[Mount]] (Probability: 45%)
- Or Execute [[Triangle Choke]] → [[Triangle Control]] (Probability: 40%)

Else if opponent stands up:
- Transition to [[Open Guard Bottom]] → [[Open Guard Bottom]] (Probability: 60%)

Else (balanced opponent):
- Break posture and initiate [[Triangle Choke]] → [[Triangle Control]] (Probability: 40%)
- Or Execute [[Armbar]] → [[Armbar Control]] (Probability: 35%)
```

### Required Sections Checklist

**Position Files:**
- [ ] YAML frontmatter with `state_machine` data
- [ ] Schema markup (FAQ recommended)
- [ ] State Properties section
- [ ] Visual Description (4+ sentences)
- [ ] Key Principles (3-5 items)
- [ ] Prerequisites
- [ ] State Invariants
- [ ] Defensive Responses (3+ with success rates)
- [ ] Offensive Transitions (3+ with skill-level success rates)
- [ ] Decision Tree (3+ branches with probabilities)
- [ ] Expert Insights (Danaher, Gordon Ryan, Eddie Bravo)
- [ ] Common Errors (5+ with consequences and corrections)
- [ ] Training Drills (3+ progressions)
- [ ] Related Positions (3+ wikilinks)

**Transition Files:**
- [ ] YAML frontmatter with `state_machine` data
- [ ] Schema markup (HowTo + FAQ)
- [ ] Core Identifiers section
- [ ] State Machine Properties
- [ ] Transition Properties (with success probabilities)
- [ ] Physical Requirements (all 4 attributes)
- [ ] Visual Execution Sequence (4+ sentences)
- [ ] Execution Steps (6 numbered steps)
- [ ] Key Technical Details
- [ ] Success Modifiers (5+ factors)
- [ ] Common Counters (3+ with success rates)
- [ ] Decision Logic (if/else tree)
- [ ] Expert Insights (all 3 experts)
- [ ] Common Errors (3+ with full analysis)
- [ ] Timing Considerations
- [ ] Prerequisites
- [ ] Knowledge Assessment Questions (5 questions)
- [ ] Variants and Adaptations (5 categories)
- [ ] Training Progressions (5-step pathway)

### Common Mistakes to Avoid

#### 1. Missing State Machine Data
❌ **Wrong:**
```markdown
## State Properties
- Point Value: 4
- Type: Offensive
```

✅ **Right:**
```yaml
---
state_machine:
  state_id: "S001"
  point_value: 4
  position_type: "Offensive"
  risk_level: "Low"
  energy_cost: "Medium"
---
```

#### 2. Incomplete Success Rates
❌ **Wrong:**
```markdown
- [[Hip Bump Sweep]] → [[Mount]] (Success Rate: 70%)
```

✅ **Right:**
```markdown
- [[Hip Bump Sweep]] → [[Mount]] (Success Rate: Beginner 50%, Intermediate 70%, Advanced 85%)
```

#### 3. Vague Visual Descriptions
❌ **Wrong:**
```markdown
You are on top in mount position.
```

✅ **Right:**
```markdown
You are positioned on top of your opponent with your knees spread wide on either side of their torso, your weight centered on their chest and hips. Your feet are hooked under their thighs or positioned flat on the mat for maximum base, preventing them from bridging or escaping. Your upper body is positioned with hands controlling their arms or preparing grips for submissions, maintaining a low center of gravity to resist their defensive movements. Your hips are heavy and active, shifting to counter their escape attempts while maintaining constant pressure that limits their breathing and mobility.
```

#### 4. Missing Expert Insights
❌ **Wrong:**
```markdown
## Expert Insights
This is a good position.
```

✅ **Right:**
```markdown
## Expert Insights
- **John Danaher**: "Mount control is fundamentally about weight distribution and base. The key is not static weight but dynamic weight - constantly adjusting your position to counter the opponent's escape attempts. Control the head and hips, and the rest of the body follows."
- **Gordon Ryan**: "In competition, I focus on making mount as uncomfortable as possible. Heavy hips, chest pressure, and constant submission threats force opponents to make mistakes. The goal is to cook them until they give up position or expose a submission."
- **Eddie Bravo**: "Mount is great but I often transition to other positions like the truck or back control. Mount can be limiting if the opponent has good defense, so I use it as a stepping stone to more controlling positions where they have fewer options."
```

#### 5. Incomplete Decision Trees
❌ **Wrong:**
```markdown
## Decision Tree
If opponent escapes:
- Re-establish position
```

✅ **Right:**
```markdown
## Decision Tree

If opponent frames and creates space:
- Execute [[Armbar]] → [[Armbar Control]] (Probability: 65%)
- Or transition to [[Technical Mount]] → [[Technical Mount]] (Probability: 70%)

Else if opponent bridges and turns:
- Follow to [[Back Control]] → [[Back Control]] (Probability: 75%)
- Or transition to [[Side Control Top]] → [[Side Control Top]] (Probability: 60%)

Else if opponent remains defensive and flat:
- Setup [[Ezekiel Choke]] → [[Won by Submission]] (Probability: 45%)
- Or apply [[Americana]] → [[Won by Submission]] (Probability: 50%)

Else (opponent exhausted):
- Maintain pressure and setup [[Cross Collar Choke]] → [[Won by Submission]] (Probability: 70%)
```

#### 6. Generic Common Errors
❌ **Wrong:**
```markdown
- **Error**: Bad positioning
  - **Consequence**: Doesn't work
  - **Correction**: Do it right
```

✅ **Right:**
```markdown
- **Error**: Crossing your ankles under opponent's body
  - **Consequence**: Creates vulnerability to ankle lock sweeps where opponent can trap your crossed ankles and roll you off, losing the dominant position entirely
  - **Correction**: Keep your knees spread wide with feet hooked under opponent's thighs or positioned on the mat, creating a stable base that resists bridging and rolling movements
  - **Recognition**: Feeling unstable when opponent bridges; easy to roll off when they turn
```

#### 7. Broken Wikilinks
❌ **Wrong:**
```markdown
- [[Mount Position]] → This should match the exact filename
```

✅ **Right:**
```markdown
- [[Mount]] → Must match "Mount.md" exactly (without .md extension)
```

**Tip:** Use the site's search or file explorer to verify exact position/transition names before creating wikilinks.

---

## For the Bot

### How the GitHub Action Works

**Current Implementation:**
The project uses GitHub Actions for automated deployment but does NOT yet have a content standardization bot. This section outlines the planned bot architecture.

**Planned Bot Workflow:**

```yaml
name: Content Standardization Bot

on:
  schedule:
    - cron: '0 */6 * * *'  # Run every 6 hours
  workflow_dispatch:  # Manual trigger

jobs:
  standardize-content:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install pyyaml markdown beautifulsoup4 anthropic

      - name: Run standardization bot
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          python scripts/standardization_bot.py \
            --batch-size 5 \
            --content-dir bjjgraph/source/content

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          commit-message: "🤖 Standardize content batch"
          branch: bot/content-standardization
          title: "Content Standardization: Batch Update"
          body: |
            Automated content standardization by bot.

            **Changes:**
            - Added YAML frontmatter with state_machine data
            - Added Schema.org markup (HowTo, FAQ)
            - Completed all required sections per standard
            - Fixed broken wikilinks
            - Added expert insights
            - Standardized success rate formats

            **Review Checklist:**
            - [ ] YAML frontmatter is valid and complete
            - [ ] Schema markup matches content
            - [ ] Expert insights are contextually appropriate
            - [ ] Success rates are realistic
            - [ ] Wikilinks point to existing files
            - [ ] Decision trees have clear logic

            **Files Modified:** See commit details
```

**Bot Logic (`scripts/standardization_bot.py`):**

```python
import anthropic
import yaml
import os
from pathlib import Path

class ContentStandardizationBot:
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    def standardize_file(self, file_path: Path, content_type: str):
        """Standardize a single position or transition file"""

        # Read current content
        current_content = file_path.read_text()

        # Read the appropriate contributor guide
        if content_type == "position":
            standard_path = file_path.parent / "CONTRIBUTING-POSITIONS.md"
        elif content_type == "transition":
            standard_path = file_path.parent / "CONTRIBUTING-TRANSITIONS.md"
        else:
            standard_path = file_path.parent / f"CONTRIBUTING-{content_type.upper()}.md"

        standard = standard_path.read_text()

        # Get example file
        example = self.get_example_file(content_type)

        # Call Claude to standardize
        prompt = f"""You are a BJJ content standardization expert.

CONTRIBUTOR GUIDE TO FOLLOW:
{standard}

EXAMPLE FILE (for reference):
{example}

CURRENT FILE TO STANDARDIZE:
{current_content}

Your task:
1. Add complete YAML frontmatter with state_machine data
2. Add Schema.org markup (HowTo for transitions, FAQ for positions)
3. Ensure all required sections are present and complete
4. Add expert insights if missing
5. Standardize success rate formats
6. Fix broken wikilinks
7. Complete decision trees with probabilities
8. Preserve existing good content, enhance incomplete sections

Return ONLY the complete standardized markdown file content."""

        message = self.client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=16000,
            messages=[{"role": "user", "content": prompt}]
        )

        standardized_content = message.content[0].text

        # Validate before writing
        if self.validate_content(standardized_content, content_type):
            file_path.write_text(standardized_content)
            return True
        else:
            print(f"Validation failed for {file_path}")
            return False

    def validate_content(self, content: str, content_type: str) -> bool:
        """Basic validation of standardized content"""

        checks = {
            "has_yaml_frontmatter": content.startswith("---"),
            "has_state_machine_data": "state_machine:" in content,
            "has_schema_markup": '<script type="application/ld+json">' in content,
            "has_expert_insights": "John Danaher" in content and "Gordon Ryan" in content,
            "has_decision_tree": "## Decision Tree" in content or "### Decision Logic" in content
        }

        if content_type == "position":
            checks["has_offensive_transitions"] = "## Offensive Transitions" in content
            checks["has_defensive_responses"] = "## Defensive Responses" in content

        elif content_type == "transition":
            checks["has_execution_steps"] = "## Execution Steps" in content or "### Execution Steps" in content
            checks["has_common_counters"] = "## Common Counters" in content or "### Common Counters" in content

        return all(checks.values())

    def get_example_file(self, content_type: str) -> str:
        """Load a high-quality example file"""
        if content_type == "position":
            example_path = Path("bjjgraph/source/content/Positions/Closed Guard Bottom.md")
        else:
            example_path = Path("bjjgraph/source/content/Transitions/Hip Bump Sweep.md")

        return example_path.read_text()

def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=5)
    parser.add_argument("--content-dir", type=str, required=True)
    args = parser.parse_args()

    bot = ContentStandardizationBot(api_key=os.environ["ANTHROPIC_API_KEY"])

    # Find files that need standardization
    content_dir = Path(args.content_dir)

    positions_to_fix = []
    for f in (content_dir / "Positions").glob("*.md"):
        if f.name == "000.STANDARD.md":
            continue
        content = f.read_text()
        if "state_machine:" not in content:
            positions_to_fix.append(f)

    transitions_to_fix = []
    for f in (content_dir / "Transitions").glob("*.md"):
        if f.name == "000.STANDARD.md":
            continue
        content = f.read_text()
        if "state_machine:" not in content:
            transitions_to_fix.append(f)

    # Process batch
    files_to_process = (positions_to_fix + transitions_to_fix)[:args.batch_size]

    for file_path in files_to_process:
        content_type = "position" if "Positions" in str(file_path) else "transition"
        print(f"Standardizing {file_path.name}...")
        bot.standardize_file(file_path, content_type)

if __name__ == "__main__":
    main()
```

### How to Trigger Manually

**Via GitHub Web Interface:**
1. Navigate to repository on GitHub
2. Click "Actions" tab
3. Select "Content Standardization Bot" workflow
4. Click "Run workflow" dropdown
5. Select branch (usually `main`)
6. Click green "Run workflow" button

**Via GitHub CLI:**
```bash
gh workflow run "Content Standardization Bot" --ref main
```

**Via Local Script:**
```bash
cd /Users/diogo/Documents/bjjgraph-org/bjjgraph
export ANTHROPIC_API_KEY="your-key-here"
python scripts/standardization_bot.py \
  --batch-size 5 \
  --content-dir source/content
```

### How to Review Bot PRs

**Step 1: Check the PR Overview**
- Look at number of files changed (should be ≤10 per PR)
- Review the bot's summary of changes
- Verify no unexpected files were modified

**Step 2: Review YAML Frontmatter**
Open a changed file and check:
```yaml
---
title: "Position Name | BJJ Position Guide | BJJ Graph"  # ✅ SEO-optimized
description: "Master Position in BJJ. Complete guide..."  # ✅ Under 160 chars
state_machine:  # ✅ Must be present
  state_id: "S###"  # ✅ Unique ID
  point_value: 0-4  # ✅ Numeric
  position_type: "Offensive"  # ✅ Valid enum
  risk_level: "Low"  # ✅ Valid enum
  energy_cost: "Medium"  # ✅ Valid enum
  retention_rate:  # ✅ All three levels
    beginner: 60
    intermediate: 70
    advanced: 80
---
```

**Step 3: Review Schema Markup**
- Verify JSON-LD is valid (copy/paste into https://validator.schema.org/)
- Check that HowTo steps match content
- Verify FAQ questions match Common Errors section

**Step 4: Spot-Check Content Quality**

**Expert Insights:**
- Should be 2-3 sentences each
- Should reference specific techniques or principles
- Should sound contextually appropriate (not generic)

❌ Generic: "This is a good position for BJJ."
✅ Specific: "The key to mount control is dynamic weight distribution - constantly shifting to counter escape attempts while maintaining heavy hips and chest pressure."

**Success Rates:**
- Should be realistic (check against other similar techniques)
- Beginner < Intermediate < Advanced (usually)
- Total probabilities in decision tree should be reasonable

❌ Unrealistic: "Beginner 95%, Intermediate 98%, Advanced 99%"
✅ Realistic: "Beginner 40%, Intermediate 60%, Advanced 75%"

**Step 5: Check Wikilinks**
Run a quick validation:
```bash
cd /Users/diogo/Documents/bjjgraph-org/bjjgraph
python scripts/validate_content.py --check-links
```

Or manually verify a few links:
- `[[Mount]]` → Should exist as `Positions/Mount.md` or `Transitions/Mount.md`
- Hover over link in your editor (if supported) to see if it resolves

**Step 6: Test Build Locally**
```bash
cd /Users/diogo/Documents/bjjgraph-org/bjjgraph/source
npm install
npx quartz build --serve
```

Open http://localhost:8080 and navigate to changed files to verify:
- Pages render correctly
- Wikilinks work
- Schema markup doesn't break page layout

### What to Check Before Merging

**Automated Checks (should pass):**
- ✅ GitHub Actions build succeeds
- ✅ No TypeScript errors
- ✅ Quartz builds without warnings

**Manual Checks:**
1. **File Count**: Changed files ≤10 (prevents massive breaking changes)
2. **YAML Validity**: All frontmatter parses correctly
3. **Schema Validity**: JSON-LD validates on schema.org
4. **Content Quality**: Expert insights are contextually appropriate
5. **Success Rates**: Probabilities are realistic
6. **Wikilinks**: No broken links introduced
7. **Decision Trees**: Logic is clear and probabilities sum reasonably
8. **No Regressions**: Existing good content wasn't removed

**Approval Workflow:**
- If all checks pass → Approve and merge
- If minor issues → Request changes with specific feedback
- If major issues → Close PR and file bug report for bot

**Post-Merge:**
- Monitor deployment to ensure site builds successfully
- Spot-check a few changed pages on live site
- Add any issues to bot improvement backlog

---

## For Developers

### YAML Schema Reference

**Position Schema:**
```yaml
state_machine:
  # Identifiers
  state_id: string              # Format: "S###" (e.g., "S001", "S042")

  # Core Properties
  point_value: integer          # 0-4 (IBJJF scoring system)
  position_type: enum           # "Offensive" | "Defensive" | "Neutral" | "Controlling"
  risk_level: enum              # "Low" | "Medium" | "High"
  energy_cost: enum             # "Low" | "Medium" | "High"
  time_sustainability: enum     # "Short" | "Medium" | "Long"

  # Success Metrics
  retention_rate:
    beginner: integer           # 0-100 (percentage)
    intermediate: integer       # 0-100
    advanced: integer           # 0-100

  advancement_probability:
    beginner: integer           # 0-100
    intermediate: integer       # 0-100
    advanced: integer           # 0-100

  submission_probability:
    beginner: integer           # 0-100
    intermediate: integer       # 0-100
    advanced: integer           # 0-100

  position_loss_probability:
    beginner: integer           # 0-100
    intermediate: integer       # 0-100
    advanced: integer           # 0-100
```

**Transition Schema:**
```yaml
state_machine:
  # Identifiers
  transition_id: string         # Format: "T###" (e.g., "T045", "T601")

  # State Machine Properties
  starting_state: string        # Must match a Position filename (without .md)
  ending_state: string          # Must match a Position filename (without .md)
  transition_type: enum         # "Escape" | "Attack" | "Advancement" | "Counter" | "Setup"

  # Success Properties
  success_probability:
    beginner: integer           # 0-100
    intermediate: integer       # 0-100
    advanced: integer           # 0-100

  # Execution Properties
  execution_complexity: enum    # "Low" | "Medium" | "High"
  energy_cost: enum             # "Low" | "Medium" | "High"
  time_required: enum           # "Instant" | "Quick" | "Medium" | "Slow"
  risk_level: enum              # "Low" | "Medium" | "High"

  # Physical Requirements
  physical_requirements:
    strength: enum              # "Low" | "Medium" | "High"
    flexibility: enum           # "Low" | "Medium" | "High"
    coordination: enum          # "Low" | "Medium" | "High"
    speed: enum                 # "Low" | "Medium" | "High"

  # Success Modifiers (optional)
  success_modifiers:
    setup_quality: integer      # -20 to +20 (percentage points)
    timing_precision: integer   # -20 to +20
    opponent_fatigue: integer   # -10 to +10
    knowledge_test: integer     # -15 to +15
    position_control: integer   # -10 to +10
```

**Validation Rules:**
- All percentage fields must be 0-100
- `beginner` ≤ `intermediate` ≤ `advanced` (usually)
- State IDs must be unique across all positions
- Transition IDs must be unique across all transitions
- `starting_state` and `ending_state` must reference existing position files

### How to Parse state_machine Data

**Python Example:**
```python
import yaml
import re
from pathlib import Path
from typing import Dict, List

class StateParser:
    def __init__(self, content_dir: Path):
        self.content_dir = content_dir
        self.positions = {}
        self.transitions = {}

    def parse_frontmatter(self, file_path: Path) -> Dict:
        """Extract YAML frontmatter from markdown file"""
        content = file_path.read_text()

        # Match YAML frontmatter
        match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
        if not match:
            return None

        frontmatter = yaml.safe_load(match.group(1))
        return frontmatter.get('state_machine', {})

    def load_all_positions(self) -> Dict[str, Dict]:
        """Load all position files into state machine dict"""
        positions_dir = self.content_dir / "Positions"

        for file_path in positions_dir.glob("*.md"):
            if file_path.name == "000.STANDARD.md":
                continue

            state_data = self.parse_frontmatter(file_path)
            if state_data and 'state_id' in state_data:
                state_id = state_data['state_id']
                self.positions[state_id] = {
                    'name': file_path.stem,
                    'file_path': str(file_path),
                    **state_data
                }

        return self.positions

    def load_all_transitions(self) -> Dict[str, Dict]:
        """Load all transition files into state machine dict"""
        transitions_dir = self.content_dir / "Transitions"

        for file_path in transitions_dir.glob("*.md"):
            if file_path.name == "000.STANDARD.md":
                continue

            transition_data = self.parse_frontmatter(file_path)
            if transition_data and 'transition_id' in transition_data:
                transition_id = transition_data['transition_id']
                self.transitions[transition_id] = {
                    'name': file_path.stem,
                    'file_path': str(file_path),
                    **transition_data
                }

        return self.transitions

    def build_graph(self) -> Dict:
        """Build state machine graph with nodes and edges"""
        self.load_all_positions()
        self.load_all_transitions()

        graph = {
            'nodes': {},
            'edges': []
        }

        # Add position nodes
        for state_id, data in self.positions.items():
            graph['nodes'][state_id] = {
                'name': data['name'],
                'point_value': data.get('point_value', 0),
                'type': data.get('position_type', 'Neutral'),
                'retention_rate': data.get('retention_rate', {}),
            }

        # Add transition edges
        for transition_id, data in self.transitions.items():
            start = self.find_state_id_by_name(data.get('starting_state', ''))
            end = self.find_state_id_by_name(data.get('ending_state', ''))

            if start and end:
                graph['edges'].append({
                    'id': transition_id,
                    'name': data['name'],
                    'from': start,
                    'to': end,
                    'success_probability': data.get('success_probability', {}),
                    'energy_cost': data.get('energy_cost', 'Medium'),
                })

        return graph

    def find_state_id_by_name(self, position_name: str) -> str:
        """Find state ID by position name"""
        for state_id, data in self.positions.items():
            if data['name'] == position_name:
                return state_id
        return None

# Usage
parser = StateParser(Path("/Users/diogo/Documents/bjjgraph-org/bjjgraph/source/content"))
graph = parser.build_graph()

print(f"Loaded {len(graph['nodes'])} positions")
print(f"Loaded {len(graph['edges'])} transitions")

# Export for game engine
import json
with open("bjj_state_machine.json", "w") as f:
    json.dump(graph, f, indent=2)
```

**TypeScript Example:**
```typescript
// types.ts
interface StateMachine {
  state_id?: string;
  transition_id?: string;
  point_value?: number;
  position_type?: 'Offensive' | 'Defensive' | 'Neutral' | 'Controlling';
  success_probability?: {
    beginner: number;
    intermediate: number;
    advanced: number;
  };
  starting_state?: string;
  ending_state?: string;
}

// parser.ts
import matter from 'gray-matter';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export class StateMachineParser {
  private positions: Map<string, StateMachine> = new Map();
  private transitions: Map<string, StateMachine> = new Map();

  constructor(private contentDir: string) {}

  parseFile(filePath: string): StateMachine | null {
    const content = readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    return data.state_machine || null;
  }

  loadAllPositions(): Map<string, StateMachine> {
    const positionsDir = join(this.contentDir, 'Positions');
    const files = readdirSync(positionsDir).filter(f =>
      f.endsWith('.md') && f !== '000.STANDARD.md'
    );

    for (const file of files) {
      const filePath = join(positionsDir, file);
      const stateMachine = this.parseFile(filePath);

      if (stateMachine?.state_id) {
        this.positions.set(stateMachine.state_id, {
          ...stateMachine,
          name: file.replace('.md', '')
        });
      }
    }

    return this.positions;
  }

  loadAllTransitions(): Map<string, StateMachine> {
    const transitionsDir = join(this.contentDir, 'Transitions');
    const files = readdirSync(transitionsDir).filter(f =>
      f.endsWith('.md') && f !== '000.STANDARD.md'
    );

    for (const file of files) {
      const filePath = join(transitionsDir, file);
      const stateMachine = this.parseFile(filePath);

      if (stateMachine?.transition_id) {
        this.transitions.set(stateMachine.transition_id, {
          ...stateMachine,
          name: file.replace('.md', '')
        });
      }
    }

    return this.transitions;
  }

  buildGraph() {
    this.loadAllPositions();
    this.loadAllTransitions();

    return {
      nodes: Array.from(this.positions.values()),
      edges: Array.from(this.transitions.values())
    };
  }
}

// Usage
const parser = new StateMachineParser('/path/to/content');
const graph = parser.buildGraph();
console.log(`Loaded ${graph.nodes.length} positions`);
console.log(`Loaded ${graph.edges.length} transitions`);
```

### How to Extract for Game Engine

**Extract for Turn-Based Game:**
```python
class GameEngine:
    def __init__(self, graph_data: Dict):
        self.positions = {n['name']: n for n in graph_data['nodes']}
        self.transitions = graph_data['edges']

    def get_available_moves(self, current_position: str, skill_level: str) -> List[Dict]:
        """Get all transitions from current position"""
        moves = []

        for transition in self.transitions:
            if transition['from'] == self.get_state_id(current_position):
                success_prob = transition['success_probability'].get(skill_level.lower(), 50)
                moves.append({
                    'name': transition['name'],
                    'to_position': self.get_position_name(transition['to']),
                    'success_probability': success_prob,
                    'energy_cost': transition['energy_cost'],
                    'transition_id': transition['id']
                })

        return moves

    def execute_transition(self, transition_id: str, skill_level: str) -> Dict:
        """Execute a transition and return result"""
        import random

        transition = next(t for t in self.transitions if t['id'] == transition_id)
        success_prob = transition['success_probability'].get(skill_level.lower(), 50)

        success = random.randint(1, 100) <= success_prob

        if success:
            return {
                'success': True,
                'new_position': self.get_position_name(transition['to']),
                'points_scored': self.get_point_value(transition['to'])
            }
        else:
            return {
                'success': False,
                'new_position': self.get_position_name(transition['from']),
                'points_scored': 0
            }

    def get_state_id(self, position_name: str) -> str:
        """Get state ID from position name"""
        for state_id, data in self.positions.items():
            if data['name'] == position_name:
                return state_id
        return None

    def get_position_name(self, state_id: str) -> str:
        """Get position name from state ID"""
        return self.positions.get(state_id, {}).get('name', 'Unknown')

    def get_point_value(self, state_id: str) -> int:
        """Get point value for position"""
        return self.positions.get(state_id, {}).get('point_value', 0)

# Usage
with open("bjj_state_machine.json") as f:
    graph = json.load(f)

engine = GameEngine(graph)

# Game loop
current_position = "Closed Guard Bottom"
player_skill = "intermediate"
total_points = 0

while True:
    print(f"\nCurrent Position: {current_position}")
    print(f"Points: {total_points}")

    moves = engine.get_available_moves(current_position, player_skill)

    print("\nAvailable Moves:")
    for i, move in enumerate(moves, 1):
        print(f"{i}. {move['name']} → {move['to_position']}")
        print(f"   Success: {move['success_probability']}% | Energy: {move['energy_cost']}")

    choice = int(input("\nChoose move (number): ")) - 1
    selected_move = moves[choice]

    result = engine.execute_transition(selected_move['transition_id'], player_skill)

    if result['success']:
        print(f"✅ Success! Transitioned to {result['new_position']}")
        print(f"Points scored: {result['points_scored']}")
        current_position = result['new_position']
        total_points += result['points_scored']
    else:
        print(f"❌ Failed! Remained in {result['new_position']}")
```

### How to Use Validation Script

**Create `validate_content.py`:**
```python
#!/usr/bin/env python3
"""
Content validation script for BJJ Graph
Checks YAML frontmatter, required sections, and wikilinks
"""

import yaml
import re
from pathlib import Path
from typing import List, Dict, Set
import argparse

class ContentValidator:
    def __init__(self, content_dir: Path):
        self.content_dir = content_dir
        self.errors = []
        self.warnings = []
        self.all_position_names = set()
        self.all_transition_names = set()

    def load_file_names(self):
        """Load all position and transition file names"""
        positions_dir = self.content_dir / "Positions"
        transitions_dir = self.content_dir / "Transitions"

        for f in positions_dir.glob("*.md"):
            if f.name != "000.STANDARD.md":
                self.all_position_names.add(f.stem)

        for f in transitions_dir.glob("*.md"):
            if f.name != "000.STANDARD.md":
                self.all_transition_names.add(f.stem)

    def validate_frontmatter(self, file_path: Path, content: str, content_type: str) -> bool:
        """Validate YAML frontmatter"""
        match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)

        if not match:
            self.errors.append(f"{file_path.name}: Missing YAML frontmatter")
            return False

        try:
            frontmatter = yaml.safe_load(match.group(1))
        except yaml.YAMLError as e:
            self.errors.append(f"{file_path.name}: Invalid YAML - {e}")
            return False

        if 'state_machine' not in frontmatter:
            self.warnings.append(f"{file_path.name}: Missing state_machine data in frontmatter")
            return False

        state_machine = frontmatter['state_machine']

        # Type-specific validation
        if content_type == "position":
            required = ['state_id', 'point_value', 'position_type']
            for field in required:
                if field not in state_machine:
                    self.errors.append(f"{file_path.name}: Missing required field: {field}")

        elif content_type == "transition":
            required = ['transition_id', 'starting_state', 'ending_state', 'success_probability']
            for field in required:
                if field not in state_machine:
                    self.errors.append(f"{file_path.name}: Missing required field: {field}")

        return True

    def validate_required_sections(self, file_path: Path, content: str, content_type: str):
        """Check for required content sections"""

        if content_type == "position":
            required_sections = [
                "## State Properties",
                "## Visual Description",
                "## Key Principles",
                "## Defensive Responses",
                "## Offensive Transitions",
                "## Decision Tree",
                "## Expert Insights",
                "## Common Errors"
            ]
        else:  # transition
            required_sections = [
                "## State Machine Content Elements",
                "### Execution Steps",
                "### Common Counters",
                "## Expert Insights",
                "## Common Errors",
                "### Knowledge Assessment Questions"
            ]

        for section in required_sections:
            if section not in content:
                self.warnings.append(f"{file_path.name}: Missing section: {section}")

    def validate_wikilinks(self, file_path: Path, content: str):
        """Check that all wikilinks point to existing files"""
        wikilink_pattern = r'\[\[([^\]]+?)\]\]'
        links = re.findall(wikilink_pattern, content)

        for link in links:
            # Remove any arrow notation and parentheses
            clean_link = link.split('→')[0].strip().split('(')[0].strip()

            # Check if exists in positions or transitions
            if clean_link not in self.all_position_names and clean_link not in self.all_transition_names:
                # Check for common variations
                variations = [
                    clean_link,
                    clean_link.replace(' ', '-'),
                    clean_link.replace('-', ' ')
                ]

                found = any(v in self.all_position_names or v in self.all_transition_names for v in variations)

                if not found:
                    self.warnings.append(f"{file_path.name}: Broken wikilink: [[{clean_link}]]")

    def validate_success_rates(self, file_path: Path, content: str):
        """Check that success rates follow proper format"""
        # Pattern: (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)
        pattern = r'Success Rate:.*?Beginner\s+(\d+)%.*?Intermediate\s+(\d+)%.*?Advanced\s+(\d+)%'
        matches = re.findall(pattern, content, re.IGNORECASE)

        for match in matches:
            beginner, intermediate, advanced = map(int, match)

            if not (0 <= beginner <= 100 and 0 <= intermediate <= 100 and 0 <= advanced <= 100):
                self.errors.append(f"{file_path.name}: Success rates out of range (0-100)")

            # Usually beginner ≤ intermediate ≤ advanced (with some exceptions)
            if beginner > intermediate or intermediate > advanced:
                self.warnings.append(f"{file_path.name}: Unusual success rate progression: {beginner}% → {intermediate}% → {advanced}%")

    def validate_file(self, file_path: Path, content_type: str):
        """Run all validations on a single file"""
        content = file_path.read_text()

        self.validate_frontmatter(file_path, content, content_type)
        self.validate_required_sections(file_path, content, content_type)
        self.validate_wikilinks(file_path, content)
        self.validate_success_rates(file_path, content)

    def validate_all(self):
        """Validate all content files"""
        self.load_file_names()

        # Validate positions
        positions_dir = self.content_dir / "Positions"
        for file_path in positions_dir.glob("*.md"):
            if file_path.name != "000.STANDARD.md":
                self.validate_file(file_path, "position")

        # Validate transitions
        transitions_dir = self.content_dir / "Transitions"
        for file_path in transitions_dir.glob("*.md"):
            if file_path.name != "000.STANDARD.md":
                self.validate_file(file_path, "transition")

        # Print results
        print("\n" + "="*60)
        print("VALIDATION RESULTS")
        print("="*60)

        if self.errors:
            print(f"\n❌ ERRORS ({len(self.errors)}):")
            for error in self.errors[:20]:  # Limit output
                print(f"  - {error}")
            if len(self.errors) > 20:
                print(f"  ... and {len(self.errors) - 20} more")

        if self.warnings:
            print(f"\n⚠️  WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings[:20]:
                print(f"  - {warning}")
            if len(self.warnings) > 20:
                print(f"  ... and {len(self.warnings) - 20} more")

        if not self.errors and not self.warnings:
            print("\n✅ All validations passed!")

        print("\n" + "="*60)
        print(f"Total files checked: {len(self.all_position_names) + len(self.all_transition_names)}")
        print(f"Errors: {len(self.errors)}")
        print(f"Warnings: {len(self.warnings)}")
        print("="*60 + "\n")

        return len(self.errors) == 0

def main():
    parser = argparse.ArgumentParser(description="Validate BJJ Graph content")
    parser.add_argument(
        "--content-dir",
        type=Path,
        default=Path(__file__).parent.parent / "source" / "content",
        help="Path to content directory"
    )
    parser.add_argument(
        "--check-links",
        action="store_true",
        help="Only check wikilinks"
    )
    args = parser.parse_args()

    validator = ContentValidator(args.content_dir)

    if args.check_links:
        validator.load_file_names()
        positions_dir = args.content_dir / "Positions"
        for file_path in positions_dir.glob("*.md"):
            if file_path.name != "000.STANDARD.md":
                content = file_path.read_text()
                validator.validate_wikilinks(file_path, content)
    else:
        validator.validate_all()

    if validator.errors:
        exit(1)

if __name__ == "__main__":
    main()
```

**Usage:**
```bash
# Validate all content
python scripts/validate_content.py

# Only check wikilinks
python scripts/validate_content.py --check-links

# Specify custom content directory
python scripts/validate_content.py --content-dir /path/to/content

# Use in CI/CD
python scripts/validate_content.py || exit 1
```

**Add to GitHub Actions:**
```yaml
- name: Validate content
  run: |
    python scripts/validate_content.py
```

---

## Migration Plan

### Current State

**Statistics (as of Oct 2025):**
- **Total Content Files**: 264
  - Positions: 93 files
  - Transitions: 69 files
  - Submissions: ~50 files
  - Concepts: ~30 files
  - Systems: ~22 files

- **Standardization Status**:
  - Files with V2 YAML frontmatter: ~15 (6%)
  - Files with placeholder content: 0 (improved from 446!)
  - Broken wikilinks: ~1,767 (needs attention)

- **Content Quality**:
  - Files with complete expert insights: ~15
  - Files with decision trees: ~20
  - Files with Schema.org markup: ~15
  - Files with standardized success rates: ~20

### Phase 1: Manual Pilot (Weeks 1-2)

**Goal**: Validate V2 standard with 10 high-priority files

**Files to Standardize Manually:**
1. Closed Guard Bottom (S002) ✅ DONE
2. Mount (S001)
3. Back Control (S003)
4. Side Control Top (S004)
5. Half Guard Bottom (S005)
6. Hip Bump Sweep (T045) ✅ DONE
7. Armbar (T###)
8. Triangle Choke (T###)
9. Bridge and Roll (T###)
10. Guard Pass (T###)

**Tasks:**
- [ ] Manually standardize 10 files
- [ ] Document time per file (target: 30-45 min)
- [ ] Identify common issues
- [ ] Refine standard based on learnings
- [ ] Create content creator guide (this document)
- [ ] Create templates for quick reference

**Success Criteria:**
- All 10 files pass validation script
- Zero broken links in pilot files
- Expert insights are contextually appropriate
- Schema markup validates on schema.org
- Decision trees are complete and logical

### Phase 2: Bot Automation (Weeks 3-10)

**Goal**: Automate standardization of remaining 240+ files

**Week 3-4: Bot Development**
- [ ] Create `standardization_bot.py` script
- [ ] Test on 5 files manually
- [ ] Refine prompts based on output quality
- [ ] Add validation checks
- [ ] Create GitHub Action workflow
- [ ] Test end-to-end bot → PR → review flow

**Week 5-10: Batch Processing**
- [ ] Process positions: 83 files remaining (10-15 per week)
- [ ] Process transitions: 64 files remaining (10-15 per week)
- [ ] Review and merge PRs (2-3 per week)
- [ ] Fix broken links as discovered
- [ ] Update success rates for consistency

**Bot Configuration:**
- Batch size: 5-10 files per PR (manageable review size)
- Frequency: Every 6 hours (4x per day)
- Model: Claude Sonnet 4.5 (best quality for technical content)
- Max tokens: 16,000 per file (sufficient for comprehensive content)

**Weekly Targets:**
- Week 5: 15 files standardized, 3 PRs merged
- Week 6: 15 files standardized, 3 PRs merged
- Week 7: 15 files standardized, 3 PRs merged
- Week 8: 15 files standardized, 3 PRs merged
- Week 9: 15 files standardized, 3 PRs merged
- Week 10: Final 15 files + cleanup

**Cost Estimate:**
- Per file: ~50K tokens (input) + ~15K tokens (output) = 65K tokens
- 240 files × 65K tokens = 15.6M tokens
- Claude Sonnet 4.5: $3/M input + $15/M output
- Total cost: ~$290 for full migration

### Phase 3: New File Creation (Ongoing)

**Goal**: All new files follow V2 standard from creation

**Process:**
1. Content creator reads this guide
2. Copies template from pilot files
3. Fills in all required sections
4. Runs validation script locally
5. Submits PR with checklist
6. Human reviewer checks quality
7. Merges after approval

**Templates to Create:**
- [ ] Position template (`Positions/_TEMPLATE.md`)
- [ ] Transition template (`Transitions/_TEMPLATE.md`)
- [ ] Quick reference card (PDF) for contributors

**Content Creator Onboarding:**
- Read this guide (30 min)
- Review 3 standardized examples (20 min)
- Complete 1 file with mentor review (60 min)
- Solo file creation (30-45 min per file)

### Timeline and Metrics

**Overall Timeline**: 10 weeks (Oct 2025 - Dec 2025)

| Week | Focus | Files Target | Cumulative | Status |
|------|-------|--------------|------------|--------|
| 1-2 | Manual Pilot | 10 | 10 | 🚧 In Progress |
| 3-4 | Bot Development | 5 (testing) | 15 | ⏳ Pending |
| 5 | Positions Batch 1 | 15 | 30 | ⏳ Pending |
| 6 | Positions Batch 2 | 15 | 45 | ⏳ Pending |
| 7 | Positions Batch 3 | 15 | 60 | ⏳ Pending |
| 8 | Transitions Batch 1 | 15 | 75 | ⏳ Pending |
| 9 | Transitions Batch 2 | 15 | 90 | ⏳ Pending |
| 10 | Final + Cleanup | 15 | 105 | ⏳ Pending |

**Success Metrics:**

| Metric | Current | Week 5 Target | Week 10 Target | Final Target |
|--------|---------|---------------|----------------|--------------|
| Standardized Files | 15 | 30 | 105 | 162 |
| Broken Links | ~1,767 | <1,500 | <500 | <50 |
| Placeholder Content | 0 | 0 | 0 | 0 |
| Validation Pass Rate | ~6% | ~20% | ~65% | 100% |
| SEO Schema Coverage | ~6% | ~20% | ~65% | 100% |

**Quality Gates:**
- No PR merged with validation errors
- Manual review required for all bot PRs
- Link validation must pass before merge
- Schema markup must validate on schema.org

---

## Quality Assurance

### How to Use validate_content.py

See [For Developers → How to Use Validation Script](#how-to-use-validation-script) for full implementation.

**Quick Usage:**
```bash
# Full validation
cd /Users/diogo/Documents/bjjgraph-org/bjjgraph
python scripts/validate_content.py

# Output:
# ============================================================
# VALIDATION RESULTS
# ============================================================
#
# ❌ ERRORS (15):
#   - Mount.md: Missing required field: state_id
#   - Guard Pass.md: Invalid YAML - mapping values not allowed
#   ...
#
# ⚠️  WARNINGS (234):
#   - Half Guard.md: Broken wikilink: [[Deep Half Guard]]
#   - Triangle.md: Missing section: ## Expert Insights
#   ...
# ============================================================
# Total files checked: 162
# Errors: 15
# Warnings: 234
# ============================================================
```

### Review Checklist for Human Reviewers

**Use this checklist when reviewing bot PRs or manual contributions:**

#### YAML Frontmatter
- [ ] Frontmatter starts with `---` and ends with `---`
- [ ] Contains `state_machine:` key
- [ ] All required fields present (see schema reference)
- [ ] State ID / Transition ID is unique
- [ ] Success rates are 0-100 and realistic
- [ ] Enum fields use valid values (Low/Medium/High, etc.)

#### Schema Markup
- [ ] Contains `<script type="application/ld+json">`
- [ ] HowTo schema for transitions (with steps)
- [ ] FAQ schema for positions (from common errors)
- [ ] JSON validates on https://validator.schema.org/
- [ ] Steps match content (not generic)

#### Content Quality
- [ ] Visual description is detailed (4+ sentences)
- [ ] Expert insights from all 3 authorities
- [ ] Expert insights are contextually specific (not generic)
- [ ] Common errors include consequence + correction
- [ ] Decision tree has 3+ branches with probabilities
- [ ] Success rates follow Beginner ≤ Intermediate ≤ Advanced
- [ ] No placeholder text ("PLACEHOLDER", "TBD", etc.)

#### Wikilinks
- [ ] All wikilinks use exact filename (without .md)
- [ ] Links include success rates where appropriate
- [ ] No broken links (run validation script)
- [ ] Format: `[[Technique]] → [[Position]] (Success Rate: ...)`

#### Technical Accuracy
- [ ] Point values match IBJJF rules (positions)
- [ ] Success probabilities are realistic
- [ ] Physical requirements make sense
- [ ] Prerequisites are appropriate
- [ ] Transitions reference valid start/end states

#### SEO Optimization
- [ ] Title follows format: "Name | Type | BJJ Graph"
- [ ] Meta description under 160 characters
- [ ] Description includes success rates
- [ ] Internal links to 3-5 related positions

### What Makes a "Good" File

**Excellent Example: `Closed Guard Bottom.md`**

**Why it's good:**
1. ✅ **Complete YAML frontmatter** with all success metrics
2. ✅ **Rich visual description**: 4 detailed sentences with spatial references
3. ✅ **Specific expert insights**: Danaher on inside position theory, Gordon on transitional use, Eddie on rubber guard
4. ✅ **Comprehensive decision tree**: 4 branches covering different opponent responses
5. ✅ **5 detailed common errors**: Each with consequence, correction, and recognition
6. ✅ **Multiple transition options**: 9 offensive transitions with skill-level success rates
7. ✅ **Schema markup**: Both HowTo and FAQ with real content
8. ✅ **Training progressions**: 5 specific drills
9. ✅ **All wikilinks work**: No broken references

**Poor Example (hypothetical):**
```markdown
# Mount

## Description
Mount is when you're on top.

## Transitions
- [[Armbar]] (70%)
- [[Cross Collar Choke]] (65%)

## Expert Insights
- **Danaher**: This is a good position.
- **Gordon Ryan**: I use this in competition.
```

**Why it's bad:**
1. ❌ No YAML frontmatter
2. ❌ No schema markup
3. ❌ Vague description (1 sentence)
4. ❌ Generic expert insights
5. ❌ No skill level breakdown for success rates
6. ❌ Missing decision tree
7. ❌ No common errors section
8. ❌ No prerequisites or training drills

**Improvement Checklist:**
- Add complete YAML with state_machine data
- Expand description to 4+ detailed sentences
- Add specific expert insights (2-3 sentences each)
- Break down success rates by skill level
- Add decision tree with 3+ branches
- Add 5 common errors with corrections
- Add prerequisites and training drills
- Add schema markup

---

## FAQs

### General Questions

**Q: Why do we need standardization?**
A: Standardization serves three critical purposes:
1. **For humans**: Consistent structure improves navigation and learning
2. **For SEO**: Schema markup and internal linking improve search rankings
3. **For AI/game engine**: Structured data enables probabilistic state machine and turn-based gameplay

**Q: How long does it take to standardize a file manually?**
A: With the template and this guide:
- First file: 60-90 minutes (learning process)
- Subsequent files: 30-45 minutes
- With practice: 20-30 minutes

**Q: Can I use the bot to standardize my file?**
A: No, the bot only processes files in batches automatically. For new files or one-off updates, use the manual process with templates.

**Q: What if I don't know the success rates?**
A: Use these guidelines:
- **Beginner**: 30-50% for complex techniques, 50-70% for fundamentals
- **Intermediate**: 50-70% for complex, 70-85% for fundamentals
- **Advanced**: 70-85% for complex, 85-95% for fundamentals
- Reference similar techniques for consistency

### Content Creation Questions

**Q: How do I choose a State ID or Transition ID?**
A:
- **Positions**: Use S### format, check existing files for next available number
- **Transitions**: Use T### format, check existing files for next available number
- Run `ls bjjgraph/source/content/Positions/ | grep -o 'S[0-9]*' | sort` to see used IDs

**Q: What if a position doesn't fit the standard categories?**
A: Contact the maintainers to discuss adding new enum values. Examples:
- Position type beyond Offensive/Defensive/Neutral? (e.g., "Transitional")
- Energy cost beyond Low/Medium/High? (e.g., "Variable")

**Q: How detailed should expert insights be?**
A: 2-3 sentences per expert, focusing on:
- **Danaher**: Mechanical principles, systematic approach, biomechanics
- **Gordon Ryan**: Competition application, high-percentage tactics, pressure
- **Eddie Bravo**: Innovation, rubber guard connections, unconventional approaches

Example:
> **Danaher**: "The hip bump sweep succeeds through proper coordination of upper and lower body movements. The key is understanding that the sit-up motion must be combined with the hip bump - neither action alone will create sufficient off-balancing force. The timing must be precise to catch the opponent when their weight distribution is vulnerable."

**Q: What if I can't find expert commentary on a specific technique?**
A: Write commentary "as if" from that expert, following their known philosophy:
- Danaher → Systematic, principle-based, detailed mechanics
- Gordon Ryan → Competition-tested, pressure-focused, practical
- Eddie Bravo → Innovative, rubber guard connections, questioning tradition

**Q: How do I handle variations (gi vs no-gi)?**
A: Include a "Variants and Adaptations" section with subsections:
- Gi Specific
- No-Gi Specific
- Self-Defense
- Competition
- Size Differential

### Technical Questions

**Q: My YAML isn't parsing. What's wrong?**
A: Common issues:
- Inconsistent indentation (use 2 spaces, not tabs)
- Missing colon after key
- Quoted strings with unescaped quotes
- Invalid enum values (case-sensitive)

Test your YAML: https://www.yamllint.com/

**Q: How do I test schema markup?**
A:
1. Copy your JSON-LD schema
2. Go to https://validator.schema.org/
3. Paste and validate
4. Fix any errors highlighted

**Q: Why aren't my wikilinks working?**
A: Check:
- Exact filename match (case-sensitive)
- No `.md` extension in wikilink
- File exists in Positions/ or Transitions/
- Run validation script to find broken links

**Q: How do I handle a technique with multiple ending states?**
A: In YAML, use the primary ending state. In content, describe variations:
```yaml
ending_state: "Mount"  # Primary outcome
```
```markdown
### Ending States
- **Primary**: [[Mount]] (70% of successful attempts)
- **Alternative**: [[Side Control Top]] (30% if opponent turns)
```

### Process Questions

**Q: When will the bot run on my file?**
A: The bot processes files in batches every 6 hours, prioritizing:
1. Files with most placeholder content
2. High-traffic positions (Mount, Guard, Back Control)
3. Fundamental techniques for beginners
4. Files with broken links

**Q: Can I request the bot prioritize my file?**
A: No automated prioritization requests. Instead:
- Standardize it manually (faster)
- Mention in Slack/Discord for manual bot run
- Wait for automated batch processing

**Q: How do I know if my file passed validation?**
A: Run locally before submitting:
```bash
python scripts/validate_content.py
```

Or check GitHub Actions after PR:
- Green checkmark = passed
- Red X = failed (click for details)

**Q: What if the bot made a mistake?**
A: Two options:
1. **Minor fix**: Edit directly and push to bot's PR branch
2. **Major issue**: Close PR, file bug report, bot will retry later

**Q: Who approves and merges bot PRs?**
A: Project maintainers or designated reviewers. If you want to help review, contact the project lead.

### Troubleshooting

**Q: Build fails after my changes. What do I do?**
A:
1. Check error message in GitHub Actions
2. Most common issues:
   - Invalid YAML syntax
   - Broken wikilink causing build error
   - Missing required file
3. Fix locally and push update
4. If stuck, revert PR and ask for help

**Q: My success rates are flagged as "unusual" by validator. Is that wrong?**
A: Not necessarily wrong, just uncommon. Examples of valid unusual progressions:
- Beginner 60%, Intermediate 55%, Advanced 70% (intermediate slump)
- Beginner 90%, Intermediate 92%, Advanced 95% (fundamental technique)

If you're confident in your rates, ignore the warning. If unsure, compare with similar techniques.

**Q: The validation script says I have 1,767 broken links. How do I fix them all?**
A: Don't try to fix all at once:
1. Bot will fix many automatically during standardization
2. Focus on your file's broken links only
3. Common issues:
   - Technique renamed: Update wikilink
   - File doesn't exist: Remove link or create placeholder
   - Typo: Fix spelling

**Q: I'm getting YAML indentation errors. How do I fix?**
A:
1. Use 2 spaces (not tabs) for indentation
2. Use an editor with YAML support (VSCode, Sublime, etc.)
3. Copy-paste from a working file and modify
4. Test on https://www.yamllint.com/

**Q: Can I contribute even if I'm not a BJJ expert?**
A: Yes! You can help with:
- YAML formatting
- Schema markup
- Running validation scripts
- Fixing broken links
- Reviewing bot PRs for formatting (not technical accuracy)

Technical content should be reviewed by BJJ practitioners.

---

## Additional Resources

**Project Files:**
- Position Contributor Guide: `/bjjgraph/source/content/Positions/CONTRIBUTING-POSITIONS.md`
- Transition Contributor Guide: `/bjjgraph/source/content/Transitions/CONTRIBUTING-TRANSITIONS.md`
- Submission Contributor Guide: `/bjjgraph/source/content/Submissions/CONTRIBUTING-SUBMISSIONS.md`
- Systems Contributor Guide: `/bjjgraph/source/content/Systems/CONTRIBUTING-SYSTEMS.md`
- Concepts Contributor Guide: `/bjjgraph/source/content/Concepts/CONTRIBUTING-CONCEPTS.md`
- Project Overview: `/CLAUDE.md`
- SEO Strategy: `/bjjgraph/todo/seo.md`
- Game Engine Plan: `/bjjgraph/todo/structure.md`

**Note**: CONTRIBUTING-*.md files are excluded from the website (see quartz.config.ts). They are for content creators and the automated improvement bot only.

**Example Files:**
- Position: `/bjjgraph/source/content/Positions/Closed Guard Bottom.md`
- Transition: `/bjjgraph/source/content/Transitions/Hip Bump Sweep.md`

**External Resources:**
- Schema.org HowTo: https://schema.org/HowTo
- Schema.org FAQ: https://schema.org/FAQPage
- Schema Validator: https://validator.schema.org/
- YAML Validator: https://www.yamllint.com/
- Quartz Documentation: https://quartz.jzhao.xyz/

**Contact:**
- GitHub Issues: https://github.com/your-repo/bjjgraph-org/issues
- Project Discord: [Link if available]
- Email: [Contact if available]

---

**Document Version**: 1.0
**Last Updated**: October 12, 2025
**Maintainer**: BJJ Graph Team
**Status**: 🚧 Active Development
