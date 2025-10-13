---
title: "Inside Ashi Garami Bottom | BJJ Position Guide | BJJ Graph"
description: "Master Inside Ashi Garami Bottom in BJJ. Complete guide covering leg entanglement control and heel hook attacks. Success rates: Beginner 35%, Intermediate 50%, Advanced 70%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S244
  position_name: "Inside Ashi Garami Bottom"
  alternative_names: ["Inside Ashi", "Standard Ashi Garami", "Basic Leg Entanglement"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Offensive leg entanglement"
    risk_level: "High"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 35
      intermediate: 50
      advanced: 70
    advancement_probability:
      beginner: 40
      intermediate: 55
      advanced: 75
    submission_probability:
      beginner: 30
      intermediate: 45
      advanced: 65
    position_loss_probability:
      beginner: 50
      intermediate: 35
      advanced: 20
    average_time_in_position: "30-90 seconds"

  # State Machine Integration
  invariants:
    - "Outside leg controlling opponent's trapped leg"
    - "Inside leg positioned across opponent's hip"
    - "Opponent's leg trapped between your legs"

  # Available Transitions
  offensive_transitions:
    - technique: "Inside Heel Hook"
      target_state: "Won by Submission"
      transition_id: "T409"
      success_rate:
        beginner: 30
        intermediate: 45
        advanced: 65

    - technique: "Straight Ankle Lock"
      target_state: "Won by Submission"
      transition_id: "T039"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 70

    - technique: "Transition to Saddle"
      target_state: "Saddle Position"
      transition_id: "T444"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 75

    - technique: "Transition to 50-50"
      target_state: "50-50 Guard Bottom"
      transition_id: "T445"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

    - technique: "Outside Ashi Transition"
      target_state: "Ashi Garami"
      transition_id: "T446"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 65

    - technique: "Sweep to Top"
      target_state: "Inside Ashi Garami Top"
      transition_id: "T447"
      success_rate:
        beginner: 30
        intermediate: 45
        advanced: 60

  defensive_responses:
    - technique: "Clear Legs and Pass"
      target_state: "Top Position"
      success_rate: 45

    - technique: "Pommeling to 50-50"
      target_state: "50-50 Guard Top"
      success_rate: 40

    - technique: "Back Step Escape"
      target_state: "Standing Position"
      success_rate: 35

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent's heel exposed and controlled"
      options:
        - action: "Inside Heel Hook"
          target: "Won by Submission"
          probability: 45
        - action: "Straight Ankle Lock"
          target: "Won by Submission"
          probability: 50

    - condition: "Opponent defends heel exposure"
      options:
        - action: "Transition to Saddle"
          target: "Saddle Position"
          probability: 55
        - action: "Transition to 50-50"
          target: "50-50 Guard Bottom"
          probability: 60

    - condition: "Opponent attempts to pass"
      options:
        - action: "Sweep to Top"
          target: "Inside Ashi Garami Top"
          probability: 45
        - action: "Outside Ashi Transition"
          target: "Ashi Garami"
          probability: 50

    - condition: "Opponent maintains defensive posture"
      options:
        - action: "Transition to Saddle"
          target: "Saddle Position"
          probability: 55
        - action: "Straight Ankle Lock"
          target: "Won by Submission"
          probability: 50

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 2.5
    defender_burn_rate: 2.5
    explosive_escape_multiplier: 4.0
    cooking_rate: 1.5

  # Related States
  related_states:
    - "Ashi Garami"
    - "Saddle Position"
    - "50-50 Guard Bottom"
    - "Inside Ashi Garami Top"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Inside Ashi Garami Bottom in BJJ",
  "description": "Complete guide to executing techniques and transitions from Inside Ashi Garami Bottom.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Leg Entanglement",
      "text": "Control opponent's leg between your legs with outside leg securing heel and inside leg across hip.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Control the Heel",
      "text": "Secure opponent's heel with proper grip, preparing for heel hook or ankle lock attacks.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Execute Inside Heel Hook",
      "text": "When heel is exposed, apply inside heel hook rotation towards opponent's knee line.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Alternative Ankle Lock",
      "text": "If heel defended, transition to straight ankle lock with proper positioning.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Transition to Saddle",
      "text": "If opponent defends submissions, transition to saddle position for better control.",
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
      "name": "What is a common mistake in Poor heel control?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to free leg and escape, eliminates submission opportunities. The correction is: Secure heel with C-grip or figure-four grip, maintain constant pressure, position heel against your torso for maximum control."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Weak inside leg positioning?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Reduces control and allows opponent to create distance and escape entanglement. The correction is: Keep inside leg tight across opponent's hip, use it to control distance and prevent them from pulling away."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Not controlling opponent's knee line?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gives opponent defensive leverage and reduces submission effectiveness. The correction is: Control opponent's knee with your outside leg, prevent them from straightening leg, maintain proper angle for attacks."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Applying heel hooks without proper control?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "DANGER: Can cause serious injury to partner and indicates lack of control mastery. The correction is: Master position control and straight ankle locks first, only apply heel hooks in controlled training environment with experienced partners and proper safety protocols."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Staying static without transitions?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent time to escape or counter, reduces submission success. The correction is: Constantly threaten submissions and position improvements, transition between entries fluidly, maintain offensive pressure."
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
  "name": "Inside Ashi Garami Bottom",
  "description": "Master Inside Ashi Garami Bottom in BJJ. Complete guide covering leg entanglement control and heel hook attacks. Success rates: Beginner 35%, Intermediate 50%, Advanced 70%.",
  "url": "https://bjjgraph.com/positions/inside-ashi-garami-bottom",
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
      "name": "Inside Ashi Garami Bottom",
      "item": "https://bjjgraph.com/positions/inside-ashi-garami-bottom"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Inside Ashi Garami Bottom (S244) - Fundamental leg entanglement with opponent's leg trapped between your legs. Offensive position with heel hook and ankle lock attacks. Requires technical precision and safety awareness.

KEY_MECHANICS: Outside leg controls heel and lower leg, inside leg across hip controls distance, hip positioning critical for leverage. Standard entry point for leg lock game.

STRATEGIC_VALUE: Intermediate to advanced position with moderate success rates (35-70%). High risk due to counter-entanglement possibilities. Gateway to more advanced leg lock positions.

COMMON_PATTERNS: Exposed heel → Inside heel hook or ankle lock. Defended heel → Saddle or 50-50 transition. Pass attempt → Sweep or outside ashi. Static defense → Position advancement.

SYSTEM_INTEGRATION: Foundation of modern leg lock systems (Danaher, Lachlan Giles), connects to saddle, 50-50, and outside ashi positions.
-->

# Inside Ashi Garami Bottom
#bjj #state #leg-entanglement #bottom #advanced #leg-locks

## State Properties
- **State ID**: S244
- **Point Value**: 0 (Neutral)
- **Position Type**: Offensive leg entanglement
- **Risk Level**: High
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
Inside Ashi Garami Bottom is a fundamental leg entanglement position where the attacker controls one of the opponent's legs between their own legs while positioned on their back or side. The position is characterized by the outside leg hooking around the opponent's trapped leg with control of the heel, while the inside leg is positioned across the opponent's hip to control distance and prevent escape.

Inside Ashi Garami serves as the foundational position for modern leg lock attacks and is the entry point for more advanced leg entanglements. The position requires technical precision and safety awareness, particularly when applying heel hooks.

### Visual Description
You are positioned on your back or side with one of your opponent's legs trapped between your legs. Your outside leg (the leg on the same side as their trapped leg) hooks around their leg with your foot positioned near or controlling their heel, creating a secure grip on their lower leg. Your inside leg is positioned across their hip or thigh, acting as a frame to control distance and prevent them from pulling their leg free. Your upper body is positioned to face their trapped leg, with your torso angled and your hands securing their heel with a C-grip or figure-four grip, depending on the submission you're setting up. Your hips are mobile and can adjust to create angles for attacking heel hooks or ankle locks. The configuration creates a triangle-like control around their leg while your hip positioning provides both offensive leverage and defensive structure, making it difficult for them to free their leg or counter-attack while giving you access to multiple leg lock submissions.

## Key Principles
- Secure heel control with proper gripping
- Use inside leg to control distance and hip positioning
- Maintain mobile hips for angle creation and attacks
- Control opponent's knee line with outside leg
- Transition fluidly between submissions and positions
- SAFETY FIRST: Always apply leg locks slowly and progressively

## Prerequisites
- Understanding of leg lock safety protocols
- Basic leg entanglement mechanics
- Ankle lock proficiency before heel hooks
- Training with experienced partners

## State Invariants
- Outside leg controlling opponent's trapped leg
- Inside leg positioned across opponent's hip
- Opponent's leg trapped between your legs

## Defensive Responses (When Opponent Has This State)
- [[Clear Legs and Pass]] → [[Top Position]] (Success Rate: 45%)
- [[Pommeling to 50-50]] → [[50-50 Guard Top]] (Success Rate: 40%)
- [[Back Step Escape]] → [[Standing Position]] (Success Rate: 35%)

## Offensive Transitions (Available From This State)
- [[Inside Heel Hook]] → [[Won by Submission]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 65%)
- [[Straight Ankle Lock]] → [[Won by Submission]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 70%)
- [[Transition to Saddle]] → [[Saddle Position]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 75%)
- [[Transition to 50-50]] → [[50-50 Guard Bottom]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
- [[Outside Ashi Transition]] → [[Ashi Garami]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Sweep to Top]] → [[Inside Ashi Garami Top]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)

## Counter Transitions
- [[Heel Re-Control]] → [[Inside Ashi Garami Bottom]] (regaining heel control)
- [[Position Adjustment]] → [[Inside Ashi Garami Bottom]] (improving angle)
- [[Leg Lock Defense]] → [[Defensive Position]] (when opponent counter-attacks)

## Expert Insights
- **Danaher System**: Inside Ashi Garami is the foundational position of the leg lock system and the entry point students must master before progressing to more advanced entanglements. Emphasizes that control must be perfected before attempting submissions - the hierarchy is position before submission. The critical element is heel control; without proper heel control, no leg lock is truly effective. Teaches systematic progression: establish inside ashi, perfect control, attack straight ankle lock until mastered, then progress to heel hooks only with proper instruction and safety awareness.
- **Gordon Ryan**: Uses Inside Ashi as a dynamic position rather than static control, constantly transitioning between different leg entanglements to keep opponent defending. Prefers to use Inside Ashi as a quick entry to saddle position, viewing it as a transitional position rather than a finishing position. In competition, establishes Inside Ashi and immediately begins working towards more dominant leg entanglements or direct submission attacks.
- **Eddie Bravo**: While 10th Planet system traditionally focused on other positions, modern leg lock integration includes Inside Ashi as a key component. Emphasizes the importance of safety in training and the need for progressive learning. Views Inside Ashi as a powerful position that requires respect and proper instruction due to the dangerous nature of heel hooks.

## Common Errors
- **Error**: Poor heel control
  - **Consequence**: Allows opponent to free leg and escape, eliminates submission opportunities.
  - **Correction**: Secure heel with C-grip or figure-four grip, maintain constant pressure, position heel against your torso for maximum control.
- **Error**: Weak inside leg positioning
  - **Consequence**: Reduces control and allows opponent to create distance and escape entanglement.
  - **Correction**: Keep inside leg tight across opponent's hip, use it to control distance and prevent them from pulling away.
- **Error**: Not controlling opponent's knee line
  - **Consequence**: Gives opponent defensive leverage and reduces submission effectiveness.
  - **Correction**: Control opponent's knee with your outside leg, prevent them from straightening leg, maintain proper angle for attacks.
- **Error**: Applying heel hooks without proper control
  - **Consequence**: DANGER - Can cause serious injury to partner and indicates lack of control mastery.
  - **Correction**: Master position control and straight ankle locks first, only apply heel hooks in controlled training environment with experienced partners and proper safety protocols.
- **Error**: Staying static without transitions
  - **Consequence**: Allows opponent time to escape or counter, reduces submission success.
  - **Correction**: Constantly threaten submissions and position improvements, transition between entries fluidly, maintain offensive pressure.

## Training Drills
- **Inside Ashi Entry and Control**: Practice entering Inside Ashi from various positions (guard, scrambles, transitions) with progressive resistance (0%, 25%, 50%), focusing on securing heel control and establishing proper leg positioning.
- **Straight Ankle Lock Mastery**: Drill straight ankle locks exclusively from Inside Ashi for extended period before progressing to heel hooks, developing proper mechanics, control, and safety awareness.
- **Position Transitions**: Flow between Inside Ashi, Outside Ashi, 50-50, and Saddle positions, learning to recognize optimal moments for transitions and maintaining control throughout.
- **Heel Control Retention**: Partner attempts to extract leg using proper escape techniques while you maintain heel control and adjust position, developing sensitivity and control maintenance.
- **Safety Protocol Drills**: Practice communication, tap recognition, and controlled release of submissions, establishing safe training habits for leg lock practice.

## Related States
- [[Ashi Garami]] - Outside Ashi variation
- [[Saddle Position]] - Advanced leg entanglement
- [[50-50 Guard Bottom]] - Bilateral leg entanglement
- [[Inside Ashi Garami Top]] - Top position variation

## Related Positions

- [[Ashi Garami]] - Positional variation
- [[Saddle Position]] - Natural progression
- [[50-50 Guard Bottom]] - Alternative entanglement
- [[Game Over Position]] - Advanced position
- [[Single Leg X Guard]] - Related leg control

## Decision Tree
If opponent's heel exposed and controlled:
- Execute [[Inside Heel Hook]] → [[Won by Submission]] (Probability: 45%)
- Or Execute [[Straight Ankle Lock]] → [[Won by Submission]] (Probability: 50%)

Else if opponent defends heel exposure:
- Execute [[Transition to Saddle]] → [[Saddle Position]] (Probability: 55%)
- Or Execute [[Transition to 50-50]] → [[50-50 Guard Bottom]] (Probability: 60%)

Else if opponent attempts to pass:
- Execute [[Sweep to Top]] → [[Inside Ashi Garami Top]] (Probability: 45%)
- Or Execute [[Outside Ashi Transition]] → [[Ashi Garami]] (Probability: 50%)

Else (opponent maintains defensive posture):
- Execute [[Transition to Saddle]] → [[Saddle Position]] (Probability: 55%)
- Or Execute [[Straight Ankle Lock]] → [[Won by Submission]] (Probability: 50%)

## Position Metrics
- **Position Retention Rate**: Beginner 35%, Intermediate 50%, Advanced 70%
- **Advancement Probability**: Beginner 40%, Intermediate 55%, Advanced 75%
- **Submission Probability**: Beginner 30%, Intermediate 45%, Advanced 65%
- **Position Loss Probability**: Beginner 50%, Intermediate 35%, Advanced 20%
- **Average Time in Position**: 30-90 seconds

## Optimal Submission Paths
Direct submission path (safe progression):
[[Inside Ashi Garami Bottom]] → [[Straight Ankle Lock]] → [[Won by Submission]]

Advanced submission path:
[[Inside Ashi Garami Bottom]] → [[Inside Heel Hook]] → [[Won by Submission]]

Position advancement path:
[[Inside Ashi Garami Bottom]] → [[Transition to Saddle]] → [[Saddle Position]] → [[Leg Lock Submissions]] → [[Won by Submission]]

Bilateral entanglement path:
[[Inside Ashi Garami Bottom]] → [[Transition to 50-50]] → [[50-50 Guard Bottom]] → [[Submissions]] → [[Won by Submission]]
