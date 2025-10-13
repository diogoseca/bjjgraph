---
title: "Body Triangle Back Control | BJJ Position Guide | BJJ Graph"
description: "Master Body Triangle Back Control in BJJ. Complete guide covering leg triangle control from back position. Success rates: Beginner 60%, Intermediate 75%, Advanced 88%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S242
  position_name: "Body Triangle Back Control"
  alternative_names: ["Body Triangle", "Leg Triangle from Back", "Figure Four Back Control"]

  # Core Properties
  properties:
    point_value: 4
    position_type: "Offensive"
    risk_level: "Low"
    energy_cost: "Low"
    time_sustainability: "Very Long"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 60
      intermediate: 75
      advanced: 88
    advancement_probability:
      beginner: 65
      intermediate: 80
      advanced: 92
    submission_probability:
      beginner: 55
      intermediate: 70
      advanced: 85
    position_loss_probability:
      beginner: 25
      intermediate: 15
      advanced: 8
    average_time_in_position: "2-4 minutes"

  # State Machine Integration
  invariants:
    - "Back control position with hooks established"
    - "One leg triangle wrapped around opponent's torso"
    - "Opponent facing away with attacker on their back"

  # Available Transitions
  offensive_transitions:
    - technique: "Rear Naked Choke"
      target_state: "Won by Submission"
      transition_id: "T344"
      success_rate:
        beginner: 55
        intermediate: 70
        advanced: 85

    - technique: "Bow and Arrow Choke"
      target_state: "Won by Submission"
      transition_id: "T345"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

    - technique: "Armbar from Back"
      target_state: "Armbar Control"
      transition_id: "T072"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

    - technique: "Short Choke"
      target_state: "Won by Submission"
      transition_id: "T435"
      success_rate:
        beginner: 50
        intermediate: 65
        advanced: 80

    - technique: "Crucifix Transition"
      target_state: "Crucifix Position"
      transition_id: "T436"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 65

    - technique: "Back to Mount Transition"
      target_state: "Mount"
      transition_id: "T437"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

  defensive_responses:
    - technique: "Turn Into Guard"
      target_state: "Guard Position"
      success_rate: 12

    - technique: "Hand Fighting"
      target_state: "Back Control"
      success_rate: 20

    - technique: "Tuck Chin"
      target_state: "Back Control"
      success_rate: 25

    - technique: "Hip Escape to Turtle"
      target_state: "Turtle Position"
      success_rate: 15

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent's chin is exposed"
      options:
        - action: "Rear Naked Choke"
          target: "Won by Submission"
          probability: 70
        - action: "Short Choke"
          target: "Won by Submission"
          probability: 65

    - condition: "Opponent turns into you (defensive turn)"
      options:
        - action: "Bow and Arrow Choke"
          target: "Won by Submission"
          probability: 60
        - action: "Armbar from Back"
          target: "Armbar Control"
          probability: 55

    - condition: "Opponent hand fights aggressively"
      options:
        - action: "Crucifix Transition"
          target: "Crucifix Position"
          probability: 50
        - action: "Short Choke"
          target: "Won by Submission"
          probability: 65

    - condition: "Opponent remains defensive without movement"
      options:
        - action: "Rear Naked Choke"
          target: "Won by Submission"
          probability: 70
        - action: "Back to Mount Transition"
          target: "Mount"
          probability: 60

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 1.2
    defender_burn_rate: 4.5
    explosive_escape_multiplier: 5.5
    cooking_rate: 3.0

  # Related States
  related_states:
    - "Back Control"
    - "Rear Naked Choke Control"
    - "Crucifix Position"
    - "Mount"
    - "Armbar Control"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Body Triangle Back Control in BJJ",
  "description": "Complete guide to executing techniques and transitions from Body Triangle Back Control.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Body Triangle",
      "text": "From back control, thread one leg across opponent's torso and lock figure-four triangle around their body.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Secure Upper Body Control",
      "text": "Maintain seatbelt grip or collar control while body triangle controls lower body.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Execute Rear Naked Choke",
      "text": "When opponent's chin is exposed, slide arm under chin and secure rear naked choke.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Apply Bow and Arrow",
      "text": "If opponent turns defensively, switch to bow and arrow choke using gi grips.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Transition to Armbar",
      "text": "When opponent hand fights, isolate arm and transition to armbar from back.",
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
      "name": "What is a common mistake in Body triangle too tight on ribs?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Can cause injury to partner and actually reduces mobility for attacks. The correction is: Position triangle around waist/hips area, maintain firm but not crushing pressure, focus on control rather than pain compliance."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Neglecting upper body control?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to defend neck and potentially escape despite leg control. The correction is: Maintain active seatbelt or collar grips, constantly threaten chokes, use both upper and lower control together."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Crossing legs too high?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Reduces control effectiveness and can allow opponent to slide out. The correction is: Cross legs at hip level or slightly below, ensure tight connection across torso, adjust position based on opponent's size."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Static position without attacking?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to recover and defend, wastes dominant position opportunity. The correction is: Constantly threaten submissions, adjust angles for attacks, maintain offensive pressure throughout."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Losing control when opponent turns?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Misses opportunity for bow and arrow or other attacks, potentially loses back control. The correction is: Anticipate turns and adjust grips accordingly, use turn as submission opportunity, maintain body triangle throughout."
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
  "name": "Body Triangle Back Control",
  "description": "Master Body Triangle Back Control in BJJ. Complete guide covering leg triangle control from back position. Success rates: Beginner 60%, Intermediate 75%, Advanced 88%.",
  "url": "https://bjjgraph.com/positions/body-triangle-back-control",
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
      "name": "Body Triangle Back Control",
      "item": "https://bjjgraph.com/positions/body-triangle-back-control"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Body Triangle Back Control (S242) - Enhanced back control using leg triangle around opponent's torso. Elite finishing position worth 4 points. Extremely high retention and submission rates.

KEY_MECHANICS: Body triangle eliminates lower body movement, seatbelt controls upper body, figure-four leg lock provides sustained control. Frees hands for chokes while maintaining position.

STRATEGIC_VALUE: Superior to standard back control for position retention and finishing. Very low energy cost with extremely high opponent fatigue. Preferred finishing position for extended control.

COMMON_PATTERNS: Exposed chin → Rear naked choke. Defensive turn → Bow and arrow. Hand fighting → Crucifix/Short choke. Static defense → Multiple choke attempts.

SYSTEM_INTEGRATION: Peak of back control hierarchy, preferred position for high-level competitors, connects to multiple submission systems.
-->

# Body Triangle Back Control
#bjj #state #back-control #top #dominant #advanced

## State Properties
- **State ID**: S242
- **Point Value**: 4 (Back control points)
- **Position Type**: Offensive
- **Risk Level**: Low
- **Energy Cost**: Low
- **Time Sustainability**: Very Long

## State Description
Body Triangle Back Control is an advanced variation of back control where the attacker uses their legs to form a figure-four triangle lock around the opponent's torso, typically at the waist or hip level. This configuration provides superior control compared to traditional back control with hooks, as it eliminates the opponent's ability to use hip movement for escapes while freeing the attacker's hands to focus purely on submissions.

The body triangle is considered one of the most dominant positions in BJJ, offering exceptional control duration and submission success rates. It is particularly effective for smaller practitioners against larger opponents, as the mechanical advantage of the triangle lock neutralizes size differences.

### Visual Description
You are positioned on your opponent's back with one of your legs threaded across their torso at waist or hip level, with your ankle locked behind your opposite knee to form a figure-four triangle that encircles their body. Your other leg provides additional base and can adjust for angle and pressure. Your upper body maintains a seatbelt grip (one arm over shoulder, one under arm) or collar control in the gi, with your chest tight against their back and your head positioned near their shoulder or neck. Your hips are connected to their back with your weight distributed to prevent them from turning or escaping. The triangle provides constant compressive pressure around their torso while your arms are free to attack the neck with chokes. This configuration offers superior control compared to hook-based back control, as your legs are locked and cannot be easily stripped, and your hands are dedicated entirely to finishing submissions rather than maintaining position.

## Key Principles
- Lock body triangle at hip level for optimal control
- Maintain seatbelt or collar control for upper body
- Keep chest tight to back to prevent space creation
- Adjust triangle pressure based on submission setup
- Free hands focus on neck attacks and submissions
- Use triangle to control opponent's hip movement

## Prerequisites
- Solid back control fundamentals
- Understanding of rear naked choke mechanics
- Hip flexibility for triangle lock
- Awareness of body triangle positioning

## State Invariants
- Back control position with hooks established
- One leg triangle wrapped around opponent's torso
- Opponent facing away with attacker on their back

## Defensive Responses (When Opponent Has This State)
- [[Turn Into Guard]] → [[Guard Position]] (Success Rate: 12%)
- [[Hand Fighting]] → [[Back Control]] (Success Rate: 20%)
- [[Tuck Chin]] → [[Back Control]] (Success Rate: 25%)
- [[Hip Escape to Turtle]] → [[Turtle Position]] (Success Rate: 15%)

## Offensive Transitions (Available From This State)
- [[Rear Naked Choke]] → [[Won by Submission]] (Success Rate: Beginner 55%, Intermediate 70%, Advanced 85%)
- [[Bow and Arrow Choke]] → [[Won by Submission]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
- [[Armbar from Back]] → [[Armbar Control]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Short Choke]] → [[Won by Submission]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)
- [[Crucifix Transition]] → [[Crucifix Position]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Back to Mount Transition]] → [[Mount]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)

## Counter Transitions
- [[Triangle Adjustment]] → [[Body Triangle Back Control]] (maintaining optimal pressure)
- [[Submission Chain]] → [[Won by Submission]] (linking choke attempts)
- [[Position Maintenance]] → [[Body Triangle Back Control]] (defending escape attempts)

## Expert Insights
- **Danaher System**: Body triangle is mechanically superior to hooks for back control retention, as it cannot be stripped through standard hook removal techniques. Emphasizes locking the triangle at the hip level rather than ribs to avoid injury and maintain mobility for attacks. Views body triangle as the apex of positional hierarchy - once established, focus 100% on finishing rather than maintaining position. The systematic approach: establish triangle, secure seatbelt, attack neck relentlessly.
- **Gordon Ryan**: Body triangle is his preferred back control configuration in both gi and no-gi. Uses the triangle to create immense pressure that fatigues opponents, making choke defense progressively weaker over time. In competition, establishes body triangle early and methodically works through defensive layers, knowing the position is sustainable indefinitely. Key insight: once locked, never release triangle until submission or match end.
- **Eddie Bravo**: While 10th Planet system traditionally favored twister and truck positions, body triangle has become more prominent in no-gi competition due to its effectiveness. Emphasizes using the triangle to create angles for short chokes and using the leg pressure to break opponent's will. Views it as ultimate control position where time works entirely in attacker's favor.

## Common Errors
- **Error**: Body triangle too tight on ribs
  - **Consequence**: Can cause injury to partner and actually reduces mobility for attacks.
  - **Correction**: Position triangle around waist/hips area, maintain firm but not crushing pressure, focus on control rather than pain compliance.
- **Error**: Neglecting upper body control
  - **Consequence**: Allows opponent to defend neck and potentially escape despite leg control.
  - **Correction**: Maintain active seatbelt or collar grips, constantly threaten chokes, use both upper and lower control together.
- **Error**: Crossing legs too high
  - **Consequence**: Reduces control effectiveness and can allow opponent to slide out.
  - **Correction**: Cross legs at hip level or slightly below, ensure tight connection across torso, adjust position based on opponent's size.
- **Error**: Static position without attacking
  - **Consequence**: Allows opponent to recover and defend, wastes dominant position opportunity.
  - **Correction**: Constantly threaten submissions, adjust angles for attacks, maintain offensive pressure throughout.
- **Error**: Losing control when opponent turns
  - **Consequence**: Misses opportunity for bow and arrow or other attacks, potentially loses back control.
  - **Correction**: Anticipate turns and adjust grips accordingly, use turn as submission opportunity, maintain body triangle throughout.

## Training Drills
- **Body Triangle Entry from Back Control**: Practice transitioning from standard hooks to body triangle against progressive resistance (25%, 50%, 75%), focusing on smooth entry without losing upper body control.
- **Choke Combinations from Body Triangle**: Drill rear naked choke to short choke to bow and arrow sequences, learning to transition between submissions based on defensive reactions.
- **Triangle Retention Against Escapes**: Partner attempts various escape methods while you maintain body triangle, developing automatic adjustments and pressure management.
- **Position to Submission Flow**: Start from body triangle, work through hand fighting phases to achieve choke finish, simulating realistic defensive scenarios.
- **Bow and Arrow Setup from Triangle**: Specifically practice recognizing defensive turns and transitioning to bow and arrow choke with proper gi grips.

## Related States
- [[Back Control]] - Standard back control position
- [[Rear Naked Choke Control]] - Choke finishing position
- [[Crucifix Position]] - Alternative back attack position
- [[Mount]] - Alternative top control position
- [[Armbar Control]] - Arm submission position

## Related Positions

- [[Back Control]] - Parent position
- [[Rear Naked Choke Control]] - Primary finishing position
- [[Crucifix Position]] - Alternative back attack
- [[Technical Mount Top]] - Related control position
- [[Bow and Arrow Choke Control]] - Gi-specific finish

## Decision Tree
If opponent's chin is exposed:
- Execute [[Rear Naked Choke]] → [[Won by Submission]] (Probability: 70%)
- Or Execute [[Short Choke]] → [[Won by Submission]] (Probability: 65%)

Else if opponent turns into you (defensive turn):
- Execute [[Bow and Arrow Choke]] → [[Won by Submission]] (Probability: 60%)
- Or Execute [[Armbar from Back]] → [[Armbar Control]] (Probability: 55%)

Else if opponent hand fights aggressively:
- Execute [[Crucifix Transition]] → [[Crucifix Position]] (Probability: 50%)
- Or Execute [[Short Choke]] → [[Won by Submission]] (Probability: 65%)

Else (opponent remains defensive without movement):
- Execute [[Rear Naked Choke]] → [[Won by Submission]] (Probability: 70%)
- Or Execute [[Back to Mount Transition]] → [[Mount]] (Probability: 60%)

## Position Metrics
- **Position Retention Rate**: Beginner 60%, Intermediate 75%, Advanced 88%
- **Advancement Probability**: Beginner 65%, Intermediate 80%, Advanced 92%
- **Submission Probability**: Beginner 55%, Intermediate 70%, Advanced 85%
- **Position Loss Probability**: Beginner 25%, Intermediate 15%, Advanced 8%
- **Average Time in Position**: 2-4 minutes

## Optimal Submission Paths
Fastest submission path:
[[Body Triangle Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]

High-percentage choke sequence:
[[Body Triangle Back Control]] → [[Short Choke]] → [[Won by Submission]]

Gi-specific path:
[[Body Triangle Back Control]] → [[Bow and Arrow Choke]] → [[Won by Submission]]

Alternative limb attack path:
[[Body Triangle Back Control]] → [[Armbar from Back]] → [[Armbar Control]] → [[Won by Submission]]
