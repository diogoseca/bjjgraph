---
title: "Kimura Trap | BJJ Position Guide | BJJ Graph"
description: "Master Kimura Trap in BJJ. Complete guide covering control, back attacks, and sweeps from the lockdown Kimura position. Success rates: Beginner 40%, Intermediate 60%, Advanced 80%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S210
  position_name: "Kimura Trap"
  alternative_names: ["Lockdown Kimura", "Electric Chair Setup", "Kimura from Lockdown"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Offensive with control emphasis"
    risk_level: "Medium"
    energy_cost: "Medium"
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
      beginner: 25
      intermediate: 45
      advanced: 70
    position_loss_probability:
      beginner: 45
      intermediate: 30
      advanced: 15
    average_time_in_position: "1-3 minutes"

  # State Machine Integration
  invariants:
    - "Figure-four Kimura grip on opponent's arm"
    - "Lockdown control on opponent's leg with legs crossed"
    - "Bottom position with opponent in your half guard"

  # Available Transitions
  offensive_transitions:
    - technique: "Electric Chair Sweep"
      target_state: "Top Position"
      transition_id: "T220"
      success_rate:
        beginner: 40
        intermediate: 60
        advanced: 80

    - technique: "Back Take from Trap"
      target_state: "Back Control"
      transition_id: "T221"
      success_rate:
        beginner: 35
        intermediate: 55
        advanced: 75

    - technique: "Kimura Submission"
      target_state: "Won by Submission"
      transition_id: "T222"
      success_rate:
        beginner: 25
        intermediate: 45
        advanced: 70

    - technique: "Dog Fight Transition"
      target_state: "Dogfight Position"
      transition_id: "T223"
      success_rate:
        beginner: 45
        intermediate: 65
        advanced: 85

    - technique: "Old School Sweep"
      target_state: "Top Position"
      transition_id: "T224"
      success_rate:
        beginner: 30
        intermediate: 50
        advanced: 70

    - technique: "Triangle from Trap"
      target_state: "Triangle Control"
      transition_id: "T225"
      success_rate:
        beginner: 20
        intermediate: 40
        advanced: 60

  defensive_responses:
    - technique: "Posture Up and Break Lockdown"
      target_state: "Half Guard Top"
      success_rate: 35

    - technique: "Roll Out"
      target_state: "Guard Recovery"
      success_rate: 25

    - technique: "Pass to Side Control"
      target_state: "Side Control"
      success_rate: 20

    - technique: "Counter Kimura"
      target_state: "Kimura Control"
      success_rate: 15

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent tries to posture up"
      options:
        - action: "Electric Chair Sweep"
          target: "Top Position"
          probability: 60
        - action: "Dog Fight"
          target: "Dogfight Position"
          probability: 65

    - condition: "Opponent flattens to defend"
      options:
        - action: "Back Take"
          target: "Back Control"
          probability: 55
        - action: "Old School Sweep"
          target: "Top Position"
          probability: 50

    - condition: "Opponent defends Kimura grip"
      options:
        - action: "Transition to Triangle"
          target: "Triangle Control"
          probability: 40
        - action: "Switch to Dog Fight"
          target: "Dogfight Position"
          probability: 65

    - condition: "Default - Opponent balanced"
      options:
        - action: "Threaten Kimura to Create Reaction"
          target: "Kimura Trap"
          probability: 50
        - action: "Electric Chair Setup"
          target: "Top Position"
          probability: 55

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 2.0
    defender_burn_rate: 3.5
    explosive_escape_multiplier: 4.0
    cooking_rate: 2.5

  # Related States
  related_states:
    - "Half Guard Bottom"
    - "Lockdown Guard"
    - "Kimura Control"
    - "Back Control"
    - "Dogfight Position"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Kimura Trap in BJJ",
  "description": "Complete guide to executing techniques and transitions from Kimura Trap position.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Lockdown Control",
      "text": "From half guard bottom, secure the lockdown by crossing your legs and trapping opponent's leg between yours.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Secure Kimura Grip",
      "text": "Establish figure-four Kimura grip on opponent's near arm, creating the trap position.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Break Opponent's Posture",
      "text": "Use lockdown control to break opponent's base and posture, setting up offensive attacks.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Execute Electric Chair Sweep",
      "text": "When opponent postures up, execute Electric Chair sweep by extending lockdown and rotating opponent over.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Alternative Back Take",
      "text": "If opponent flattens, transition to back control by climbing up their back while maintaining Kimura grip.",
      "position": 5
    },
    {
      "@type": "HowToStep",
      "name": "Finish Kimura or Sweep",
      "text": "Complete the position with Kimura submission, electric chair sweep, or back take based on opponent's defense.",
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
      "name": "What is a common mistake in Loose lockdown control?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to escape the trap easily and pass to side control or remove their leg from lockdown. The correction is: Keep your legs tightly crossed with your top foot hooking over your bottom shin, squeezing your knees together to maintain control."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Weak Kimura grip?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Reduces the offensive threat and allows opponent to slip their arm free or counter the position. The correction is: Maintain tight figure-four grip with your hands interlocked and wrists close together, keeping constant pressure on the shoulder."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Not creating opponent reactions?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Leads to static position where neither person can advance, wasting energy without creating opportunities. The correction is: Actively threaten the Kimura finish, electric chair, or back take to force opponent into defensive choices that open other attacks."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Over-committing to one attack?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Makes you predictable and allows opponent to defend effectively while countering your position. The correction is: Flow between electric chair, back take, and Kimura finish based on opponent's reactions rather than forcing one technique."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Poor timing on electric chair?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Results in failed sweep attempts that waste energy and give opponent recovery time. The correction is: Execute electric chair when opponent postures up or drives forward, using their momentum to complete the sweep."
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
  "name": "Kimura Trap",
  "description": "Master Kimura Trap in BJJ. Complete guide covering control, back attacks, and sweeps from the lockdown Kimura position. Success rates: Beginner 40%, Intermediate 60%, Advanced 80%.",
  "url": "https://bjjgraph.com/positions/kimura-trap",
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
      "name": "Kimura Trap",
      "item": "https://bjjgraph.com/positions/kimura-trap"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Kimura Trap (S210) - Offensive control position from half guard bottom combining lockdown leg control with Kimura arm grip. Creates multiple offensive threats including electric chair sweep, back takes, and Kimura submissions.

KEY_MECHANICS: Lockdown immobilizes opponent's leg while Kimura grip controls arm. Breaking opponent's posture creates sweep opportunities. Opponent's defensive choices create offensive branching paths. Core 10th Planet system position.

STRATEGIC_VALUE: High-percentage position for bottom game that forces opponent into defensive dilemmas. Scales excellently with skill level. Central hub for Eddie Bravo's half guard attacking system.

COMMON_PATTERNS: Posture up defense → Electric chair sweep. Flatten defense → Back take. Strong base → Dog fight transition. Kimura defense → Triangle switch.

SYSTEM_INTEGRATION: Core of 10th Planet lockdown system (Eddie Bravo), connects to Danaher's Kimura system principles, integrates with Gordon Ryan's half guard game.
-->

# Kimura Trap
#bjj #state #half-guard #lockdown #offensive #10th-planet

## State Properties
- **State ID**: S210
- **Point Value**: 0 (Control position)
- **Position Type**: Offensive with control emphasis
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
The Kimura Trap is a signature 10th Planet Jiu-Jitsu position that combines the lockdown (leg control) with a Kimura grip (arm control) from half guard bottom. This position creates a powerful control system where you've immobilized your opponent's leg with your lockdown while simultaneously controlling their near arm with a figure-four Kimura grip. The combination of leg and arm control severely limits opponent's mobility and creates multiple offensive opportunities.

This position serves as the foundation for several high-percentage attacks including the electric chair sweep, back takes, and the Kimura submission itself. The key strategic value lies in forcing your opponent into defensive dilemmas - defending one attack opens them to another. When opponent postures up to defend the Kimura, they become vulnerable to the electric chair. When they flatten to prevent the sweep, they expose their back. This systematic approach to attack chaining makes the Kimura Trap especially effective in no-gi grappling and MMA.

The position requires active management of both the lockdown and Kimura grip simultaneously. Unlike passive half guard positions, the Kimura Trap demands constant offensive pressure that forces reactions. Beginners often struggle with coordinating the leg and arm controls, but with practice, this becomes one of the most reliable bottom positions for creating offense while minimizing the risk of being passed or submitted.

### Visual Description
You are on your back in half guard with your opponent between your legs. Your legs are crossed in the lockdown configuration - your bottom leg threads through their legs from outside to inside, and your top leg crosses over your own ankle, trapping their leg between yours. Your hands have secured a figure-four Kimura grip on their near arm, with one hand controlling their wrist while your other arm threads through their elbow to grip your own wrist.

Your body is typically angled slightly on your side facing toward their trapped arm, creating leverage for both the lockdown and Kimura pressure. Your opponent is trapped with one leg immobilized by your lockdown and one arm controlled by your Kimura grip, leaving them with limited options to base or defend. Their posture is broken or they're fighting to maintain it, and their trapped leg is extended with their knee typically pointing toward the ceiling due to your lockdown control. This creates a mechanical advantage where you control two of their limbs simultaneously while maintaining a relatively safe bottom position.

## Key Principles
- **Dual Control System**: Simultaneously controlling opponent's leg with lockdown and arm with Kimura creates compounding control advantages
- **Dilemma Creation**: Force opponent to choose between defending sweep, back take, or submission - each defense opens different attacks
- **Active Pressure Application**: Constantly threaten finish or transition to prevent opponent from establishing stable defensive posture
- **Lockdown Mechanics**: Proper leg crossing and squeeze creates powerful leg control that breaks opponent's base and posture
- **Kimura as Steering Wheel**: Use Kimura grip not just for submission but as tool to manipulate opponent's positioning and reactions
- **System-Based Thinking**: Position functions as hub for multiple attack chains rather than single-technique focus

## Prerequisites
- Understanding of lockdown mechanics from half guard
- Figure-four Kimura grip fundamentals
- Half guard bottom positioning and safety
- Coordination of simultaneous upper and lower body controls

## State Invariants
- Figure-four Kimura grip on opponent's arm
- Lockdown control on opponent's leg with legs crossed
- Bottom position with opponent in your half guard

## Defensive Responses (When Opponent Has This State Against You)
- [[Posture Up and Break Lockdown]] → [[Half Guard Top]] (Success Rate: 35%)
- [[Roll Out]] → [[Guard Recovery]] (Success Rate: 25%)
- [[Pass to Side Control]] → [[Side Control]] (Success Rate: 20%)
- [[Counter Kimura]] → [[Kimura Control]] (Success Rate: 15%)

## Offensive Transitions (Available From This State)
- [[Electric Chair Sweep]] → [[Top Position]] (Success Rate: Beginner 40%, Intermediate 60%, Advanced 80%)
- [[Back Take from Trap]] → [[Back Control]] (Success Rate: Beginner 35%, Intermediate 55%, Advanced 75%)
- [[Kimura Submission]] → [[Won by Submission]] (Success Rate: Beginner 25%, Intermediate 45%, Advanced 70%)
- [[Dog Fight Transition]] → [[Dogfight Position]] (Success Rate: Beginner 45%, Intermediate 65%, Advanced 85%)
- [[Old School Sweep]] → [[Top Position]] (Success Rate: Beginner 30%, Intermediate 50%, Advanced 70%)
- [[Triangle from Trap]] → [[Triangle Control]] (Success Rate: Beginner 20%, Intermediate 40%, Advanced 60%)

## Counter Transitions
- [[Re-establish Trap]] → [[Kimura Trap]] (after opponent escapes lockdown)
- [[Switch to Standard Half Guard]] → [[Half Guard Bottom]] (when Kimura grip is lost)
- [[Transition to Dog Fight]] → [[Dogfight Position]] (when position becomes neutralized)

## Expert Insights
**John Danaher**: "The Kimura Trap represents an interesting convergence of leg control and arm control principles. What makes this position mechanically sound is the way the lockdown immobilizes the opponent's base while the Kimura grip controls their upper body posture. When you remove an opponent's ability to establish both a stable base and proper posture simultaneously, you've created conditions for multiple attack opportunities. The key technical detail is understanding that each control reinforces the other - the lockdown prevents them from stepping over to escape the Kimura, while the Kimura prevents them from establishing the posture needed to break the lockdown."

**Gordon Ryan**: "In no-gi competition, the Kimura Trap is one of the highest percentage positions from bottom half guard because it's so difficult to defend multiple threats at once. I use it to force opponents into making choices - if they worry about the electric chair, I take their back. If they flatten to defend the back take, I hit the sweep. The most important thing is not getting attached to one finish. The position itself is the weapon, and you're just following whatever opening they give you. Against really good opponents, I'll often use the Kimura Trap just to create scrambles that I can win because they're so focused on defending the primary threats."

**Eddie Bravo**: "The Kimura Trap is the heart of the 10th Planet lockdown system. We developed this position specifically for no-gi and MMA where traditional gi grips aren't available. The beauty of it is that it completely neutralizes size and strength advantages because you've got their leg and arm trapped in a way where they can't use their power. From here, you're hunting for the electric chair, which is a devastating sweep, or you're climbing their back if they defend too hard. The key is being patient and waiting for them to make a mistake. Don't force it - let them give you the opening by reacting to your threats. That's real jiu-jitsu."

## Common Errors
- **Error**: Loose lockdown control
  - **Consequence**: Allows opponent to escape the trap easily and pass to side control or remove their leg from lockdown.
  - **Correction**: Keep your legs tightly crossed with your top foot hooking over your bottom shin, squeezing your knees together to maintain control.
  - **Recognition**: If opponent can easily move their leg or step over, your lockdown isn't tight enough.

- **Error**: Weak Kimura grip
  - **Consequence**: Reduces the offensive threat and allows opponent to slip their arm free or counter the position.
  - **Correction**: Maintain tight figure-four grip with your hands interlocked and wrists close together, keeping constant pressure on the shoulder.
  - **Recognition**: If opponent can straighten their arm or rotate it freely, your grip needs to be tightened.

- **Error**: Not creating opponent reactions
  - **Consequence**: Leads to static position where neither person can advance, wasting energy without creating opportunities.
  - **Correction**: Actively threaten the Kimura finish, electric chair, or back take to force opponent into defensive choices that open other attacks.
  - **Recognition**: If the position feels stuck and opponent isn't moving or reacting defensively, you need to apply more threatening pressure.

- **Error**: Over-committing to one attack
  - **Consequence**: Makes you predictable and allows opponent to defend effectively while countering your position.
  - **Correction**: Flow between electric chair, back take, and Kimura finish based on opponent's reactions rather than forcing one technique.
  - **Recognition**: If you keep trying the same technique and it's not working, you're missing the other opportunities the position creates.

- **Error**: Poor timing on electric chair
  - **Consequence**: Results in failed sweep attempts that waste energy and give opponent recovery time.
  - **Correction**: Execute electric chair when opponent postures up or drives forward, using their momentum to complete the sweep.
  - **Recognition**: If your sweep attempts feel like you're fighting their weight, you're attacking at the wrong moment.

- **Error**: Neglecting underhook battle
  - **Consequence**: Allows opponent to establish dominant underhook position that neutralizes your lockdown and Kimura threats.
  - **Correction**: Fight for underhook position before or while establishing Kimura trap, using your free arm to prevent opponent's underhook.
  - **Recognition**: If opponent has deep underhook and you can't create offensive threats, the position has been compromised.

- **Error**: Flat on back positioning
  - **Consequence**: Reduces effectiveness of both lockdown and Kimura by eliminating angle and leverage advantages.
  - **Correction**: Angle your body on your side toward the trapped arm, creating better leverage for both controls and making opponent carry more weight.
  - **Recognition**: If you're completely flat and opponent feels light, you need to adjust your angle.

## Training Drills
- **Lockdown and Kimura Coordination Drill**: Practice establishing both controls independently, then together with partner providing progressive resistance from 0% to 50%. Focus on proper leg crossing for lockdown and tight Kimura grip, performing 10 repetitions from half guard bottom.

- **Electric Chair Flow Drill**: From established Kimura Trap, practice the electric chair sweep with partner resisting at 25-50% intensity. Focus on timing the sweep with opponent's posture changes and using lockdown extension. Perform 15 repetitions alternating sides.

- **Multi-Attack Chains**: Drill flowing between electric chair, back take, and Kimura finish based on partner's defensive reactions. Partner defends realistically at 40-60% intensity while you recognize and execute the appropriate attack. Complete 20 total transitions in the drill.

- **Positional Sparring from Trap**: Start with Kimura Trap established and engage in 5-minute rounds of positional sparring where defender tries to escape and attacker tries to sweep, submit, or take back. Focus on maintaining control under dynamic resistance and recognizing attack opportunities.

- **Lockdown Breaking Defense Drill**: Partner practices breaking your lockdown while you work to maintain control and threaten attacks. This develops the ability to keep position under pressure. Practice 10 rounds of 1-minute intervals with active defense.

## Related States
- [[Half Guard Bottom]] - Starting position for Kimura Trap entry
- [[Lockdown Guard]] - Core leg control component
- [[Kimura Control]] - Arm control foundation
- [[Back Control]] - High-percentage transition target
- [[Dogfight Position]] - Alternative transition option

## Related Positions
- [[Lockdown Guard]] - Foundational leg control position
- [[Electric Chair]] - Primary sweep option
- [[Back Control]] - Transition target from trap
- [[Kimura Control]] - Related arm control position
- [[Half Guard Bottom]] - Starting position

## Decision Tree
If opponent tries to posture up:
- Execute [[Electric Chair Sweep]] → [[Top Position]] (Probability: 60%)
- Or Transition to [[Dog Fight]] → [[Dogfight Position]] (Probability: 65%)

Else if opponent flattens to defend:
- Execute [[Back Take from Trap]] → [[Back Control]] (Probability: 55%)
- Or Execute [[Old School Sweep]] → [[Top Position]] (Probability: 50%)

Else if opponent defends Kimura grip:
- Transition to [[Triangle from Trap]] → [[Triangle Control]] (Probability: 40%)
- Or Switch to [[Dog Fight Transition]] → [[Dogfight Position]] (Probability: 65%)

Else (Default - opponent balanced):
- Threaten [[Kimura Submission]] to create reaction → [[Kimura Trap]] (Probability: 50%)
- Or Setup [[Electric Chair Sweep]] → [[Top Position]] (Probability: 55%)

## Position Metrics
- **Position Retention Rate**: Beginner 40%, Intermediate 60%, Advanced 80%
- **Advancement Probability**: Beginner 45%, Intermediate 65%, Advanced 85%
- **Submission Probability**: Beginner 25%, Intermediate 45%, Advanced 70%
- **Position Loss Probability**: Beginner 45%, Intermediate 30%, Advanced 15%
- **Average Time in Position**: 1-3 minutes

## Optimal Submission Paths
**High-percentage sweep path:**
[[Kimura Trap]] → [[Electric Chair Sweep]] → [[Top Position]] → [[Side Control]] → [[Mount]] → [[Submission]]
*Reasoning: Electric chair has highest success rate (60-80%), establishes top position for systematic finishing*

**Direct back attack path:**
[[Kimura Trap]] → [[Back Take from Trap]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: When opponent flattens to defend, back take becomes available with 55-75% success, leads to dominant finishing position*

**Direct submission path:**
[[Kimura Trap]] → [[Kimura Submission]] → [[Won by Submission]]
*Reasoning: Direct finish when opponent's arm is properly isolated, success rate 45-70% at intermediate to advanced levels*

**Alternative attack path:**
[[Kimura Trap]] → [[Triangle from Trap]] → [[Triangle Control]] → [[Won by Submission]]
*Reasoning: When Kimura is defended, switching to triangle attacks different target with 40-60% success rate*

**System-based path (10th Planet methodology):**
[[Kimura Trap]] → [[Dog Fight Transition]] → [[Dogfight Position]] → [[Back Take]] → [[Back Control]] → [[Won by Submission]]
*Reasoning: Using Eddie Bravo's systematic approach, dog fight provides stable transition platform to back attacks with high success rate*
