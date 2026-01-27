# BJJGraph Content Standards

## Content Workflow

### Editing Content (JSON-First)

1. **Edit JSON source** in `source/templates/*.json`
2. **Validate & Regenerate** with `npm run regenerate`
3. **Test build** with `npm run dev`

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
- Terminal state: `[[game-over]]` (NOT `Won by Submission` or `Lost by Submission`)

### Validation

Run `npm run validate` to check all wikilinks resolve.

---

## Required Sections by Content Type

### Positions

| Section | Requirements |
|---------|--------------|
| State Properties | Point value, position type, risk level, energy cost |
| Transitions | Array of `{transition, attempt_probability}` per role |
| Visual Description | 4-8 sentences describing body positioning |
| Key Principles | 5-7 fundamental concepts |
| Decision Tree | Min 3 if/else conditions with probabilities |
| Common Mistakes | Min 5 mistakes with consequences/corrections |
| Training Drills | Min 3 practice progressions |
| Related Positions | Min 3 linked positions |

**Transition requirements:**
- Min 4 transitions per role (Top/Bottom)
- `attempt_probability` values must sum to 100% per role
- Each `transition` must reference a valid Transition by name

### Transitions

| Section | Requirements |
|---------|--------------|
| Overview & Properties | Name, `from_position` (Position/Role format) |
| Outcomes | Array of outcomes with `to`, `probability`, `result` |
| Visual Execution | Detailed movement description (4+ sentences) |
| Setup Requirements | Min 6 prerequisites |
| Execution Steps | Min 6 numbered steps |
| Physical Requirements | Strength, flexibility, coordination, speed ratings |
| Common Mistakes | Min 5 with corrections |
| Variations & Setups | Min 2 alternative entries |
| Knowledge Assessment | Min 5 technical questions |

**Outcome requirements:**
- Min 2 outcomes per transition (success + failure or counter)
- `probability` values must sum to 100%
- `result` must be: `success`, `failure`, or `counter`
- `to` must reference valid Position, Transition, or `game-over`

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
| Common Mistakes | Min 5 + dedicated safety errors section |
| Knowledge Assessment | Min 6 questions including 2+ safety questions |

---

## Knowledge Assessment Guidelines

The `knowledge_assessment` array (5-20 Q&A pairs) should be tailored to each content type's nature:

### Positions = Stable States (Focus: RETENTION)

Positions are stable configurations where you can rest, plan, and choose your next action.
Questions should focus on **how to maintain the position**.

**Required topics:**
1. Weight distribution for control
2. Base fundamentals
3. Common retention errors
4. Shutting down primary escapes
5. Essential grips for maintenance
6. Pressure application
7. Anticipating opponent movement
8. Energy management

**Example questions:**
- "How should weight be distributed to maintain Mount?"
- "What mistake most commonly leads to losing Side Control?"
- "How do you shut down the elbow escape from Mount?"

### Transitions = States in Motion (Focus: EXECUTION)

Transitions are actions that move you between positions. They have uncertainty (outcomes).
Questions should focus on **technical execution and timing**.

**Required topics:**
1. Optimal timing to attempt
2. Entry requirements/conditions
3. Key mechanical details
4. Common failure points
5. Required grips
6. Direction of force application
7. Opponent's likely response
8. Chain attacks if blocked

**Example questions:**
- "When is the optimal moment to attempt Hip Bump Sweep?"
- "What is the most critical body movement in Scissor Sweep?"
- "If Armbar from Guard fails, what follow-up options exist?"

### Submissions = Motion with Finish (Focus: FINISHING)

Submissions are transitions ending with a tap (game-over). They require both motion AND finishing mechanics.
Questions should focus on **mechanics that force the tap** and **safety**.

**Required topics:**
1. Anatomical target
2. How to know when properly applied
3. Control requirements before finishing
4. Point of no escape for opponent
5. Common finishing errors
6. Grip adjustments during finish
7. Injury risks if not released
8. Signs opponent is about to tap

**Example questions:**
- "What anatomical structure does Rear Naked Choke attack?"
- "At what point can the opponent no longer escape the Armbar?"
- "What injury can occur if Heel Hook is not released on tap?"

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
npm run regenerate:build
```

### What Validation Checks

- Success rate ordering (Beginner <= Intermediate <= Advanced)
- Wikilink resolution (all targets exist)
- Required sections present
- YAML schema compliance
- Safety sections for submissions
- **Probability sums** (see below)

### Probability Validation Rules

The state machine model requires probability sums to equal 100%:

| Schema Element | Field | Must Sum To |
|---------------|-------|-------------|
| Position role (Top/Bottom) | `transitions[].attempt_probability` | 100% |
| Transition | `outcomes[].probability` | 100% |

**Example validation errors:**

```
ERROR: Mount/Top transitions sum to 95% (expected 100%)
ERROR: Armbar from Mount outcomes sum to 110% (expected 100%)
```

**Outcome result types:**
- `success` - Technique achieves intended goal
- `failure` - Technique fails, position maintained or regressed
- `counter` - Opponent successfully counters

### Fixing Validation Errors

The validation output shows files needing fixes. Edit the JSON source files directly in `source/templates/`.

---

## Complete Schema Reference

For full schema details, see the JSON template files in `source/templates/Positions/`:
- `TEMPLATE-POSITION-FAMILY.json` — Family positions (hub + top + bottom)
- `TEMPLATE-POSITION-DUAL.json` — Dual positions (top + bottom)
- `TEMPLATE-POSITION-SINGLE.json` — Single/neutral positions

---

## Quick Reference

| Do | Don't |
|----|-------|
| Edit JSON in `source/templates/` | Edit markdown in `source/content/` |
| Run validation before commits | Skip validation |
| Verify wikilinks exist | Guess at link targets |
| Use integer success rates 0-100 | Use decimals or percentages > 100 |
| Put safety notice first for submissions | Bury safety information |
| Use `game-over` for terminal state | Use `Won by Submission` or `Lost by Submission` |
| Ensure `attempt_probability` sums to 100% | Leave probability sums incomplete |
| Ensure `outcomes` probability sums to 100% | Have outcomes that don't sum correctly |
| Use `result` types: success/failure/counter | Invent custom result types |
