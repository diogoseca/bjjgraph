---
title: "Transition Standard V2 | BJJ State Machine Template"
description: "Unified standard template for BJJ transitions with YAML frontmatter, simplified markdown content, and LLM context integration."
transition_id: "T000"
transition_name: "[Technique Name]"
alternative_names: ["Alternative Name 1", "Alternative Name 2"]
starting_state: "[Starting Position]"
ending_state: "[Ending Position]"
transition_type: "Attack|Escape|Advancement|Counter|Setup"
success_probability:
  beginner: 0
  intermediate: 0
  advanced: 0
execution_complexity: "Low|Medium|High"
energy_cost: "Low|Medium|High"
time_required: "Instant|Quick|Medium|Slow"
risk_level: "Low|Medium|High"
physical_requirements:
  strength: "Low|Medium|High"
  flexibility: "Low|Medium|High"
  coordination: "Low|Medium|High"
  speed: "Low|Medium|High"
success_modifiers:
  setup_quality: 10
  timing_precision: 15
  opponent_fatigue: 5
  knowledge_test: 10
  position_control: 5
schema_type: "HowTo"
total_time: "PT5M"
tags: ["bjj", "transition", "standard", "template"]
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Transition Standard V2",
  "description": "Learn how to execute Transition Standard V2 in Brazilian Jiu-Jitsu.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Setup Requirements",
      "text": "[Grips, positioning, or prerequisites that must be established]",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Initial Movement",
      "text": "[First action to initiate the technique]",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Opponent Response",
      "text": "[Expected defensive reaction or typical behavior]",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Adaptation",
      "text": "[How to adjust based on opponent's reaction or resistance]",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Completion",
      "text": "[Final movement to achieve the ending state]",
      "position": 5
    },
    {
      "@type": "HowToStep",
      "name": "Consolidation",
      "text": "[How to secure and stabilize the new position] ```  **Requirements**: - Minimum 6 steps (can include more for complex techniques) - Each step has bold title + detailed description - Follows logical progression from setup to completion",
      "position": 6
    }
  ],
  "tool": [
    "BJJ Gi or No-Gi attire",
    "Training partner",
    "Mat space"
  ],
  "totalTime": "PT5M"
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Transition Standard V2",
  "description": "Unified standard template for BJJ transitions with YAML frontmatter, simplified markdown content, and LLM context integration.",
  "url": "https://bjjgraph.com/transitions/contributing-transitions",
  "isPartOf": {
    "@type": "WebSite",
    "name": "BJJ Graph",
    "url": "https://bjjgraph.com"
  }
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://bjjgraph.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Transitions",
      "item": "https://bjjgraph.com/transitions/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Transition Standard V2",
      "item": "https://bjjgraph.com/transitions/contributing-transitions"
    }
  ]
}
</script>


# Transition Standard V2 for BJJ State Machine
#bjj #standard #transitions #statemachine #v2

## Overview

This document defines the **Version 2 unified standard** for all transition files in the BJJ state machine. This version introduces YAML frontmatter for structured data, simplifies markdown content by removing inline JSON-LD blocks, and adds an LLM context block for AI-driven decision-making.

### Key Improvements in V2

1. **YAML Frontmatter**: All structured data (IDs, probabilities, physical requirements, SEO metadata) lives in frontmatter
2. **Simplified Markdown**: Removed inline Schema.org JSON-LD blocks (handled by build system)
3. **LLM Context Block**: Dedicated section with execution logic, troubleshooting patterns, and timing guidance
4. **SEO Optimization**: Schema.org integration via frontmatter for automatic HowTo markup generation
5. **Build System Ready**: Structured for automated processing, knowledge graph generation, and game engine integration

---

## Part 1: YAML Frontmatter Structure

Every transition file **MUST** begin with complete YAML frontmatter containing all structured data.

### Core Metadata

```yaml
---
title: "[Technique Name] | BJJ Technique | BJJ Graph"
description: "Learn [Technique Name] in BJJ. Step-by-step execution from [Starting State] to [Ending State]. Success: Beginner X%, Intermediate Y%, Advanced Z%."
```

**Requirements:**
- `title`: Include technique name + "BJJ Technique" + "BJJ Graph" for SEO
- `description`: Template format with starting state, ending state, and success rates (under 160 characters)

### State Machine Properties

```yaml
transition_id: "T###"
transition_name: "[Technique Name]"
alternative_names: ["Alt Name 1", "Alt Name 2", "Alt Name 3"]
starting_state: "[Starting Position]"
ending_state: "[Ending Position]"
transition_type: "Attack|Escape|Advancement|Counter|Setup"
```

**Requirements:**
- `transition_id`: Format T### (e.g., T045, T127)
- `transition_name`: Exact match to filename (without .md extension)
- `alternative_names`: Array of common alternative terms
- `starting_state`: Must link to existing Position file
- `ending_state`: Must link to existing Position file
- `transition_type`: One of: Attack, Escape, Advancement, Counter, Setup

### Probability and Execution Data

```yaml
success_probability:
  beginner: 50
  intermediate: 70
  advanced: 85
execution_complexity: "Low|Medium|High"
energy_cost: "Low|Medium|High"
time_required: "Instant|Quick|Medium|Slow"
risk_level: "Low|Medium|High"
```

**Requirements:**
- `success_probability`: Numeric values (0-100) for three skill levels
- All execution properties use standardized Low/Medium/High or time descriptors

### Physical Requirements

```yaml
physical_requirements:
  strength: "Low|Medium|High"
  flexibility: "Low|Medium|High"
  coordination: "Low|Medium|High"
  speed: "Low|Medium|High"
```

**Requirements:**
- Four dimensions of physical demand
- Used for training progression and prerequisite analysis

### Success Modifiers

```yaml
success_modifiers:
  setup_quality: 10
  timing_precision: 15
  opponent_fatigue: 5
  knowledge_test: 10
  position_control: 5
```

**Requirements:**
- Numeric values representing +/- percentage adjustments
- Used by game engine for dynamic probability calculations

### Schema.org Integration

```yaml
schema_type: "HowTo"
total_time: "PT5M"
schema_tools:
  - "BJJ Gi or No-Gi attire"
  - "Training partner"
  - "Mat space"
```

**Requirements:**
- `schema_type`: Always "HowTo" for techniques
- `total_time`: ISO 8601 duration format (PT#M or PT#H#M)
- `schema_tools`: Array of required equipment/resources
- Build system will generate JSON-LD from execution steps automatically

### SEO and Taxonomy

```yaml
tags: ["bjj", "transition", "sweep", "guard", "fundamental"]
related_positions: ["Position Name 1", "Position Name 2"]
related_techniques: ["Technique Name 1", "Technique Name 2"]
```

**Requirements:**
- `tags`: Minimum 3, maximum 10 relevant tags
- `related_positions`: Links to Position files for graph navigation
- `related_techniques`: Links to similar Transition files

---

## Part 2: Markdown Content Structure

After the YAML frontmatter, markdown content follows this simplified structure:

### 1. Title and Tags

```markdown
# [Technique Name]
#bjj #transition #[category] #[type] #[level]
```

### 2. Visual Execution Sequence

**Purpose**: High-level narrative description for human understanding and TTS narration.

**Template**:
```markdown
## Visual Execution Sequence

From [starting position], you [initial setup action]. Your opponent [typical response]. You then [key movement 1], [specific body mechanics], while [key movement 2]. The [leverage point] combined with [force application] creates [off-balancing effect], resulting in [ending position] with [control elements].

**One-Sentence Summary**: "From [starting position with key grips], you [main action] while [secondary action], sweeping them to [ending position]."
```

**Requirements**:
- Minimum 4 sentences describing complete sequence
- Include setup, opponent response, execution, and completion
- One-sentence summary for quick reference

### 3. Execution Steps

**Purpose**: Numbered sequence for systematic learning and Schema.org HowTo integration.

```markdown
## Execution Steps

1. **Setup Requirements**: [Grips, positioning, or prerequisites that must be established]
2. **Initial Movement**: [First action to initiate the technique]
3. **Opponent Response**: [Expected defensive reaction or typical behavior]
4. **Adaptation**: [How to adjust based on opponent's reaction or resistance]
5. **Completion**: [Final movement to achieve the ending state]
6. **Consolidation**: [How to secure and stabilize the new position]
```

**Requirements**:
- Minimum 6 steps (can include more for complex techniques)
- Each step has bold title + detailed description
- Follows logical progression from setup to completion

### 4. Key Technical Details

**Purpose**: Critical success factors and micro-adjustments.

```markdown
## Key Technical Details

- **Grip Requirements**: [Specific hand/arm positioning and control points]
- **Base/Foundation**: [Foot placement, weight distribution, stability elements]
- **Timing Windows**: [When to initiate and complete each phase]
- **Leverage Points**: [Where to apply force and pressure for maximum effect]
- **Common Adjustments**: [Micro-corrections during execution based on feedback]
```

**Requirements**:
- Five core categories (above) are mandatory
- Each category has specific, actionable details
- Focus on "what makes it work" rather than just "how to do it"

### 5. Common Counters and Decision Logic

**Purpose**: Opponent responses for AI behavior and strategic understanding.

```markdown
## Common Counters

Opponent defensive responses with success rates and conditions:

- **[[Counter Technique 1]]** → [[Result State]] (Success Rate: X%, Conditions: [when applicable])
- **[[Counter Technique 2]]** → [[Result State]] (Success Rate: Y%, Conditions: [when applicable])
- **[[Counter Technique 3]]** → [[Result State]] (Success Rate: Z%, Conditions: [when applicable])
- **[[Scramble Response]]** → [[Result State]] (Success Rate: W%, Conditions: [chaotic situations])

### Decision Logic for AI Opponent

```
If [setup quality] < 50%:
- Execute [[Defensive Counter]] (Probability: X%)

Else if [timing] is telegraphed early:
- Execute [[Aggressive Counter]] (Probability: Y%)

Else if [opponent has energy advantage]:
- Execute [[Scramble Response]] (Probability: Z%)

Else [optimal execution conditions]:
- Accept transition (Probability: Base Success Rate - Applied Modifiers)
```
```

**Requirements**:
- Minimum 3 common counters with success rates
- Wikilink format for counter techniques and resulting states
- Decision logic in pseudo-code format for game engine processing
- Conditions specify when each counter is most effective

### 6. Expert Insights

**Purpose**: High-level strategic and technical commentary from recognized authorities.

```markdown
## Expert Insights

### John Danaher
"[Biomechanical analysis, systematic breakdown, or theoretical principle that explains why the technique works]"

### Gordon Ryan
"[Competition application, high-percentage details, or practical adjustments from elite-level experience]"

### Eddie Bravo
"[Innovation connections, unconventional applications, or creative variations from 10th Planet system]"
```

**Requirements**:
- One insight from each of the three authorities
- 2-4 sentences per insight
- Each focuses on different aspect (theory, practice, innovation)
- Written in their characteristic voice and perspective

### 7. Common Errors

**Purpose**: Knowledge test generation and troubleshooting guidance.

```markdown
## Common Errors

### Error 1: [Specific Mistake]
- **Why It Fails**: [Mechanical or strategic reason the error causes failure]
- **Correction**: [Proper technique and mindset adjustment]
- **Recognition**: [How to identify when making this error during execution]

### Error 2: [Specific Mistake]
- **Why It Fails**: [Mechanical or strategic reason]
- **Correction**: [Proper technique]
- **Recognition**: [Identification cues]

### Error 3: [Specific Mistake]
- **Why It Fails**: [Mechanical or strategic reason]
- **Correction**: [Proper technique]
- **Recognition**: [Identification cues]
```

**Requirements**:
- Minimum 3 common errors
- Each has: Why It Fails, Correction, Recognition
- Focus on errors that significantly impact success rate

### 8. Timing Considerations

**Purpose**: When to attempt and when to avoid this technique.

```markdown
## Timing Considerations

- **Optimal Conditions**: [Best circumstances for high success rate]
- **Avoid When**: [Situations where attempt is likely to fail or dangerous]
- **Setup Sequences**: [Techniques or actions that create ideal conditions]
- **Follow-up Windows**: [Time sensitivity after completion, transition opportunities]
```

**Requirements**:
- Four mandatory categories
- Specific, actionable guidance for each

### 9. Prerequisites

**Purpose**: Learning progression and safety considerations.

```markdown
## Prerequisites

- **Technical Skills**: [Other techniques that should be mastered first]
- **Physical Preparation**: [Strength, flexibility, or conditioning requirements]
- **Positional Understanding**: [Concepts and principles that must be grasped]
- **Experience Level**: [Recommended skill level for safety and success - Beginner/Intermediate/Advanced]
```

**Requirements**:
- Four mandatory categories
- Realistic assessment of requirements
- Links to prerequisite techniques using [[Wikilink]] syntax

### 10. Knowledge Assessment

**Purpose**: Testing technical understanding for game engine knowledge checks.

```markdown
## Knowledge Assessment

1. **Mechanical Understanding**: "What creates the [primary leverage/force] in this technique?"
   - A) [Incorrect option]
   - B) [Correct option]
   - C) [Incorrect option]
   - D) [Incorrect option]
   - **Answer**: B

2. **Timing Recognition**: "When is the optimal moment to execute this technique?"
   - A) [Incorrect option]
   - B) [Incorrect option]
   - C) [Correct option]
   - D) [Incorrect option]
   - **Answer**: C

3. **Error Prevention**: "What is the most common mistake that causes this technique to fail?"
   - A) [Correct option]
   - B) [Incorrect option]
   - C) [Incorrect option]
   - D) [Incorrect option]
   - **Answer**: A

4. **Setup Requirements**: "What must be established before attempting this technique?"
   - A) [Incorrect option]
   - B) [Incorrect option]
   - C) [Incorrect option]
   - D) [Correct option]
   - **Answer**: D

5. **Adaptation**: "How should you adjust if opponent responds with [specific counter]?"
   - A) [Incorrect option]
   - B) [Correct option]
   - C) [Incorrect option]
   - D) [Incorrect option]
   - **Answer**: B
```

**Requirements**:
- Exactly 5 questions covering the five categories shown
- Multiple choice format with 4 options (A-D)
- Answer provided after each question
- Questions test understanding, not memorization

### 11. Variants and Adaptations

**Purpose**: Contextual modifications for different scenarios.

```markdown
## Variants and Adaptations

- **Gi Specific**: [Adjustments when wearing the uniform - collar grips, lapel control, etc.]
- **No-Gi Specific**: [Modifications for grappling without gi - overhooks, underhooks, body locks]
- **Self-Defense**: [Street application considerations - clothing grips, environmental factors]
- **Competition**: [Rule-set specific optimizations - point scoring, advantages, time management]
- **Size Differential**: [Adjustments for height/weight differences - leverage modifications, alternative grips]
```

**Requirements**:
- All five categories present
- Specific modifications for each context
- Practical, actionable adjustments

### 12. Training Progressions

**Purpose**: Skill development pathway from solo practice to live application.

```markdown
## Training Progressions

1. **Solo Practice**: [Movement patterns and body mechanics without partner]
2. **Cooperative Drilling**: [Technical repetition with compliant partner for motor learning]
3. **Resistant Practice**: [Progressive opposition to test technique against defense]
4. **Sparring Integration**: [Live application during rolling with timing and opportunity recognition]
5. **Troubleshooting**: [Common problems during live training and their solutions]
```

**Requirements**:
- Five-stage progression model
- Each stage builds on previous
- Final stage includes troubleshooting for live application

---

## Part 3: LLM Context Block

**NEW IN V2**: This section provides structured context for AI decision-making in the game engine.

```markdown
## LLM Context Block

**Purpose**: This section contains structured decision-making logic for AI opponents, narrative generation, and game engine processing.

### Execution Decision Logic

```yaml
decision_tree:
  conditions:
    - name: "Setup Quality Check"
      evaluation: "setup_quality_score >= 50"
      success_action: "proceed_to_timing_check"
      failure_action: "execute_defensive_counter"
      failure_probability: 55

    - name: "Timing Precision Check"
      evaluation: "timing_window_active AND not_telegraphed"
      success_action: "proceed_to_energy_check"
      failure_action: "execute_aggressive_counter"
      failure_probability: 45

    - name: "Energy Advantage Check"
      evaluation: "opponent_energy > player_energy"
      success_action: "accept_transition_with_modifiers"
      failure_action: "execute_scramble_response"
      failure_probability: 30

  final_calculation:
    base_probability: "success_probability[skill_level]"
    applied_modifiers:
      - setup_quality
      - timing_precision
      - opponent_fatigue
      - knowledge_test
      - position_control
    formula: "base_probability + sum(modifiers) - sum(counters)"
```

### Common Troubleshooting Patterns

```yaml
troubleshooting:
  - symptom: "Opponent easily maintains balance during execution"
    likely_cause: "Insufficient grip control or poor timing"
    diagnostic_questions:
      - "Is collar grip deep and tight?"
      - "Is posted hand positioned correctly beside hip?"
      - "Are you executing when opponent's weight is centered?"
    solution: "Re-establish strong grips, wait for optimal weight distribution, ensure hand post is close to body"

  - symptom: "Feeling weak or unstable during sit-up phase"
    likely_cause: "Hand posted too far from body or incorrect angle"
    diagnostic_questions:
      - "Is posted hand within 6 inches of hip?"
      - "Are fingers pointing away from body?"
      - "Is elbow locked for structural support?"
    solution: "Reposition posted hand closer to hip, adjust angle, engage core muscles earlier"

  - symptom: "Opponent recovers position after initial sweep"
    likely_cause: "Incomplete follow-through to ending position"
    diagnostic_questions:
      - "Are you continuing motion all the way to mount?"
      - "Is guard opening during completion?"
      - "Are you establishing control immediately after sweep?"
    solution: "Complete full range of motion, maintain closed guard until sweep confirmed, immediately establish mount control"
```

### Timing and Setup Guidance

```yaml
timing_guidance:
  optimal_windows:
    - condition: "Opponent has upright posture with centered weight"
      success_boost: "+15%"
      recognition_cues: ["Torso vertical", "Minimal forward pressure", "Grip fighting active"]

    - condition: "After failed submission attempt brings opponent upright"
      success_boost: "+10%"
      recognition_cues: ["Opponent defending armbar or triangle", "Posture broken then recovered", "Arms extended"]

    - condition: "Opponent's base is narrow (knees close together)"
      success_boost: "+10%"
      recognition_cues: ["Knees inside elbows", "Weight centered on tailbone", "Limited lateral stability"]

  avoid_windows:
    - condition: "Opponent is low and heavy with wide base"
      success_penalty: "-20%"
      recognition_cues: ["Chest to chest pressure", "Knees wide apart", "Weight forward"]

    - condition: "Opponent has strong grips controlling your upper body"
      success_penalty: "-15%"
      recognition_cues: ["Double lapel grips", "Strong collar control", "Limited sit-up mobility"]

    - condition: "You are fatigued with low energy reserves"
      success_penalty: "-10%"
      recognition_cues: ["Difficulty maintaining guard", "Weak grip strength", "Labored breathing"]

setup_sequences:
  - sequence_name: "Triangle Feint to Hip Bump"
    steps:
      - "Threaten triangle choke"
      - "Opponent defends by posturing up"
      - "Immediately execute hip bump during posture"
    success_boost: "+10%"

  - sequence_name: "Kimura Grip to Hip Bump"
    steps:
      - "Establish kimura grip"
      - "Opponent defends by sitting back"
      - "Release kimura and execute hip bump"
    success_boost: "+8%"
```

### Narrative Generation Prompts

```yaml
narrative_prompts:
  setup_phase:
    - "You secure a deep collar grip while posting your hand beside your hip, feeling for the optimal moment."
    - "Your opponent maintains their posture, unaware of the sweeping threat building beneath them."
    - "You adjust your grip and positioning, waiting for their weight to shift into the danger zone."

  execution_phase:
    - "You explode into the sit-up motion, your hips bumping powerfully as your hand drives into their shoulder."
    - "The combined forces of your hip bump and shoulder push create an irresistible off-balancing vector."
    - "Your opponent feels their base crumbling as the sweep's momentum carries them over."

  completion_phase:
    - "You follow through smoothly, transitioning into mount position as they hit the mat."
    - "Your guard opens at the perfect moment, allowing you to establish dominant position."
    - "You consolidate mount immediately, securing control before they can recover."

  failure_phase:
    - "Your opponent bases out hard, posting their hand to prevent the rollover."
    - "They sense the sweep coming and drive forward, neutralizing your leverage."
    - "Your timing is off and they maintain their position, forcing you to reset."
```

### Image Generation Prompts

```yaml
image_prompts:
  setup_position:
    prompt: "Brazilian Jiu-Jitsu closed guard position, bottom practitioner has deep collar grip with right hand, left hand posted on mat beside hip, top practitioner has upright posture with centered weight, both wearing blue and white gis, mat background, technical illustration style"
    key_elements: ["Collar grip", "Posted hand", "Closed guard", "Upright posture"]

  mid_execution:
    prompt: "BJJ hip bump sweep in motion, bottom practitioner sitting up with hand driving into opponent's shoulder, hips bumping upward and to the side, top practitioner off-balance beginning to fall, dynamic movement captured, technical illustration"
    key_elements: ["Sit-up motion", "Hip bump", "Shoulder push", "Off-balance"]

  completion_position:
    prompt: "BJJ mount position after hip bump sweep, practitioner on top with knees controlling opponent's sides, chest forward, opponent flat on back, control established, technical illustration style"
    key_elements: ["Mount position", "Knee control", "Opponent swept", "Dominant control"]
```

### Audio Narration Scripts

```yaml
audio_scripts:
  instructional_narration:
    script: "From closed guard, establish a deep collar grip and post your hand beside your hip. As your opponent maintains their posture, explode into a strong sit-up motion. Your hips bump powerfully upward and to the side while your posted hand drives into their shoulder. The combined forces sweep them over as you follow through to mount position."
    voice: "Onyx"
    pace: "Moderate"
    emphasis: ["collar grip", "sit-up motion", "hip bump", "follow through"]

  coaching_cues:
    script: "Get that grip deep. Post your hand. Feel their weight. Now sit up strong and bump those hips hard. Drive through that shoulder. Follow all the way to mount. Excellent control."
    voice: "Onyx"
    pace: "Energetic"
    emphasis: ["deep", "strong", "hard", "drive through", "excellent"]

  competition_commentary:
    script: "Watch the setup here. Collar grip established. Hand posted. Perfect timing as the opponent's weight centers. Beautiful execution of the hip bump, powerful drive through the shoulder, and a smooth transition to mount. Textbook technique."
    voice: "Onyx"
    pace: "Fast"
    emphasis: ["Perfect timing", "Beautiful execution", "smooth transition", "Textbook"]
```
```

**Requirements**:
- All six subsections present (Decision Logic, Troubleshooting, Timing, Narrative, Image, Audio)
- Structured in YAML format for easy parsing
- Specific, actionable data for AI processing
- Prompts ready for OpenAI API consumption

---

## Part 4: Supplementary Sections

### Competition Applications

```markdown
## Competition Applications

- **IBJJF Rules**: [Legal requirements, point scoring, advantage rules]
- **No-Gi Competition**: [Submission-only or points-based adaptations]
- **Self-Defense Context**: [Street applicability and danger considerations]
- **MMA Applications**: [Modified versions for mixed martial arts context]
```

### Historical Context

```markdown
## Historical Context

[2-3 sentences about the technique's origins, evolution, or significance in BJJ history. Include key practitioners who popularized or refined it if applicable.]
```

### Safety Considerations

```markdown
## Safety Considerations

- **Controlled Application**: [How to execute safely for both practitioners]
- **Mat Awareness**: [Spatial requirements and environmental factors]
- **Partner Safety**: [Specific concerns for training partner]
- **Gradual Progression**: [How to build up intensity during learning]
```

### Position Integration

```markdown
## Position Integration

**Common combinations and sequences:**
- [[Starting Position]] → [[This Technique]] → [[Ending Position]]
- [[Starting Position]] → [[This Technique]] → [[Alternative Technique]] (if defended)
- [[Starting Position]] → [[This Technique]] → [[Submission Setup]] (if countered)
```

### Related Techniques

```markdown
## Related Techniques

- [[Related Technique 1]] - [Brief relationship description]
- [[Related Technique 2]] - [Brief relationship description]
- [[Related Technique 3]] - [Brief relationship description]
- [[Related Technique 4]] - [Brief relationship description]
```

**Requirements**:
- Minimum 3 related techniques
- Wikilink format for graph navigation
- Brief note on relationship (similar mechanics, common setup, etc.)

---

## Part 5: Validation Checklist

Every transition file following Standard V2 must include:

### YAML Frontmatter
- [ ] Complete title and description (SEO optimized)
- [ ] Transition ID (T###), name, and alternative names
- [ ] Starting and ending states (valid position links)
- [ ] Transition type (Attack/Escape/Advancement/Counter/Setup)
- [ ] Success probabilities for all three skill levels (numeric 0-100)
- [ ] Execution complexity, energy cost, time required, risk level
- [ ] Physical requirements for all four dimensions
- [ ] Success modifiers with numeric values
- [ ] Schema.org integration (type, time, tools)
- [ ] Tags, related positions, related techniques

### Markdown Content
- [ ] Visual execution sequence (minimum 4 sentences + one-sentence summary)
- [ ] Complete execution steps (minimum 6 numbered steps)
- [ ] Key technical details (all 5 categories present)
- [ ] Common counters (minimum 3 with success rates and conditions)
- [ ] Decision logic in pseudo-code format
- [ ] Expert insights from all three authorities (Danaher, Ryan, Bravo)
- [ ] Common errors (minimum 3 with Why/Correction/Recognition)
- [ ] Timing considerations (all 4 categories present)
- [ ] Prerequisites (all 4 categories present)
- [ ] Knowledge assessment (exactly 5 questions with answers)
- [ ] Variants and adaptations (all 5 contexts covered)
- [ ] Training progressions (5-stage model)

### LLM Context Block
- [ ] Execution decision logic (YAML format with conditions and calculations)
- [ ] Troubleshooting patterns (minimum 3 with symptoms/causes/solutions)
- [ ] Timing and setup guidance (optimal windows, avoid windows, setup sequences)
- [ ] Narrative generation prompts (setup, execution, completion, failure phases)
- [ ] Image generation prompts (setup, mid-execution, completion positions)
- [ ] Audio narration scripts (instructional, coaching, commentary)

### Supplementary Sections
- [ ] Competition applications (4 rule sets/contexts)
- [ ] Historical context (2-3 sentences)
- [ ] Safety considerations (4 categories)
- [ ] Position integration (common combinations)
- [ ] Related techniques (minimum 3 with relationships)

---

## Part 6: Complete Example - Hip Bump Sweep

Below is a complete example following Standard V2 format:

```markdown
---
title: "Hip Bump Sweep | BJJ Technique | BJJ Graph"
description: "Learn Hip Bump Sweep in BJJ. Step-by-step execution from Closed Guard Bottom to Mount. Success: Beginner 50%, Intermediate 70%, Advanced 85%."
transition_id: "T045"
transition_name: "Hip Bump Sweep"
alternative_names: ["Sit-Up Sweep", "Hip Heist", "Basic Sweep"]
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
success_modifiers:
  setup_quality: 10
  timing_precision: 15
  opponent_fatigue: 5
  knowledge_test: 10
  position_control: 10
schema_type: "HowTo"
total_time: "PT5M"
schema_tools:
  - "BJJ Gi or No-Gi attire"
  - "Training partner"
  - "Mat space"
tags: ["bjj", "transition", "sweep", "closed_guard", "fundamental", "beginner"]
related_positions: ["Closed Guard Bottom", "Mount", "Open Guard"]
related_techniques: ["Flower Sweep", "Scissor Sweep", "Pendulum Sweep", "Balloon Sweep"]
---

# Hip Bump Sweep
#bjj #transition #sweep #closed_guard #fundamental

## Visual Execution Sequence

From closed guard bottom, you establish a collar grip with one hand while posting your other hand on the mat beside your hip. Your opponent typically maintains their posture or attempts to establish their own grips. You then perform a sit-up motion, bringing your posted hand to their opposite shoulder while simultaneously bumping your hips up and to the side. The combination of the sit-up, hip bump, and shoulder push creates an off-balancing force that sweeps them over to the side as you follow through, ending up in mount position with control established.

**One-Sentence Summary**: "From closed guard with collar grip and hand posted, you sit up while bumping your hips and pushing their shoulder, sweeping them to mount position."

## Execution Steps

1. **Setup Requirements**: Establish collar grip and post hand on mat beside your hip
2. **Initial Movement**: Begin sit-up motion while maintaining closed guard
3. **Opponent Response**: Opponent typically tries to maintain posture or grip fight
4. **Adaptation**: Adjust timing and direction based on their balance and reaction
5. **Completion**: Complete hip bump while pushing shoulder to sweep them over
6. **Consolidation**: Follow through by transitioning to mount position

## Key Technical Details

- **Grip Requirements**: Strong collar grip with one hand for control and direction
- **Base/Foundation**: Hand posted on mat beside hip provides leverage for sit-up motion
- **Timing Windows**: Execute when opponent's weight is centered or slightly forward
- **Leverage Points**: Hip bump combined with shoulder push creates rotational off-balance
- **Common Adjustments**: Vary bump direction and timing based on opponent's weight distribution

## Common Counters

Opponent defensive responses with success rates and conditions:

- **[[Base Out]]** → [[Closed Guard Top]] (Success Rate: 55%, Conditions: quick reaction with strong arm post)
- **[[Drive Forward]]** → [[Guard Pass]] (Success Rate: 40%, Conditions: anticipate sweep and drive weight forward)
- **[[Counter Sweep]]** → [[Top Position]] (Success Rate: 30%, Conditions: redirect momentum with superior timing)
- **[[Posture Up]]** → [[Open Guard]] (Success Rate: 45%, Conditions: create distance to neutralize mechanics)

### Decision Logic for AI Opponent

```
If [setup quality] < 50%:
- Execute [[Base Out]] (Probability: 55%)

Else if [timing] is telegraphed early:
- Execute [[Posture Up]] (Probability: 45%)

Else if [sweep momentum] can be redirected:
- Execute [[Counter Sweep]] (Probability: 30%)

Else [optimal execution conditions]:
- Accept transition (Probability: Base Success Rate - Applied Modifiers)
```

## Expert Insights

### John Danaher
"The hip bump sweep succeeds through proper coordination of upper and lower body movements. The key is understanding that the sit-up motion must be combined with the hip bump - neither action alone will create sufficient off-balancing force. The timing must be precise to catch the opponent when their weight distribution is vulnerable."

### Gordon Ryan
"In competition, I use the hip bump sweep as a fundamental technique to establish dominant position quickly. It's particularly effective against opponents who maintain a more upright posture in guard. The transition to mount is immediate, which allows for quick point scoring and submission opportunities."

### Eddie Bravo
"The hip bump sweep integrates perfectly with submission attempts from guard, particularly when opponents defend other attacks. It can be set up from various guard positions and combines well with rubber guard concepts when modified appropriately. The simplicity makes it highly reliable under pressure."

## Common Errors

### Error 1: Attempting sweep without proper collar grip establishment
- **Why It Fails**: Lack of control allows opponent to easily defend and maintain balance
- **Correction**: Always secure deep collar grip before initiating sweep motion
- **Recognition**: Opponent easily maintains balance with minimal defensive effort

### Error 2: Posting hand too far from body or in wrong position
- **Why It Fails**: Reduces leverage and power generation for the sit-up motion
- **Correction**: Post hand close to hip on same side for optimal leverage
- **Recognition**: Feeling weak or unstable during sit-up phase

### Error 3: Not following through completely to mount position
- **Why It Fails**: Opponent can recover guard or scramble to better position
- **Correction**: Continue motion until fully in mount with control established
- **Recognition**: Ending in scramble situation or opponent recovering position

## Timing Considerations

- **Optimal Conditions**: When opponent has upright posture with weight centered or slightly forward
- **Avoid When**: Opponent is low and heavy with strong base and wide stance
- **Setup Sequences**: After failed submission attempts that bring opponent upright (triangle, armbar)
- **Follow-up Windows**: Must complete transition within 2-3 seconds to prevent defensive recovery

## Prerequisites

- **Technical Skills**: Basic closed guard control and grip fighting fundamentals
- **Physical Preparation**: Core strength for sit-up motion and hip mobility for bump
- **Positional Understanding**: Closed guard mechanics and basic sweep principles
- **Experience Level**: Beginner-friendly technique, excellent first sweep to learn

## Knowledge Assessment

1. **Mechanical Understanding**: "What creates the sweeping force in the hip bump sweep?"
   - A) Only the shoulder push
   - B) The combination of sit-up motion, hip bump, and shoulder push
   - C) Only the hip bump
   - D) The collar grip alone
   - **Answer**: B

2. **Timing Recognition**: "When is the optimal moment to execute this sweep?"
   - A) When opponent is driving forward with heavy pressure
   - B) When opponent is low with wide base
   - C) When opponent has upright posture with centered weight
   - D) When you are fatigued
   - **Answer**: C

3. **Error Prevention**: "What is the most common grip mistake in this technique?"
   - A) Attempting sweep without establishing collar grip first
   - B) Gripping too tightly
   - C) Using both hands on collar
   - D) Releasing grip too early
   - **Answer**: A

4. **Setup Requirements**: "Which hand placement is essential for proper execution?"
   - A) Both hands on opponent's collar
   - B) Hand posted on mat beside your hip
   - C) Both hands controlling opponent's arms
   - D) Hands behind opponent's head
   - **Answer**: B

5. **Adaptation**: "How do you adjust if opponent bases out on the swept side?"
   - A) Force the sweep harder in same direction
   - B) Give up and return to guard
   - C) Attack the posted arm or switch to different technique
   - D) Use more hip bump force
   - **Answer**: C

## Variants and Adaptations

- **Gi Specific**: Traditional collar grips provide maximum control and direction
- **No-Gi Specific**: Adapt to overhook or neck control instead of collar grip
- **Self-Defense**: Modified version using clothing grips in street situations
- **Competition**: Combine with submission attempts for multiple simultaneous threats
- **Size Differential**: Smaller practitioners can leverage superior hip mobility advantage

## Training Progressions

1. **Solo Practice**: Sit-up motion and hip bump mechanics without partner for motor learning
2. **Cooperative Drilling**: Partner allows sweep completion for timing development and feel
3. **Resistant Practice**: Partner provides progressive defensive resistance to test timing
4. **Sparring Integration**: Implementing sweep during live rolling with opportunity recognition
5. **Troubleshooting**: Identifying and correcting common execution problems in real-time

## LLM Context Block

**Purpose**: This section contains structured decision-making logic for AI opponents, narrative generation, and game engine processing.

### Execution Decision Logic

```yaml
decision_tree:
  conditions:
    - name: "Setup Quality Check"
      evaluation: "setup_quality_score >= 50"
      success_action: "proceed_to_timing_check"
      failure_action: "execute_defensive_counter"
      failure_probability: 55

    - name: "Timing Precision Check"
      evaluation: "timing_window_active AND not_telegraphed"
      success_action: "proceed_to_energy_check"
      failure_action: "execute_aggressive_counter"
      failure_probability: 45

    - name: "Energy Advantage Check"
      evaluation: "opponent_energy > player_energy"
      success_action: "accept_transition_with_modifiers"
      failure_action: "execute_scramble_response"
      failure_probability: 30

  final_calculation:
    base_probability: "success_probability[skill_level]"
    applied_modifiers:
      - setup_quality
      - timing_precision
      - opponent_fatigue
      - knowledge_test
      - position_control
    formula: "base_probability + sum(modifiers) - sum(counters)"
```

### Common Troubleshooting Patterns

```yaml
troubleshooting:
  - symptom: "Opponent easily maintains balance during execution"
    likely_cause: "Insufficient grip control or poor timing"
    diagnostic_questions:
      - "Is collar grip deep and tight?"
      - "Is posted hand positioned correctly beside hip?"
      - "Are you executing when opponent's weight is centered?"
    solution: "Re-establish strong grips, wait for optimal weight distribution, ensure hand post is close to body"

  - symptom: "Feeling weak or unstable during sit-up phase"
    likely_cause: "Hand posted too far from body or incorrect angle"
    diagnostic_questions:
      - "Is posted hand within 6 inches of hip?"
      - "Are fingers pointing away from body?"
      - "Is elbow locked for structural support?"
    solution: "Reposition posted hand closer to hip, adjust angle, engage core muscles earlier"

  - symptom: "Opponent recovers position after initial sweep"
    likely_cause: "Incomplete follow-through to ending position"
    diagnostic_questions:
      - "Are you continuing motion all the way to mount?"
      - "Is guard opening during completion?"
      - "Are you establishing control immediately after sweep?"
    solution: "Complete full range of motion, maintain closed guard until sweep confirmed, immediately establish mount control"
```

### Timing and Setup Guidance

```yaml
timing_guidance:
  optimal_windows:
    - condition: "Opponent has upright posture with centered weight"
      success_boost: "+15%"
      recognition_cues: ["Torso vertical", "Minimal forward pressure", "Grip fighting active"]

    - condition: "After failed submission attempt brings opponent upright"
      success_boost: "+10%"
      recognition_cues: ["Opponent defending armbar or triangle", "Posture broken then recovered", "Arms extended"]

    - condition: "Opponent's base is narrow (knees close together)"
      success_boost: "+10%"
      recognition_cues: ["Knees inside elbows", "Weight centered on tailbone", "Limited lateral stability"]

  avoid_windows:
    - condition: "Opponent is low and heavy with wide base"
      success_penalty: "-20%"
      recognition_cues: ["Chest to chest pressure", "Knees wide apart", "Weight forward"]

    - condition: "Opponent has strong grips controlling your upper body"
      success_penalty: "-15%"
      recognition_cues: ["Double lapel grips", "Strong collar control", "Limited sit-up mobility"]

    - condition: "You are fatigued with low energy reserves"
      success_penalty: "-10%"
      recognition_cues: ["Difficulty maintaining guard", "Weak grip strength", "Labored breathing"]

setup_sequences:
  - sequence_name: "Triangle Feint to Hip Bump"
    steps:
      - "Threaten triangle choke"
      - "Opponent defends by posturing up"
      - "Immediately execute hip bump during posture"
    success_boost: "+10%"

  - sequence_name: "Kimura Grip to Hip Bump"
    steps:
      - "Establish kimura grip"
      - "Opponent defends by sitting back"
      - "Release kimura and execute hip bump"
    success_boost: "+8%"
```

### Narrative Generation Prompts

```yaml
narrative_prompts:
  setup_phase:
    - "You secure a deep collar grip while posting your hand beside your hip, feeling for the optimal moment."
    - "Your opponent maintains their posture, unaware of the sweeping threat building beneath them."
    - "You adjust your grip and positioning, waiting for their weight to shift into the danger zone."

  execution_phase:
    - "You explode into the sit-up motion, your hips bumping powerfully as your hand drives into their shoulder."
    - "The combined forces of your hip bump and shoulder push create an irresistible off-balancing vector."
    - "Your opponent feels their base crumbling as the sweep's momentum carries them over."

  completion_phase:
    - "You follow through smoothly, transitioning into mount position as they hit the mat."
    - "Your guard opens at the perfect moment, allowing you to establish dominant position."
    - "You consolidate mount immediately, securing control before they can recover."

  failure_phase:
    - "Your opponent bases out hard, posting their hand to prevent the rollover."
    - "They sense the sweep coming and drive forward, neutralizing your leverage."
    - "Your timing is off and they maintain their position, forcing you to reset."
```

### Image Generation Prompts

```yaml
image_prompts:
  setup_position:
    prompt: "Brazilian Jiu-Jitsu closed guard position, bottom practitioner has deep collar grip with right hand, left hand posted on mat beside hip, top practitioner has upright posture with centered weight, both wearing blue and white gis, mat background, technical illustration style"
    key_elements: ["Collar grip", "Posted hand", "Closed guard", "Upright posture"]

  mid_execution:
    prompt: "BJJ hip bump sweep in motion, bottom practitioner sitting up with hand driving into opponent's shoulder, hips bumping upward and to the side, top practitioner off-balance beginning to fall, dynamic movement captured, technical illustration"
    key_elements: ["Sit-up motion", "Hip bump", "Shoulder push", "Off-balance"]

  completion_position:
    prompt: "BJJ mount position after hip bump sweep, practitioner on top with knees controlling opponent's sides, chest forward, opponent flat on back, control established, technical illustration style"
    key_elements: ["Mount position", "Knee control", "Opponent swept", "Dominant control"]
```

### Audio Narration Scripts

```yaml
audio_scripts:
  instructional_narration:
    script: "From closed guard, establish a deep collar grip and post your hand beside your hip. As your opponent maintains their posture, explode into a strong sit-up motion. Your hips bump powerfully upward and to the side while your posted hand drives into their shoulder. The combined forces sweep them over as you follow through to mount position."
    voice: "Onyx"
    pace: "Moderate"
    emphasis: ["collar grip", "sit-up motion", "hip bump", "follow through"]

  coaching_cues:
    script: "Get that grip deep. Post your hand. Feel their weight. Now sit up strong and bump those hips hard. Drive through that shoulder. Follow all the way to mount. Excellent control."
    voice: "Onyx"
    pace: "Energetic"
    emphasis: ["deep", "strong", "hard", "drive through", "excellent"]

  competition_commentary:
    script: "Watch the setup here. Collar grip established. Hand posted. Perfect timing as the opponent's weight centers. Beautiful execution of the hip bump, powerful drive through the shoulder, and a smooth transition to mount. Textbook technique."
    voice: "Onyx"
    pace: "Fast"
    emphasis: ["Perfect timing", "Beautiful execution", "smooth transition", "Textbook"]
```

## Competition Applications

- **IBJJF Rules**: Legal at all belt levels, scores as sweep (2 points) plus mount (4 points) for total 6 points
- **No-Gi Competition**: Requires adaptation to different grip systems (overhooks, neck control)
- **Self-Defense Context**: Excellent for creating dominant position quickly in street altercation
- **MMA Applications**: Modified version effective in mixed martial arts with cage awareness

## Historical Context

The hip bump sweep is one of the most fundamental techniques in Brazilian Jiu-Jitsu, taught to beginners as an introduction to sweep mechanics. It demonstrates core principles of leverage, timing, and position that apply throughout the art. The technique has remained largely unchanged since the early days of Gracie Jiu-Jitsu.

## Safety Considerations

- **Controlled Application**: Smooth execution prevents injury to both practitioners during sweep
- **Mat Awareness**: Ensure adequate space around training area for safe completion
- **Partner Safety**: Controlled follow-through protects training partner from hard landing
- **Gradual Progression**: Build up speed and power gradually during learning phase

## Position Integration

**Common combinations and sequences:**
- [[Closed Guard Bottom]] → [[Hip Bump Sweep]] → [[Mount]]
- [[Closed Guard Bottom]] → [[Hip Bump Sweep]] → [[Triangle Setup]] (if opponent bases out)
- [[Closed Guard Bottom]] → [[Hip Bump Sweep]] → [[Armbar Setup]] (if opponent defends sweep)

## Related Techniques

- [[Flower Sweep]] - Similar sit-up mechanics with different leg action
- [[Scissor Sweep]] - Alternative sweep from closed guard with leg scissor
- [[Pendulum Sweep]] - Uses opposite direction sweep from similar setup
- [[Balloon Sweep]] - Related technique with different grip and direction
```

---

## Part 7: Migration Guide from V1 to V2

For existing transition files following the original standard:

### Step 1: Extract YAML Frontmatter
- Move all properties from markdown headers to YAML frontmatter
- Convert success probabilities to numeric values
- Add schema integration fields
- Include SEO metadata

### Step 2: Remove JSON-LD Blocks
- Delete inline `<script type="application/ld+json">` blocks
- Build system will generate Schema.org markup from YAML + execution steps

### Step 3: Add LLM Context Block
- Create new section with six subsections
- Structure decision logic in YAML format
- Add troubleshooting patterns
- Include timing guidance
- Create narrative/image/audio prompts

### Step 4: Validate Against Checklist
- Use validation checklist above to ensure completeness
- Cross-reference with example file
- Test YAML parsing and markdown rendering

---

## Part 8: Build System Integration

### Expected Processing

**Quartz Plugin**: `quartz/plugins/transformers/transition-processor.ts`
- Parse YAML frontmatter for structured data
- Extract execution steps for Schema.org HowTo generation
- Generate JSON-LD automatically (no inline blocks needed)
- Create knowledge graph edges between positions
- Index success probabilities for search/filtering

**Game Engine**: `bjjgraph-game/app/core/transition_loader.py`
- Parse YAML frontmatter for game state machine
- Load LLM context block for AI decision-making
- Use troubleshooting patterns for player guidance
- Access narrative/image/audio prompts for OpenAI APIs
- Calculate dynamic probabilities with modifiers

### File Naming Convention

- Filename must match `transition_name` in YAML (with spaces → underscores)
- Example: `Hip Bump Sweep.md` → `transition_name: "Hip Bump Sweep"`
- Transition ID must be unique across all transition files

---

## Part 9: Quality Standards

### Content Quality
- Expert insights must reflect authentic teaching styles
- Success probabilities must be realistic and evidence-based
- Common errors must be based on actual beginner mistakes
- Timing considerations must be tactically sound

### Technical Accuracy
- Execution steps must be mechanically correct
- Leverage points must align with biomechanics
- Counters must be realistic defensive options
- Prerequisites must reflect actual skill requirements

### SEO Optimization
- Meta description under 160 characters
- Title includes target keyword + "BJJ" + site name
- Tags include relevant search terms
- Internal links use proper [[Wikilink]] syntax

### AI Readiness
- YAML must be valid and parseable
- Decision logic must be executable pseudo-code
- Prompts must be ready for API consumption
- Troubleshooting patterns must be structured for matching

---

## Notes for Developers

This Standard V2 template ensures:

1. **Separation of Concerns**: Structured data in YAML, content in Markdown, AI logic in LLM block
2. **Build System Efficiency**: No redundant JSON-LD blocks, automatic schema generation
3. **Game Engine Integration**: Complete data for state machine, probabilities, and AI behavior
4. **SEO Performance**: Proper metadata, schema markup, internal linking
5. **Content Consistency**: Standardized sections across all transition files
6. **AI/LLM Optimization**: Dedicated context block for narrative, images, audio generation
7. **Knowledge Testing**: Structured assessments for learning verification
8. **Training Progression**: Clear pathway from beginner to advanced

### Future Enhancements

Potential additions for V3:
- Video timestamp integration
- 3D animation keyframe data
- Biometric sensor integration (heart rate, force measurements)
- Multi-language support in YAML
- Difficulty rating algorithms
- Personalized success probability adjustments

---

## Validation and Testing

Before publishing a new transition file:

1. **YAML Validation**: Run through YAML parser to check syntax
2. **Wikilink Validation**: Verify all [[Position]] and [[Technique]] links exist
3. **Schema Testing**: Validate generated JSON-LD against Schema.org validator
4. **Content Completeness**: Check against validation checklist
5. **Technical Review**: Have subject matter expert review for accuracy
6. **SEO Check**: Verify meta description length and keyword inclusion
7. **Build Test**: Process through Quartz build to ensure rendering

---

**Document Version**: 2.0
**Last Updated**: 2025-10-12
**Maintained By**: BJJ Graph Project
**Status**: Production Ready

---

## Quick Reference Summary

**V2 Key Changes:**
1. ✅ YAML frontmatter for all structured data
2. ✅ Removed inline JSON-LD blocks
3. ✅ Added LLM Context Block (6 subsections)
4. ✅ Schema.org auto-generation from steps
5. ✅ SEO metadata in frontmatter
6. ✅ Success modifiers in YAML
7. ✅ Physical requirements in YAML
8. ✅ Narrative/image/audio prompts for AI
9. ✅ Troubleshooting patterns for game engine
10. ✅ Complete validation checklist

**File Structure:**
```
---
[YAML Frontmatter]
---

# [Title]
[Markdown Content Sections 1-12]

## LLM Context Block
[YAML-formatted AI data]

[Supplementary Sections]
```

**Minimum Viable File:**
- Complete YAML frontmatter (20+ fields)
- 12 core markdown sections
- LLM Context Block with 6 subsections
- 5 supplementary sections
- Validation checklist complete

---

**End of Standard V2 Documentation**
