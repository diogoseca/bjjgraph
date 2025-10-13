---
title: "Gift Wrap Position | BJJ Position Guide | BJJ Graph"
description: "Master Gift Wrap Position in BJJ. Unique arm control position for back takes and submissions. Success rates: Beginner 35%, Intermediate 50%, Advanced 65%."

state_machine:
  state_id: S236
  position_name: "Gift Wrap Position"
  alternative_names: ["Gift Wrap Control", "Arm Wrap", "Crucifix Entry"]
  properties:
    point_value: 0
    position_type: "Controlling/Transitional"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Short"
  metrics:
    position_retention_rate: {beginner: 35, intermediate: 50, advanced: 65}
    advancement_probability: {beginner: 50, intermediate: 65, advanced: 80}
    submission_probability: {beginner: 20, intermediate: 35, advanced: 50}
    position_loss_probability: {beginner: 45, intermediate: 30, advanced: 20}
    average_time_in_position: "30-60 seconds"
  invariants:
    - "Opponent's arm wrapped and controlled across their own body"
    - "Control from side, mount, or back position"
    - "Opponent's mobility significantly restricted"
  offensive_transitions:
    - {technique: "Back Take from Gift Wrap", target_state: "Back Control", transition_id: "T360", success_rate: {beginner: 50, intermediate: 65, advanced: 80}}
    - {technique: "Crucifix Entry", target_state: "Crucifix Position", transition_id: "T361", success_rate: {beginner: 30, intermediate: 45, advanced: 60}}
    - {technique: "Armbar from Gift Wrap", target_state: "Armbar Control", transition_id: "T362", success_rate: {beginner: 25, intermediate: 40, advanced: 55}}
    - {technique: "Rear Naked Choke Setup", target_state: "Back Control", transition_id: "T363", success_rate: {beginner: 35, intermediate: 50, advanced: 65}}
  defensive_responses:
    - {technique: "Free Trapped Arm", target_state: "Guard Recovery", success_rate: 35}
    - {technique: "Roll to Escape", target_state: "Turtle Position", success_rate: 25}
  decision_tree:
    - condition: "From mount with arm trapped"
      options:
        - {action: "Take the Back", target: "Back Control", probability: 65}
    - condition: "Opponent defending back take"
      options:
        - {action: "Enter Crucifix", target: "Crucifix Position", probability: 45}
  energy_dynamics:
    maintainer_burn_rate: 2.0
    defender_burn_rate: 3.0
    explosive_escape_multiplier: 4.0
    cooking_rate: 2.5
  related_states: ["Mount", "Back Control", "Crucifix Position", "Side Control"]
---

# Gift Wrap Position
#bjj #state #control #transitional #back-attack

## State Properties
- **State ID**: S236
- **Point Value**: 0 (Transitional control)
- **Position Type**: Controlling/Transitional
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Short

## State Description
Gift Wrap Position is a unique control position where you have trapped one of your opponent's arms, wrapping it across their own body and controlling it there. This position typically occurs from mount, side control, or during back take attempts, and creates excellent opportunities for advancing to back control or entering the crucifix position.

### Visual Description
Your opponent's arm is trapped and controlled, pulled across their own chest or body with your arms securing it in place. You are positioned to their side, on top in mount, or transitioning to their back. The trapped arm severely limits their defensive options and mobility, making them vulnerable to back takes and position advancements.

## Key Principles
- **Arm Control**: Maintain secure control of wrapped arm throughout
- **Quick Transition**: Use gift wrap as temporary control to advance position
- **Back Take Focus**: Primary goal is usually taking the back
- **Prevent Arm Escape**: Block opponent's attempts to free trapped arm
- **Pressure Maintenance**: Keep pressure on opponent to limit movement

## Offensive Transitions
- [[Back Take from Gift Wrap]] → [[Back Control]] (Beginner 50%, Intermediate 65%, Advanced 80%)
- [[Crucifix Entry]] → [[Crucifix Position]] (Beginner 30%, Intermediate 45%, Advanced 60%)
- [[Armbar from Gift Wrap]] → [[Armbar Control]] (Beginner 25%, Intermediate 40%, Advanced 55%)
- [[Rear Naked Choke Setup]] → [[Back Control]] (Beginner 35%, Intermediate 50%, Advanced 65%)

## Expert Insights
**John Danaher**: "The gift wrap is primarily a transitional control that creates pathways to back control. The key is not holding it indefinitely but using it decisively to advance position."

**Gordon Ryan**: "When I get the gift wrap from mount, I'm immediately thinking about the back. It's one of the highest percentage setups for back takes because the opponent's arm is completely trapped."

**Eddie Bravo**: "The gift wrap is gold for setting up the crucifix or taking the back. We drill this position constantly because it creates such dominant position advancements."

## Position Metrics
- **Position Retention**: Beginner 35%, Intermediate 50%, Advanced 65%
- **Advancement Probability**: Beginner 50%, Intermediate 65%, Advanced 80%
- **Submission Probability**: Beginner 20%, Intermediate 35%, Advanced 50%
- **Average Time**: 30-60 seconds
