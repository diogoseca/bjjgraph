# BJJ Graph Automation Bots Guide

## Table of Contents
1. [Overview](#overview)
2. [Content Improvement Bot](#content-improvement-bot)
3. [Monthly Validation Bot](#monthly-validation-bot)
4. [Configuration & Setup](#configuration--setup)
5. [Monitoring & Metrics](#monitoring--metrics)
6. [Troubleshooting](#troubleshooting)

---

## Overview

BJJ Graph uses automated GitHub Actions bots to maintain and improve content quality at scale. These bots leverage Claude AI to systematically enhance content files while maintaining technical accuracy and adherence to project standards.

### Available Bots

**1. Content Improvement Bot** (`.github/workflows/content-improvement-bot.yml`)
- **Purpose**: Daily automated content improvements
- **Frequency**: Once daily at 8:00 AM UTC
- **Batch Size**: 10 files per run (configurable)
- **Focus**: Systematic enhancement of oldest/neglected content

**2. Monthly Validation Bot** (`.github/workflows/monthly-validation-bot.yml`)
- **Purpose**: Deep validation and quality assurance
- **Frequency**: 1st of every month at 3:00 AM UTC
- **Batch Size**: 20 files per run (configurable)
- **Focus**: Error correction and standards compliance

### Why Automation?

**Scale**: 264+ content files requiring standardization
**Consistency**: Uniform application of V2 standards across all content
**Efficiency**: ~36+ hours of manual work automated
**Quality**: Expert-level improvements using Claude Sonnet 4.5

---

## Content Improvement Bot

### How It Works

The Content Improvement Bot runs daily to systematically enhance content files with surgical precision.

**Workflow:**
```
1. Select 10 files from 100 oldest (by modification date)
   ↓
2. Pass files to Claude Code Action with specialized prompt
   ↓
3. Claude reads appropriate CONTRIBUTING-*.md standards
   ↓
4. Claude applies prioritized improvements
   ↓
5. Bot commits changes to branch: bot/content-improvement
   ↓
6. Human reviewer validates and merges PR
```

### File Selection Logic

**Script**: `scripts/select_oldest_files.sh`

**Selection Process:**
1. Find all `.md` files in `source/content/`
2. Exclude: `CONTRIBUTING-*.md`, `index.md`, `000.STANDARD.md`
3. Sort by modification time (oldest first)
4. Take top 100 oldest files
5. Randomly select N files (default: 10) from those 100

**Why this approach?**
- **Prioritizes neglected content**: Oldest files need attention most
- **Prevents stagnation**: Random selection within oldest 100 avoids predictability
- **Manageable scope**: 10 files = reviewable PR size
- **Fair distribution**: All old files eventually get improved

**Manual selection override:**
```bash
# Manually trigger with custom number of files
gh workflow run "Content Improvement Bot" \
  -f num_files=5
```

### Improvement Priorities

The bot uses a three-tier priority system:

**🔴 HIGH PRIORITY (Fix First):**
- **Missing Visual Description** (Positions)
  - Trigger: Absent or <400 characters
  - Impact: Critical for learner comprehension
  - Example fix: Expand "You are in mount" to detailed 4-sentence description

- **Missing/Incomplete Safety Sections** (Submissions)
  - Trigger: No ⚠️ safety notice, incomplete injury awareness
  - Impact: Safety-critical content
  - Example fix: Add comprehensive safety warnings, tap protocols, injury risks

- **Missing Execution Steps** (All types)
  - Trigger: Fewer than 6 execution steps
  - Impact: Core technical content incomplete
  - Example fix: Expand from 3 vague steps to 6+ detailed steps

**🟡 MEDIUM PRIORITY (Enhance Second):**
- **Common Errors Format**
  - Trigger: Fewer than 5 errors, missing ⚠️ DANGER labels
  - Impact: Learning quality and safety awareness
  - Example fix: Upgrade from 3 generic errors to 5-10 detailed with consequences/corrections

- **Expert Insights**
  - Trigger: Missing Danaher/Gordon Ryan/Eddie Bravo perspectives
  - Impact: Depth and authority of content
  - Example fix: Add 2-3 sentence insights per expert with specific technical detail

- **FAQ Section**
  - Trigger: Missing or <5 Q&A pairs
  - Impact: Knowledge assessment and SEO (FAQ schema)
  - Example fix: Generate 5+ technical questions from content

**🟢 STANDARD IMPROVEMENTS (Apply Always):**
- YAML frontmatter completeness
- Success rate consistency (Beginner ≤ Intermediate ≤ Advanced)
- Wikilink accuracy and format
- Decision tree logic and probabilities
- Training progression completeness

### Bot Prompt Structure

The bot uses a specialized prompt designed for black-belt level technical writing:

**Key Components:**
1. **Identity**: "You are a black-belt BJJ technical documentation bot"
2. **Mission**: "Systematically enhance with surgical precision"
3. **Standards**: References all 6 CONTRIBUTING-*.md guides
4. **Priority Detection**: Automatic identification of HIGH/MEDIUM/STANDARD improvements
5. **Process**: Diagnose → Consult Standards → Execute → Validate

**Prompt Philosophy:**
- **Expert judgment**: Bot decides priorities based on file analysis
- **Comprehensive standards**: All CONTRIBUTING guides referenced
- **Safety emphasis**: Submissions require special attention
- **Quality focus**: "Crafting the definitive BJJ technical resource"

### Reviewing Bot PRs

**Step 1: Check PR Overview**
- Branch: `bot/content-improvement`
- Files changed: Should be ≤10
- Review bot's commit message for summary
- Verify no unexpected files modified

**Step 2: Review Individual Files**

For each changed file, check:

**YAML Frontmatter:**
```yaml
---
title: "Position Name | BJJ Position Guide | BJJ Graph"  # ✅ Format correct
description: "Master Position in BJJ..."  # ✅ <160 chars
state_machine:  # ✅ Present
  state_id: "S###"  # ✅ Unique format
  point_value: 0-4  # ✅ Valid range
  success_probability:  # ✅ All skill levels present
    beginner: 50
    intermediate: 65
    advanced: 80
---
```

**Content Quality:**
- [ ] Visual descriptions are detailed (200+ characters, 4+ sentences)
- [ ] Expert insights are specific, not generic
- [ ] Common errors include consequences + corrections
- [ ] Success rates follow proper ordering
- [ ] Decision trees have clear logic
- [ ] Wikilinks point to existing files
- [ ] Safety sections complete (submissions only)

**Red Flags (Request Changes):**
- Generic expert insights: "This is a good position"
- Unrealistic success rates: Beginner 95%, Intermediate 98%
- Broken wikilinks: `[[Non-Existent Position]]`
- Missing required sections per CONTRIBUTING guide
- YAML syntax errors
- Safety sections missing (submissions)

**Step 3: Validate Locally (Optional)**
```bash
# Clone bot branch
git fetch origin
git checkout bot/content-improvement

# Run validation
python3 scripts/validate_content.py source/content/ --verbose

# Build site locally
cd source
npx quartz build --serve
# Open http://localhost:8080 and check changed pages
```

**Step 4: Approve or Request Changes**

**If everything looks good:**
```
Approval message:
"LGTM! Improvements validated:
- YAML frontmatter complete
- Expert insights contextually appropriate
- Success rates realistic
- Wikilinks valid
- Schema markup correct"
```

**If changes needed:**
```
Request changes:
"Needs fixes before merge:
1. File X: Generic expert insight for Danaher - needs specific technique reference
2. File Y: Success rates don't follow Beginner ≤ Intermediate pattern
3. File Z: Broken wikilink [[Non-Existent]]

Please fix these issues."
```

**Step 5: Post-Merge Monitoring**
- Monitor GitHub Actions for successful deployment
- Spot-check 2-3 changed pages on live site
- Verify schema markup with Google Rich Results Test
- Add any issues to bot improvement backlog

### What the Bot Handles

**Automatic Improvements:**
- ✅ Adding missing YAML frontmatter fields
- ✅ Expanding visual descriptions to 400+ characters
- ✅ Adding missing expert insights (all 3 experts)
- ✅ Completing execution steps (6+ steps)
- ✅ Expanding common errors (5-10 errors)
- ✅ Adding safety sections to submissions
- ✅ Fixing success rate formats and ordering
- ✅ Adding decision trees with probabilities
- ✅ Completing FAQ sections (5+ questions)
- ✅ Improving SEO metadata (title, description)

**Manual Review Required:**
- ⚠️ Verifying expert insights are contextually accurate
- ⚠️ Validating success rates are realistic
- ⚠️ Checking wikilinks resolve correctly
- ⚠️ Ensuring technical accuracy of content
- ⚠️ Confirming safety information is comprehensive

### Estimated Impact

**Files Processed:**
- Daily: 10 files
- Monthly: ~300 files (30 days × 10)
- Yearly: ~3,650 files (includes repeat improvements)

**Time Savings:**
- Per file: 30-45 minutes manual work
- Per day: 5-7.5 hours saved
- Per month: 150-225 hours saved

**Quality Improvements:**
- Visual descriptions: +63 files need improvement
- Safety sections: +18 submissions need completion
- Execution steps: +14 submissions need expansion
- Common errors: +18 files need format upgrade

**Cost (Claude Sonnet 4.5):**
- Per file: ~50K tokens input + ~15K tokens output = 65K tokens
- Per day: 10 files × 65K = 650K tokens
- Monthly cost: ~$30-50 (varies by token usage)

---

## Monthly Validation Bot

### How It Works

The Monthly Validation Bot performs deep quality assurance checks and automated fixes.

**Workflow:**
```
1. Select 20 random files from 100 oldest
   ↓
2. Run validation script (scripts/validate_content.py)
   ↓
3. Capture validation errors and warnings
   ↓
4. Pass validation report to Claude Code Action
   ↓
5. Claude fixes all reported issues
   ↓
6. Bot commits fixes to branch: bot/monthly-validation
   ↓
7. Human reviewer validates fixes and merges
```

### Validation Checks

**Python Script**: `scripts/validate_content.py`

**Automated Validations:**

**1. YAML Frontmatter:**
- ✅ Presence of frontmatter (starts/ends with `---`)
- ✅ Valid YAML syntax (parseable)
- ✅ `state_machine:` key present
- ✅ Required fields per content type
- ✅ State ID / Transition ID format (S###, T###, SUB###)
- ✅ Unique IDs (no duplicates)

**2. Required Sections:**
- ✅ Position files: 8+ required sections
- ✅ Transition files: 6+ required sections
- ✅ Submission files: Safety section MANDATORY
- ✅ All files: Expert Insights section

**3. Wikilinks:**
- ✅ Format: `[[Page Name]]` (double brackets)
- ✅ Target file exists in Positions/ or Transitions/
- ✅ Exact name match (case-sensitive)
- ✅ No `.md` extension in link

**4. Success Rates:**
- ✅ Format: `(Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)`
- ✅ Values in range 0-100
- ✅ Ordering: Beginner ≤ Intermediate ≤ Advanced (usually)
- ✅ All three skill levels present

**5. Expert Insights:**
- ✅ Danaher perspective present
- ✅ Gordon Ryan perspective present
- ✅ Eddie Bravo perspective present (when applicable)
- ✅ Minimum 2 sentences per expert

**6. SEO Metadata:**
- ✅ Title field present
- ✅ Description field present
- ✅ Description <160 characters
- ✅ Title follows template format

### Validation Report Format

**Sample Output:**
```
============================================================
VALIDATION RESULTS
============================================================

❌ ERRORS (15):
  - Mount.md: Missing required field: state_id
  - Guard Pass.md: Invalid YAML - mapping values not allowed
  - Triangle.md: State ID format invalid: should be S### or T###
  - Armbar.md: Missing required section: ## Expert Insights
  - Kimura.md: Success rates out of range (0-100)
  ...

⚠️  WARNINGS (234):
  - Half Guard.md: Broken wikilink: [[Deep Half Guard]]
  - Triangle.md: Missing section: ## Common Errors
  - Mount.md: Unusual success rate progression: 70% → 60% → 80%
  - Closed Guard.md: Visual description too short (150 chars, need 200+)
  - Armbar.md: Expert insight too short for Danaher (1 sentence, need 2+)
  ...

============================================================
Total files checked: 264
Errors: 15
Warnings: 234
============================================================
```

### Bot Fixing Process

**Prompt Structure:**
1. **Files to fix**: List of 20 selected files
2. **Validation report**: Complete error/warning list
3. **Standards**: All CONTRIBUTING-*.md guides referenced
4. **Process**: Analyze → Group issues → Fix per file → Commit

**Common Fixes:**
- Missing state IDs: Generate unique ID in correct format
- Invalid YAML: Fix indentation and syntax
- Missing sections: Add complete section with proper content
- Broken wikilinks: Verify and fix or remove
- Success rate errors: Correct ordering and values
- Missing expert insights: Add all three perspectives

**Git Workflow:**
```bash
# Bot executes these commands automatically:
git config user.name "BJJ Graph Validation Bot"
git config user.email "validation-bot@bjjgraph.com"

git fetch origin
if git show-ref --verify --quiet refs/remotes/origin/bot/monthly-validation; then
  git checkout bot/monthly-validation
  git pull origin bot/monthly-validation
else
  git checkout -b bot/monthly-validation
fi

git add .
git commit -m "Fix validation errors from monthly QA check

Fixed validation issues in 20 files:
- Corrected missing/invalid IDs
- Added required sections
- Fixed success rate ordering
- Added missing expert insights
- Improved SEO metadata
- Fixed broken wikilinks
- Enhanced safety sections (submissions)

Files fixed: [list]

Generated by Monthly Validation Bot"

git push origin bot/monthly-validation
```

### Reviewing Validation PRs

**Step 1: Check Validation Report**

Review the bot's commit message for:
- Number of errors fixed
- Number of warnings addressed
- List of affected files
- Types of fixes applied

**Step 2: Verify Fixes**

For each file with reported errors:

**Before/After Comparison:**
```markdown
# Before (ERROR: Missing state_id)
---
title: "Mount Position"
---

# After (FIXED)
---
title: "Mount | BJJ Position Guide | BJJ Graph"
state_machine:
  state_id: "S001"
  point_value: 4
  position_type: "Offensive"
---
```

**Step 3: Run Validation Again**
```bash
# Ensure all errors are fixed
git checkout bot/monthly-validation
python3 scripts/validate_content.py source/content/

# Should show:
# ✅ All validations passed!
```

**Step 4: Approve and Merge**

**Quality Gates:**
- [ ] All validation errors fixed
- [ ] No new errors introduced
- [ ] Wikilinks resolve correctly
- [ ] YAML syntax valid
- [ ] Required sections added
- [ ] Expert insights present and appropriate
- [ ] Success rates follow proper format

**Merge Strategy:**
```bash
# Squash merge for clean history
gh pr merge --squash --delete-branch
```

### Monthly Reporting

**Metrics to Track:**
- Files validated: 20
- Errors found: X
- Errors fixed: Y
- Warnings found: Z
- Warnings addressed: W
- Validation pass rate: (Y/X) × 100%

**Quality Trends:**
```
Month 1: 15 errors, 234 warnings → 12 errors fixed, 180 warnings addressed
Month 2: 10 errors, 198 warnings → 8 errors fixed, 150 warnings addressed
Month 3: 6 errors, 145 warnings → 6 errors fixed, 120 warnings addressed
→ Trend: Improving quality over time
```

---

## Configuration & Setup

### GitHub Secrets

**Required Secret:**
- `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`)
  - Location: Repository Settings → Secrets → Actions
  - Value: Anthropic API key with Claude access
  - Scope: Read/write access to repository

**Setting Up:**
1. Navigate to GitHub repository
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `CLAUDE_CODE_OAUTH_TOKEN`
5. Value: Your Anthropic API key (starts with `sk-ant-api03-...`)
6. Click "Add secret"

**Security:**
- ✅ Never commit API keys to repository
- ✅ Use GitHub Secrets for secure storage
- ✅ Rotate keys quarterly
- ✅ Monitor usage for anomalies
- ✅ Restrict bot permissions to minimum required

### Workflow Triggers

**Content Improvement Bot:**
```yaml
on:
  schedule:
    - cron: '0 8 * * *'  # Daily at 8:00 AM UTC
  workflow_dispatch:  # Manual trigger
    inputs:
      num_files:
        description: 'Number of files to improve (default: 10)'
        default: '10'
```

**Monthly Validation Bot:**
```yaml
on:
  schedule:
    - cron: '0 3 1 * *'  # 1st of month at 3:00 AM UTC
  workflow_dispatch:  # Manual trigger
    inputs:
      num_files:
        description: 'Number of files to validate (default: 20)'
        default: '20'
```

**Manual Trigger (Web):**
1. Go to GitHub Actions tab
2. Select workflow (Content Improvement Bot or Monthly Validation Bot)
3. Click "Run workflow"
4. Choose branch (usually `main`)
5. Enter custom `num_files` if desired
6. Click "Run workflow" button

**Manual Trigger (CLI):**
```bash
# Content Improvement Bot (5 files)
gh workflow run "Content Improvement Bot" -f num_files=5

# Monthly Validation Bot (10 files)
gh workflow run "Monthly Validation Bot" -f num_files=10
```

### Customizing Batch Size

**Recommended Batch Sizes:**

| Scenario | Content Improvement | Validation Bot | Reason |
|----------|---------------------|----------------|--------|
| **Default** | 10 files | 20 files | Balanced throughput + review effort |
| **Quick Test** | 3 files | 5 files | Fast feedback, minimal cost |
| **Deep Dive** | 15 files | 30 files | Aggressive improvement, needs dedicated review time |
| **Emergency** | 1 file | 1 file | Target specific critical file |

**Trade-offs:**

**Larger Batches (15-30 files):**
- ✅ Faster overall progress
- ✅ Better cost efficiency (fewer API calls)
- ❌ Harder to review PRs thoroughly
- ❌ Higher risk of missed errors
- ❌ Longer workflow run time

**Smaller Batches (3-5 files):**
- ✅ Easier to review thoroughly
- ✅ Lower risk of mistakes
- ✅ Faster workflow completion
- ❌ Slower overall progress
- ❌ More PRs to manage
- ❌ Less cost efficient

**Optimal: 10 files for daily, 20 for monthly**

### Workflow Permissions

**Required Permissions:**
```yaml
permissions:
  contents: write      # Push commits to repository
  pull-requests: write # Create and update PRs
```

**Branch Protection:**
- Main branch: Require PR reviews
- Bot branches: Allow bot to push directly
- Merge strategy: Squash merge for clean history

### Concurrency Control

**Both workflows use concurrency locks:**
```yaml
concurrency:
  group: content-improvement-bot  # Or monthly-validation-bot
  cancel-in-progress: false  # Don't cancel running workflows
```

**Why?**
- Prevents multiple bots editing same files simultaneously
- Ensures changes are applied sequentially
- Avoids merge conflicts
- Maintains data integrity

---

## Monitoring & Metrics

### Success Tracking

**GitHub Actions Dashboard:**
- Navigate to Actions tab
- View workflow runs (success/failure)
- Click individual runs for details
- Check execution time and logs

**Key Metrics to Monitor:**

**1. Run Success Rate:**
```
Target: >95% successful runs
Formula: (Successful runs / Total runs) × 100%

Example:
Daily bot: 28 successful, 2 failed → 93.3% (investigate failures)
Monthly bot: 12 successful, 0 failed → 100% (excellent)
```

**2. Files Improved Per Month:**
```
Target: 300 files/month
Formula: Daily bot runs × Files per run × Days

Example:
Daily bot: 10 files/day × 30 days = 300 files/month
Monthly bot: 20 files × 1 run = 20 additional validations
Total: 320 files touched per month
```

**3. PR Merge Time:**
```
Target: <48 hours from PR creation to merge
Measure: PR created timestamp → Merged timestamp

Example:
PR #123: Created Oct 12 8:00 AM, Merged Oct 13 10:00 AM → 26 hours ✅
PR #124: Created Oct 15 8:00 AM, Merged Oct 18 2:00 PM → 78 hours ❌ (too slow)
```

**4. Validation Pass Rate:**
```
Target: Increasing over time (0 errors eventually)
Formula: (Files with 0 errors / Total files) × 100%

Example:
Month 1: 85% pass rate (38 files with errors)
Month 2: 90% pass rate (26 files with errors)
Month 3: 94% pass rate (16 files with errors)
→ Trend: ✅ Improving
```

### Cost Tracking

**Claude API Usage:**

**Content Improvement Bot:**
- Per file: ~65K tokens (50K input + 15K output)
- Per day: 10 files × 65K = 650K tokens
- Per month: 30 days × 650K = 19.5M tokens

**Monthly Validation Bot:**
- Per file: ~70K tokens (55K input + 15K output, includes validation report)
- Per month: 20 files × 70K = 1.4M tokens

**Total Monthly:**
- Content Improvement: 19.5M tokens
- Validation: 1.4M tokens
- **Total: 20.9M tokens**

**Claude Sonnet 4.5 Pricing:**
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens

**Estimated Monthly Cost:**
```
Input cost:
  Content: 10 files/day × 50K × 30 days × ($3/1M) = $45
  Validation: 20 files × 55K × ($3/1M) = $3.30
  Total input: ~$48

Output cost:
  Content: 10 files/day × 15K × 30 days × ($15/1M) = $67.50
  Validation: 20 files × 15K × ($15/1M) = $4.50
  Total output: ~$72

Total monthly: ~$120
Annual: ~$1,440
```

**Cost Optimization:**
- Reduce batch size if over budget
- Skip weekends (20 runs/month instead of 30)
- Use Claude Haiku for simpler fixes (cheaper)
- Cache common standards in prompt (reduce input tokens)

### Quality Improvement Over Time

**Tracking Dashboard (Manual or Automated):**

```
Content Quality Score (0-100):
┌─────────────────────────────────────────────┐
│                                             │
│  100 ┤                                      │
│   90 ┤     ╱─────────╱                      │
│   80 ┤   ╱         ╱                        │
│   70 ┤ ╱         ╱                          │
│   60 ┼╱        ╱                            │
│   50 ┤       ╱                              │
│      └───────────────────────────────────   │
│       Oct  Nov  Dec  Jan  Feb  Mar         │
│                                             │
│  Metrics:                                   │
│  • Files with complete YAML: 94% (↑)       │
│  • Files with expert insights: 88% (↑)     │
│  • Broken links: 52 (↓ from 1,767)         │
│  • Placeholder content: 0 (✅)              │
└─────────────────────────────────────────────┘
```

**Measurement Criteria:**
1. **Completeness** (30 points)
   - YAML frontmatter complete: 10 pts
   - All required sections present: 10 pts
   - Expert insights (all 3): 10 pts

2. **Accuracy** (30 points)
   - No broken wikilinks: 10 pts
   - Valid success rates: 10 pts
   - Correct state IDs: 10 pts

3. **Depth** (20 points)
   - Visual description 200+ chars: 7 pts
   - 5+ common errors: 7 pts
   - Decision tree complete: 6 pts

4. **SEO/Technical** (20 points)
   - Schema markup present: 10 pts
   - SEO metadata complete: 10 pts

**Run monthly to track improvement trends.**

### Alerting

**Set up notifications for:**

**1. Workflow Failures:**
```yaml
# GitHub Actions sends email on failure
# Configure in: Settings → Notifications → Actions
```

**2. Merge Conflicts:**
```
Alert: Bot PR has merge conflicts
Action: Manually resolve or close and retry
```

**3. High API Costs:**
```
Alert: Monthly API usage >$150
Action: Review logs, reduce batch size, or investigate anomalies
```

**4. Validation Regression:**
```
Alert: Validation pass rate dropped >5%
Action: Investigate recent changes, review bot PRs
```

---

## Troubleshooting

### Bot Failures

**Symptom**: Workflow run shows red X (failed)

**Common Causes:**

**1. API Key Invalid or Expired**
```
Error: "Authentication failed: Invalid API key"

Fix:
1. Check GitHub Secrets for CLAUDE_CODE_OAUTH_TOKEN
2. Verify key is valid (test with curl)
3. Regenerate key if expired
4. Update secret in GitHub
5. Re-run workflow
```

**2. Rate Limit Exceeded**
```
Error: "Rate limit exceeded: 429 Too Many Requests"

Fix:
1. Check Anthropic API rate limits (dashboard)
2. Reduce batch size (10 → 5 files)
3. Increase delay between runs (daily → every 2 days)
4. Upgrade API tier if consistent issue
```

**3. Git Push Failed**
```
Error: "Permission denied (publickey)" or "Push rejected"

Fix:
1. Check workflow has contents: write permission
2. Verify bot branch isn't protected
3. Check if branch was deleted (recreate)
4. Review GitHub token permissions
```

**4. Invalid YAML Generated**
```
Error: "Build failed: YAML syntax error in [file]"

Fix:
1. Identify file with error (check build logs)
2. Manually fix YAML syntax
3. Push fix to bot branch
4. Re-run build
5. File issue for bot improvement
```

**5. Timeout (>6 hours)**
```
Error: "Workflow run timed out"

Fix:
1. Reduce batch size (30 → 10 files)
2. Check Claude API response time
3. Verify network connectivity
4. Re-run workflow
```

### API Rate Limits

**Anthropic API Limits:**
- **Free tier**: 5 requests/minute, 200K tokens/day
- **Tier 1**: 50 requests/minute, 1M tokens/day
- **Tier 2**: 100 requests/minute, 10M tokens/day

**Bot Usage:**
- Daily run: ~650K tokens (fits Tier 1)
- Monthly run: ~1.4M tokens (requires Tier 2 for safety)

**If hitting limits:**
```bash
# Option 1: Reduce frequency
# Change from daily to every 2 days
cron: '0 8 */2 * *'

# Option 2: Reduce batch size
num_files: 5  # Instead of 10

# Option 3: Split runs
# Morning: 5 files at 8:00 AM
# Evening: 5 files at 8:00 PM
```

**Rate Limit Handling:**
```python
# Add to bot script (if custom implementation)
import time
from anthropic import RateLimitError

try:
    response = client.messages.create(...)
except RateLimitError:
    print("Rate limit hit, waiting 60 seconds...")
    time.sleep(60)
    response = client.messages.create(...)  # Retry
```

### Merge Conflicts

**Symptom**: Bot PR shows merge conflicts with main branch

**Cause**: Files modified in main since bot branch was created

**Resolution:**

**Option 1: Rebase (Recommended)**
```bash
git checkout bot/content-improvement
git fetch origin
git rebase origin/main

# If conflicts:
# 1. Fix conflicts manually
# 2. git add [resolved files]
# 3. git rebase --continue

git push --force-with-lease origin bot/content-improvement
```

**Option 2: Merge Main into Bot Branch**
```bash
git checkout bot/content-improvement
git fetch origin
git merge origin/main

# If conflicts:
# 1. Fix conflicts manually
# 2. git add [resolved files]
# 3. git commit

git push origin bot/content-improvement
```

**Option 3: Close and Retry**
```bash
# Close current PR
gh pr close [PR number]

# Delete bot branch
git push origin --delete bot/content-improvement

# Re-run workflow (will create fresh branch)
gh workflow run "Content Improvement Bot"
```

**Prevention:**
- Merge bot PRs quickly (<48 hours)
- Run bot less frequently if many manual edits
- Coordinate bot runs with human editing schedules

### Invalid Bot Outputs

**Symptom**: Bot generates incorrect or low-quality content

**Examples:**

**1. Generic Expert Insights**
```markdown
# ❌ Bad output
- **John Danaher**: "This is a good technique."
- **Gordon Ryan**: "I use this in competition."

# ✅ Expected output
- **John Danaher**: "The hip bump sweep succeeds through proper coordination of upper and lower body movements. The key is understanding that the sit-up motion must be combined with the hip bump - neither action alone will create sufficient off-balancing force."
- **Gordon Ryan**: "In competition, I use this as a high-percentage option when opponent has strong posture. The timing window is narrow but success rate is high if you catch them leaning forward."
```

**Resolution:**
1. Request changes on PR with specific feedback
2. Manually fix the file
3. Push fix to bot branch
4. File improvement issue for bot prompt refinement

**2. Unrealistic Success Rates**
```markdown
# ❌ Bad output
(Success Rate: Beginner 98%, Intermediate 99%, Advanced 100%)

# ✅ Expected output
(Success Rate: Beginner 50%, Intermediate 70%, Advanced 85%)
```

**Resolution:**
1. Reject PR
2. Document pattern of errors
3. Adjust bot prompt to emphasize realistic rates
4. Re-run workflow

**3. Broken Wikilinks Generated**
```markdown
# ❌ Bad output
- [[Deep Half Guard Position]] → File doesn't exist (actual: Deep Half Guard.md)

# ✅ Expected output
- [[Deep Half Guard]] → Matches exact filename
```

**Resolution:**
1. Run validation script to catch all broken links
2. Fix broken links manually
3. Add validation step to bot workflow
4. Consider pre-loading list of valid filenames into bot prompt

**Improving Bot Quality:**
- Collect examples of bad outputs
- Refine bot prompt with corrections
- Add more examples to prompt
- Increase max_tokens for more thoughtful responses
- Use Claude Opus for complex files (higher quality)

### Workflow Permission Issues

**Symptom**: "Resource not accessible by integration" or "Permission denied"

**Causes:**

**1. Missing Workflow Permissions**
```yaml
# ❌ Missing
jobs:
  improve-content:
    runs-on: ubuntu-latest

# ✅ Fixed
jobs:
  improve-content:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
```

**2. Branch Protection Conflicts**
```
Error: Push to main blocked by branch protection

Fix:
- Bot should push to bot/* branches only
- Don't push directly to main
- Create PR instead
```

**3. GitHub Token Scope**
```
Error: Token doesn't have required permissions

Fix:
1. Go to Settings → Actions → General
2. Workflow permissions → "Read and write permissions"
3. Save changes
4. Re-run workflow
```

### Debugging Tips

**1. Enable Verbose Logging**
```yaml
# Add to workflow
- name: Debug Step
  run: |
    set -x  # Enable debug output
    echo "Current directory: $(pwd)"
    echo "Selected files: ${{ steps.select_files.outputs.selected_files }}"
    git status
    git log -1
```

**2. Test Locally First**
```bash
# Simulate bot behavior
cd bjjgraph

# Test file selection
./scripts/select_oldest_files.sh 5

# Test validation
python3 scripts/validate_content.py source/content/

# Test Claude API (manual)
export ANTHROPIC_API_KEY="your-key"
python3 -c "
from anthropic import Anthropic
client = Anthropic()
message = client.messages.create(
    model='claude-sonnet-4-5-20250929',
    max_tokens=1024,
    messages=[{'role': 'user', 'content': 'Test message'}]
)
print(message.content[0].text)
"
```

**3. Review Action Logs**
```bash
# View recent workflow runs
gh run list --workflow "Content Improvement Bot"

# View specific run details
gh run view [run-id]

# Download logs for analysis
gh run download [run-id]
```

**4. Reproduce Failure**
```bash
# Use act to run workflows locally
# Install: https://github.com/nektos/act
act -j improve-content \
  -s CLAUDE_CODE_OAUTH_TOKEN="your-key" \
  --artifact-server-path /tmp/artifacts
```

---

## Best Practices

### For Bot Maintainers

**1. Regular Monitoring**
- Check workflow runs daily
- Review PRs within 48 hours
- Track monthly cost and usage
- Monitor quality trends

**2. Prompt Maintenance**
- Collect examples of good/bad outputs
- Refine prompts quarterly
- Add edge cases to examples
- Update standards references

**3. Performance Optimization**
- Adjust batch sizes based on review capacity
- Schedule runs during low-traffic times
- Use cheaper models for simple fixes
- Cache common prompt components

**4. Quality Assurance**
- Spot-check 10% of bot changes manually
- Run full validation monthly
- Compare before/after metrics
- Gather user feedback on content quality

**5. Documentation**
- Keep this guide updated
- Document common issues and fixes
- Share learnings with team
- Maintain runbook for emergencies

### For PR Reviewers

**1. Efficiency**
- Use validation script first
- Focus on high-risk changes (safety sections, expert insights)
- Spot-check 20% of files thoroughly
- Trust bot for routine fixes (YAML, formatting)

**2. Quality Standards**
- Verify expert insights are specific
- Check success rates are realistic
- Ensure wikilinks work
- Validate safety content completeness

**3. Feedback Loop**
- Document patterns of errors
- Report issues to bot maintainers
- Suggest prompt improvements
- Share excellent examples

---

## Summary

**Key Takeaways:**
- ✅ Two automated bots improve content quality at scale
- ✅ Content Improvement Bot: Daily, 10 files, systematic enhancements
- ✅ Monthly Validation Bot: Monthly, 20 files, error correction
- ✅ Est. $120/month cost, 150-225 hours/month saved
- ✅ Human review required for quality assurance
- ✅ Monitoring and troubleshooting tools available

**Quick Reference:**

| Task | Command |
|------|---------|
| **Manual trigger** | `gh workflow run "Content Improvement Bot" -f num_files=5` |
| **Check status** | `gh run list --workflow "Content Improvement Bot"` |
| **Review PR** | Check YAML, expert insights, wikilinks, success rates |
| **Validate locally** | `python3 scripts/validate_content.py source/content/` |
| **View logs** | `gh run view [run-id]` |
| **Fix merge conflict** | `git rebase origin/main` |

---

**Document Version**: 1.0
**Last Updated**: October 14, 2025
**Maintainer**: BJJ Graph Team
**Status**: 🚀 Production
