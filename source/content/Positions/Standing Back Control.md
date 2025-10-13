---
title: "Standing Back Control | BJJ Position Guide | BJJ Graph"
description: "Master Standing Back Control in BJJ. Complete guide covering hooks, control, takedowns, and submissions. Success rates: Beginner 50%, Intermediate 65%, Advanced 80%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S200
  position_name: "Standing Back Control"
  alternative_names: ["Standing Back Take", "Standing Back Mount", "Vertical Back Control"]

  # Core Properties
  properties:
    point_value: 4
    position_type: "Offensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 50
      intermediate: 65
      advanced: 80
    advancement_probability:
      beginner: 55
      intermediate: 70
      advanced: 85
    submission_probability:
      beginner: 35
      intermediate: 50
      advanced: 70
    position_loss_probability:
      beginner: 45
      intermediate: 30
      advanced: 15
    average_time_in_position: "30-60 seconds"

  # State Machine Integration
  invariants:
    - "Both grapplers standing"
    - "Hooks in or body lock established from behind"
    - "Chest-to-back contact maintained"

  # Available Transitions
  offensive_transitions:
    - technique: "Rear Naked Choke"
      target_state: "Won by Submission"
      transition_id: "T301"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 70

    - technique: "Mat Return"
      target_state: "Back Control"
      transition_id: "T302"
      success_rate:
        beginner: 60
        intermediate: 75
        advanced: 85

    - technique: "Suplex Takedown"
      target_state: "Back Control"
      transition_id: "T303"
      success_rate:
        beginner: 30
        intermediate: 45
        advanced: 65

    - technique: "Body Lock Takedown"
      target_state: "Side Control"
      transition_id: "T304"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

    - technique: "Drag Down"
      target_state: "Turtle Top"
      transition_id: "T305"
      success_rate:
        beginner: 50
        intermediate: 65
        advanced: 80

    - technique: "Inside Trip"
      target_state: "Back Control"
      transition_id: "T306"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

  defensive_responses:
    - technique: "Hand Fighting"
      target_state: "Neutral Position"
      success_rate: 45

    - technique: "Sit to Guard"
      target_state: "Guard Position"
      success_rate: 40

    - technique: "Roll Forward"
      target_state: "Turtle Position"
      success_rate: 35

    - technique: "Base Widening"
      target_state: "Standing Position"
      success_rate: 30

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Opponent has weak base"
      options:
        - action: "Mat Return"
          target: "Back Control"
          probability: 75
        - action: "Inside Trip"
          target: "Back Control"
          probability: 70

    - condition: "Opponent defending choke"
      options:
        - action: "Suplex Takedown"
          target: "Back Control"
          probability: 65
        - action: "Drag Down"
          target: "Turtle Top"
          probability: 60

    - condition: "Opponent standing upright"
      options:
        - action: "Rear Naked Choke"
          target: "Won by Submission"
          probability: 50

    - condition: "Default standing control"
      options:
        - action: "Body Lock Takedown"
          target: "Side Control"
          probability: 60
        - action: "Mat Return"
          target: "Back Control"
          probability: 55

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 2.5
    defender_burn_rate: 3.0
    explosive_escape_multiplier: 4.5
    cooking_rate: 2.0

  # Related States
  related_states:
    - "Back Control"
    - "Turtle Top"
    - "Side Control"
    - "Neutral Position"
    - "Front Headlock"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use Standing Back Control in BJJ",
  "description": "Complete guide to executing takedowns and transitions from Standing Back Control.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Secure Body Lock",
      "text": "Establish chest-to-back contact with body lock or hooks while both grapplers are standing.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Control Opponent's Hips",
      "text": "Maintain tight connection to opponent's hips to prevent escape and establish control.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Execute Mat Return",
      "text": "Bring opponent to mat while maintaining back control for dominant position.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Apply Rear Naked Choke",
      "text": "If opponent's posture is upright, attack the neck with rear naked choke.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Finish Takedown",
      "text": "Complete takedown transition to secure back control on the mat.",
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
      "name": "What is a common mistake in Standing Back Control?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allowing opponent to widen their base gives them stability and makes takedowns difficult. The correction is: Stay tight to opponent's back and constantly attack their balance with trips or pulls."
      }
    },
    {
      "@type": "Question",
      "name": "When should I use Mat Return vs Suplex?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Mat Return is safer and higher percentage when opponent has weak base. Suplex is used when opponent is defending hands and you need explosive takedown."
      }
    },
    {
      "@type": "Question",
      "name": "How do I prevent the sit-down escape?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Maintain chest pressure and anticipate the sit by following them down while securing hooks or transitioning to turtle top control."
      }
    },
    {
      "@type": "Question",
      "name": "What are the key control points in Standing Back Control?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Body lock around waist or over-under control, chest-to-back pressure, hooks or inside position on legs, and head position over opponent's shoulder."
      }
    },
    {
      "@type": "Question",
      "name": "Is it better to finish standing or take to mat?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Taking to mat is generally higher percentage as it secures back control points. Standing choke is opportunistic when opponent's posture is upright and neck is exposed."
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
  "name": "Standing Back Control",
  "description": "Master Standing Back Control in BJJ. Complete guide covering hooks, control, takedowns, and submissions. Success rates: Beginner 50%, Intermediate 65%, Advanced 80%.",
  "url": "https://bjjgraph.com/positions/standing-back-control",
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
      "name": "Standing Back Control",
      "item": "https://bjjgraph.com/positions/standing-back-control"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Standing Back Control (S200) - Dominant offensive position where attacker has back control while both grapplers are standing. Worth 4 points and offers high submission/takedown potential but requires quick action.

KEY_MECHANICS: Chest-to-back pressure, body lock control, hook management, balance disruption through trips and pulls, neck attack opportunities when opponent upright.

STRATEGIC_VALUE: Transitional dominant position with multiple finishing options. Higher risk than mat back control but offers explosive takedown and submission opportunities. Time-sensitive position.

COMMON_PATTERNS: Weak base → Mat Return/Inside Trip. Defending hands → Suplex/Drag Down. Upright posture → Rear Naked Choke. Default → Body Lock Takedown.

SYSTEM_INTEGRATION: Connects to wrestling takedown systems, Danaher back attack system, submission-only competition strategies emphasizing standing finishes.
-->

# Standing Back Control
#bjj #state #back-control #standing #offensive

## State Properties
- **State ID**: S200
- **Point Value**: 4 (Back control points)
- **Position Type**: Offensive
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
Standing Back Control is a dominant offensive position where the attacker has secured back control while both grapplers remain on their feet. This position awards 4 points in IBJJF competition and provides excellent opportunities for both takedowns and submissions. The position requires active management as the standing nature makes it more dynamic and time-sensitive than mat-based back control.

The attacker maintains chest-to-back contact using either a body lock (arms around opponent's waist), over-under control, or hooks (legs inside opponent's legs). Control must be constant as the opponent has greater mobility to escape compared to ground-based back control. The position is often transitional, leading to either a controlled takedown to secure mat-based back control or an opportunistic standing submission.

Standing Back Control excels when the opponent is tired, has poor balance, or is focused on defending their neck. The position becomes risky if the attacker cannot quickly advance to a takedown or submission, as the opponent may find escape routes through hand fighting, sitting to guard, or explosive movements. Time management and decisive action are critical to maximizing success from this position.

### Visual Description
You are standing directly behind your opponent with your chest pressed tightly against their back, your arms wrapped around their waist in a body lock or controlling their upper body with an over-under grip, maintaining constant pressure to prevent them from turning to face you. Your head is positioned over one of their shoulders, allowing you to monitor their hands and attack the neck if available, while your hips stay connected to theirs to control their movement and balance. Your legs are positioned inside or outside of theirs depending on whether you have hooks established, with your weight distributed to maintain stability while disrupting their base through constant pressure and small adjustments. Your grip is locked tight with your hands clasped together at their centerline, eliminating space between your bodies and allowing you to drive them in any direction—forward for drag-downs, backward for suplexes, or sideways for trips. This creates a dominant position where every defensive movement the opponent makes can be countered with a takedown or submission attempt, forcing them to make difficult decisions under pressure while you control timing and direction.

## Key Principles
- **Chest Pressure**: Maintain constant chest-to-back pressure to prevent opponent from turning into you
- **Hip Connection**: Keep hips tight to opponent's hips to control their base and movement
- **Active Control**: Continuously attack balance through trips, pulls, and pressure changes
- **Neck Awareness**: Monitor neck exposure and attack when opponent defends takedowns
- **Quick Decision Making**: Position is transitional; commit to takedown or submission quickly
- **Base Management**: Maintain your own stable base while disrupting opponent's balance
- **Grip Security**: Body lock or control grips must be unbreakable to prevent escape

## Prerequisites
- Proper back take technique from standing
- Wrestling or judo takedown fundamentals
- Strong grip endurance for body lock maintenance
- Balance and base management skills

## State Invariants
- Both grapplers standing
- Hooks in or body lock established from behind
- Chest-to-back contact maintained

## Defensive Responses (When Opponent Has This State)
- [[Hand Fighting]] → [[Neutral Position]] (Success Rate: 45%)
- [[Sit to Guard]] → [[Guard Position]] (Success Rate: 40%)
- [[Roll Forward]] → [[Turtle Position]] (Success Rate: 35%)
- [[Base Widening]] → [[Standing Position]] (Success Rate: 30%)

## Offensive Transitions (Available From This State)
- [[Rear Naked Choke]] → [[Won by Submission]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 70%)
- [[Mat Return]] → [[Back Control]] (Success Rate: Beginner 60%, Intermediate 75%, Advanced 85%)
- [[Suplex Takedown]] → [[Back Control]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 65%)
- [[Body Lock Takedown]] → [[Side Control]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
- [[Drag Down]] → [[Turtle Top]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)
- [[Inside Trip]] → [[Back Control]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)

## Counter Transitions
- [[Hook Defense]] → [[Standing Back Control]] (maintain against escape attempts)
- [[Follow to Mat]] → [[Back Control]] (when opponent sits)
- [[Choke to Takedown]] → [[Back Control]] (chain attacks)

## Expert Insights
- **John Danaher**: "Standing back control is a critical transitional position that tests your ability to make rapid tactical decisions. The key is understanding that every second you remain standing without advancing position, you're losing control. Systematically attack the opponent's base through trips while simultaneously threatening the neck. The dilemma you create—defend the takedown or defend the choke—is what makes this position so powerful. Never allow the position to stall; movement creates opportunity."

- **Gordon Ryan**: "In competition, I use standing back control primarily as a takedown setup rather than a finishing position. The body lock is king here—once locked, the opponent has very limited options. I prefer the inside trip or mat return because they're high percentage and maintain back control on the ground. The standing RNC is there if they give it, but don't hunt for it at the expense of securing ground control. Points first, submission second."

- **Eddie Bravo**: "Standing back control is all about staying creative and unpredictable. Traditional wrestling takedowns work great, but don't be afraid to use unconventional attacks like the twister takedown or rotational throws. Keep your opponent guessing—if they expect a trip, hit a suplex; if they defend high, go low. The mental game is huge here because they're vulnerable and they know it. Use that fear to your advantage and stay aggressive."

## Common Errors
- **Error**: Allowing opponent to widen their base
  - **Consequence**: Gives opponent stability, making takedowns difficult and allowing them to defend more effectively. Wide base neutralizes your leverage advantages and makes it easier for them to hand fight.
  - **Correction**: Stay tight to opponent's back and constantly attack their balance with trips, pulls, or pressure changes. Keep them moving and off-balance so they cannot establish a wide, stable base.
  - **Recognition**: If opponent feels stable and you're not making progress on takedown attempts, their base is too wide.

- **Error**: Loosening body lock or grip
  - **Consequence**: Creates space for opponent to turn into you, strip your grips, or escape entirely. Loss of grip often means immediate position loss.
  - **Correction**: Maintain unbreakable grip with hands locked at centerline. Squeeze elbows together and keep chest pressure constant. Never let opponent create separation.
  - **Recognition**: If you feel opponent creating space between your bodies or starting to turn, your grip has loosened.

- **Error**: Stalling without attacking
  - **Consequence**: Opponent recovers, finds defensive solutions, and eventually escapes. Standing positions are energy-intensive and unsustainable without progression.
  - **Correction**: Immediately begin attacking with takedowns or submissions. Create movement and force opponent to make defensive choices under pressure.
  - **Recognition**: If more than 5-10 seconds pass without you attempting a technique, you're stalling.

- **Error**: Overcommitting to choke when takedown is available
  - **Consequence**: Wastes energy on low-percentage standing choke while higher-percentage takedown option exists. Can result in losing position entirely.
  - **Correction**: Prioritize securing mat-based back control first. Attack choke opportunistically when opponent defends takedowns and neck is exposed.
  - **Recognition**: If opponent's chin is tucked and hands are defending neck, takedown is better option.

- **Error**: Poor base management
  - **Consequence**: Makes you vulnerable to counter throws or reversal attempts. Can result in losing dominant position or being taken down yourself.
  - **Correction**: Maintain low center of gravity with knees slightly bent. Keep feet active and ready to step to maintain balance as opponent moves.
  - **Recognition**: If you feel off-balance or opponent is controlling your movement, your base is compromised.

## Training Drills
- **Mat Return Drill**: Start in standing back control with body lock. Practice smooth mat returns while maintaining hooks and back control. Begin at 0% resistance, progress to 50% where partner defends base but not aggressively, then 75% with active defense. Focus on hip control and timing the pull. 5 reps each side, 3 rounds.

- **Trip to Back Take Drill**: From standing back control, practice inside trips, outside trips, and reaps to take opponent down. Partner provides progressive resistance: 25% standing upright, 50% defending with base widening, 75% hand fighting and defending actively. Emphasize maintaining chest-to-back pressure through the takedown. 10 total trips per round, 3 rounds.

- **Choke or Takedown Decision Drill**: Partner randomly defends either neck or base. Practice recognizing which is exposed and attacking the available option. Builds decision-making speed and tactical awareness. 2-minute rounds, 5 rounds with different partners.

- **Body Lock Escape Defense Drill**: Partner attempts common escapes (sit to guard, hand fighting, base widening, forward roll). Practice maintaining position and countering each escape attempt with appropriate control adjustments or takedowns. 2-minute rounds per escape type.

- **Standing to Ground Back Control Flow**: Practice full sequence from standing back take → mat return → securing ground hooks → attacking choke. Focus on smooth transitions and maintaining control throughout. 5 full sequences per round, 3 rounds.

## Related States
- [[Back Control]] - Ground-based back control (primary target)
- [[Turtle Top]] - Common result from drag-down
- [[Side Control]] - Result from body lock throw
- [[Front Headlock]] - Counter position if opponent turns in
- [[Neutral Position]] - Reset if position is lost

## Related Positions

- [[Back Control]] - Primary target position on ground
- [[Turtle Top]] - Drag down result
- [[Side Control]] - Throw result
- [[Neutral Position]] - Escape destination
- [[Front Headlock]] - Transition if opponent turns

## Decision Tree
If opponent has weak base:
- Execute [[Mat Return]] → [[Back Control]] (Probability: 75%)
- Or Execute [[Inside Trip]] → [[Back Control]] (Probability: 70%)

Else if opponent defending choke:
- Execute [[Suplex Takedown]] → [[Back Control]] (Probability: 65%)
- Or Execute [[Drag Down]] → [[Turtle Top]] (Probability: 60%)

Else if opponent standing upright:
- Execute [[Rear Naked Choke]] → [[Won by Submission]] (Probability: 50%)

Else (default standing control):
- Execute [[Body Lock Takedown]] → [[Side Control]] (Probability: 60%)
- Or Execute [[Mat Return]] → [[Back Control]] (Probability: 55%)

## Position Metrics
- **Position Retention Rate**: Beginner 50%, Intermediate 65%, Advanced 80%
- **Advancement Probability**: Beginner 55%, Intermediate 70%, Advanced 85%
- **Submission Probability**: Beginner 35%, Intermediate 50%, Advanced 70%
- **Position Loss Probability**: Beginner 45%, Intermediate 30%, Advanced 15%
- **Average Time in Position**: 30-60 seconds

## Optimal Submission Paths
The shortest path to submission from this position:
[[Standing Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]

High-percentage path:
[[Standing Back Control]] → [[Mat Return]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]

Alternative takedown path:
[[Standing Back Control]] → [[Inside Trip]] → [[Back Control]] → [[Submission Chain]] → [[Won by Submission]]

Suplex to dominance path:
[[Standing Back Control]] → [[Suplex Takedown]] → [[Back Control]] → [[Bow and Arrow Choke]] → [[Won by Submission]]
