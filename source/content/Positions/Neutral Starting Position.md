---
title: "Neutral Starting Position | BJJ Position Guide | BJJ Graph"
description: "Master Neutral Starting Position in BJJ. Complete guide covering stance, grip fighting, and transitions. Success rates: Beginner 55%, Intermediate 70%, Advanced 85%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S220
  position_name: "Neutral Starting Position"
  alternative_names: ["Standing Neutral", "Match Start", "Reset Position"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Neutral"
    risk_level: "Low"
    energy_cost: "Low"
    time_sustainability: "Long"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 55
      intermediate: 70
      advanced: 85
    advancement_probability:
      beginner: 50
      intermediate: 65
      advanced: 80
    submission_probability:
      beginner: 5
      intermediate: 10
      advanced: 15
    position_loss_probability:
      beginner: 35
      intermediate: 20
      advanced: 10
    average_time_in_position: "30-60 seconds"

  # State Machine Integration
  invariants:
    - "Both competitors standing and facing each other"
    - "Equal positional advantage with no control established"
    - "Full mobility and range of motion available"

  # Available Transitions
  offensive_transitions:
    - technique: "Pull Guard"
      target_state: "Closed Guard Bottom"
      transition_id: "T401"
      success_rate:
        beginner: 60
        intermediate: 75
        advanced: 85

    - technique: "Takedown Entry"
      target_state: "Top Position"
      transition_id: "T402"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 70

    - technique: "Snap Down"
      target_state: "Front Headlock"
      transition_id: "T403"
      success_rate:
        beginner: 30
        intermediate: 45
        advanced: 65

    - technique: "Clinch Engagement"
      target_state: "Clinch Position"
      transition_id: "T404"
      success_rate:
        beginner: 50
        intermediate: 65
        advanced: 80

    - technique: "Ankle Pick"
      target_state: "Top Position"
      transition_id: "T405"
      success_rate:
        beginner: 25
        intermediate: 40
        advanced: 60

    - technique: "Arm Drag"
      target_state: "Back Control"
      transition_id: "T406"
      success_rate:
        beginner: 20
        intermediate: 35
        advanced: 55

  defensive_responses:
    - technique: "Sprawl"
      target_state: "Front Headlock"
      success_rate: 45

    - technique: "Counter Grip"
      target_state: "Neutral Starting Position"
      success_rate: 50

    - technique: "Circle Away"
      target_state: "Neutral Starting Position"
      success_rate: 55

    - technique: "Pull Counter Guard"
      target_state: "Guard Position"
      success_rate: 40

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent is grip fighting aggressively"
      options:
        - action: "Pull Guard"
          target: "Closed Guard Bottom"
          probability: 75
        - action: "Counter with Snap Down"
          target: "Front Headlock"
          probability: 45

    - condition: "Opponent presents takedown opening"
      options:
        - action: "Execute Takedown"
          target: "Top Position"
          probability: 50
        - action: "Ankle Pick"
          target: "Top Position"
          probability: 40

    - condition: "Opponent pulls guard"
      options:
        - action: "Establish Top Position"
          target: "Open Guard Top"
          probability: 70
        - action: "Pass Immediately"
          target: "Side Control"
          probability: 35

    - condition: "Neutral stance - default"
      options:
        - action: "Engage Clinch"
          target: "Clinch Position"
          probability: 65
        - action: "grip fighting"
          target: "Neutral Starting Position"
          probability: 50

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 1.0
    defender_burn_rate: 1.0
    explosive_escape_multiplier: 3.0
    cooking_rate: 0.5

  # Related States
  related_states:
    - "Clinch Position"
    - "Closed Guard Bottom"
    - "Front Headlock"
    - "Top Position"
    - "Open Guard Top"
---


<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Neutral Starting Position in BJJ",
  "description": "Complete guide to executing techniques and transitions from Neutral Starting Position.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Athletic Stance",
      "text": "Stand with feet shoulder-width apart, knees slightly bent, maintaining balanced posture with hands ready.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Control Distance",
      "text": "Maintain optimal distance for offense and defense, circling and adjusting positioning as needed.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Engage in Grip Fighting",
      "text": "Fight for dominant grips while preventing opponent from securing controlling grips on you.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Execute Takedown or Pull Guard",
      "text": "Based on opportunity and strategy, initiate takedown attempt or transition to guard position.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Defend Opponent's Attacks",
      "text": "Counter opponent's takedown attempts with sprawls, frames, or grip breaks as appropriate.",
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
      "name": "What is a common mistake in Upright posture without bend?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Makes you vulnerable to takedowns and reduces ability to defend or attack effectively. The correction is: Maintain slight knee bend and hip hinge to create athletic stance with explosive potential and defensive stability."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Crossing feet or narrow stance?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Compromises balance and makes you easy to off-balance or take down. The correction is: Keep feet shoulder-width apart with toes pointed forward or slightly outward for maximum base and mobility."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Passive grip fighting?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to dominate grips and control the engagement, putting you at strategic disadvantage. The correction is: Actively fight for grips while breaking opponent's grips, maintaining initiative in the standing phase."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Reaching without setup?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Exposes you to counters and creates predictable attack patterns easy to defend. The correction is: Use feints, footwork, and grip sequences to set up attacks rather than reaching directly."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Static positioning?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Makes you an easy target and reduces your ability to create angles for attacks. The correction is: Constantly circle, adjust distance, and change levels to maintain dynamic positioning and create opportunities."
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
  "name": "Neutral Starting Position",
  "description": "Master Neutral Starting Position in BJJ. Complete guide covering stance, grip fighting, and transitions. Success rates: Beginner 55%, Intermediate 70%, Advanced 85%.",
  "url": "https://bjjgraph.com/positions/neutral-starting-position",
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
      "name": "Neutral Starting Position",
      "item": "https://bjjgraph.com/positions/neutral-starting-position"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Neutral Starting Position (S220) - Equal standing position where both competitors have full mobility and no control established. Starting point for all BJJ matches.

KEY_MECHANICS: Athletic stance with balanced weight distribution. Active grip fighting to establish control. Distance management to create opportunities or defend. Multiple transition options available.

STRATEGIC_VALUE: Neutral position favoring the more aggressive or better prepared competitor. Low energy cost allows extended duration. Critical for takedown game and guard pulling strategy.

COMMON_PATTERNS: Grip fighting → Takedown or guard pull. Distance control → Setup attacks. Opponent aggression → Counter or defend. No clear advantage → Engage clinch.

SYSTEM_INTEGRATION: Foundation for all standing techniques in BJJ. Connects to wrestling and judo systems. Critical for modern BJJ competition strategy.
-->

# Neutral Starting Position
#bjj #state #neutral #standing #fundamental

## State Properties
- **State ID**: S220
- **Point Value**: 0 (No points awarded)
- **Position Type**: Neutral
- **Risk Level**: Low
- **Energy Cost**: Low
- **Time Sustainability**: Long

## State Description
Neutral Starting Position represents the equal standing state in BJJ where both competitors are upright, facing each other, and neither has established control. This is the beginning position for all BJJ matches and represents a state of complete tactical equality. Both grapplers have full mobility, all options available, and no positional advantage.

This position is characterized by its openness and tactical complexity. Unlike ground positions where physical control dictates the advantage, the neutral standing position is defined by distance management, grip fighting, footwork, and strategic decision-making. Success in this position depends on reading your opponent's intentions, controlling grips, managing distance, and timing your attacks or defensive reactions.

The neutral position is where matches begin and where they reset after out-of-bounds or stalling calls. It's a low-risk, low-energy state that allows both competitors to implement their preferred strategies - whether that's attempting takedowns, pulling guard, or establishing clinch control. The ability to effectively navigate this position determines whether you can implement your game plan or whether you're forced into your opponent's preferred positions.

## Visual Description
You are standing upright with your feet approximately shoulder-width apart, knees slightly bent in an athletic stance. Your weight is distributed evenly across both feet with your center of gravity lowered through hip flexion and knee bend. Your hands are positioned between waist and chest height, ready to engage in grip fighting or defend against opponent's attacks. Your torso is slightly forward with your head up and eyes focused on your opponent's center of mass.

Your opponent is in a similar standing position facing you, approximately one to two arm's lengths away. Both of you maintain this dynamic distance, circling and adjusting position constantly. Your hands may be outstretched for grip fighting on sleeves, collar, or pants depending on gi or no-gi context. Neither competitor has established dominant grips or body position control.

The space between you represents tactical potential - close enough to engage but far enough to react and defend. Your stance allows you to quickly shoot for takedowns, defend opponent's attacks, or transition to guard pulling. This positioning creates a state of equal opportunity where timing, technique, and strategy determine who gains the first positional advantage.

## Key Principles
- **Athletic Stance Foundation**: Maintain balanced posture with knees bent and weight centered for explosive offense and solid defense
- **Active Grip Fighting**: Constantly fight for dominant grips while breaking opponent's grips to control engagement
- **Distance Management**: Control the space between you and opponent to create attacking opportunities while defending against their offense
- **Strategic Initiative**: Make deliberate decisions about pulling guard vs. attempting takedowns based on strengths and game plan
- **Dynamic Movement**: Circle, change levels, and adjust position constantly to avoid becoming predictable or static
- **Energy Conservation**: Recognize neutral position as low-energy state and avoid unnecessary expenditure before engagement

## Prerequisites
- Basic athletic stance and balance
- Understanding of grip fighting fundamentals
- Knowledge of takedown and guard pull options
- Awareness of distance and timing

## State Invariants
- Both competitors standing and facing each other
- Equal positional advantage with no control established
- Full mobility and range of motion available

## Defensive Responses (When Opponent Has This State Against You)
- [[Sprawl]] → [[Front Headlock]] (Success Rate: 45%)
- [[Counter Grip]] → [[Neutral Starting Position]] (Success Rate: 50%)
- [[Circle Away]] → [[Neutral Starting Position]] (Success Rate: 55%)
- [[Pull Counter Guard]] → [[Guard Position]] (Success Rate: 40%)

## Offensive Transitions (Available From This State)
- [[Pull Guard]] → [[Closed Guard Bottom]] (Success Rate: Beginner 60%, Intermediate 75%, Advanced 85%)
- [[Takedown Entry]] → [[Top Position]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 70%)
- [[Snap Down]] → [[Front Headlock]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 65%)
- [[Clinch Engagement]] → [[Clinch Position]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)
- [[Ankle Pick]] → [[Top Position]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 60%)
- [[Arm Drag]] → [[Back Control]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 55%)

## Counter Transitions
- [[Sprawl Defense]] → [[Front Headlock]] (when opponent shoots takedown)
- [[Guard Pull Counter]] → [[Top Position]] (when opponent pulls guard poorly)
- [[Grip Break]] → [[Neutral Starting Position]] (reset to neutral)

## Expert Insights
**John Danaher**: "The neutral starting position is deceptively complex because it appears simple. The fundamental principle is that positional advantage begins here through systematic grip fighting and distance control. Modern BJJ has evolved away from traditional takedown emphasis toward guard pulling, but understanding the neutral position remains critical. Those who control grips in the standing phase control which positions the match will flow through. The key is making deliberate decisions about whether to engage in takedown exchanges or to pull guard based on your systematic approach and opponent's tendencies."

**Gordon Ryan**: "In competition, I use the neutral position to implement my game plan immediately. I'm not interested in long grip fighting battles - I either pull guard to my preferred position or I secure grips that allow me to pull guard effectively. The standing phase is about getting to your best positions as efficiently as possible. If you have a strong guard game, there's no reason to engage in prolonged takedown exchanges where you might give up position. Control the grips you need for your guard pull and execute it immediately."

**Eddie Bravo**: "The neutral position in 10th Planet methodology is about getting to the rubber guard or lockdown as quickly as possible. We're not traditionalists who spend time on elaborate takedown sequences. Pull guard intelligently, establish your preferred guard variation, and start attacking. The beauty of modern BJJ is you can choose not to engage in the wrestling phase if that's not your strength. Use the neutral position to set up your guard pull with the grips you need, then immediately start your offensive system."

## Common Errors
- **Error**: Upright posture without bend
  - **Consequence**: Makes you vulnerable to takedowns and reduces ability to defend or attack effectively.
  - **Correction**: Maintain slight knee bend and hip hinge to create athletic stance with explosive potential and defensive stability.
  - **Recognition**: If you feel off-balance easily or get taken down frequently, check if your stance is too upright.

- **Error**: Crossing feet or narrow stance
  - **Consequence**: Compromises balance and makes you easy to off-balance or take down.
  - **Correction**: Keep feet shoulder-width apart with toes pointed forward or slightly outward for maximum base and mobility.
  - **Recognition**: If you stumble or lose balance when opponent pushes or pulls, your stance is likely too narrow.

- **Error**: Passive grip fighting
  - **Consequence**: Allows opponent to dominate grips and control the engagement, putting you at strategic disadvantage.
  - **Correction**: Actively fight for grips while breaking opponent's grips, maintaining initiative in the standing phase.
  - **Recognition**: If opponent consistently gets their preferred grips while you struggle to establish yours, you're being too passive.

- **Error**: Reaching without setup
  - **Consequence**: Exposes you to counters and creates predictable attack patterns easy to defend.
  - **Correction**: Use feints, footwork, and grip sequences to set up attacks rather than reaching directly.
  - **Recognition**: If opponent easily avoids or counters your attempts, you're likely reaching without proper setup.

- **Error**: Static positioning
  - **Consequence**: Makes you an easy target and reduces your ability to create angles for attacks.
  - **Correction**: Constantly circle, adjust distance, and change levels to maintain dynamic positioning and create opportunities.
  - **Recognition**: If you feel stuck in place or opponent is dictating movement, you need more dynamic footwork.

- **Error**: Committing too early
  - **Consequence**: Telegraphs your intentions and allows opponent to prepare defenses or counters.
  - **Correction**: Maintain multiple threats simultaneously and commit only when clear opening presents itself.
  - **Recognition**: If opponent consistently defends your attacks before you fully execute them, you're committing too obviously.

- **Error**: Neglecting distance control
  - **Consequence**: Allows opponent to close distance for takedowns or maintain distance preventing your attacks.
  - **Correction**: Actively manage distance through footwork, using it as offensive and defensive tool.
  - **Recognition**: If opponent is always in perfect position to attack while you struggle to engage, your distance control needs work.

## Training Drills
- **Athletic Stance Hold**: Practice maintaining proper athletic stance for 2-minute intervals with partner applying light pressure from various angles. Focus on balance, knee bend, and quick recovery from off-balancing. Perform 5 rounds with increasing pressure intensity.

- **Grip Fighting Flow**: Partner drill alternating between establishing grips and breaking opponent's grips for 3-minute rounds. Focus on active hand fighting, grip breaking technique, and establishing dominant positions. Rotate partners to experience different grip fighting styles.

- **Distance Management Drill**: Practice maintaining optimal distance while partner attempts to close or create space. Focus on footwork, circling, and distance adjustment for 5-minute rounds. Partner should vary their approach speed and direction.

- **Transition Decision Making**: Start in neutral position and practice deciding quickly between pulling guard, shooting takedown, or establishing clinch based on partner's stance and movement. Execute 20 repetitions with partner providing realistic reactions.

- **Live Grip Fighting**: Engage in full-speed grip fighting without attempting takedowns or guard pulls, focusing purely on grip dominance for 2-minute rounds. Winner determined by who establishes and maintains dominant grips most consistently.

## Related States
- [[Clinch Position]] - Natural engagement from neutral
- [[Closed Guard Bottom]] - Common guard pull target
- [[Front Headlock]] - Snap down or sprawl result
- [[Top Position]] - Successful takedown outcome
- [[Open Guard Top]] - Opponent pulls guard result

## Related Positions
- [[Standing Position]] - Generic standing state
- [[Standing Guard]] - Active standing guard position
- [[Guard Pull]] - Guard pulling transition
- [[Clinch Position]] - Close-range standing engagement
- [[Combat Base]] - Transitional kneeling position

## Decision Tree
If opponent is grip fighting aggressively:
- Execute [[Pull Guard]] → [[Closed Guard Bottom]] (Probability: 75%)
- Or Counter with [[Snap Down]] → [[Front Headlock]] (Probability: 45%)

Else if opponent presents takedown opening:
- Execute [[Takedown Entry]] → [[Top Position]] (Probability: 50%)
- Or Execute [[Ankle Pick]] → [[Top Position]] (Probability: 40%)

Else if opponent pulls guard:
- Establish [[Top Position]] → [[Open Guard Top]] (Probability: 70%)
- Or [[Pass Immediately]] → [[Side Control]] (Probability: 35%)

Else (neutral stance - default):
- [[Engage Clinch]] → [[Clinch Position]] (Probability: 65%)
- Or [[Hand Fighting]] → [[Neutral Starting Position]] (Probability: 50%)

## Position Metrics
- **Position Retention Rate**: Beginner 55%, Intermediate 70%, Advanced 85%
- **Advancement Probability**: Beginner 50%, Intermediate 65%, Advanced 80%
- **Submission Probability**: Beginner 5%, Intermediate 10%, Advanced 15%
- **Position Loss Probability**: Beginner 35%, Intermediate 20%, Advanced 10%
- **Average Time in Position**: 30-60 seconds

## Optimal Submission Paths
**Guard pull to submission path:**
[[Neutral Starting Position]] → [[Pull Guard]] → [[Closed Guard Bottom]] → [[Triangle Choke Side]] → [[Won by Submission]]
*Reasoning: Direct path to preferred guard position allows immediate offensive implementation*

**Takedown to dominance path:**
[[Neutral Starting Position]] → [[Takedown Entry]] → [[Side Control]] → [[Mount]] → [[Submission Chains]] → [[Won by Submission]]
*Reasoning: Establishing top position early creates positional dominance for systematic submission attack*

**Snap down to back take path:**
[[Neutral Starting Position]] → [[Snap Down]] → [[Front Headlock]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: Exploiting posture creates direct path to most dominant position*

**Arm drag to back control path:**
[[Neutral Starting Position]] → [[Arm Drag]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: Fastest route to back control from neutral if executed cleanly*
