---
title: "Closed Guard Bottom | BJJ Position Guide | BJJ Graph"
description: "Master Closed Guard Bottom in BJJ. Complete guide covering setup, control, sweeps, and submissions. Success rates: Beginner 60%, Intermediate 70%, Advanced 80%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S002
  position_name: "Closed Guard Bottom"
  alternative_names: ["Full Guard Bottom", "Closed Guard", "Guard Bottom"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Defensive with offensive options"
    risk_level: "Low"
    energy_cost: "Medium"
    time_sustainability: "Long"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 60
      intermediate: 70
      advanced: 80
    advancement_probability:
      beginner: 40
      intermediate: 55
      advanced: 70
    submission_probability:
      beginner: 25
      intermediate: 35
      advanced: 50
    position_loss_probability:
      beginner: 35
      intermediate: 25
      advanced: 15
    average_time_in_position: "2-3 minutes"

  # State Machine Integration
  invariants:
    - "Legs wrapped around opponent's waist with ankles crossed"
    - "Back on the mat"
    - "Opponent contained between your legs"

  # Available Transitions
  offensive_transitions:
    - technique: "Hip Bump Sweep"
      target_state: "Mount"
      transition_id: "T045"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

    - technique: "Scissor Sweep"
      target_state: "Mount"
      transition_id: "T046"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 65

    - technique: "Pendulum Sweep"
      target_state: "Mount"
      transition_id: "T047"
      success_rate:
        beginner: 30
        intermediate: 45
        advanced: 60

    - technique: "Triangle Choke"
      target_state: "Triangle Control"
      transition_id: "T201"
      success_rate:
        beginner: 25
        intermediate: 40
        advanced: 55

    - technique: "Armbar"
      target_state: "Armbar Control"
      transition_id: "T202"
      success_rate:
        beginner: 25
        intermediate: 40
        advanced: 55

    - technique: "Omoplata"
      target_state: "Omoplata Control"
      transition_id: "T203"
      success_rate:
        beginner: 20
        intermediate: 35
        advanced: 50

    - technique: "Kimura"
      target_state: "Kimura Control"
      transition_id: "T204"
      success_rate:
        beginner: 20
        intermediate: 35
        advanced: 50

    - technique: "Cross Collar Choke"
      target_state: "Won by Submission"
      transition_id: "T205"
      success_rate:
        beginner: 30
        intermediate: 45
        advanced: 60

    - technique: "Open Guard Transition"
      target_state: "Open Guard Bottom"
      transition_id: "T048"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

  defensive_responses:
    - technique: "Posture and Base"
      target_state: "Standing in Guard"
      success_rate: 40

    - technique: "Control Arms"
      target_state: "Combat Base"
      success_rate: 35

    - technique: "Break Grips"
      target_state: "Guard Opening Sequence"
      success_rate: 30

    - technique: "Create Pressure"
      target_state: "Stack Pass Initiation"
      success_rate: 25

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent establishes strong posture"
      options:
        - action: "Hip Bump Sweep"
          target: "Mount"
          probability: 55
        - action: "Scissor Sweep"
          target: "Mount"
          probability: 50

    - condition: "Opponent drives forward with pressure"
      options:
        - action: "Pendulum Sweep"
          target: "Mount"
          probability: 45
        - action: "Triangle Choke"
          target: "Triangle Control"
          probability: 40

    - condition: "Opponent stands up"
      options:
        - action: "Open Guard Transition"
          target: "Open Guard Bottom"
          probability: 60

    - condition: "Balanced opponent"
      options:
        - action: "Break posture and Triangle Choke"
          target: "Triangle Control"
          probability: 40
        - action: "Armbar"
          target: "Armbar Control"
          probability: 35

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 2.0
    defender_burn_rate: 1.5
    explosive_escape_multiplier: 4.0
    cooking_rate: 1.5

  # Related States
  related_states:
    - "Open Guard Bottom"
    - "Half Guard Bottom"
    - "Rubber Guard"
    - "Williams Guard"
    - "Butterfly Guard"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Closed Guard Bottom in BJJ",
  "description": "Complete guide to executing techniques and transitions from Closed Guard Bottom.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Execute Hip Bump Sweep",
      "text": "From this position, execute Hip Bump Sweep to transition to Mount.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Execute Scissor Sweep",
      "text": "From this position, execute Scissor Sweep to transition to Mount.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Execute Pendulum Sweep",
      "text": "From this position, execute Pendulum Sweep to transition to Mount.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Execute Triangle Choke",
      "text": "From this position, execute Triangle Choke to transition to Triangle Control.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Execute Armbar",
      "text": "From this position, execute Armbar to transition to Armbar Control.",
      "position": 5
    },
    {
      "@type": "HowToStep",
      "name": "Execute Omoplata",
      "text": "From this position, execute Omoplata to transition to Omoplata Control.",
      "position": 6
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
      "name": "What is a common mistake in Keeping a flat, square position?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Makes it easy for the opponent to maintain posture, reducing your ability to initiate effective attacks or sweeps. The correction is: Shift your hips to create angles, using off-balancing techniques to disrupt the opponent's posture and open attack opportunities."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Focusing on only one attack?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Leads to predictable offense, allowing the opponent to anticipate and counter your moves with prepared defenses. The correction is: Chain multiple attacks together, such as combining sweeps with submissions, to keep the opponent guessing and create openings."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Loose legs/ankles?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows the opponent space to initiate passes, weakening your control and increasing the risk of guard loss. The correction is: Keep your legs tight around the opponent's waist with ankles crossed securely, maintaining constant hip connection to eliminate space."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Ineffective gripping?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Results in an inability to control the opponent's posture, making it harder to set up attacks or prevent passes. The correction is: Use strong, strategic grips on the collar, sleeves, or wrists to break the opponent's posture and maintain upper body control."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Staying too flat?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Limits offensive options, reducing your ability to create angles or initiate dynamic attacks from the guard. The correction is: Engage your core to elevate your upper body slightly or shift your hips, creating better leverage for sweeps and submissions."
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
  "name": "Closed Guard Bottom",
  "description": "Master Closed Guard Bottom in BJJ. Complete guide covering setup, control, sweeps, and submissions. Success rates: Beginner 60%, Intermediate 70%, Advanced 80%.",
  "url": "https://bjjgraph.com/positions/closed-guard-bottom-v2",
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
      "name": "Closed Guard Bottom",
      "item": "https://bjjgraph.com/positions/closed-guard-bottom-v2"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Closed Guard Bottom (S002) - Defensive position with strong offensive potential. Bottom player wraps legs around opponent's waist with ankles crossed. Neutral scoring (0 points) but offers multiple sweep and submission paths.

KEY_MECHANICS: Hip connection eliminates space, strategic grips control posture, angle creation through hip shifting enables attacks. Defensive security combined with offensive threat diversity.

STRATEGIC_VALUE: Beginner-friendly defensive position that scales well with skill. High retention rates (60-80%) make it reliable safety position. Multiple attack vectors prevent predictability.

COMMON_PATTERNS: Strong posture defense → Hip Bump/Scissor Sweep. Forward pressure → Pendulum Sweep/Triangle. Standing opponent → Open Guard transition. Balanced opponent → Break posture for submissions.

SYSTEM_INTEGRATION: Core guard position connecting to Danaher triangle/armbar systems, Eddie Bravo rubber guard innovations, traditional sweep-based game plans.
-->

# Closed Guard Bottom
#bjj #state #guard #bottom

## State Properties
- **State ID**: S002
- **Point Value**: 0 (Neutral or slight advantage)
- **Position Type**: Defensive with offensive options
- **Risk Level**: Low
- **Energy Cost**: Medium
- **Time Sustainability**: Long

## State Description
Closed Guard Bottom is a foundational BJJ position where the bottom player wraps their legs around the opponent's waist, crossing their ankles behind the opponent's back. While considered neutral in scoring, this position offers significant control and multiple offensive opportunities for the bottom player while providing defensive security.

### Visual Description
You are lying on your back on the mat, with your legs tightly wrapped around your opponent's waist, ankles crossed securely behind their back to form a closed loop that restricts their movement. Your hips are positioned close to theirs, maintaining a tight connection to eliminate space and control their posture, often using your hands to grip their collar, sleeves, or wrists to further break their balance forward. Your upper body is slightly elevated or flat, depending on the attack or defense strategy, with your core engaged to create angles by shifting your hips left or right. This setup allows you to dominate the opponent's upper body while your legs act as a powerful barrier, preventing easy guard passes and setting up a wide array of sweeps and submissions, making closed guard a dynamic and secure position from the bottom.

## Key Principles
- Maintain hip connection to eliminate space
- Control opponent's posture through strategic grips
- Break opponent's posture to set up attacks
- Create angles by shifting hips
- Manage defensive frames to prevent passes
- Threaten multiple attack vectors simultaneously

## Prerequisites
- Proper back position (flat with shoulders on mat)
- Leg conditioning for sustained guard closure
- Hip mobility for creating angles

## State Invariants
- Legs wrapped around opponent's waist with ankles crossed
- Back on the mat
- Opponent contained between your legs

## Defensive Responses (When Opponent Has This State)
- [[Posture and Base]] → [[Standing in Guard]] (Success Rate: 40%)
- [[Control Arms]] → [[Combat Base]] (Success Rate: 35%)
- [[Break Grips]] → [[Guard Opening Sequence]] (Success Rate: 30%)
- [[Create Pressure]] → [[Stack Pass Initiation]] (Success Rate: 25%)

## Offensive Transitions (Available From This State)
- [[Hip Bump Sweep]] → [[Mount]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Scissor Sweep]] → [[Mount]] or [[Side Control Top]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Pendulum Sweep]] → [[Mount]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)
- [[Triangle Choke]] → [[Triangle Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 55%)
- [[Armbar]] → [[Armbar Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 55%)
- [[Omoplata]] → [[Omoplata Control]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 50%)
- [[Kimura]] → [[Kimura Control]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 50%)
- [[Cross Collar Choke]] → [[Won by Submission]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)
- [[Open Guard Transition]] → [[Open Guard Bottom]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)

## Counter Transitions
- [[Re-guard]] → [[Closed Guard Bottom]] (against pass attempts)
- [[Sweep Combination]] → [[Top Position]] (chaining multiple sweeps)
- [[Submission Chain]] → [[Won by Submission]] (linking submission attempts)

## Expert Insights
- **Danaher System**: Emphasizes the "Inside Position Theory" where controlling the inside space is paramount. Focuses on systematically breaking posture and maintaining constant pressure between two primary attack systems - the upper body (triangle/armbar) and lower body (sweeps).
- **Gordon Ryan**: Primarily uses closed guard as a transitional position rather than a home base. When in closed guard, emphasizes creating strong angles and immediately threatening sweeps to force reactions that set up submissions.
- **Eddie Bravo**: Transforms the traditional closed guard into the rubber guard system, focusing on overhook control and "mission control" position to set up gogoplatas, omoplatas, and specialized sweeps. Uses the lockdown from half guard more often than traditional closed guard.

## Common Errors
- **Error**: Keeping a flat, square position
  - **Consequence**: Makes it easy for the opponent to maintain posture, reducing your ability to initiate effective attacks or sweeps.
  - **Correction**: Shift your hips to create angles, using off-balancing techniques to disrupt the opponent's posture and open attack opportunities.
- **Error**: Focusing on only one attack
  - **Consequence**: Leads to predictable offense, allowing the opponent to anticipate and counter your moves with prepared defenses.
  - **Correction**: Chain multiple attacks together, such as combining sweeps with submissions, to keep the opponent guessing and create openings.
- **Error**: Loose legs/ankles
  - **Consequence**: Allows the opponent space to initiate passes, weakening your control and increasing the risk of guard loss.
  - **Correction**: Keep your legs tight around the opponent's waist with ankles crossed securely, maintaining constant hip connection to eliminate space.
- **Error**: Ineffective gripping
  - **Consequence**: Results in an inability to control the opponent's posture, making it harder to set up attacks or prevent passes.
  - **Correction**: Use strong, strategic grips on the collar, sleeves, or wrists to break the opponent's posture and maintain upper body control.
- **Error**: Staying too flat
  - **Consequence**: Limits offensive options, reducing your ability to create angles or initiate dynamic attacks from the guard.
  - **Correction**: Engage your core to elevate your upper body slightly or shift your hips, creating better leverage for sweeps and submissions.

## Training Drills
- **Posture Breaking Sequences**: Practice posture breaking sequences with progressive resistance, focusing on using grips and hip movement to control the opponent.
- **Transition Chains**: Drill transition chains between submissions, such as moving from triangle to armbar, to improve fluidity and attack options.
- **Hip Mobility Drills**: Work on hip mobility and angle creation drills to enhance your ability to off-balance the opponent and set up attacks.
- **Defensive to Offensive Flows**: Practice defensive to offensive transition flows, learning to turn guard retention into immediate attack opportunities.
- **Core Strength Development**: Focus on core strength development for guard retention, ensuring you can maintain control and create leverage effectively.

## Related States
- [[Open Guard Bottom]] - More dynamic with extended legs
- [[Half Guard Bottom]] - One leg trapped, one leg free
- [[Rubber Guard]] - Specialized closed guard variation (Eddie Bravo)
- [[Williams Guard]] - High closed guard variation (Eddie Bravo)
- [[Butterfly Guard]] - Open guard with hooks under opponent's thighs

## Related Positions

- [[Mount]] - Related position
- [[Half Guard Bottom]] - Related position
- [[Open Guard Bottom]] - Related position
- [[Butterfly Guard]] - Related position
- [[Reverse De La Riva Guard]] - Related position

## Decision Tree
If opponent establishes strong posture:
- Execute [[Hip Bump Sweep]] → [[Mount]] (Probability: 55%)
- Or Execute [[Scissor Sweep]] → [[Mount]] or [[Side Control Top]] (Probability: 50%)

Else if opponent drives forward with pressure:
- Execute [[Pendulum Sweep]] → [[Mount]] (Probability: 45%)
- Or Execute [[Triangle Choke]] → [[Triangle Control]] (Probability: 40%)

Else if opponent stands up:
- Transition to [[Open Guard Bottom]] → [[Open Guard Bottom]] (Probability: 60%)

Else (balanced opponent):
- Break posture and initiate [[Triangle Choke]] → [[Triangle Control]] (Probability: 40%)
- Or Execute [[Armbar]] → [[Armbar Control]] (Probability: 35%)

## Position Metrics
- **Position Retention Rate**: Beginner 60%, Intermediate 70%, Advanced 80%
- **Advancement Probability**: Beginner 40%, Intermediate 55%, Advanced 70%
- **Submission Probability**: Beginner 25%, Intermediate 35%, Advanced 50%
- **Position Loss Probability**: Beginner 35%, Intermediate 25%, Advanced 15%
- **Average Time in Position**: 2-3 minutes

## Optimal Submission Paths
The shortest path to submission from this position:
[[Closed Guard Bottom]] → [[Cross Collar Choke]] → [[Won by Submission]]

High-percentage path:
[[Closed Guard Bottom]] → [[Break Posture]] → [[Triangle Choke]] → [[Triangle Control]] → [[Won by Submission]]

Alternative submission path:
[[Closed Guard Bottom]] → [[Break Posture]] → [[Armbar]] → [[Armbar Control]] → [[Won by Submission]]

Sweep to dominance path:
[[Closed Guard Bottom]] → [[Hip Bump Sweep]] → [[Mount]] → [[Submission Chain]] → [[Won by Submission]]
