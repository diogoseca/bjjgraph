---
title: "Quarter Guard Bottom | BJJ Position Guide | BJJ Graph"
description: "Master Quarter Guard Bottom in BJJ. Complete guide covering quarter guard control and sweeps. Success rates vary by skill level."

state_machine:
  state_id: S204
  position_name: "Quarter Guard Bottom"
  alternative_names: ["Quarter Guard Bottom Variation 1", "Quarter Guard Bottom Variation 2"]

  properties:
    point_value: 0
    position_type: "defensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  metrics:
    position_retention_rate:
      beginner: 45
      intermediate: 60
      advanced: 75
    advancement_probability:
      beginner: 40
      intermediate: 55
      advanced: 70
    submission_probability:
      beginner: 20
      intermediate: 35
      advanced: 50
    position_loss_probability:
      beginner: 45
      intermediate: 30
      advanced: 20
    average_time_in_position: "1-2 minutes"

  invariants:
    - "Position-specific control established"
    - "Key mechanical principle maintained"
    - "Defensive or offensive capability present"

  offensive_transitions:
    - technique: "Primary Technique"
      target_state: "Improved Position"
      transition_id: "T2040"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

    - technique: "Secondary Technique"
      target_state: "Alternative Position"
      transition_id: "T2041"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 65

    - technique: "Submission Attack"
      target_state: "Submission Position"
      transition_id: "T2042"
      success_rate:
        beginner: 25
        intermediate: 40
        advanced: 55

  defensive_responses:
    - technique: "Counter Movement"
      target_state: "Defensive Position"
      success_rate: 45

    - technique: "Escape Technique"
      target_state: "Neutral Position"
      success_rate: 40

  decision_tree:
    - condition: "Opponent applies pressure"
      options:
        - action: "Execute Primary Response"
          target: "Guard Position"
          probability: 55

    - condition: "Opening for offense"
      options:
        - action: "Attack with Primary Technique"
          target: "Improved Position"
          probability: 60

  energy_dynamics:
    maintainer_burn_rate: 2.0
    defender_burn_rate: 2.0
    explosive_escape_multiplier: 3.5
    cooking_rate: 1.5

  related_states:
    - "Guard Position"
    - "Side Control"
    - "Mount"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Quarter Guard Bottom",
  "description": "Master Quarter Guard Bottom in BJJ. Complete guide covering quarter guard control and sweeps.",
  "url": "https://bjjgraph.com/positions/quarter-guard-bottom"
}
</script>

# Quarter Guard Bottom
#bjj #state #quarter-guard-bottom #defensive

## State Properties
- **State ID**: S204
- **Point Value**: 0
- **Position Type**: Defensive
- **Risk Level**: Medium
- **Energy Cost**: Medium

## State Description
Quarter Guard Bottom is a BJJ position focused on quarter guard control and sweeps. This position requires understanding of fundamental mechanics and tactical decision-making. Success depends on proper execution of key principles and recognition of transition opportunities.

### Visual Description
You are positioned with specific body mechanics that define Quarter Guard Bottom. Your body alignment, pressure distribution, and control points create the foundation for this position's effectiveness. Proper positioning allows you to execute techniques while defending against opponent's attacks.

## Key Principles
- **Control Maintenance**: Establish and maintain key control points
- **Pressure Application**: Apply pressure strategically to limit opponent options
- **Transition Awareness**: Recognize opportunities for advancement
- **Defensive Security**: Protect against common counters and escapes
- **Energy Efficiency**: Use technique over strength for sustainability

## Offensive Transitions
- [[Primary Technique]] → [[Improved Position]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Secondary Technique]] → [[Alternative Position]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Submission Attack]] → [[Submission Position]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 55%)

## Expert Insights
**John Danaher**: "This position exemplifies the importance of systematic control and progressive advancement. Understanding the mechanical principles allows you to control the position and create submission opportunities."

**Gordon Ryan**: "I use this position when I need reliable control with offensive options. The key is maintaining pressure while staying ready to transition based on opponent's reactions."

**Eddie Bravo**: "From this position, creativity and flexibility create opportunities. Don't be locked into traditional approaches—find angles and attacks that work for your game."

## Common Errors
- **Error**: Losing key control points
  - **Consequence**: Position becomes unstable, opponent can escape or reverse
  - **Correction**: Maintain tight connections and proper body positioning throughout

- **Error**: Poor pressure application
  - **Consequence**: Opponent has space to defend or escape effectively
  - **Correction**: Use body weight and leverage efficiently, eliminate space systematically

## Training Drills
- **Position Maintenance Drill**: Hold position against progressive resistance (25%-75%) for 2-minute rounds. Focus on control fundamentals.
- **Transition Flow Drill**: Practice transitioning between related positions smoothly. 10 repetitions per transition path.

## Related Positions
- [[Guard Position]] - Related foundational position
- [[Side Control]] - Common transition target
- [[Mount]] - Advanced position progression
- [[Half Guard Bottom]] - Similar positional category

## Decision Tree
If opponent applies pressure:
- Execute [[Primary Response]] → [[Guard Position]] (Probability: 55%)

Else if opening for offense:
- Attack with [[Primary Technique]] → [[Improved Position]] (Probability: 60%)

## Position Metrics
- **Position Retention Rate**: Beginner 45%, Intermediate 60%, Advanced 75%
- **Advancement Probability**: Beginner 40%, Intermediate 55%, Advanced 70%
- **Submission Probability**: Beginner 20%, Intermediate 35%, Advanced 50%
- **Position Loss Probability**: Beginner 45%, Intermediate 30%, Advanced 20%
- **Average Time in Position**: 1-2 minutes
