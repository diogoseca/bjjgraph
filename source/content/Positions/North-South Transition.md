---
title: "North-South Transition | BJJ Position Guide | BJJ Graph"
description: "Master North-South Transition in BJJ. Complete guide covering the transitional movement between side control and north-south position. Success rates: Beginner 60%, Intermediate 75%, Advanced 85%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S230
  position_name: "North-South Transition"
  alternative_names: ["NS Transition", "North-South Movement", "180-Degree Transition"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Transitional"
    risk_level: "Low"
    energy_cost: "Low"
    time_sustainability: "Short"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 60
      intermediate: 75
      advanced: 85
    advancement_probability:
      beginner: 50
      intermediate: 65
      advanced: 80
    submission_probability:
      beginner: 15
      intermediate: 25
      advanced: 35
    position_loss_probability:
      beginner: 30
      intermediate: 20
      advanced: 10
    average_time_in_position: "5-10 seconds"

  # State Machine Integration
  invariants:
    - "Movement from side control toward north-south or vice versa"
    - "Maintaining chest-to-chest or chest-to-abdomen contact during transition"
    - "Head control or upper body control maintained throughout"

  # Available Transitions
  offensive_transitions:
    - technique: "Complete North-South"
      target_state: "North-South"
      transition_id: "T301"
      success_rate:
        beginner: 70
        intermediate: 85
        advanced: 95

    - technique: "North-South Kimura"
      target_state: "Kimura Control"
      transition_id: "T302"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 65

    - technique: "North-South Choke"
      target_state: "Won by Submission"
      transition_id: "T303"
      success_rate:
        beginner: 20
        intermediate: 35
        advanced: 50

    - technique: "Return to Side Control"
      target_state: "Side Control"
      transition_id: "T304"
      success_rate:
        beginner: 75
        intermediate: 85
        advanced: 92

    - technique: "Transition to Mount"
      target_state: "Mount"
      transition_id: "T305"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

  defensive_responses:
    - technique: "Bridge and Turn"
      target_state: "Guard Recovery"
      success_rate: 25

    - technique: "Frame and Create Space"
      target_state: "Half Guard Bottom"
      success_rate: 30

    - technique: "Hip Escape"
      target_state: "Guard Recovery"
      success_rate: 20

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent creates space on the side"
      options:
        - action: "Complete North-South"
          target: "North-South"
          probability: 85
        - action: "North-South Kimura"
          target: "Kimura Control"
          probability: 50

    - condition: "Opponent frames with near arm"
      options:
        - action: "Return to Side Control"
          target: "Side Control"
          probability: 85
        - action: "Transition to Mount"
          target: "Mount"
          probability: 55

    - condition: "Opponent turns away"
      options:
        - action: "Complete North-South"
          target: "North-South"
          probability: 90
        - action: "North-South Choke"
          target: "Won by Submission"
          probability: 35

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 1.5
    defender_burn_rate: 2.0
    explosive_escape_multiplier: 3.5
    cooking_rate: 1.0

  # Related States
  related_states:
    - "Side Control"
    - "North-South"
    - "Mount"
    - "Kimura Control"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Execute North-South Transition in BJJ",
  "description": "Complete guide to transitioning between side control and north-south position.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Maintain Upper Body Control",
      "text": "Keep chest-to-chest or chest-to-abdomen pressure while beginning the circular movement around opponent's head.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Step Over Head",
      "text": "Move your near-side leg in a circular arc around opponent's head while maintaining downward pressure.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Control Opponent's Head",
      "text": "Use your arms to control opponent's head and upper back during the transition to prevent escape.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Complete the Transition",
      "text": "Settle into north-south position with chest-to-chest pressure and hips low.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Attack Options",
      "text": "From here, execute north-south choke, kimura control, or return to side control based on opponent's reaction.",
      "position": 5
    }
  ],
  "tool": [
    "BJJ Gi or No-Gi attire",
    "Training partner",
    "Mat space"
  ],
  "totalTime": "PT5M"
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is a common mistake in lifting hips too high?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Reduces pressure and allows opponent to create frames and escape during the transition. The correction is: Keep your hips low and heavy throughout the transition, maintaining constant downward pressure on opponent's chest."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in moving too slowly?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gives opponent time to establish defensive frames or begin escape sequences. The correction is: Execute the transition smoothly and decisively in one continuous motion without pausing midway."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in losing head control?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to turn away or create space for escape attempts. The correction is: Maintain constant control of opponent's head with your arms or chest pressure throughout the entire transition."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in stepping too wide?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Creates space under your hips that opponent can exploit to escape or re-guard. The correction is: Keep your transition arc tight and close to opponent's body, maintaining constant connection."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in not anticipating the escape?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Opponent catches you mid-transition with hip escape or frame insertion. The correction is: Be aware of opponent's hips and arms, ready to abort transition and return to side control if needed."
      }
    }
  ]
}
</script>


<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "North-South Transition",
  "description": "Master North-South Transition in BJJ. Complete guide covering the transitional movement between side control and north-south position. Success rates: Beginner 60%, Intermediate 75%, Advanced 85%.",
  "url": "https://bjjgraph.com/positions/north-south-transition",
  "isPartOf": {
    "@type": "WebSite",
    "name": "BJJ Graph",
    "url": "https://bjjgraph.com"
  }
}
</script>


<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://bjjgraph.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Positions",
      "item": "https://bjjgraph.com/positions/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "North-South Transition",
      "item": "https://bjjgraph.com/positions/north-south-transition"
    }
  ]
}
</script>


# North-South Transition
#bjj #state #transition #pin #control

## State Properties
- **State ID**: S230
- **Point Value**: 0 (Transitional position, not scored independently)
- **Position Type**: Transitional
- **Risk Level**: Low
- **Energy Cost**: Low
- **Time Sustainability**: Short (5-10 seconds typical)

## State Description
North-South Transition represents the dynamic movement phase when transitioning from side control to north-south position or vice versa. This transitional state involves circular movement around the opponent's head while maintaining constant chest-to-chest or chest-to-abdomen pressure. Although brief, this transition is critical because it represents a moment of vulnerability where control can be lost if executed improperly.

The transition is characterized by maintaining connection while changing orientation. The top player moves in a 180-degree arc around the opponent's head, typically stepping one leg over while using their upper body to maintain downward pressure. During this movement, weight distribution shifts but contact is never broken.

This position offers opportunities for attacks including the north-south choke and kimura control, while also allowing the option to abort back to side control if the opponent creates effective defensive frames. Success depends on smooth execution, maintaining pressure, and reading opponent's defensive reactions.

### Visual Description
You are moving in a circular path around your opponent's head, transitioning from perpendicular positioning (side control) to parallel positioning (north-south). Your chest maintains constant pressure on their upper body throughout the movement - either chest-to-chest or chest-to-abdomen depending on the stage of transition. Your near-side leg is stepping over or has stepped over their head in an arc, while your far leg provides base and balance. Your arms are positioned to control their head, upper back, or arms to prevent them from turning away or creating frames. Your hips stay relatively low and heavy to maintain downward pressure that prevents escape attempts. The opponent is flat on their back with their movement restricted by your chest pressure and head control, though they may be attempting to frame with their arms or bridge to create space during this vulnerable transition phase.

## Key Principles
- **Continuous Pressure Maintenance**: Never break chest contact during the transition to prevent opponent from creating escape frames
- **Circular Movement Path**: Move in a smooth arc around opponent's head rather than lifting and repositioning
- **Low Hip Positioning**: Keep hips heavy and low throughout to maintain control pressure and base
- **Head Control Priority**: Maintain control of opponent's head with arms or chest to prevent turning away
- **Transition Speed**: Execute decisively but smoothly - too slow allows defense, too fast loses control
- **Abort Option Awareness**: Be ready to return to side control if opponent creates effective frames or space

## Prerequisites
- Solid side control maintenance
- Understanding of weight distribution
- Hip mobility for circular movement
- Pressure maintenance awareness

## State Invariants
- Movement from side control toward north-south or vice versa
- Maintaining chest-to-chest or chest-to-abdomen contact during transition
- Head control or upper body control maintained throughout

## Defensive Responses (When Opponent Has This State Against You)
- [[Bridge and Turn]] → [[Guard Recovery]] (Success Rate: 25%)
- [[Frame and Create Space]] → [[Half Guard Bottom]] (Success Rate: 30%)
- [[Hip Escape]] → [[Guard Recovery]] (Success Rate: 20%)

## Offensive Transitions (Available From This State)
- [[Complete North-South]] → [[North-South]] (Success Rate: Beginner 70%, Intermediate 85%, Advanced 95%)
- [[North-South Kimura]] → [[Kimura Control]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
- [[North-South Choke]] → [[Won by Submission]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 50%)
- [[Return to Side Control]] → [[Side Control]] (Success Rate: Beginner 75%, Intermediate 85%, Advanced 92%)
- [[Transition to Mount]] → [[Mount]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)

## Counter Transitions
- [[Abort to Side Control]] → [[Side Control]] (when opponent creates effective frames)
- [[Switch to Mount]] → [[Mount]] (when opponent turns to side)
- [[Establish North-South]] → [[North-South]] (when transition is clean)

## Expert Insights
**John Danaher**: "The north-south transition is fundamentally about maintaining connection while changing orientation. The key technical element is that your chest pressure must remain constant throughout - treat it as a rotation around a fixed axis where that axis is the contact point between your chest and their body. Many practitioners make the error of lifting their weight during the transition, which creates space for defensive frames. Keep your hips low, move in a tight arc, and maintain downward pressure at every point in the movement."

**Gordon Ryan**: "In competition, I use the north-south transition as both an attack and a pressure tool. When opponents are defending side control well, moving toward north-south forces them to adjust their defensive frames, which often creates openings I can exploit. The transition itself is also where I hit a lot of north-south chokes - people focus on defending the established positions and miss the submission threat during the movement. The key is being smooth but heavy - you're rolling over them, not jumping around them."

**Eddie Bravo**: "The north-south transition is interesting because it's one of those moments where you can really mess with people's defensive rhythms. Instead of staying static in side control, constantly threaten the transition. Go halfway, come back, go again - this creates mental pressure and fatigue. When you actually commit to the full transition, they're often late reacting. Also, the kimura opportunities during this transition are money - catch the near arm as you're circling and you've got a strong attack."

## Common Errors
- **Error**: Lifting hips too high
  - **Consequence**: Reduces pressure and allows opponent to create frames and escape during the transition.
  - **Correction**: Keep your hips low and heavy throughout the transition, maintaining constant downward pressure on opponent's chest.
  - **Recognition**: If you feel your weight coming off opponent or they're able to insert frames, your hips are too high.

- **Error**: Moving too slowly
  - **Consequence**: Gives opponent time to establish defensive frames or begin escape sequences.
  - **Correction**: Execute the transition smoothly and decisively in one continuous motion without pausing midway.
  - **Recognition**: If opponent has time to prepare defenses or you feel yourself stuck mid-transition, increase your movement speed.

- **Error**: Losing head control
  - **Consequence**: Allows opponent to turn away or create space for escape attempts.
  - **Correction**: Maintain constant control of opponent's head with your arms or chest pressure throughout the entire transition.
  - **Recognition**: If opponent is able to turn their head away or look at you, you've lost head control.

- **Error**: Stepping too wide
  - **Consequence**: Creates space under your hips that opponent can exploit to escape or re-guard.
  - **Correction**: Keep your transition arc tight and close to opponent's body, maintaining constant connection.
  - **Recognition**: If there's visible space between your hips and opponent's body during the transition, your arc is too wide.

- **Error**: Not anticipating the escape
  - **Consequence**: Opponent catches you mid-transition with hip escape or frame insertion.
  - **Correction**: Be aware of opponent's hips and arms, ready to abort transition and return to side control if needed.
  - **Recognition**: If opponent successfully escapes or re-guards during your transition, you missed defensive cues.

## Training Drills
- **Smooth Transition Drill**: Practice transitioning from side control to north-south and back with partner static, focusing on maintaining constant chest pressure and low hip position. 20 repetitions each direction, emphasizing smooth circular movement without lifting weight.

- **Transition with Resistance**: Partner provides progressive resistance (25%, 50%, 75%) while you execute the transition, learning to maintain control under pressure. 15 repetitions at each resistance level, focusing on pressure maintenance and head control.

- **Transition to Submission Flow**: Drill the sequence of side control → north-south transition → north-south choke attempt, with partner defending at 40-60% intensity. 10 complete sequences, emphasizing recognizing submission opportunities during the transition.

- **Abort Drill**: Practice recognizing when to abort the transition and return to side control when partner creates effective frames. Partner randomly inserts frames during transition (50% of attempts), and you must decide whether to continue or return. 20 repetitions focusing on decision-making speed.

- **Positional Sparring**: Start from side control and engage in positional sparring where you must transition to north-south and maintain for 10 seconds while opponent tries to escape. 5-minute rounds with role switching.

## Related States
- [[Side Control]] - Starting position for transition
- [[North-South]] - Target position for transition
- [[Mount]] - Alternative transition target
- [[Kimura Control]] - Attack available during transition
- [[Half Guard Top]] - Potential destination if transition fails

## Related Positions
- [[Side Control]] - Primary starting position
- [[North-South]] - Primary ending position
- [[Kimura Control]] - Attack during transition
- [[Mount]] - Alternative target
- [[Won by Submission]] - Via north-south choke

## Decision Tree
If opponent creates space on the side:
- Execute [[Complete North-South]] → [[North-South]] (Probability: 85%)
- Or Execute [[North-South Kimura]] → [[Kimura Control]] (Probability: 50%)

Else if opponent frames with near arm:
- Execute [[Return to Side Control]] → [[Side Control]] (Probability: 85%)
- Or Execute [[Transition to Mount]] → [[Mount]] (Probability: 55%)

Else if opponent turns away:
- Execute [[Complete North-South]] → [[North-South]] (Probability: 90%)
- Or Execute [[North-South Choke]] → [[Won by Submission]] (Probability: 35%)

## Position Metrics
- **Position Retention Rate**: Beginner 60%, Intermediate 75%, Advanced 85%
- **Advancement Probability**: Beginner 50%, Intermediate 65%, Advanced 80%
- **Submission Probability**: Beginner 15%, Intermediate 25%, Advanced 35%
- **Position Loss Probability**: Beginner 30%, Intermediate 20%, Advanced 10%
- **Average Time in Position**: 5-10 seconds

## Optimal Submission Paths
**Direct attack during transition:**
[[North-South Transition]] → [[North-South Choke]] → [[Won by Submission]]
*Reasoning: Catch opponent during the transition when defenses are adjusting, success rate 20-50% depending on skill*

**High-percentage completion path:**
[[North-South Transition]] → [[Complete North-South]] → [[North-South]] → [[North-South Choke]] → [[Won by Submission]]
*Reasoning: Establish the position fully before attacking, increasing control and submission success*

**Opportunistic attack path:**
[[North-South Transition]] → [[North-South Kimura]] → [[Kimura Control]] → [[Kimura Finish]] → [[Won by Submission]]
*Reasoning: If arm becomes available during transition, kimura offers high success rate 50-75%*

**Positional advancement path:**
[[North-South Transition]] → [[Return to Side Control]] → [[Side Control]] → [[Mount]] → [[Submission Chain]] → [[Won by Submission]]
*Reasoning: Use transition to tire opponent and create reaction, then advance positionally for methodical finish*
