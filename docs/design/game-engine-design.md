# BJJGraph Structure Overview

## Executive Summary
BJJGraph.org is a state machine for BJJ positions that needs unified data structures, probabilistic modeling, and gamification for game development.

## Current State

### ✅ Strengths
- **Graph Architecture**: Nodes (S001-S018+) and transitions (T601+) with clear relationships
- **Expert Content**: Embedded insights from top practitioners
- **Decision Logic**: Clear if/else position selection trees

### ⚠️ Issues
- **Data Inconsistency**: Duplicate entries ("Guard Pull" T601 vs T814), varying schema formats
- **Missing Metrics**: Incomplete energy costs, success rates, attribute dependencies, fatigue models



---

## Design Philosophy

### Craig Jones Perspective
> "Modern game is about creating dilemmas, not linear paths. Every position needs reaction branches based on defensive patterns."

**Key Concepts:**
- Defensive reactions create follow-up opportunities
- False entries and baiting mechanisms
- Multi-layered decision trees

### John Danaher Perspective
> "Technique vs system - positions are dynamic problem-solution frameworks, not static nodes."

**Key Concepts:**
- Prerequisite knowledge gates (frames, angles, distance)
- Opponent modeling & skill differentials
- Depth over breadth in technical understanding

---

## Implementation Framework

### 1. Position Schema

```python
class Position:
    id: str
    system_family: str  # "leg_entanglement", "guard", "pin"

    # Danaher's "Problem-Solution Framework"
    problems_presented: List[Problem]  # What threats you create
    problems_faced: List[Problem]  # What you must solve

    # Craig's "Dilemma Creation"
    dilemma_forks: Dict[str, List[Transition]]  # If they defend A → B,C open
    false_paths: List[str]  # Bait transitions to set up real attacks

    # Energy/Cooking System
    energy_burn_rate: Dict[str, float] = {
        'maintainer': 2.0,  # per second for position holder
        'defender': 3.5,    # defender burns more (getting "cooked")
        'explosive_escape_multiplier': 5.0  # burst attempts
    }

    # Danaher's "Mechanical Principles"
    control_vectors: List[Vector3D]  # Force application points
    leverage_ratio: float  # Mechanical advantage
    stability_score: float  # How hard to destabilize

    # Skill Differential Impact (Danaher's opponent modeling)
    skill_scaling: SkillFunction  # How technique level affects success
    knowledge_gates: List[str]  # Concepts that unlock true potential

    # Craig's Meta-Game Awareness
    meta_tier: int  # 1=fundamental, 2=modern, 3=cutting-edge
    popularity_index: float  # How often seen in competition
    counter_development: float  # How well-studied the counters are

class Transition:
    id: str
    system_chain: str  # "danaher_leg_system", "craig_false_reap_series"

    # Multi-layered Success Calculation
    def calculate_success(self, attacker: Fighter, defender: Fighter, context: GameState):
        base = self.base_success_rate

        # Danaher's Systematic Approach
        system_bonus = attacker.system_mastery[self.system_chain] * 0.3

        # Skill differential (Danaher emphasis)
        skill_diff = (attacker.technical_knowledge - defender.technical_knowledge)
        skill_modifier = sigmoid(skill_diff) * 0.4

        # Craig's Deception/Setup bonus
        setup_quality = self.calculate_setup_quality(context.previous_moves)
        deception_bonus = setup_quality * 0.2

        # Fatigue differential (cooking concept)
        fatigue_diff = defender.fatigue - attacker.fatigue
        fatigue_modifier = fatigue_diff * 0.15

        # Knowledge check (does defender know the counter?)
        if self.id in defender.known_counters:
            knowledge_penalty = -0.3
        else:
            knowledge_penalty = 0

        return base + system_bonus + skill_modifier + deception_bonus +
               fatigue_modifier + knowledge_penalty

    # Craig's Reaction Tree
    reaction_branches: Dict[str, ReactionChain] = {
        'defensive_frame': ReactionChain(
            initial_defense='frame',
            attacker_followup=['strip_frame', 'change_angle', 'false_retreat'],
            creates_openings=['back_exposure', 'arm_isolation']
        ),
        'explosive_escape': ReactionChain(
            initial_defense='bridge',
            energy_cost=20,  # High cost for defender
            attacker_followup=['ride_bridge', 'switch_sides'],
            creates_openings=['mount', 'back_take']
        )
    }
```

### 2. Fighter Model

```python
class Fighter:
    # Physical Attributes (D&D style + BJJ specific)
    attributes: Dict[str, float] = {
        'strength': 75,
        'flexibility': 60,
        'cardio_capacity': 100,  # Max energy pool
        'explosiveness': 70,  # Burst movement capability
        'grip_endurance': 80,  # Specific to gi game
        'pressure_generation': 65,  # Top game cooking ability
        'frame_strength': 70,  # Defensive structure
        'hip_mobility': 75,  # Guard retention/passing
    }

    # Danaher's Knowledge System
    technical_knowledge: TechnicalProfile = {
        'systems_understood': ['danaher_legs', 'gordon_passing'],
        'mechanical_principles': {
            'wedges': 0.8,  # Understanding level 0-1
            'levers': 0.6,
            'fulcrums': 0.7,
            'spirals': 0.4,  # Advanced concepts
        },
        'position_depth': {  # Depth vs breadth
            'back_control': 0.9,  # Specialist
            'mount': 0.5,  # Competent
            'leg_entanglements': 0.3,  # Novice
        }
    }

    # Craig's Game Style Attributes
    game_style: GameStyle = {
        'deception_tendency': 0.8,  # How often they bait
        'aggression': 0.6,
        'risk_tolerance': 0.7,
        'pattern_recognition': 0.75,  # Reading opponents
        'improvisation': 0.65,  # Handling unexpected
    }

    # Energy/Fatigue System (Advanced Cooking)
    energy_state: EnergyState = {
        'current_energy': 85,
        'aerobic_threshold': 60,  # Below this, slow recovery
        'anaerobic_capacity': 30,  # Burst energy available
        'lactic_buildup': 0,  # Reduces all physical attributes
        'recovery_rate': 2.0,  # Per second when not engaged
        'heat_accumulation': 0,  # Being "cooked" under pressure
    }

    # Adaptive Learning (During Match)
    match_adaptations: MatchLearning = {
        'opponent_patterns': [],  # Recognized sequences
        'successful_counters': [],  # What worked
        'failed_attempts': [],  # What to avoid
        'energy_expenditure_model': None,  # Predicting opponent fatigue
    }
```

### 3. Game Engine

```python
class BJJGameEngine:
    def __init__(self):
        self.dilemma_engine = DilemmaEngine()
        self.cooking_system = CookingSystem()
        self.knowledge_checker = KnowledgeChecker()

    def process_position(self, attacker: Fighter, defender: Fighter,
                        position: Position, elapsed_time: float):
        """Core game loop for position management"""

        # 1. Energy Depletion (Cooking System)
        if position.is_pressure_position:
            # Defender gets "cooked" faster
            defender_burn = position.energy_burn_rate['defender'] * elapsed_time

            # Heat accumulation makes everything harder
            if defender.energy_state['heat_accumulation'] > 50:
                defender_burn *= 1.5  # Exponential cooking

            defender.energy_state['current_energy'] -= defender_burn
            defender.energy_state['heat_accumulation'] += elapsed_time * 2

            # Attacker maintains with less effort
            attacker_burn = position.energy_burn_rate['maintainer'] * elapsed_time
            attacker.energy_state['current_energy'] -= attacker_burn

        # 2. Craig's Dilemma Creation
        available_dilemmas = self.dilemma_engine.get_dilemmas(position, attacker, defender)

        if available_dilemmas:
            # Force defender to choose (each choice opens different attacks)
            defender_choice = self.ai_choose_defense(defender, available_dilemmas)

            # This creates openings based on Craig's philosophy
            created_openings = position.dilemma_forks[defender_choice]
            attacker.available_transitions.extend(created_openings)

        # 3. Danaher's Systematic Progression
        if attacker.is_following_system(position.system_family):
            # Bonus for following a complete system vs random techniques
            system_progression_bonus = 0.2
            attacker.next_transition_bonus = system_progression_bonus

        # 4. Knowledge Differential
        knowledge_gap = self.knowledge_checker.compare(
            attacker.technical_knowledge,
            defender.technical_knowledge,
            position
        )

        if knowledge_gap > 0.3:  # Significant knowledge advantage
            # Defender doesn't know the position well
            defender.reaction_time *= 1.5  # Slower reactions
            defender.available_defenses = defender.available_defenses[:2]  # Fewer options

        return GameState(
            dominance_score=self.calculate_dominance(attacker, defender, position),
            available_actions=self.get_weighted_options(attacker, created_openings),
            fatigue_projection=self.project_fatigue_timeline(attacker, defender)
        )
```

### 4. Dilemma Engine

```python
class DilemmaEngine:
    """Creates situations where all defensive options lead to problems"""

    def create_leg_entanglement_dilemma(self, position: str) -> Dilemma:
        if position == "ashi_garami":
            return Dilemma(
                threat_primary="heel_exposure",
                threat_secondary="back_exposure",
                defender_options={
                    'hide_heel': {
                        'opens': ['back_take', 'leg_drag'],
                        'energy_cost': 5,
                        'success_rate': 0.6
                    },
                    'turn_away': {
                        'opens': ['heel_hook', 'toe_hold'],
                        'energy_cost': 8,
                        'success_rate': 0.4
                    },
                    'explosive_escape': {
                        'opens': ['re_entry', 'scramble'],
                        'energy_cost': 20,
                        'success_rate': 0.3
                    }
                },
                craig_comment="See how they're fucked either way? That's the game."
            )

    def create_pressure_dilemma(self, top_position: str) -> Dilemma:
        """Gordon Ryan style pressure cooking"""
        return Dilemma(
            threat_primary="crossface_pressure",
            threat_secondary="mount_transition",
            cooking_rate=3.5,  # High energy burn for defender
            defender_options={
                'frame': {
                    'opens': ['arm_isolation', 'kimura'],
                    'energy_cost': 12,  # Maintaining frames is exhausting
                    'muscle_groups': ['shoulders', 'core'],
                    'lactic_buildup': 2.0
                },
                'bridge': {
                    'opens': ['mount', 'back_transition'],
                    'energy_cost': 25,  # Explosive but draining
                    'muscle_groups': ['hips', 'core', 'legs'],
                    'lactic_buildup': 5.0
                },
                'accept_pressure': {
                    'opens': ['slow_submission_setup'],
                    'energy_cost': 3,  # Low immediate cost
                    'heat_accumulation': 5.0,  # But you're getting cooked
                    'mental_fatigue': 3.0  # Psychological impact
                }
            }
        )
```

### 5. Cooking System

```python
class CookingSystem:
    """Implements systematic exhaustion strategy"""

    def calculate_cooking_rate(self, position: Position,
                              top_player: Fighter,
                              bottom_player: Fighter) -> CookingRate:

        base_cooking = position.pressure_index

        # Weight differential matters for pressure
        weight_advantage = (top_player.weight - bottom_player.weight) / bottom_player.weight
        weight_modifier = max(0, weight_advantage * 0.3)

        # Technical pressure generation (Gordon Ryan style)
        pressure_skill = top_player.attributes['pressure_generation'] / 100

        # Defensive efficiency reduces cooking
        frame_quality = bottom_player.attributes['frame_strength'] / 100
        defensive_reduction = frame_quality * 0.4

        # Heat accumulation makes it exponentially worse
        heat_multiplier = 1 + (bottom_player.energy_state['heat_accumulation'] / 100)

        total_cooking_rate = (base_cooking + weight_modifier) * pressure_skill *
                           heat_multiplier * (1 - defensive_reduction)

        return CookingRate(
            energy_per_second=total_cooking_rate,
            heat_gain=total_cooking_rate * 0.5,
            muscle_groups_affected=position.pressure_targets,
            psychological_impact=total_cooking_rate * 0.3
        )

    def apply_heat_effects(self, fighter: Fighter):
        """Heat accumulation degrades performance"""
        heat = fighter.energy_state['heat_accumulation']

        if heat > 30:
            fighter.attributes['explosiveness'] *= 0.8
            fighter.reaction_time *= 1.2

        if heat > 60:
            fighter.attributes['strength'] *= 0.7
            fighter.technical_knowledge.recall_speed *= 0.8  # Can't think clearly
            fighter.available_transitions = fighter.available_transitions[:3]  # Tunnel vision

        if heat > 80:
            # Desperation mode - only explosive escapes available
            fighter.forced_options = ['explosive_escape', 'tap']
            fighter.injury_risk *= 2.0  # More likely to get hurt when exhausted
```

### 6. System Mastery

```python
class SystemMastery:
    """Deep understanding of connected techniques vs surface knowledge"""

    systems = {
        'danaher_back_system': {
            'core_positions': ['back_control', 'turtle', 'truck'],
            'core_principles': ['shoulder_line_control', 'hip_connection', 'hand_fighting'],
            'submission_chain': ['rnc', 'short_choke', 'bow_arrow', 'armbar'],
            'prerequisite_knowledge': ['frame_theory', 'weight_distribution'],
            'mastery_levels': {
                0.0: "Knows RNC exists",
                0.3: "Can maintain back control",
                0.5: "Understands hand fighting",
                0.7: "Chains submissions systematically",
                0.9: "Anticipates all escape routes",
                1.0: "Creates novel solutions within system"
            }
        },
        'craig_leg_system': {
            'core_positions': ['ashi', 'outside_ashi', 'cross_ashi', '50_50', 'inside_sankaku'],
            'core_principles': ['heel_exposure', 'knee_line_control', 'hip_pinning'],
            'dilemma_creation': ['false_reap', 'heel_slip_bait', 'backstep_threat'],
            'prerequisite_knowledge': ['leg_anatomy', 'breaking_mechanics'],
            'mastery_levels': {
                0.0: "Knows heel hooks exist",
                0.3: "Can enter basic ashi",
                0.5: "Understands exposure mechanics",
                0.7: "Creates defensive dilemmas",
                0.9: "Flows between all entanglements",
                1.0: "Innovates new entries and finishes"
            }
        }
    }

    def calculate_system_bonus(self, fighter: Fighter, technique: Transition) -> float:
        system = technique.system_chain
        mastery = fighter.system_mastery.get(system, 0)

        # Following a system gives compound benefits
        if self.is_in_system_flow(fighter.recent_moves, system):
            flow_bonus = 0.2
        else:
            flow_bonus = 0

        # Deep knowledge vs surface knowledge
        depth_multiplier = mastery ** 2  # Exponential benefit for deep study

        return depth_multiplier * 0.4 + flow_bonus
```

### 7. Meta Layer

```python
class MetaEvolution:
    """How the game evolves as players discover counters"""

    def update_global_meta(self, match_results: List[MatchData]):
        """Techniques become less effective as counters are developed"""

        for match in match_results:
            for technique_used in match.techniques:
                # Popular techniques get studied and countered
                technique_used.popularity_index += 0.01

                if technique_used.popularity_index > 0.7:
                    # Everyone knows the counter now
                    technique_used.base_success_rate *= 0.95
                    technique_used.counter_development += 0.05

                # But this opens up forgotten techniques
                for old_technique in self.get_related_techniques(technique_used):
                    if old_technique.popularity_index < 0.3:
                        old_technique.surprise_factor += 0.1

    def ai_strategy_selection(self, ai_fighter: Fighter, opponent_profile: Profile) -> Strategy:
        """AI chooses strategy based on meta knowledge"""

        if opponent_profile.style == 'modern_leg_locker':
            # Counter with wrestling-heavy top game
            return Strategy('pressure_cooking', avoid='leg_entanglements')

        elif opponent_profile.style == 'traditional_guard_player':
            # Modern leg lock entries they won't expect
            return Strategy('leg_hunting', entries='unconventional')

        elif opponent_profile.fatigue_management == 'poor':
            # Cook them systematically
            return Strategy('gordon_ryan_pressure', pace='relentless')
```

---

## Quick Reference Links

- **Core Systems**: [Position Schema](#1-position-schema) · [Fighter Model](#2-fighter-model) · [Game Engine](#3-game-engine)
- **Advanced Mechanics**: [Dilemma Engine](#4-dilemma-engine) · [Cooking System](#5-cooking-system) · [System Mastery](#6-system-mastery)
- **Strategy**: [Meta Layer](#7-meta-layer)

---

**Philosophy**: Create systematic problems that compound over time—strategic depth through interconnected systems, not isolated techniques.
