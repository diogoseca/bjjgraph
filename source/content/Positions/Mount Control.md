---
title: "Mount Control | BJJ Position Guide | BJJ Graph"
description: "Master Mount Control in BJJ. Systematic approach to maintaining and attacking from mount position. Success rates: Beginner 55%, Intermediate 70%, Advanced 85%."

state_machine:
  state_id: S238
  position_name: "Mount Control"
  alternative_names: ["Mount Maintenance", "Mount Position", "Controlled Mount"]
  properties:
    point_value: 4
    position_type: "Controlling/Dominant"
    risk_level: "Low"
    energy_cost: "Medium"
    time_sustainability: "Long"
  metrics:
    position_retention_rate: {beginner: 55, intermediate: 70, advanced: 85}
    advancement_probability: {beginner: 45, intermediate: 60, advanced: 75}
    submission_probability: {beginner: 50, intermediate: 65, advanced: 80}
    position_loss_probability: {beginner: 30, intermediate: 20, advanced: 10}
    average_time_in_position: "2-3 minutes"
  invariants:
    - "Straddling opponent's torso from top position"
    - "Both knees on ground on either side of opponent"
    - "Opponent flat on back with limited mobility"
  offensive_transitions:
    - {technique: "High Mount Transition", target_state: "High Mount", transition_id: "T380", success_rate: {beginner: 45, intermediate: 60, advanced: 75}}
    - {technique: "S-Mount Transition", target_state: "S-Mount", transition_id: "T381", success_rate: {beginner: 40, intermediate: 55, advanced: 70}}
    - {technique: "Technical Mount", target_state: "Technical Mount", transition_id: "T382", success_rate: {beginner: 35, intermediate: 50, advanced: 65}}
    - {technique: "Armbar from Mount", target_state: "Armbar Control", transition_id: "T383", success_rate: {beginner: 35, intermediate: 50, advanced: 65}}
    - {technique: "Cross Collar Choke", target_state: "Won by Submission", transition_id: "T384", success_rate: {beginner: 30, intermediate: 45, advanced: 60}}
    - {technique: "Ezekiel Choke", target_state: "Won by Submission", transition_id: "T385", success_rate: {beginner: 25, intermediate: 40, advanced: 55}}
  defensive_responses:
    - {technique: "Elbow Escape", target_state: "Half Guard Bottom", success_rate: 25}
    - {technique: "Bridge and Roll", target_state: "Guard Recovery", success_rate: 20}
  decision_tree:
    - condition: "Opponent flat on back with good control"
      options:
        - {action: "High Mount Transition", target: "High Mount", probability: 60}
        - {action: "Cross Collar Choke", target: "Won by Submission", probability: 45}
    - condition: "Opponent attempting to escape"
      options:
        - {action: "S-Mount Transition", target: "S-Mount", probability: 55}
        - {action: "Technical Mount", target: "Technical Mount", probability: 50}
  energy_dynamics:
    maintainer_burn_rate: 2.0
    defender_burn_rate: 3.5
    explosive_escape_multiplier: 4.5
    cooking_rate: 2.5
  related_states: ["High Mount", "S-Mount", "Technical Mount", "Side Control", "Back Control"]
---

# Mount Control
#bjj #state #mount #dominant #control

## State Properties
- **State ID**: S238
- **Point Value**: 4 (Dominant position)
- **Position Type**: Controlling/Dominant
- **Risk Level**: Low
- **Energy Cost**: Medium
- **Time Sustainability**: Long

## State Description
Mount Control represents the systematic approach to maintaining and attacking from the mount position - one of the most dominant positions in Brazilian Jiu-Jitsu. This position emphasizes control fundamentals, weight distribution, and systematic progression to submissions or improved mount variations while defending against escapes.

### Visual Description
You are seated on top of your opponent's torso, straddling their body with your legs on either side and knees on the ground. Your hips are positioned low and heavy on their chest or abdomen, with weight distributed to maximize pressure while maintaining balance. Your posture can vary from low (chest-to-chest) to upright depending on the situation, with hands ready to control opponent's arms, establish grips, or defend against escape attempts.

## Key Principles
- **Low Hip Positioning**: Keep hips sunk low into opponent's torso for maximum pressure
- **Knee Tightness**: Maintain knees tight to opponent's ribs to prevent space creation
- **Weight Distribution**: Distribute weight through hips rather than hands for heavy pressure
- **Base and Balance**: Maintain balance to counter bridge attempts while staying mobile for attacks
- **Arm Control**: Control opponent's arms to prevent frames and defensive structures
- **Systematic Progression**: Move between mount variations and attacks methodically

## Offensive Transitions
- [[High Mount Transition]] → [[High Mount]] (Beginner 45%, Intermediate 60%, Advanced 75%)
- [[S-Mount Transition]] → [[S-Mount]] (Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Technical Mount]] → [[Technical Mount]] (Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Armbar from Mount]] → [[Armbar Control]] (Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Cross Collar Choke]] → [[Won by Submission]] (Beginner 30%, Intermediate 45%, Advanced 60%)
- [[Ezekiel Choke]] → [[Won by Submission]] (Beginner 25%, Intermediate 40%, Advanced 55%)

## Expert Insights
**John Danaher**: "Mount control is about creating a systematic pressure environment where the opponent has no good options. Every defensive move they make should lead to a worse position or submission opportunity. The key is being heavy, methodical, and patient."

**Gordon Ryan**: "In competition, mount is where I finish a lot of matches. The key is transitioning between different mount positions - high mount, S-mount, technical mount - to create submission openings. Don't stay static."

**Eddie Bravo**: "From 10th Planet perspective, we emphasize getting to mount but then quickly transitioning to back control or S-mount for submissions. Mount is powerful but we use it as a stepping stone to even more dominant positions."

## Position Metrics
- **Position Retention**: Beginner 55%, Intermediate 70%, Advanced 85%
- **Advancement Probability**: Beginner 45%, Intermediate 60%, Advanced 75%
- **Submission Probability**: Beginner 50%, Intermediate 65%, Advanced 80%
- **Average Time**: 2-3 minutes
