---
title: "Closed Guard Top Position | BJJ Position Guide | BJJ Graph"
description: "Master Closed Guard Top Position in BJJ. Complete guide covering passing strategies, posture, and defensive tactics from inside closed guard. Success rates: Beginner 35%, Intermediate 50%, Advanced 65%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S231
  position_name: "Closed Guard Top Position"
  alternative_names: ["Inside Closed Guard", "Guard Top", "Passing Position"]

  # Core Properties
  properties:
    point_value: 0
    position_type: "Defensive with passing focus"
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
      beginner: 40
      intermediate: 55
      advanced: 70
    submission_probability:
      beginner: 5
      intermediate: 10
      advanced: 15
    position_loss_probability:
      beginner: 55
      intermediate: 40
      advanced: 25
    average_time_in_position: "1-3 minutes"

  # State Machine Integration
  invariants:
    - "Opponent's legs wrapped around your waist or hips"
    - "You are positioned between opponent's guard with your torso trapped"
    - "Opponent controlling your posture or positioning"

  # Available Transitions
  offensive_transitions:
    - technique: "Standing Guard Break"
      target_state: "Open Guard Pass Position"
      transition_id: "T310"
      success_rate:
        beginner: 40
        intermediate: 60
        advanced: 75

    - technique: "Knee Cut Pass"
      target_state: "Side Control"
      transition_id: "T311"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 65

    - technique: "Toreando Pass"
      target_state: "Side Control"
      transition_id: "T312"
      success_rate:
        beginner: 30
        intermediate: 45
        advanced: 60

    - technique: "Stack Pass"
      target_state: "Side Control"
      transition_id: "T313"
      success_rate:
        beginner: 25
        intermediate: 40
        advanced: 55

    - technique: "Leg Drag"
      target_state: "Side Control"
      transition_id: "T314"
      success_rate:
        beginner: 20
        intermediate: 35
        advanced: 50

  defensive_responses:
    - technique: "Maintain Closed Guard"
      target_state: "Closed Guard Bottom"
      success_rate: 60

    - technique: "Sweep from Guard"
      target_state: "Guard Reversal"
      success_rate: 35

    - technique: "Submit from Guard"
      target_state: "Won by Submission"
      success_rate: 15

  # Decision Tree (Probabilistic State Machine Logic)
  decision_tree:
    - condition: "Guard is tight and posture broken"
      options:
        - action: "Establish Posture"
          target: "Closed Guard Top Position"
          probability: 50
        - action: "Stand to Break Guard"
          target: "Open Guard Pass Position"
          probability: 60

    - condition: "Guard is loose or opening"
      options:
        - action: "Knee Cut Pass"
          target: "Side Control"
          probability: 50
        - action: "Toreando Pass"
          target: "Side Control"
          probability: 45

    - condition: "Opponent controlling posture strongly"
      options:
        - action: "Posture Break Defense"
          target: "Closed Guard Top Position"
          probability: 40
        - action: "Stack Pass Attempt"
          target: "Side Control"
          probability: 40

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 2.5
    defender_burn_rate: 2.8
    explosive_escape_multiplier: 4.0
    cooking_rate: 1.5

  # Related States
  related_states:
    - "Closed Guard Bottom"
    - "Open Guard Pass Position"
    - "Side Control"
    - "Half Guard Top"
---



<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Pass from Closed Guard Top Position in BJJ",
  "description": "Complete guide to passing and escaping closed guard from the top position.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Posture",
      "text": "Sit upright with strong spine positioning to prevent opponent from breaking your posture and initiating attacks.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Create Space",
      "text": "Use proper hand positioning on hips or collar to create space and prevent opponent from closing distance.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Break the Guard",
      "text": "Stand up or use pressure-based guard break to open opponent's closed guard.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Initiate Pass",
      "text": "Execute passing technique such as knee cut, toreando, or leg drag once guard is opened.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Complete Pass",
      "text": "Settle into side control or other dominant position, establishing control before opponent can re-guard.",
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
      "name": "What is a common mistake in poor posture maintenance?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to break your posture and attack with submissions or sweeps from guard. The correction is: Keep your spine straight, chest up, and head over your hips to maintain strong structural posture."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in placing hands on mat?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gives opponent easy sweep opportunities and arm attack openings. The correction is: Keep hands on opponent's hips, collar, or sleeves rather than posting on the mat."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in rushing the pass?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Leads to poor technique execution and leaves you vulnerable to sweeps and submissions. The correction is: Be patient, establish control first, then execute passing technique with proper timing."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in not controlling distance?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Allows opponent to close distance and break your posture for attacks. The correction is: Maintain proper distance management with frames on hips or grips preventing opponent from pulling you down."
      }
    },
    {
      "@type": "Question",
      "name": "What is a common mistake in staying static?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Gives opponent time to set up attacks and increases fatigue from maintaining defensive position. The correction is: Constantly work toward guard opening and passing while maintaining posture and defensive awareness."
      }
    }
  ]
}
</script>


<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Closed Guard Top Position",
  "description": "Master Closed Guard Top Position in BJJ. Complete guide covering passing strategies, posture, and defensive tactics from inside closed guard. Success rates: Beginner 35%, Intermediate 50%, Advanced 65%.",
  "url": "https://bjjgraph.com/positions/closed-guard-top-position",
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
      "name": "Closed Guard Top Position",
      "item": "https://bjjgraph.com/positions/closed-guard-top-position"
    }
  ]
}
</script>


# Closed Guard Top Position
#bjj #state #guard #top #passing

## State Properties
- **State ID**: S231
- **Point Value**: 0 (Neutral position in scoring)
- **Position Type**: Defensive with passing focus
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
Closed Guard Top Position is the challenging state where you find yourself trapped inside your opponent's closed guard. Your opponent has their legs wrapped around your waist or hips with ankles locked, while you are kneeling or positioned between their guard. This is generally considered a disadvantageous position for the top person, as the bottom person has numerous attack options including sweeps and submissions, while the top person's primary objective is to maintain posture, avoid attacks, and work toward passing the guard.

From this position, your success depends on maintaining proper posture to prevent your opponent from breaking you down and attacking. You must balance defensive awareness with offensive passing attempts, creating a complex positional dynamic. The closed guard is one of the most fundamental positions in BJJ, and being effective from the top is essential for overall grappling competence.

Understanding that this is fundamentally a defensive position for the top player is crucial. Your goal is not to stay here but to safely escape to a more advantageous position through guard opening and passing techniques while avoiding the numerous submission and sweep threats your opponent presents.

### Visual Description
You are positioned between your opponent's legs with their thighs wrapped around your waist or hips and their ankles locked behind your back. You are typically on your knees or in a low squat, with your torso partially upright if you have good posture or pulled down toward opponent if they've broken your posture. Your hands are positioned defensively - ideally on opponent's hips, biceps, or collar to maintain distance and prevent them from pulling you down. Your head position is critical, staying above your hips with chin tucked to maintain postural integrity. The opponent's arms are likely gripping your collar, sleeves, or around your back attempting to break your posture for attacks. Your weight distribution is important - centered and balanced to prevent sweeps while maintaining the ability to pressure forward when initiating guard breaks. This creates a tense standoff where the opponent seeks to control and attack while you work to maintain structure and create passing opportunities.

## Key Principles
- **Posture Maintenance Priority**: Keep spine straight and head over hips to prevent opponent from breaking you down for attacks
- **Distance Management**: Control distance with proper hand placement to prevent opponent from closing space for submissions
- **Base and Balance**: Maintain wide base to defend against sweeps while staying mobile for passing attempts
- **Grip Fighting**: Control opponent's grips to prevent them from establishing dominant control for attacks
- **Patient Progression**: Work methodically toward guard opening without rushing into vulnerable passing attempts
- **Defensive Awareness**: Constantly monitor threats while working toward pass to avoid submissions and sweeps

## Prerequisites
- Understanding of posture mechanics
- Knowledge of guard passing principles
- Defensive awareness for guard attacks
- Basic grip fighting skills

## State Invariants
- Opponent's legs wrapped around your waist or hips
- You are positioned between opponent's guard with your torso trapped
- Opponent controlling your posture or positioning

## Defensive Responses (When Opponent Has This State Against You)
- [[Maintain Closed Guard]] → [[Closed Guard Bottom]] (Success Rate: 60%)
- [[Sweep from Guard]] → [[Guard Reversal]] (Success Rate: 35%)
- [[Submit from Guard]] → [[Won by Submission]] (Success Rate: 15%)

## Offensive Transitions (Available From This State)
- [[Standing Guard Break]] → [[Open Guard Pass Position]] (Success Rate: Beginner 40%, Intermediate 60%, Advanced 75%)
- [[Knee Cut Pass]] → [[Side Control]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Toreando Pass]] → [[Side Control]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)
- [[Stack Pass]] → [[Side Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 55%)
- [[Leg Drag]] → [[Side Control]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 50%)

## Counter Transitions
- [[Posture Recovery]] → [[Closed Guard Top Position]] (when posture is broken)
- [[Guard Re-break]] → [[Closed Guard Top Position]] (after failed passing attempt)
- [[Defensive Frame]] → [[Closed Guard Top Position]] (defending against sweeps)

## Expert Insights
**John Danaher**: "Being inside closed guard is fundamentally about posture management and understanding the hierarchy of threats. Your first priority is always maintaining structural integrity - if your posture is broken, you cannot defend submissions and you become highly vulnerable to sweeps. The key principle is that posture comes before everything else. Only when you have established strong posture can you begin working on guard opening. Most problems in this position arise from trying to pass before establishing the prerequisite posture control. Think of it as a sequence: establish posture, maintain it while creating grip advantages, then use those advantages to systematically open the guard."

**Gordon Ryan**: "In competition, I approach closed guard top with a very specific mentality - I'm not trying to do anything fancy, I'm just trying to not get swept or submitted while working toward standing up. The standing guard break is my highest percentage option because it takes away most of the opponent's attacks and gives me better angles for passing. When people try to pass from their knees, they give the bottom person too many options. Stand up, create distance, and then work your passes from there. Also, never underestimate how tiring closed guard can be for the bottom person if you're heavy and have good pressure - sometimes patience is your best weapon."

**Eddie Bravo**: "From inside closed guard, I'm thinking about explosive guard breaks combined with immediate passing attempts. The traditional approach of slowly working for posture and methodically opening the guard can leave you stuck there forever. I like to create movement and reactions - if I can get the opponent reacting to one thing, I can often slip past their guard in the chaos. That said, you absolutely have to respect the submission threats, especially triangles and arm locks. The 10th Planet approach is to use strategic movement and misdirection, but never at the cost of basic defensive soundness."

## Common Errors
- **Error**: Poor posture maintenance
  - **Consequence**: Allows opponent to break your posture and attack with submissions or sweeps from guard.
  - **Correction**: Keep your spine straight, chest up, and head over your hips to maintain strong structural posture.
  - **Recognition**: If opponent can pull your head down or collapse your chest toward them, your posture is compromised.

- **Error**: Placing hands on mat
  - **Consequence**: Gives opponent easy sweep opportunities and arm attack openings.
  - **Correction**: Keep hands on opponent's hips, collar, or sleeves rather than posting on the mat.
  - **Recognition**: If your hands are flat on the mat beside opponent, you're vulnerable to sweeps and arm locks.

- **Error**: Rushing the pass
  - **Consequence**: Leads to poor technique execution and leaves you vulnerable to sweeps and submissions.
  - **Correction**: Be patient, establish control first, then execute passing technique with proper timing.
  - **Recognition**: If you find yourself frequently getting swept or submitted while attempting passes, you're likely rushing.

- **Error**: Not controlling distance
  - **Consequence**: Allows opponent to close distance and break your posture for attacks.
  - **Correction**: Maintain proper distance management with frames on hips or grips preventing opponent from pulling you down.
  - **Recognition**: If opponent easily pulls you down or controls your upper body, you're not managing distance properly.

- **Error**: Staying static
  - **Consequence**: Gives opponent time to set up attacks and increases fatigue from maintaining defensive position.
  - **Correction**: Constantly work toward guard opening and passing while maintaining posture and defensive awareness.
  - **Recognition**: If you find yourself stuck in guard for extended periods with no progress, you're too static.

## Training Drills
- **Posture Maintenance Drill**: Partner in closed guard attempts to break your posture while you maintain it for 2-minute rounds, focusing on spine position and head placement. Partner increases pressure progressively from 30% to 70%.

- **Guard Opening Flow**: Practice various guard opening techniques (standing, pressure-based, combination) with partner resisting at 50%, performing 10 repetitions of each method while maintaining posture throughout.

- **Passing Sequence Drill**: Chain guard break directly into passing attempt, drilling complete sequences with partner defending at 40-60% intensity. 15 complete sequences focusing on smooth transitions from opening to pass completion.

- **Positional Sparring from Guard Top**: Start inside closed guard and work for pass while partner works for sweeps or submissions. 5-minute rounds with emphasis on maintaining posture under pressure and creating passing opportunities.

- **Defensive Response Drill**: Partner attacks with common submissions (triangle, armbar, collar chokes) and you practice defensive responses and posture recovery. 20 total attempts focusing on early recognition and prevention.

## Related States
- [[Closed Guard Bottom]] - Opponent's perspective
- [[Open Guard Pass Position]] - After guard opening
- [[Side Control]] - Goal position after successful pass
- [[Half Guard Top]] - Common position if pass is incomplete
- [[Mount]] - Advanced passing target

## Related Positions
- [[Closed Guard Bottom]] - The inverse position
- [[Side Control]] - Target after passing
- [[Open Guard Pass Position]] - Next stage in progression
- [[Half Guard Top]] - Partial pass position
- [[Standing Guard Break]] - Guard opening technique

## Decision Tree
If guard is tight and posture broken:
- Execute [[Establish Posture]] → [[Closed Guard Top Position]] (Probability: 50%)
- Or Execute [[Stand to Break Guard]] → [[Open Guard Pass Position]] (Probability: 60%)

Else if guard is loose or opening:
- Execute [[Knee Cut Pass]] → [[Side Control]] (Probability: 50%)
- Or Execute [[Toreando Pass]] → [[Side Control]] (Probability: 45%)

Else if opponent controlling posture strongly:
- Execute [[Posture Break Defense]] → [[Closed Guard Top Position]] (Probability: 40%)
- Or Execute [[Stack Pass Attempt]] → [[Side Control]] (Probability: 40%)

## Position Metrics
- **Position Retention Rate**: Beginner 35%, Intermediate 50%, Advanced 65%
- **Advancement Probability**: Beginner 40%, Intermediate 55%, Advanced 70%
- **Submission Probability**: Beginner 5%, Intermediate 10%, Advanced 15%
- **Position Loss Probability**: Beginner 55%, Intermediate 40%, Advanced 25%
- **Average Time in Position**: 1-3 minutes

## Optimal Submission Paths
**From closed guard top (rare):**
[[Closed Guard Top Position]] → [[Ezekiel Choke]] → [[Won by Submission]]
*Reasoning: One of few submission options from this position, though very low percentage 10-20%*

**High-percentage escape and advancement:**
[[Closed Guard Top Position]] → [[Standing Guard Break]] → [[Open Guard Pass Position]] → [[Side Control]] → [[Mount]] → [[Submission Chain]] → [[Won by Submission]]
*Reasoning: Safest and most reliable path to dominant position and eventual submission, success rate 40-70%*

**Aggressive passing path:**
[[Closed Guard Top Position]] → [[Stack Pass]] → [[Side Control]] → [[Submission Attack]] → [[Won by Submission]]
*Reasoning: More direct but riskier passing attempt, works well against flexible opponents, success rate 25-55%*
