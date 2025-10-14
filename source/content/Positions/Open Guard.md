---
title: "Open Guard | BJJ Position Guide | BJJ Graph"
description: "Master Open Guard in BJJ. Complete guide covering distance management, sweep systems, and submission attacks. Success rates: Beginner 40%, Intermediate 60%, Advanced 80%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S238
  position_name: "Open Guard"
  alternative_names: ["Open Guard Bottom", "Distance Guard", "Open Guard System"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Defensive with high offensive potential"
    risk_level: "Medium"
    energy_cost: "Medium to High"
    time_sustainability: "Medium"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 40
      intermediate: 60
      advanced: 80
    advancement_probability:
      beginner: 45
      intermediate: 65
      advanced: 85
    submission_probability:
      beginner: 20
      intermediate: 35
      advanced: 55
    position_loss_probability:
      beginner: 45
      intermediate: 30
      advanced: 15
    average_time_in_position: "1-3 minutes"

  # State Machine Integration
  invariants:
    - "Legs positioned between you and opponent creating distance control"
    - "Active use of feet, shins, and knees to manage distance and angles"
    - "Upper body grips on gi or wrist/elbow control in no-gi"

  # Available Transitions
  offensive_transitions:
    - technique: "Spider Guard"
      target_state: "Spider Guard"
      transition_id: "T242"
      success_rate:
        beginner: 50
        intermediate: 70
        advanced: 85

    - technique: "De La Riva Guard"
      target_state: "De La Riva Guard"
      transition_id: "T243"
      success_rate:
        beginner: 40
        intermediate: 60
        advanced: 80

    - technique: "X-Guard"
      target_state: "X-Guard"
      transition_id: "T244"
      success_rate:
        beginner: 35
        intermediate: 55
        advanced: 75

    - technique: "Butterfly Guard"
      target_state: "Butterfly Guard"
      transition_id: "T245"
      success_rate:
        beginner: 45
        intermediate: 65
        advanced: 85

    - technique: "Guard Recovery"
      target_state: "Closed Guard Bottom"
      transition_id: "T246"
      success_rate:
        beginner: 40
        intermediate: 60
        advanced: 80

    - technique: "Technical Standup"
      target_state: "Standing Position"
      transition_id: "T247"
      success_rate:
        beginner: 30
        intermediate: 50
        advanced: 70

  defensive_responses:
    - technique: "Guard Pass"
      target_state: "Passing Position"
      success_rate: 40

    - technique: "Pressure Pass"
      target_state: "Side Control"
      success_rate: 35

    - technique: "Jump Over Guard"
      target_state: "Mount"
      success_rate: 20

    - technique: "Disengage and Reset"
      target_state: "Standing Neutral"
      success_rate: 45

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent standing and attempting distance pass"
      options:
        - action: "Transition to De La Riva"
          target: "De La Riva Guard"
          probability: 60
        - action: "Technical Standup"
          target: "Standing Position"
          probability: 50

    - condition: "Opponent on knees trying to pass"
      options:
        - action: "Transition to Spider Guard"
          target: "Spider Guard"
          probability: 70
        - action: "Butterfly Hook Entry"
          target: "Butterfly Guard"
          probability: 65

    - condition: "Opponent backing away creating distance"
      options:
        - action: "Technical Standup"
          target: "Standing Position"
          probability: 70
        - action: "Close distance to Closed Guard"
          target: "Closed Guard Bottom"
          probability: 60

    - condition: "Default - neutral open guard"
      options:
        - action: "Maintain distance and probe"
          target: "Open Guard"
          probability: 60
        - action: "Enter specific guard variation"
          target: "Guard Variation"
          probability: 55

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 4.0
    defender_burn_rate: 3.5
    explosive_escape_multiplier: 4.5
    cooking_rate: 2.5

  # Related States
  related_states:
    - "Spider Guard"
    - "De La Riva Guard"
    - "X-Guard"
    - "Butterfly Guard"
    - "Closed Guard Bottom"
---

<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Open Guard in BJJ",
  "description": "Complete guide to open guard position, distance management, and transitioning to specific guards and sweeps.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Distance Control",
      "text": "Position legs between you and opponent using feet on hips, shins on thighs, or knees as frames to manage distance.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Secure Grips",
      "text": "Establish upper body grips on gi sleeves and collars, or wrist and elbow control in no-gi to prevent opponent from closing distance freely.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Read Opponent's Posture",
      "text": "Observe whether opponent is standing, on knees, or backing away to determine which specific guard variation to enter.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Enter Specific Guard",
      "text": "Transition to appropriate guard type: Spider for kneeling opponents, De La Riva for standing, Butterfly for close range.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Execute Sweep or Submission",
      "text": "From specific guard position, execute high-percentage sweep or submission appropriate to that guard system.",
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
      "name": "What is the difference between open guard and closed guard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Open guard uses legs positioned between you and opponent to create distance and manage angles, while closed guard locks legs around opponent's back for closer control. Open guard offers more mobility and diverse attacks but requires more active leg movement."
      }
    },
    {
      "@type": "Question",
      "name": "What are common mistakes in open guard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Staying flat on back reduces mobility and makes guard passing easier. Correct by staying on side or sitting up, maintaining constant leg movement, and actively managing distance with your feet and shins."
      }
    },
    {
      "@type": "Question",
      "name": "When should I transition from open guard to specific guard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Transition based on opponent's posture: Spider Guard when they're on knees, De La Riva when standing, Butterfly when close range, X-Guard for single leg control. Each position requires specific grips and leg configurations."
      }
    },
    {
      "@type": "Question",
      "name": "How do I prevent guard passing from open guard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Maintain active leg frames creating distance, control opponent's sleeves or wrists, stay mobile by constantly adjusting angles, and don't let opponent settle their weight on your legs. If they start passing, immediately work to recover guard or stand up."
      }
    },
    {
      "@type": "Question",
      "name": "What is the energy cost of open guard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Open guard requires medium to high energy expenditure due to constant leg movement and active distance management. Proper technique and timing can reduce energy cost, but it's more demanding than closed guard."
      }
    }
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Open Guard",
  "description": "Master Open Guard in BJJ. Complete guide covering distance management, sweep systems, and submission attacks. Success rates: Beginner 40%, Intermediate 60%, Advanced 80%.",
  "url": "https://bjjgraph.com/positions/open-guard",
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
      "name": "Open Guard",
      "item": "https://bjjgraph.com/positions/open-guard"
    }
  ]
}
</script>

<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Open Guard (S238) - Fundamental bottom position using legs to create distance and angles between you and opponent. Gateway to all specific guard variations and systems.

KEY_MECHANICS: Active leg frames control distance. Grips prevent opponent from closing freely. Constant movement maintains angles. Transitions to specific guards based on opponent posture.

STRATEGIC_VALUE: Most versatile guard position. Allows transitions to any specific guard system. Higher risk than closed guard but offers superior attack diversity and mobility.

COMMON_PATTERNS: Standing opponent → De La Riva. Kneeling opponent → Spider Guard. Close range → Butterfly. Distance created → Technical standup.

SYSTEM_INTEGRATION: Foundation for all modern guard systems. Connects to Spider, De La Riva, X-Guard, Butterfly, and standing positions.
-->

# Open Guard
#bjj #state #guard #open-guard #distance-management

## State Properties
- **State ID**: S238
- **Point Value**: 0 (Guard position)
- **Position Type**: Defensive with high offensive potential
- **Risk Level**: Medium
- **Energy Cost**: Medium to High
- **Time Sustainability**: Medium

## State Description

Open Guard is the fundamental bottom position in BJJ where you use your legs positioned between you and your opponent to create distance, manage angles, and prevent them from establishing dominant control. Unlike closed guard where your legs lock around the opponent's back, open guard maintains an open configuration that allows for greater mobility and diverse attacking options at the cost of requiring more active management. This position serves as the gateway to all modern guard systems and is essential for contemporary BJJ competition.

The defining characteristic of open guard is the use of your legs as active frames and tools to control distance and create angles. Your feet may be on opponent's hips, shins across their thighs, knees creating frames, or various combinations depending on the specific guard variation you're entering. Upper body grips on gi sleeves and collars (or wrist and elbow control in no-gi) complement the leg frames to prevent opponent from freely closing distance or establishing pressure.

Open guard requires constant movement and active management - it's a dynamic rather than static position. The guard player must continuously read opponent's movements and adjust leg positioning, grips, and angles accordingly. This active nature makes it more energy-intensive than closed guard but offers superior options for entering specific guard systems like Spider Guard, De La Riva, X-Guard, or Butterfly Guard. Modern BJJ competition heavily favors open guard due to its versatility and the sophisticated attacking systems that have been developed from it.

### Visual Description

You are on your back or slightly on your side, with your legs actively positioned between you and your opponent, creating a dynamic barrier that manages distance and angles. Your feet may be placed on opponent's hips pushing them away, shins positioned across their thighs controlling their base, or knees acting as frames preventing them from closing distance. The leg configuration is fluid and constantly adjusting based on opponent's movements and your intended transitions.

Your upper body is upright or propped on elbows rather than flat on the mat, allowing you to see your opponent and maintain better posture for attacking. Your hands control opponent's sleeves, collar, or wrists in no-gi, preventing them from freely pressuring forward or controlling your legs. Your hips are mobile and ready to move, creating angles and adjusting position as needed. The opponent is standing, on their knees, or transitioning between postures, attempting to navigate around or through your leg frames to pass your guard. The overall position is dynamic with constant small adjustments and repositioning from both practitioners.

## Key Principles

- **Active Leg Management**: Legs must constantly move and adjust to maintain proper frames and distance control
- **Distance Control is Primary**: Managing the space between you and opponent is the fundamental purpose of open guard
- **Hip Mobility Essential**: Mobile hips allow for angle creation and quick transitions between guard variations
- **Grips Enable Everything**: Proper upper body grips prevent opponent from freely controlling the engagement
- **Read and React**: Watch opponent's posture and movement to determine which specific guard to enter
- **Never Stay Flat**: Maintaining upright posture or being on your side enables better vision and mobility
- **Multiple Attack Paths**: Open guard is the gateway to numerous specific guard systems, each with distinct advantages

## Prerequisites
- Understanding of basic hip movement and shrimping
- Ability to create and maintain frames with legs
- Knowledge of fundamental gi grips or no-gi wrist/elbow control
- Familiarity with at least 2-3 specific guard variations

## State Invariants
- Legs positioned between you and opponent creating distance control
- Active use of feet, shins, and knees to manage distance and angles
- Upper body grips on gi or wrist/elbow control in no-gi

## Defensive Responses (When Opponent Has This State Against You)
- [[Guard Pass]] → [[Passing Position]] (Success Rate: 40%)
- [[Pressure Pass]] → [[Side Control]] (Success Rate: 35%)
- [[Jump Over Guard]] → [[Mount]] (Success Rate: 20%)
- [[Disengage and Reset]] → [[Standing Neutral]] (Success Rate: 45%)

## Offensive Transitions (Available From This State)
- [[Spider Guard]] → [[Spider Guard]] (Success Rate: Beginner 50%, Intermediate 70%, Advanced 85%)
- [[De La Riva Guard]] → [[De La Riva Guard]] (Success Rate: Beginner 40%, Intermediate 60%, Advanced 80%)
- [[X-Guard]] → [[X-Guard]] (Success Rate: Beginner 35%, Intermediate 55%, Advanced 75%)
- [[Butterfly Guard]] → [[Butterfly Guard]] (Success Rate: Beginner 45%, Intermediate 65%, Advanced 85%)
- [[Guard Recovery]] → [[Closed Guard Bottom]] (Success Rate: Beginner 40%, Intermediate 60%, Advanced 80%)
- [[Technical Standup]] → [[Standing Position]] (Success Rate: Beginner 30%, Intermediate 50%, Advanced 70%)

## Counter Transitions
- [[Re-establish Guard]] → [[Open Guard]] (after losing position temporarily)
- [[Frame and Create Space]] → [[Open Guard]] (defensive recovery)
- [[Sit Up Guard]] → [[Seated Guard]] (alternative open guard variation)

## Expert Insights

**John Danaher**: "Open guard is the central hub from which all modern guard systems radiate. The key technical understanding is that open guard is not itself a final destination but rather a transitional state that allows you to enter the specific guard system most appropriate for your opponent's posture and movement. The systematic approach to open guard involves identifying clear decision points based on opponent behavior: if they're standing, enter De La Riva or standing guard systems; if they're on knees, enter Spider or Butterfly; if they're backing away, stand up yourself. The guard player who can fluidly transition between these systems based on opponent's reactions has a tremendous advantage. The most common error is treating open guard as a static position rather than a dynamic, flowing state of constant readjustment."

**Gordon Ryan**: "In competition, I use open guard primarily as a transitional position to enter my main attacking systems. The key competitive insight is that you can't stay in generic open guard for long against elite opponents - you need to quickly transition to a specific guard that gives you attacking opportunities. My preference is to use open guard to enter leg entanglement systems or butterfly guard, depending on opponent's passing style. The critical skill is reading opponent's intentions immediately and entering the guard system that counters their passing approach. Against standing passers, I enter De La Riva or leg attacks. Against knee-cut passers, I use butterfly hooks and underhooks. The moment you see what they're trying to do, you need to already be transitioning to the counter-system. Hesitation in open guard against world-class competition gets you passed."

**Eddie Bravo**: "Open guard is where a lot of the innovation in modern BJJ has happened, and at 10th Planet we've developed several unique systems from this position. The key is understanding that your legs are your primary weapons - they control distance, create angles, and set up attacks. We emphasize the Rubber Guard entry from open guard when opponent is in your guard, and the Twister Side Control entry when you're on top. The electric chair is another powerful weapon from open guard positions. What makes open guard so effective is that it's adaptable - you can play it aggressive and attacking, or defensive and conservative, depending on the situation and your energy levels. The lockdown, which we use extensively, can be entered from various open guard positions and completely changes the dynamics of the position by preventing opponent's movement."

## Common Errors

- **Error**: Staying flat on back with legs extended
  - **Consequence**: Removes your ability to create angles and makes it easy for opponent to pass over or around your legs.
  - **Correction**: Stay on your side or sit up, keeping your hips mobile and ready to adjust angles. Legs should be bent and active, not straight and passive.
  - **Recognition**: If opponent easily controls your legs and passes your guard, you're likely too flat.

- **Error**: Not maintaining active leg frames
  - **Consequence**: Opponent closes distance freely and establishes pressure on your legs, leading to guard pass.
  - **Correction**: Constantly adjust leg positioning to maintain frames - feet on hips, shins on thighs, knees creating distance.
  - **Recognition**: If you feel opponent's weight settling on your legs, your frames have failed.

- **Error**: Weak or absent upper body grips
  - **Consequence**: Opponent controls the pace and can freely move to passing positions without resistance.
  - **Correction**: Establish strong grips on sleeves/collar in gi, or wrist/elbow control in no-gi, and maintain them throughout.
  - **Recognition**: If opponent easily changes angles and positions without you controlling their movement, your grips are inadequate.

- **Error**: Staying in generic open guard too long
  - **Consequence**: Against skilled opponents, generic open guard doesn't provide specific attacking opportunities and gets passed.
  - **Correction**: Quickly read opponent's posture and transition to appropriate specific guard (Spider, De La Riva, Butterfly, etc.).
  - **Recognition**: If you're in open guard for more than 10-15 seconds without transitioning, you're staying too long.

- **Error**: Not reading opponent's passing approach
  - **Consequence**: You enter a guard variation that doesn't counter opponent's specific passing style.
  - **Correction**: Watch opponent's posture and hand positioning to determine their passing intention, then enter the counter-guard.
  - **Recognition**: If opponent easily passes despite you having "good" open guard, you chose the wrong guard variation for their passing style.

- **Error**: Insufficient hip mobility
  - **Consequence**: Unable to create angles or recover guard when opponent begins passing.
  - **Correction**: Practice solo hip movement drills, shrimping, and guard retention to improve hip mobility under pressure.
  - **Recognition**: If your hips feel stuck or you can't turn to face opponent when they pass, mobility is the issue.

- **Error**: Overreliance on one guard system
  - **Consequence**: Predictable game allows opponent to prepare specific counters to your preferred guard.
  - **Correction**: Develop proficiency in at least 3-4 different guard systems and transition fluidly between them.
  - **Recognition**: If experienced training partners consistently pass your guard using the same method, you're too one-dimensional.

## Training Drills

- **Open Guard Retention Drill**: Partner attempts to pass your open guard using various passing styles (knee cut, toreando, over-under) at 60% intensity. Your goal is to maintain open guard frames and prevent passing for 2-minute rounds. Focus on hip movement, frames, and angle creation. 8 rounds total with partner rotating passing styles.

- **Guard Transition Flow Drill**: Start in basic open guard. Partner signals which posture to adopt (standing, kneeling, backing away). You immediately transition to appropriate guard system (De La Riva for standing, Spider for kneeling, Standup for backing away). Practice smooth transitions without resistance. 5-minute continuous flow, 30-second holds in each position.

- **Grip Fighting Open Guard**: Partner attempts to break your grips and establish their preferred grips while you maintain open guard control. This isolates the upper body grip battle crucial for open guard. 90-second rounds, high intensity. 10 rounds total with brief rest between rounds.

- **Open Guard Sweep Series**: From open guard position, practice entering your three strongest guard systems and executing primary sweep from each. Partner provides 50% resistance. Complete 5 successful sweeps from each guard system per round. 6-minute rounds, 3 rounds total.

- **Open Guard Sparring**: Positional sparring starting from open guard. If guard player sweeps or submits, they win the round. If top player passes, they win the round. 3-minute rounds. This develops decision-making and creates realistic pressure. 12 rounds total, alternating positions after each round.

## Related States
- [[Spider Guard]] - Specific open guard variation
- [[De La Riva Guard]] - Standing open guard system
- [[X-Guard]] - Single leg control open guard
- [[Butterfly Guard]] - Close-range open guard
- [[Closed Guard Bottom]] - Alternative guard type

## Related Positions
- [[Spider Guard]] - Sleeve and shin control variation
- [[De La Riva Guard]] - Standing guard system
- [[X-Guard]] - Single leg control system
- [[Butterfly Guard]] - Hook-based guard
- [[Seated Guard]] - Upright open guard variation

## Decision Tree

If opponent standing and attempting distance pass:
- Execute [[De La Riva Guard]] → [[De La Riva Guard]] (Probability: 60%)
- Or Execute [[Technical Standup]] → [[Standing Position]] (Probability: 50%)

Else if opponent on knees trying to pass:
- Execute [[Spider Guard]] → [[Spider Guard]] (Probability: 70%)
- Or Execute [[Butterfly Guard]] → [[Butterfly Guard]] (Probability: 65%)

Else if opponent backing away creating distance:
- Execute [[Technical Standup]] → [[Standing Position]] (Probability: 70%)
- Or [[Guard Recovery]] → [[Closed Guard Bottom]] (Probability: 60%)

Else (Default - neutral open guard):
- Maintain distance and probe → [[Open Guard]] (Probability: 60%)
- Or Enter specific guard variation → [[Guard Variation]] (Probability: 55%)

## Position Metrics
- **Position Retention Rate**: Beginner 40%, Intermediate 60%, Advanced 80%
- **Advancement Probability**: Beginner 45%, Intermediate 65%, Advanced 85%
- **Submission Probability**: Beginner 20%, Intermediate 35%, Advanced 55%
- **Position Loss Probability**: Beginner 45%, Intermediate 30%, Advanced 15%
- **Average Time in Position**: 1-3 minutes

## Optimal Submission Paths

**Spider Guard sweep path:**
[[Open Guard]] → [[Spider Guard]] → [[Spider Guard Sweep]] → [[Mount]] → [[Submission from Mount]] → [[Won by Submission]]
*Reasoning: Spider Guard provides high-percentage sweeps (70-85%) when opponent is on knees. Sweep to mount creates dominant position for submissions.*

**De La Riva back take path:**
[[Open Guard]] → [[De La Riva Guard]] → [[De La Riva Back Take]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: Standing opponents are vulnerable to De La Riva back takes. Back control provides highest percentage submissions.*

**Butterfly Guard sweep path:**
[[Open Guard]] → [[Butterfly Guard]] → [[Butterfly Sweep]] → [[Top Position]] → [[Pass to Mount]] → [[Submission]] → [[Won by Submission]]
*Reasoning: Close-range butterfly sweeps are high percentage (65-85%). Sweep creates scramble opportunities to advance position.*

**X-Guard sweep path:**
[[Open Guard]] → [[X-Guard]] → [[X-Guard Sweep]] → [[Top Control]] → [[Submission Chains]] → [[Won by Submission]]
*Reasoning: X-Guard provides powerful sweep mechanics with excellent control of opponent's base. Creates favorable scrambles.*

**Technical standup reset path:**
[[Open Guard]] → [[Technical Standup]] → [[Standing Position]] → [[Takedown]] → [[Top Position]] → [[Submission]]
*Reasoning: Against opponents backing away, standing up (70% success advanced) allows you to reset and potentially take them down.*
