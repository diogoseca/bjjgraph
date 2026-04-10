# BJJGraph Content Standards

## Content Workflow

### Editing Content (JSON-First)

1. **Edit JSON source** in `content/*.json` (e.g., `content/Positions/Mount.json`)
2. **Validate & Regenerate** with `npm run regenerate`
3. **Test build** with `npm run dev`

Never edit `.md` files in `content/` directly — they are regenerated from `.json` source files.

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
[[Category/Page Name]]
```

**Examples:** `[[Positions/Mount]]`, `[[Transitions/Armbar from Mount]]`, `[[Submissions/Rear Naked Choke]]`

### Rules

- Must include category path prefix (e.g., `Positions/`, `Transitions/`, `Submissions/`)
- Must match exact filename (case-sensitive)
- No `.md` extension in link
- Verify target file exists before adding
- **Exception:** `[[game-over]]` uses bare format (no prefix)

### Validation

Run `npm run validate:json` to check all wikilinks resolve.

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

### Transitions (Attacker/Defender Model)

Transitions generate 3 pages: Hub, Attacker, Defender.

**Hub-level requirements:**

| Section | Requirements |
|---------|--------------|
| Overview & Properties | Name, `from_position` (Position/Role format) |
| Outcomes | Array of outcomes with `to`, `probability`, `result` |
| Related Content | Min 3 related entries |

**Attacker page requirements:**

| Section | Requirements |
|---------|--------------|
| Overview | Detailed attacking perspective (4+ sentences) |
| Key Principles | Min 5 fundamental concepts |
| Setup Requirements | Min 4 prerequisites |
| Execution Steps | Min 6 numbered steps with action + description |
| Common Counters | Min 3 with `targets_outcome` linking to `outcomes[].to` |
| Common Errors | Min 5 with consequence and correction |
| Training Progressions | Min 4 phases |
| Knowledge Assessment | Min 5 technical questions |
| Safety Considerations | Required text section |

**Defender page requirements:**

| Section | Requirements |
|---------|--------------|
| Overview | Detailed defending perspective |
| Key Principles | Min 5 fundamental concepts |
| Recognition Cues | Min 3 signs the technique is being attempted |
| Defensive Options | Min 3 with `targets_outcome` linking to `outcomes[].to` |
| Favorable Outcomes | Min 1 with outcome position and how to achieve |
| Common Errors | Min 3 with consequence and correction |
| Knowledge Assessment | Min 3 technical questions |
| Training Progressions | Min 3 phases |

**Outcome requirements:**
- Min 2 outcomes per transition (success + failure or counter)
- `probability` values must sum to 100%
- `result` must be: `success`, `failure`, or `counter`
- `to` must use Position/Role format (e.g., `"Mount/Top"`) or `"game-over"`
- `targets_outcome` values in attacker/defender must match an `outcomes[].to` value

### Submissions (Attacker/Defender Model)

Submissions generate 3 pages: Hub, Attacker, Defender. Same attacker/defender pattern as Transitions with additions.

**Hub-level requirements:**

| Section | Requirements |
|---------|--------------|
| Safety Notice | **MANDATORY** - First visible content with warning |
| Overview & Properties | Type, target anatomy, category |
| Outcomes | **REQUIRED** - Array of outcomes (was previously optional) |
| Safety Considerations | Shared object at hub level |

**Attacker page:** Same as Transition attacker, plus execution steps may include `timing` field.

**Defender page:** Same as Transition defender, plus:

| Section | Requirements |
|---------|--------------|
| Escape Paths | Min 2 submission-specific escape routes |

**Submission-specific rules:**
- `outcomes[]` is mandatory (no submissions without outcomes)
- `safety_considerations` stays at hub level (shared between roles)
- Knowledge assessment items can have `safety_critical: true` flag

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

### `targets_outcome` Validation

Attacker and Defender sections use `targets_outcome` to link actions to specific outcomes:

| Field | Location | Validates Against |
|-------|----------|-------------------|
| `attacker.common_counters[].targets_outcome` | Transition/Submission | `outcomes[].to` |
| `defender.defensive_options[].targets_outcome` | Transition/Submission | `outcomes[].to` |
| `defender.favorable_outcomes[].outcome` | Transition/Submission | `outcomes[].to` |

**Rules:**
- Each `targets_outcome` value must match exactly one `outcomes[].to` value
- Values use Position/Role format (e.g., `"Mount/Top"`, `"Closed Guard/Bottom"`, `"game-over"`)
- `TODO` values are skipped during validation

### Fixing Validation Errors

The validation output shows files needing fixes. Edit the JSON source files directly in `content/` (e.g., `content/Positions/Mount.json`).

---

## Complete Schema Reference

For full schema details, see the JSON template files:

**Positions** (`templates/Positions/`):
- `TEMPLATE-FAMILY.json` — Family positions (hub + top + bottom + variants)
- `TEMPLATE-DUAL.json` — Dual positions (top + bottom)
- `TEMPLATE-SINGLE.json` — Single/neutral positions

**Transitions** (`templates/Transitions/`):
- `TEMPLATE-DUAL.json` — Transitions with attacker/defender structure

**Submissions** (`templates/Submissions/`):
- `TEMPLATE-DUAL.json` — Submission variants with attacker/defender + outcomes
- `TEMPLATE-FAMILY.json` — Submission family hubs (informational, no graph node)

---

## Quick Reference

| Do | Don't |
|----|-------|
| Edit JSON in `content/` | Edit markdown (`.md`) in `content/` |
| Run validation before commits | Skip validation |
| Verify wikilinks exist | Guess at link targets |
| Use integer success rates 0-100 | Use decimals or percentages > 100 |
| Put safety notice first for submissions | Bury safety information |
| Use `game-over` for terminal state | Use `Won by Submission` or `Lost by Submission` |
| Ensure `attempt_probability` sums to 100% | Leave probability sums incomplete |
| Ensure `outcomes` probability sums to 100% | Have outcomes that don't sum correctly |
| Use `result` types: success/failure/counter | Invent custom result types |
| Ensure `targets_outcome` matches `outcomes[].to` | Use targets_outcome values not in outcomes |
| Use Position/Role format in `outcomes[].to` | Use bare position names without role suffix |
