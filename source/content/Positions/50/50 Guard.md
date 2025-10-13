---
title: "50/50 Guard | BJJ Position Guide | BJJ Graph"
description: "Master 50/50 Guard in BJJ. Complete guide covering leg entanglements, control, and submissions from the symmetrical leg lock position. Success rates: Beginner 35%, Intermediate 55%, Advanced 75%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S096
  position_name: "50/50 Guard"
  alternative_names: ["5050 Guard", "Fifty-Fifty", "Straight Ashi Garami Variation"]

  # Core Properties
  properties:
    point_value: 2
    position_type: "Neutral with offensive options"
    risk_level: "High"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 35
      intermediate: 55
      advanced: 75
    advancement_probability:
      beginner: 30
      intermediate: 50
      advanced: 70
    submission_probability:
      beginner: 20
      intermediate: 40
      advanced: 65
    position_loss_probability:
      beginner: 45
      intermediate: 30
      advanced: 18
    average_time_in_position: "1-3 minutes"

  # State Machine Integration
  invariants:
    - "Symmetrical leg entanglement with both practitioners in mirrored positions"
    - "Each person's leg trapped across opponent's hip line"
    - "Both legs are entangled with opponent's leg"

  # Available Transitions
  offensive_transitions:
    - technique: "Straight Ankle Lock"
      target_state: "Won by Submission"
      transition_id: "T220"
      success_rate:
        beginner: 20
        intermediate: 40
        advanced: 65

    - technique: "Heel Hook from 50/50"
      target_state: "Won by Submission"
      transition_id: "T221"
      success_rate:
        beginner: 15
        intermediate: 35
        advanced: 60

    - technique: "Calf Slicer from 50/50"
      target_state: "Won by Submission"
      transition_id: "T222"
      success_rate:
        beginner: 12
        intermediate: 28
        advanced: 50

    - technique: "Backside 50/50 Transition"
      target_state: "Backside 50/50"
      transition_id: "T223"
      success_rate:
        beginner: 25
        intermediate: 45
        advanced: 65

    - technique: "Saddle Entry from 50/50"
      target_state: "Saddle Position"
      transition_id: "T224"
      success_rate:
        beginner: 18
        intermediate: 38
        advanced: 60

    - technique: "X-Guard Entry"
      target_state: "X-Guard"
      transition_id: "T225"
      success_rate:
        beginner: 22
        intermediate: 40
        advanced: 58

    - technique: "Single Leg X Entry"
      target_state: "Single Leg X Guard"
      transition_id: "T226"
      success_rate:
        beginner: 20
        intermediate: 38
        advanced: 55

  defensive_responses:
    - technique: "Clear Leg"
      target_state: "Top Position"
      success_rate: 35

    - technique: "Roll to Top 50/50"
      target_state: "Top 50/50"
      success_rate: 30

    - technique: "Backstep Exit"
      target_state: "Standing Position"
      success_rate: 25

    - technique: "Knee Shield Insertion"
      target_state: "Knee Shield Half Guard"
      success_rate: 20

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Clean control of opponent's foot"
      options:
        - action: "Straight Ankle Lock"
          target: "Won by Submission"
          probability: 40
        - action: "Transition to Heel Hook"
          target: "Won by Submission"
          probability: 35

    - condition: "Opponent exposes their heel"
      options:
        - action: "Heel Hook from 50/50"
          target: "Won by Submission"
          probability: 50
        - action: "Transition to Saddle"
          target: "Saddle Position"
          probability: 45

    - condition: "Stalemate or equal position"
      options:
        - action: "Backside 50/50 Transition"
          target: "Backside 50/50"
          probability: 45
        - action: "X-Guard Entry"
          target: "X-Guard"
          probability: 40

    - condition: "Opponent attempts to clear leg"
      options:
        - action: "Follow to Single Leg X"
          target: "Single Leg X Guard"
          probability: 38
        - action: "Maintain 50/50"
          target: "50/50 Guard"
          probability: 30

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 2.5
    defender_burn_rate: 2.5
    explosive_escape_multiplier: 4.0
    cooking_rate: 1.8

  # Related States
  related_states:
    - "Backside 50/50"
    - "Saddle Position"
    - "Ashi Garami"
    - "X-Guard"
    - "Single Leg X Guard"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use 50/50 Guard in BJJ",
  "description": "Complete guide to executing techniques and transitions from 50/50 Guard position.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Leg Entanglement",
      "text": "Create symmetrical leg entanglement where both legs are intertwined with opponent's leg across hip line.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Control Opponent's Foot",
      "text": "Secure control of opponent's foot and ankle while preventing them from controlling yours.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Execute Straight Ankle Lock",
      "text": "From this position, execute Straight Ankle Lock by securing opponent's foot to your hip and extending.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Heel Hook Option",
      "text": "If opponent exposes their heel, transition to Heel Hook for powerful rotational submission.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Backside Transition",
      "text": "If stalemate occurs, transition to Backside 50/50 by inverting under opponent's legs.",
      "position": 5
    },
    {
      "@type": "HowToStep",
      "name": "Saddle Entry",
      "text": "Elevate opponent's trapped leg higher to enter Saddle Position for increased control and submission options.",
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
      "name": "What is a common mistake in Equal or passive positioning?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Creates stalemate where neither person can advance, resulting in referee standup or wasted energy. The correction is: Actively work to break symmetry by controlling opponent's foot, elevating their leg, or transitioning to superior positions."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Loose leg control?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to easily extract their leg or reverse position, losing your positional advantage. The correction is: Keep your legs tightly locked around opponent's leg with active squeeze pressure, maintaining constant connection throughout."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Ignoring opponent's grips?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Permits opponent to control your foot and ankle, setting up their own submissions effectively. The correction is: Fight for superior grips on opponent's foot while denying their attempts to control yours, establishing grip dominance."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Attempting illegal techniques?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Results in disqualification or penalties in competition depending on ruleset and belt level. The correction is: Know the legal submissions for your ruleset - heel hooks typically illegal in gi and at lower belt levels in IBJJF."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in Poor hip positioning?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Reduces submission leverage and allows opponent to clear the position or establish superior control. The correction is: Keep your hips mobile and positioned perpendicular to opponent's hip line, maximizing your leverage for leg attacks."
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
  "name": "50/50 Guard",
  "description": "Master 50/50 Guard in BJJ. Complete guide covering leg entanglements, control, and submissions from the symmetrical leg lock position. Success rates: Beginner 35%, Intermediate 55%, Advanced 75%.",
  "url": "https://bjjgraph.com/positions/50-50-guard",
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
      "name": "50/50 Guard",
      "item": "https://bjjgraph.com/positions/50-50-guard"
    }
  ]
}
</script>


<!-- LLM CONTEXT BLOCK - For AI/Game Engine Consumption -->
<!--
POSITION_SUMMARY: 50/50 Guard (S096) - Symmetrical leg entanglement position where both practitioners mirror each other's leg configuration. Neutral scoring with high technical requirement. Controversial position due to potential stalemate tendency.

KEY_MECHANICS: Mirrored leg entanglement creates equal positional risk. Foot control determines offensive advantage. Hip positioning enables submission entries. Breaking symmetry is key to success.

STRATEGIC_VALUE: High-level position requiring specialized training. Scales dramatically with technical knowledge. Risk/reward ratio makes it divisive - high submission potential but equal exposure. Modern leg lock game cornerstone.

COMMON_PATTERNS: Clean foot control → Straight ankle or heel hook. Exposed heel → Heel hook finish. Stalemate → Backside 50/50 or X-Guard transition. Leg clear attempt → Follow to Single Leg X.

SYSTEM_INTEGRATION: Core of Danaher leg lock system, integral to modern no-gi meta-game, connects to full leg entanglement game developed by Garry Tonon and Gordon Ryan.
-->

# 50/50 Guard
#bjj #state #guard #leg-entanglement #leg-locks

## State Properties
- **State ID**: S096
- **Point Value**: 2 (Guard position - 2 points for guard player if swept from standing)
- **Position Type**: Neutral with offensive options
- **Risk Level**: High
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
The 50/50 Guard is a symmetrical leg entanglement position where both practitioners mirror each other with their legs intertwined, each person's leg positioned across the opponent's hip line. Named for the theoretically equal positioning of both competitors, this position represents one of the most technical and controversial positions in modern Brazilian Jiu-Jitsu due to its potential for both high-level leg attacks and strategic stalemates.

In the 50/50 Guard, both people occupy essentially the same position - each has one leg trapped across the opponent's hips while the other leg triangles around the opponent's trapped leg. This symmetry creates unique strategic dynamics where small positional advantages become magnified. The position gained prominence in the 2000s and 2010s through practitioners like the Mendes brothers and later the Danaher Death Squad, who demonstrated its effectiveness as both a control position and a submission platform.

The position's reputation is divided: traditionalists view it as a stalling position that can lead to referee standups, while modern leg lock specialists recognize it as a highly technical position with multiple submission entries and transition opportunities. Success in 50/50 requires understanding subtle grip fighting, hip positioning, and the ability to recognize and exploit momentary advantages. Under IBJJF rules, certain submissions from this position are restricted by belt level, making it crucial to understand both technical execution and competitive legality.

### Visual Description
Both you and your opponent are lying on your sides or slightly on your backs, facing each other with your legs symmetrically entangled in a mirrored configuration. Your right leg (assuming standard right-sided 50/50) extends across your opponent's hip and outside of their body, while your left leg threads inside their legs, hooking around their right leg with your foot positioned near or behind their hip. Your opponent's leg configuration mirrors yours exactly, creating a locked position where neither person can easily extract their leg without the other's cooperation or a technical advantage.

Your upper bodies may be upright or lying back depending on the stage of attack, with your hands fighting for control of each other's feet, ankles, and toes to set up leg attacks. Hip positioning is crucial - your hips should be mobile and perpendicular to your opponent's centerline to maximize leverage for submissions. The trapped leg between you creates a natural barrier and control point, while the outside leg provides leverage and control of your opponent's hip. Both practitioners are equally at risk of ankle locks, heel hooks (in no-gi), and other leg attacks, making grip fighting and positional awareness paramount in this symmetrical battleground.

## Key Principles
- **Break Symmetry First**: Success comes from creating asymmetrical advantages through superior foot control, hip positioning, or leg elevation
- **Active Engagement Required**: Passive play leads to stalemate and referee intervention; constantly threaten submissions or transitions
- **Foot Control Hierarchy**: Controlling opponent's foot while preventing their control of yours is the primary strategic goal
- **Hip Mobility**: Mobile hips allow you to create angles for submissions and prevent opponent's attacks
- **Grip Fighting Dominance**: Superior grips on opponent's foot and ankle enable submission entries and prevent their offense
- **Transition Sensitivity**: Recognize when direct submissions aren't available and seamlessly flow to superior positions like Saddle or Backside 50/50

## Prerequisites
- Understanding of leg lock mechanics and safety
- Knowledge of legal techniques for your competition ruleset
- Hip flexibility for leg entanglement
- Grip fighting fundamentals
- Experience with leg control positions

## State Invariants
- Symmetrical leg entanglement with both practitioners in mirrored positions
- Each person's leg trapped across opponent's hip line
- Both legs are entangled with opponent's leg

## Defensive Responses (When Opponent Has This State Against You)
- [[Clear Leg]] → [[Top Position]] (Success Rate: 35%)
- [[Roll to Top 50/50]] → [[Top 50/50]] (Success Rate: 30%)
- [[Backstep Exit]] → [[Standing Position]] (Success Rate: 25%)
- [[Knee Shield Insertion]] → [[Knee Shield Half Guard]] (Success Rate: 20%)

## Offensive Transitions (Available From This State)
- [[Straight Ankle Lock]] → [[Won by Submission]] (Success Rate: Beginner 20%, Intermediate 40%, Advanced 65%)
- [[Heel Hook from 50/50]] → [[Won by Submission]] (Success Rate: Beginner 15%, Intermediate 35%, Advanced 60%)
- [[Calf Slicer from 50/50]] → [[Won by Submission]] (Success Rate: Beginner 12%, Intermediate 28%, Advanced 50%)
- [[Backside 50/50 Transition]] → [[Backside 50/50]] (Success Rate: Beginner 25%, Intermediate 45%, Advanced 65%)
- [[Saddle Entry from 50/50]] → [[Saddle Position]] (Success Rate: Beginner 18%, Intermediate 38%, Advanced 60%)
- [[X-Guard Entry]] → [[X-Guard]] (Success Rate: Beginner 22%, Intermediate 40%, Advanced 58%)
- [[Single Leg X Entry]] → [[Single Leg X Guard]] (Success Rate: Beginner 20%, Intermediate 38%, Advanced 55%)

## Counter Transitions
- [[Maintain 50/50]] → [[50/50 Guard]] (when opponent attempts to clear)
- [[Backside Re-entry]] → [[Backside 50/50]] (when opponent attempts to pass)
- [[Submission Chain]] → [[Won by Submission]] (linking multiple leg attacks)

## Expert Insights
**John Danaher**: "The 50/50 position represents a fascinating study in asymmetry within symmetry. While the position appears equal, small advantages in foot control, hip positioning, and leg elevation create decisive offensive opportunities. The key principle is understanding that the 50/50 is not a destination but rather a gateway to superior positions - specifically the Saddle position (also called 411 or honey hole). When someone achieves clean foot control in the 50/50, they have a mechanical advantage that, when properly exploited through hip movement and leg elevation, leads to the strongest leg attack position in grappling."

**Gordon Ryan**: "In competition, I use the 50/50 as a control position that forces opponents into bad decisions. Most people either stall in 50/50 or try to clear it desperately, both of which play into my strategy. I'm constantly looking to transition to the Saddle position, which I consider far superior. The straight ankle lock from 50/50 is effective at lower levels, but against high-level opponents, I'm using it as a control position while working toward either heel hooks (in no-gi) or transitioning to X-Guard for sweeps. The position became controversial because people use it to stall, but that's not how it should be used - it's a transition hub."

**Eddie Bravo**: "At 10th Planet, we've integrated the 50/50 into our system, but we approach it differently than pure leg lockers. For us, it's often a transition position when attacking the truck or when coming back from inverted positions. We'll use the 50/50 as a temporary control position but we're always working toward either the calf slicer (in no-gi) or transitioning to the truck position where we have more submission options. The position is valuable but you can't be static - you have to constantly threaten and move, otherwise you're just giving the ref a reason to stand you up."

## Common Errors
- **Error**: Equal or passive positioning
  - **Consequence**: Creates stalemate where neither person can advance, resulting in referee standup or wasted energy.
  - **Correction**: Actively work to break symmetry by controlling opponent's foot, elevating their leg, or transitioning to superior positions.
  - **Recognition**: If both you and opponent are static for more than 10-15 seconds without attempting techniques, you're being too passive.

- **Error**: Loose leg control
  - **Consequence**: Allows opponent to easily extract their leg or reverse position, losing your positional advantage.
  - **Correction**: Keep your legs tightly locked around opponent's leg with active squeeze pressure, maintaining constant connection throughout.
  - **Recognition**: If you feel opponent's leg moving freely or creating space, tighten your leg triangle and hip connection.

- **Error**: Ignoring opponent's grips
  - **Consequence**: Permits opponent to control your foot and ankle, setting up their own submissions effectively.
  - **Correction**: Fight for superior grips on opponent's foot while denying their attempts to control yours, establishing grip dominance.
  - **Recognition**: If opponent secures clean grips on your foot while you have no grips on theirs, you've lost the grip battle.

- **Error**: Attempting illegal techniques
  - **Consequence**: Results in disqualification or penalties in competition depending on ruleset and belt level.
  - **Correction**: Know the legal submissions for your ruleset - heel hooks typically illegal in gi and at lower belt levels in IBJJF.
  - **Recognition**: Before training or competing, verify which leg locks are legal for your belt level and ruleset.

- **Error**: Poor hip positioning
  - **Consequence**: Reduces submission leverage and allows opponent to clear the position or establish superior control.
  - **Correction**: Keep your hips mobile and positioned perpendicular to opponent's hip line, maximizing your leverage for leg attacks.
  - **Recognition**: If you can't create pressure on opponent's foot or they can easily face you squarely, your hip angle is wrong.

- **Error**: Focusing only on leg attacks
  - **Consequence**: Misses transition opportunities to superior positions when leg attacks aren't immediately available.
  - **Correction**: Recognize when to transition to Saddle, Backside 50/50, or X-Guard based on opponent's defensive reactions.
  - **Recognition**: If you're stuck attempting the same submission repeatedly without success, it's time to transition.

- **Error**: Neglecting positional awareness
  - **Consequence**: Loses track of match position, time, or points, making tactical errors in competition.
  - **Correction**: Maintain awareness of score, time remaining, and position on the mat while fighting in 50/50.
  - **Recognition**: In competition, if you're winning on points, maintaining 50/50 may be strategic; if losing, you need to be more aggressive or transition.

## Training Drills
- **Grip Fighting from 50/50**: Start in established 50/50 and engage in isolated grip fighting for foot control, with partner defending at 60-70% intensity, performing 2-minute rounds with role switching. Focus on hand fighting patterns and grip breaking strategies while maintaining leg entanglement.

- **50/50 to Saddle Transitions**: Practice the transition from 50/50 to Saddle position by elevating opponent's trapped leg, drilling 15 repetitions on each side with partner offering moderate resistance (50%). Emphasize hip movement, leg elevation, and maintaining control throughout transition.

- **Symmetry Breaking Sequences**: Starting from equal 50/50, practice creating asymmetrical advantages through foot control, hip movement, or leg positioning, performing 20 total repetitions of different breaking methods. Focus on recognizing which method works best against different defensive postures.

- **Submission Chains from 50/50**: Drill flowing between straight ankle lock, calf slicer, and transitions to other positions based on opponent's reactions, completing 25 total transitions with partner defending at 40-60% intensity. Develop ability to recognize and exploit defensive movements.

- **Positional Sparring**: Start in 50/50 and engage in position-specific sparring where attacker works for submissions or positional advancement while defender works to clear or stalemate, 5-minute rounds with role switches. Emphasize active engagement and transition recognition.

- **Entry and Re-entry Sequences**: Practice entering 50/50 from various positions (X-Guard, Single Leg X, De La Riva) and re-establishing it when opponent attempts to clear, 10 repetitions from each starting position. Build ability to maintain leg entanglement game throughout dynamic exchanges.

## Related States
- [[Backside 50/50]] - Inverted variation with superior control
- [[Saddle Position]] - Superior leg entanglement position
- [[Ashi Garami]] - Related leg entanglement family
- [[X-Guard]] - Common transition target for sweeps
- [[Single Leg X Guard]] - Alternative leg control position

## Related Positions
- [[Saddle Position]] - Primary positional advancement target
- [[Backside 50/50]] - Strategic transition option
- [[X-Guard]] - Sweeping alternative
- [[Ashi Garami]] - Fundamental leg entanglement
- [[Heel Hook Control]] - Submission control position (no-gi)

## Decision Tree
If you have clean control of opponent's foot:
- Execute [[Straight Ankle Lock]] → [[Won by Submission]] (Probability: 40%)
- Or Transition to [[Heel Hook from 50/50]] → [[Won by Submission]] (Probability: 35%)

Else if opponent exposes their heel:
- Execute [[Heel Hook from 50/50]] → [[Won by Submission]] (Probability: 50%)
- Or Transition to [[Saddle Entry from 50/50]] → [[Saddle Position]] (Probability: 45%)

Else if stalemate or equal position:
- Execute [[Backside 50/50 Transition]] → [[Backside 50/50]] (Probability: 45%)
- Or Transition to [[X-Guard Entry]] → [[X-Guard]] (Probability: 40%)

Else if opponent attempts to clear leg:
- Follow to [[Single Leg X Entry]] → [[Single Leg X Guard]] (Probability: 38%)
- Or [[Maintain 50/50]] → [[50/50 Guard]] (Probability: 30%)

## Position Metrics
- **Position Retention Rate**: Beginner 35%, Intermediate 55%, Advanced 75%
- **Advancement Probability**: Beginner 30%, Intermediate 50%, Advanced 70%
- **Submission Probability**: Beginner 20%, Intermediate 40%, Advanced 65%
- **Position Loss Probability**: Beginner 45%, Intermediate 30%, Advanced 18%
- **Average Time in Position**: 1-3 minutes

## Optimal Submission Paths
**Direct submission path (no-gi legal):**
[[50/50 Guard]] → [[Heel Hook from 50/50]] → [[Won by Submission]]
*Reasoning: When heel is exposed and heel hooks are legal, this is highest percentage finish, success rate 35-60% depending on skill level*

**Positional advancement path:**
[[50/50 Guard]] → [[Saddle Entry from 50/50]] → [[Saddle Position]] → [[Heel Hook]] → [[Won by Submission]]
*Reasoning: Transitioning to Saddle creates superior control before finishing, success rate 38-60% for transition, 55-85% for finish from Saddle*

**Safe gi-legal path:**
[[50/50 Guard]] → [[Straight Ankle Lock]] → [[Won by Submission]]
*Reasoning: Legal at all belt levels in gi competition, success rate 20-65% depending on skill level*

**Sweep to dominance path:**
[[50/50 Guard]] → [[X-Guard Entry]] → [[X-Guard]] → [[Sweep to Top]] → [[Top Position]] → [[Mount]] → [[Submission]]
*Reasoning: When leg submissions aren't working, transitioning to sweeping game establishes positional dominance*

**System-based path (Danaher methodology):**
[[50/50 Guard]] → [[Saddle Entry from 50/50]] → [[Saddle Position]] → [[Inside Heel Hook]] → [[Won by Submission]]
*Reasoning: Systematic progression to strongest leg attack position before finishing, emphasis on positional hierarchy*

**Competition strategy path (when winning on points):**
[[50/50 Guard]] → Maintain position → Time expires → Win by points
*Reasoning: 50/50 can be used strategically to control match tempo and protect lead, though this is controversial approach*
