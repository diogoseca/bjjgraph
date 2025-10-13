---
title: "S-Mount Top | BJJ Position Guide | BJJ Graph"
description: "Master S-Mount Top in BJJ. Complete guide covering advanced mount control with isolated arm positioning. Success rates: Beginner 58%, Intermediate 73%, Advanced 87%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S243
  position_name: "S-Mount Top"
  alternative_names: ["S Mount", "Side Mount", "Modified High Mount"]

  # Core Properties
  properties:
    point_value: 4
    position_type: "Offensive"
    risk_level: "Very Low"
    energy_cost: "Very Low"
    time_sustainability: "Very Long"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 58
      intermediate: 73
      advanced: 87
    advancement_probability:
      beginner: 65
      intermediate: 80
      advanced: 93
    submission_probability:
      beginner: 60
      intermediate: 75
      advanced: 90
    position_loss_probability:
      beginner: 28
      intermediate: 18
      advanced: 9
    average_time_in_position: "30-90 seconds"

  # State Machine Integration
  invariants:
    - "One knee high near opponent's head"
    - "Other leg posted wide for base"
    - "Opponent's arm isolated between your legs"

  # Available Transitions
  offensive_transitions:
    - technique: "Armbar from S-Mount"
      target_state: "Armbar Control"
      transition_id: "T438"
      success_rate:
        beginner: 60
        intermediate: 75
        advanced: 90

    - technique: "Triangle from S-Mount"
      target_state: "Triangle Control"
      transition_id: "T439"
      success_rate:
        beginner: 50
        intermediate: 65
        advanced: 80

    - technique: "Americana from S-Mount"
      target_state: "Won by Submission"
      transition_id: "T440"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

    - technique: "Mounted Triangle"
      target_state: "Triangle Control"
      transition_id: "T441"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

    - technique: "Technical Mount Transition"
      target_state: "Technical Mount Top"
      transition_id: "T442"
      success_rate:
        beginner: 55
        intermediate: 70
        advanced: 85

    - technique: "Return to High Mount"
      target_state: "High Mount Top"
      transition_id: "T443"
      success_rate:
        beginner: 60
        intermediate: 75
        advanced: 88

  defensive_responses:
    - technique: "Arm Extraction"
      target_state: "Mount Bottom"
      success_rate: 10

    - technique: "Bridge and Turn"
      target_state: "Guard Recovery"
      success_rate: 8

    - technique: "Defensive Shell"
      target_state: "Mount Bottom"
      success_rate: 12

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent's arm fully isolated"
      options:
        - action: "Armbar from S-Mount"
          target: "Armbar Control"
          probability: 75
        - action: "Triangle from S-Mount"
          target: "Triangle Control"
          probability: 65

    - condition: "Opponent attempts arm extraction"
      options:
        - action: "Armbar from S-Mount"
          target: "Armbar Control"
          probability: 80
        - action: "Mounted Triangle"
          target: "Triangle Control"
          probability: 55

    - condition: "Opponent tucks arm defensively"
      options:
        - action: "Technical Mount Transition"
          target: "Technical Mount Top"
          probability: 70
        - action: "Americana from S-Mount"
          target: "Won by Submission"
          probability: 60

    - condition: "Opponent stable without escape attempts"
      options:
        - action: "Armbar from S-Mount"
          target: "Armbar Control"
          probability: 75
        - action: "Return to High Mount"
          target: "High Mount Top"
          probability: 75

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 1.0
    defender_burn_rate: 5.0
    explosive_escape_multiplier: 6.0
    cooking_rate: 3.5

  # Related States
  related_states:
    - "High Mount Top"
    - "Technical Mount Top"
    - "Armbar Control"
    - "Triangle Control"
    - "Mount"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use S-Mount Top in BJJ",
  "description": "Complete guide to executing techniques and transitions from S-Mount Top.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish S-Mount Position",
      "text": "From high mount, slide one knee high near opponent's head while isolating their arm between your legs.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Secure Wide Base",
      "text": "Post other leg wide for stability, creating strong base to prevent rolling.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Isolate the Arm",
      "text": "Trap opponent's arm between your legs, controlling it with your knees and hips.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Execute Armbar",
      "text": "Fall back for armbar, maintaining arm isolation and extending for submission.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Alternative Triangle Attack",
      "text": "If armbar defended, transition to mounted triangle by sliding leg over neck.",
      "position": 5
    }
  ],
  "tool": [
    "BJJ Gi or No-Gi attire",
    "Training partner",
    "Mat space"
  ],
  "totalTime": "PT3M"
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is a common mistake in Insufficient arm isolation?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to extract arm and defend submissions, reducing finish rate. The correction is: Ensure arm is fully trapped between your knees before attacking, maintain tight leg pressure throughout, adjust position if arm starts to slip."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Poor base with posted leg?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Creates vulnerability to rolling escapes, potentially losing dominant position. The correction is: Post outside leg wide and firmly, keep foot base strong, distribute weight to maintain balance while attacking."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Rushing the armbar?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gives opponent time to defend and escape, reduces success rate. The correction is: Take time to perfect position first, ensure arm is fully controlled, fall back smoothly with proper hip positioning."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Losing hip connection?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to create space and potentially escape position. The correction is: Keep hips tight to opponent's torso, maintain pressure throughout transition, use leg squeeze to eliminate space."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Not transitioning when defended?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Creates stalemate, wastes dominant position, allows opponent recovery time. The correction is: Chain attacks together, move to triangle or technical mount if armbar defended, maintain constant offensive pressure."
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
  "name": "S-Mount Top",
  "description": "Master S-Mount Top in BJJ. Complete guide covering advanced mount control with isolated arm positioning. Success rates: Beginner 58%, Intermediate 73%, Advanced 87%.",
  "url": "https://bjjgraph.com/positions/s-mount-top",
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
      "name": "S-Mount Top",
      "item": "https://bjjgraph.com/positions/s-mount-top"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: S-Mount Top (S243) - Elite mount variation with opponent's arm isolated. Highest armbar success rate of any position. Worth 4 mount points with extremely high finish probability.

KEY_MECHANICS: One knee high isolates arm, wide posted leg provides base, hip pressure maintains control. Arm trapped between legs eliminates most defensive options.

STRATEGIC_VALUE: Preferred finishing position for armbar specialists. Very high submission rates (60-90%) with minimal escape possibilities. Extremely low energy cost.

COMMON_PATTERNS: Isolated arm → Armbar. Arm extraction attempt → Accelerated armbar. Defensive tuck → Technical mount. Stable position → Armbar or triangle.

SYSTEM_INTEGRATION: Peak of mount progression, primary armbar entry in systematic approach, connects to triangle and technical mount.
-->

# S-Mount Top
#bjj #state #mount #top #dominant #advanced #armbar

## State Properties
- **State ID**: S243
- **Point Value**: 4 (Mount points)
- **Position Type**: Offensive
- **Risk Level**: Very Low
- **Energy Cost**: Very Low
- **Time Sustainability**: Very Long

## State Description
S-Mount Top is an advanced mount position where the attacker isolates one of the opponent's arms by positioning it between their legs while maintaining mount control. The position is named for the "S" shape formed by the attacker's body when viewed from the side. This configuration provides exceptional control for armbar attacks and represents one of the highest percentage finishing positions in BJJ.

The S-Mount is particularly effective because it simultaneously maintains mount control while pre-positioning for the armbar, essentially combining positional dominance with submission setup. Once established, the opponent has extremely limited defensive options and escape paths.

### Visual Description
You are positioned on top of your opponent with one knee slid high near their head or shoulder, while your other leg is posted wide to the side for base and stability. One of your opponent's arms is isolated and trapped between your legs, controlled by your knees and inner thighs. Your hips remain connected to their torso, with your weight distributed forward to maintain pressure and prevent bridges. Your upper body is upright or leaning slightly forward, with your hands free to control their free arm or prepare for the armbar transition. Your high knee creates a wedge that prevents them from extracting their trapped arm, while your posted leg provides a wide, stable base that makes rolling escapes nearly impossible. This asymmetric position gives you exceptional control over their isolated arm while maintaining all the benefits of mount control, creating a powerful platform for finishing armbars or transitioning to other submissions.

## Key Principles
- Isolate arm fully between legs before committing to finish
- Maintain wide base with posted leg to prevent rolls
- Keep hip pressure on opponent to eliminate space
- Control opponent's free arm to prevent defensive grips
- Transition smoothly between S-mount and armbar
- Use position to create multiple attack options

## Prerequisites
- Solid mount control fundamentals
- Understanding of armbar mechanics from mount
- Hip mobility for S-mount positioning
- Timing for arm isolation

## State Invariants
- One knee high near opponent's head
- Other leg posted wide for base
- Opponent's arm isolated between your legs

## Defensive Responses (When Opponent Has This State)
- [[Arm Extraction]] → [[Mount Bottom]] (Success Rate: 10%)
- [[Bridge and Turn]] → [[Guard Recovery]] (Success Rate: 8%)
- [[Defensive Shell]] → [[Mount Bottom]] (Success Rate: 12%)

## Offensive Transitions (Available From This State)
- [[Armbar from S-Mount]] → [[Armbar Control]] (Success Rate: Beginner 60%, Intermediate 75%, Advanced 90%)
- [[Triangle from S-Mount]] → [[Triangle Control]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)
- [[Americana from S-Mount]] → [[Won by Submission]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
- [[Mounted Triangle]] → [[Triangle Control]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Technical Mount Transition]] → [[Technical Mount Top]] (Success Rate: Beginner 55%, Intermediate 70%, Advanced 85%)
- [[Return to High Mount]] → [[High Mount Top]] (Success Rate: Beginner 60%, Intermediate 75%, Advanced 88%)

## Counter Transitions
- [[Arm Re-Isolation]] → [[S-Mount Top]] (maintaining arm trap)
- [[Submission Chain]] → [[Won by Submission]] (linking armbar to triangle)
- [[Position Reinforcement]] → [[S-Mount Top]] (adjusting base and control)

## Expert Insights
- **Danaher System**: S-Mount is the ideal launching pad for the armbar, as it combines positional control with submission setup in a single configuration. Emphasizes the importance of fully isolating the arm before committing to the armbar - patience here dramatically increases success rate. The systematic approach: establish high mount, bait arm extension, slide to S-mount isolating arm, perfect positioning, finish armbar. Each step must be complete before progressing to the next.
- **Gordon Ryan**: Uses S-mount as his primary armbar entry in both gi and no-gi. Views it as mechanically superior to other armbar setups because the arm is already controlled before starting the finishing motion. In competition, once S-mount is established, focuses entirely on perfecting the armbar setup rather than rushing - the position is so dominant that time is on the attacker's side.
- **Eddie Bravo**: While 10th Planet traditionally emphasizes back control, recognizes S-mount as exceptionally effective for no-gi armbar attacks. Uses the position to create psychological pressure - opponent knows the armbar is coming but has limited options to prevent it. Emphasizes chaining to mounted triangle if armbar is defended, maintaining offensive pressure throughout.

## Common Errors
- **Error**: Insufficient arm isolation
  - **Consequence**: Allows opponent to extract arm and defend submissions, reducing finish rate.
  - **Correction**: Ensure arm is fully trapped between your knees before attacking, maintain tight leg pressure throughout, adjust position if arm starts to slip.
- **Error**: Poor base with posted leg
  - **Consequence**: Creates vulnerability to rolling escapes, potentially losing dominant position.
  - **Correction**: Post outside leg wide and firmly, keep foot base strong, distribute weight to maintain balance while attacking.
- **Error**: Rushing the armbar
  - **Consequence**: Gives opponent time to defend and escape, reduces success rate.
  - **Correction**: Take time to perfect position first, ensure arm is fully controlled, fall back smoothly with proper hip positioning.
- **Error**: Losing hip connection
  - **Consequence**: Allows opponent to create space and potentially escape position.
  - **Correction**: Keep hips tight to opponent's torso, maintain pressure throughout transition, use leg squeeze to eliminate space.
- **Error**: Not transitioning when defended
  - **Consequence**: Creates stalemate, wastes dominant position, allows opponent recovery time.
  - **Correction**: Chain attacks together, move to triangle or technical mount if armbar defended, maintain constant offensive pressure.

## Training Drills
- **S-Mount Entry from High Mount**: Practice sliding to S-mount from various high mount positions (0%, 25%, 50% resistance), focusing on smooth arm isolation and base establishment.
- **Armbar Finish from S-Mount**: Drill complete armbar sequence from established S-mount, emphasizing proper hip positioning, arm control, and extension mechanics.
- **S-Mount to Triangle Transitions**: Practice recognizing armbar defenses and smoothly transitioning to mounted triangle, maintaining position throughout chain.
- **Base Maintenance Under Pressure**: Partner attempts bridges and rolls while you maintain S-mount, developing automatic base adjustments and weight distribution.
- **Multiple Attack Chains**: Flow between armbar, triangle, and technical mount from S-mount, learning to read defensive reactions and adapt attacks accordingly.

## Related States
- [[High Mount Top]] - Parent mount position
- [[Technical Mount Top]] - Alternative advanced mount
- [[Armbar Control]] - Primary finishing position
- [[Triangle Control]] - Alternative submission
- [[Mount]] - Standard mount position

## Related Positions

- [[High Mount Top]] - Entry position
- [[Armbar Control]] - Primary target
- [[Triangle Control]] - Alternative attack
- [[Technical Mount Top]] - Position variation
- [[Gift Wrap Position]] - Alternative control

## Decision Tree
If opponent's arm fully isolated:
- Execute [[Armbar from S-Mount]] → [[Armbar Control]] (Probability: 75%)
- Or Execute [[Triangle from S-Mount]] → [[Triangle Control]] (Probability: 65%)

Else if opponent attempts arm extraction:
- Execute [[Armbar from S-Mount]] → [[Armbar Control]] (Probability: 80%)
- Or Execute [[Mounted Triangle]] → [[Triangle Control]] (Probability: 55%)

Else if opponent tucks arm defensively:
- Execute [[Technical Mount Transition]] → [[Technical Mount Top]] (Probability: 70%)
- Or Execute [[Americana from S-Mount]] → [[Won by Submission]] (Probability: 60%)

Else (opponent stable without escape attempts):
- Execute [[Armbar from S-Mount]] → [[Armbar Control]] (Probability: 75%)
- Or Execute [[Return to High Mount]] → [[High Mount Top]] (Probability: 75%)

## Position Metrics
- **Position Retention Rate**: Beginner 58%, Intermediate 73%, Advanced 87%
- **Advancement Probability**: Beginner 65%, Intermediate 80%, Advanced 93%
- **Submission Probability**: Beginner 60%, Intermediate 75%, Advanced 90%
- **Position Loss Probability**: Beginner 28%, Intermediate 18%, Advanced 9%
- **Average Time in Position**: 30-90 seconds

## Optimal Submission Paths
Fastest armbar path:
[[S-Mount Top]] → [[Armbar from S-Mount]] → [[Armbar Control]] → [[Won by Submission]]

Alternative triangle path:
[[S-Mount Top]] → [[Triangle from S-Mount]] → [[Triangle Control]] → [[Won by Submission]]

Chained attack path:
[[S-Mount Top]] → [[Armbar from S-Mount]] → [[Triangle from S-Mount]] → [[Won by Submission]]

Position advancement path:
[[S-Mount Top]] → [[Technical Mount Transition]] → [[Technical Mount Top]] → [[Submissions]] → [[Won by Submission]]
