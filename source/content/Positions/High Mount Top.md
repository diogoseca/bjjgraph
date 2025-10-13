---
title: "High Mount Top | BJJ Position Guide | BJJ Graph"
description: "Master High Mount Top in BJJ. Complete guide covering advanced mount control, submissions, and dominance. Success rates: Beginner 55%, Intermediate 70%, Advanced 85%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S241
  position_name: "High Mount Top"
  alternative_names: ["High Mount", "Mount High Position", "Advanced Mount"]

  # Core Properties
  properties:
    point_value: 4
    position_type: "Offensive"
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
      beginner: 60
      intermediate: 75
      advanced: 90
    submission_probability:
      beginner: 50
      intermediate: 65
      advanced: 80
    position_loss_probability:
      beginner: 30
      intermediate: 20
      advanced: 10
    average_time_in_position: "1-2 minutes"

  # State Machine Integration
  invariants:
    - "Knees high near opponent's armpits or shoulders"
    - "Hips positioned on opponent's chest/upper torso"
    - "Weight distributed forward for maximum control"

  # Available Transitions
  offensive_transitions:
    - technique: "Ezekiel Choke"
      target_state: "Won by Submission"
      transition_id: "T428"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

    - technique: "Americana from High Mount"
      target_state: "Won by Submission"
      transition_id: "T429"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

    - technique: "Armbar from High Mount"
      target_state: "Armbar Control"
      transition_id: "T430"
      success_rate:
        beginner: 50
        intermediate: 65
        advanced: 80

    - technique: "Cross Collar Choke from Mount"
      target_state: "Won by Submission"
      transition_id: "T431"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

    - technique: "S-Mount Transition"
      target_state: "S-Mount Top"
      transition_id: "T432"
      success_rate:
        beginner: 55
        intermediate: 70
        advanced: 85

    - technique: "Technical Mount Transition"
      target_state: "Technical Mount Top"
      transition_id: "T433"
      success_rate:
        beginner: 50
        intermediate: 65
        advanced: 80

    - technique: "Gift Wrap Control"
      target_state: "Gift Wrap Position"
      transition_id: "T434"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

  defensive_responses:
    - technique: "Bridge and Roll"
      target_state: "Guard Recovery"
      success_rate: 15

    - technique: "Elbow Escape"
      target_state: "Half Guard Bottom"
      success_rate: 20

    - technique: "Frame and Shrimp"
      target_state: "Guard Recovery"
      success_rate: 18

    - technique: "Arm Trap Defense"
      target_state: "Mount Bottom"
      success_rate: 25

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent keeps arms extended/defensive"
      options:
        - action: "Armbar from High Mount"
          target: "Armbar Control"
          probability: 65
        - action: "S-Mount Transition"
          target: "S-Mount Top"
          probability: 70

    - condition: "Opponent frames against chest"
      options:
        - action: "Ezekiel Choke"
          target: "Won by Submission"
          probability: 60
        - action: "Gift Wrap Control"
          target: "Gift Wrap Position"
          probability: 60

    - condition: "Opponent tucks arms tight to body"
      options:
        - action: "Cross Collar Choke from Mount"
          target: "Won by Submission"
          probability: 60
        - action: "Technical Mount Transition"
          target: "Technical Mount Top"
          probability: 65

    - condition: "Opponent attempts bridge or escape"
      options:
        - action: "S-Mount Transition"
          target: "S-Mount Top"
          probability: 70
        - action: "Armbar from High Mount"
          target: "Armbar Control"
          probability: 65

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 1.5
    defender_burn_rate: 4.0
    explosive_escape_multiplier: 5.0
    cooking_rate: 2.5

  # Related States
  related_states:
    - "Mount"
    - "S-Mount Top"
    - "Technical Mount Top"
    - "Gift Wrap Position"
    - "Armbar Control"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use High Mount Top in BJJ",
  "description": "Complete guide to executing techniques and transitions from High Mount Top.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish High Mount",
      "text": "Walk your knees up towards opponent's armpits, raising your hips high on their chest.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Control Posture",
      "text": "Maintain upright posture with weight forward, controlling opponent's head and arms.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Execute Armbar",
      "text": "When opponent extends arms defensively, execute armbar transition to Armbar Control.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Apply Ezekiel Choke",
      "text": "If opponent frames, slide forearm under their neck for Ezekiel Choke submission.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Transition to S-Mount",
      "text": "For maximum control, transition to S-Mount by sliding knee up near opponent's head.",
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
      "name": "What is a common mistake in Sitting too low on hips?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Reduces control and allows easier bridge escapes, giving opponent space to recover guard. The correction is: Walk knees up towards armpits, positioning weight on upper chest/sternum area, eliminating leverage for bridges."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Leaning too far back?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Creates vulnerability to sweep attempts and reduces submission opportunities. The correction is: Maintain forward weight distribution with chest over opponent's chest, keeping base strong while maintaining offensive pressure."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Neglecting arm control?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to create frames and escape pathways, increasing defensive options. The correction is: Constantly control opponent's arms through grips, pressure, or isolation, limiting their defensive capabilities."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Telegraphing submission attempts?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gives opponent time to defend, reducing finish rate and potentially losing position. The correction is: Set up submissions through subtle movements, maintain multiple threats simultaneously, commit fully once opening appears."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Staying static without pressure?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to rest and plan escape, reduces finishing opportunities, creates stalemate. The correction is: Maintain constant pressure and movement, continuously threaten attacks, make opponent defend multiple options simultaneously."
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
  "name": "High Mount Top",
  "description": "Master High Mount Top in BJJ. Complete guide covering advanced mount control, submissions, and dominance. Success rates: Beginner 55%, Intermediate 70%, Advanced 85%.",
  "url": "https://bjjgraph.com/positions/high-mount-top",
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
      "name": "High Mount Top",
      "item": "https://bjjgraph.com/positions/high-mount-top"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: High Mount Top (S241) - Advanced mount position with knees high near opponent's armpits. Dominant offensive position worth 4 points. Extremely high submission rate and position retention.

KEY_MECHANICS: High knee placement eliminates bridge leverage, forward weight prevents escapes, arm control limits defense. Superior position for submissions with minimal escape options.

STRATEGIC_VALUE: Elite finishing position favored by advanced practitioners. Very high submission probability (50-80%) and retention rates (55-85%). Low energy cost with high opponent fatigue.

COMMON_PATTERNS: Extended arms → Armbar/S-Mount. Frames → Ezekiel/Gift Wrap. Tucked arms → Collar chokes. Bridge attempts → S-Mount transition.

SYSTEM_INTEGRATION: Peak of mount progression hierarchy, connects to S-mount and technical mount, primary finishing position in top game.
-->

# High Mount Top
#bjj #state #mount #top #dominant #advanced

## State Properties
- **State ID**: S241
- **Point Value**: 4 (Mount points)
- **Position Type**: Offensive
- **Risk Level**: Low
- **Energy Cost**: Low
- **Time Sustainability**: Long

## State Description
High Mount Top is an advanced variation of the mount position where the top player walks their knees up towards the opponent's armpits or shoulders, positioning their hips and weight high on the opponent's chest. This elevated position severely limits the bottom player's escape options while dramatically increasing submission opportunities.

The high mount represents the pinnacle of mount control, offering the highest submission rate of any mount variation while being extremely difficult to escape. The position is characterized by exceptional dominance and is often the preferred finishing position for elite grapplers.

### Visual Description
You are positioned on top of your opponent with your knees high near their armpits or shoulders, rather than at their sides as in standard mount. Your hips are elevated and positioned on their upper chest or sternum, with your weight distributed forward towards their head. Your feet may be crossed behind their back or positioned on the mat for base, depending on their escape attempts. Your upper body is upright or leaning slightly forward, with your chest over their chest, and your hands controlling their head, neck, or arms to limit their defensive options. Your knees are tight to their body, creating a wedge that eliminates the space needed for bridge escapes. This elevated position gives you exceptional control over their upper body while providing superior angles for armbars, chokes, and transitions to S-mount or technical mount.

## Key Principles
- Walk knees high to eliminate bridge leverage
- Maintain forward weight distribution for control
- Control opponent's arms to limit defensive frames
- Stay mobile and ready to transition with escape attempts
- Threaten multiple submissions simultaneously
- Use high position to create psychological pressure

## Prerequisites
- Solid mount control fundamentals
- Understanding of armbar mechanics
- Awareness of mount escape prevention
- Hip mobility for elevated positioning

## State Invariants
- Knees high near opponent's armpits or shoulders
- Hips positioned on opponent's chest/upper torso
- Weight distributed forward for maximum control

## Defensive Responses (When Opponent Has This State)
- [[Bridge and Roll]] → [[Guard Recovery]] (Success Rate: 15%)
- [[Elbow Escape]] → [[Half Guard Bottom]] (Success Rate: 20%)
- [[Frame and Shrimp]] → [[Guard Recovery]] (Success Rate: 18%)
- [[Arm Trap Defense]] → [[Mount Bottom]] (Success Rate: 25%)

## Offensive Transitions (Available From This State)
- [[Ezekiel Choke]] → [[Won by Submission]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
- [[Americana from High Mount]] → [[Won by Submission]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Armbar from High Mount]] → [[Armbar Control]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)
- [[Cross Collar Choke from Mount]] → [[Won by Submission]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
- [[S-Mount Transition]] → [[S-Mount Top]] (Success Rate: Beginner 55%, Intermediate 70%, Advanced 85%)
- [[Technical Mount Transition]] → [[Technical Mount Top]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)
- [[Gift Wrap Control]] → [[Gift Wrap Position]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)

## Counter Transitions
- [[Mount Retention]] → [[High Mount Top]] (maintaining position against escapes)
- [[Submission Chain]] → [[Won by Submission]] (linking multiple attacks)
- [[Position Advancement]] → [[S-Mount Top]] (improving control further)

## Expert Insights
- **Danaher System**: High mount is the optimal position for the mount attack sequence. Emphasizes that the elevated position eliminates the bottom player's most powerful escape (the bridge) while providing superior angles for arm attacks. Teaches systematic progression: maintain high mount, isolate arm, execute armbar or transition to S-mount based on defense. The key is patience combined with constant pressure.
- **Gordon Ryan**: Views high mount as the final checkpoint before submission. Prefers to transition immediately to S-mount when established, as it offers even greater control with similar submission options. In competition, uses high mount to break opponent's will - the psychological pressure of being so dominated often leads to mistakes or passive defense.
- **Eddie Bravo**: While 10th Planet system emphasizes back control over mount, recognizes high mount as extremely effective for submission hunting. Uses high mount as entry to gift wrap position and technical mount variations. Emphasizes staying active and mobile rather than static control - opponent's movements create submission openings.

## Common Errors
- **Error**: Sitting too low on hips
  - **Consequence**: Reduces control and allows easier bridge escapes, giving opponent space to recover guard.
  - **Correction**: Walk knees up towards armpits, positioning weight on upper chest/sternum area, eliminating leverage for bridges.
- **Error**: Leaning too far back
  - **Consequence**: Creates vulnerability to sweep attempts and reduces submission opportunities.
  - **Correction**: Maintain forward weight distribution with chest over opponent's chest, keeping base strong while maintaining offensive pressure.
- **Error**: Neglecting arm control
  - **Consequence**: Allows opponent to create frames and escape pathways, increasing defensive options.
  - **Correction**: Constantly control opponent's arms through grips, pressure, or isolation, limiting their defensive capabilities.
- **Error**: Telegraphing submission attempts
  - **Consequence**: Gives opponent time to defend, reducing finish rate and potentially losing position.
  - **Correction**: Set up submissions through subtle movements, maintain multiple threats simultaneously, commit fully once opening appears.
- **Error**: Staying static without pressure
  - **Consequence**: Allows opponent to rest and plan escape, reduces finishing opportunities, creates stalemate.
  - **Correction**: Maintain constant pressure and movement, continuously threaten attacks, make opponent defend multiple options simultaneously.

## Training Drills
- **High Mount Establishment**: Practice walking knees up from standard mount against progressive resistance (0%, 25%, 50%, 75%), focusing on maintaining balance and forward pressure throughout transition.
- **Submission Chains from High Mount**: Drill armbar to Ezekiel to collar choke sequences, practicing fluid transitions between attacks based on opponent's defensive reactions.
- **Mount Retention Against Escapes**: Partner attempts bridges and shrimps while you maintain high mount, developing sensitivity to escape attempts and automatic counters.
- **Position Transition Flow**: Flow between high mount, S-mount, and technical mount, learning to move seamlessly based on opponent's movements and defensive postures.
- **Arm Isolation Drills**: Practice different methods of isolating opponent's arms from high mount, developing multiple entry points for armbars and other attacks.

## Related States
- [[Mount]] - Standard mount position
- [[S-Mount Top]] - Advanced mount variation
- [[Technical Mount Top]] - Side-facing mount variation
- [[Gift Wrap Position]] - Arm control position
- [[Armbar Control]] - Submission control position

## Related Positions

- [[Mount]] - Parent position
- [[S-Mount Top]] - Natural progression
- [[Technical Mount Top]] - Alternative advancement
- [[Knee on Belly]] - Related top control
- [[North-South]] - Alternative top position

## Decision Tree
If opponent keeps arms extended/defensive:
- Execute [[Armbar from High Mount]] → [[Armbar Control]] (Probability: 65%)
- Or Execute [[S-Mount Transition]] → [[S-Mount Top]] (Probability: 70%)

Else if opponent frames against chest:
- Execute [[Ezekiel Choke]] → [[Won by Submission]] (Probability: 60%)
- Or Execute [[Gift Wrap Control]] → [[Gift Wrap Position]] (Probability: 60%)

Else if opponent tucks arms tight to body:
- Execute [[Cross Collar Choke from Mount]] → [[Won by Submission]] (Probability: 60%)
- Or Execute [[Technical Mount Transition]] → [[Technical Mount Top]] (Probability: 65%)

Else if opponent attempts bridge or escape:
- Execute [[S-Mount Transition]] → [[S-Mount Top]] (Probability: 70%)
- Or Execute [[Armbar from High Mount]] → [[Armbar Control]] (Probability: 65%)

## Position Metrics
- **Position Retention Rate**: Beginner 55%, Intermediate 70%, Advanced 85%
- **Advancement Probability**: Beginner 60%, Intermediate 75%, Advanced 90%
- **Submission Probability**: Beginner 50%, Intermediate 65%, Advanced 80%
- **Position Loss Probability**: Beginner 30%, Intermediate 20%, Advanced 10%
- **Average Time in Position**: 1-2 minutes

## Optimal Submission Paths
Fastest submission path:
[[High Mount Top]] → [[Ezekiel Choke]] → [[Won by Submission]]

High-percentage armbar path:
[[High Mount Top]] → [[Armbar from High Mount]] → [[Armbar Control]] → [[Won by Submission]]

Advanced control path:
[[High Mount Top]] → [[S-Mount Transition]] → [[S-Mount Top]] → [[Armbar]] → [[Won by Submission]]

Choke sequence path:
[[High Mount Top]] → [[Cross Collar Choke from Mount]] → [[Won by Submission]]
