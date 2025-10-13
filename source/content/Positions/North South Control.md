---
title: "North South Control | BJJ Position Guide | BJJ Graph"
description: "Master North South Control in BJJ. Dominant pin position with chest-to-chest pressure and submission opportunities. Success rates: Beginner 50%, Intermediate 65%, Advanced 80%."

state_machine:
  state_id: S235
  position_name: "North South Control"
  alternative_names: ["North-South", "NS Position", "69 Position"]
  properties:
    point_value: 3
    position_type: "Controlling/Offensive"
    risk_level: "Low"
    energy_cost: "Low"
    time_sustainability: "Long"
  metrics:
    position_retention_rate: {beginner: 50, intermediate: 65, advanced: 80}
    advancement_probability: {beginner: 35, intermediate: 50, advanced: 65}
    submission_probability: {beginner: 30, intermediate: 45, advanced: 60}
    position_loss_probability: {beginner: 35, intermediate: 25, advanced: 15}
    average_time_in_position: "1-2 minutes"
  invariants:
    - "Chest-to-chest positioning with opponent"
    - "Heads positioned opposite directions (north-south orientation)"
    - "Hip control and pressure applied to opponent's upper body"
  offensive_transitions:
    - {technique: "North-South Choke", target_state: "Won by Submission", transition_id: "T350", success_rate: {beginner: 30, intermediate: 45, advanced: 60}}
    - {technique: "Kimura from North-South", target_state: "Kimura Control", transition_id: "T351", success_rate: {beginner: 35, intermediate: 50, advanced: 65}}
    - {technique: "Transition to Mount", target_state: "Mount", transition_id: "T352", success_rate: {beginner: 40, intermediate: 55, advanced: 70}}
    - {technique: "Return to Side Control", target_state: "Side Control", transition_id: "T353", success_rate: {beginner: 60, intermediate: 75, advanced: 90}}
    - {technique: "Armbar from North-South", target_state: "Armbar Control", transition_id: "T354", success_rate: {beginner: 20, intermediate: 35, advanced: 50}}
  defensive_responses:
    - {technique: "Bridge and Turn", target_state: "Guard Recovery", success_rate: 25}
    - {technique: "Hip Escape", target_state: "Guard Recovery", success_rate: 20}
  decision_tree:
    - condition: "Opponent's arm available"
      options:
        - {action: "Kimura Attack", target: "Kimura Control", probability: 50}
    - condition: "Opponent turns to side"
      options:
        - {action: "Return to Side Control", target: "Side Control", probability: 75}
  energy_dynamics:
    maintainer_burn_rate: 1.5
    defender_burn_rate: 2.8
    explosive_escape_multiplier: 3.5
    cooking_rate: 2.0
  related_states: ["Side Control", "Mount", "Kimura Control"]
---

# North South Control
#bjj #state #pin #control #dominant

## State Properties
- **State ID**: S235
- **Point Value**: 3 (Controlling pin position)
- **Position Type**: Controlling/Offensive
- **Risk Level**: Low
- **Energy Cost**: Low
- **Time Sustainability**: Long

## State Description
North South Control is a dominant pinning position where you lie chest-to-chest with your opponent in opposite orientations (your head near their legs, their head near your legs). This position offers excellent control with minimal energy expenditure, making it ideal for maintaining dominance and setting up submissions or transitions to other positions.

### Visual Description
You are lying on top of your opponent with your chest pressed against theirs, but oriented in opposite directions. Your head is positioned near their abdomen or hips while their head is near your abdomen. Your arms control their upper body and head, while your hips are low and heavy, pinning them to the mat. Your legs are sprawled for base and stability.

## Key Principles
- **Chest-to-Chest Pressure**: Maintain constant heavy pressure with your chest on theirs
- **Low Hips**: Keep hips low and heavy to prevent escapes
- **Head Control**: Control opponent's head with your arms to prevent movement
- **Wide Base**: Sprawl legs wide for stability and pressure distribution
- **Submission Awareness**: Recognize opportunities for north-south choke and kimura
- **Transition Readiness**: Be prepared to transition back to side control or to mount

## Offensive Transitions
- [[North-South Choke]] → [[Won by Submission]] (Beginner 30%, Intermediate 45%, Advanced 60%)
- [[Kimura from North-South]] → [[Kimura Control]] (Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Transition to Mount]] → [[Mount]] (Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Return to Side Control]] → [[Side Control]] (Beginner 60%, Intermediate 75%, Advanced 90%)
- [[Armbar from North-South]] → [[Armbar Control]] (Beginner 20%, Intermediate 35%, Advanced 50%)

## Expert Insights
**John Danaher**: "North-south is one of the most underutilized positions in BJJ. It offers tremendous control with very little energy cost and creates excellent submission opportunities when properly applied."

**Gordon Ryan**: "I use north-south both as a control position and as a transition. The north-south choke is very high-percentage when opponents make mistakes, and the position itself is extremely heavy."

**Eddie Bravo**: "North-south isn't emphasized much in 10th Planet, but it has its place. The key is not staying there too long - use it to transition or submit, don't just hold it."

## Position Metrics
- **Position Retention**: Beginner 50%, Intermediate 65%, Advanced 80%
- **Advancement Probability**: Beginner 35%, Intermediate 50%, Advanced 65%
- **Submission Probability**: Beginner 30%, Intermediate 45%, Advanced 60%
- **Average Time**: 1-2 minutes
