# Knowledge Graph Data Model Specification
**Version 2.0** | **Status: Production** | **Last Updated: October 2025**

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [State Machine Formal Definition](#state-machine-formal-definition)
3. [Data Structure Mapping](#data-structure-mapping)
4. [Entity Types](#entity-types)
5. [Probabilistic Model](#probabilistic-model)
6. [Relationship Types](#relationship-types)
7. [Validation Rules](#validation-rules)
8. [Query Patterns](#query-patterns)
9. [Integration with Game Engine](#integration-with-game-engine)
10. [Implementation Examples](#implementation-examples)

---

## Executive Summary

BJJ Graph implements a **probabilistic state machine** representing Brazilian Jiu-Jitsu as a directed weighted graph. The knowledge graph contains 562+ nodes (positions, transitions, submissions, concepts, systems) with 2,000+ edges representing technique executions, counter-responses, and strategic relationships.

**Key Characteristics:**
- **Nodes**: 211 positions (S###), 202 transitions (T###), 149 submissions (SUB###)
- **Edges**: Offensive transitions, defensive responses, submission chains, counter-actions
- **Weights**: Success probabilities by skill level (Beginner/Intermediate/Advanced)
- **Attributes**: Energy cost, execution time, risk level, physical requirements
- **Metadata**: Expert insights, common errors, training progressions, LLM context

**Use Cases:**
1. **Human Learning**: Educational resource with structured progression
2. **Game Engine**: State machine for turn-based BJJ simulation
3. **AI Training**: Structured data for LLM decision-making
4. **SEO Optimization**: Rich snippets and knowledge graph visibility

---

## State Machine Formal Definition

### Graph Structure

**Definition**: BJJ Graph is a directed, weighted, multi-attribute graph `G = (V, E, W, A)` where:

- **V** (Vertices): Set of all positions, transitions, submissions
- **E** (Edges): Set of directed connections between states
- **W** (Weights): Success probability functions `w: E × S → [0,1]` where S = {Beginner, Intermediate, Advanced}
- **A** (Attributes): Metadata functions `a: V ∪ E → M` where M is the attribute space

### Node Types

```
V = P ∪ T ∪ SUB ∪ C ∪ SC

Where:
- P = {p₁, p₂, ..., p₂₁₁} : Positions (State nodes)
- T = {t₁, t₂, ..., t₂₀₂} : Transitions (Edge nodes with metadata)
- SUB = {s₁, s₂, ..., s₁₄₉} : Submissions (Terminal/semi-terminal nodes)
- C = {c₁, c₂, ..., cₙ} : Concepts (Meta-knowledge nodes)
- SC = {sc₁, sc₂, ..., scₘ} : Systems (Expert framework nodes)
```

### State Classification

**Position Types (P):**
1. **Neutral**: `{Standing, Neutral Guard Pull}` - 0 IBJJF points
2. **Guard Bottom**: `{Closed Guard, Open Guard, Half Guard, ...}` - 0 points, defensive/offensive options
3. **Guard Top**: `{Guard Top Positions}` - 0 points, offensive control
4. **Passing**: `{Knee Cut, Leg Drag, ...}` - Transitional states to 3-point positions
5. **Pins**: `{Side Control, Mount, Back Control}` - 3-4 point dominant positions
6. **Submissions**: `{Triangle Control, Armbar Control, ...}` - Control positions before finish

**Terminal States:**
- `Won by Submission` - Match-ending state (SUB → Terminal)
- `Points Victory` - Match-ending state (aggregate points exceeds threshold)
- `Disqualification` - Rule-violation terminal state

**Graph Properties:**
- **Strongly Connected**: Every non-terminal state can reach every other state through valid edges
- **Weighted Edges**: Each transition has success probability: `w(e, skill) ∈ [0, 100]`
- **Multi-Attribute**: Nodes and edges carry metadata (energy, timing, requirements)

### Transition Semantics

**Edge Types:**
```
E = E_OFF ∪ E_DEF ∪ E_COUNTER ∪ E_CHAIN ∪ E_CONCEPT

Where:
- E_OFF: Offensive transitions (your attacks from position)
- E_DEF: Defensive responses (opponent's options against you)
- E_COUNTER: Counter-transitions (responses to opponent's attacks)
- E_CHAIN: Submission chains (sequential attack paths)
- E_CONCEPT: Conceptual relationships (pedagogical links)
```

**Transition Function:**
```
τ: P × T × Skill × Context → P × Probability

Where:
- P: Current position (starting state)
- T: Technique executed (transition)
- Skill: {Beginner, Intermediate, Advanced}
- Context: Game state (fatigue, setup quality, knowledge, modifiers)
- Probability: P(success | Skill, Context) ∈ [0,1]
```

### State Invariants

**Physical Invariants** (required for position validity):
```python
Position.invariants = {
    'physical': [
        "Specific body configuration",
        "Anatomical requirement",
        "Spatial relationship"
    ],
    'control': [
        "Required grip/pressure",
        "Control point maintenance",
        "Connection mechanism"
    ],
    'opponent_limitations': [
        "Restricted movement",
        "Limited options",
        "Defensive requirement"
    ]
}
```

**Position Validity:**
A state `p ∈ P` is valid if and only if:
1. All physical invariants are satisfied
2. Control requirements are maintained
3. Opponent limitations are enforced
4. Energy constraints are met

### Terminal State Conditions

**Submission Terminal:**
```
SUB → Won by Submission iff:
  - Opponent taps (signal recognition)
  - Opponent unconscious (choke completion)
  - Joint damage (joint lock completion)
  - Time limit exceeded (match end)
```

**Points Terminal:**
```
Match → Points Victory iff:
  - Time expired AND point_differential > 0
  - Advantage system applied if points tied
```

---

## Data Structure Mapping

### Markdown → YAML → State Machine

**Content Pipeline:**

```
Source Markdown Files
       ↓
YAML Frontmatter Parsing (structured data)
       ↓
State Machine Graph Construction (nodes, edges, weights)
       ↓
Game Engine Integration (probabilistic calculations)
       ↓
AI/LLM Context (decision-making logic)
```

### YAML Frontmatter Structure

**Position State Node:**
```yaml
---
# SEO Metadata
title: "Position Name | BJJ Position Guide | BJJ Graph"
description: "Master Position with success rates: Beginner X%, Intermediate Y%, Advanced Z%."

# State Machine Core
state_machine:
  state_id: "S###"
  position_name: "Position Name"
  alternative_names: ["Alt 1", "Alt 2"]

  properties:
    point_value: 0-4              # IBJJF scoring
    position_type: "Offensive|Defensive|Neutral|Controlling"
    risk_level: "Low|Medium|High"
    energy_cost: "Low|Medium|High"
    time_sustainability: "Short|Medium|Long"

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

  transitions:
    offensive:
      - name: "Technique Name"
        target_state: "S###"
        target_position: "Target Position"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T###"
        category: "sweep|submission|escape|control"
        energy_cost: "Low|Medium|High"
        execution_time: "Instant|Quick|Medium|Slow"
        description: "Brief execution"

    defensive:
      - name: "Counter Technique"
        target_state: "S###"
        success_rate: 40
        counter_category: "posture|pressure|pass|escape"

  decision_tree:
    - condition: "opponent establishes strong posture"
      priority: 1
      indicators: ["Upright spine", "Wide base", "Head above hips"]
      actions:
        - technique: "Hip Bump Sweep"
          target_state: "S001"
          probability: 55
          reasoning: "High posture creates sweep opportunities"

  invariants:
    physical: ["Body config 1", "Anatomical req 2"]
    control: ["Required grip 1", "Control point 2"]
    opponent_limitations: ["Restricted movement 1"]

# LLM Context for AI
llm_context:
  position_summary: "Concise strategic role description"

  key_success_factors:
    - factor: "Primary Success Factor"
      importance: "critical|high|medium"
      description: "Why essential"
      game_impact: "Success rate modifiers"

  success_modifiers:
    - condition: "Strong control established"
      modifier: +10
      applies_to: "all_offensive_transitions"

  dilemmas:
    - scenario: "Opponent defends primary attack"
      dilemma_created: "Defense creates vulnerability"
      offensive_options: ["Attack A → Result", "Attack B → Result"]
      narrative: "As opponent defends X, they expose Y"
---
```

**Transition Edge Node:**
```yaml
---
# SEO Metadata
title: "Technique Name | BJJ Technique | BJJ Graph"
description: "Learn Technique from Start to End. Success: Beginner X%, Intermediate Y%, Advanced Z%."

# State Machine Core
transition_id: "T###"
transition_name: "Technique Name"
alternative_names: ["Alt 1", "Alt 2"]
starting_state: "Starting Position"
ending_state: "Ending Position"
transition_type: "Attack|Escape|Advancement|Counter|Setup"

success_probability:
  beginner: 50
  intermediate: 70
  advanced: 85

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

# LLM Context
llm_context:
  decision_tree:
    conditions:
      - name: "Setup Quality Check"
        evaluation: "setup_quality_score >= 50"
        success_action: "proceed_to_timing_check"
        failure_action: "execute_defensive_counter"
        failure_probability: 55

  troubleshooting:
    - symptom: "Opponent maintains balance"
      likely_cause: "Insufficient grip control"
      solution: "Re-establish grips, wait for optimal weight distribution"
---
```

### Graph Construction Algorithm

```python
def construct_knowledge_graph(content_directory: Path) -> KnowledgeGraph:
    """
    Parse markdown files → Build state machine graph
    """
    graph = KnowledgeGraph()

    # Phase 1: Parse all position files (nodes)
    for position_file in glob(content_directory / "Positions/*.md"):
        yaml_data, markdown = parse_file(position_file)

        node = PositionNode(
            id=yaml_data['state_machine']['state_id'],
            name=yaml_data['state_machine']['position_name'],
            attributes=yaml_data['state_machine']['properties'],
            metrics=yaml_data['state_machine']['metrics']
        )

        graph.add_node(node)

    # Phase 2: Parse all transition files (edge metadata)
    for transition_file in glob(content_directory / "Transitions/*.md"):
        yaml_data, markdown = parse_file(transition_file)

        edge_metadata = TransitionMetadata(
            id=yaml_data['transition_id'],
            name=yaml_data['transition_name'],
            success_rates=yaml_data['success_probability'],
            requirements=yaml_data['physical_requirements'],
            modifiers=yaml_data['success_modifiers']
        )

        graph.add_edge_metadata(edge_metadata)

    # Phase 3: Create edges from position offensive transitions
    for node in graph.nodes():
        position_data = load_position(node.id)

        for offensive_transition in position_data['transitions']['offensive']:
            edge = Edge(
                source=node.id,
                target=offensive_transition['target_state'],
                transition_id=offensive_transition['transition_id'],
                weights={
                    'beginner': offensive_transition['success_rate']['beginner'],
                    'intermediate': offensive_transition['success_rate']['intermediate'],
                    'advanced': offensive_transition['success_rate']['advanced']
                },
                attributes={
                    'energy_cost': offensive_transition['energy_cost'],
                    'execution_time': offensive_transition['execution_time'],
                    'category': offensive_transition['category']
                }
            )

            graph.add_edge(edge)

    # Phase 4: Validate graph connectivity and consistency
    graph.validate()

    return graph
```

---

## Entity Types

### 1. Positions (S###) - State Nodes

**Count**: 211 files in `/source/content/Positions/`

**Identifier Format**: `S###` (S001, S002, ..., S211)

**Purpose**: Represent physical configurations in BJJ with control, threat, and transition data

**Core Attributes:**
```python
class PositionNode:
    # Identity
    state_id: str                    # S### format
    position_name: str               # Human-readable name
    alternative_names: List[str]     # Regional/instructor variations

    # Classification
    point_value: int                 # 0-4 (IBJJF scoring)
    position_type: str               # Offensive|Defensive|Neutral|Controlling
    risk_level: str                  # Low|Medium|High
    energy_cost: str                 # Low|Medium|High
    time_sustainability: str         # Short|Medium|Long

    # Success Metrics (by skill level)
    position_retention: Dict[str, int]      # % chance maintain position
    advancement_probability: Dict[str, int]  # % chance improve position
    submission_probability: Dict[str, int]   # % chance finish from here
    position_loss: Dict[str, int]            # % chance lose position
    average_time_minutes: str                # "2-3" typical duration

    # Graph Relationships
    offensive_transitions: List[Transition]  # Your attacks from here
    defensive_responses: List[Counter]       # Opponent's options
    counters: List[CounterTransition]        # Your responses to opponent

    # Decision Logic
    decision_tree: List[DecisionNode]        # if/then logic for AI

    # Physical/Control Requirements
    invariants: Dict[str, List[str]]         # Required physical config

    # Training Data
    prerequisites: Dict[str, List[str]]      # Required skills/positions
    optimal_conditions: List[str]            # Best circumstances
    vulnerable_moments: List[str]            # Risk points

    # Meta-Knowledge
    progressions: Dict[str, List[Progression]]  # Natural flows
    related_positions: List[Relation]            # Similar positions
```

**Example Position: Closed Guard Bottom (S002)**
```yaml
state_id: "S002"
position_name: "Closed Guard Bottom"
alternative_names: ["Full Guard", "Traditional Guard", "Classic Guard"]

properties:
  point_value: 0
  position_type: "Defensive with offensive options"
  risk_level: "Low"
  energy_cost: "Medium"
  time_sustainability: "Long"

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

transitions:
  offensive:
    - name: "Hip Bump Sweep"
      target_state: "S001"  # Mount
      target_position: "Mount"
      success_rate: {beginner: 50, intermediate: 70, advanced: 85}
      transition_id: "T045"
      category: "sweep"

    - name: "Triangle Choke from Closed Guard"
      target_state: "S201"  # Triangle Control
      success_rate: {beginner: 25, intermediate: 40, advanced: 60}
      transition_id: "T103"
      category: "submission"
```

### 2. Transitions (T###) - Edge Nodes with Metadata

**Count**: 202 files in `/source/content/Transitions/`

**Identifier Format**: `T###` (T001, T002, ..., T999)

**Purpose**: Represent technique executions that connect positions with success probabilities

**Core Attributes:**
```python
class TransitionNode:
    # Identity
    transition_id: str               # T### format
    transition_name: str             # Technique name
    alternative_names: List[str]     # Variations

    # Graph Connectivity
    starting_state: str              # Source position (S###)
    ending_state: str                # Target position (S###)
    transition_type: str             # Attack|Escape|Advancement|Counter|Setup

    # Success Probabilities
    success_probability: Dict[str, int]  # By skill level

    # Execution Properties
    execution_complexity: str        # Low|Medium|High
    energy_cost: str                 # Low|Medium|High
    time_required: str               # Instant|Quick|Medium|Slow
    risk_level: str                  # Low|Medium|High

    # Physical Requirements
    physical_requirements: Dict[str, str]  # strength, flexibility, coordination, speed

    # Success Modifiers (for probabilistic calculations)
    success_modifiers: Dict[str, int]  # setup_quality, timing, fatigue, knowledge, control

    # Common Counters
    common_counters: List[Counter]    # Opponent defensive responses

    # LLM Context
    decision_tree: DecisionTree       # Conditional logic for AI
    troubleshooting: List[Pattern]    # Common problems/solutions
    timing_guidance: TimingData       # Optimal/avoid windows
    narrative_prompts: NarrativeData  # For story generation
```

**Example Transition: Hip Bump Sweep (T045)**
```yaml
transition_id: "T045"
transition_name: "Hip Bump Sweep"
alternative_names: ["Sit-Up Sweep", "Hip Heist", "Basic Sweep"]

starting_state: "Closed Guard Bottom"  # S002
ending_state: "Mount"                  # S001
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
```

### 3. Submissions (SUB###) - Terminal/Semi-Terminal Nodes

**Count**: 149 files in `/source/content/Submissions/`

**Identifier Format**: `SUB###` (SUB001, SUB002, ..., SUB149)

**Purpose**: Represent finishing techniques with control positions and safety data

**Core Attributes:**
```python
class SubmissionNode:
    # Identity
    submission_id: str               # SUB### format
    submission_name: str             # Technique name
    alternative_names: List[str]     # Regional variations

    # Graph Connectivity
    starting_state: str              # Control position (S###)
    ending_state: str                # "Won by Submission" (terminal)
    submission_type: str             # Choke|Joint Lock|Compression|Crank
    target_area: str                 # Specific anatomy

    # Success Probabilities
    success_probability: Dict[str, int]  # By skill level

    # Execution Properties
    setup_complexity: str            # Low|Medium|High
    execution_speed: str             # Slow|Medium|Fast
    escape_difficulty: str           # Low|Medium|High
    damage_potential: str            # Low|Medium|High

    # Safety (MANDATORY for submissions)
    safety_considerations: SafetyData
    injury_risks: List[InjuryData]
    application_speed: str           # "SLOW and progressive - 3-5 seconds minimum"
    tap_recognition: List[str]       # Valid tap signals
    release_protocol: List[str]      # Step-by-step release

    # Training Progressions (6 phases)
    training_phases: Dict[str, Phase]  # Week 1-2, 3-4, 5-8, 9-12, 13+, Ongoing
```

**Example Submission: Rear Naked Choke (SUB001)**
```yaml
submission_id: "SUB001"
submission_name: "Rear Naked Choke"
alternative_names: ["RNC", "Mata Leão", "Sleeper Hold"]

starting_state: "Back Control"      # S018
ending_state: "Won by Submission"   # Terminal
submission_type: "Choke"
target_area: "Carotid arteries - bilateral blood flow restriction"

success_probability:
  beginner: 60
  intermediate: 80
  advanced: 95

setup_complexity: "Low"
execution_speed: "Medium"
escape_difficulty: "High"
damage_potential: "High"

safety_considerations:
  injury_risks:
    - type: "Loss of consciousness"
      severity: "High"
      recovery_time: "Immediate to 30 seconds"

  application_speed: "SLOW and progressive - 3-5 seconds minimum to allow tap"

  tap_recognition:
    - "Verbal tap (saying 'tap' or 'stop')"
    - "Hand tap on opponent's body or mat"
    - "Foot tap on mat"
    - "Any repeated gesture indicating submission"

  release_protocol:
    - "Immediately release choking arm"
    - "Support partner's head gently"
    - "Allow recovery time before standing"
```

### 4. Concepts (C###) - Meta-Knowledge Nodes

**Count**: Variable (30+ files in `/source/content/Concepts/`)

**Identifier Format**: `C###` (C001, C002, ..., C999)

**Purpose**: Represent fundamental principles and frameworks that apply across multiple positions

**Core Attributes:**
```python
class ConceptNode:
    # Identity
    concept_id: str                  # C### format
    concept_name: str                # Principle name

    # Classification
    application_level: str           # Fundamental|Intermediate|Advanced
    complexity_level: str            # Low|Medium|High
    development_timeline: str        # "White Belt to Black Belt"

    # Applications
    applies_to_positions: List[str]  # Position IDs where concept is relevant
    applies_to_transitions: List[str]  # Transition IDs

    # Relationships
    prerequisite_concepts: List[str]  # C### IDs that must be understood first
    related_concepts: List[str]       # Similar or complementary concepts

    # Educational Data
    key_principles: List[str]        # Core ideas
    component_skills: List[str]      # Sub-skills to develop
    training_approaches: List[str]   # How to practice
```

**Example Concept: Base Maintenance (C111)**
```yaml
concept_id: "C111"
concept_name: "Base Maintenance"

application_level: "Fundamental"
complexity_level: "Medium"
development_timeline: "White Belt to Advanced"

applies_to_positions:
  - "S001"  # Mount
  - "S004"  # Side Control Top
  - "S018"  # Back Control
  - "S003"  # Closed Guard Top

key_principles:
  - "Wide base provides stability and prevents sweeps"
  - "Weight distribution must adjust dynamically"
  - "Hand/knee positioning creates defensive structure"
  - "Base narrowing creates sweep opportunities"
  - "Recovery from compromised base requires immediate correction"
```

### 5. Systems (SC###) - Expert Framework Nodes

**Count**: Variable (15+ files in `/source/content/Systems/`)

**Identifier Format**: `SC###` (SC001, SC002, ..., SC999)

**Purpose**: Represent comprehensive attack/defense frameworks from experts (Danaher, Gordon Ryan, Eddie Bravo)

**Core Attributes:**
```python
class SystemNode:
    # Identity
    chain_id: str                    # SC### format
    system_name: str                 # Framework name
    expert_source: str               # Danaher|Gordon Ryan|Eddie Bravo

    # Classification
    difficulty_level: str            # Beginner|Intermediate|Advanced
    strategic_value: str             # Low|Medium|High

    # System Components
    primary_submissions: List[str]   # SUB### IDs
    starting_positions: List[str]    # S### IDs
    core_transitions: List[str]      # T### IDs

    # System Logic
    submission_sequence: List[str]   # Ordered chain
    decision_tree: DecisionTree      # if/then branching

    # Strategy
    setup_positions: List[str]       # Where to initiate
    common_defenses: List[Defense]   # Expected opponent responses
```

**Example System: Kimura Trap System (SC002)**
```yaml
chain_id: "SC002"
system_name: "Kimura Trap System"
expert_source: "Multiple (popularized by Danaher, Ryan, Bravo)"

difficulty_level: "Intermediate"
strategic_value: "High"

primary_submissions:
  - "SUB007"  # Kimura
  - "SUB012"  # Armbar from Kimura
  - "SUB034"  # Arm Triangle from Kimura

starting_positions:
  - "S005"  # Half Guard Top
  - "S004"  # Side Control
  - "S002"  # Closed Guard Bottom

submission_sequence:
  - "Establish Kimura grip"
  - "Create dilemma: defend kimura or defend back"
  - "If defend kimura → transition to armbar or back take"
  - "If defend back → finish kimura or arm triangle"
```

---

## Probabilistic Model

### Success Rate Calculation

**Base Formula:**
```python
def calculate_success_probability(
    transition: Transition,
    attacker: Fighter,
    defender: Fighter,
    context: GameState
) -> float:
    """
    Calculate dynamic success probability for technique execution
    """
    # Base success rate from transition data (by skill level)
    base_rate = transition.success_probability[attacker.skill_level]

    # Success modifiers from transition data
    modifiers = 0

    # 1. Setup Quality Modifier (+/- 10%)
    if context.setup_quality >= 0.8:
        modifiers += transition.success_modifiers['setup_quality']

    # 2. Timing Precision Modifier (+/- 15%)
    if context.timing_precision >= 0.7:
        modifiers += transition.success_modifiers['timing_precision']

    # 3. Opponent Fatigue Modifier (+/- 5%)
    fatigue_diff = defender.fatigue - attacker.fatigue
    if fatigue_diff > 20:
        modifiers += transition.success_modifiers['opponent_fatigue']

    # 4. Knowledge Test Modifier (+/- 10%)
    if context.knowledge_test_passed:
        modifiers += transition.success_modifiers['knowledge_test']

    # 5. Position Control Modifier (+/- 5%)
    if context.position_control_quality >= 0.8:
        modifiers += transition.success_modifiers['position_control']

    # 6. System Mastery Bonus (+/- 10%)
    if attacker.is_following_system(transition.system_chain):
        modifiers += 10

    # Calculate final probability
    final_probability = base_rate + modifiers

    # Clamp to valid range [0, 100]
    return max(0, min(100, final_probability))
```

### Skill Level Modifiers

**Success Rate Progression:**
```
Beginner (White Belt):
  - Defensive positions: 20-40% technique success
  - Offensive positions: 30-50% technique success
  - Submissions: 15-35% finish rate

Intermediate (Blue/Purple Belt):
  - Defensive positions: 40-65% technique success
  - Offensive positions: 50-75% technique success
  - Submissions: 40-65% finish rate

Advanced (Brown/Black Belt):
  - Defensive positions: 60-85% technique success
  - Offensive positions: 70-90% technique success
  - Submissions: 70-95% finish rate
```

**Validation Rule:**
```python
# Success rates must strictly increase by skill level
assert transition.success_probability['beginner'] <=
       transition.success_probability['intermediate'] <=
       transition.success_probability['advanced']
```

### Compound Probabilities

**Chain Success Calculation:**
```python
def calculate_chain_probability(path: List[Transition], skill_level: str) -> float:
    """
    Calculate probability of successfully completing a sequence of transitions
    """
    # Multiply individual probabilities
    total_probability = 1.0

    for transition in path:
        success_rate = transition.success_probability[skill_level] / 100.0
        total_probability *= success_rate

    return total_probability * 100
```

**Example:**
```python
# Path: Closed Guard Bottom → Hip Bump Sweep → Mount → Armbar from Mount → Won by Submission

transitions = [
    Transition("Hip Bump Sweep", success={'advanced': 85}),
    Transition("Mount Maintenance", success={'advanced': 80}),
    Transition("Armbar from Mount", success={'advanced': 70})
]

chain_success = calculate_chain_probability(transitions, 'advanced')
# Result: 0.85 × 0.80 × 0.70 = 0.476 = 47.6%
```

### Energy Cost Modeling

**Energy Depletion:**
```python
class EnergySystem:
    def calculate_energy_cost(self, transition: Transition, fighter: Fighter) -> float:
        """
        Calculate energy cost for technique execution
        """
        # Base cost from transition data
        base_cost = {
            'Low': 5,
            'Medium': 10,
            'High': 20
        }[transition.energy_cost]

        # Physical attribute modifiers
        strength_req = transition.physical_requirements['strength']
        if strength_req == 'High' and fighter.strength < 70:
            base_cost *= 1.5  # Weak fighter burns more energy

        flexibility_req = transition.physical_requirements['flexibility']
        if flexibility_req == 'High' and fighter.flexibility < 60:
            base_cost *= 1.3

        # Fatigue multiplier (tired fighters burn more energy)
        fatigue_multiplier = 1 + (fighter.fatigue / 100)

        return base_cost * fatigue_multiplier
```

### Dilemma Creation Model

**Craig Jones Philosophy:**
```python
def create_dilemma(position: Position, attacker: Fighter) -> Dilemma:
    """
    Create situations where all defensive options lead to problems
    """
    dilemma = Dilemma()

    # Get opponent's defensive options
    defensive_options = position.defensive_responses

    # For each defense, identify follow-up attacks
    for defense in defensive_options:
        follow_ups = position.dilemma_forks[defense.name]

        dilemma.add_branch(
            defense=defense,
            follow_ups=follow_ups,
            reasoning=f"If opponent defends {defense.name}, opens {follow_ups}"
        )

    return dilemma
```

**Example Dilemma (Ashi Garami):**
```yaml
position: "Ashi Garami"
primary_threat: "Heel Hook"

dilemma_forks:
  "hide_heel":
    opens: ["Back Take", "Leg Drag to Mount"]
    success_rate: 60
    energy_cost: 5

  "turn_away":
    opens: ["Heel Hook", "Toe Hold"]
    success_rate: 40
    energy_cost: 8

  "explosive_escape":
    opens: ["Re-entry", "Scramble"]
    success_rate: 30
    energy_cost: 20
```

---

## Relationship Types

### 1. Offensive Transitions (E_OFF)

**Definition**: Techniques attacker can execute from current position

**Format:**
```python
OffensiveTransition = {
    'source': 'S002',  # Closed Guard Bottom
    'target': 'S001',  # Mount
    'transition_id': 'T045',  # Hip Bump Sweep
    'category': 'sweep',
    'success_rate': {'beginner': 50, 'intermediate': 70, 'advanced': 85},
    'energy_cost': 'Low',
    'execution_time': 'Quick'
}
```

**Query:**
```python
def get_offensive_options(position_id: str, skill_level: str) -> List[Transition]:
    """Get all attacks available from position, sorted by success rate"""
    position = load_position(position_id)
    transitions = position.transitions['offensive']

    # Sort by success rate for skill level
    return sorted(transitions,
                  key=lambda t: t.success_rate[skill_level],
                  reverse=True)
```

### 2. Defensive Responses (E_DEF)

**Definition**: Techniques opponent can execute when you have position

**Format:**
```python
DefensiveResponse = {
    'source': 'S002',  # Closed Guard Bottom (when opponent is here)
    'target': 'S003',  # Closed Guard Top (counter-result)
    'technique': 'Posture Recovery',
    'success_rate': 45,
    'counter_category': 'posture'
}
```

### 3. Counter-Transitions (E_COUNTER)

**Definition**: Your responses to opponent's attacks

**Format:**
```python
CounterTransition = {
    'opponent_action': 'Guard Pass Attempt',
    'your_counter': 'Re-guard',
    'target_state': 'S002',  # Back to Closed Guard Bottom
    'success_rate': 50,
    'description': 'Counter when opponent tries to pass'
}
```

### 4. Submission Chains (E_CHAIN)

**Definition**: Sequential attack paths to finish

**Format:**
```python
SubmissionChain = [
    {'position': 'S002', 'action': 'Break posture'},
    {'position': 'S002', 'action': 'Control arm across centerline'},
    {'transition': 'T103', 'result': 'S201'},  # Triangle setup
    {'position': 'S201', 'action': 'Triangle Control'},
    {'submission': 'SUB015', 'result': 'Won by Submission'}  # Triangle Choke
]
```

### 5. Conceptual Relationships (E_CONCEPT)

**Definition**: Pedagogical links between concepts and techniques

**Format:**
```python
ConceptualLink = {
    'concept': 'C111',  # Base Maintenance
    'applies_to_positions': ['S001', 'S004', 'S018'],
    'applies_to_transitions': ['T045', 'T067'],
    'relationship': 'prerequisite|enhancement|alternative'
}
```

---

## Validation Rules

### 1. ID Uniqueness

**Rule**: Every state ID, transition ID, submission ID must be unique across entire knowledge graph

**Validation:**
```python
def validate_id_uniqueness(graph: KnowledgeGraph) -> List[ValidationError]:
    errors = []
    seen_ids = set()

    for node in graph.all_nodes():
        if node.id in seen_ids:
            errors.append(f"Duplicate ID: {node.id}")
        seen_ids.add(node.id)

    return errors
```

### 2. Wikilink Resolution

**Rule**: All `[[Position Name]]` and `[[Technique Name]]` wikilinks must resolve to actual content files

**Validation:**
```python
def validate_wikilinks(content_dir: Path) -> List[ValidationError]:
    errors = []

    # Build index of all valid page names
    valid_pages = {file.stem for file in content_dir.glob('**/*.md')}

    # Check each wikilink in each file
    for file in content_dir.glob('**/*.md'):
        content = file.read_text()
        wikilinks = extract_wikilinks(content)  # [[Page Name]] pattern

        for link in wikilinks:
            if link not in valid_pages and link != 'Won by Submission':
                errors.append(f"Broken wikilink in {file}: [[{link}]]")

    return errors
```

### 3. Success Rate Ordering

**Rule**: Success rates must strictly increase: Beginner ≤ Intermediate ≤ Advanced

**Validation:**
```python
def validate_success_rates(transition: Transition) -> List[ValidationError]:
    errors = []

    beginner = transition.success_probability['beginner']
    intermediate = transition.success_probability['intermediate']
    advanced = transition.success_probability['advanced']

    if not (beginner <= intermediate <= advanced):
        errors.append(
            f"Invalid success rate ordering in {transition.id}: "
            f"Beginner {beginner}% > Intermediate {intermediate}% > Advanced {advanced}%"
        )

    # Rates must be in valid range [0, 100]
    for level, rate in transition.success_probability.items():
        if not (0 <= rate <= 100):
            errors.append(f"Invalid {level} rate in {transition.id}: {rate}%")

    return errors
```

### 4. State Connectivity

**Rule**: All non-terminal states must have at least one outgoing edge (offensive transition)

**Validation:**
```python
def validate_state_connectivity(graph: KnowledgeGraph) -> List[ValidationError]:
    errors = []

    for node in graph.position_nodes():
        if node.is_terminal:
            continue

        outgoing_edges = graph.get_outgoing_edges(node.id)

        if len(outgoing_edges) == 0:
            errors.append(f"Dead-end state: {node.id} has no offensive transitions")

        if len(outgoing_edges) < 3:
            errors.append(f"Warning: {node.id} has only {len(outgoing_edges)} options")

    return errors
```

### 5. YAML Schema Compliance

**Rule**: All YAML frontmatter must match defined schema for content type

**Validation:**
```python
def validate_yaml_schema(file: Path, content_type: str) -> List[ValidationError]:
    errors = []
    yaml_data = parse_yaml_frontmatter(file)

    # Load schema for content type
    schema = load_schema(content_type)  # Position|Transition|Submission|Concept|System

    # Check required fields
    for required_field in schema.required_fields:
        if required_field not in yaml_data:
            errors.append(f"Missing required field in {file}: {required_field}")

    # Validate field types and formats
    for field, expected_type in schema.field_types.items():
        if field in yaml_data:
            actual_value = yaml_data[field]
            if not isinstance(actual_value, expected_type):
                errors.append(
                    f"Type mismatch in {file}.{field}: "
                    f"Expected {expected_type}, got {type(actual_value)}"
                )

    return errors
```

### 6. Safety Section Validation (Submissions)

**Rule**: All submission files MUST include comprehensive safety documentation

**Validation:**
```python
def validate_submission_safety(submission_file: Path) -> List[ValidationError]:
    errors = []
    content = submission_file.read_text()

    required_safety_sections = [
        'Safety Notice',
        'Injury Risks',
        'Application Speed',
        'Tap Recognition',
        'Release Protocol',
        'Training Progressions',
        'Safety Errors'
    ]

    for section in required_safety_sections:
        if section not in content:
            errors.append(f"Missing safety section in {submission_file}: {section}")

    # Check for safety emoji in first visible section
    if '⚠️' not in content[:1000]:
        errors.append(f"Missing safety warning emoji (⚠️) in {submission_file}")

    return errors
```

---

## Query Patterns

### 1. Finding Optimal Paths

**Query**: Find shortest path from State A to State B with highest compound success rate

```python
def find_optimal_path(
    graph: KnowledgeGraph,
    start: str,
    end: str,
    skill_level: str,
    max_depth: int = 5
) -> OptimalPath:
    """
    Dijkstra-style search with success probability as edge weight
    """
    # Priority queue: (negative_cumulative_probability, path, current_state)
    queue = [(0.0, [], start)]
    visited = set()
    best_paths = []

    while queue:
        neg_prob, path, current = heapq.heappop(queue)
        cumulative_prob = -neg_prob

        if current in visited or len(path) >= max_depth:
            continue

        visited.add(current)

        # Found target
        if current == end:
            best_paths.append((cumulative_prob, path))
            continue

        # Explore neighbors
        for transition in graph.get_outgoing_edges(current):
            if transition.target not in visited:
                # Calculate transition success rate
                success_rate = transition.success_probability[skill_level] / 100.0

                # Compound probability (multiply)
                new_prob = cumulative_prob * success_rate if path else success_rate

                # Add to queue (negative for max-heap)
                heapq.heappush(
                    queue,
                    (-new_prob, path + [transition], transition.target)
                )

    # Return best path
    if best_paths:
        return max(best_paths, key=lambda x: x[0])
    else:
        return None
```

**Example Usage:**
```python
# Find best path from Closed Guard Bottom to Won by Submission
path = find_optimal_path(
    graph=bjj_graph,
    start='S002',  # Closed Guard Bottom
    end='Won by Submission',
    skill_level='advanced',
    max_depth=5
)

# Result:
# Path: S002 → T103 → S201 → SUB015 → Won by Submission
# Compound Probability: 0.60 × 0.95 = 57%
```

### 2. Discovering Submission Chains

**Query**: Find all submission paths from current position

```python
def discover_submission_chains(
    graph: KnowledgeGraph,
    start_position: str,
    skill_level: str,
    min_probability: float = 0.3
) -> List[SubmissionChain]:
    """
    DFS search for all paths leading to submissions
    """
    chains = []

    def dfs(current: str, path: List, cumulative_prob: float):
        # Check if this is a submission
        if graph.is_submission(current):
            chains.append(SubmissionChain(
                path=path,
                probability=cumulative_prob,
                length=len(path)
            ))
            return

        # Explore outgoing transitions
        for transition in graph.get_outgoing_edges(current):
            success_rate = transition.success_probability[skill_level] / 100.0
            new_prob = cumulative_prob * success_rate

            # Prune low-probability paths
            if new_prob < min_probability:
                continue

            # Avoid cycles (max depth)
            if len(path) >= 6:
                continue

            dfs(transition.target, path + [transition], new_prob)

    dfs(start_position, [], 1.0)

    # Sort by probability (highest first)
    return sorted(chains, key=lambda c: c.probability, reverse=True)
```

### 3. Calculating Defensive Options

**Query**: Given opponent's position, what are my defensive options?

```python
def get_defensive_options(
    graph: KnowledgeGraph,
    opponent_position: str,
    my_skill_level: str
) -> List[DefensiveOption]:
    """
    Get all defensive responses available when opponent has position
    """
    position = graph.get_position(opponent_position)

    # Get defensive responses from position data
    defensive_responses = position.defensive_responses

    # Sort by success rate
    options = []
    for response in defensive_responses:
        options.append(DefensiveOption(
            technique=response.name,
            target_state=response.target_state,
            success_rate=response.success_rate,
            category=response.counter_category,
            description=response.description
        ))

    return sorted(options, key=lambda o: o.success_rate, reverse=True)
```

### 4. Analyzing Decision Trees

**Query**: Given current position and opponent action, what should I do?

```python
def evaluate_decision_tree(
    position: Position,
    opponent_state: OpponentState,
    context: GameState
) -> Recommendation:
    """
    Traverse decision tree to find best response
    """
    # Get decision tree from position
    decision_tree = position.decision_tree

    # Sort by priority
    sorted_conditions = sorted(decision_tree, key=lambda c: c.priority)

    # Evaluate conditions in order
    for condition in sorted_conditions:
        # Check if condition matches opponent state
        if evaluate_condition(condition, opponent_state, context):
            # Return recommended actions
            return Recommendation(
                condition=condition.condition,
                actions=condition.actions,
                reasoning=condition.actions[0].reasoning
            )

    # Fallback to default
    return Recommendation(
        condition="default",
        actions=sorted_conditions[-1].actions,
        reasoning="No specific condition matched"
    )
```

### 5. System-Based Queries

**Query**: Find all techniques belonging to a specific system (e.g., Danaher Back System)

```python
def get_system_techniques(
    graph: KnowledgeGraph,
    system_id: str
) -> SystemComponents:
    """
    Extract all positions, transitions, submissions in system
    """
    system = graph.get_system(system_id)

    components = SystemComponents(
        system_name=system.system_name,
        positions=[],
        transitions=[],
        submissions=[]
    )

    # Get positions
    for position_id in system.starting_positions:
        components.positions.append(graph.get_position(position_id))

    # Get transitions
    for transition_id in system.core_transitions:
        components.transitions.append(graph.get_transition(transition_id))

    # Get submissions
    for submission_id in system.primary_submissions:
        components.submissions.append(graph.get_submission(submission_id))

    return components
```

---

## Integration with Game Engine

### Game Engine Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Game Engine Core                      │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ State        │  │ Probability  │  │ Energy       │ │
│  │ Manager      │  │ Calculator   │  │ System       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Decision     │  │ Dilemma      │  │ Knowledge    │ │
│  │ Tree Engine  │  │ Creator      │  │ Checker      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Knowledge Graph Interface                  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Position     │  │ Transition   │  │ AI Opponent  │ │
│  │ Loader       │  │ Validator    │  │ Model        │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Markdown/YAML Content Layer                │
│                                                         │
│  211 Positions  │  202 Transitions  │  149 Submissions │
└─────────────────────────────────────────────────────────┘
```

### Data Loading Pipeline

```python
class GameEngineLoader:
    """Load knowledge graph data for game engine"""

    def __init__(self, content_directory: Path):
        self.content_dir = content_directory
        self.graph = self.load_graph()

    def load_graph(self) -> KnowledgeGraph:
        """Parse all markdown files and build graph"""
        graph = KnowledgeGraph()

        # Load positions
        for file in (self.content_dir / "Positions").glob("*.md"):
            if file.stem.startswith('CONTRIBUTING'):
                continue

            yaml_data, markdown = self.parse_file(file)
            position = self.parse_position(yaml_data, markdown)
            graph.add_position(position)

        # Load transitions
        for file in (self.content_dir / "Transitions").glob("*.md"):
            if file.stem.startswith('CONTRIBUTING'):
                continue

            yaml_data, markdown = self.parse_file(file)
            transition = self.parse_transition(yaml_data, markdown)
            graph.add_transition(transition)

        # Load submissions
        for file in (self.content_dir / "Submissions").glob("*.md"):
            if file.stem.startswith('CONTRIBUTING'):
                continue

            yaml_data, markdown = self.parse_file(file)
            submission = self.parse_submission(yaml_data, markdown)
            graph.add_submission(submission)

        # Build edges from position transitions
        self.build_edges(graph)

        return graph

    def parse_file(self, file: Path) -> Tuple[Dict, str]:
        """Extract YAML frontmatter and markdown content"""
        content = file.read_text()

        # Split frontmatter from content
        if content.startswith('---'):
            parts = content.split('---', 2)
            yaml_text = parts[1]
            markdown_text = parts[2] if len(parts) > 2 else ""

            yaml_data = yaml.safe_load(yaml_text)
            return yaml_data, markdown_text
        else:
            return {}, content
```

### Turn-Based Execution

```python
class BJJGameTurn:
    """Represents single turn in BJJ simulation"""

    def execute_turn(
        self,
        attacker: Fighter,
        defender: Fighter,
        position: Position,
        chosen_action: Transition
    ) -> TurnResult:
        """
        Execute one turn: attacker attempts technique, defender reacts
        """
        # 1. Calculate success probability
        success_prob = self.calculate_success_probability(
            chosen_action,
            attacker,
            defender,
            self.game_state
        )

        # 2. Roll for success
        roll = random.randint(0, 100)
        success = roll <= success_prob

        if success:
            # Technique succeeds
            new_position = self.graph.get_position(chosen_action.ending_state)

            # Apply energy cost
            energy_cost = self.calculate_energy_cost(chosen_action, attacker)
            attacker.energy -= energy_cost

            # Update game state
            self.game_state.current_position = new_position
            self.game_state.position_holder = attacker

            return TurnResult(
                success=True,
                new_position=new_position,
                energy_cost=energy_cost,
                narration=self.generate_success_narration(chosen_action)
            )

        else:
            # Technique fails - opponent counters
            counter = self.select_opponent_counter(
                defender,
                chosen_action,
                position
            )

            if counter:
                new_position = self.graph.get_position(counter.target_state)

                return TurnResult(
                    success=False,
                    new_position=new_position,
                    counter_technique=counter.name,
                    narration=self.generate_failure_narration(chosen_action, counter)
                )
            else:
                # Maintain current position
                return TurnResult(
                    success=False,
                    new_position=position,
                    narration=self.generate_stalemate_narration()
                )
```

### AI Opponent Model

```python
class AIOpponentModel:
    """AI decision-making using knowledge graph"""

    def choose_defense(
        self,
        position: Position,
        attacker: Fighter,
        defender: Fighter
    ) -> DefensiveAction:
        """
        AI selects defensive response using decision tree
        """
        # Get available defensive options
        options = position.defensive_responses

        # Evaluate each option using decision tree
        scored_options = []
        for option in options:
            score = self.evaluate_defensive_option(
                option,
                attacker,
                defender,
                position
            )
            scored_options.append((score, option))

        # Select best option (with some randomness)
        scored_options.sort(key=lambda x: x[0], reverse=True)

        # Weighted random selection favoring higher-scored options
        weights = [score for score, _ in scored_options]
        selected = random.choices(scored_options, weights=weights, k=1)[0]

        return DefensiveAction(
            technique=selected[1].name,
            target_state=selected[1].target_state,
            reasoning=f"AI chose {selected[1].name} (score: {selected[0]:.2f})"
        )

    def evaluate_defensive_option(
        self,
        option: DefensiveResponse,
        attacker: Fighter,
        defender: Fighter,
        position: Position
    ) -> float:
        """
        Score defensive option based on multiple factors
        """
        score = 0.0

        # 1. Success rate of defense
        score += option.success_rate / 100.0 * 40

        # 2. Energy cost consideration
        energy_cost = self.estimate_energy_cost(option)
        if defender.energy > energy_cost:
            score += 20
        else:
            score -= 10  # Penalize if low energy

        # 3. Knowledge check (does AI know this defense?)
        if option.name in defender.known_techniques:
            score += 15
        else:
            score -= 20  # Penalize unknown techniques

        # 4. Strategic value (does this lead to better position?)
        target_position = self.graph.get_position(option.target_state)
        if target_position.point_value > position.point_value:
            score += 25  # Reward improving position

        return score
```

---

## Implementation Examples

### Complete Example: Querying Optimal Submission Path

```python
# Initialize knowledge graph
from bjjgraph import KnowledgeGraph

graph = KnowledgeGraph(content_directory="source/content")

# Find optimal submission path from Closed Guard Bottom
optimal_path = graph.find_optimal_submission_path(
    start_position="S002",  # Closed Guard Bottom
    skill_level="advanced",
    min_probability=0.30
)

# Result:
print(f"Optimal Path: {optimal_path.path_description}")
# "Closed Guard Bottom → Triangle Choke Setup → Triangle Control → Triangle Choke → Won by Submission"

print(f"Compound Probability: {optimal_path.probability:.2%}")
# "Compound Probability: 57.00%"

print(f"Path Length: {optimal_path.length} transitions")
# "Path Length: 3 transitions"

print("\nDetailed Steps:")
for i, transition in enumerate(optimal_path.transitions, 1):
    print(f"{i}. {transition.name}")
    print(f"   From: {transition.starting_state}")
    print(f"   To: {transition.ending_state}")
    print(f"   Success Rate: {transition.success_probability['advanced']}%")
    print()

# Output:
# 1. Triangle Choke from Closed Guard
#    From: Closed Guard Bottom (S002)
#    To: Triangle Control (S201)
#    Success Rate: 60%
#
# 2. Triangle Control Maintenance
#    From: Triangle Control (S201)
#    To: Triangle Control (S201)
#    Success Rate: 95%
#
# 3. Triangle Choke Finish
#    From: Triangle Control (S201)
#    To: Won by Submission
#    Success Rate: 95%
```

### Example: Game Engine Integration

```python
# Initialize game engine with knowledge graph
from bjjgraph_game import GameEngine

engine = GameEngine(knowledge_graph=graph)

# Create fighters
player = Fighter(
    name="Player",
    skill_level="advanced",
    energy=100,
    known_techniques=["Hip Bump Sweep", "Triangle Choke", "Armbar"]
)

opponent = Fighter(
    name="AI Opponent",
    skill_level="intermediate",
    energy=100,
    known_techniques=["Guard Pass", "Posture Recovery"]
)

# Start match from standing
game_state = engine.start_match(player, opponent)

# Player attempts guard pull
result = engine.execute_turn(
    attacker=player,
    action="Guard Pull",
    current_state=game_state
)

if result.success:
    print(f"Success! New position: {result.new_position.name}")
    # "Success! New position: Closed Guard Bottom"

    # Get available attacks from this position
    attacks = engine.get_available_attacks(
        position=result.new_position,
        skill_level=player.skill_level
    )

    print(f"\nAvailable attacks:")
    for attack in attacks[:5]:
        print(f"- {attack.name}: {attack.success_probability['advanced']}% success")

    # Output:
    # Available attacks:
    # - Hip Bump Sweep: 85% success
    # - Triangle Choke from Closed Guard: 60% success
    # - Armbar from Closed Guard: 55% success
```

---

## ASCII Diagrams

### State Machine Graph Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    BJJ State Machine                        │
└─────────────────────────────────────────────────────────────┘

       [Standing]
       (S000)
           │
           │ T814: Guard Pull
           │ (Beginner: 70%, Intermediate: 80%, Advanced: 90%)
           ↓
    [Closed Guard Bottom]
    (S002)
    Point Value: 0
    Position Type: Defensive/Offensive
           │
           ├─── T045: Hip Bump Sweep (55%/70%/85%) ───→ [Mount] (S001)
           │                                                │
           ├─── T103: Triangle Setup (25%/40%/60%) ────→ [Triangle Control] (S201)
           │                                                │
           ├─── T067: Scissor Sweep (35%/50%/65%) ─────→ [Side Control] (S004)
           │
           ↓
    [Mount]
    (S001)
    Point Value: 4
    Position Type: Offensive
           │
           ├─── T201: Armbar from Mount (50%/70%/85%) ─→ [Armbar Control] (S202)
           │                                                │
           │                                                ↓
           │                                             [Won by Submission]
           │                                             (Terminal State)
           │
           └─── T156: High Mount (60%/75%/90%) ────────→ [High Mount] (S008)
```

### Transition Probability Flow

```
┌─────────────────────────────────────────────────────────────────┐
│         Probabilistic Transition Calculation                    │
└─────────────────────────────────────────────────────────────────┘

Base Success Rate (from transition data)
    │
    │  Skill Level = "Advanced"
    │  Transition T045 (Hip Bump Sweep)
    ↓
  85% ───────────────────────────────────┐
                                          │
    Success Modifiers:                    │
                                          │
    + Setup Quality (+10%)        ───────┤
    + Timing Precision (+15%)     ───────┤
    + Opponent Fatigue (+5%)      ───────┤  → Calculate Final
    + Knowledge Test (+10%)       ───────┤     Probability
    + Position Control (+5%)      ───────┤
    + System Mastery (+10%)       ───────┤
                                          │
Final Probability: 85% + 55% = 140% → Clamped to 100%
                                          │
                                          ↓
                              ┌───────────────────────┐
                              │  Roll Random(0, 100)  │
                              └───────────────────────┘
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                          Roll ≤ 100%             Roll > 100%
                          (Success)               (Impossible)
                              │
                              ↓
                    Transition to Mount (S001)
```

### Content Pipeline (Markdown → State Machine)

```
┌────────────────────────────────────────────────────────────────┐
│                   Content Pipeline Flow                        │
└────────────────────────────────────────────────────────────────┘

Source Files                 Parser              Knowledge Graph
━━━━━━━━━━━━                 ━━━━━━              ━━━━━━━━━━━━━━━

Positions/*.md   ─────→  YAML Parser  ─────→  PositionNode
  └─ S002.md           │                       │ id: "S002"
  └─ frontmatter       │                       │ name: "Closed Guard"
  └─ markdown          │                       │ properties: {...}
                       │                       │ transitions: [...]
                       │                       │
Transitions/*.md ─────→  YAML Parser  ─────→  TransitionMetadata
  └─ T045.md           │                       │ id: "T045"
  └─ frontmatter       │                       │ name: "Hip Bump"
  └─ markdown          │                       │ success_rates: {...}
                       │                       │
Submissions/*.md ─────→  YAML Parser  ─────→  SubmissionNode
  └─ SUB001.md         │                       │ id: "SUB001"
  └─ frontmatter       │                       │ name: "RNC"
  └─ markdown          │                       │ safety: {...}
                       │                       │
                       ↓                       ↓

              Graph Builder
              ━━━━━━━━━━━━━━
              │ 1. Create nodes
              │ 2. Create edges from transitions
              │ 3. Validate connectivity
              │ 4. Build indices
              │
              ↓

┌────────────────────────────────────────────────────────────────┐
│              Complete Knowledge Graph                          │
│                                                                │
│  Nodes: 562+  │  Edges: 2000+  │  Success Rates: 6000+       │
│                                                                │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐             │
│  │ Position │────▶│Transition│────▶│Submission│             │
│  │  Nodes   │     │ Metadata │     │  Nodes   │             │
│  └──────────┘     └──────────┘     └──────────┘             │
└────────────────────────────────────────────────────────────────┘
              │
              │ Used by:
              │
              ├─── Game Engine (turn-based simulation)
              ├─── AI Opponent (decision-making)
              ├─── Web Application (visualization)
              └─── LLM Context (narrative generation)
```

---

## Version History

**Version 2.0** (October 2025)
- Complete formal specification with state machine definition
- Probabilistic model with compound calculations
- Entity type definitions for all 5 content types
- Validation rules and query patterns
- Game engine integration architecture
- ASCII diagrams for visualization

**Version 1.0** (2024)
- Initial graph structure
- Basic node and edge definitions
- Simple success rate tracking

---

## References

**Internal Documentation:**
- [CONTRIBUTING-YAML-SCHEMA.md](source/content/CONTRIBUTING-YAML-SCHEMA.md) - Complete YAML structure
- [CONTRIBUTING-POSITIONS.md](source/content/Positions/CONTRIBUTING-POSITIONS.md) - Position standard
- [CONTRIBUTING-TRANSITIONS.md](source/content/Transitions/CONTRIBUTING-TRANSITIONS.md) - Transition standard
- [game-engine-design.md](docs/design/game-engine-design.md) - Game engine architecture

**External Resources:**
- Graph Theory: Directed Weighted Graphs
- Probabilistic State Machines
- Knowledge Graph Standards (Schema.org, RDF)

---

**Document Maintained By**: BJJ Graph Project
**Status**: Production Ready
**Last Updated**: October 2025
