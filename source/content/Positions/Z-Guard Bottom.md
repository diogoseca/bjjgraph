---
title: "Z-Guard Bottom | BJJ Position Guide | BJJ Graph"
description: "Master Z-Guard Bottom in BJJ. Complete guide covering knee shield control, sweeps, and submissions. Success rates: Beginner 50%, Intermediate 65%, Advanced 75%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S240
  position_name: "Z-Guard Bottom"
  alternative_names: ["Knee Shield Half Guard", "Z Guard", "Shield Guard"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Defensive with offensive options"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 50
      intermediate: 65
      advanced: 75
    advancement_probability:
      beginner: 45
      intermediate: 60
      advanced: 75
    submission_probability:
      beginner: 20
      intermediate: 30
      advanced: 45
    position_loss_probability:
      beginner: 40
      intermediate: 30
      advanced: 20
    average_time_in_position: "1-2 minutes"

  # State Machine Integration
  invariants:
    - "One leg trapped between your legs (half guard component)"
    - "Knee shield against opponent's chest/shoulder"
    - "Bottom leg controlling opponent's trapped leg"

  # Available Transitions
  offensive_transitions:
    - technique: "Old School Sweep"
      target_state: "Side Control Top"
      transition_id: "T423"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

    - technique: "Homer Simpson Sweep"
      target_state: "Mount"
      transition_id: "T424"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 65

    - technique: "Underhook Sweep"
      target_state: "Side Control Top"
      transition_id: "T422"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

    - technique: "Kimura from Z-Guard"
      target_state: "Kimura Control"
      transition_id: "T425"
      success_rate:
        beginner: 25
        intermediate: 40
        advanced: 55

    - technique: "Triangle from Z-Guard"
      target_state: "Triangle Control"
      transition_id: "T426"
      success_rate:
        beginner: 20
        intermediate: 35
        advanced: 50

    - technique: "Deep Half Entry"
      target_state: "Deep Half Guard"
      transition_id: "T085"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

    - technique: "Transition to Full Guard"
      target_state: "Closed Guard Bottom"
      transition_id: "T427"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 65

  defensive_responses:
    - technique: "Knee Slice Pass"
      target_state: "Side Control Top"
      success_rate: 45

    - technique: "Pressure Pass"
      target_state: "Half Guard Pass Position"
      success_rate: 40

    - technique: "Backstep Pass"
      target_state: "Back Control"
      success_rate: 35

    - technique: "Smash Pass"
      target_state: "Side Control Top"
      success_rate: 30

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent drives forward into knee shield"
      options:
        - action: "Old School Sweep"
          target: "Side Control Top"
          probability: 55
        - action: "Underhook Sweep"
          target: "Side Control Top"
          probability: 60

    - condition: "Opponent stands to pass"
      options:
        - action: "Homer Simpson Sweep"
          target: "Mount"
          probability: 50
        - action: "Transition to Full Guard"
          target: "Closed Guard Bottom"
          probability: 50

    - condition: "Opponent attempts to flatten knee shield"
      options:
        - action: "Deep Half Entry"
          target: "Deep Half Guard"
          probability: 55
        - action: "Kimura from Z-Guard"
          target: "Kimura Control"
          probability: 40

    - condition: "Opponent maintains distance"
      options:
        - action: "Underhook Sweep"
          target: "Side Control Top"
          probability: 60
        - action: "Triangle from Z-Guard"
          target: "Triangle Control"
          probability: 35

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 2.5
    defender_burn_rate: 2.0
    explosive_escape_multiplier: 3.5
    cooking_rate: 1.8

  # Related States
  related_states:
    - "Half Guard Bottom"
    - "Knee Shield Half Guard"
    - "Deep Half Guard"
    - "Closed Guard Bottom"
    - "Open Guard Bottom"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Z-Guard Bottom in BJJ",
  "description": "Complete guide to executing techniques and transitions from Z-Guard Bottom.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Knee Shield",
      "text": "Create a strong knee shield against opponent's chest, maintaining distance and frame.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Control Bottom Leg",
      "text": "Use your bottom leg to control opponent's trapped leg, preventing them from freeing it.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Execute Old School Sweep",
      "text": "When opponent drives forward, execute Old School Sweep to transition to Side Control Top.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Execute Underhook Sweep",
      "text": "Secure underhook and execute sweep to Side Control Top position.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Attack with Kimura",
      "text": "When opponent attempts to flatten, attack with Kimura to Kimura Control.",
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
      "name": "What is a common mistake in Knee shield too weak or collapsed?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to flatten you and pass, reducing defensive capabilities. The correction is: Maintain strong frame with knee shield against opponent's chest/shoulder, keeping leg pressure constant and using your foot against their hip for additional control."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Losing underhook battle?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gives opponent dominant control, making sweeps difficult and passes easier. The correction is: Fight aggressively for underhook on trapped leg side, use frames to prevent opponent's crossface, and maintain active hand fighting."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Bottom leg not controlling?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Opponent easily extracts trapped leg and completes pass. The correction is: Use bottom leg to hook opponent's trapped leg, maintaining connection and pressure to prevent extraction while creating sweep opportunities."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Static position without movement?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Creates stalemate, reduces sweep opportunities, allows opponent to plan pass. The correction is: Constantly adjust knee shield angle, off-balance opponent with small pushes/pulls, threaten multiple attacks to create reactions."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Letting opponent get crossface?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Severely compromises position, makes flattening easy, eliminates most offensive options. The correction is: Keep inside arm framing against opponent's face/shoulder, never let crossface establish, immediately address if it begins to form."
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
  "name": "Z-Guard Bottom",
  "description": "Master Z-Guard Bottom in BJJ. Complete guide covering knee shield control, sweeps, and submissions. Success rates: Beginner 50%, Intermediate 65%, Advanced 75%.",
  "url": "https://bjjgraph.com/positions/z-guard-bottom",
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
      "name": "Z-Guard Bottom",
      "item": "https://bjjgraph.com/positions/z-guard-bottom"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Z-Guard Bottom (S240) - Half guard variation featuring knee shield frame. Defensive position with strong sweep potential. Maintains distance through active knee shield while controlling opponent's trapped leg.

KEY_MECHANICS: Knee shield creates distance and frame, bottom leg controls trapped leg, underhook provides sweep leverage. Balance between defensive frames and offensive grips.

STRATEGIC_VALUE: Intermediate-level position that excels against pressure passers. Strong retention rates when properly maintained. Multiple sweep and transition options.

COMMON_PATTERNS: Forward pressure → Old School/Underhook Sweep. Standing opponent → Homer Simpson Sweep. Flattening attempt → Deep Half entry. Distance maintenance → Triangle/Kimura attacks.

SYSTEM_INTEGRATION: Core component of modern half guard systems, connects to deep half guard, integrates with leg entanglement game.
-->

# Z-Guard Bottom
#bjj #state #guard #half-guard #bottom #knee-shield

## State Properties
- **State ID**: S240
- **Point Value**: 0 (Neutral)
- **Position Type**: Defensive with offensive options
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
Z-Guard Bottom (also known as Knee Shield Half Guard) is a modern half guard variation where the bottom player uses one leg to trap the opponent's leg while the other leg creates a knee shield frame against the opponent's chest or shoulder. This configuration provides excellent defensive frames while maintaining offensive capabilities through sweeps and submissions.

The position is named for the "Z" shape formed by the legs when viewed from above. It represents a balance between the security of traditional half guard and the mobility of open guard positions.

### Visual Description
You are on your back with one of your opponent's legs trapped between both of yours (half guard component). Your top leg is bent with the knee pointing upward, creating a frame (knee shield) against your opponent's chest, shoulder, or bicep, while your foot is placed on their hip for additional control. Your bottom leg hooks around their trapped leg, preventing extraction. Your upper body is slightly elevated, with one hand typically securing an underhook on the trapped leg side while your other hand controls their far sleeve or collar, or posts on the mat for base. Your hips are angled slightly away from your opponent, creating space and making it difficult for them to flatten you or complete a pass. This configuration allows you to maintain distance through the knee shield while simultaneously controlling their trapped leg, setting up sweeps and preventing passes.

## Key Principles
- Maintain active knee shield pressure against opponent's chest/shoulder
- Control trapped leg with bottom leg to prevent extraction
- Fight for underhook on trapped leg side for sweep leverage
- Create angles by hip shifting to enhance sweep mechanics
- Use frames to prevent crossface and maintain distance
- Threaten multiple attacks to create defensive reactions

## Prerequisites
- Basic half guard understanding
- Hip mobility for maintaining knee shield
- Frame strength for sustained pressure
- Understanding of underhook control

## State Invariants
- One leg trapped between your legs (half guard component)
- Knee shield against opponent's chest/shoulder
- Bottom leg controlling opponent's trapped leg

## Defensive Responses (When Opponent Has This State)
- [[Knee Slice Pass]] → [[Side Control Top]] (Success Rate: 45%)
- [[Pressure Pass]] → [[Half Guard Pass Position]] (Success Rate: 40%)
- [[Backstep Pass]] → [[Back Control]] (Success Rate: 35%)
- [[Smash Pass]] → [[Side Control Top]] (Success Rate: 30%)

## Offensive Transitions (Available From This State)
- [[Old School Sweep]] → [[Side Control Top]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Homer Simpson Sweep]] → [[Mount]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Underhook Sweep]] → [[Side Control Top]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
- [[Kimura from Z-Guard]] → [[Kimura Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 55%)
- [[Triangle from Z-Guard]] → [[Triangle Control]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 50%)
- [[Deep Half Entry]] → [[Deep Half Guard]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Transition to Full Guard]] → [[Closed Guard Bottom]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)

## Counter Transitions
- [[Knee Shield Retention]] → [[Z-Guard Bottom]] (against flattening attempts)
- [[Sweep Chain]] → [[Top Position]] (linking multiple sweeps)
- [[Guard Recovery]] → [[Full Guard]] (when position threatened)

## Expert Insights
- **Danaher System**: Views Z-Guard as a transitional position within the broader half guard system. Emphasizes the importance of the knee shield as an active frame rather than passive barrier, using it to create angles and off-balance opponent before committing to sweeps. Focuses on the underhook battle as critical - whoever wins the underhook dictates the engagement.
- **Gordon Ryan**: Uses Z-Guard primarily as a defensive shield when bottom position is compromised. Prefers to immediately attack with Old School sweep or transition to deep half rather than prolonged engagement. Emphasizes aggression - if opponent is static, immediately begin sweep attempt rather than waiting.
- **Eddie Bravo**: Incorporates Z-Guard into the 10th Planet system as a connection point between lockdown and deep half. Uses the knee shield to set up electric chair entries and Homer Simpson sweeps. Views the position as inherently dynamic - constant movement and pressure rather than static control.

## Common Errors
- **Error**: Knee shield too weak or collapsed
  - **Consequence**: Allows opponent to flatten you and pass, reducing defensive capabilities.
  - **Correction**: Maintain strong frame with knee shield against opponent's chest/shoulder, keeping leg pressure constant and using your foot against their hip for additional control.
- **Error**: Losing underhook battle
  - **Consequence**: Gives opponent dominant control, making sweeps difficult and passes easier.
  - **Correction**: Fight aggressively for underhook on trapped leg side, use frames to prevent opponent's crossface, and maintain active hand fighting.
- **Error**: Bottom leg not controlling
  - **Consequence**: Opponent easily extracts trapped leg and completes pass.
  - **Correction**: Use bottom leg to hook opponent's trapped leg, maintaining connection and pressure to prevent extraction while creating sweep opportunities.
- **Error**: Static position without movement
  - **Consequence**: Creates stalemate, reduces sweep opportunities, allows opponent to plan pass.
  - **Correction**: Constantly adjust knee shield angle, off-balance opponent with small pushes/pulls, threaten multiple attacks to create reactions.
- **Error**: Letting opponent get crossface
  - **Consequence**: Severely compromises position, makes flattening easy, eliminates most offensive options.
  - **Correction**: Keep inside arm framing against opponent's face/shoulder, never let crossface establish, immediately address if it begins to form.

## Training Drills
- **Knee Shield Retention**: Practice maintaining knee shield against progressive pressure (25%, 50%, 75%, 100%), focusing on frame strength and angle adjustment.
- **Sweep Chains from Z-Guard**: Drill Old School to Homer Simpson to Deep Half transitions, practicing fluidity between different sweep mechanics based on opponent reactions.
- **Underhook Battle Drills**: Work underhook fighting scenarios with partner, practicing grip breaks, re-establishing frames, and preventing crossface while maintaining position.
- **Dynamic Z-Guard Movement**: Flow drill incorporating hip shifts, knee shield angle changes, and off-balancing movements to develop active rather than static guard.
- **Guard Recovery to Z-Guard**: Practice transitioning from compromised positions into Z-Guard, developing this as reliable defensive checkpoint.

## Related States
- [[Half Guard Bottom]] - Traditional half guard without knee shield
- [[Knee Shield Half Guard]] - Similar position, different name
- [[Deep Half Guard]] - Lower half guard variation
- [[Closed Guard Bottom]] - Full guard with both legs around waist
- [[Open Guard Bottom]] - Open guard family of positions

## Related Positions

- [[Half Guard Bottom]] - Parent position
- [[Deep Half Guard]] - Natural progression
- [[Knee Shield Half Guard]] - Variation
- [[Lockdown Guard]] - Alternative half guard system
- [[Butterfly Guard]] - Related open guard position

## Decision Tree
If opponent drives forward into knee shield:
- Execute [[Old School Sweep]] → [[Side Control Top]] (Probability: 55%)
- Or Execute [[Underhook Sweep]] → [[Side Control Top]] (Probability: 60%)

Else if opponent stands to pass:
- Execute [[Homer Simpson Sweep]] → [[Mount]] (Probability: 50%)
- Or Transition to [[Closed Guard Bottom]] → [[Closed Guard Bottom]] (Probability: 50%)

Else if opponent attempts to flatten knee shield:
- Execute [[Deep Half Entry]] → [[Deep Half Guard]] (Probability: 55%)
- Or Execute [[Kimura from Z-Guard]] → [[Kimura Control]] (Probability: 40%)

Else (opponent maintains distance):
- Execute [[Underhook Sweep]] → [[Side Control Top]] (Probability: 60%)
- Or Execute [[Triangle from Z-Guard]] → [[Triangle Control]] (Probability: 35%)

## Position Metrics
- **Position Retention Rate**: Beginner 50%, Intermediate 65%, Advanced 75%
- **Advancement Probability**: Beginner 45%, Intermediate 60%, Advanced 75%
- **Submission Probability**: Beginner 20%, Intermediate 30%, Advanced 45%
- **Position Loss Probability**: Beginner 40%, Intermediate 30%, Advanced 20%
- **Average Time in Position**: 1-2 minutes

## Optimal Submission Paths
High-percentage sweep to submission path:
[[Z-Guard Bottom]] → [[Underhook Sweep]] → [[Side Control Top]] → [[Kimura]] → [[Won by Submission]]

Direct submission path:
[[Z-Guard Bottom]] → [[Kimura from Z-Guard]] → [[Kimura Control]] → [[Won by Submission]]

Alternative submission path:
[[Z-Guard Bottom]] → [[Triangle from Z-Guard]] → [[Triangle Control]] → [[Won by Submission]]

Sweep to dominance path:
[[Z-Guard Bottom]] → [[Old School Sweep]] → [[Side Control Top]] → [[Mount Transition]] → [[Submission Chain]] → [[Won by Submission]]
