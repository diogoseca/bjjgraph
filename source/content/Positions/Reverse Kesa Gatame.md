---
title: "Reverse Kesa Gatame | BJJ Position Guide | BJJ Graph"
description: "Master Reverse Kesa Gatame in BJJ. Reverse scarf hold control position with unique pressure angles. Success rates: Beginner 35%, Intermediate 50%, Advanced 65%."

state_machine:
  state_id: S234
  position_name: "Reverse Kesa Gatame"
  alternative_names: ["Reverse Scarf Hold", "Ushiro Kesa Gatame", "Reverse Headlock"]
  properties:
    point_value: 3
    position_type: "Controlling/Offensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"
  metrics:
    position_retention_rate: {beginner: 35, intermediate: 50, advanced: 65}
    advancement_probability: {beginner: 30, intermediate: 45, advanced: 60}
    submission_probability: {beginner: 25, intermediate: 40, advanced: 55}
    position_loss_probability: {beginner: 50, intermediate: 35, advanced: 25}
    average_time_in_position: "45-90 seconds"
  invariants:
    - "Facing away from opponent's head while controlling upper body"
    - "Hip pressure applied to opponent's chest/shoulder"
    - "Opponent's arm trapped or controlled"
  offensive_transitions:
    - {technique: "Arm Triangle from Reverse Kesa", target_state: "Arm Triangle Control", transition_id: "T340", success_rate: {beginner: 30, intermediate: 45, advanced: 60}}
    - {technique: "Transition to Mount", target_state: "Mount", transition_id: "T341", success_rate: {beginner: 35, intermediate: 50, advanced: 65}}
    - {technique: "Armbar from Reverse Kesa", target_state: "Armbar Control", transition_id: "T342", success_rate: {beginner: 20, intermediate: 35, advanced: 50}}
    - {technique: "Back Take", target_state: "Back Control", transition_id: "T343", success_rate: {beginner: 25, intermediate: 40, advanced: 55}}
  defensive_responses:
    - {technique: "Bridge and Escape", target_state: "Guard Recovery", success_rate: 40}
    - {technique: "Roll to Turtle", target_state: "Turtle Position", success_rate: 30}
  decision_tree:
    - condition: "Opponent's arm extended"
      options:
        - {action: "Armbar Attack", target: "Armbar Control", probability: 35}
    - condition: "Opponent flat on back"
      options:
        - {action: "Transition to Mount", target: "Mount", probability: 50}
  energy_dynamics:
    maintainer_burn_rate: 2.3
    defender_burn_rate: 3.2
    explosive_escape_multiplier: 4.2
    cooking_rate: 2.5
  related_states: ["Kesa Gatame", "Mount", "Arm Triangle Control", "Side Control"]
---

# Reverse Kesa Gatame
#bjj #state #pin #control #scarf-hold

## State Properties
- **State ID**: S234
- **Point Value**: 3 (Pin/control position)
- **Position Type**: Controlling/Offensive
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
Reverse Kesa Gatame is a controlling pin position where you are positioned perpendicular to your opponent but facing away from their head, with your hip applying pressure to their chest or shoulder area. This position is the reverse configuration of traditional Kesa Gatame (scarf hold), offering unique control and submission opportunities with different mechanical advantages.

### Visual Description
You are seated or positioned perpendicular to your opponent's body, facing toward their legs rather than their head. Your hips are pressed down into their chest or shoulder, creating heavy pressure. One or both of their arms are controlled or trapped, typically with your arms securing their near arm while your hip and body weight prevent their movement. Your legs are sprawled or positioned for base, preventing bridges and escapes.

## Key Principles
- **Hip Pressure**: Apply constant downward pressure with hips into opponent's chest
- **Arm Control**: Secure opponent's near arm to prevent frames and escapes
- **Base with Legs**: Sprawl legs for stability and resistance against bridges
- **Head Position**: Keep head low and tight to maintain control
- **Weight Distribution**: Distribute weight through hips rather than hands

## Offensive Transitions
- [[Arm Triangle from Reverse Kesa]] → [[Arm Triangle Control]] (Beginner 30%, Intermediate 45%, Advanced 60%)
- [[Transition to Mount]] → [[Mount]] (Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Armbar from Reverse Kesa]] → [[Armbar Control]] (Beginner 20%, Intermediate 35%, Advanced 50%)
- [[Back Take]] → [[Back Control]] (Beginner 25%, Intermediate 40%, Advanced 55%)

## Expert Insights
**John Danaher**: "Reverse Kesa Gatame is less commonly used in modern BJJ but offers excellent control when properly applied. The key is maintaining hip pressure while controlling the near arm."

**Gordon Ryan**: "I don't use reverse scarf hold often, but when I do, it's usually as a transition to mount or to set up an arm triangle. The position can be vulnerable to certain escapes."

**Eddie Bravo**: "Reverse Kesa isn't part of the core 10th Planet system, but it can be useful situationally, especially when transitioning between positions."

## Position Metrics
- **Position Retention**: Beginner 35%, Intermediate 50%, Advanced 65%
- **Advancement Probability**: Beginner 30%, Intermediate 45%, Advanced 60%
- **Submission Probability**: Beginner 25%, Intermediate 40%, Advanced 55%
- **Average Time**: 45-90 seconds
