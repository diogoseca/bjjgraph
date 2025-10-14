---
title: "Kimura Control | BJJ Position Guide | BJJ Graph"
description: "Master Kimura Control in BJJ. Complete guide covering setup, control, and submissions from the figure-four shoulder lock position. Success rates: Beginner 45%, Intermediate 65%, Advanced 80%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S095
  position_name: "Kimura Control"
  alternative_names: ["Double Wristlock Control", "Gyaku Ude-Garami", "Reverse Arm Entanglement"]

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
      beginner: 45
      intermediate: 65
      advanced: 80
    advancement_probability:
      beginner: 50
      intermediate: 70
      advanced: 85
    submission_probability:
      beginner: 35
      intermediate: 55
      advanced: 75
    position_loss_probability:
      beginner: 40
      intermediate: 25
      advanced: 12
    average_time_in_position: "1-2 minutes"

  # State Machine Integration
  invariants:
    - "Figure-four grip on opponent's arm with your hands interlocked"
    - "Control of opponent's wrist with one hand, your other hand through opponent's elbow"
    - "Ability to apply pressure to shoulder joint through rotation"

  # Available Transitions
  offensive_transitions:
    - technique: "Kimura Finish"
      target_state: "Won by Submission"
      transition_id: "T210"
      success_rate:
        beginner: 35
        intermediate: 55
        advanced: 75

    - technique: "Back Take from Kimura"
      target_state: "Back Control"
      transition_id: "T211"
      success_rate:
        beginner: 40
        intermediate: 60
        advanced: 80

    - technique: "Armbar from Kimura"
      target_state: "Armbar Control"
      transition_id: "T212"
      success_rate:
        beginner: 30
        intermediate: 50
        advanced: 70

    - technique: "Sweep from Kimura"
      target_state: "Top Position"
      transition_id: "T213"
      success_rate:
        beginner: 35
        intermediate: 55
        advanced: 75

    - technique: "Triangle from Failed Kimura"
      target_state: "Triangle Control"
      transition_id: "T214"
      success_rate:
        beginner: 25
        intermediate: 45
        advanced: 65

    - technique: "Omoplata from Kimura"
      target_state: "Omoplata Control"
      transition_id: "T215"
      success_rate:
        beginner: 20
        intermediate: 40
        advanced: 60

    - technique: "Wrist Lock from Kimura"
      target_state: "Won by Submission"
      transition_id: "T216"
      success_rate:
        beginner: 15
        intermediate: 30
        advanced: 50

  defensive_responses:
    - technique: "Roll Out"
      target_state: "Guard Recovery"
      success_rate: 35

    - technique: "Grab Own Belt"
      target_state: "Kimura Defense"
      success_rate: 30

    - technique: "Straighten Arm"
      target_state: "Kimura Escape"
      success_rate: 25

    - technique: "Pass to Side Control"
      target_state: "Side Control"
      success_rate: 20

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent's arm isolated and trapped"
      options:
        - action: "Kimura Finish"
          target: "Won by Submission"
          probability: 55
        - action: "Back Take"
          target: "Back Control"
          probability: 60

    - condition: "Opponent defends by grabbing belt"
      options:
        - action: "Switch to Wrist Lock"
          target: "Won by Submission"
          probability: 30
        - action: "Triangle Transition"
          target: "Triangle Control"
          probability: 45

    - condition: "Opponent tries to roll"
      options:
        - action: "Follow to Back Control"
          target: "Back Control"
          probability: 70
        - action: "Sweep to Top"
          target: "Top Position"
          probability: 55

    - condition: "Opponent straightens arm"
      options:
        - action: "Switch to Armbar"
          target: "Armbar Control"
          probability: 50
        - action: "Maintain Control"
          target: "Kimura Control"
          probability: 40

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 2.5
    defender_burn_rate: 3.0
    explosive_escape_multiplier: 4.5
    cooking_rate: 2.0

  # Related States
  related_states:
    - "Side Control"
    - "Half Guard Top"
    - "Closed Guard Bottom"
    - "Back Control"
    - "Kimura Trap"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Kimura Control in BJJ",
  "description": "Complete guide to executing techniques and transitions from Kimura Control position.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Figure-Four Grip",
      "text": "Secure the figure-four grip on opponent's arm with your hands interlocked behind their wrist.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Control Opponent's Shoulder",
      "text": "Apply pressure to opponent's shoulder joint through controlled rotation of the trapped arm.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Execute Kimura Finish",
      "text": "From this position, execute Kimura Finish to achieve submission by rotating opponent's arm behind their back.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Back Take Option",
      "text": "If opponent rolls to defend, follow their movement to transition to Back Control with superior positioning.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Armbar Alternative",
      "text": "If opponent straightens their arm, switch to Armbar Control for alternative submission path.",
      "position": 5
    },
    {
      "@type": "HowToStep",
      "name": "Sweep to Dominance",
      "text": "Use Kimura grip as lever to sweep opponent and establish top position control.",
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
      "name": "What is a common mistake in Insufficient figure-four tightness?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to slip their arm out or reduces control, weakening the submission threat and positional dominance. The correction is: Keep your hands tightly interlocked with your wrists close together, eliminating any space in the figure-four configuration."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Over-rotating too quickly?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Causes opponent to roll out of the submission or injures the shoulder before they can tap safely. The correction is: Apply progressive pressure gradually, allowing your partner time to recognize the submission and tap safely."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Losing hip position?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Reduces leverage and allows opponent to escape or counter the Kimura control effectively. The correction is: Maintain hip pressure toward opponent's shoulder, keeping your body weight distributed to prevent them from turning into you."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Focusing only on submission?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Limits your options when opponent defends, making you predictable and easier to counter. The correction is: Recognize Kimura as a control position with multiple attack options including sweeps, back takes, and other submissions."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Incorrect grip configuration?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Weakens the Kimura lock and reduces your ability to finish or transition to other techniques. The correction is: Ensure proper figure-four with your hand through opponent's elbow, gripping your own wrist to form a strong structural lock."
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
  "name": "Kimura Control",
  "description": "Master Kimura Control in BJJ. Complete guide covering setup, control, and submissions from the figure-four shoulder lock position. Success rates: Beginner 45%, Intermediate 65%, Advanced 80%.",
  "url": "https://bjjgraph.com/positions/kimura-control",
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
      "name": "Kimura Control",
      "item": "https://bjjgraph.com/positions/kimura-control"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Kimura Control (S095) - Offensive control position featuring figure-four shoulder lock on opponent's arm. Versatile position offering submissions, back takes, sweeps, and transitions.

KEY_MECHANICS: Figure-four grip creates structural control of opponent's shoulder. Hip positioning provides leverage. Rotation of trapped arm applies submission pressure. Multiple attack branches create dilemmas.

STRATEGIC_VALUE: High-percentage control position that scales excellently with skill. Creates persistent offensive threat that opponents must address. Links to multiple submission and positional advancement paths.

COMMON_PATTERNS: Isolated arm → Direct finish or back take. Belt grip defense → Wrist lock or triangle. Roll attempt → Follow to back. Arm straightening → Switch to armbar.

SYSTEM_INTEGRATION: Core of Danaher shoulder lock system, integral to Kimura trap system (Gordon Ryan), connects to Eddie Bravo's lockdown-to-sweep game plans.
-->

# Kimura Control
#bjj #state #control #shoulder-lock #offensive

## State Properties
- **State ID**: S095
- **Point Value**: 0 (Control position, not scored independently)
- **Position Type**: Offensive with control emphasis
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
Kimura Control is a dominant control position in BJJ where you've secured a figure-four grip on your opponent's arm, isolating their shoulder joint and creating a powerful lever for submissions, sweeps, and positional advancement. Named after the Japanese judoka Masahiko Kimura, this position features exceptional versatility as it can be established from multiple starting positions including side control, half guard, closed guard, and standing positions.

The Kimura Control position is characterized by its offensive potential while maintaining strong positional control. Unlike a pure submission attempt, Kimura Control emphasizes maintaining the grip while using it as a foundation for multiple attack options. The figure-four configuration creates structural integrity that's difficult for opponents to break, making it a reliable control mechanism even at high levels of competition.

This position serves as a hub for multiple offensive pathways - you can finish the Kimura submission directly, transition to back control when opponent rolls, sweep to top position using the grip as leverage, or switch to other submissions like armbars or triangles when defenses are presented. The persistent threat of the Kimura forces opponents into defensive dilemmas where each defensive choice opens a different offensive opportunity.

### Visual Description
You have secured a figure-four grip on your opponent's arm, with one hand controlling their wrist while your other arm threads through their elbow and grips your own wrist to form a locked configuration. Your body positioning varies based on where you established the Kimura, but fundamentally your hips are positioned to apply leverage toward the trapped shoulder, creating pressure that threatens submission while maintaining control. Your opponent's arm is bent at approximately 90 degrees with their elbow pointing away from their body, and their hand is drawn behind their back or to their side depending on the stage of control.

Your chest may be pressed against their shoulder to prevent their escape, while your free hand (if not already gripping) might control their head, belt, or other arm to prevent counters. The trapped arm is isolated from their body's defensive structure, making it difficult for them to use their natural strength to resist. Your legs and hips are positioned to maintain connection and pressure, whether you're on top in side control, attacking from guard bottom, or transitioning through other positions. This creates a mechanical advantage where your entire body can apply rotational force to their single shoulder joint, establishing clear control and offensive dominance.

## Key Principles
- **Figure-Four Structural Integrity**: The interlocked grip creates a strong frame that's difficult to break, providing reliable control throughout transitions
- **Shoulder Joint Isolation**: Separating the arm from the body's defensive structure maximizes your leverage advantage and submission potential
- **Multi-Directional Threat**: Maintain simultaneous threats of submission, back take, sweep, and alternative submissions to create defensive dilemmas
- **Progressive Pressure Application**: Apply submission pressure gradually to maintain safety while testing opponent's defensive reactions
- **Hip Connection Management**: Keep your hips positioned to maximize leverage while preventing opponent's escape or counter opportunities
- **Transition Sensitivity**: Recognize when direct submission isn't available and seamlessly flow to alternative attacks based on opponent's defensive choices

## Prerequisites
- Understanding of figure-four grip mechanics
- Shoulder rotation awareness for safe application
- Hip positioning for leverage generation
- Recognition of entry opportunities from multiple positions

## State Invariants
- Figure-four grip on opponent's arm with your hands interlocked
- Control of opponent's wrist with one hand, your other hand through opponent's elbow
- Ability to apply pressure to shoulder joint through rotation

## Defensive Responses (When Opponent Has This State Against You)
- [[Roll Out]] → [[Guard Recovery]] (Success Rate: 35%)
- [[Grab Own Belt]] → [[Kimura Defense]] (Success Rate: 30%)
- [[Straighten Arm]] → [[Kimura Escape]] (Success Rate: 25%)
- [[Pass to Side Control]] → [[Side Control]] (Success Rate: 20%)

## Offensive Transitions (Available From This State)
- [[Kimura Finish]] → [[Won by Submission]] (Success Rate: Beginner 35%, Intermediate 55%, Advanced 75%)
- [[Back Take from Kimura]] → [[Back Control]] (Success Rate: Beginner 40%, Intermediate 60%, Advanced 80%)
- [[Armbar from Guard]] → [[Armbar Control]] (Success Rate: Beginner 30%, Intermediate 50%, Advanced 70%)
- [[Sweep from Kimura]] → [[Top Position]] (Success Rate: Beginner 35%, Intermediate 55%, Advanced 75%)
- [[Triangle from Failed Kimura]] → [[Triangle Choke Side]] (Success Rate: Beginner 25%, Intermediate 45%, Advanced 65%)
- [[Omoplata from Kimura]] → [[Omoplata Control]] (Success Rate: Beginner 20%, Intermediate 40%, Advanced 60%)
- [[Wrist Lock from Kimura]] → [[Won by Submission]] (Success Rate: Beginner 15%, Intermediate 30%, Advanced 50%)

## Counter Transitions
- [[Re-establish Kimura]] → [[Kimura Control]] (after failed submission attempt)
- [[Switch to Back Control]] → [[Back Control]] (when opponent begins to roll)
- [[Alternative Submission Chain]] → [[Armbar Control]] or [[Triangle Control]] (when Kimura is defended)

## Expert Insights
**John Danaher**: "The Kimura Control is not merely a submission attempt but rather a control position that creates a entire system of attacks. The fundamental principle is shoulder isolation - when you properly isolate the shoulder from the body's defensive structure, you've created a mechanical advantage that forces the opponent into a series of defensive choices, each of which leads to a different offensive opportunity. The key technical detail is maintaining hip pressure toward the trapped shoulder while keeping the figure-four tight. This position represents one of the highest-percentage control mechanisms in grappling because it converts defensive reactions into offensive opportunities."

**Gordon Ryan**: "In competition, the Kimura is my go-to control from multiple positions because it works at every level. From half guard bottom, I use it to sweep or take the back - the opponent has to choose which one to give me. From top positions, I use it to maintain dominance while threatening the finish. The most important aspect is understanding that the Kimura grip is a steering wheel - you're not just trying to submit, you're using it to control where the match goes. When someone defends the Kimura by grabbing their belt, that's when I switch to wrist locks or use their defensive grip against them."

**Eddie Bravo**: "The Kimura is central to the 10th Planet system, especially from the lockdown position in half guard. We use it to create what I call the 'Kimura Trap' - a position where the opponent is completely stuck dealing with the Kimura threat while we attack their back or go for other submissions. The beauty of the Kimura Control is how it chains into everything else. From the trap, you can hit the electric chair sweep, take the back, or finish the Kimura itself. It's about creating multiple threats simultaneously so the opponent can't focus on defending just one attack."

## Common Errors
- **Error**: Insufficient figure-four tightness
  - **Consequence**: Allows opponent to slip their arm out or reduces control, weakening the submission threat and positional dominance.
  - **Correction**: Keep your hands tightly interlocked with your wrists close together, eliminating any space in the figure-four configuration.
  - **Recognition**: If you feel the opponent's arm moving independently or your grip feels loose, immediately retighten the lock.

- **Error**: Over-rotating too quickly
  - **Consequence**: Causes opponent to roll out of the submission or injures the shoulder before they can tap safely.
  - **Correction**: Apply progressive pressure gradually, allowing your partner time to recognize the submission and tap safely.
  - **Recognition**: In training, if your partner's body moves suddenly or you hear joint sounds, you're applying pressure too fast.

- **Error**: Losing hip position
  - **Consequence**: Reduces leverage and allows opponent to escape or counter the Kimura control effectively.
  - **Correction**: Maintain hip pressure toward opponent's shoulder, keeping your body weight distributed to prevent them from turning into you.
  - **Recognition**: If opponent is able to face you or create space between your bodies, your hip position has been compromised.

- **Error**: Focusing only on submission
  - **Consequence**: Limits your options when opponent defends, making you predictable and easier to counter.
  - **Correction**: Recognize Kimura as a control position with multiple attack options including sweeps, back takes, and other submissions.
  - **Recognition**: If you're stuck trying to finish while opponent successfully defends, you've missed transition opportunities.

- **Error**: Incorrect grip configuration
  - **Consequence**: Weakens the Kimura lock and reduces your ability to finish or transition to other techniques.
  - **Correction**: Ensure proper figure-four with your hand through opponent's elbow, gripping your own wrist to form a strong structural lock.
  - **Recognition**: If opponent can straighten their arm easily or your grip feels unstable, check your hand positioning.

- **Error**: Neglecting opponent's free arm
  - **Consequence**: Allows opponent to establish frames, push your head, or create defensive structures that compromise your control.
  - **Correction**: Control opponent's free arm with your body weight, leg positioning, or by trapping it temporarily during key transition moments.
  - **Recognition**: If opponent establishes strong frames or pushes against your head successfully, you've given them too much freedom with their free arm.

- **Error**: Static position without progression
  - **Consequence**: Allows opponent time to develop better defenses or creates stalemate where neither person can advance.
  - **Correction**: Constantly threaten finish or transition to keep opponent reacting rather than establishing stable defense.
  - **Recognition**: If the position feels static and opponent isn't moving or reacting, you need to create more threatening pressure or attempt transitions.

## Training Drills
- **Figure-Four Grip Drill**: Practice establishing the figure-four grip from various positions with partner providing progressive resistance from 0% to 75%, focusing on quick hand transitions and proper wrist locking with 10 repetitions from each starting position (side control, half guard, closed guard).

- **Kimura to Back Take Flow**: Drill the transition from Kimura Control to Back Control when partner rolls, emphasizing following their movement while maintaining the grip and establishing hooks smoothly. Practice 15 repetitions with partner rolling at moderate speed, focusing on maintaining control throughout the transition.

- **Multi-Option Kimura Chains**: Practice flowing between Kimura finish, armbar, triangle, and sweep based on partner's defensive reactions, performing 20 total transitions with partner defending realistically at 50-60% intensity. Focus on smooth recognition of which option is available based on opponent's response.

- **Positional Sparring from Kimura**: Start with Kimura Control established and engage in positional sparring where defender tries to escape and attacker tries to advance to back control, submission, or sweep. 5-minute rounds with role switching, emphasizing control maintenance under dynamic resistance.

- **Hip Pressure Maintenance Drill**: Practice keeping optimal hip pressure while opponent tries to turn into you or create space, holding position for 1-minute intervals with partner escaping at 40-70% intensity. Focus on weight distribution and hip mobility to maintain control pressure.

## Related States
- [[Side Control]] - Common starting position for Kimura setup
- [[Half Guard Top]] - Frequent Kimura Control entry point
- [[Closed Guard Bottom]] - Offensive Kimura opportunities from bottom
- [[Back Control]] - Natural transition target from Kimura
- [[Kimura Trap]] - Specialized variation emphasizing back take threats

## Related Positions
- [[Back Control]] - High-percentage transition target
- [[Armbar Control]] - Alternative submission when arm straightens
- [[Triangle Control]] - Option when switching attacks
- [[Omoplata Control]] - Similar shoulder attack family
- [[Side Control]] - Common starting position

## Decision Tree
If opponent's arm is isolated and trapped:
- Execute [[Kimura Finish]] → [[Won by Submission]] (Probability: 55%)
- Or Execute [[Back Take from Kimura]] → [[Back Control]] (Probability: 60%)

Else if opponent defends by grabbing belt:
- Switch to [[Wrist Lock from Kimura]] → [[Won by Submission]] (Probability: 30%)
- Or Transition to [[Triangle from Failed Kimura]] → [[Triangle Control]] (Probability: 45%)

Else if opponent tries to roll:
- Follow to [[Back Take from Kimura]] → [[Back Control]] (Probability: 70%)
- Or Execute [[Sweep from Kimura]] → [[Top Position]] (Probability: 55%)

Else if opponent straightens arm:
- Switch to [[Armbar from Guard]] → [[Armbar Control]] (Probability: 50%)
- Or Maintain [[Kimura Control]] → [[Kimura Control]] (Probability: 40%)

## Position Metrics
- **Position Retention Rate**: Beginner 45%, Intermediate 65%, Advanced 80%
- **Advancement Probability**: Beginner 50%, Intermediate 70%, Advanced 85%
- **Submission Probability**: Beginner 35%, Intermediate 55%, Advanced 75%
- **Position Loss Probability**: Beginner 40%, Intermediate 25%, Advanced 12%
- **Average Time in Position**: 1-2 minutes

## Optimal Submission Paths
**Direct submission path:**
[[Kimura Control]] → [[Kimura Finish]] → [[Won by Submission]]
*Reasoning: Most straightforward when opponent's shoulder is isolated and properly controlled, success rate 55-75% depending on skill level*

**High-percentage positional path:**
[[Kimura Control]] → [[Back Take from Kimura]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: Following opponent's roll creates highest success rate (60-80%), establishes dominant position before finishing*

**Alternative submission chain:**
[[Kimura Control]] → [[Armbar from Guard]] → [[Armbar Control]] → [[Won by Submission]]
*Reasoning: When opponent straightens arm to defend Kimura, switching to armbar becomes highly effective, success rate 50-70%*

**Sweep to dominance path:**
[[Kimura Control]] → [[Sweep from Kimura]] → [[Top Position]] → [[Side Control]] → [[Mount]] → [[Submission Chains]] → [[Won by Submission]]
*Reasoning: Using Kimura grip as leverage for sweep establishes top position, allowing methodical progression to submissions*

**System-based path (Danaher methodology):**
[[Kimura Control]] → [[Triangle from Failed Kimura]] → [[Triangle Choke Side]] → [[Won by Submission]]
*Reasoning: Systematic approach recognizes when primary attack is defended and immediately switches to alternative shoulder/arm attack system*
