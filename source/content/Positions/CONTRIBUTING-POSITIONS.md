# Position Standard V2 for BJJ State Machine
#bjj #standard #positions #statemachine #v2

## Overview

This document defines the **Version 2** standard structure for all position files in the BJJ state machine. This version introduces:

- **Complete YAML frontmatter** with state machine data structures
- **Schema.org markup in frontmatter** (moved from inline JSON-LD)
- **LLM Context Block** for AI consumption and game engine decision-making
- **Streamlined content structure** with reduced redundancy
- **Enhanced machine-readability** while maintaining human educational value

Version 2 is backward-compatible with V1 content but provides significantly improved data structure for:
- AI/LLM processing and natural language generation
- Game engine state machine integration with probabilistic calculations
- Automated validation and testing pipelines
- Programmatic content generation and transformation
- SEO optimization with structured data
- Knowledge testing and assessment systems

---


<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Position Standard V2 for BJJ State Machine",
  "description": "This document defines the **Version 2** standard structure for all position files in the BJJ state machine. This version introduces:",
  "url": "https://bjjgraph.com/positions/contributing-positions",
  "isPartOf": {
    "@type": "WebSite",
    "name": "BJJ Graph",
    "url": "https://bjjgraph.com"
  }
}
</script>

## Key Improvements Over V1

### 1. Unified YAML Frontmatter
All structured data consolidated into frontmatter:
- State machine properties and metrics
- Offensive/defensive transitions with success rates
- Decision tree logic in machine-readable format
- State invariants and prerequisites
- SEO metadata (title, description, tags)
- Schema.org markup (HowTo, FAQ)
- LLM-optimized context blocks

### 2. Cleaner Markdown Content
- Removed redundant inline JSON-LD blocks
- Single source of truth for all data
- More readable and maintainable
- Focused on human educational content
- Clear section hierarchy

### 3. LLM-Optimized Context
New `llm_context` section provides:
- Decision patterns for game engine logic
- Knowledge questions for testing comprehension
- Success modifiers for probabilistic calculations
- Dilemma creation structures (Craig Jones philosophy)
- Narrative prompts for story generation
- Coaching cues for natural language interfaces

### 4. Enhanced State Machine Integration
- Complete transition data with IDs, energy costs, execution times
- Decision tree with priority ordering
- State invariants (physical, control, opponent limitations)
- Training considerations (prerequisites, optimal conditions, vulnerable moments)
- Success modifiers based on game state

### 5. Better SEO Integration
- Title and description templates in frontmatter
- Tags for categorization and filtering
- Schema.org HowTo with detailed steps
- FAQ schema for rich snippets
- All SEO elements centralized and easy to update

---

## Complete V2 Template Structure

### Full YAML Frontmatter Template

```yaml
---
# ============================================================================
# SEO METADATA
# ============================================================================
title: "Position Name | BJJ Position Guide | BJJ Graph"
description: "Master Position Name in BJJ. Complete guide covering [key aspects]. Success rates: Beginner X%, Intermediate Y%, Advanced Z%."
tags:
  - bjj
  - position
  - [category]        # guard/mount/side-control/back/turtle/etc
  - [subcategory]     # closed-guard/open-guard/top/bottom/etc
  - [level]           # fundamental/intermediate/advanced

# ============================================================================
# STATE MACHINE CORE DATA
# ============================================================================
state_machine:
  # Core Identifiers
  state_id: "S###"
  position_name: "Position Name"
  alternative_names:
    - "Alternative Name 1"
    - "Alternative Name 2"
    - "Alternative Name 3"

  # State Properties
  properties:
    point_value: 0-4              # IBJJF scoring: 0=neutral, 2=advantage, 3=pass, 4=mount/back
    position_type: "Offensive|Defensive|Neutral|Controlling"
    risk_level: "Low|Medium|High"
    energy_cost: "Low|Medium|High"
    time_sustainability: "Short|Medium|Long"

  # Success Probability Metrics
  metrics:
    position_retention:
      beginner: 60
      intermediate: 70
      advanced: 80
    advancement_probability:
      beginner: 40
      intermediate: 55
      advanced: 70
    submission_probability:
      beginner: 25
      intermediate: 35
      advanced: 50
    position_loss:
      beginner: 35
      intermediate: 25
      advanced: 15
    average_time_minutes: "2-3"

  # Offensive Transitions (Your Actions from This Position)
  transitions:
    offensive:
      - name: "Sweep Technique Name"
        target_state: "S###"
        target_position: "Target Position Name"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T###"
        category: "sweep"
        energy_cost: "Low|Medium|High"
        execution_time: "Instant|Quick|Medium|Slow"
        description: "Brief execution description"

      - name: "Submission Technique Name"
        target_state: "S###"
        target_position: "Submission Control Position"
        success_rate:
          beginner: 25
          intermediate: 40
          advanced: 55
        transition_id: "T###"
        category: "submission"
        energy_cost: "Medium|High"
        execution_time: "Medium|Slow"
        description: "Brief setup and execution"

      - name: "Escape Technique Name"
        target_state: "S###"
        target_position: "Neutral or Better Position"
        success_rate:
          beginner: 30
          intermediate: 45
          advanced: 60
        transition_id: "T###"
        category: "escape"
        energy_cost: "Medium|High"
        execution_time: "Quick|Medium"
        description: "Escape mechanism"

      - name: "Position Improvement"
        target_state: "S###"
        target_position: "Better Control Position"
        success_rate:
          beginner: 50
          intermediate: 65
          advanced: 80
        transition_id: "T###"
        category: "control"
        energy_cost: "Low|Medium"
        execution_time: "Quick|Medium"
        description: "How to improve position"

    # Defensive Responses (When Opponent Has This Position Against You)
    defensive:
      - name: "Counter Technique Name"
        target_state: "S###"
        target_position: "Counter Position Name"
        success_rate: 40
        counter_category: "posture|pressure|pass|escape"
        description: "How opponent counters or escapes"

      - name: "Defensive Maintenance"
        target_state: "S###"
        target_position: "Maintained Position"
        success_rate: 35
        counter_category: "control"
        description: "How opponent maintains against your attacks"

    # Counter Transitions (Responses to Opponent's Attempts)
    counters:
      - opponent_action: "Guard Pass Attempt"
        your_counter: "Re-guard"
        target_state: "S###"
        success_rate: 50
        description: "Counter when opponent tries to pass"

      - opponent_action: "Posture Break Resistance"
        your_counter: "Sweep Alternative"
        target_state: "S###"
        success_rate: 45
        description: "Alternative when main attack is defended"

  # Decision Tree Logic (Machine-Readable for Game Engine)
  decision_tree:
    - condition: "opponent establishes strong posture"
      priority: 1
      indicators:
        - "Upright spine"
        - "Wide base"
        - "Head above hips"
      actions:
        - technique: "Hip Bump Sweep"
          target_state: "S###"
          probability: 55
          reasoning: "High posture creates sweep opportunities"
        - technique: "Scissor Sweep"
          target_state: "S###"
          probability: 50
          reasoning: "Leverage-based sweep exploits rigid base"

    - condition: "opponent drives forward with pressure"
      priority: 2
      indicators:
        - "Head lowered"
        - "Forward pressure"
        - "Weight on you"
      actions:
        - technique: "Pendulum Sweep"
          target_state: "S###"
          probability: 45
          reasoning: "Forward momentum aids sweep"
        - technique: "Triangle Choke"
          target_state: "S###"
          probability: 40
          reasoning: "Broken posture enables submission"

    - condition: "opponent stands up"
      priority: 3
      indicators:
        - "Feet on mat"
        - "Creating distance"
        - "Hips elevated"
      actions:
        - technique: "Open Guard Transition"
          target_state: "S###"
          probability: 60
          reasoning: "Standing requires guard adaptation"

    - condition: "default - balanced opponent"
      priority: 4
      indicators:
        - "Neutral posture"
        - "No clear commitment"
        - "Balanced weight"
      actions:
        - technique: "Break Posture + Attack"
          target_state: "S###"
          probability: 40
          reasoning: "Create opening through posture break"
        - technique: "Alternative Attack"
          target_state: "S###"
          probability: 35
          reasoning: "Test defenses with different angle"

  # State Invariants (Conditions That Define This Position)
  invariants:
    physical:
      - "Specific body configuration 1"
      - "Specific body configuration 2"
      - "Anatomical requirement 3"
      - "Spatial relationship 4"

    control:
      - "Required grip or pressure 1"
      - "Required control point 2"
      - "Maintained connection 3"
      - "Control mechanism 4"

    opponent_limitations:
      - "What opponent cannot do 1"
      - "Restricted movement 2"
      - "Limited options 3"
      - "Defensive requirement 4"

  # Training Considerations
  training:
    prerequisites:
      positions:
        - "Required foundational position 1"
        - "Required foundational position 2"

      skills:
        - "Required physical skill 1"
        - "Required technical skill 2"
        - "Required mobility/strength attribute 3"

      concepts:
        - "Required conceptual understanding 1"
        - "Required tactical principle 2"
        - "Required strategic framework 3"

    optimal_conditions:
      - "When this position is most effective 1"
      - "Ideal setup scenario 2"
      - "Best timing consideration 3"

    vulnerable_moments:
      - "When position is at risk 1"
      - "Dangerous transition point 2"
      - "Common failure point 3"

    energy_fatigue_factors:
      - "Energy drain characteristic 1"
      - "Fatigue consideration 2"
      - "Sustainability factor 3"

  # Position Progressions and Relationships
  progressions:
    leads_to:
      - state_id: "S###"
        position: "Natural Next Position"
        relationship: "natural_progression|specialization|dominant_transition"
        description: "How this leads to next position"

      - state_id: "S###"
        position: "Alternative Progression"
        relationship: "variation|alternative"
        description: "Alternative path"

    related_positions:
      - state_id: "S###"
        position: "Related Position Name"
        relationship: "similar_defensive|similar_offensive|variation|counter"
        description: "Nature of relationship"

# ============================================================================
# SCHEMA.ORG STRUCTURED DATA (SEO Optimization)
# ============================================================================
schema_org:
  # HowTo Schema for Technical Content
  howto:
    type: "HowTo"
    name: "How to Use Position Name in BJJ"
    description: "Complete guide to executing techniques and transitions from Position Name."
    total_time: "PT5M"

    steps:
      - name: "Execute Primary Technique"
        text: "From this position, execute [Technique] to transition to [Target State]."
        position: 1
        image: ""  # Optional: path to technique image

      - name: "Execute Alternative Technique"
        text: "Alternatively, execute [Technique] to transition to [Target State]."
        position: 2

      - name: "Execute Submission Technique"
        text: "For submission, execute [Technique] to achieve [Result]."
        position: 3

      # Minimum 5 steps recommended, maximum 8 for readability

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  # FAQ Schema for Rich Snippets
  faq:
    - question: "What is a common mistake in [Position Name]?"
      answer: "[Consequence of error]. The correction is: [Specific fix with technical details]."
      category: "errors"

    - question: "When should I use [Technique A] vs [Technique B]?"
      answer: "[Decision-making guidance based on opponent reactions and position specifics]."
      category: "tactics"

    - question: "How do I prevent [Common Problem]?"
      answer: "[Preventive measures with specific technical instructions]."
      category: "defense"

    - question: "What are the key control points in [Position Name]?"
      answer: "[List of critical control points with explanation of importance]."
      category: "fundamentals"

    # Minimum 5 FAQ entries recommended

# ============================================================================
# LLM CONTEXT BLOCK (AI/Game Engine Optimization)
# ============================================================================
llm_context:
  # One-Sentence Summary for AI Context
  position_summary: "Concise single-sentence description of position's strategic role and key characteristics."

  # Key Success Factors (Prioritized)
  key_success_factors:
    - factor: "Primary Success Factor"
      importance: "critical|high|medium"
      description: "Why this factor is essential and how to maintain it"
      game_impact: "How this affects success rates in game engine"

    - factor: "Secondary Success Factor"
      importance: "critical|high|medium"
      description: "Detailed explanation"
      game_impact: "Mechanical impact"

    # Minimum 3, maximum 7 factors

  # Common Questions (Q&A Patterns for LLM/Chatbot)
  common_questions:
    - q: "When should I [strategic decision]?"
      a: "[Context-specific guidance with conditional logic]"
      context: "decision_making|tactical|technical|defensive|offensive"
      skill_level: "beginner|intermediate|advanced"

    - q: "How do I [specific technique or concept]?"
      a: "[Step-by-step guidance with key details]"
      context: "technical|execution"
      skill_level: "beginner|intermediate"

    - q: "What if [specific scenario]?"
      a: "[Adaptive response with multiple options]"
      context: "adaptation|problem_solving"
      skill_level: "intermediate|advanced"

    # Minimum 5 questions covering different contexts and skill levels

  # Coaching Cues (Natural Language for Instruction)
  coaching_cues:
    - "Short memorable instruction 1"
    - "Technical reminder 2"
    - "Strategic guidance 3"
    - "Safety cue 4"
    - "Motivational element 5"
    - "Common error prevention 6"
    - "Timing guidance 7"

    # 7-10 cues recommended

  # Training Focus by Skill Level
  training_focus:
    beginner:
      - "Fundamental skill 1 for beginners"
      - "Basic position maintenance"
      - "Simple high-percentage technique"
      - "Defensive basics"

    intermediate:
      - "Combination technique 1"
      - "Advanced control mechanism"
      - "Chaining attacks"
      - "Situational adaptation"

    advanced:
      - "System mastery component"
      - "Timing exploitation"
      - "Counter-counter strategies"
      - "Competition-specific refinements"

  # Game Engine Hints
  game_engine_hints:
    energy_cost_factors:
      - "Maintaining position: [Low/Medium/High] drain per turn"
      - "Active movements: [specific costs]"
      - "Attack attempts: [energy requirements]"

    position_strength: "One-sentence assessment of position's strategic value"

    opponent_pressure: "How much energy/stress opponent experiences in this position"

    ideal_scenarios:
      - "Scenario where this position excels 1"
      - "Opponent characteristic that favors this position 2"
      - "Game state condition that amplifies effectiveness 3"

    dilemma_creation:
      - "Dilemma type 1: Force opponent to choose between A and B"
      - "Dilemma type 2: Defending X opens Y"
      - "Dilemma type 3: Time pressure creates Z"

  # Success Modifiers (Probabilistic Adjustments for Game Engine)
  success_modifiers:
    - condition: "Strong control established"
      modifier: +10
      applies_to: "all_offensive_transitions|specific_category"
      description: "Why this increases success"

    - condition: "Opponent fatigued"
      modifier: +5
      applies_to: "all_transitions"
      description: "Fatigue reduces defensive effectiveness"

    - condition: "Knowledge test passed (80%+)"
      modifier: +10
      applies_to: "position_retention|advancement"
      description: "Understanding improves execution"

    - condition: "System mastery bonus"
      modifier: +10
      applies_to: "system_techniques"
      description: "Systematic approach increases coordination"

    - condition: "Position held >2 minutes"
      modifier: -5
      applies_to: "offensive_success"
      description: "Fatigue reduces offensive output"

    - condition: "Failed previous attempt"
      modifier: -5
      applies_to: "same_technique"
      description: "Opponent aware and prepared"

  # Dilemma Structures (Craig Jones Philosophy)
  dilemmas:
    - scenario: "Opponent defends [primary attack]"
      dilemma_created: "[Defensive action] creates vulnerability to [alternative attack]"
      offensive_options:
        - "[Alternative Attack 1] → [Result] (Success: X%)"
        - "[Alternative Attack 2] → [Result] (Success: Y%)"
      narrative: "As your opponent focuses on [defense], they expose [vulnerability]. This is the moment to [counter-action]."

    - scenario: "Opponent maintains [defensive strategy]"
      dilemma_created: "[Strategy] requires [cost or limitation] which opens [opportunity]"
      offensive_options:
        - "[Exploit 1] → [Result] (Success: X%)"
        - "[Exploit 2] → [Result] (Success: Y%)"
      narrative: "Your opponent's [defensive strategy] works, but at a cost. Their [limitation] creates [opportunity]."

    # Minimum 3 dilemmas showing attack chains

  # Narrative Generation Prompts
  narrative_prompts:
    entry: "Narrative for entering this position - sets the scene"
    control: "Narrative for maintaining control - describes the feeling and dynamics"
    attack_initiation: "Narrative for beginning an attack - builds tension"
    success: "Narrative for successful technique - payoff and transition"
    failure: "Narrative for failed technique - setback but learning"
    position_loss: "Narrative for losing position - defensive challenge"

    # Optional: context-specific narratives
    sweep_setup: "Specific narrative for sweep attempts"
    submission_setup: "Specific narrative for submission attacks"
    escape_attempt: "Specific narrative for escape efforts"
    defensive_hold: "Specific narrative for defending against attacks"

  # Knowledge Assessment Questions
  knowledge_questions:
    - question: "What are the [number] critical elements of [position/technique]?"
      answer: "[Detailed answer with specific elements]"
      difficulty: "beginner|intermediate|advanced"
      category: "fundamentals|tactics|systems|technical_details"
      points: 10

    - question: "When [specific condition], which technique has highest success?"
      answer: "[Technique] because [reasoning with mechanical explanation]"
      difficulty: "intermediate|advanced"
      category: "decision_making|tactics"
      points: 15

    - question: "How does [concept] integrate with [position/system]?"
      answer: "[Systematic explanation showing connections]"
      difficulty: "advanced"
      category: "systems|integration"
      points: 20

    # Minimum 5 questions, mix of difficulties and categories

---
```

---

## Markdown Content Structure

After the YAML frontmatter, include these sections in order:

### 1. Position Header
```markdown
# Position Name
#bjj #state #[category] #[subcategory] #[level]
```

### 2. State Description
```markdown
## State Description

[First paragraph: Overview of position's strategic role, point value context, and primary characteristics. 3-4 sentences.]

[Second paragraph: Detailed description of what defines this position, key control mechanisms, and general tactical considerations. 3-4 sentences.]

[Third paragraph: Advantages, disadvantages, and when this position is most/least effective. 2-3 sentences.]
```

### 3. Visual Description
```markdown
## Visual Description

[Comprehensive 4-8 sentence description covering:]

You are [specific body position with anatomical references - head, torso, arms, legs, hips]. Your opponent [specific body position and spatial relationship to you]. [Key pressure points and weight distribution - where pressure is applied and how weight is managed]. [Spatial relationships and angles - geometric configuration and positioning]. [Control mechanisms - grips, hooks, pressure, frames]. [Movement capabilities and restrictions - what you can/cannot do].

[Optional second paragraph for complex positions: Additional details about variations, adjustments, or specific scenarios within this position.]

This creates [strategic advantages explained] while [defensive security or offensive opportunities described].
```

### 4. Key Principles
```markdown
## Key Principles

- **Biomechanical Principle 1**: Explanation of leverage or mechanical advantage
- **Control Priority 2**: Critical control points and why they matter
- **Tactical Consideration 3**: Strategic approach to offense or defense
- **Technical Focus 4**: Specific technique or concept emphasis
- **Risk Management 5**: How to maintain safety and minimize vulnerabilities
- **Energy Management 6**: How to use energy efficiently in this position

[5-7 principles with bold headings and explanations]
```

### 5. Offensive Transitions
```markdown
## Offensive Transitions

From this position, you can execute:

### Sweeps
- [[Technique Name]] → [[Target Position]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)
  - Brief 1-2 sentence description of setup and execution mechanics

- [[Technique Name 2]] → [[Target Position]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)
  - Explanation of when to use and how to execute

### Submissions
- [[Submission Name]] → [[Control Position]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)
  - Setup requirements and execution path

- [[Submission Name 2]] → [[Control Position]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)
  - Key details and timing considerations

### Position Improvements
- [[Advancement Technique]] → [[Better Position]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)
  - How to improve position control or points

### Escapes (if applicable)
- [[Escape Technique]] → [[Neutral/Better Position]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)
  - Escape mechanism and timing

[Organize by category, minimum 6 total transitions]
```

### 6. Defensive Responses
```markdown
## Defensive Responses

When opponent has this position against you, available counters:

- [[Counter Technique 1]] → [[Resulting State]] (Success Rate: X%)
  - Explanation of counter mechanism and when to apply

- [[Counter Technique 2]] → [[Resulting State]] (Success Rate: Y%)
  - Counter details and requirements

- [[Defensive Maintenance]] → [[Maintained Position]] (Success Rate: Z%)
  - How to hold position against opponent's attacks

[Minimum 4 defensive responses with descriptions]
```

### 7. Decision Tree
```markdown
## Decision Tree

**If** opponent establishes strong posture:
- Execute [[Technique A]] → [[State X]] (Probability: X%)
  - Reasoning: Why this works against this condition
- Or Execute [[Technique B]] → [[State Y]] (Probability: Y%)
  - Reasoning: Alternative approach

**Else if** opponent drives forward with pressure:
- Execute [[Technique C]] → [[State Z]] (Probability: Z%)
  - Reasoning: How to exploit forward pressure
- Or Execute [[Technique D]] → [[State W]] (Probability: W%)
  - Reasoning: Alternative exploitation

**Else if** opponent stands up:
- Transition to [[Guard Type]] → [[State V]] (Probability: V%)
  - Reasoning: Adaptation to standing

**Else** (balanced opponent / default):
- Break posture and initiate [[Technique E]] → [[State Q]] (Probability: Q%)
  - Reasoning: Creating opportunity from neutral
- Or Execute [[Technique F]] → [[State R]] (Probability: R%)
  - Reasoning: Testing defenses

[Minimum 3 conditions with actions and reasoning]
```

### 8. Expert Insights
```markdown
## Expert Insights

**John Danaher**: [2-3 sentences on systematic, mechanical, and theoretical approach to this position. Focus on principles, efficiency, and systematic attack/defense hierarchies. Emphasize "why" over "what".]

**Gordon Ryan**: [2-3 sentences on competition-focused, high-percentage techniques and practical application. Focus on what works in live rolling and competition, winning strategies, and modern meta-game considerations.]

**Eddie Bravo**: [2-3 sentences on innovative approaches, 10th Planet methodology, unorthodox variations, and creative applications. Focus on unique angles, rubber guard connections, and thinking outside traditional frameworks.]

[Each expert insight should be distinct in perspective and approach]
```

### 9. Common Errors
```markdown
## Common Errors

### Error: [Error Name or Description]
- **Consequence**: [What goes wrong, why it's problematic, specific risks or losses]
- **Correction**: [Specific fix with technical details and execution guidance]
- **Recognition**: [How to identify when you're making this mistake]

### Error: [Second Error]
- **Consequence**: [Impact on position, technique, or safety]
- **Correction**: [Detailed correction with actionable steps]
- **Recognition**: [Identification cues from feeling or feedback]

### Error: [Third Error]
- **Consequence**: [Mechanical or tactical consequence]
- **Correction**: [Technical solution]
- **Recognition**: [How to catch yourself]

[Minimum 5 errors, preferably 7-10. Cover fundamentals, tactics, and safety]
```

### 10. Training Drills
```markdown
## Training Drills

### Drill 1: [Drill Name - Focus Area]
[Detailed description 3-5 sentences covering: setup, execution, progression levels (0%, 25%, 50%, 75%, 100% resistance), focus points, common mistakes in drill, sets/reps/duration recommendations]

### Drill 2: [Drill Name - Different Focus]
[Description with progressive resistance approach, specific technical focuses, partner instructions, success metrics]

### Drill 3: [Drill Name - Third Aspect]
[Flow drill or scenario-based practice description, situational setups, adaptation requirements, skill development goals]

### Drill 4: [Optional - Solo Drill or Conditioning]
[If applicable: solo movements, conditioning work, mobility development specific to this position]

[Minimum 3 drills covering: retention, offense, transitions. 5 drills ideal.]
```

### 11. Related Positions
```markdown
## Related Positions

- [[Position 1]] - [Relationship description: how it connects, when to transition, strategic similarity]
- [[Position 2]] - [Relationship: progression path, variation type, tactical alternative]
- [[Position 3]] - [Relationship: counter-position, defensive option, complementary position]
- [[Position 4]] - [Relationship: advanced variation, system connection]
- [[Position 5]] - [Relationship: common transition target]

[Minimum 3, ideally 5-7 related positions with clear relationships]
```

### 12. Optimal Submission Paths
```markdown
## Optimal Submission Paths

**Fastest path to submission** (direct attack):
[[Current Position]] → [[Submission Technique]] → [[Won by Submission]]
*Reasoning: [Why this is fastest, when it's available, success rate considerations]*

**High-percentage path** (systematic):
[[Current Position]] → [[Setup/Control Enhancement]] → [[Submission Technique]] → [[Control Position]] → [[Won by Submission]]
*Reasoning: [Why this has better success rates, what makes it reliable, trade-offs]*

**Alternative submission path** (variation):
[[Current Position]] → [[Alternative Setup]] → [[Different Submission]] → [[Control Position]] → [[Won by Submission]]
*Reasoning: [When to use this alternative, advantages, specific scenarios]*

**Sweep to dominance path** (positional):
[[Current Position]] → [[Sweep Technique]] → [[Dominant Position]] → [[Submission Chain]] → [[Won by Submission]]
*Reasoning: [Positional progression benefits, why sweep first, dominance advantages]*

**System-based path** (Danaher/expert approach):
[[Current Position]] → [[System Entry]] → [[Systematic Progression]] → [[Submission Control]] → [[Won by Submission]]
*Reasoning: [How expert system applies, systematic advantages, learning progression]*

[Minimum 3 paths, ideally 4-5 showing different strategic approaches]
```

### 13. Timing Considerations (Optional but Recommended)
```markdown
## Timing Considerations

**Best Times to Enter**:
- [Specific setup scenario 1 with timing details]
- [Specific setup scenario 2 with opponent state]
- [Transitional opportunity 3 with recognition cues]

**Best Times to Attack**:
- [Offensive timing 1 with indicators]
- [Offensive timing 2 with opponent positioning]
- [Moment of vulnerability 3 with exploitation method]

**Vulnerable Moments**:
- [Risk moment 1 with defensive response]
- [Risk moment 2 with adaptation strategy]
- [Danger point 3 with preventive measures]

**Fatigue Factors**:
- [Energy consideration 1 with management strategy]
- [Endurance factor 2 with pacing guidance]
- [Stamina element 3 with tactical adaptation]
```

### 14. Competition Considerations (Optional but Recommended)
```markdown
## Competition Considerations

**Point Scoring**: [How this position scores in IBJJF, ADCC, and other major rule sets. Point values, advantages, penalties to consider.]

**Time Management**: [Strategic use relative to match time, when to hold vs. attack, pacing considerations]

**Rule Set Adaptations**: [Differences in gi vs. no-gi, submission-only vs. points, IBJJF vs. ADCC specific tactics]

**Competition Strategy**: [When to use this position in competition context, risk-reward analysis, tournament-specific considerations]
```

### 15. Historical Context (Optional)
```markdown
## Historical Context

[2-4 sentences on the position's evolution in BJJ, key innovators who developed or refined it, modern developments or meta-game changes, cultural significance within BJJ community]
```

### 16. Coaching Cues Summary (Optional)
```markdown
## Coaching Cues

- "Short memorable instruction 1"
- "Technical reminder 2"
- "Strategic guidance 3"
- "Safety cue 4"
- "Motivational element 5"
- "Common error prevention 6"
- "Timing guidance 7"

[7-10 actionable coaching phrases]
```

---

## Complete Working Example

See separate file: `/source/content/Positions/000.STANDARD-V2-EXAMPLE.md`

**Key features of example**:
- Complete YAML frontmatter with all sections
- All offensive transitions with success rates
- Complete decision tree with reasoning
- LLM context with questions and modifiers
- Full markdown content following standard
- Proper wikilink formatting throughout
- Expert insights from all three perspectives
- Comprehensive common errors section
- Detailed training drills
- Multiple optimal paths

---

## Validation Checklist

### YAML Frontmatter Validation

- [ ] **SEO Metadata Complete**
  - [ ] Title follows template format
  - [ ] Description is 150-160 characters
  - [ ] Description includes success rates
  - [ ] Tags include category, subcategory, level

- [ ] **State Machine Core Data**
  - [ ] State ID in correct format (S###)
  - [ ] State ID is unique across all positions
  - [ ] All 5 properties specified with valid values
  - [ ] All 4 metrics have beginner/intermediate/advanced values
  - [ ] Average time specified

- [ ] **Transitions Data**
  - [ ] Minimum 6 offensive transitions
  - [ ] Each offensive transition has success rates for all skill levels
  - [ ] Each transition has category, energy cost, execution time
  - [ ] Target state IDs are valid
  - [ ] Minimum 4 defensive responses
  - [ ] Minimum 2 counter transitions

- [ ] **Decision Tree**
  - [ ] Minimum 3 conditions with priority ordering
  - [ ] Each condition has indicators
  - [ ] Each action has probability and reasoning
  - [ ] Covers major opponent scenarios

- [ ] **State Invariants**
  - [ ] Physical invariants specified (3+)
  - [ ] Control invariants specified (3+)
  - [ ] Opponent limitations specified (3+)

- [ ] **Training Considerations**
  - [ ] Prerequisites listed for positions, skills, concepts
  - [ ] Optimal conditions specified
  - [ ] Vulnerable moments identified
  - [ ] Energy/fatigue factors documented

- [ ] **Progressions**
  - [ ] Leads_to section with minimum 2 positions
  - [ ] Related_positions section with minimum 3 positions
  - [ ] Relationships are meaningful and accurate

- [ ] **Schema.org Data**
  - [ ] HowTo section complete with minimum 5 steps
  - [ ] Tools listed
  - [ ] FAQ section with minimum 5 questions
  - [ ] Questions cover different categories

- [ ] **LLM Context**
  - [ ] Position summary is concise and accurate
  - [ ] Minimum 3 key success factors with importance levels
  - [ ] Minimum 5 common questions with contexts
  - [ ] Minimum 7 coaching cues
  - [ ] Training focus for all 3 skill levels
  - [ ] Game engine hints section complete
  - [ ] Minimum 5 success modifiers
  - [ ] Minimum 3 dilemma structures
  - [ ] Narrative prompts for key moments
  - [ ] Minimum 5 knowledge questions with difficulty levels

### Markdown Content Validation

- [ ] **Header and Tags**
  - [ ] H1 header matches position name
  - [ ] Tags include category and relevant descriptors

- [ ] **State Description**
  - [ ] 2-3 paragraphs covering strategic role, characteristics, advantages/disadvantages

- [ ] **Visual Description**
  - [ ] 4-8 sentences with anatomical detail
  - [ ] Covers body positioning, pressure points, spatial relationships
  - [ ] Creates clear mental image

- [ ] **Key Principles**
  - [ ] 5-7 principles with bold labels
  - [ ] Mix of biomechanical, tactical, strategic principles

- [ ] **Offensive Transitions**
  - [ ] Organized by category (sweeps, submissions, etc.)
  - [ ] Each includes brief description
  - [ ] All use proper wikilink syntax
  - [ ] Success rates shown for all skill levels

- [ ] **Defensive Responses**
  - [ ] Minimum 4 responses
  - [ ] Each has description and success rate

- [ ] **Decision Tree**
  - [ ] Minimum 3 conditions with if/else structure
  - [ ] Includes reasoning for each action
  - [ ] Probabilities specified

- [ ] **Expert Insights**
  - [ ] All three experts included (Danaher, Gordon Ryan, Eddie Bravo)
  - [ ] Each insight is 2-3 sentences
  - [ ] Distinct perspectives from each expert

- [ ] **Common Errors**
  - [ ] Minimum 5 errors (ideally 7-10)
  - [ ] Each has Consequence, Correction, Recognition
  - [ ] Mix of fundamental, tactical, safety errors

- [ ] **Training Drills**
  - [ ] Minimum 3 drills (ideally 5)
  - [ ] Each 3-5 sentences with progressive resistance
  - [ ] Cover different aspects: retention, offense, transitions

- [ ] **Related Positions**
  - [ ] Minimum 3 positions (ideally 5-7)
  - [ ] Each has relationship description
  - [ ] All wikilinks valid

- [ ] **Optimal Submission Paths**
  - [ ] Minimum 3 paths (ideally 4-5)
  - [ ] Each path has reasoning
  - [ ] Paths show different strategic approaches

### Cross-Reference Validation

- [ ] All wikilinks use [[Double Bracket]] syntax
- [ ] All referenced positions exist in content directory
- [ ] All referenced transitions exist in content directory
- [ ] State IDs referenced in transitions match actual positions
- [ ] Transition IDs are unique and follow T### format
- [ ] No broken links or circular references

### Data Consistency Validation

- [ ] Success rates increase beginner < intermediate < advanced
- [ ] Energy costs align with complexity (high complexity usually = higher cost)
- [ ] Execution times align with technique type
- [ ] Point values follow IBJJF standards correctly
- [ ] Risk levels align with position vulnerability
- [ ] Time sustainability aligns with energy cost

### Quality Validation

- [ ] No spelling errors in content
- [ ] No grammar errors in content
- [ ] Technical terminology is accurate
- [ ] All expert insights sound authentic to their teaching style
- [ ] Common errors are actually common and not obscure
- [ ] Training drills are practical and implementable
- [ ] Descriptions are clear and unambiguous

---

## Migration Guide: V1 to V2

### Overview
This guide helps convert existing V1 position files to V2 standard.

### Step 1: Backup and Prepare
```bash
# Backup original file
cp "Position Name.md" "Position Name.v1.backup.md"

# Create new V2 file
touch "Position Name.md"
```

### Step 2: Extract and Transform Data

#### From Inline JSON-LD to YAML Schema.org
**V1 Format (remove):**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Position in BJJ",
  ...
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
      "name": "Positions",
      "item": "https://bjjgraph.com/positions/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Position Name",
      "item": "https://bjjgraph.com/positions/contributing-positions"
    }
  ]
}
</script>


```

**V2 Format (add to frontmatter):**
```yaml
schema_org:
  howto:
    type: "HowTo"
    name: "How to Use Position in BJJ"
    ...
```

#### From Markdown Sections to YAML State Machine
**V1 Format (in markdown):**
```markdown
## State Properties
- **State ID**: S002
- **Point Value**: 0
- **Position Type**: Defensive
```

**V2 Format (in frontmatter):**
```yaml
state_machine:
  state_id: "S002"
  properties:
    point_value: 0
    position_type: "Defensive"
```

#### From Prose to Structured Transitions
**V1 Format:**
```markdown
- [[Hip Bump Sweep]] → [[Mount]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
```

**V2 Format:**
```yaml
transitions:
  offensive:
    - name: "Hip Bump Sweep"
      target_state: "S001"
      target_position: "Mount"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70
      transition_id: "T###"
      category: "sweep"
```

### Step 3: Add New V2 Elements

#### Add LLM Context Block
```yaml
llm_context:
  position_summary: "[Write concise summary]"
  key_success_factors:
    - factor: "[Extract from Key Principles section]"
      importance: "critical"
      description: "[Expand with details]"
  common_questions:
    - q: "[Create from content]"
      a: "[Extract from text]"
      context: "tactical"
  # ... continue for all LLM context elements
```

#### Add Decision Tree with Indicators
```yaml
decision_tree:
  - condition: "[Extract from Decision Tree section]"
    priority: 1
    indicators:
      - "[Add observable cues]"
      - "[Add physical indicators]"
    actions:
      - technique: "[From transitions]"
        target_state: "[Add state ID]"
        probability: [from existing]
        reasoning: "[Add why this works]"
```

#### Add Success Modifiers
```yaml
success_modifiers:
  - condition: "[Infer from content]"
    modifier: +10
    applies_to: "all_offensive_transitions"
    description: "[Explain impact]"
  # Create 5-8 modifiers based on content
```

#### Add Dilemma Structures
```yaml
dilemmas:
  - scenario: "[Create from transitions]"
    dilemma_created: "[Describe the choice opponent faces]"
    offensive_options:
      - "[Attack option 1 with success]"
      - "[Attack option 2 with success]"
    narrative: "[Write engaging description]"
```

### Step 4: Enhance Markdown Content

#### Expand Expert Insights
**V1:** May be short or missing
**V2:** Each expert gets 2-3 sentences with specific perspective

#### Add Recognition to Common Errors
**V1:**
```markdown
### Error: Flat position
- **Consequence**: Easy to defend
- **Correction**: Create angles
```

**V2:**
```markdown
### Error: Keeping flat, square position
- **Consequence**: Makes it easy for opponent to maintain posture, reducing your ability to initiate effective attacks or sweeps. Opponent can distribute weight evenly and defend all attacks from stable position.
- **Correction**: Shift your hips to create angles, using off-balancing techniques to disrupt opponent's posture and open attack opportunities. Constantly move and create asymmetry.
- **Recognition**: If you feel like you're just "holding" without threatening anything, or opponent feels stable, you're likely too flat.
```

#### Expand Training Drills
**V1:** May be brief
**V2:** Each drill 3-5 sentences with progressive resistance, focus points, sets/reps

### Step 5: Validate and Test

1. **YAML Syntax Validation**
   ```bash
   # Use YAML validator
   yamllint "Position Name.md"
   ```

2. **Build Site Locally**
   ```bash
   cd source
   npx quartz build
   ```

3. **Check Links**
   - Verify all wikilinks resolve
   - Check state IDs match actual files
   - Validate transition IDs

4. **Run Through Checklist**
   - Use validation checklist above
   - Ensure all required fields present
   - Verify data consistency

### Step 6: Final Review

- Compare V1 and V2 side-by-side
- Ensure no content loss
- Verify all enhancements added
- Test in game engine (if applicable)
- Preview in site build

### Common Migration Issues

**Issue 1: Missing Transition IDs**
- **Solution**: Create new IDs following T### format, check existing transitions to avoid conflicts

**Issue 2: Success Rates Only for One Skill Level**
- **Solution**: Extrapolate based on pattern (Intermediate ≈ Beginner +10-15%, Advanced ≈ Intermediate +10-15%)

**Issue 3: No State IDs in Transitions**
- **Solution**: Look up target position files, extract their state IDs, add to transitions

**Issue 4: Incomplete Decision Tree**
- **Solution**: Analyze transitions, create conditions based on "when to use" information

**Issue 5: No LLM Context Equivalent**
- **Solution**: Create from scratch based on technical content, expert insights, common errors

### Automated Migration Script

A Python script for automated V1 to V2 conversion:

```python
# scripts/migrate_v1_to_v2.py
# (Placeholder - full implementation would parse V1 markdown,
#  extract data, transform to V2 YAML structure,
#  generate enhanced content sections)
```

---

## Benefits of Standard V2

### For Developers
- **Single Source of Truth**: All data in structured YAML frontmatter
- **Easy Parsing**: YAML is machine-readable and widely supported
- **Cleaner Code**: No need to parse inline JSON-LD or markdown tables
- **Type Safety**: Can generate TypeScript types from YAML schema
- **Validation**: Can validate against JSON Schema
- **API Generation**: Can auto-generate API endpoints from data

### For Content Creators
- **Clear Template**: Know exactly what's required
- **Consistent Structure**: Every file follows same pattern
- **Examples Provided**: Can copy/paste from working example
- **Validation Checklist**: Prevents missing required fields
- **Documentation**: Every field explained with purpose
- **Less Redundancy**: Write data once, use everywhere

### For SEO
- **Centralized Metadata**: Title, description, tags in one place
- **Schema.org Automation**: Structured data easier to maintain and update
- **FAQ Optimization**: FAQ schema for rich snippets
- **Keyword Consistency**: Templates ensure proper keyword usage
- **Easy Updates**: Change metadata without touching content
- **Validation**: Can check SEO requirements programmatically

### For AI/LLM Integration
- **Optimized Context**: LLM context block designed for AI consumption
- **Q&A Patterns**: Common questions ready for chatbot use
- **Decision Logic**: Machine-readable decision trees
- **Natural Language**: Coaching cues and narratives for generation
- **Knowledge Assessment**: Built-in testing questions
- **Skill Levels**: Content appropriate for different users

### For Game Engine
- **Complete State Data**: All state machine properties in one place
- **Probabilistic Data**: Success rates, modifiers, conditions
- **Energy System**: Cost and fatigue factors for simulation
- **Dilemma Creation**: Structured attack chains and opponent choices
- **Narrative Generation**: Prompts for story creation
- **Balance Data**: Easy to adjust success rates for gameplay balance

### For Users
- **Consistent Experience**: Every position page has same structure
- **Progressive Learning**: Content organized by skill level
- **Multiple Perspectives**: Expert insights from different authorities
- **Practical Training**: Drills with progressive resistance
- **Clear Paths**: Optimal submission paths with reasoning
- **Error Prevention**: Common errors with recognition cues

---

## Implementation Notes

### YAML Best Practices

1. **Use Quotes for Strings**: Especially if they contain special characters or start with numbers
   ```yaml
   description: "Master Position Name..."  # Quoted
   state_id: "S002"  # Quoted for consistency
   ```

2. **Consistent Indentation**: Use 2 spaces, no tabs
   ```yaml
   state_machine:
     properties:  # 2 spaces
       point_value: 0  # 4 spaces
   ```

3. **Arrays with Hyphens**: Use consistent array syntax
   ```yaml
   alternative_names:
     - "Name 1"
     - "Name 2"
   ```

4. **Multiline Strings**: Use `|` for preserved newlines, `>` for folded
   ```yaml
   description: |
     First paragraph

     Second paragraph
   ```

### Wikilink Standards

1. **Double Brackets**: Always use `[[Position Name]]`
2. **Exact Matching**: Must match target file title exactly
3. **No File Extensions**: Don't include `.md`
4. **Case Sensitive**: Match case of target file
5. **Spaces OK**: `[[Closed Guard Bottom]]` works fine

### State ID Management

1. **Format**: Always `S###` with zero-padding (S001, S002, not S1, S2)
2. **Uniqueness**: Check existing IDs before assigning
3. **Registry**: Maintain central list of all assigned IDs
4. **Sequential**: Assign sequentially within categories when possible
5. **Documentation**: Document ID ranges for different position types

### Transition ID Management

1. **Format**: Always `T###` with zero-padding
2. **Uniqueness**: Must be unique across all transitions
3. **Linking**: Should reference actual transition file
4. **Consistency**: If transition file exists, use its ID
5. **Categories**: Consider organizing IDs by category (T001-T099 sweeps, T100-T199 submissions, etc.)

### Success Rate Guidelines

**Beginner (White Belt)**:
- Defensive positions: 20-40% retention
- Offensive techniques: 20-40% success
- Escapes: 15-35% success

**Intermediate (Blue/Purple Belt)**:
- Defensive positions: 40-65% retention
- Offensive techniques: 40-65% success
- Escapes: 30-50% success

**Advanced (Brown/Black Belt)**:
- Defensive positions: 60-85% retention
- Offensive techniques: 60-90% success
- Escapes: 50-75% success

**Calibration**: Success rates should make sense in aggregate. If Position A → B is 70% and B → C is 60%, then A → C should be approximately 42% (70% × 60%).

### LLM Context Optimization

1. **Conciseness**: Keep prompts concise but informative
2. **Specificity**: Use specific technical terms
3. **Context Tags**: Use context tags for filtering
4. **Skill Levels**: Tag questions with appropriate levels
5. **Natural Language**: Write narratives in engaging style
6. **Modifiers**: Keep modifiers balanced (-10 to +15 range typical)

### Schema.org Guidelines

1. **HowTo Steps**: 5-8 steps optimal for readability
2. **FAQ Questions**: 5-10 questions covering different categories
3. **Tools**: Keep standard tools consistent across files
4. **Time Estimates**: Use ISO 8601 duration format (PT5M = 5 minutes)
5. **Validation**: Validate against official Schema.org documentation

---

## Troubleshooting

### Common Errors and Solutions

**Error: "YAML parse error: bad indentation"**
- **Cause**: Mixed spaces and tabs, or wrong indentation depth
- **Solution**: Use 2 spaces consistently, no tabs, check parent-child relationships

**Error: "State ID S## already exists"**
- **Cause**: Duplicate state ID assigned
- **Solution**: Check state ID registry, assign next available ID

**Error: "Wikilink [[Position]] does not resolve"**
- **Cause**: Target file doesn't exist or name mismatch
- **Solution**: Check exact spelling and case, create target file if missing

**Error: "Success rate not found for [skill level]"**
- **Cause**: Missing beginner, intermediate, or advanced success rate
- **Solution**: Add all three skill levels to every offensive transition

**Error: "Invalid YAML: unexpected character"**
- **Cause**: Special character in unquoted string
- **Solution**: Quote strings containing `:`, `#`, `[]`, `{}`, `|`, `>`, etc.

**Error: "Schema.org validation failed"**
- **Cause**: Missing required fields in HowTo or FAQ schema
- **Solution**: Ensure all required fields present: name, description, steps for HowTo; question, answer for FAQ

---

## Version History

**Version 2.0** (October 2025)
- Complete YAML frontmatter with unified structure
- Schema.org moved from inline to frontmatter
- LLM Context Block added for AI integration
- Enhanced metadata with transition IDs, energy costs, execution times
- Decision patterns and knowledge questions for game engine
- Success modifiers for probabilistic calculations
- Dilemma creation structures (Craig Jones philosophy)
- Narrative generation prompts
- Comprehensive validation checklist
- Migration guide from V1

**Version 1.0** (2024)
- Basic YAML with title and description only
- Inline Schema.org JSON-LD blocks
- State machine data in markdown sections
- Manual parsing required for data extraction
- See `/source/content/Positions/000.STANDARD.md` for V1 specification

---

## Future Enhancements

**Planned for V2.1**:
- Video link integration in frontmatter
- Image paths for technique visualization
- Technique difficulty ratings (1-10 scale)
- Belt rank requirements
- Competition statistics (usage rates, success rates from tournaments)

**Planned for V3.0**:
- JSON Schema definitions for programmatic validation
- Automated content generation from YAML
- Multi-language support
- Integration with external databases (BJJ Fanatics, Digitsu, etc.)
- User-contributed variations and notes

---

## Support and Contribution

### Questions
1. Check this documentation first (comprehensive reference)
2. Review complete working example (practical implementation)
3. Examine existing V2 position files (real-world usage)
4. Validate YAML with online validator (syntax checking)

### Reporting Issues
- Validation problems with specific examples
- Schema enhancements with use cases
- Missing data fields with justification
- New LLM context patterns with implementation

### Contributing
- Follow V2 standard exactly
- Validate before submitting (use checklist)
- Test in game engine and site build
- Document any deviations with reasoning
- Update this standard if structure evolves

### Maintainers
- Update this standard when data structures change
- Maintain backward compatibility when possible
- Version breaking changes appropriately (2.x vs 3.x)
- Keep example files synchronized with standard
- Document all changes in version history

---

## Related Documentation

**BJJ Graph Documentation**:
- [[000.STANDARD]] - Position Standard V1 (legacy reference)
- [[CONTRIBUTING-YAML-SCHEMA]] - Complete YAML schema documentation
- [[Transitions/000.STANDARD]] - Transition standard template
- [[Transitions/000.STANDARD-V2]] - Transition Standard V2 (when created)
- [[Submissions/000.STANDARD]] - Submission standard template

**External Resources**:
- [Quartz Documentation](https://quartz.jzhao.xyz/) - Static site generator
- [Schema.org HowTo](https://schema.org/HowTo) - Structured data reference
- [Schema.org FAQ](https://schema.org/FAQPage) - FAQ structured data
- [YAML Specification](https://yaml.org/spec/1.2/) - YAML 1.2 syntax reference
- [Markdown Guide](https://www.markdownguide.org/) - Markdown syntax
- [JSON Schema](https://json-schema.org/) - Schema validation

**Project Files**:
- `/todo/structure.md` - Game engine architecture
- `/todo/seo.md` - SEO strategy and implementation
- `/bjjgraph-game/concepts/PLAN-2-bjjgraph-game.md` - Game implementation plan

---

## Appendix A: YAML Field Reference

### Complete Field Listing

**Root Level**:
- `title` (string, required)
- `description` (string, required)
- `tags` (array, required)
- `state_machine` (object, required)
- `schema_org` (object, required)
- `llm_context` (object, required)

**state_machine Object**:
- `state_id` (string, required, format: S###)
- `position_name` (string, required)
- `alternative_names` (array, required)
- `properties` (object, required)
- `metrics` (object, required)
- `transitions` (object, required)
- `decision_tree` (array, required)
- `invariants` (object, required)
- `training` (object, required)
- `progressions` (object, required)

**properties Object**:
- `point_value` (integer, required, 0-4)
- `position_type` (string, required, enum)
- `risk_level` (string, required, enum)
- `energy_cost` (string, required, enum)
- `time_sustainability` (string, required, enum)

**metrics Object**:
- `position_retention` (object with beginner/intermediate/advanced, required)
- `advancement_probability` (object with beginner/intermediate/advanced, required)
- `submission_probability` (object with beginner/intermediate/advanced, required)
- `position_loss` (object with beginner/intermediate/advanced, required)
- `average_time_minutes` (string, required)

[Continue for all objects...]

---

## Appendix B: Validation JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BJJ Position V2 Schema",
  "type": "object",
  "required": ["title", "description", "tags", "state_machine", "schema_org", "llm_context"],
  "properties": {
    "title": {
      "type": "string",
      "pattern": "^.+ \\| BJJ Position Guide \\| BJJ Graph$"
    },
    "description": {
      "type": "string",
      "minLength": 150,
      "maxLength": 160
    },
    "tags": {
      "type": "array",
      "minItems": 3,
      "items": {"type": "string"}
    },
    "state_machine": {
      "type": "object",
      "required": ["state_id", "position_name", "properties", "metrics", "transitions", "decision_tree"],
      "properties": {
        "state_id": {
          "type": "string",
          "pattern": "^S[0-9]{3}$"
        },
        "properties": {
          "type": "object",
          "required": ["point_value", "position_type", "risk_level", "energy_cost", "time_sustainability"],
          "properties": {
            "point_value": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4
            }
          }
        }
      }
    }
  }
}
```

---

## SEO Optimization for Position Pages

Position pages are the foundation of BJJ Graph's organic search strategy. As state nodes in the knowledge graph, they serve dual purposes: educating human practitioners and providing structured data for AI/LLM consumption. Proper SEO optimization ensures these pages rank for competitive BJJ keywords while maintaining technical accuracy and educational value.

### Title Format and Examples

Every position page title follows this exact template:

**Template**: `"[Position Name] | BJJ Position Guide | BJJ Graph"`

**Good Examples**:
- `"Closed Guard Bottom | BJJ Position Guide | BJJ Graph"` - Clear, concise, includes target keyword
- `"Mount | BJJ Position Guide | BJJ Graph"` - Simple position, properly branded
- `"De La Riva Guard | BJJ Position Guide | BJJ Graph"` - Multi-word position, correctly formatted
- `"50-50 Guard Bottom | BJJ Position Guide | BJJ Graph"` - Numeric position, hyphenated correctly

**Bad Examples**:
- `"Closed Guard Bottom"` - Missing branding and category
- `"BJJ Closed Guard | Position"` - Incorrect structure, keywords in wrong order
- `"How to Use Closed Guard in BJJ"` - Question format inappropriate for position pages
- `"Closed Guard Bottom Position | BJJ Graph"` - Missing "BJJ Position Guide" component

**Why This Format Works**:
- **Primary Keyword First**: "Closed Guard Bottom" captures long-tail searches
- **Category Indicator**: "BJJ Position Guide" signals content type to Google
- **Brand Component**: "BJJ Graph" builds brand recognition and click-through
- **Consistent Structure**: Pattern recognition helps Google understand site architecture
- **Length Optimization**: 50-70 characters ideal for search display

### Meta Description Template and Examples

Meta descriptions must be 150-160 characters and include success rates to differentiate from competitors.

**Template**: `"Master [Position Name] in BJJ. Complete guide covering [key aspects]. Success rates: Beginner X%, Intermediate Y%, Advanced Z%."`

**Good Examples**:
1. `"Master Closed Guard Bottom in BJJ. Complete guide covering sweeps, submissions, posture control, and defensive frames. Success rates: Beginner 40%, Intermediate 60%, Advanced 75%."` (159 chars)

2. `"Master Mount in BJJ. Complete guide covering control maintenance, submission chains, and position transitions. Success rates: Beginner 65%, Intermediate 80%, Advanced 90%."` (158 chars)

3. `"Master De La Riva Guard in BJJ. Guide to sweeps, back takes, technical stand-ups. Success rates: Beginner 35%, Intermediate 55%, Advanced 70%."` (145 chars - acceptable)

**Bad Examples**:
1. `"Closed Guard Bottom is a fundamental BJJ position where..."` - Too verbose, no success rates, passive voice

2. `"Learn Closed Guard"` - Too short (19 chars), no detail, no success rates, no call to action

3. `"Master Closed Guard Bottom in Brazilian Jiu-Jitsu with this comprehensive guide covering sweeps, submissions, and defensive strategies for all skill levels from beginner to advanced"` (187 chars - too long, truncates in search)

4. `"Closed Guard guide with success rates"` - Missing key details, no specific percentages, poor structure

**Success Rate Presentation Requirements**:
- **All Three Levels**: Always include Beginner, Intermediate, Advanced
- **Realistic Values**: Based on actual YAML data, must match frontmatter
- **Ordered Correctly**: Beginner < Intermediate < Advanced (strictly enforced)
- **Context-Appropriate**: Defensive positions have lower rates, offensive positions higher rates
- **Integer Percentages**: No decimals (40%, not 40.5%)

### Target Keywords by Position Type

**Primary Keywords (High Volume)**:
- `"[position name]"` - e.g., "closed guard", "mount", "side control"
- `"bjj [position name]"` - e.g., "bjj closed guard", "bjj mount"
- `"[position name] bjj"` - e.g., "closed guard bjj", "mount bjj"

**Secondary Keywords (Medium Volume)**:
- `"[position name] techniques"` - e.g., "closed guard techniques"
- `"[position name] guide"` - e.g., "mount guide"
- `"how to use [position name]"` - e.g., "how to use closed guard"
- `"[position name] for beginners"` - e.g., "mount for beginners"

**Long-Tail Keywords (Low Competition, High Intent)**:
- `"[position name] sweeps"` - e.g., "closed guard sweeps"
- `"[position name] submissions"` - e.g., "mount submissions"
- `"escaping [position name]"` - e.g., "escaping side control"
- `"[position name] success rate"` - e.g., "closed guard success rate"
- `"[position name] decision tree"` - e.g., "closed guard decision tree"

**Competition-Specific Keywords**:
- `"[position name] competition"` - e.g., "closed guard competition"
- `"[position name] ibjjf"` - e.g., "mount ibjjf points"
- `"[position name] adcc"` - e.g., "back control adcc rules"

### Internal Linking Requirements

Every position page MUST include a minimum of 8 internal links to establish knowledge graph connections:

**Required Link Categories**:
1. **Offensive Transitions** (minimum 3): Links to techniques you can execute from this position
   - Format: `[[Hip Bump Sweep]]`, `[[Triangle Choke from Closed Guard]]`

2. **Defensive Transitions** (minimum 2): Links to techniques opponent can execute or counters
   - Format: `[[Guard Pass Defense]]`, `[[Posture Recovery]]`

3. **Related Positions** (minimum 3): Links to similar or connected positions
   - Format: `[[Open Guard Bottom]]`, `[[Half Guard Bottom]]`, `[[Mount]]`

**Example Internal Linking Structure**:
```markdown
## Offensive Transitions
- [[Hip Bump Sweep]] → [[Mount]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Triangle Choke from Closed Guard]] → [[Triangle Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 60%)
- [[Scissor Sweep]] → [[Side Control Top]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)

## Defensive Responses
- [[Guard Pass Counter]] → [[Closed Guard Bottom]] (Success Rate: 45%)
- [[Hip Escape]] → [[Open Guard Bottom]] (Success Rate: 50%)

## Related Positions
- [[Open Guard Bottom]] - Natural progression when opponent stands
- [[Half Guard Bottom]] - Defensive fallback when guard is partially passed
- [[Mount]] - Target position from successful sweeps
```

**Why 8+ Links Matter**:
- **PageRank Distribution**: More internal links = more authority passed
- **User Engagement**: Related content reduces bounce rate
- **Crawl Depth**: Better indexation of connected pages
- **Topic Clustering**: Establishes semantic relationships
- **Conversion Paths**: Guides users deeper into content

### Schema Markup Requirements for Position Pages

Every position page requires four types of Schema.org structured data:

**1. WebPage Schema** (Required):
```yaml
"@type": "WebPage"
"name": "[Position Name]"
"description": "[Meta description]"
"url": "https://bjjgraph.com/positions/[slug]"
```

**2. BreadcrumbList Schema** (Required):
```yaml
"@type": "BreadcrumbList"
"itemListElement":
  - position: 1, name: "Home"
  - position: 2, name: "Positions"
  - position: 3, name: "[Position Name]"
```

**3. HowTo Schema** (Strongly Recommended):
- **Minimum 5 steps**, maximum 8 for readability
- Each step describes a technique or transition available from this position
- Steps should map to offensive transitions in YAML
- Example: "Execute Hip Bump Sweep to transition to Mount with 55% success rate"

**4. FAQPage Schema** (Strongly Recommended):
- **Minimum 6 questions**, maximum 8 to avoid overwhelming snippets
- Questions must be actual questions (with "?" at end)
- Answers must be 2-3 complete sentences with technical detail
- Cover tactical, technical, and strategic aspects

### Featured Snippet Optimization

Position pages are ideal candidates for Google's featured snippets. Optimize for these formats:

**1. Table Format** (Position Comparison):
```markdown
| Position | Point Value | Success Rate (Advanced) | Primary Purpose |
|----------|-------------|-------------------------|-----------------|
| Mount | 4 | 80-90% | Control + Submission |
| Closed Guard Bottom | 0 | 60-75% | Sweep + Submit |
| Side Control Top | 3 | 70-85% | Control + Advance |
```

**2. Bulleted List Format** (Key Principles):
```markdown
Key principles for Closed Guard Bottom:
- Maintain closed legs around opponent's waist for structural control
- Break opponent's posture to create offensive opportunities
- Control distance with grips and frames to prevent passing
- Create angles to access sweeps and submissions
```

**3. Direct Answer Format** (Decision Trees):
```markdown
When should you use Hip Bump Sweep from Closed Guard?

Execute Hip Bump Sweep when opponent establishes strong upright posture (55% success rate). This technique exploits their rigid base and elevated center of gravity. Alternative: if opponent drives forward, use Pendulum Sweep instead (45% success rate).
```

**4. Step-by-Step Format** (Technique Execution):
```markdown
How to execute Triangle Choke from Closed Guard:
1. Break opponent's posture down and forward
2. Control one arm across your centerline
3. Pivot hips at 45-degree angle
4. Throw leg over shoulder and under chin
5. Lock triangle by placing foot behind knee
6. Squeeze knees together while pulling head down
```

### FAQ Best Practices for Position Pages

FAQ sections serve dual purposes: featured snippet capture and natural user questions. Position pages should include 6-8 questions covering these categories:

**Tactical Questions** (2-3 questions):
- "When should I use [Technique A] vs [Technique B] from [Position]?"
- "How do I respond when opponent [specific action] in [Position]?"
- "What are the highest percentage techniques from [Position]?"

**Technical Questions** (2-3 questions):
- "What are the key control points in [Position]?"
- "How do I maintain [Position] against resistance?"
- "What is the correct body positioning for [Position]?"

**Strategic Questions** (1-2 questions):
- "What are the common mistakes in [Position]?"
- "How does [Position] score in IBJJF competition?"
- "What positions lead naturally to [Position]?"

**Example FAQ Structure**:
```yaml
faq:
  - question: "What is the most common mistake in Closed Guard Bottom?"
    answer: "The most common mistake is maintaining a flat, square position without creating angles. This allows the opponent to maintain strong posture and distribute their weight evenly, making sweeps and submissions difficult. The correction is to constantly shift your hips to create angles, using off-balancing techniques to disrupt their posture and open attack opportunities."
    category: "errors"

  - question: "When should I use Hip Bump Sweep vs Scissor Sweep from Closed Guard?"
    answer: "Use Hip Bump Sweep when opponent establishes strong upright posture with a rigid base (55% success rate for advanced practitioners). Use Scissor Sweep when opponent leans forward or has a narrow base, as it exploits their compromised balance (50% success rate). If opponent stands up, transition to Open Guard instead."
    category: "tactics"
```

**Answer Format Requirements**:
- **Length**: 2-3 complete sentences (50-120 words)
- **Specificity**: Include technical details, not vague advice
- **Actionable**: Provide clear steps or decisions
- **Data**: Reference success rates when relevant
- **Context**: Explain *why*, not just *what*

### SEO Checklist for Position Pages

Before publishing or updating a position page, verify these SEO elements:

- [ ] Title follows exact template format with position name, category, and brand
- [ ] Meta description is 150-160 characters with success rates included
- [ ] All three success rate skill levels specified correctly
- [ ] Minimum 8 internal links present (3 offensive, 2 defensive, 3 related)
- [ ] All wikilinks resolve to actual content files
- [ ] WebPage and BreadcrumbList schemas present in frontmatter
- [ ] HowTo schema includes 5-8 actionable steps
- [ ] FAQPage schema includes 6-8 questions across tactical/technical/strategic categories
- [ ] H1 header matches position name exactly
- [ ] First paragraph includes target keyword within first 100 words
- [ ] Alt text for images (if applicable) includes descriptive keywords
- [ ] URL slug is lowercase, hyphenated, matches position name

---

## Integration with Learning Articles

Position pages serve as data sources for aggregated Learning articles (hub pages) that provide strategic overviews and learning pathways. This integration creates a content hierarchy: detailed position pages → strategic hub pages → comprehensive guides.

### How Position Data Is Used in Learning Articles

**1. Success Rate Aggregation and Comparison**:
Learning articles like "BJJ-Positions.md" create comparison tables using success rate data from multiple position pages:

```markdown
| Position | Beginner | Intermediate | Advanced | Point Value | Primary Purpose |
|----------|----------|--------------|----------|-------------|-----------------|
| Mount | 50% | 65% | 80% | 4 | Control + Submission |
| Closed Guard Bottom | 40% | 55% | 70% | 0 | Sweep + Submit |
| Side Control Top | 55% | 70% | 85% | 3 | Control + Pass |
```

**Requirements for Consistency**:
- Success rates must be consistent across related positions
- Point values must follow IBJJF standards exactly
- Position types (Offensive/Defensive/Neutral) must be correctly categorized
- Energy costs should be calibrated relative to similar positions

**Example of Inconsistent Data** (avoid):
- Closed Guard Bottom: "Sweep success: Beginner 60%" (position page)
- Hip Bump Sweep: "From Closed Guard: Beginner 40%" (transition page)
- *These conflict - position page suggests 60% sweep success but specific sweep only has 40%*

**Example of Consistent Data** (correct):
- Closed Guard Bottom: "Average sweep success: Beginner 45%" (average of all sweeps)
- Hip Bump Sweep: "From Closed Guard: Beginner 55%" (specific sweep)
- Scissor Sweep: "From Closed Guard: Beginner 40%" (specific sweep)
- Pendulum Sweep: "From Closed Guard: Beginner 40%" (specific sweep)
- *Average: (55 + 40 + 40) / 3 = 45% - consistent!*

**2. Expert Insights Alignment**:
Learning articles aggregate expert perspectives from multiple positions to identify patterns:

**John Danaher Pattern** (Systematic Approach):
- Across all guard positions: Emphasizes posture control as prerequisite
- Across all top positions: Stresses pressure + immobilization hierarchy
- Consistent theme: "Control position before seeking submission"

**Gordon Ryan Pattern** (Competition Focus):
- Across all positions: Prioritizes high-percentage techniques
- Competition considerations: IBJJF vs ADCC rule set adaptations
- Consistent theme: "What actually works in live competition"

**Eddie Bravo Pattern** (Innovation):
- Across rubber guard positions: Unique grips and unorthodox angles
- 10th Planet specific: Lockdown, electric chair, truck progressions
- Consistent theme: "Challenge conventional defensive structures"

**Consistency Requirements**:
- Expert insights must match their known teaching philosophy
- Technical emphasis should align across similar positions
- Competition strategies should reflect actual competitive success
- Innovation should be grounded in mechanical advantage, not gimmicks

**3. Position Relationships Create Navigation**:
Learning articles use the `related_positions` and `progressions` sections to create visual navigation and logical flows:

```markdown
### Guard Bottom Learning Pathway

**Fundamental Progression**:
[[Closed Guard Bottom]] (Master first) → [[Open Guard Bottom]] (When opponent stands) → [[Half Guard Bottom]] (Defensive fallback) → [[Deep Half Guard]] (Advanced recovery)

**Sweep Chain Learning**:
From [[Closed Guard Bottom]]: Learn [[Hip Bump Sweep]] → Then [[Scissor Sweep]] → Then [[Pendulum Sweep]] → Advanced: [[Flower Sweep]]
```

**Requirements for Position Relationships**:
- `related_positions` must list actual related content (not aspirational)
- `leads_to` must reference natural progressions backed by technique data
- `progressions` should indicate skill level (beginner → intermediate → advanced)
- Relationships should be bidirectional (if A relates to B, B should relate to A)

**4. Training Drills Aggregation**:
Learning articles compile training drills from multiple positions to create comprehensive training programs:

**Example from "BJJ-Guard-Passing.md"**:
```markdown
### Week 1-2: Fundamental Guard Passing Drills
- Knee Cut Pass pressure drill (from [[Knee Cut Position]])
- Leg Drag control drill (from [[Leg Drag Position]])
- Toreando movement drill (from [[Standing Guard]])
- Stack Pass pressure maintenance (from [[Half Guard Top]])
```

**Consistency Requirements**:
- Drill descriptions must match source position pages exactly
- Progressive resistance levels (0%, 25%, 50%, 75%, 100%) should be consistent
- Sets/reps/duration recommendations should align across similar positions
- Focus points should emphasize the same principles in related drills

### Success Rate Consistency Standards

Success rate data forms the foundation of Learning article comparisons and decision trees. Inconsistencies create confusion and undermine credibility.

**Calibration Rules**:

1. **Additive Consistency**: If Position A → B has 60% success and B → C has 70% success, then A → C through this path has ~42% success (0.60 × 0.70)

2. **Alternative Consistency**: If Technique 1 has 50% success and Technique 2 has 50% success from same position, overall success rate for "any technique" shouldn't exceed 75% (account for overlap)

3. **Skill Progression Consistency**: Advanced practitioners should succeed at beginner-rated techniques 10-15% more than intermediate practitioners who succeed 10-15% more than beginners

4. **Position Type Consistency**:
   - Offensive positions (Mount, Back Control): Higher technique success rates (60-90%)
   - Neutral positions (Standing, Neutral Start): Balanced success rates (40-60%)
   - Defensive positions (Bottom positions): Lower technique success rates (30-60%)

**Example of Calibrated Success Rates**:

**Closed Guard Bottom → Mount Progression**:
- Hip Bump Sweep: Beginner 40%, Intermediate 55%, Advanced 70%
- Maintain Mount: Beginner 60%, Intermediate 75%, Advanced 85%
- Combined A→B→Maintain: Beginner 24% (0.40 × 0.60), Intermediate 41% (0.55 × 0.75), Advanced 60% (0.70 × 0.85)

This calibration ensures realistic expectations and helps Learning articles accurately represent progression difficulty.

### Cross-Referencing Standards

Position pages must cross-reference relevant Learning articles to create bidirectional navigation:

**In Position Frontmatter**:
```yaml
tags:
  - bjj
  - position
  - guard
  - closed-guard
  - bottom
  - fundamental
  - learning-pathway-guard-bottom  # Links to Learning article
```

**In Position Markdown Content**:
```markdown
## Related Learning Pathways

This position is part of the **[[Guard Bottom Learning Pathway]]**, which provides a comprehensive progression from fundamental to advanced guard techniques.

For competition-specific applications, see **[[BJJ-Guard-Passing]]** for common passing attempts you'll defend against from this position.

For a complete overview of all bottom positions, see **[[BJJ-Positions]]** hub page.
```

**In Learning Article** (e.g., "BJJ-Positions.md"):
```markdown
### Closed Guard Bottom

Master the **[[Closed Guard Bottom]]** as your foundational guard position. Focus on:
- Posture control to prevent opponent's offense
- High-percentage sweeps (Hip Bump, Scissor, Pendulum)
- Submission threats (Triangle, Armbar, Kimura)

**Success Rates**: Beginner 40% | Intermediate 55% | Advanced 70%

**Learning Priority**: **High** - Master before progressing to open guard variations
```

**Requirements**:
- Every position should be referenced in at least one Learning article
- Learning articles should link back to 5-10 detailed position pages
- Cross-references should provide context, not just bare links
- Tags should indicate which Learning pathway the position belongs to

---

## Schema Markup Quick Reference

Schema.org structured data is implemented in YAML frontmatter (not inline JSON-LD as in V1). This section provides position-specific guidance for required and recommended schemas.

### Required Schemas: WebPage and BreadcrumbList

**WebPage Schema** (automatically generated if not specified):
```yaml
"@context": "https://schema.org"
"@type": "WebPage"
"name": "Closed Guard Bottom"
"description": "Master Closed Guard Bottom in BJJ. Complete guide covering sweeps, submissions, posture control. Success rates: Beginner 40%, Intermediate 55%, Advanced 70%."
"url": "https://bjjgraph.com/positions/closed-guard-bottom"
"isPartOf":
  "@type": "WebSite"
  "name": "BJJ Graph"
  "url": "https://bjjgraph.com"
```

**BreadcrumbList Schema** (automatically generated):
```yaml
"@context": "https://schema.org"
"@type": "BreadcrumbList"
"itemListElement":
  - "@type": "ListItem"
    "position": 1
    "name": "Home"
    "item": "https://bjjgraph.com/"
  - "@type": "ListItem"
    "position": 2
    "name": "Positions"
    "item": "https://bjjgraph.com/positions/"
  - "@type": "ListItem"
    "position": 3
    "name": "Closed Guard Bottom"
    "item": "https://bjjgraph.com/positions/closed-guard-bottom"
```

**Note**: These schemas are generated by build scripts and don't need manual implementation unless customization is required.

### Recommended Schema: HowTo (5-8 Steps)

HowTo schema provides step-by-step guidance for using the position effectively. Map steps to offensive transitions for accuracy.

**Implementation in YAML Frontmatter**:
```yaml
schema_org:
  howto:
    type: "HowTo"
    name: "How to Use Closed Guard Bottom in BJJ"
    description: "Complete guide to executing techniques and transitions from Closed Guard Bottom position."
    total_time: "PT5M"

    steps:
      - name: "Break Opponent's Posture"
        text: "From Closed Guard Bottom, use collar grips and hip movement to break opponent's upright posture, bringing their head and shoulders down toward you. This creates offensive opportunities and prevents passing attempts."
        position: 1

      - name: "Execute Hip Bump Sweep"
        text: "When opponent establishes strong upright posture, sit up and execute Hip Bump Sweep to transition to Mount position. Success rate: Beginner 40%, Intermediate 55%, Advanced 70%."
        position: 2

      - name: "Execute Triangle Choke"
        text: "When opponent's posture is broken and one arm crosses your centerline, pivot hips and throw leg over for Triangle Choke. Success rate: Beginner 25%, Intermediate 40%, Advanced 60%."
        position: 3

      - name: "Execute Scissor Sweep"
        text: "When opponent leans forward with narrow base, use Scissor Sweep mechanics to transition to Side Control Top. Success rate: Beginner 35%, Intermediate 50%, Advanced 65%."
        position: 4

      - name: "Maintain Guard Retention"
        text: "If opponent stands up or creates distance, transition to Open Guard Bottom to maintain guard structure and prevent passing. Success rate: Beginner 50%, Intermediate 65%, Advanced 80%."
        position: 5

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"
```

**Step Requirements**:
- **Minimum 5 steps**, maximum 8 for optimal snippet display
- Each step should reference an actual offensive transition from YAML
- Include success rates in step text for featured snippet capture
- Steps should follow logical progression (setup → execution → alternatives)
- Use active voice and imperative mood ("Execute X", not "You should execute X")

**Position-Specific Step Examples**:

**Bottom Positions** (Guard, Turtle):
- Step 1: Establish control and structure
- Step 2: Primary sweep or reversal
- Step 3: Primary submission
- Step 4: Alternative attack
- Step 5: Guard retention or recovery

**Top Positions** (Mount, Side Control, Back Control):
- Step 1: Establish and maintain control
- Step 2: Isolate limb or control posture
- Step 3: Primary submission attempt
- Step 4: Alternative submission
- Step 5: Transition to better position

### Updated FAQ Standards (6-8 Questions)

FAQ schema has been updated to require 6-8 questions (increased from 5 minimum) with 2-3 sentence answers for better featured snippet capture.

**Implementation in YAML Frontmatter**:
```yaml
schema_org:
  faq:
    - question: "What is the most common mistake in Closed Guard Bottom?"
      answer: "The most common mistake is maintaining a flat, square position without creating angles, which allows the opponent to maintain strong posture. This makes sweeps and submissions much more difficult to execute. The correction is to constantly shift your hips to create angles and use off-balancing techniques."
      category: "errors"

    - question: "When should I use Hip Bump Sweep vs Scissor Sweep from Closed Guard?"
      answer: "Use Hip Bump Sweep when opponent establishes strong upright posture with a rigid base (55% success rate for advanced practitioners). Use Scissor Sweep when opponent leans forward or has a narrow base, exploiting their compromised balance (50% success rate for advanced). The decision depends on opponent's posture and base width."
      category: "tactics"

    - question: "What are the key control points in Closed Guard Bottom?"
      answer: "The primary control points are: (1) legs locked around opponent's waist creating structural control, (2) grips on collar or sleeves to break and maintain broken posture, (3) hip pressure to prevent opponent from creating distance. Secondary controls include head control with overhooks and ankle grip for opponent's belt or gi."
      category: "fundamentals"

    - question: "How do I prevent my guard from being passed from Closed Guard?"
      answer: "Maintain closed legs around opponent's waist as your first line of defense. If opponent begins standing or creating pressure, immediately transition to Open Guard or establish defensive frames. Keep your hips mobile and ready to re-guard if opponent breaks your closed guard structure."
      category: "defense"

    - question: "What techniques should beginners focus on from Closed Guard Bottom?"
      answer: "Beginners should master three fundamental techniques: (1) Hip Bump Sweep for when opponent has upright posture, (2) Triangle Choke setup when opponent's arm crosses centerline, (3) Scissor Sweep for when opponent leans forward. These three techniques cover most opponent positions and have beginner success rates of 40%, 25%, and 35% respectively."
      category: "tactics"

    - question: "How does Closed Guard Bottom score in IBJJF competition?"
      answer: "Closed Guard Bottom itself scores 0 points under IBJJF rules - it's a neutral position. However, sweeping opponent from closed guard to a top position scores 2 points, and submissions from closed guard win the match. Guard bottom is considered a strong competitive position despite zero point value because of sweep and submission opportunities."
      category: "fundamentals"
```

**Answer Format Requirements** (Updated):
- **Length**: 2-3 complete sentences (50-120 words per answer)
- **Completeness**: Each answer must fully address the question without requiring additional context
- **Specificity**: Include technical details, success rates, specific control points
- **Actionable**: Provide clear decisions or steps, not vague advice
- **Paragraph Structure**: Use 2-3 sentences structured as: (1) Direct answer, (2) Supporting detail, (3) Practical application

**Question Categories for Position Pages** (Updated):

1. **Fundamentals** (2-3 questions):
   - "What are the key control points in [Position]?"
   - "How does [Position] score in IBJJF competition?"
   - "What makes [Position] effective/defensive/neutral?"

2. **Tactics** (2-3 questions):
   - "When should I use [Technique A] vs [Technique B]?"
   - "What techniques should beginners focus on from [Position]?"
   - "How do I respond when opponent [specific action]?"

3. **Defense** (1-2 questions):
   - "How do I prevent [common problem] in [Position]?"
   - "What should I do when opponent [defensive action]?"

4. **Errors** (1-2 questions):
   - "What is the most common mistake in [Position]?"
   - "How do I recognize when I'm [making specific error]?"

### When to Add ItemList Schema

ItemList schema is appropriate when a position page lists multiple variations, techniques, or related positions as an ordered or unordered collection.

**Use ItemList When**:
- Position has 5+ well-defined variations (e.g., "X-Guard Variations")
- Creating a "Position Family" page (e.g., "Guard Bottom Positions")
- Listing systematic technique progressions (e.g., "Mount Submission Sequence")
- Hub pages aggregating related positions (e.g., "BJJ-Positions.md")

**Example ItemList for Position Variations**:
```yaml
schema_org:
  itemlist:
    type: "ItemList"
    name: "Guard Bottom Position Variations"
    description: "Complete list of guard bottom position variations in BJJ"
    numberOfItems: 8

    itemListElement:
      - "@type": "ListItem"
        "position": 1
        "name": "Closed Guard Bottom"
        "url": "https://bjjgraph.com/positions/closed-guard-bottom"
        "description": "Fundamental guard with legs locked around opponent's waist"

      - "@type": "ListItem"
        "position": 2
        "name": "Open Guard Bottom"
        "url": "https://bjjgraph.com/positions/open-guard-bottom"
        "description": "Guard with legs not locked, using hooks and grips for control"

      - "@type": "ListItem"
        "position": 3
        "name": "Half Guard Bottom"
        "url": "https://bjjgraph.com/positions/half-guard-bottom"
        "description": "Defensive guard with one leg trapped between yours"

      # Continue for remaining variations...
```

**When NOT to Use ItemList**:
- Individual position pages (not aggregating variations)
- Fewer than 5 items in the list
- Items are transitions/techniques rather than position variations (use HowTo instead)
- Hub pages already have ItemList (avoid duplication)

**Position-Specific ItemList Guidelines**:
- **Guard Positions**: List variations when family has 5+ distinct types
- **Top Positions**: List submission chains or control progressions if systematic
- **Individual Positions**: Generally don't use ItemList unless listing variations within that specific position

---

*This is the official Position Standard V2 for BJJ Graph. All new position files should follow this standard. Existing V1 files should be migrated to V2 when updated.*

*Questions, suggestions, or issues should be reported to project maintainers.*

*Last Updated: October 2025*
