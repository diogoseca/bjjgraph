---
title: "Body Triangle Position | BJJ Position Guide | BJJ Graph"
description: "Master Body Triangle Position in BJJ. Powerful leg control from back control. Success rates: Beginner 45%, Intermediate 60%, Advanced 75%."

state_machine:
  state_id: S237
  position_name: "Body Triangle Position"
  alternative_names: ["Body Lock", "Figure-Four Body Lock", "Leg Triangle"]
  properties:
    point_value: 4
    position_type: "Controlling/Offensive"
    risk_level: "Low"
    energy_cost: "Low"
    time_sustainability: "Long"
  metrics:
    position_retention_rate: {beginner: 45, intermediate: 60, advanced: 75}
    advancement_probability: {beginner: 40, intermediate: 55, advanced: 70}
    submission_probability: {beginner: 50, intermediate: 65, advanced: 80}
    position_loss_probability: {beginner: 30, intermediate: 20, advanced: 10}
    average_time_in_position: "2-4 minutes"
  invariants:
    - "Legs locked around opponent's torso in triangle configuration"
    - "Back control established with hooks replaced by body triangle"
    - "Opponent's mobility severely restricted by leg lock"
  offensive_transitions:
    - {technique: "Rear Naked Choke", target_state: "Won by Submission", transition_id: "T370", success_rate: {beginner: 50, intermediate: 65, advanced: 80}}
    - {technique: "Armbar from Back", target_state: "Armbar Control", transition_id: "T371", success_rate: {beginner: 35, intermediate: 50, advanced: 65}}
    - {technique: "Collar Choke from Back", target_state: "Won by Submission", transition_id: "T372", success_rate: {beginner: 30, intermediate: 45, advanced: 60}}
    - {technique: "Body Triangle Squeeze", target_state: "Won by Submission", transition_id: "T373", success_rate: {beginner: 15, intermediate: 25, advanced: 40}}
  defensive_responses:
    - {technique: "Hip Escape to Guard", target_state: "Guard Recovery", success_rate: 20}
    - {technique: "Turn and Face", target_state: "Turtle Position", success_rate: 25}
  decision_tree:
    - condition: "Opponent's neck exposed"
      options:
        - {action: "Rear Naked Choke", target: "Won by Submission", probability: 65}
    - condition: "Opponent defending neck"
      options:
        - {action: "Armbar Attack", target: "Armbar Control", probability: 50}
  energy_dynamics:
    maintainer_burn_rate: 1.5
    defender_burn_rate: 3.5
    explosive_escape_multiplier: 4.5
    cooking_rate: 3.0
  related_states: ["Back Control", "Rear Naked Choke", "Armbar Control"]
---

# Body Triangle Position
#bjj #state #back-control #dominant #submission

## State Properties
- **State ID**: S237
- **Point Value**: 4 (Back control points)
- **Position Type**: Controlling/Offensive
- **Risk Level**: Low
- **Energy Cost**: Low
- **Time Sustainability**: Long

## State Description
Body Triangle Position is a highly dominant variation of back control where instead of using leg hooks, you've locked your legs around your opponent's torso in a triangle configuration. This provides exceptional control with minimal energy expenditure while creating tremendous pressure and submission opportunities.

### Visual Description
You are positioned on your opponent's back with your legs wrapped around their torso in a figure-four triangle lock. One leg crosses over the other and tucks behind your own knee, creating a locked configuration around opponent's midsection. Your arms control their upper body for submission attacks while your leg lock immobilizes their lower body and restricts breathing.

## Key Principles
- **Triangle Lock Security**: Ensure proper figure-four configuration for maximum control
- **Breathing Restriction**: Body triangle naturally restricts opponent's breathing creating urgency
- **Upper Body Attacks**: Focus on chokes and armlocks while legs maintain control
- **Energy Efficiency**: Position requires minimal energy to maintain compared to standard hooks
- **Squeeze Pressure**: Apply gradual squeezing pressure with legs to tire opponent
- **Hip Position**: Keep hips tight to opponent's back to prevent escape attempts

## Offensive Transitions
- [[Rear Naked Choke]] → [[Won by Submission]] (Beginner 50%, Intermediate 65%, Advanced 80%)
- [[Armbar from Back]] → [[Armbar Control]] (Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Collar Choke from Back]] → [[Won by Submission]] (Beginner 30%, Intermediate 45%, Advanced 60%)
- [[Body Triangle Squeeze]] → [[Won by Submission]] (Beginner 15%, Intermediate 25%, Advanced 40%)

## Expert Insights
**John Danaher**: "The body triangle is one of the most control-oriented positions in grappling. Once properly locked, it's extremely difficult to escape and allows you to attack at will with submissions while expending minimal energy."

**Gordon Ryan**: "I love the body triangle in competition because it's both a high-control position and creates a ticking clock for the opponent - the breathing restriction makes them desperate and sloppy in their defense."

**Eddie Bravo**: "Body triangle is excellent but you have to be careful with flexibility - some opponents can defend it better than others. When it works, it's lights out for submissions."

## Position Metrics
- **Position Retention**: Beginner 45%, Intermediate 60%, Advanced 75%
- **Advancement Probability**: Beginner 40%, Intermediate 55%, Advanced 70%
- **Submission Probability**: Beginner 50%, Intermediate 65%, Advanced 80%
- **Average Time**: 2-4 minutes
