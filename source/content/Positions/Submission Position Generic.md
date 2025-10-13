---
title: "Submission Position Generic | BJJ Position Guide | BJJ Graph"
description: "Master generic submission control positions in BJJ. Guide covering control, finishing mechanics, and defense. Success rates: Beginner 30%, Intermediate 50%, Advanced 70%."

# State Machine Data
state_machine:
  state_id: S202
  position_name: "Submission Position Generic"
  alternative_names: ["Submission Control", "Finishing Position", "Submission Setup"]

  properties:
    point_value: 0
    position_type: "Offensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Short"

  metrics:
    position_retention_rate:
      beginner: 40
      intermediate: 60
      advanced: 75
    advancement_probability:
      beginner: 30
      intermediate: 50
      advanced: 70
    submission_probability:
      beginner: 30
      intermediate: 50
      advanced: 70
    position_loss_probability:
      beginner: 55
      intermediate: 35
      advanced: 20
    average_time_in_position: "10-30 seconds"

  invariants:
    - "Attacker has isolated limb or established choke control"
    - "Defender is in vulnerable position requiring immediate defense"
    - "Submission mechanics can be applied with control"

  offensive_transitions:
    - technique: "Finish Submission"
      target_state: "Won by Submission"
      transition_id: "T330"
      success_rate:
        beginner: 30
        intermediate: 50
        advanced: 70

    - technique: "Transition to Dominant Position"
      target_state: "Mount"
      transition_id: "T331"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

    - technique: "Adjust Control"
      target_state: "Submission Position"
      transition_id: "T332"
      success_rate:
        beginner: 50
        intermediate: 65
        advanced: 80

  defensive_responses:
    - technique: "Defend and Escape"
      target_state: "Defensive Position"
      success_rate: 50

    - technique: "Counter Submission"
      target_state: "Top Position"
      success_rate: 30

    - technique: "Tap Out"
      target_state: "Match End"
      success_rate: 100

  decision_tree:
    - condition: "Submission locked in properly"
      options:
        - action: "Apply Pressure to Finish"
          target: "Won by Submission"
          probability: 70

    - condition: "Opponent defending effectively"
      options:
        - action: "Adjust Angle or Grip"
          target: "Submission Position"
          probability: 65
        - action: "Transition to Alternative"
          target: "Mount"
          probability: 55

  energy_dynamics:
    maintainer_burn_rate: 2.5
    defender_burn_rate: 4.0
    explosive_escape_multiplier: 5.0
    cooking_rate: 3.0

  related_states:
    - "Mount"
    - "Back Control"
    - "Guard Position"
    - "Won by Submission"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Submission Position Generic",
  "description": "Master generic submission control positions in BJJ. Guide covering control, finishing mechanics, and defense. Success rates: Beginner 30%, Intermediate 50%, Advanced 70%.",
  "url": "https://bjjgraph.com/positions/submission-position-generic"
}
</script>

# Submission Position Generic
#bjj #state #submission #offensive

## State Description
Submission Position Generic represents any position where an attacker has established sufficient control to apply a submission technique. This encompasses all submission control positions including armbars, triangles, chokes, and leg locks. The defining characteristic is that the attacker has isolated a target (limb or neck) and can apply finishing mechanics.

### Visual Description
You have established control over your opponent's body with a specific limb or neck isolated and under attack. Your body is positioned to apply mechanical pressure through leverage, with your opponent's escape routes limited by your control. The submission is partially applied, requiring final adjustments or pressure to force the tap.

## Key Principles
- **Control Before Finish**: Establish dominant control before applying submission pressure
- **Isolate the Target**: Separate the targeted limb or neck from defensive help
- **Apply Mechanics Correctly**: Use proper leverage and body positioning for submission
- **Prevent Escape Routes**: Close off opponent's defensive options
- **Maintain Patience**: Don't rush the finish; control first, submit second

## Offensive Transitions
- [[Finish Submission]] → [[Won by Submission]] (Success Rate: Beginner 30%, Intermediate 50%, Advanced 70%)
- [[Transition to Mount]] → [[Mount]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Adjust Control]] → [[Submission Position]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)

## Expert Insights
**John Danaher**: "The submission position is where control meets mechanics. Many students rush the finish without establishing proper control, resulting in escapes. The systematic approach is: achieve dominant position, isolate the target, establish control, apply mechanics, adjust as needed, finish. Each step must be completed before advancing."

**Gordon Ryan**: "When I have a submission position, I'm patient. I know if I have the control right, the finish is inevitable. People tap when they have no other option, so my job is to remove all options systematically. Control is submission—if you control correctly, finishing is just a formality."

**Eddie Bravo**: "Submission positions are about creating inescapable situations. Use multiple control points, unusual angles, and constant pressure. Don't give them hope—make it clear the submission is locked in. The best submissions feel inevitable to the person defending them."

## Common Errors
- **Error**: Rushing the finish without proper control
  - **Consequence**: Opponent escapes, position is lost, energy wasted
  - **Correction**: Establish complete control first, then apply finishing pressure slowly and progressively

- **Error**: Allowing escape routes
  - **Consequence**: Opponent finds defensive pathway and escapes submission
  - **Correction**: Close all escape routes by maintaining tight control and proper body positioning

## Training Drills
- **Submission Control Maintenance**: Partner provides progressive resistance (25%-75%) while you maintain submission position without finishing. Builds control endurance.
- **Finish from Control**: Start with submission locked in, practice applying final pressure smoothly and technically. 10 reps per submission type.

## Related Positions
- [[Armbar Control]] - Specific armbar submission position
- [[Triangle Control]] - Specific triangle submission position  
- [[Back Control]] - Dominant position for chokes
- [[Mount]] - Dominant position for various submissions
- [[Won by Submission]] - Successful finish destination

## Decision Tree
If submission locked in properly:
- Apply [[Pressure to Finish]] → [[Won by Submission]] (Probability: 70%)

Else if opponent defending effectively:
- [[Adjust Angle or Grip]] → [[Submission Position]] (Probability: 65%)
- Or [[Transition to Alternative]] → [[Mount]] (Probability: 55%)

## Position Metrics
- **Position Retention Rate**: Beginner 40%, Intermediate 60%, Advanced 75%
- **Advancement Probability**: Beginner 30%, Intermediate 50%, Advanced 70%
- **Submission Probability**: Beginner 30%, Intermediate 50%, Advanced 70%
- **Position Loss Probability**: Beginner 55%, Intermediate 35%, Advanced 20%
- **Average Time in Position**: 10-30 seconds
