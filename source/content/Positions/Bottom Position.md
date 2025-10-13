---
title: "Bottom Position | BJJ Position Guide | BJJ Graph"
description: "Master Bottom Position in BJJ. Complete guide covering defensive strategies, guard establishment, and escape fundamentals. Success rates: Beginner 30%, Intermediate 50%, Advanced 70%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S211
  position_name: "Bottom Position"
  alternative_names: ["Defensive Bottom", "Guard Bottom", "Bottom Game"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Defensive with offensive potential"
    risk_level: "Medium to High"
    energy_cost: "Medium"
    time_sustainability: "Short to Medium"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 30
      intermediate: 50
      advanced: 70
    advancement_probability:
      beginner: 25
      intermediate: 45
      advanced: 65
    submission_probability:
      beginner: 15
      intermediate: 30
      advanced: 50
    position_loss_probability:
      beginner: 55
      intermediate: 40
      advanced: 25
    average_time_in_position: "30 seconds to 2 minutes"

  # State Machine Integration
  invariants:
    - "On back or side with opponent on top or threatening top position"
    - "Defending against passes, submissions, or pins"
    - "Seeking to establish guard or escape to better position"

  # Available Transitions
  offensive_transitions:
    - technique: "Establish Closed Guard"
      target_state: "Closed Guard Bottom"
      transition_id: "T230"
      success_rate:
        beginner: 35
        intermediate: 55
        advanced: 75

    - technique: "Create Open Guard"
      target_state: "Open Guard Bottom"
      transition_id: "T231"
      success_rate:
        beginner: 40
        intermediate: 60
        advanced: 80

    - technique: "Technical Standup"
      target_state: "Standing Position"
      transition_id: "T232"
      success_rate:
        beginner: 25
        intermediate: 45
        advanced: 65

    - technique: "Hip Escape to Guard"
      target_state: "Guard Position"
      transition_id: "T233"
      success_rate:
        beginner: 30
        intermediate: 50
        advanced: 70

    - technique: "Turtle Position"
      target_state: "Turtle Position"
      transition_id: "T234"
      success_rate:
        beginner: 35
        intermediate: 55
      advanced: 75

    - technique: "Half Guard Recovery"
      target_state: "Half Guard Bottom"
      transition_id: "T235"
      success_rate:
        beginner: 40
        intermediate: 60
        advanced: 80

  defensive_responses:
    - technique: "Pass to Side Control"
      target_state: "Side Control"
      success_rate: 45

    - technique: "Pass to Mount"
      target_state: "Mount"
      success_rate: 35

    - technique: "Submission Attack"
      target_state: "Submission Control Position"
      success_rate: 25

    - technique: "Pin and Control"
      target_state: "Top Control"
      success_rate: 40

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent attempting guard pass"
      options:
        - action: "Establish Open Guard"
          target: "Open Guard Bottom"
          probability: 60
        - action: "Recover Half Guard"
          target: "Half Guard Bottom"
          probability: 60

    - condition: "Space available to stand"
      options:
        - action: "Technical Standup"
          target: "Standing Position"
          probability: 45
        - action: "Create Guard"
          target: "Guard Position"
          probability: 55

    - condition: "Opponent establishing control"
      options:
        - action: "Hip Escape"
          target: "Guard Position"
          probability: 50
        - action: "Transition to Turtle"
          target: "Turtle Position"
          probability: 55

    - condition: "Default - Neutral scramble"
      options:
        - action: "Establish Closed Guard"
          target: "Closed Guard Bottom"
          probability: 55
        - action: "Create Distance"
          target: "Open Guard Bottom"
          probability: 60

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 3.0
    defender_burn_rate: 2.5
    explosive_escape_multiplier: 4.0
    cooking_rate: 2.0

  # Related States
  related_states:
    - "Closed Guard Bottom"
    - "Open Guard Bottom"
    - "Half Guard Bottom"
    - "Turtle Position"
    - "Side Control"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Manage Bottom Position in BJJ",
  "description": "Complete guide to defensive strategies and guard establishment from bottom position.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Protect Yourself First",
      "text": "Establish defensive frames and protect your neck and limbs from submission attacks.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Create Space",
      "text": "Use hip escapes and frames to create space between you and your opponent.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Establish Guard",
      "text": "Work to get your legs between you and opponent to establish closed or open guard.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Control Distance",
      "text": "Use your legs and frames to manage distance and prevent opponent from establishing dominant pins.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Transition to Better Position",
      "text": "Move to half guard, full guard, or technical standup based on available opportunities.",
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
      "name": "What is a common mistake in Staying flat on back?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Makes it easy for opponent to pass guard, establish mount, or apply submission pressure without resistance. The correction is: Stay on your side or hip, creating angles that make it harder for opponent to control you and easier to establish guard."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Not using frames?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to close distance and establish dominant control positions without having to overcome defensive structures. The correction is: Establish frames using your forearms, shins, and feet to create barriers that prevent opponent from advancing position."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Panic and explosive movements?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Wastes energy quickly and often gives opponent better position or submission opportunities through uncontrolled movement. The correction is: Stay calm, breathe, and make deliberate technical movements focused on creating guard or escaping to safety."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Giving up back?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Transitions from bad position to worse position, giving opponent the most dominant control position in BJJ. The correction is: Protect your back at all times - avoid rolling away from opponent or turning your back during scrambles."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Not establishing guard quickly?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Leaves you in vulnerable no-man's land where opponent can establish dominant pins or attempt submissions. The correction is: Prioritize getting your legs between you and opponent as quickly as possible to establish guard control."
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
  "name": "Bottom Position",
  "description": "Master Bottom Position in BJJ. Complete guide covering defensive strategies, guard establishment, and escape fundamentals. Success rates: Beginner 30%, Intermediate 50%, Advanced 70%.",
  "url": "https://bjjgraph.com/positions/bottom-position",
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
      "name": "Bottom Position",
      "item": "https://bjjgraph.com/positions/bottom-position"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Bottom Position (S211) - Generic defensive position where you're on your back or side with opponent on top or threatening top position. Focus on defense, guard establishment, and escaping to better positions.

KEY_MECHANICS: Frames and hip movement create space. Getting legs between you and opponent establishes guard. Side positioning prevents opponent weight. Technical movement conserves energy while creating escape paths.

STRATEGIC_VALUE: Fundamental defensive position that all practitioners must understand. Gateway to establishing guard or escaping to neutral. Critical for survival and position recovery.

COMMON_PATTERNS: Opponent passing → Establish guard. Space available → Technical standup. Opponent controlling → Hip escape. Pressure incoming → Frame and create distance.

SYSTEM_INTEGRATION: Foundation of all guard systems (Danaher, Gordon Ryan, Eddie Bravo). Connects to escape hierarchies and defensive frameworks across all BJJ systems.
-->

# Bottom Position
#bjj #state #defensive #bottom #fundamentals

## State Properties
- **State ID**: S211
- **Point Value**: 0 (No points for being on bottom)
- **Position Type**: Defensive with offensive potential
- **Risk Level**: Medium to High
- **Energy Cost**: Medium
- **Time Sustainability**: Short to Medium

## State Description
Bottom Position represents a general defensive state in BJJ where you find yourself on your back or side with your opponent on top or threatening to establish top control. This is a fundamental position that all grapplers experience, especially beginners, and understanding how to manage it effectively is crucial for survival and success in Brazilian Jiu-Jitsu. Unlike specific guard positions which have defined control structures, Bottom Position represents the transitional and often precarious state before proper guard is established or when guard has been partially broken.

The primary objectives from Bottom Position are threefold: protect yourself from submissions and dominant pins, create space and distance using frames and hip movement, and establish a proper guard or escape to a better position. This position requires constant awareness of your opponent's weight distribution, submission threats, and passing attempts. The difference between success and failure from bottom often comes down to maintaining proper defensive posture, using frames effectively, and recognizing the right moment to establish guard or execute an escape.

Bottom Position is inherently less favorable than guard positions because you lack the leg control that guards provide. However, skilled practitioners can use this position as a launchpad to more offensive positions. The key is not to accept bottom as a permanent state but rather as a temporary challenge to be solved through technical movement, proper frames, and strategic positioning. Understanding Bottom Position fundamentals is essential for developing a complete defensive game and building resilience against stronger or more aggressive opponents.

### Visual Description
You are on your back or slightly on your side, with your opponent positioned above or beside you, threatening to establish or having partially established top control. Your body is not completely flat but angled with your shoulders and hips mobile, allowing you to move and adjust your position defensively. Your hands and arms are positioned to create frames - forearms against opponent's hips, shoulders, or neck to manage distance and prevent them from settling their weight on you.

Your legs are in a dynamic position, either attempting to insert between you and your opponent to establish guard, or posted on the mat to create base for hip escapes and movement. Your head is typically off the mat or protected, avoiding the danger of being flattened which would reduce your mobility. Your opponent's position varies - they may be standing trying to pass, in your half guard area trying to advance, or attempting to establish side control or mount. The key visual characteristic is the lack of stable control structures - this is a position of movement and transition rather than static holding.

## Key Principles
- **Protect First, Attack Second**: Prioritize defending submissions and preventing dominant pins before attempting offensive techniques
- **Frame Management**: Use arms and legs as frames to create barriers that prevent opponent from establishing heavy control
- **Hip Mobility**: Keep your hips mobile and never flat on your back - stay on your side to maintain escape options
- **Space Creation**: Use shrimping (hip escapes) and bridging to create space needed for guard establishment or escapes
- **Guard as Priority**: Work constantly to get your legs between you and opponent to establish guard control
- **Energy Conservation**: Make technical movements rather than explosive scrambles to preserve stamina for sustained defense
- **Never Give Your Back**: Avoid rolling away from opponent or turning your back which leads to back control

## Prerequisites
- Basic hip escape (shrimping) technique
- Understanding of frame creation with arms and legs
- Awareness of submission threats and positional dangers
- Fundamental guard concepts

## State Invariants
- On back or side with opponent on top or threatening top position
- Defending against passes, submissions, or pins
- Seeking to establish guard or escape to better position

## Defensive Responses (When Opponent Has This State Against You)
- [[Pass to Side Control]] → [[Side Control]] (Success Rate: 45%)
- [[Pass to Mount]] → [[Mount]] (Success Rate: 35%)
- [[Submission Attack]] → [[Submission Control Position]] (Success Rate: 25%)
- [[Pin and Control]] → [[Top Control]] (Success Rate: 40%)

## Offensive Transitions (Available From This State)
- [[Establish Closed Guard]] → [[Closed Guard Bottom]] (Success Rate: Beginner 35%, Intermediate 55%, Advanced 75%)
- [[Create Open Guard]] → [[Open Guard Bottom]] (Success Rate: Beginner 40%, Intermediate 60%, Advanced 80%)
- [[Technical Standup]] → [[Standing Position]] (Success Rate: Beginner 25%, Intermediate 45%, Advanced 65%)
- [[Hip Escape to Guard]] → [[Guard Position]] (Success Rate: Beginner 30%, Intermediate 50%, Advanced 70%)
- [[Turtle Position]] → [[Turtle Position]] (Success Rate: Beginner 35%, Intermediate 55%, Advanced 75%)
- [[Half Guard Recovery]] → [[Half Guard Bottom]] (Success Rate: Beginner 40%, Intermediate 60%, Advanced 80%)

## Counter Transitions
- [[Re-establish Guard]] → [[Guard Position]] (after losing guard temporarily)
- [[Frame and Recover]] → [[Bottom Position]] (defensive holding)
- [[Scramble to Standing]] → [[Standing Position]] (explosive escape)

## Expert Insights
**John Danaher**: "The bottom position is where many beginners spend a disproportionate amount of their time, and learning to manage it effectively is fundamental to BJJ development. The key technical principle is understanding that bottom position is not a destination but a waypoint - your goal is always to transition to a structured guard position or escape entirely. The critical mechanical elements are maintaining hip mobility, creating frames with your limbs, and never allowing yourself to be flattened. When your back is flat on the mat and your opponent has settled their weight, your options become severely limited. Stay on your side, keep your hips active, and work systematically toward guard establishment."

**Gordon Ryan**: "In competition, I rarely stay in pure bottom position for more than a few seconds because it's inherently disadvantageous. The moment you feel you're losing guard structure, you need to immediately work to re-establish it or escape. The biggest mistake I see is people accepting bottom position and just defending instead of actively working to improve. My approach is to use frames aggressively to create space, then immediately insert my legs to establish guard or create scrambles that I can win. Against stronger opponents especially, you can't afford to stay on bottom without leg control - that's when you get smashed and submitted."

**Eddie Bravo**: "Bottom position is where a lot of people panic and give up their back or get submitted, but it doesn't have to be that way. The 10th Planet system emphasizes staying calm and using frames and hip movement to create the space you need to establish guard. One of the most important things we teach is the technical standup - if you can create enough space, sometimes the best escape is getting to your feet rather than trying to pull guard. But whether you're establishing guard or standing up, the key is not accepting bottom as your fate. Keep moving, create angles, and work toward a position where you have more control."

## Common Errors
- **Error**: Staying flat on back
  - **Consequence**: Makes it easy for opponent to pass guard, establish mount, or apply submission pressure without resistance.
  - **Correction**: Stay on your side or hip, creating angles that make it harder for opponent to control you and easier to establish guard.
  - **Recognition**: If you feel heavy pressure and can't move your hips, you're likely too flat.

- **Error**: Not using frames
  - **Consequence**: Allows opponent to close distance and establish dominant control positions without having to overcome defensive structures.
  - **Correction**: Establish frames using your forearms, shins, and feet to create barriers that prevent opponent from advancing position.
  - **Recognition**: If opponent is able to settle their weight on you easily, you're not framing properly.

- **Error**: Panic and explosive movements
  - **Consequence**: Wastes energy quickly and often gives opponent better position or submission opportunities through uncontrolled movement.
  - **Correction**: Stay calm, breathe, and make deliberate technical movements focused on creating guard or escaping to safety.
  - **Recognition**: If you're exhausted after 30 seconds and position hasn't improved, you're moving too explosively.

- **Error**: Giving up back
  - **Consequence**: Transitions from bad position to worse position, giving opponent the most dominant control position in BJJ.
  - **Correction**: Protect your back at all times - avoid rolling away from opponent or turning your back during scrambles.
  - **Recognition**: If you find opponent behind you with hooks going in, you've given up your back.

- **Error**: Not establishing guard quickly
  - **Consequence**: Leaves you in vulnerable no-man's land where opponent can establish dominant pins or attempt submissions.
  - **Correction**: Prioritize getting your legs between you and opponent as quickly as possible to establish guard control.
  - **Recognition**: If you're on your back but not in guard for more than a few seconds, you need to work faster to establish it.

- **Error**: Hands above head
  - **Consequence**: Leaves your arms vulnerable to submissions and removes ability to create defensive frames.
  - **Correction**: Keep your hands and arms in front of your body where they can protect you and create frames.
  - **Recognition**: If opponent is controlling your arms easily or attacking armbars frequently, check your hand positioning.

- **Error**: Stiff and rigid body
  - **Consequence**: Reduces mobility and makes it harder to escape or adjust position as opponent attacks.
  - **Correction**: Stay loose and mobile, ready to move your hips and shoulders to create angles and space.
  - **Recognition**: If you feel locked in place and unable to move when opponent applies pressure, you're too stiff.

## Training Drills
- **Hip Escape Fundamentals**: Practice solo hip escapes (shrimping) for 2-minute rounds, focusing on proper technique and maintaining shoulder over hip alignment. Build to 5 rounds with 1-minute rest between rounds. Progress to hip escaping while partner applies light pressure.

- **Frame and Re-Guard Drill**: Partner applies pressure from standing or kneeling position while you use frames to create space and establish guard. Start at 30% intensity and progress to 70% over multiple rounds. Focus on maintaining frames until guard is established, practicing 10 successful guard establishments per round.

- **Positional Escape Sparring**: Start from bottom position with opponent in guard passing position. Defender works to establish guard while passer tries to advance. 3-minute rounds with role switching. Focus on technical movement and position recovery rather than explosiveness.

- **Technical Standup Practice**: From bottom position, practice technical standup with partner providing progressive resistance from 0% to 60%. Focus on posting hand, positioning base leg, and creating safe distance. Perform 15 repetitions per side.

- **Bottom Survival Drill**: Partner applies heavy top pressure and passing attempts for 2-minute rounds while you focus purely on survival and guard recovery. This builds mental toughness and defensive confidence. Complete 5 rounds with 2-minute rest between rounds.

## Related States
- [[Closed Guard Bottom]] - Target position from bottom
- [[Open Guard Bottom]] - Alternative guard establishment
- [[Half Guard Bottom]] - Partial guard recovery
- [[Turtle Position]] - Defensive alternative
- [[Side Control]] - Position to avoid

## Related Positions
- [[Closed Guard Bottom]] - Primary target position
- [[Open Guard Bottom]] - Alternative guard type
- [[Half Guard Bottom]] - Intermediate recovery position
- [[Turtle Position]] - Defensive transition
- [[Standing Position]] - Escape target

## Decision Tree
If opponent attempting guard pass:
- Execute [[Create Open Guard]] → [[Open Guard Bottom]] (Probability: 60%)
- Or Execute [[Half Guard Recovery]] → [[Half Guard Bottom]] (Probability: 60%)

Else if space available to stand:
- Execute [[Technical Standup]] → [[Standing Position]] (Probability: 45%)
- Or Execute [[Hip Escape to Guard]] → [[Guard Position]] (Probability: 55%)

Else if opponent establishing control:
- Execute [[Hip Escape to Guard]] → [[Guard Position]] (Probability: 50%)
- Or Transition to [[Turtle Position]] → [[Turtle Position]] (Probability: 55%)

Else (Default - neutral scramble):
- Execute [[Establish Closed Guard]] → [[Closed Guard Bottom]] (Probability: 55%)
- Or Execute [[Create Open Guard]] → [[Open Guard Bottom]] (Probability: 60%)

## Position Metrics
- **Position Retention Rate**: Beginner 30%, Intermediate 50%, Advanced 70%
- **Advancement Probability**: Beginner 25%, Intermediate 45%, Advanced 65%
- **Submission Probability**: Beginner 15%, Intermediate 30%, Advanced 50%
- **Position Loss Probability**: Beginner 55%, Intermediate 40%, Advanced 25%
- **Average Time in Position**: 30 seconds to 2 minutes

## Optimal Submission Paths
**Guard establishment path:**
[[Bottom Position]] → [[Establish Closed Guard]] → [[Closed Guard Bottom]] → [[Submission from Guard]] → [[Won by Submission]]
*Reasoning: Most fundamental path - establish closed guard (55-75% success) then work systematic attacks from guard*

**Open guard path:**
[[Bottom Position]] → [[Create Open Guard]] → [[Open Guard Bottom]] → [[Sweep]] → [[Top Position]] → [[Submission]]
*Reasoning: Open guard provides more mobility (60-80% success), allowing sweeps to top position for submissions*

**Half guard recovery path:**
[[Bottom Position]] → [[Half Guard Recovery]] → [[Half Guard Bottom]] → [[Sweep or Back Take]] → [[Dominant Position]] → [[Submission]]
*Reasoning: Half guard is often easier to establish (60-80% success) and provides reliable sweep opportunities*

**Escape and reset path:**
[[Bottom Position]] → [[Technical Standup]] → [[Standing Position]] → [[Takedown]] → [[Top Position]] → [[Submission]]
*Reasoning: Sometimes standing and resetting (45-65% success) is more efficient than fighting from bottom, especially against larger opponents*

**Turtle transition path:**
[[Bottom Position]] → [[Turtle Position]] → [[Granby Roll or Back Defense]] → [[Guard Recovery]] → [[Submission Chain]]
*Reasoning: Turtle provides defensive platform (55-75% success) from which to work back to guard or create scrambles*
