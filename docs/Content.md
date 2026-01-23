# BJJGraph Content Standards

## Content Workflow

### Editing Content (JSON-First)

1. **Edit JSON source** in `source/templates/*.json`
2. **Validate** with `python3 scripts/validate_json.py`
3. **Regenerate markdown** with `python3 scripts/json_to_md.py`
4. **Test build** with `cd source && npx quartz build --serve`

Never edit files in `source/content/` directly - they are regenerated from JSON.

---

## Success Rates (Critical)

### Format

```
(Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)
```

### Rules

| Rule | Description |
|------|-------------|
| **Ordering** | Beginner <= Intermediate <= Advanced (strictly enforced) |
| **Values** | 0-100 integers only |
| **Required** | All three skill levels must be present |
| **Progression** | Typical 10-15% increase per level |

### Examples

| Technique Type | Beginner | Intermediate | Advanced |
|----------------|----------|--------------|----------|
| Sweep from guard | 40% | 55% | 70% |
| Submission from mount | 50% | 65% | 80% |
| Escape from bad position | 25% | 40% | 55% |

---

## Wikilinks

### Format

```markdown
[[Page Name]]
```

### Rules

- Must match exact filename (case-sensitive)
- No `.md` extension in link
- Verify target file exists before adding
- Special terminal states: `[[Won by Submission]]`, `[[Guard Opening Sequence]]`

### Validation

Run `python3 scripts/validate_json.py` to check all wikilinks resolve.

---

## Expert Insights (Required)

All technical content requires insights from three experts:

### 1. John Danaher
- **Style**: Systematic, theoretical, biomechanical
- **Focus**: Technical precision, conceptual frameworks
- **Example**: "The fundamental principle of control from mount is eliminating the opponent's ability to create frames that generate distance..."

### 2. Gordon Ryan
- **Style**: Competition-focused, high-percentage
- **Focus**: Modern meta-game, efficiency
- **Example**: "In competition, I focus on establishing control before attacking. 80% of my mount finishes come from arm isolation..."

### 3. Eddie Bravo
- **Style**: Innovative, unorthodox, creative
- **Focus**: 10th Planet methodology, unexpected variations
- **Example**: "Most people think mount is just about submissions, but the real power is in the threat. The Twister from mount catches everyone..."

**Each insight: 2-3 sentences with distinct perspective**

---

## Required Sections by Content Type

### Positions

| Section | Requirements |
|---------|--------------|
| State Description | Properties, point value, risk level |
| Visual Description | 4-8 sentences describing body positioning |
| Key Principles | 5-7 fundamental concepts |
| Offensive Transitions | Min 6 techniques with success rates |
| Defensive Responses | Min 4 counter-techniques |
| Decision Tree | Min 3 if/else conditions with probabilities |
| Expert Insights | All 3 experts, 2-3 sentences each |
| Common Mistakes | Min 5 mistakes with consequences/corrections |
| Training Drills | Min 3 practice progressions |
| Related Positions | Min 3 linked positions |

### Transitions

| Section | Requirements |
|---------|--------------|
| Overview & Properties | ID, from/to states, success rates |
| Visual Execution | Detailed movement description (4+ sentences) |
| Setup Requirements | Min 6 prerequisites |
| Execution Steps | Min 6 numbered steps |
| Common Counters | Min 3 opponent responses with success rates |
| Physical Requirements | Strength, flexibility, coordination, speed ratings |
| Expert Insights | All 3 experts |
| Common Mistakes | Min 5 with corrections |
| Variations & Setups | Min 2 alternative entries |
| Knowledge Assessment | Min 5 technical questions |

### Submissions

| Section | Requirements |
|---------|--------------|
| Safety Notice | **MANDATORY** - First visible content with warning |
| Overview & Properties | ID, type, target anatomy |
| Visual Finishing | Detailed finishing sequence |
| Setup Requirements | Min 6 prerequisites |
| Execution Steps | Min 6 numbered steps |
| Injury Awareness | Specific risks, severity, recovery time |
| Training Progressions | 6 phases (Weeks 1-2, 3-4, 5-8, 9-12, 13+, Ongoing) |
| Expert Insights | All 3 experts with safety emphasis |
| Common Mistakes | Min 5 + dedicated safety errors section |
| Knowledge Assessment | Min 6 questions including 2+ safety questions |

---

## Safety Requirements (Submissions Only)

### Mandatory Elements

```markdown
## Safety Notice

Warning: [Submission Name] targets [anatomy] and can cause [injury type].
Training this technique requires [partner communication/careful application].

### Injury Risks

| Risk | Severity | Recovery Time |
|------|----------|---------------|
| [Specific injury] | High/Medium/Low | [Time range] |

### Tap Recognition

- Verbal tap ("tap" or "stop")
- Hand tap on opponent's body or mat
- Foot tap on mat
- Any repeated gesture indicating submission

### Release Protocol

1. Immediately release [specific grip/pressure]
2. Support partner's [affected body part]
3. Allow recovery time before continuing
```

### Training Progressions (6 Phases)

| Phase | Focus |
|-------|-------|
| Weeks 1-2 | Position and grip mechanics only, no pressure |
| Weeks 3-4 | Light controlled pressure, partner taps early |
| Weeks 5-8 | Moderate pressure with clear communication |
| Weeks 9-12 | Increasing resistance, positional sparring |
| Week 13+ | Live drilling with trusted partners |
| Ongoing | Regular technique refinement, partner safety check-ins |

---

## YAML Frontmatter Templates

### Position Frontmatter

```yaml
---
title: "[Position Name] | BJJ Position Guide | BJJ Graph"
description: "Master [Position Name] in BJJ. Complete guide covering control, techniques, transitions. Success rates included."
tags:
  - positions
  - [category]
  - [skill-level]
---
```

### Transition Frontmatter

```yaml
---
title: "[Technique Name] | BJJ Technique | BJJ Graph"
description: "Learn [Technique Name] in BJJ. Step-by-step from [Start] to [End]. Success: Beginner X%, Intermediate Y%, Advanced Z%."
tags:
  - transitions
  - [category]
  - [skill-level]
---
```

### Submission Frontmatter

```yaml
---
title: "[Submission Name] | BJJ Submission | BJJ Graph"
description: "Master [Submission Name] safely. Complete guide with safety protocols, execution steps, and training progressions."
tags:
  - submissions
  - [category]
  - [skill-level]
---
```

---

## Validation

### Run Before Every Commit

```bash
python3 scripts/validate_json.py
```

### What Validation Checks

- Success rate ordering (Beginner <= Intermediate <= Advanced)
- Wikilink resolution (all targets exist)
- Required sections present
- YAML schema compliance
- Safety sections for submissions

### Fixing Validation Errors

```bash
# Auto-fill TODOs and fix common issues
./scripts/fix_content.sh "source/templates/Positions.json"
```

---

## Complete Schema Reference

For full YAML schema with all fields: `source/content/CONTRIBUTING-YAML-SCHEMA.md`

---

## Quick Reference

| Do | Don't |
|----|-------|
| Edit JSON in `source/templates/` | Edit markdown in `source/content/` |
| Run validation before commits | Skip validation |
| Include all 3 expert insights | Use only 1-2 experts |
| Verify wikilinks exist | Guess at link targets |
| Use integer success rates 0-100 | Use decimals or percentages > 100 |
| Put safety notice first for submissions | Bury safety information |
