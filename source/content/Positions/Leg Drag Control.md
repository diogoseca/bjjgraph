---
title: "Leg Drag Control | BJJ Position Guide | BJJ Graph"
description: "Master Leg Drag Control in BJJ. Transitional passing position controlling opponent's leg to bypass guard. Success rates: Beginner 40%, Intermediate 55%, Advanced 70%."

state_machine:
  state_id: S233
  position_name: "Leg Drag Control"
  alternative_names: ["Leg Drag Position", "Leg Drag Pass", "Leg Drag Entry"]
  
  properties:
    point_value: 0
    position_type: "Transitional/Offensive"
    risk_level: "Low"
    energy_cost: "Low"
    time_sustainability: "Short"
  
  metrics:
    position_retention_rate:
      beginner: 40
      intermediate: 55
      advanced: 70
    advancement_probability:
      beginner: 55
      intermediate: 70
      advanced: 85
    submission_probability:
      beginner: 5
      intermediate: 10
      advanced: 15
    position_loss_probability:
      beginner: 35
      intermediate: 25
      advanced: 15
    average_time_in_position: "5-15 seconds"
  
  invariants:
    - "Control of opponent's leg, pulling it across your hip"
    - "Your body positioned to the side of opponent's guard"
    - "Opponent's leg trapped and stretched across"
  
  offensive_transitions:
    - technique: "Complete Leg Drag to Side"
      target_state: "Side Control"
      transition_id: "T330"
      success_rate: {beginner: 55, intermediate: 70, advanced: 85}
    - technique: "Leg Drag to Back"
      target_state: "Back Control"
      transition_id: "T331"
      success_rate: {beginner: 35, intermediate: 50, advanced: 65}
    - technique: "Leg Drag to Mount"
      target_state: "Mount"
      transition_id: "T332"
      success_rate: {beginner: 25, intermediate: 40, advanced: 55}
  
  defensive_responses:
    - {technique: "Hip Escape", target_state: "Guard Recovery", success_rate: 30}
    - {technique: "Invert and Re-guard", target_state: "Open Guard", success_rate: 25}
  
  decision_tree:
    - condition: "Opponent's hips are controlled"
      options:
        - {action: "Complete to Side Control", target: "Side Control", probability: 70}
    - condition: "Opponent turns away"
      options:
        - {action: "Take the Back", target: "Back Control", probability: 50}
  
  energy_dynamics:
    maintainer_burn_rate: 1.8
    defender_burn_rate: 2.5
    explosive_escape_multiplier: 3.5
    cooking_rate: 1.5
  
  related_states: ["Open Guard", "Side Control", "Back Control"]
---

# Leg Drag Control
#bjj #state #passing #transitional #leg-drag

## State Properties
- **State ID**: S233
- **Point Value**: 0
- **Position Type**: Transitional/Offensive
- **Risk Level**: Low  
- **Energy Cost**: Low
- **Time Sustainability**: Short

## State Description
Leg Drag Control is a dynamic transitional position where you control your opponent's leg and pull it across your hip to bypass their guard. This modern passing technique creates a highly effective pathway to side control, back control, or mount by neutralizing the opponent's guard structure and creating immediate passing opportunities.

### Visual Description
You are positioned to the side of your opponent with one of their legs dragged across your hip or thigh. Your hands control their leg, typically gripping the pants at knee/ankle or controlling the hip. Your chest applies pressure toward their upper body while your hips are angled to prevent them from re-guarding. The opponent is typically on their back or side with one leg stretched across your body, limiting their defensive options.

## Key Principles
- **Leg Control**: Maintain firm grip on opponent's leg throughout transition
- **Hip Positioning**: Keep hips low and angled to prevent re-guard
- **Quick Transition**: Execute pass swiftly once leg is controlled
- **Chest Pressure**: Apply forward pressure to prevent opponent from sitting up
- **Base Management**: Maintain balance while moving to passing position

## Offensive Transitions
- [[Complete Leg Drag to Side]] → [[Side Control]] (Beginner 55%, Intermediate 70%, Advanced 85%)
- [[Leg Drag to Back]] → [[Back Control]] (Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Leg Drag to Mount]] → [[Mount]] (Beginner 25%, Intermediate 40%, Advanced 55%)

## Expert Insights
**John Danaher**: "The leg drag is about creating an angle that makes guard retention impossible. Once you've dragged the leg across and established hip control, the opponent's defensive structure collapses."

**Gordon Ryan**: "I use leg drags constantly in competition because they're fast and high-percentage. The key is being aggressive with your follow-up - don't pause after dragging the leg."

**Eddie Bravo**: "The leg drag works great against people who rely heavily on guard retention. It bypasses their legs entirely and puts you right into passing position."

## Position Metrics
- **Position Retention**: Beginner 40%, Intermediate 55%, Advanced 70%
- **Advancement Probability**: Beginner 55%, Intermediate 70%, Advanced 85%
- **Average Time**: 5-15 seconds
