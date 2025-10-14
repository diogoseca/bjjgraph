---
title: "Pull Guard | BJJ Position Guide | BJJ Graph"
description: "Master pulling guard in BJJ. Complete guide covering entries, control establishment, and tactical guard pulling. Success rates: Beginner 50%, Intermediate 70%, Advanced 85%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S097
  position_name: "Pull Guard"
  alternative_names: ["Guard Pull", "Sitting to Guard", "Guard Entry"]

  # Core Properties
  properties:
    point_value: -2
    position_type: "Transitional to defensive/offensive"
    risk_level: "Medium"
    energy_cost: "Low"
    time_sustainability: "Instant"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 50
      intermediate: 70
      advanced: 85
    advancement_probability:
      beginner: 45
      intermediate: 65
      advanced: 80
    submission_probability:
      beginner: 10
      intermediate: 25
      advanced: 45
    position_loss_probability:
      beginner: 40
      intermediate: 25
      advanced: 12
    average_time_in_position: "Instant transition (0-2 seconds)"

  # State Machine Integration
  invariants:
    - "Deliberate choice to establish guard from standing"
    - "Concedes top position to opponent"
    - "Establishes guard configuration of practitioner's choice"

  # Available Transitions
  offensive_transitions:
    - technique: "closed guard top"
      target_state: "Closed Guard Bottom"
      transition_id: "T230"
      success_rate:
        beginner: 60
        intermediate: 75
        advanced: 90

    - technique: "Open Guard Pull"
      target_state: "Open Guard Bottom"
      transition_id: "T231"
      success_rate:
        beginner: 55
        intermediate: 70
        advanced: 85

    - technique: "De La Riva Guard Pull"
      target_state: "De La Riva Guard"
      transition_id: "T232"
      success_rate:
        beginner: 35
        intermediate: 60
        advanced: 80

    - technique: "X-Guard Pull"
      target_state: "X-Guard"
      transition_id: "T233"
      success_rate:
        beginner: 30
        intermediate: 55
        advanced: 75

    - technique: "Single Leg X Pull"
      target_state: "Single Leg X Guard"
      transition_id: "T234"
      success_rate:
        beginner: 32
        intermediate: 58
        advanced: 78

    - technique: "butterfly guard"
      target_state: "Butterfly Guard"
      transition_id: "T235"
      success_rate:
        beginner: 50
        intermediate: 68
        advanced: 82

    - technique: "spider guard"
      target_state: "Spider Guard"
      transition_id: "T236"
      success_rate:
        beginner: 40
        intermediate: 62
        advanced: 80

    - technique: "seated guard"
      target_state: "Seated Guard"
      transition_id: "T237"
      success_rate:
        beginner: 45
        intermediate: 65
        advanced: 80

  defensive_responses:
    - technique: "Sprawl and Pass"
      target_state: "Top Position"
      success_rate: 35

    - technique: "Backstep Pass"
      target_state: "Side Control"
      success_rate: 30

    - technique: "Knee Cut Pass"
      target_state: "Side Control"
      success_rate: 28

    - technique: "Stand and Clear"
      target_state: "Standing Position"
      success_rate: 25

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Standing engagement with grips established"
      options:
        - action: "Closed Guard Pull"
          target: "Closed Guard Bottom"
          probability: 75
        - action: "Open Guard Pull"
          target: "Open Guard Bottom"
          probability: 70

    - condition: "Opponent is aggressive and forward"
      options:
        - action: "De La Riva Guard Pull"
          target: "De La Riva Guard"
          probability: 60
        - action: "X-Guard Pull"
          target: "X-Guard"
          probability: 55

    - condition: "Gi grips on sleeves/collar"
      options:
        - action: "Spider Guard Pull"
          target: "Spider Guard"
          probability: 62
        - action: "Closed Guard Pull"
          target: "Closed Guard Bottom"
          probability: 75

    - condition: "No-gi or limited grips"
      options:
        - action: "Butterfly Guard Pull"
          target: "Butterfly Guard"
          probability: 68
        - action: "Seated Guard Pull"
          target: "Seated Guard"
          probability: 65

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 0.5
    defender_burn_rate: 1.0
    explosive_escape_multiplier: 2.0
    cooking_rate: 0.0

  # Related States
  related_states:
    - "Closed Guard Bottom"
    - "Open Guard Bottom"
    - "De La Riva Guard"
    - "X-Guard"
    - "Spider Guard"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Pull Guard in BJJ",
  "description": "Complete guide to executing guard pulls and establishing preferred guard positions.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Grips",
      "text": "Secure appropriate grips on opponent's collar, sleeves, or body to control their posture and balance.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Control Distance",
      "text": "Manage distance and timing to prevent opponent from establishing strong base before pull.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Execute Pull Motion",
      "text": "Sit to the mat while pulling opponent forward and controlling their posture with grips.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Establish Guard Configuration",
      "text": "Immediately establish chosen guard type (closed, open, spider, etc.) to prevent passing.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Control Opponent's Base",
      "text": "Use grips and leg positioning to break opponent's balance and prevent immediate passing attempts.",
      "position": 5
    },
    {
      "@type": "HowToStep",
      "name": "Begin Offensive Sequence",
      "text": "Transition immediately to sweeps, submissions, or advanced guard positions from established guard.",
      "position": 6
    }
  ],
  "tool": [
    "BJJ Gi or No-Gi attire",
    "Training partner",
    "Mat space"
  ],
  "totalTime": "PT2M"
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is a common mistake in Pulling without grips?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to immediately establish passing position or dominant control without resistance. The correction is: Always secure grips on collar, sleeves, or body before initiating guard pull to maintain control throughout transition."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Pulling too early or late?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Early pull gives opponent time to prepare defense; late pull allows them to establish dominant grips and base. The correction is: Time your pull when opponent is off-balance or moving forward, maximizing effectiveness of your pulling motion."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Landing on back without guard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Creates immediate passing opportunity for opponent, negating the purpose of guard pull entirely. The correction is: Establish guard configuration (closed legs, hooks, grips) simultaneously with landing to prevent immediate pass."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Weak or lazy guard pull?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Concedes top position without establishing effective guard, essentially giving opponent advantageous position. The correction is: Commit fully to guard pull with strong grips and immediate guard establishment, treating it as active technique not passive retreat."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Wrong guard choice for situation?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Pulling to guard that doesn't match your strengths or opponent's position creates disadvantageous starting point. The correction is: Choose guard type based on grips available, gi vs no-gi, opponent's stance, and your strongest guard game."
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
  "name": "Pull Guard",
  "description": "Master pulling guard in BJJ. Complete guide covering entries, control establishment, and tactical guard pulling. Success rates: Beginner 50%, Intermediate 70%, Advanced 85%.",
  "url": "https://bjjgraph.com/positions/pull-guard",
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
      "name": "Pull Guard",
      "item": "https://bjjgraph.com/positions/pull-guard"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: Pull Guard (S097) - Strategic transitional action where practitioner deliberately sits to guard from standing position. Concedes top position (minus 2 points in IBJJF) but establishes guard of choice. Fundamental to modern sport BJJ strategy.

KEY_MECHANICS: Grip establishment precedes pull. Timing relative to opponent's movement and balance. Simultaneous sitting and guard configuration establishment. Creates tactical trade of points for positional preference.

STRATEGIC_VALUE: Allows guard specialists to play their game without wrestling exchange. Conserves energy compared to takedown battles. Scales with technical guard knowledge. Controversial in some contexts but standard in modern competition.

COMMON_PATTERNS: Established grips → Pull to closed/open guard. Aggressive opponent → Pull to De La Riva or X-Guard. Gi grips → Pull to spider or collar sleeve. No-gi → Pull to butterfly or seated guard.

SYSTEM_INTEGRATION: Entry point to all guard systems. Essential for Mendes brothers' guard-based game, Miyao brothers' berimbolo game, Danaher guard retention systems. Modern sport BJJ cornerstone.
-->

# Pull Guard
#bjj #state #guard #entry #standing-to-ground

## State Properties
- **State ID**: S097
- **Point Value**: -2 (Concedes guard pull penalty in IBJJF rules)
- **Position Type**: Transitional to defensive/offensive
- **Risk Level**: Medium
- **Energy Cost**: Low
- **Time Sustainability**: Instant transition (0-2 seconds)

## State Description
Pull Guard is a deliberate tactical decision where a practitioner chooses to sit to the ground and establish guard position from standing, rather than engaging in the wrestling/judo phase of a match. This action concedes top position to the opponent (resulting in a 2-point penalty in IBJJF competition if not executed properly) but allows the guard puller to immediately establish their preferred guard configuration and begin their offensive game plan.

The guard pull represents a fundamental strategic choice in modern Brazilian Jiu-Jitsu competition. Rather than expending energy and taking risks in the standing phase, guard specialists choose to bring the match directly to their area of expertise - the guard game. This technique rose to prominence in the 2000s as guard-based games became increasingly sophisticated and effective at the highest levels of sport BJJ.

Executing a successful guard pull requires more than simply sitting down. It demands proper grip establishment, timing, and immediate guard configuration to prevent the opponent from passing or establishing dominant position. The best guard pullers make the transition seamlessly, landing in a guard that's already active and threatening, forcing the opponent to immediately address sweep and submission threats rather than capitalizing on the positional concession.

### Visual Description
You are standing face-to-face with your opponent, having established strategic grips on their collar, sleeves, belt, or body depending on your target guard configuration. As you initiate the pull, you sit to the mat in a controlled manner while simultaneously pulling your opponent forward and off-balance using your established grips. Your legs immediately come into play, wrapping around your opponent's waist for closed guard, hooking their legs for butterfly guard, or extending into their hips for open guard, depending on your chosen guard type.

During the transition, your body moves from upright standing to seated or supine on the mat within 1-2 seconds, while your grips maintain constant control to prevent your opponent from disengaging or establishing a strong passing position. Your legs actively establish the guard configuration rather than passively landing, creating immediate control and offensive threat. Your opponent is pulled into your guard space rather than being allowed to approach on their terms, and your body positioning is structured to begin your guard game immediately rather than needing to recover or establish position after landing.

## Key Principles
- **Grips Before Pull**: Establish controlling grips before sitting to maintain control throughout the transition
- **Timing with Movement**: Execute pull when opponent is moving forward or off-balance to maximize effectiveness
- **Immediate Guard Establishment**: Land with guard configuration already active, not requiring reorganization
- **Control Through Transition**: Maintain connection and control from standing through seated position
- **Strategic Choice**: Guard pull is tactical decision based on your strengths versus opponent's takedown ability
- **Commitment to Position**: Execute with full commitment to guard game rather than half-hearted attempt

## Prerequisites
- Established guard game proficiency
- Understanding of grip fighting
- Ability to fall safely to mat
- Knowledge of target guard configuration
- Competition rule awareness (point penalties)

## State Invariants
- Deliberate choice to establish guard from standing
- Concedes top position to opponent
- Establishes guard configuration of practitioner's choice

## Defensive Responses (When Opponent Attempts This Against You)
- [[Sprawl and Pass]] → [[Top Position]] (Success Rate: 35%)
- [[Backstep Pass]] → [[Side Control]] (Success Rate: 30%)
- [[Knee Cut Pass]] → [[Side Control]] (Success Rate: 28%)
- [[Stand and Clear]] → [[Standing Position]] (Success Rate: 25%)

## Offensive Transitions (Available From This Action)
- [[Closed Guard Bottom]] → [[Closed Guard Bottom]] (Success Rate: Beginner 60%, Intermediate 75%, Advanced 90%)
- [[Open Guard Bottom]] → [[Open Guard Bottom]] (Success Rate: Beginner 55%, Intermediate 70%, Advanced 85%)
- [[De La Riva Guard]] → [[De La Riva Guard]] (Success Rate: Beginner 35%, Intermediate 60%, Advanced 80%)
- [[X-Guard]] → [[X-Guard]] (Success Rate: Beginner 30%, Intermediate 55%, Advanced 75%)
- [[Single Leg X Guard]] → [[Single Leg X Guard]] (Success Rate: Beginner 32%, Intermediate 58%, Advanced 78%)
- [[Butterfly Guard]] → [[Butterfly Guard]] (Success Rate: Beginner 50%, Intermediate 68%, Advanced 82%)
- [[Spider Guard]] → [[Spider Guard]] (Success Rate: Beginner 40%, Intermediate 62%, Advanced 80%)
- [[Seated Guard]] → [[Seated Guard]] (Success Rate: Beginner 45%, Intermediate 65%, Advanced 80%)

## Counter Transitions
- [[Pull Guard]] → Various guard types (after failed first attempt)
- [[Stand Back Up]] → [[Standing Position]] (if guard pull is defended)
- [[Guard Recovery]] → Target guard (if initially landed poorly)

## Expert Insights
**John Danaher**: "The guard pull represents a strategic choice that bypasses the wrestling exchange entirely. While traditionalists view this as avoiding a fundamental aspect of grappling, from a systematic perspective, it's simply choosing the most efficient path to your strongest position. The key is understanding that a guard pull must be executed as an offensive action, not a passive retreat. You should pull to a guard where you immediately threaten sweeps and submissions, forcing your opponent into defensive mode despite their nominally superior top position. The quality of your guard pull is measured not just by successfully reaching the ground, but by the immediate offensive pressure you create upon landing."

**Gordon Ryan**: "In competition, I pull guard strategically when facing strong wrestlers or when I know my guard game is superior to their passing game. The crucial factor is landing in a guard where you're immediately threatening - I prefer pulling to Single Leg X or Butterfly because both guards offer immediate sweep threats that prevent opponents from settling into passing position. Many people pull guard poorly, landing flat and allowing opponents to establish dominant passing grips. Instead, you should be pulling them into your guard system where you're already one step ahead in your attack sequence. The minus 2 points means nothing if you score a sweep immediately for plus 2, or even better, move directly to submissions."

**Eddie Bravo**: "At 10th Planet, we're known for our guard game, but the way we approach guard pulling is different. We're not just sitting down - we're pulling to specific positions that integrate with our rubber guard, lockdown, and truck systems. When I pull to closed guard, I'm already looking for Mission Control. When I pull to butterfly, I'm setting up for the Old School sweep. The guard pull isn't an end point, it's the beginning of a specific sequence that we've drilled thousands of times. That's why our students can pull guard and immediately threaten - they're not just getting to guard, they're getting to a specific point in their offensive system."

## Common Errors
- **Error**: Pulling without grips
  - **Consequence**: Allows opponent to immediately establish passing position or dominant control without resistance.
  - **Correction**: Always secure grips on collar, sleeves, or body before initiating guard pull to maintain control throughout transition.
  - **Recognition**: If opponent is standing freely after you land, you pulled without adequate grip control.

- **Error**: Pulling too early or late
  - **Consequence**: Early pull gives opponent time to prepare defense; late pull allows them to establish dominant grips and base.
  - **Correction**: Time your pull when opponent is moving forward or off-balance, maximizing effectiveness of your pulling motion.
  - **Recognition**: If opponent easily establishes passing position or you feel like you're pulling against strong resistance, timing was off.

- **Error**: Landing on back without guard
  - **Consequence**: Creates immediate passing opportunity for opponent, negating the purpose of guard pull entirely.
  - **Correction**: Establish guard configuration (closed legs, hooks, grips) simultaneously with landing to prevent immediate pass.
  - **Recognition**: If there's any delay between landing and establishing guard, you're vulnerable to passing.

- **Error**: Weak or lazy guard pull
  - **Consequence**: Concedes top position without establishing effective guard, essentially giving opponent advantageous position.
  - **Correction**: Commit fully to guard pull with strong grips and immediate guard establishment, treating it as active technique not passive retreat.
  - **Recognition**: If opponent is able to maintain upright posture or disengage from your guard easily, your pull was too weak.

- **Error**: Wrong guard choice for situation
  - **Consequence**: Pulling to guard that doesn't match your strengths or opponent's position creates disadvantageous starting point.
  - **Correction**: Choose guard type based on grips available, gi vs no-gi, opponent's stance, and your strongest guard game.
  - **Recognition**: If you land in a guard and don't know your next move, you chose the wrong guard for the situation.

- **Error**: Ignoring rule set implications
  - **Consequence**: Incurs point penalty (minus 2 in IBJJF) that could cost the match if not addressed through scoring sweeps or submissions.
  - **Correction**: Understand the point implications of guard pulling in your ruleset and plan immediate offensive actions to negate penalty.
  - **Recognition**: If you're losing matches by 2 points, your guard pull strategy may need adjustment or more aggressive follow-up.

- **Error**: Sitting back without pulling opponent
  - **Consequence**: Creates distance between you and opponent, allowing them to reset standing or establish dominant grips before engaging.
  - **Correction**: Pull opponent into your guard space actively, maintaining close contact and connection throughout the transition.
  - **Recognition**: If opponent is standing outside your guard after you sit, you sat back rather than pulled them in.

## Training Drills
- **Grip to Pull Sequences**: Practice establishing various grip configurations and pulling to different guard types, performing 20 repetitions of each guard pull variation (closed, open, spider, DLR, butterfly) with focus on smooth grip-to-pull transition.

- **Timed Guard Pull Response**: Partner stands in neutral stance, you have 2 seconds to establish grips and pull to active guard, partner then attempts to pass for 30 seconds. Perform 10 rounds, switching which guard type you pull to based on grips available.

- **Guard Pull Competition Simulation**: Start standing with partner, whoever pulls guard successfully must immediately threaten sweep or submission within 10 seconds. Emphasizes pulling to active guard rather than passive position. 5-minute rounds with point tracking.

- **Multiple Guard Pull Options**: From same starting grips, practice pulling to 3 different guard types to develop adaptability. Partner varies their response (forward pressure, backward movement, grip fighting) and you choose optimal guard pull. 15 total repetitions.

- **Landing Position Refinement**: Focus solely on the landing phase - how you position your body, where your legs go, which grips you maintain. Film yourself and analyze whether you land in active position or need to reorganize. 20 repetitions with progressive resistance.

- **Failed Pull Recovery**: Partner defends guard pull attempt (sprawl, backstep, etc.), you must recover guard or stand back up rather than accepting poor position. Develop ability to recognize and respond to failed pulls. 10 repetitions per defense type.

## Related States
- [[Closed Guard Bottom]] - Most common guard pull target
- [[Open Guard Bottom]] - Alternative guard pull destination
- [[De La Riva Guard]] - Advanced guard pull option
- [[X-Guard]] - Off-balancing guard pull target
- [[Spider Guard]] - Gi-specific guard pull destination

## Related Positions
- [[Standing Position]] - Starting position before pull
- [[Closed Guard Bottom]] - Primary target position
- [[Butterfly Guard]] - Alternative target position
- [[Single Leg X Guard]] - Sweep-focused target position
- [[Spider Guard]] - Gi-based control target position

## Decision Tree
If standing engagement with grips established:
- Execute [[Closed Guard Bottom]] → [[Closed Guard Bottom]] (Probability: 75%)
- Or Execute [[Open Guard Bottom]] → [[Open Guard Bottom]] (Probability: 70%)

Else if opponent is aggressive and forward:
- Execute [[De La Riva Guard]] → [[De La Riva Guard]] (Probability: 60%)
- Or Execute [[X-Guard]] → [[X-Guard]] (Probability: 55%)

Else if gi grips on sleeves/collar:
- Execute [[Spider Guard]] → [[Spider Guard]] (Probability: 62%)
- Or Execute [[Closed Guard Bottom]] → [[Closed Guard Bottom]] (Probability: 75%)

Else if no-gi or limited grips:
- Execute [[Butterfly Guard]] → [[Butterfly Guard]] (Probability: 68%)
- Or Execute [[Seated Guard]] → [[Seated Guard]] (Probability: 65%)

## Position Metrics
- **Position Retention Rate**: Beginner 50%, Intermediate 70%, Advanced 85%
- **Advancement Probability**: Beginner 45%, Intermediate 65%, Advanced 80%
- **Submission Probability**: Beginner 10%, Intermediate 25%, Advanced 45%
- **Position Loss Probability**: Beginner 40%, Intermediate 25%, Advanced 12%
- **Average Time in Position**: Instant transition (0-2 seconds)

## Optimal Paths from Guard Pull
**High-percentage sweep path:**
[[Pull Guard]] → [[Closed Guard Bottom]] → [[Hip Bump Sweep]] → [[Mount]] → [[Submission Chains]]
*Reasoning: Pulling to closed guard offers stable platform for high-percentage sweeps, success rate 60-90% for pull, 40-70% for sweep*

**Immediate sweep threat path:**
[[Pull Guard]] → [[Butterfly Guard]] → [[Butterfly Sweep]] → [[Top Position]] → [[Pass to Mount]]
*Reasoning: Butterfly guard provides immediate off-balancing and sweep opportunities upon landing, success rate 50-82% for pull, 45-75% for sweep*

**Advanced guard game path:**
[[Pull Guard]] → [[De La Riva Guard]] → [[Berimbolo]] → [[Back Control]] → [[Rear Naked Choke]]
*Reasoning: DLR pull enables modern back taking systems for advanced practitioners, pull success 35-80%, back take 30-65%*

**Point recovery path (after minus 2 penalty):**
[[Pull Guard]] → [[X-Guard]] → [[X-Guard Sweep]] → [[Top Position]] (+2 points, neutralizes penalty)
*Reasoning: X-Guard offers strong sweeping opportunities to immediately negate guard pull penalty, pull success 30-75%, sweep 40-70%*

**Submission from bottom path:**
[[Pull Guard]] → [[Closed Guard Bottom]] → [[Triangle Choke]] → [[Won by Submission]]
*Reasoning: Closed guard pull enables direct submission paths without needing to sweep first, success rate varies greatly by skill level*

**System-based path (Danaher methodology):**
[[Pull Guard]] → [[Single Leg X Guard]] → [[Technical Standup]] → [[Back Take]] → [[Rear Naked Choke]]
*Reasoning: Systematic progression using SLX as transitional position to standing and back attacks, pull success 32-78%, back take 35-60%*
