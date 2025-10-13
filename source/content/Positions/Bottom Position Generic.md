---
title: "Bottom Position Generic | BJJ Position Guide | BJJ Graph"
description: "Master Bottom Position fundamentals in BJJ. Complete guide covering defensive concepts, escape principles, and guard systems. Success rates: Beginner 35%, Intermediate 50%, Advanced 65%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S201
  position_name: "Bottom Position Generic"
  alternative_names: ["Bottom", "Underneath Position", "Defensive Position"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Defensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 35
      intermediate: 50
      advanced: 65
    advancement_probability:
      beginner: 30
      intermediate: 45
      advanced: 60
    submission_probability:
      beginner: 15
      intermediate: 25
      advanced: 40
    position_loss_probability:
      beginner: 55
      intermediate: 40
      advanced: 25
    average_time_in_position: "1-2 minutes"

  # State Machine Integration
  invariants:
    - "Bottom player on mat with top player applying pressure"
    - "Defensive frame or connection maintained"
    - "Bottom player working to improve position or escape"

  # Available Transitions
  offensive_transitions:
    - technique: "Guard Recovery"
      target_state: "Guard Position"
      transition_id: "T310"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

    - technique: "Hip Escape"
      target_state: "Guard Position"
      transition_id: "T311"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 65

    - technique: "Bridge and Roll"
      target_state: "Top Position"
      transition_id: "T312"
      success_rate:
        beginner: 25
        intermediate: 40
        advanced: 55

    - technique: "Technical Stand Up"
      target_state: "Standing Position"
      transition_id: "T313"
      success_rate:
        beginner: 30
        intermediate: 45
        advanced: 60

    - technique: "Submission from Bottom"
      target_state: "Submission Position"
      transition_id: "T314"
      success_rate:
        beginner: 15
        intermediate: 25
        advanced: 40

    - technique: "Sweep"
      target_state: "Top Position"
      transition_id: "T315"
      success_rate:
        beginner: 30
        intermediate: 45
        advanced: 60

  defensive_responses:
    - technique: "Maintain Pressure"
      target_state: "Top Control"
      success_rate: 55

    - technique: "Pass Guard"
      target_state: "Side Control"
      success_rate: 45

    - technique: "Submission Attack"
      target_state: "Submission Control"
      success_rate: 35

    - technique: "Advance Position"
      target_state: "Mount"
      success_rate: 30

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Space available for hip escape"
      options:
        - action: "Hip Escape to Guard"
          target: "Guard Position"
          probability: 55
        - action: "Technical Stand Up"
          target: "Standing Position"
          probability: 45

    - condition: "Top player overcommitted"
      options:
        - action: "Bridge and Roll"
          target: "Top Position"
          probability: 40
        - action: "Sweep Attempt"
          target: "Top Position"
          probability: 35

    - condition: "Guard frames established"
      options:
        - action: "Guard Recovery"
          target: "Guard Position"
          probability: 60

    - condition: "Default bottom position"
      options:
        - action: "Create Space and Escape"
          target: "Guard Position"
          probability: 45
        - action: "Frame and Shrimp"
          target: "Guard Position"
          probability: 40

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 3.0
    defender_burn_rate: 2.5
    explosive_escape_multiplier: 4.0
    cooking_rate: 1.8

  # Related States
  related_states:
    - "Guard Position"
    - "Side Control"
    - "Mount"
    - "Turtle Position"
    - "Half Guard Bottom"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Escape from Bottom Position in BJJ",
  "description": "Complete guide to defensive concepts and escape principles from bottom position.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Defensive Frames",
      "text": "Create frames with arms and legs to prevent opponent from settling into dominant control.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Create Space",
      "text": "Use bridge, shrimp, or hip movement to create space between you and opponent.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Insert Guard",
      "text": "Use created space to insert knee, hip, or leg to establish guard position.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Recover Guard",
      "text": "Complete guard recovery to establish defensive position with offensive potential.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Alternative: Technical Stand Up",
      "text": "If guard recovery blocked, use technical stand up to return to standing position.",
      "position": 5
    }
  ],
  "tool": [
    "BJJ Gi or No-Gi attire",
    "Training partner",
    "Mat space"
  ],
  "totalTime": "PT4M"
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the most important principle in bottom position?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Never stay flat. Staying flat eliminates your ability to create frames, generate movement, or escape. Always stay on your side or create angles to maintain defensive capability and escape options."
      }
    },
    {
      "@type": "Question",
      "name": "When should I bridge vs shrimp from bottom?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Bridge when opponent's weight is forward over you to create explosive space. Shrimp when you need lateral movement to create angles or when opponent's pressure is perpendicular to your body."
      }
    },
    {
      "@type": "Question",
      "name": "How do I prevent being submitted from bottom?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Maintain defensive awareness of submission threats, keep elbows tight to body, protect neck, and never extend arms into opponent's control. Priority is escaping position before submissions become available."
      }
    },
    {
      "@type": "Question",
      "name": "What are the key escape priorities from bottom?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "First priority: prevent submissions. Second: create frames and space. Third: escape to guard or standing. Fourth: attempt reversals if opponent overcommits."
      }
    },
    {
      "@type": "Question",
      "name": "Is it better to escape to guard or stand up?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Depends on rule set and energy levels. Guard recovery is typically higher percentage and offers offensive options. Standing is valuable in self-defense or when exhausted and needing to create distance."
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
  "name": "Bottom Position Generic",
  "description": "Master Bottom Position fundamentals in BJJ. Complete guide covering defensive concepts, escape principles, and guard systems. Success rates: Beginner 35%, Intermediate 50%, Advanced 65%.",
  "url": "https://bjjgraph.com/positions/bottom-position-generic",
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
      "name": "Bottom Position Generic",
      "item": "https://bjjgraph.com/positions/bottom-position-generic"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Bottom Position Generic (S201) - Fundamental defensive position where bottom player must work to escape, recover guard, or reverse. No points but high risk of conceding position or submission.

KEY_MECHANICS: Frame creation, space generation through bridging/shrimping, hip movement, weight distribution, defensive posture, escape timing, guard recovery principles.

STRATEGIC_VALUE: Universal defensive concepts applicable across all bottom positions. Foundation for all escapes and defensive techniques. Critical survival position requiring efficient energy management.

COMMON_PATTERNS: Space available → Hip Escape/Technical Stand Up. Opponent overcommitted → Bridge and Roll/Sweep. Guard frames established → Guard Recovery. Default → Create Space and Frame.

SYSTEM_INTEGRATION: Core defensive framework connecting to all specific bottom positions (side control bottom, mount bottom, turtle, etc.). Fundamental to Danaher escape hierarchies and self-defense applications.
-->

# Bottom Position Generic
#bjj #state #bottom #defensive #fundamentals

## State Properties
- **State ID**: S201
- **Point Value**: 0
- **Position Type**: Defensive
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
Bottom Position Generic represents the fundamental defensive state where one grappler is underneath another, requiring defensive awareness and escape mechanics. This is not a specific positional category but rather the conceptual framework for all bottom positions in BJJ. Understanding generic bottom position principles provides the foundation for defending and escaping from side control, mount, turtle, and other disadvantageous positions.

The bottom position is inherently defensive, requiring the bottom player to manage opponent pressure, prevent submissions, and work systematically toward improving position. Success depends on proper frame creation, space generation, hip movement, and timing. The bottom player must balance defensive security (preventing submissions and position advancement) with offensive action (creating escape opportunities and guard recovery).

Bottom Position Generic is disadvantageous but not hopeless. With proper technique, the bottom player can neutralize top pressure, create escape windows, and transition to guard or standing positions. Energy management is critical as the bottom position is typically more exhausting for the defender. Panic and explosive movements without technique waste energy and rarely succeed. Systematic, principled escapes offer the highest success rates across all skill levels.

### Visual Description
You are on your back or side on the mat with your opponent's weight pressing down from above, your body positioned to create frames with your arms and legs that prevent your opponent from settling into full control or attacking submissions. Your hips are active and mobile rather than flat against the mat, constantly creating small adjustments and angles that prevent your opponent from distributing their weight evenly across your body. Your arms are positioned between you and your opponent, creating barriers that protect your neck and torso while providing leverage points for generating space through bridging or shrimping movements. Your head is off the mat or turned away from pressure to maintain awareness and prevent neck attacks, while your legs work to create hooks, butterflies, or guard frames that offer defensive security and escape pathways. Your breathing is controlled despite the pressure, your movements are deliberate rather than panicked, and every action serves the purpose of creating the space and timing needed to recover guard, escape to standing, or reverse the position entirely.

## Key Principles
- **Never Stay Flat**: Staying flat eliminates movement options and defensive capability
- **Frame Early and Often**: Create frames before opponent settles into control
- **Generate Space Systematically**: Use bridge and shrimp mechanics to create incremental space
- **Protect Vital Targets**: Neck, arms, and legs must be defended from submission attacks
- **Move With Purpose**: Every movement should serve specific escape objective
- **Energy Conservation**: Efficient technique over explosive strength
- **Maintain Defensive Awareness**: Track opponent's weight distribution and submission threats constantly

## Prerequisites
- Basic bridging and shrimping mechanics
- Understanding of frame creation
- Hip mobility and core strength
- Defensive posture fundamentals

## State Invariants
- Bottom player on mat with top player applying pressure
- Defensive frame or connection maintained
- Bottom player working to improve position or escape

## Defensive Responses (When Opponent Has This State)
- [[Maintain Pressure]] → [[Top Control]] (Success Rate: 55%)
- [[Pass Guard]] → [[Side Control]] (Success Rate: 45%)
- [[Submission Attack]] → [[Submission Control]] (Success Rate: 35%)
- [[Advance Position]] → [[Mount]] (Success Rate: 30%)

## Offensive Transitions (Available From This State)
- [[Guard Recovery]] → [[Guard Position]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Hip Escape]] → [[Guard Position]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Bridge and Roll]] → [[Top Position]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 55%)
- [[Technical Stand Up]] → [[Standing Position]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)
- [[Submission from Bottom]] → [[Submission Position]] (Success Rate: Beginner 15%, Intermediate 25%, Advanced 40%)
- [[Sweep]] → [[Top Position]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)

## Counter Transitions
- [[Defensive Frame]] → [[Bottom Position]] (maintain against pressure)
- [[Emergency Escape]] → [[Guard Position]] (explosive escape under threat)
- [[Turtle Transition]] → [[Turtle Position]] (alternative defensive position)

## Expert Insights
- **John Danaher**: "Bottom position is about systematic problem solving under pressure. The hierarchy is clear: first, prevent submissions by protecting neck and limbs. Second, create frames to prevent position advancement. Third, generate space through bridging and shrimping. Fourth, escape to guard or standing. Most students fail because they skip steps—they try to escape without creating frames, or they panic and abandon technique for strength. The systematic approach may seem slower initially, but it's actually faster because each step succeeds before moving to the next. Bottom position is won through patience, precision, and persistence."

- **Gordon Ryan**: "I view bottom position as temporary and unacceptable. My goal is to spend as little time there as possible. The key is recognizing the escape window immediately—that split second when opponent's weight shifts or their base is compromised. When that window appears, commit fully to the escape. Don't wait for perfect conditions; perfect conditions rarely come. The escape window is usually small, and hesitation means missing it entirely. Train your bottom game primarily to get back to guard or standing where you can implement your actual game plan. Bottom position is not where I want to play, so I don't linger there."

- **Eddie Bravo**: "Bottom position requires creativity and flexibility. Traditional escapes work, but don't limit yourself to textbook movements. If you're flexible, use it—invert, spin, create weird angles that confuse your opponent. If you're strong, use explosive bridges and rolls. The best bottom players make their opponents uncomfortable and uncertain. Use unconventional grips, unusual frames, and unexpected timing. Turtle is your friend—don't be afraid to go there temporarily if it creates the escape window you need. Bottom game is about making your opponent think you're beaten while you're actually setting up your escape."

## Common Errors
- **Error**: Staying flat on back
  - **Consequence**: Eliminates ability to create frames, generate movement, or escape. Makes you vulnerable to pressure and submissions. Prevents proper defensive posture.
  - **Correction**: Always stay on your side or create angles. Use hip movement to prevent being flattened. Maintain active defensive posture even under pressure.
  - **Recognition**: If you feel completely pinned with no movement options, you've been flattened.

- **Error**: Panic and explosive thrashing
  - **Consequence**: Wastes enormous energy without achieving positional improvement. Often makes position worse by creating space for opponent to advance. Exhausts defender quickly.
  - **Correction**: Breathe, stay calm, and work systematic technique. Small, precise movements are more effective than large explosive ones. Save explosive energy for committed escape attempts.
  - **Recognition**: If you're breathing heavily after 20 seconds with no positional improvement, you're panicking.

- **Error**: Extending arms into opponent's control
  - **Consequence**: Creates armbar, kimura, and americana opportunities. Gives opponent easy control points and submission entries. Eliminates your framing capability.
  - **Correction**: Keep elbows tight to body. Frame with forearms, not straight arms. Never push opponent with extended arms—this is an invitation to be submitted.
  - **Recognition**: If opponent easily controls your wrists or attacks your arms, you've extended them improperly.

- **Error**: Ignoring submission threats while trying to escape
  - **Consequence**: Tapping out while attempting escape. Prioritizing positional improvement over survival leads to submission losses.
  - **Correction**: Always defend submissions first, escape second. If neck is attacked, forget the escape and defend. Re-evaluate escape plan after immediate submission threat is neutralized.
  - **Recognition**: If you're in immediate danger of tapping, you've missed a submission threat.

- **Error**: Using same escape attempt repeatedly
  - **Consequence**: Opponent learns your pattern and defends easily. Wastes energy on predictable attempts. Allows opponent to prepare counters.
  - **Correction**: Chain multiple escape attempts. If one fails, immediately transition to alternative. Use feints to create openings. Vary timing and direction.
  - **Recognition**: If opponent easily defends your escape multiple times, you've become predictable.

## Training Drills
- **Bridge and Shrimp Fundamentals**: Solo drill practicing bridge, shrimp, technical stand up in sequence. Focus on hip mobility and creating maximum space with minimum energy. 5 minutes daily for muscle memory development. Progress to partner adding light resistance.

- **Frame Creation Under Pressure**: Partner applies increasing pressure from side control or mount. Practice creating and maintaining frames while breathing calmly. Start at 25% pressure, progress to 75% over time. 2-minute rounds, focus on frame integrity. 5 rounds.

- **Escape Hierarchy Drill**: From disadvantaged position, practice defending submission first, then creating frames, then generating space, then escaping. Partner provides progressive resistance and submission threats. 3-minute rounds, multiple positions. 5 rounds.

- **Bottom Position Survival**: Partner has top control and applies constant pressure while you maintain defensive posture without escaping. Builds mental toughness, breathing control, and frame endurance. 3-minute rounds at 50% pressure. 3 rounds.

- **Escape Window Recognition**: Partner applies control but periodically creates small openings (weight shift, base adjustment, grip change). Practice recognizing and exploiting these windows immediately. Develops timing and awareness. 2-minute rounds, 5 rounds.

## Related States
- [[Guard Position]] - Primary escape target
- [[Side Control]] - Specific bottom position
- [[Mount]] - Specific bottom position
- [[Turtle Position]] - Alternative defensive position
- [[Half Guard Bottom]] - Transitional bottom position

## Related Positions

- [[Closed Guard Bottom]] - Specific guard bottom position
- [[Side Control]] - Common top position against bottom
- [[Mount]] - Dominant top position
- [[Turtle Position]] - Alternative defensive position
- [[Half Guard Bottom]] - Common bottom position

## Decision Tree
If space available for hip escape:
- Execute [[Hip Escape]] → [[Guard Position]] (Probability: 55%)
- Or Execute [[Technical Stand Up]] → [[Standing Position]] (Probability: 45%)

Else if top player overcommitted:
- Execute [[Bridge and Roll]] → [[Top Position]] (Probability: 40%)
- Or Execute [[Sweep Attempt]] → [[Top Position]] (Probability: 35%)

Else if guard frames established:
- Execute [[Guard Recovery]] → [[Guard Position]] (Probability: 60%)

Else (default bottom position):
- Create [[Space and Escape]] → [[Guard Position]] (Probability: 45%)
- Or Execute [[Frame and Shrimp]] → [[Guard Position]] (Probability: 40%)

## Position Metrics
- **Position Retention Rate**: Beginner 35%, Intermediate 50%, Advanced 65%
- **Advancement Probability**: Beginner 30%, Intermediate 45%, Advanced 60%
- **Submission Probability**: Beginner 15%, Intermediate 25%, Advanced 40%
- **Position Loss Probability**: Beginner 55%, Intermediate 40%, Advanced 25%
- **Average Time in Position**: 1-2 minutes

## Optimal Submission Paths
The shortest path to submission from this position:
[[Bottom Position]] → [[Submission from Bottom]] → [[Won by Submission]]

High-percentage path:
[[Bottom Position]] → [[Guard Recovery]] → [[Guard Position]] → [[Submission Attack]] → [[Won by Submission]]

Sweep to dominance path:
[[Bottom Position]] → [[Bridge and Roll]] → [[Top Position]] → [[Control and Submit]] → [[Won by Submission]]

Escape to standing path:
[[Bottom Position]] → [[Technical Stand Up]] → [[Standing Position]] → [[Takedown]] → [[Top Position]] → [[Won by Submission]]
