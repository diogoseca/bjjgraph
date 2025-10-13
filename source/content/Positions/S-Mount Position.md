---
title: "S-Mount Position | BJJ Position Guide | BJJ Graph"
description: "Master S-Mount Position in BJJ. Advanced mount variation optimized for armbar attacks. Success rates: Beginner 40%, Intermediate 55%, Advanced 70%."

state_machine:
  state_id: S239
  position_name: "S-Mount Position"
  alternative_names: ["S-Mount", "Technical Mount", "Armbar Mount"]
  properties:
    point_value: 4
    position_type: "Offensive/Submission-focused"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"
  metrics:
    position_retention_rate: {beginner: 40, intermediate: 55, advanced: 70}
    advancement_probability: {beginner: 35, intermediate: 50, advanced: 65}
    submission_probability: {beginner: 60, intermediate: 75, advanced: 90}
    position_loss_probability: {beginner: 40, intermediate: 30, advanced: 20}
    average_time_in_position: "30-90 seconds"
  invariants:
    - "One leg posted high near opponent's head in S-configuration"
    - "Other leg maintaining base on opposite side"
    - "Opponent's arm isolated for armbar attack"
  offensive_transitions:
    - {technique: "Armbar from S-Mount", target_state: "Armbar Control", transition_id: "T390", success_rate: {beginner: 60, intermediate: 75, advanced: 90}}
    - {technique: "Triangle from S-Mount", target_state: "Triangle Control", transition_id: "T391", success_rate: {beginner: 35, intermediate: 50, advanced: 65}}
    - {technique: "Return to Standard Mount", target_state: "Mount", transition_id: "T392", success_rate: {beginner: 70, intermediate: 85, advanced: 95}}
    - {technique: "Transition to Back", target_state: "Back Control", transition_id: "T393", success_rate: {beginner: 30, intermediate: 45, advanced: 60}}
  defensive_responses:
    - {technique: "Roll to Escape", target_state: "Guard Recovery", success_rate: 30}
    - {technique: "Defend Arm", target_state: "Mount Defense", success_rate: 35}
  decision_tree:
    - condition: "Opponent's arm extended"
      options:
        - {action: "Armbar Finish", target: "Armbar Control", probability: 75}
    - condition: "Opponent defending arm"
      options:
        - {action: "Triangle Attack", target: "Triangle Control", probability: 50}
        - {action: "Return to Mount", target: "Mount", probability: 85}
  energy_dynamics:
    maintainer_burn_rate: 2.3
    defender_burn_rate: 3.8
    explosive_escape_multiplier: 4.5
    cooking_rate: 3.0
  related_states: ["Mount", "Armbar Control", "Triangle Control", "Back Control"]
---

# S-Mount Position
#bjj #state #mount #armbar #submission

## State Properties
- **State ID**: S239
- **Point Value**: 4 (Mount position points)
- **Position Type**: Offensive/Submission-focused
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
S-Mount Position is an advanced mount variation where one leg is posted high near the opponent's head while the other maintains base, creating an S-shaped leg configuration. This position is optimized for armbar attacks, offering exceptional control of the opponent's arm while maintaining mount points. The S-mount is a transitional attacking position rather than a long-term holding position.

### Visual Description
You are in mount position but with one leg posted high near opponent's head (knee near their ear or shoulder) while your other leg maintains base on the opposite side. Your body forms an asymmetric S-shape from above. The high leg creates tremendous pressure on opponent's trapped arm and provides leverage for armbar attacks. Your hips are positioned to isolate and control opponent's near arm, with your weight distributed to prevent escapes while maintaining armbar threat.

## Key Principles
- **High Leg Positioning**: Post one leg high to trap opponent's arm and create armbar angle
- **Arm Isolation**: Focus on controlling and isolating opponent's near arm for armbar
- **Balance Maintenance**: Maintain balance despite asymmetric leg positioning
- **Quick Transition**: S-mount is transitional - attack quickly or return to standard mount
- **Hip Control**: Use hips to pin opponent's arm while setting up armbar
- **Submission Focus**: Primary goal is armbar, with triangle as backup option

## Offensive Transitions
- [[Armbar from S-Mount]] → [[Armbar Control]] (Beginner 60%, Intermediate 75%, Advanced 90%)
- [[Triangle from S-Mount]] → [[Triangle Control]] (Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Return to Standard Mount]] → [[Mount]] (Beginner 70%, Intermediate 85%, Advanced 95%)
- [[Transition to Back]] → [[Back Control]] (Beginner 30%, Intermediate 45%, Advanced 60%)

## Expert Insights
**John Danaher**: "The S-mount is one of the highest percentage positions for finishing armbars from mount. The leg configuration creates optimal angle and pressure for the armbar while maintaining mount control."

**Gordon Ryan**: "S-mount is my go-to when the opponent gives me their arm from mount. It's a finishing position - once I get there, the armbar success rate is extremely high if I execute properly."

**Eddie Bravo**: "S-mount isn't used much in 10th Planet because we prefer going straight to technical mount or the back, but it's undeniably effective for armbar specialists."

## Position Metrics
- **Position Retention**: Beginner 40%, Intermediate 55%, Advanced 70%
- **Advancement Probability**: Beginner 35%, Intermediate 50%, Advanced 65%
- **Submission Probability**: Beginner 60%, Intermediate 75%, Advanced 90%
- **Average Time**: 30-90 seconds
