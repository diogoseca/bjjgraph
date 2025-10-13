---
title: "Submission Position | BJJ Position Guide | BJJ Graph"
description: "Master Submission Position in BJJ. Complete guide covering control, finishing mechanics, and defense patterns. Success rates: Beginner 40%, Intermediate 60%, Advanced 80%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S221
  position_name: "Submission Position"
  alternative_names: ["Submission Control", "Finishing Position", "Tap Setup"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Offensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Short"

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
      beginner: 35
      intermediate: 55
      advanced: 75
    position_loss_probability:
      beginner: 45
      intermediate: 30
      advanced: 15
    average_time_in_position: "30-90 seconds"

  # State Machine Integration
  invariants:
    - "Submission mechanism established with control points secured"
    - "Direct path to finishing technique available"
    - "Opponent's defensive options limited by positioning"

  # Available Transitions
  offensive_transitions:
    - technique: "Finish Submission"
      target_state: "Won by Submission"
      transition_id: "T410"
      success_rate:
        beginner: 35
        intermediate: 55
        advanced: 75

    - technique: "Adjust Position"
      target_state: "Submission Position"
      transition_id: "T411"
      success_rate:
        beginner: 50
        intermediate: 70
        advanced: 85

    - technique: "Transition to Alternative Submission"
      target_state: "Submission Position"
      transition_id: "T412"
      success_rate:
        beginner: 40
        intermediate: 60
        advanced: 80

    - technique: "Maintain Control"
      target_state: "Top Control"
      transition_id: "T413"
      success_rate:
        beginner: 45
        intermediate: 65
        advanced: 80

    - technique: "Chain to Next Attack"
      target_state: "Submission Position"
      transition_id: "T414"
      success_rate:
        beginner: 30
        intermediate: 50
        advanced: 70

    - technique: "Release and Reposition"
      target_state: "Top Position"
      transition_id: "T415"
      success_rate:
        beginner: 55
        intermediate: 70
        advanced: 85

  defensive_responses:
    - technique: "Escape Mechanism"
      target_state: "Guard Recovery"
      success_rate: 35

    - technique: "Defend and Wait"
      target_state: "Defensive Position"
      success_rate: 30

    - technique: "Counter Submission"
      target_state: "Submission Position"
      success_rate: 20

    - technique: "Tap Out"
      target_state: "Won by Submission"
      success_rate: 100

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Submission fully locked with proper control"
      options:
        - action: "Finish Submission"
          target: "Won by Submission"
          probability: 75
        - action: "Apply Progressive Pressure"
          target: "Won by Submission"
          probability: 65

    - condition: "Opponent defending but position secure"
      options:
        - action: "Adjust Angle"
          target: "Submission Position"
          probability: 70
        - action: "Chain to Alternative"
          target: "Submission Position"
          probability: 60

    - condition: "Opponent escaping submission"
      options:
        - action: "Transition to Control"
          target: "Top Control"
          probability: 65
        - action: "Switch Submission"
          target: "Submission Position"
          probability: 50

    - condition: "Submission defended successfully"
      options:
        - action: "Maintain Position"
          target: "Top Position"
          probability: 70
        - action: "Reset Attack"
          target: "Submission Position"
          probability: 45

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 3.0
    defender_burn_rate: 4.5
    explosive_escape_multiplier: 5.0
    cooking_rate: 3.5

  # Related States
  related_states:
    - "Armbar Control"
    - "Triangle Control"
    - "Kimura Control"
    - "Back Control"
    - "Guillotine Control"
---


<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Submission Position in BJJ",
  "description": "Complete guide to executing techniques and transitions from Submission Position.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Control Points",
      "text": "Secure all necessary control points for your chosen submission, eliminating opponent's ability to escape before applying pressure.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Isolate Target",
      "text": "Isolate the target limb, joint, or neck from opponent's defensive structure, creating mechanical advantage for submission.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Apply Progressive Pressure",
      "text": "Apply submission pressure gradually and progressively, allowing partner to tap safely before injury occurs.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Adjust for Defense",
      "text": "If opponent defends, adjust angle, grip, or pressure point to maintain submission threat and control.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Chain Submissions",
      "text": "When primary submission is defended, immediately transition to alternative submission based on opponent's defensive movement.",
      "position": 5
    },
    {
      "@type": "HowToStep",
      "name": "Finish or Reset",
      "text": "Either complete the submission for tap out, or release safely and maintain positional control for next attack.",
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
      "name": "What is a common mistake in Applying pressure too quickly?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Risks injury to training partner and doesn't allow time for safe tap, creating dangerous training environment. The correction is: Apply pressure progressively over 3-5 seconds minimum, watching for tap signal at all times during application."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Incomplete control points?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to escape or counter the submission, wasting the positional advantage and energy expenditure. The correction is: Ensure all control points are secure before applying finishing pressure - check position before committing to submission."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Tunnel vision on single submission?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Limits your options when opponent defends, allowing them to escape while you fixate on defended attack. The correction is: Recognize multiple submission options from position and flow between them based on opponent's defensive reactions."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Losing base or balance?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Compromises submission effectiveness and allows opponent to escape or reverse position entirely. The correction is: Maintain stable base with proper weight distribution even while applying submission pressure."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Releasing too early?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gives up submission opportunity and allows opponent to escape when submission was nearly successful. The correction is: Maintain submission pressure until clear tap or until opponent has completely escaped the mechanism."
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
  "name": "Submission Position",
  "description": "Master Submission Position in BJJ. Complete guide covering control, finishing mechanics, and defense patterns. Success rates: Beginner 40%, Intermediate 60%, Advanced 80%.",
  "url": "https://bjjgraph.com/positions/submission-position",
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
      "name": "Submission Position",
      "item": "https://bjjgraph.com/positions/submission-position"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Submission Position (S221) - Generic offensive control position where submission mechanism is established and finish is imminent. High-pressure attacking state requiring technical precision.

KEY_MECHANICS: Control points secured to prevent escape. Target isolated from defensive structure. Progressive pressure application toward submission finish. Multiple attack chains available.

STRATEGIC_VALUE: Culmination of positional progression in BJJ. High submission probability when properly executed. Requires balance between control and finishing pressure. Time-sensitive position.

COMMON_PATTERNS: Full control → Finish submission. Partial defense → Adjust and attack. Strong defense → Chain to alternative. Complete defense → Maintain control.

SYSTEM_INTEGRATION: Terminal attacking position in most BJJ systems. Represents successful positional hierarchy progression. Critical for competition success and training progression.
-->

# Submission Position
#bjj #state #submission #offensive #finishing

## State Properties
- **State ID**: S221
- **Point Value**: 0 (Submissions end match, no points awarded)
- **Position Type**: Offensive
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Short

## State Description
Submission Position represents the generic state in BJJ where you have established a submission mechanism with proper control points secured and a direct path to finishing the technique available. This is not a single specific position but rather a category of positions where submission is imminent and your opponent faces serious danger of tapping out. Examples include having an armbar locked, triangle choked secured, or rear naked choke sunk in.

This position is characterized by the transition from positional control to finishing mechanics. You've progressed through the positional hierarchy (or found a shortcut) and now have the opportunity to end the match. The submission position requires balancing control with application of finishing pressure - too much focus on control and you may not finish, too much focus on finishing and your opponent may escape.

The submission position is time-sensitive because opponents will use all available energy to escape, making it a high-intensity state for both competitors. Success depends on technical precision, proper positioning, and progressive pressure application. This position represents the culmination of BJJ strategy where all previous positioning has led to this finishing opportunity.

## Visual Description
You have secured a submission mechanism on your opponent with all necessary control points in place. Your body positioning varies depending on the specific submission - you might be perpendicular to opponent in an armbar, wrapped around them in a triangle, or attached to their back for a choke. What's consistent is that you have isolated the target (limb, joint, or neck) from your opponent's defensive structure.

Your control points are secure - grips are tight, hooks or legs are positioned to prevent escape, and your weight distribution prevents them from creating space or leverage. Your opponent's body is configured in a way that limits their defensive options, with their movements constrained by your positioning and control mechanisms. The specific submission target is isolated and you're positioned to apply increasing pressure toward the finish.

Your opponent is actively defending, potentially gripping their own hands together, tucking their chin, or trying to create frames to escape. Their body language shows urgency and distress as they recognize the submission danger. The space between control and finish is being systematically closed as you adjust position, pressure, and angles to complete the technique while allowing safe tapping opportunity.

## Key Principles
- **Control Before Finishing**: Establish all control points securely before applying submission pressure to prevent escapes
- **Progressive Pressure Application**: Apply submission pressure gradually over 3-5 seconds minimum to allow safe tapping
- **Multiple Attack Awareness**: Recognize alternative submissions available from position for chaining attacks
- **Balance and Base**: Maintain stable positioning even while applying submission to prevent opponent's escape or reversal
- **Tap Recognition**: Watch for tap signals at all times and release immediately when partner taps
- **Technical Precision**: Focus on proper mechanics rather than force to achieve submission finish

## Prerequisites
- Understanding of specific submission mechanics
- Control point identification and maintenance
- Safe pressure application awareness
- Tap recognition and immediate release training

## State Invariants
- Submission mechanism established with control points secured
- Direct path to finishing technique available
- Opponent's defensive options limited by positioning

## Defensive Responses (When Opponent Has This State Against You)
- [[Escape Mechanism]] → [[Guard Recovery]] (Success Rate: 35%)
- [[Defend and Wait]] → [[Defensive Position]] (Success Rate: 30%)
- [[Counter Submission]] → [[Submission Position]] (Success Rate: 20%)
- [[Tap Out]] → [[Won by Submission]] (Success Rate: 100%)

## Offensive Transitions (Available From This State)
- [[Finish Submission]] → [[Won by Submission]] (Success Rate: Beginner 35%, Intermediate 55%, Advanced 75%)
- [[Adjust Position]] → [[Submission Position]] (Success Rate: Beginner 50%, Intermediate 70%, Advanced 85%)
- [[Transition to Alternative Submission]] → [[Submission Position]] (Success Rate: Beginner 40%, Intermediate 60%, Advanced 80%)
- [[Maintain Control]] → [[Top Control]] (Success Rate: Beginner 45%, Intermediate 65%, Advanced 80%)
- [[Chain to Next Attack]] → [[Submission Position]] (Success Rate: Beginner 30%, Intermediate 50%, Advanced 70%)
- [[Release and Reposition]] → [[Top Position]] (Success Rate: Beginner 55%, Intermediate 70%, Advanced 85%)

## Counter Transitions
- [[Re-establish Submission]] → [[Submission Position]] (when opponent defends but doesn't escape)
- [[Switch Attack]] → [[Submission Position]] (chain to alternative submission)
- [[Secure Position]] → [[Top Control]] (abandon submission to maintain control)

## Expert Insights
**John Danaher**: "The submission position is where technical precision becomes paramount. The fundamental principle is that submission effectiveness depends on control preceding pressure. Many practitioners make the error of attempting to finish before establishing proper control, which leads to escapes and lost opportunities. The systematic approach is to identify all required control points for your chosen submission, secure them methodically, then apply progressive pressure while maintaining those control points. Understanding submission positions as part of a larger attacking system rather than isolated techniques creates multiple paths to success."

**Gordon Ryan**: "In competition, the submission position is where matches are won. I focus on high-percentage submissions that work against elite opponents - rear naked choke, heel hooks, arm triangles. The key is recognizing when you have enough control to commit to the finish versus when you need to adjust or chain to another attack. Don't force low-percentage submissions when a better option is available. Stay patient, maintain control, and when you feel the submission is there, commit fully and finish it. The worst thing is hesitating when you have a clean submission - that's when they escape."

**Eddie Bravo**: "The submission position in 10th Planet is about creating submission chains where each defense leads to another attack. We don't just attack one submission and hope it works - we set up sequences where defending the first attack opens the second, and defending that opens the third. From submission positions, always be thinking two or three moves ahead. If they defend your triangle by posturing, you already know you're switching to an armbar or omoplata. This systematic approach to submissions makes your attacks much more effective because opponents are always reacting to multiple threats."

## Common Errors
- **Error**: Applying pressure too quickly
  - **Consequence**: Risks injury to training partner and doesn't allow time for safe tap, creating dangerous training environment.
  - **Correction**: Apply pressure progressively over 3-5 seconds minimum, watching for tap signal at all times during application.
  - **Recognition**: In training, if partner shows sudden distress or joint sounds occur, you're applying pressure too fast.

- **Error**: Incomplete control points
  - **Consequence**: Allows opponent to escape or counter the submission, wasting the positional advantage and energy expenditure.
  - **Correction**: Ensure all control points are secure before applying finishing pressure - check position before committing to submission.
  - **Recognition**: If opponent escapes easily or you feel them creating space, control points weren't fully established.

- **Error**: Tunnel vision on single submission
  - **Consequence**: Limits your options when opponent defends, allowing them to escape while you fixate on defended attack.
  - **Correction**: Recognize multiple submission options from position and flow between them based on opponent's defensive reactions.
  - **Recognition**: If you're stuck trying the same submission while opponent successfully defends, you've missed transition opportunities.

- **Error**: Losing base or balance
  - **Consequence**: Compromises submission effectiveness and allows opponent to escape or reverse position entirely.
  - **Correction**: Maintain stable base with proper weight distribution even while applying submission pressure.
  - **Recognition**: If opponent is able to roll you or create significant movement, your base has been compromised.

- **Error**: Releasing too early
  - **Consequence**: Gives up submission opportunity and allows opponent to escape when submission was nearly successful.
  - **Correction**: Maintain submission pressure until clear tap or until opponent has completely escaped the mechanism.
  - **Recognition**: If you frequently "almost get" submissions but they escape at the last moment, you may be releasing prematurely.

- **Error**: Using strength over technique
  - **Consequence**: Reduces submission effectiveness, increases injury risk, and depletes your energy rapidly without finishing.
  - **Correction**: Focus on proper positioning, angle, and leverage rather than muscling the submission with pure force.
  - **Recognition**: If you're exhausted after submission attempts but not finishing, you're likely relying too much on strength.

- **Error**: Ignoring tap signals
  - **Consequence**: Causes injury to training partner and creates unsafe training environment, potentially ending their training or competition.
  - **Correction**: Watch for verbal tap, hand tap, or foot tap constantly during submission application and release immediately.
  - **Recognition**: Any tap signal requires immediate release - no exceptions in training environment.

## Training Drills
- **Submission Entry and Control**: Practice entering various submission positions and establishing all control points before applying pressure. Partner provides 0-50% resistance. Focus on position before finish. 10 repetitions per submission type.

- **Progressive Pressure Application**: From established submission position, practice applying pressure gradually over 5-second count while partner taps at comfortable point. Focus on smooth pressure increase and immediate tap response. 15 repetitions with various submissions.

- **Submission Chaining Flow**: Drill transitioning between related submissions when partner defends primary attack. Practice triangle-to-armbar-to-omoplata sequences and similar chains. 20 total transitions with partner defending realistically at 50% intensity.

- **Positional Submission Sparring**: Start with submission nearly locked and engage in specific training where attacker tries to finish while defender escapes. 3-minute rounds with role switching. Focus on maintaining control while pursuing finish.

- **Tap Recognition Drill**: Practice various submissions with partner tapping at different stages (early, mid, late) to train immediate recognition and release response. Essential safety drill performed slowly with full communication. 10 repetitions per submission.

## Related States
- [[Armbar Control]] - Specific armlock submission position
- [[Triangle Control]] - Specific triangle choke position
- [[Kimura Control]] - Specific shoulder lock position
- [[Back Control]] - Dominant position leading to chokes
- [[Guillotine Control]] - Specific front headlock choke position

## Related Positions
- [[Mount]] - Top position with high submission opportunities
- [[Back Control]] - Most dominant submission hunting position
- [[Side Control]] - Controlling position with submission access
- [[Top Position]] - Generic top control with submission options
- [[Won by Submission]] - Terminal state after successful finish

## Decision Tree
If submission fully locked with proper control:
- Execute [[Finish Submission]] → [[Won by Submission]] (Probability: 75%)
- Or Apply [[Progressive Pressure]] → [[Won by Submission]] (Probability: 65%)

Else if opponent defending but position secure:
- [[Adjust Angle]] → [[Submission Position]] (Probability: 70%)
- Or [[Chain to Alternative]] → [[Submission Position]] (Probability: 60%)

Else if opponent escaping submission:
- [[Transition to Control]] → [[Top Control]] (Probability: 65%)
- Or [[Switch Submission]] → [[Submission Position]] (Probability: 50%)

Else if submission defended successfully:
- [[Maintain Position]] → [[Top Position]] (Probability: 70%)
- Or [[Reset Attack]] → [[Submission Position]] (Probability: 45%)

## Position Metrics
- **Position Retention Rate**: Beginner 40%, Intermediate 60%, Advanced 80%
- **Advancement Probability**: Beginner 45%, Intermediate 65%, Advanced 85%
- **Submission Probability**: Beginner 35%, Intermediate 55%, Advanced 75%
- **Position Loss Probability**: Beginner 45%, Intermediate 30%, Advanced 15%
- **Average Time in Position**: 30-90 seconds

## Optimal Submission Paths
**Direct finish path:**
[[Submission Position]] → [[Finish Submission]] → [[Won by Submission]]
*Reasoning: When position is perfect and control is complete, direct finish has highest success rate*

**Adjustment then finish path:**
[[Submission Position]] → [[Adjust Position]] → [[Finish Submission]] → [[Won by Submission]]
*Reasoning: Small adjustments to angle or pressure often make difference between escape and tap*

**Chain attack path:**
[[Submission Position]] → [[Transition to Alternative Submission]] → [[Finish Submission]] → [[Won by Submission]]
*Reasoning: When primary submission is defended, chaining to alternative based on their defense is highly effective*

**Maintain control then re-attack path:**
[[Submission Position]] → [[Maintain Control]] → [[Top Control]] → [[Submission Position]] → [[Won by Submission]]
*Reasoning: Sometimes maintaining position and waiting for better opportunity yields higher success than forcing defended submission*
