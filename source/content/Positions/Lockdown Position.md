---
title: "Lockdown Position | BJJ Position Guide | BJJ Graph"
description: "Master Lockdown Position in BJJ. Complete guide covering half guard control, leg entanglement, sweeps, and transitions. Success rates: Beginner 45%, Intermediate 60%, Advanced 75%."
tags:
  - bjj
  - position
  - half-guard
  - bottom
  - 10th-planet
  - intermediate

state_machine:
  state_id: "S220"
  position_name: "Lockdown Position"
  alternative_names:
    - "Lockdown Half Guard"
    - "Eddie Bravo Lockdown"
    - "Leg Triangle from Half Guard"

  properties:
    point_value: 0
    position_type: "Defensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  metrics:
    position_retention:
      beginner: 55
      intermediate: 70
      advanced: 80
    advancement_probability:
      beginner: 45
      intermediate: 60
      advanced: 75
    submission_probability:
      beginner: 15
      intermediate: 25
      advanced: 40
    position_loss:
      beginner: 40
      intermediate: 25
      advanced: 15
    average_time_minutes: "2-4"

  transitions:
    offensive:
      - name: "electric chair"
        target_state: "S011"
        target_position: "Top Half Guard"
        success_rate:
          beginner: 35
          intermediate: 50
          advanced: 65
        transition_id: "T401"
        category: "sweep"
        energy_cost: "High"
        execution_time: "Medium"
        description: "Use lockdown to elevate opponent and sweep to top position"

      - name: "Old School Sweep"
        target_state: "S011"
        target_position: "Top Half Guard"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T402"
        category: "sweep"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Roll backwards using lockdown control for classic sweep"

      - name: "Whip Up to Dog Fight"
        target_state: "S028"
        target_position: "dogfight position"
        success_rate:
          beginner: 50
          intermediate: 65
          advanced: 80
        transition_id: "T403"
        category: "position_improvement"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Use lockdown to off-balance and come up to knees"

      - name: "Vaporizer Submission"
        target_state: "SUB089"
        target_position: "Vaporizer Control"
        success_rate:
          beginner: 15
          intermediate: 25
          advanced: 40
        transition_id: "T404"
        category: "submission"
        energy_cost: "High"
        execution_time: "Slow"
        description: "Attack calf/knee from lockdown position"

      - name: "Transition to electric chair"
        target_state: "S221"
        target_position: "electric chair submission"
        success_rate:
          beginner: 45
          intermediate: 60
          advanced: 75
        transition_id: "T405"
        category: "control"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Underhook and lockdown to elevate opponent"

      - name: "Homer Simpson to Back"
        target_state: "S004"
        target_position: "Back Control"
        success_rate:
          beginner: 25
          intermediate: 40
          advanced: 55
        transition_id: "T406"
        category: "back_take"
        energy_cost: "High"
        execution_time: "Slow"
        description: "Use lockdown stretch to facilitate back take"

    defensive:
      - name: "Lockdown Counter to Knee Slice"
        target_state: "S003"
        target_position: "Side Control"
        success_rate: 45
        counter_category: "pass"
        description: "Opponent extracts leg and passes to side control"

      - name: "Lockdown Break and Stack Pass"
        target_state: "S001"
        target_position: "Mount"
        success_rate: 35
        counter_category: "pass"
        description: "Breaking lockdown by stacking pressure"

      - name: "Opponent Maintains Half Guard Top"
        target_state: "S010"
        target_position: "side control"
        success_rate: 40
        counter_category: "control"
        description: "Opponent defends lockdown and maintains top position"

      - name: "Foot Lock Counter"
        target_state: "SUB033"
        target_position: "Straight Ankle Lock"
        success_rate: 20
        counter_category: "submission"
        description: "Opponent attacks exposed foot from lockdown"

    counters:
      - opponent_action: "Posture Up and Pull Leg Out"
        your_counter: "Whip Up"
        target_state: "S028"
        success_rate: 55
        description: "Use their posture to come up to knees"

      - opponent_action: "Knee Slice Pass Attempt"
        your_counter: "electric chair"
        target_state: "S221"
        success_rate: 50
        description: "Trap leg and elevate before pass completes"

  decision_tree:
    - condition: "opponent maintains low posture and heavy pressure"
      priority: 1
      indicators:
        - "Chest pressure on your chest"
        - "Head low and forward"
        - "Hips driving down"
      actions:
        - technique: "Old School Sweep"
          target_state: "S011"
          probability: 55
          reasoning: "Low posture creates rolling sweep opportunity"
        - technique: "electric chair"
          target_state: "S221"
          probability: 50
          reasoning: "Heavy pressure prevents posting, allows elevation"

    - condition: "opponent posts and tries to extract leg"
      priority: 2
      indicators:
        - "Hands posted on mat"
        - "Hips pulling away"
        - "Leg attempting to clear"
      actions:
        - technique: "Whip Up to Dogfight"
          target_state: "S028"
          probability: 65
          reasoning: "Forward momentum aids coming to knees"
        - technique: "Homer Simpson Back Take"
          target_state: "S004"
          probability: 40
          reasoning: "Extension creates back exposure"

    - condition: "opponent establishes underhook and crossface"
      priority: 3
      indicators:
        - "Underhook secured"
        - "Shoulder pressure on face"
        - "Weight distributed forward"
      actions:
        - technique: "Transition to Deep Half"
          target_state: "S009"
          probability: 50
          reasoning: "Use lockdown to invert and transition"
        - technique: "Maintain Lockdown and Reset"
          target_state: "S220"
          probability: 45
          reasoning: "Focus on retention until opening appears"

    - condition: "default - opponent balanced in lockdown"
      priority: 4
      indicators:
        - "Neither attacking nor defending strongly"
        - "Waiting for opening"
        - "Maintaining control"
      actions:
        - technique: "Begin electric chair"
          target_state: "S221"
          probability: 50
          reasoning: "Proactive attack from lockdown"
        - technique: "Vaporizer Submission Attack"
          target_state: "SUB089"
          probability: 35
          reasoning: "Direct submission threat from lockdown"

  invariants:
    physical:
      - "Bottom leg wrapped around opponent's shin/ankle"
      - "Top leg triangle locked around opponent's trapped leg"
      - "Hips angled to control opponent's leg"
      - "Upper body at angle to opponent's torso"

    control:
      - "Lockdown securely fastened around one leg"
      - "Inside bicep grip or underhook control"
      - "Head position on chest or shoulder"
      - "Constant tension on trapped leg"

    opponent_limitations:
      - "One leg completely immobilized"
      - "Cannot freely posture or move"
      - "Limited passing options"
      - "Must address lockdown to advance"

  training:
    prerequisites:
      positions:
        - "Half Guard Bottom"
        - "Half Guard Top"

      skills:
        - "Leg dexterity and flexibility"
        - "Hip mobility"
        - "Grip fighting ability"

      concepts:
        - "Leg entanglement principles"
        - "Off-balancing mechanics"
        - "10th Planet System basics"

    optimal_conditions:
      - "When opponent has one leg trapped in half guard"
      - "When opponent's weight is forward"
      - "When you have inside space to lock triangle"

    vulnerable_moments:
      - "During lockdown setup - leg can be attacked"
      - "When opponent sprawls weight back"
      - "When lockdown is partially locked but not tight"

    energy_fatigue_factors:
      - "Maintaining lockdown requires constant leg tension"
      - "Sweeps from lockdown are explosive and taxing"
      - "Extended lockdown battles drain hip flexor endurance"

  progressions:
    leads_to:
      - state_id: "S221"
        position: "electric chair submission"
        relationship: "natural_progression"
        description: "Elevating opponent from lockdown"

      - state_id: "S028"
        position: "dogfight position"
        relationship: "natural_progression"
        description: "Coming up to knees from lockdown"

    related_positions:
      - state_id: "S010"
        position: "Half Guard Bottom"
        relationship: "variation"
        description: "Lockdown is specialized half guard variation"

      - state_id: "S009"
        position: "Deep Half Guard"
        relationship: "alternative"
        description: "Another bottom half guard variation"

      - state_id: "S050"
        position: "Rubber Guard"
        relationship: "similar_system"
        description: "Related 10th Planet position using leg control"

schema_org:
  howto:
    type: "HowTo"
    name: "How to Use Lockdown Position in BJJ"
    description: "Complete guide to executing techniques and transitions from Lockdown Position."
    total_time: "PT5M"

    steps:
      - name: "Establish Lockdown"
        text: "From half guard bottom, weave your bottom leg over opponent's shin and triangle lock with top leg around their trapped leg."
        position: 1

      - name: "Secure Upper Body Control"
        text: "Control opponent's upper body with underhook or inside bicep grip while maintaining lockdown tension."
        position: 2

      - name: "Execute Old School Sweep"
        text: "Roll backwards using lockdown to sweep opponent over your head to top half guard position."
        position: 3

      - name: "Execute electric chair"
        text: "Underhook opponent and elevate using lockdown, creating sweeping or submission opportunities."
        position: 4

      - name: "Whip Up to dogfight"
        text: "Use lockdown to off-balance opponent and come up to your knees into dogfight position."
        position: 5

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  faq:
    - question: "What is the main purpose of the Lockdown in BJJ?"
      answer: "The Lockdown immobilizes opponent's leg, prevents passing, and creates opportunities for sweeps like Old School and Electric Chair. It fundamentally disrupts opponent's base and balance from half guard bottom."
      category: "fundamentals"

    - question: "How do I prevent my foot from being attacked in Lockdown?"
      answer: "Keep your locked ankle hidden beneath opponent's leg, maintain constant tension, and be ready to unlock if opponent commits to leg attack. The Lockdown should control opponent's leg, not expose yours."
      category: "defense"

    - question: "When should I use Old School Sweep vs electric chair from Lockdown?"
      answer: "Use Old School when opponent's posture is low and forward - roll them backwards. Use electric chair when opponent is more upright - elevate them sideways. Old School works against heavy pressure; electric chair against extension."
      category: "tactics"

    - question: "How tight should the Lockdown be?"
      answer: "Maintain constant tension but not maximum squeeze - you need flexibility to adjust and sweep. Too tight exhausts your legs; too loose allows escape. Think 70% tension with ability to pulse tighter when attacking."
      category: "technical"

    - question: "Is Lockdown Position effective in gi and no-gi?"
      answer: "Lockdown works in both but originated in no-gi competition. No-gi allows cleaner leg entanglement; gi provides additional grip options but opponent has more friction to resist sweeps."
      category: "application"

llm_context:
  position_summary: "Lockdown Position is a specialized half guard variation where bottom player triangles their legs around opponent's trapped leg, immobilizing their base and creating unique sweeping and submission opportunities."

  key_success_factors:
    - factor: "Tight Triangle Lock"
      importance: "critical"
      description: "Bottom leg weaves over opponent's shin while top leg locks behind it, creating immobilizing triangle. Without solid lockdown, entire position fails."
      game_impact: "Adds +10% to all sweep success rates when locked properly"

    - factor: "Inside Bicep Control or Underhook"
      importance: "high"
      description: "Upper body control prevents opponent from posturing or driving crossface. Underhook enables Electric Chair; inside bicep control enables Old School."
      game_impact: "Required for offensive transitions, adds +5% when maintained"

    - factor: "Hip Angle and Tension"
      importance: "high"
      description: "Hips must stay at angle to opponent's body with constant tension on trapped leg. Angle prevents opponent from stacking and creates sweeping leverage."
      game_impact: "Without proper angle, sweeps fail 40% more often"

    - factor: "Timing the Whip"
      importance: "medium"
      description: "The 'whip' motion uses lockdown to off-balance opponent at precise moment when their weight shifts. Mistiming reduces effectiveness significantly."
      game_impact: "Proper timing increases transition success by 15%"

  common_questions:
    - q: "How do I initially enter the Lockdown from regular half guard?"
      a: "From half guard bottom with trapped leg, slide your bottom leg (same side as trapped leg) over their shin/ankle. Then bring your top leg over and hook your own ankle behind opponent's knee/calf, creating triangle lock."
      context: "technical|execution"
      skill_level: "beginner|intermediate"

    - q: "What should I do if opponent is stacking me hard in Lockdown?"
      a: "Use the stack against them - execute Old School Sweep by rolling backwards over your shoulder. Their forward pressure helps complete the roll. Alternatively, unlock momentarily to create space for adjustment."
      context: "problem_solving|tactical"
      skill_level: "intermediate"

    - q: "Is Lockdown considered a stalling position in competition?"
      a: "Some referees may penalize extended lockdown without attacking. Always work towards sweeps, Electric Chair, or submission attempts. Use lockdown as active control, not passive stalling."
      context: "competition|strategy"
      skill_level: "intermediate|advanced"

    - q: "How do I defend against leg locks when my foot is exposed in Lockdown?"
      a: "Keep locked ankle hidden beneath opponent's leg. If they grab your foot, be ready to unlock immediately and transition to Deep Half or recover full Half Guard. Don't stubbornly hold lockdown if leg is being attacked."
      context: "defensive|safety"
      skill_level: "intermediate|advanced"

    - q: "What grip should I prioritize with my upper body in Lockdown?"
      a: "Depends on opponent's posture: if they're upright, get underhook for Electric Chair; if they're driving forward, inside bicep grip enables Old School. Both grips prevent crossface and posture."
      context: "tactical|technical"
      skill_level: "intermediate"

  coaching_cues:
    - "Triangle your legs tight - make it uncomfortable"
    - "Don't just hold - sweep or submit"
    - "Underhook for elevation, bicep grip for roll"
    - "Angle your hips - never stay square"
    - "Hide your exposed foot beneath their leg"
    - "Pulse the lockdown to off-balance"
    - "Old School when they're heavy, Electric Chair when they're tall"

  training_focus:
    beginner:
      - "Learning to lock the triangle securely"
      - "Maintaining lockdown under pressure"
      - "Old School Sweep mechanics"
      - "Safe entry and exit from lockdown"

    intermediate:
      - "Electric Chair setup and execution"
      - "Whip Up to Dog Fight transition"
      - "Combining lockdown with underhooks"
      - "Defending leg lock attempts"

    advanced:
      - "Homer Simpson back take system"
      - "Vaporizer and other leg attacks"
      - "Lockdown against high-level pressure"
      - "Competition-specific lockdown strategies"

  game_engine_hints:
    energy_cost_factors:
      - "Maintaining lockdown: Medium drain per turn (hip flexors and quads)"
      - "Old School Sweep: High energy burst"
      - "Whip Up transitions: Medium energy cost"

    position_strength: "Strong for creating sweep opportunities and frustrating opponent's passing game, but requires active attacking to prevent stalling penalties"

    opponent_pressure: "High pressure - opponent must deal with immobilized leg and constant sweep threats"

    ideal_scenarios:
      - "Against opponent who drives heavy pressure from half guard top"
      - "When opponent has one leg trapped and you can secure triangle"
      - "In no-gi competition where leg control is more effective"

    dilemma_creation:
      - "If opponent drives pressure forward → Old School Sweep"
      - "If opponent posts to extract leg → Whip Up or Homer Simpson"
      - "If opponent stays neutral → Electric Chair or Vaporizer attacks"

  success_modifiers:
    - condition: "Lockdown locked tight"
      modifier: +10
      applies_to: "all_offensive_transitions"
      description: "Secure triangle increases sweep success"

    - condition: "Underhook secured"
      modifier: +10
      applies_to: "electric chair transitions"
      description: "Underhook critical for elevation"

    - condition: "Opponent fatigued"
      modifier: +5
      applies_to: "all_sweeps"
      description: "Tired opponent can't defend sweeps effectively"

    - condition: "10th Planet System mastery"
      modifier: +10
      applies_to: "system_techniques"
      description: "Understanding full system increases effectiveness"

    - condition: "Lockdown held >90 seconds"
      modifier: -5
      applies_to: "offensive_success"
      description: "Extended lockdown drains leg endurance"

    - condition: "Opponent establishes crossface"
      modifier: -10
      applies_to: "all_sweeps"
      description: "Crossface prevents most sweeping mechanics"

  dilemmas:
    - scenario: "Opponent drives heavy pressure to pass"
      dilemma_created: "Forward pressure creates Old School Sweep opportunity but makes electric chair difficult"
      offensive_options:
        - "Old School Sweep → Top Half Guard (Success: 55%)"
        - "Roll to Deep Half → Deep Half Guard (Success: 45%)"
      narrative: "As your opponent drives their weight forward to crush your guard, they unknowingly load your Old School Sweep. Their pressure becomes your power."

    - scenario: "Opponent posts hands to extract trapped leg"
      dilemma_created: "Posting creates space but removes base, allowing Whip Up or back exposure"
      offensive_options:
        - "Whip Up to dogfight → dogfight position (Success: 65%)"
        - "Homer Simpson Back Take → Back Control (Success: 40%)"
      narrative: "Your opponent posts their hands, trying to pull their leg free. This extension gives you the momentum to either come up to your knees or take their back."

    - scenario: "Opponent maintains neutral position in lockdown"
      dilemma_created: "Staying still allows you to attack but prevents their passing progress"
      offensive_options:
        - "electric chair Setup → electric chair position (Success: 50%)"
        - "Vaporizer Attack → Submission (Success: 35%)"
      narrative: "Your opponent freezes, trapped in your lockdown. They're safe from being swept, but now you have time to attack their trapped leg with submissions or set up the electric chair."

  narrative_prompts:
    entry: "You secure half guard and feel their leg trapped between yours. Your bottom leg snakes over their shin as your top leg clamps down, locking your ankle behind their knee. The lockdown is set. Their leg is yours."
    control: "Your legs are a vice around their trapped leg. Every movement they make, you counter with a pulse of your lockdown. They're stuck, frustrated, unable to pass or escape. You control the pace now."
    attack_initiation: "You feel their weight shift forward - it's time. You secure the underhook and begin to elevate. The electric chair is coming. Or they post to resist, and you whip your hips up, coming to your knees. Either way, you're attacking."
    success: "The Old School Sweep completes perfectly. You roll backwards over your shoulder, your lockdown pulling them over you like a catapult. You land in top half guard, the position reversed. The sweep worked beautifully."
    failure: "They time it perfectly, sprawling their weight back as you attempt the sweep. Your lockdown loses tension. They pull their leg free and drive forward into a passing position. You must recover quickly."
    position_loss: "Your lockdown breaks as they extract their leg, sliding it free with a powerful pull. They're passing to side control. Frame, shrimp, and recover your guard before they establish control."

  knowledge_questions:
    - question: "What are the two main sweep options from Lockdown Position and when do you use each?"
      answer: "Old School Sweep (rolling backwards) works best when opponent has low posture and forward pressure; electric chair (elevation sweep) works best when opponent is more upright. Old School uses their pressure against them; electric chair uses elevation and off-balancing."
      difficulty: "beginner"
      category: "fundamentals"
      points: 10

    - question: "How do you properly lock the Lockdown triangle and why is hip angle important?"
      answer: "Bottom leg (same side as trapped leg) goes over opponent's shin/ankle, top leg hooks your own ankle behind opponent's knee/calf creating triangle. Hip angle is crucial because being square allows opponent to stack; angling hips creates leverage for sweeps and prevents stacking pressure."
      difficulty: "intermediate"
      category: "technical_details"
      points: 15

    - question: "What is the Homer Simpson back take and when is it available from Lockdown?"
      answer: "Homer Simpson is a back take from lockdown using the stretch and tension to facilitate taking the back. It's available when opponent posts or extends trying to free their leg, creating back exposure. Advanced technique requiring precise timing and lockdown control."
      difficulty: "advanced"
      category: "systems"
      points: 20

    - question: "How should you defend if opponent begins attacking your exposed foot from Lockdown?"
      answer: "Immediately assess leg lock danger. If they secure grip on your foot, unlock lockdown to free your leg and transition to Deep Half or recover full Half Guard. Never stubbornly hold lockdown when leg is being attacked - position retention isn't worth injury. Keep locked ankle hidden beneath opponent's leg as prevention."
      difficulty: "intermediate"
      category: "defensive|safety"
      points: 15

    - question: "Explain the relationship between upper body control and sweep selection from Lockdown."
      answer: "Underhook enables electric chair by allowing you to elevate opponent sideways; inside bicep grip enables Old School by controlling their shoulder as you roll backwards. Crossface (opponent's control) shuts down most sweeps. The grip dictates which attacks are available - adapt your sweep to your upper body position."
      difficulty: "advanced"
      category: "tactics|integration"
      points: 20
---

# Lockdown Position
#bjj #state #half-guard #bottom #10th-planet #intermediate

## State Description

The Lockdown Position is a specialized variation of half guard bottom where the bottom player triangles their legs around the opponent's trapped leg, immobilizing their base and creating unique sweeping and submission opportunities. This position was popularized by Eddie Bravo and is a cornerstone of the 10th Planet Jiu-Jitsu system, offering aggressive attack options from what would traditionally be considered a defensive position.

Unlike standard half guard where you simply trap one leg, the lockdown uses a leg triangle to completely control the opponent's trapped leg, preventing them from posturing, passing, or establishing strong top pressure. This control creates opportunities for signature techniques like the Old School Sweep and Electric Chair, while making traditional half guard passes extremely difficult for the top player.

The lockdown is most effective when actively used for sweeps and attacks rather than passive control. While it provides strong retention against passing attempts, referees may penalize extended lockdown holding without offensive action, making it essential to understand both the control mechanics and the offensive sequences available from this position.

## Visual Description

You are lying on your back with your opponent in your half guard, one of their legs trapped between yours. Your bottom leg (the one on the same side as their trapped leg) has snaked over their shin or ankle. Your top leg has wrapped over and hooked your own ankle behind their knee or calf, creating a tight triangle lock around their entire lower leg. Your hips are angled to the side rather than flat, creating tension on the trapped leg and preventing stacking. Your upper body controls them with either an underhook on the trapped leg side, or an inside bicep grip, while your head rests on their chest or shoulder. The lockdown creates constant tension and immobilization on their trapped leg.

Their trapped leg is completely controlled by your triangle lock, unable to freely move or post. Their other leg struggles to provide adequate base as you can use the lockdown to off-balance them. Their upper body is being controlled by your grip, preventing them from establishing a strong crossface or dominant posture.

This creates immense frustration for the top player as their passing options are severely limited, and they must first address the lockdown before advancing position. Meanwhile, you have multiple sweeping and submission attack options available, turning bottom half guard into an offensive position.

## Key Principles

- **Leg Triangle Mechanics**: The lockdown's power comes from the triangle lock around opponent's leg, not just trapping it between your legs. Your bottom leg weaves over their shin while your top leg hooks your own ankle behind their knee, creating immobilizing pressure similar to how legs control in back mount. This triangle must be tight and maintained with constant tension.

- **Hip Angle Creates Leverage**: Never stay flat on your back in lockdown - angle your hips away from your opponent. This angle prevents them from stacking you, creates leverage for your sweeps, and maintains the tension on their trapped leg. Being square removes your offensive power and makes you vulnerable to crushing pressure.

- **Upper Body Control Dictates Attacks**: Your available techniques depend entirely on your upper body position. Underhook on the trapped leg side enables Electric Chair elevation sweeps; inside bicep grip enables Old School rolling sweeps. Without upper body control, opponent can establish crossface and shut down your attacks.

- **Active vs Passive Lockdown**: Lockdown is an attacking position, not a stalling position. While it provides excellent guard retention, you must constantly threaten sweeps or submissions. In competition, passive lockdown holding can draw stalling penalties. Use it aggressively or transition to other positions.

- **The Whip Motion**: The "whip" is the fundamental movement in lockdown - using your triangle lock to suddenly jerk opponent's leg and disrupt their balance. This motion initiates most sweeps and transitions. Master the timing of pulsing the lockdown to create off-balancing moments.

- **Protecting the Exposed Foot**: Your locked ankle is technically exposed to leg attacks. Keep it hidden beneath opponent's leg and maintain awareness of leg lock threats. If opponent commits to attacking your foot, be ready to unlock immediately and transition rather than stubborn hold.

## Offensive Transitions

From this position, you can execute:

### Sweeps

- [[electric chair]] → [[Top Half Guard]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
  - Secure underhook on trapped leg side, use lockdown to elevate opponent sideways, completing sweep to top position or submission

- [[Old School Sweep]] → [[Top Half Guard]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
  - Classic rolling sweep going backwards over your shoulder, using lockdown to pull opponent over you like a catapult

- [[Whip Up to Dog Fight]] → [[dogfight position]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)
  - Use lockdown to off-balance opponent and come up to your knees, entering scramble position

### Position Improvements

- [[Transition to electric chair]] → [[electric chair submission]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
  - Secure underhook and elevate opponent using lockdown, creating elevated control position

- [[Lockdown to Deep Half]] → [[Deep Half Guard]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
  - Invert and slide underneath using lockdown control to transition guards

### Submissions

- [[Vaporizer Submission]] → [[Vaporizer Lock]] (Success Rate: Beginner 15%, Intermediate 25%, Advanced 40%)
  - Attack opponent's trapped leg directly from lockdown with calf/knee compression

### Advanced Transitions

- [[Homer Simpson to Back]] → [[Back Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 55%)
  - Use lockdown stretch to facilitate back take when opponent extends

## Defensive Responses

When opponent has this position against you, available counters:

- [[Lockdown Break]] → [[Half Guard Top]] (Success Rate: 50%)
  - Extract trapped leg by posting, sprawling weight back, and clearing the lockdown

- [[Knee Slice from Lockdown]] → [[Side Control Top]] (Success Rate: 45%)
  - Force pressure forward and slide knee across to pass despite lockdown

- [[Stack Pass Against Lockdown]] → [[Mount Top]] (Success Rate: 35%)
  - Drive opponent's knees to their chest, breaking lockdown angle and passing

- [[Leg Lock Counter to Lockdown]] → [[Straight Ankle Lock]] (Success Rate: 20%)
  - Attack bottom player's exposed locked ankle instead of defending

## Decision Tree

**If** opponent maintains low posture and heavy pressure:
- Execute [[Old School Sweep]] → [[Top Half Guard]] (Probability: 55%)
  - Reasoning: Low forward pressure loads the rolling sweep perfectly - use their weight against them
- Or Execute [[electric chair]] → [[electric chair submission]] (Probability: 50%)
  - Reasoning: Heavy pressure prevents them from posting, allows elevation

**Else if** opponent posts and tries to extract leg:
- Execute [[Whip Up to Dog Fight]] → [[dogfight position]] (Probability: 65%)
  - Reasoning: Their forward momentum and extension aids coming to knees
- Or Execute [[Homer Simpson Back Take]] → [[Back Control]] (Probability: 40%)
  - Reasoning: Extension creates back exposure opportunity

**Else if** opponent establishes underhook and crossface:
- Transition to [[Deep Half Guard]] → [[Deep Half Guard]] (Probability: 50%)
  - Reasoning: Use lockdown to invert and change guard systems
- Or [[Maintain Lockdown and Reset]] → [[Lockdown Position]] (Probability: 45%)
  - Reasoning: Reset position and wait for cleaner opening

**Else** (balanced opponent / default):
- Begin [[electric chair Setup]] → [[electric chair position]] (Probability: 50%)
  - Reasoning: Proactive attack from lockdown creates dilemma
- Or Execute [[Vaporizer Attack]] → [[Vaporizer Lock]] (Probability: 35%)
  - Reasoning: Direct submission threat on trapped leg

## Expert Insights

**John Danaher**: "The lockdown represents a fascinating control hierarchy - it immobilizes the opponent's leg completely, removing their ability to generate base and pass effectively. However, it must be understood as a transitional control leading to sweeps or submissions, not an endpoint. The mechanical advantage comes from the triangle lock's ability to create rotational force on the knee and hip joint, which when combined with upper body control, generates powerful off-balancing. The key technical detail is maintaining hip angle to prevent opponent stacking - this angle is what transforms passive leg trap into active attacking position."

**Gordon Ryan**: "In competition, lockdown can be high-percentage if you attack immediately. I've seen too many people use it passively and get stalled or passed. When I use lockdown, I'm going for Old School within seconds, or setting up Electric Chair. The position works because it frustrates the passer - their normal passing mechanics don't function with one leg locked down. But you have to be the aggressor. If you're just holding it, good passers will eventually break it and punish you. Use it to sweep or transition, not to stall."

**Eddie Bravo**: "Lockdown changed my entire game - it's the foundation of our whole system. Most people think of half guard as defensive, but lockdown makes it offensive. The key is the 'whip' - that sudden jerk you give their leg to off-balance them. Everything comes from that whip: Old School, Electric Chair, coming up to dog fight. And people sleep on the Vaporizer and other leg attacks from there. It's not just a control position, it's a submission system. When you lock it down, you're in control. They're stuck until you decide to sweep or submit them. That's 10th Planet philosophy - turn defense into offense."

## Common Errors

### Error: Staying flat on back instead of angling hips
- **Consequence**: Allows opponent to stack you and apply crushing pressure. Without hip angle, you lose sweeping leverage and become vulnerable to forward pressure passing. Opponent can drive weight onto your chest making breathing difficult and attacks impossible.
- **Correction**: Always angle your hips to the side (away from their trapped leg). Think of creating a 45-degree angle with your torso relative to theirs. This angle creates leverage for sweeps and prevents stacking.
- **Recognition**: If you feel stacked, crushed, or unable to initiate sweeps, your hips are likely too flat. You should feel tension pulling their leg at an angle, not straight pressure on your chest.

### Error: Lockdown triangle not tight enough
- **Consequence**: Loose lockdown allows opponent to extract their leg easily, removing all your control and offensive options. Opponent can also drive forward pressure more effectively when lockdown lacks tension. Your sweeps will fail without secure leg control.
- **Correction**: When locking the triangle, pull your hooked ankle tight behind their knee/calf while pressing your shin across their ankle/shin. Maintain 70% tension constantly with ability to pulse to 100% when attacking. The triangle should feel uncomfortable for opponent.
- **Recognition**: If opponent easily extracts leg or you don't feel their leg trapped, triangle is too loose. You should see opponent struggling to move their trapped leg freely.

### Error: Attempting sweeps without upper body control
- **Consequence**: Sweeps fail completely without underhook or inside bicep grip. Opponent can post their hands, control your head with crossface, or simply posture away from your sweeping attempts. Lockdown alone is insufficient for successful attacks.
- **Correction**: Before initiating any sweep, establish either underhook (for Electric Chair) or inside bicep grip (for Old School). Fight for these grips as priority. If opponent establishes crossface, work to remove it before attacking.
- **Recognition**: If your sweeps feel powerless or opponent easily posts to stop them, check your upper body - you likely lack proper grip control.

### Error: Holding lockdown passively without attacking
- **Consequence**: Referees may penalize for stalling. Opponent has time to develop passing strategy. Your legs fatigue from extended lockdown tension. Passive holding goes against the spirit of BJJ and wastes the position's offensive potential.
- **Correction**: Use lockdown actively - constantly threaten sweeps, work for better grips, set up submissions. If you secure lockdown, immediately begin attacking within 10-15 seconds maximum. Think of lockdown as attacking position, not resting position.
- **Recognition**: If you're just "holding" lockdown without attempting techniques, or if opponent seems comfortable despite being locked down, you're being too passive.

### Error: Exposing locked ankle to leg attack without awareness
- **Consequence**: Opponent can attack your locked ankle with straight ankle lock or other leg attacks. This forces you to unlock and defend, losing position. Stubborn holding while being attacked risks injury to your own ankle.
- **Correction**: Keep your locked ankle hidden beneath opponent's leg as much as possible. Maintain awareness of their hand fighting - if they grab your exposed foot, immediately assess leg lock danger and be ready to unlock if necessary. Position preservation isn't worth injury.
- **Recognition**: If opponent is grabbing or attacking your locked foot, or if you feel pressure on your ankle joint, you're exposed. React immediately.

### Error: Attempting Old School when opponent has high posture
- **Consequence**: Old School Sweep requires opponent's forward pressure and low posture. Against high posture, you roll backwards but opponent doesn't come with you - they simply pull their leg free and pass. Timing is completely wrong for this sweep.
- **Correction**: Use Old School only when opponent drives pressure forward with low posture. If they're upright, use Electric Chair instead which works against high posture. Match your technique to opponent's position and pressure.
- **Recognition**: If you attempt Old School but opponent stays standing/upright as you roll, you mistimed it. You should feel their weight coming over you as you roll.

### Error: Forgetting to whip the lockdown before sweeping
- **Consequence**: Sweeps lack power and off-balancing effect. Without the whip motion (sudden jerk on trapped leg), opponent maintains base and prevents sweep completion. You're just trying to move dead weight instead of exploiting their reaction to off-balancing.
- **Correction**: Before initiating sweep, give a sharp "whip" with your lockdown - pulse the triangle tight suddenly to jerk their leg and disrupt their balance. Then immediately execute your sweep during this moment of imbalance. The whip is what makes lockdown sweeps work.
- **Recognition**: If sweeps feel heavy and opponent doesn't react to your initial movement, you likely didn't whip first. The whip should create a visible reaction in opponent.

## Training Drills

### Drill 1: Lockdown Triangle Entry and Maintenance
From half guard bottom, practice entering the lockdown triangle smoothly. Partner starts with knee shield or traditional half guard pressure. You weave bottom leg over their shin, hook top leg, and lock ankle behind their knee/calf. Hold for 10 seconds maintaining tension, then release and repeat. Progress through resistance levels: 0% (compliant), 25% (slight resistance), 50% (moderate resistance to entry), 75% (active opposition). Focus on: quick entry, tight triangle, constant tension, hip angle. Partner should feel their leg completely controlled. Common mistakes include loose triangle or staying flat - maintain 45-degree hip angle. Perform 5-10 reps per round, 3 rounds.

### Drill 2: Old School Sweep Mechanics
With lockdown locked and inside bicep grip secured, practice rolling backwards over your shoulder while pulling opponent with lockdown. Partner starts at 0% resistance (allowing sweep). Focus on: whipping lockdown before rolling, maintaining triangle through roll, landing in top half guard. Progress to 25% resistance (partner posts lightly), then 50% (partner attempts to resist but allows completion). Pay attention to timing - sweep when partner drives forward pressure, not when upright. Partner should feel pulled over you like catapult. Common mistakes: not whipping first, losing lockdown during roll, poor landing position. Perform 5 sweeps per side, 3 rounds with increasing resistance.

### Drill 3: Electric Chair Setup and Elevation
From lockdown with underhook, practice elevating partner's hips off the mat. Start with partner at 0% resistance, allowing elevation. Focus on: secure underhook, whipping lockdown while lifting with underhook, getting their hips elevated. Progress through 25% (partner stays heavy), 50% (partner attempts to sprawl), 75% (partner actively defends). The elevation should feel smooth - using lockdown and underhook together. Partner should feel their weight shifting sideways and upward. Common mistakes: attempting without proper underhook, not whipping lockdown, trying to muscle instead of technique. Hold elevated position 3 seconds per rep, 5 reps per round, 3 rounds.

### Drill 4: Whip Up to Dog Fight Transition
From lockdown with opponent posting or pulling away, practice whipping your hips up to come to your knees. Partner starts with hands posted (0% resistance). You whip lockdown and use momentum to rise to knees into dog fight. Progress to partner attempting to drive you down (50% resistance), then full opposition (75%). Focus on: explosive whip motion, using their forward momentum, landing balanced on knees. Partner should feel their base disrupted by your upward movement. Common mistakes: slow rise (not explosive), losing lockdown too early, poor balance in dog fight. Perform 5 reps per round, 3 rounds with increasing resistance. Time should improve as you develop technique - goal under 2 seconds from lockdown to dog fight.

### Drill 5: Lockdown Defense Flow
Partner locks lockdown on you. Practice the defensive sequence: sprawl weight back, establish hand grips, extract trapped leg while maintaining pressure, prevent their sweeps. Start with 50% speed flow. Partner should attempt their sweeps as you defend, creating realistic sequence. Focus on: keeping weight back, not getting swept, extracting leg safely. Both partners benefit - you learn to defend, they learn to attack. Flow through 2-minute rounds. Common mistakes: diving pressure forward (getting swept), pulling straight back (exposing back), neglecting hand control (allowing underhooks). Switch roles every round, 5 rounds total for position familiarity from both perspectives.

## Related Positions

- [[Half Guard Bottom]] - Traditional half guard is the foundation; lockdown is an advanced variation with leg triangle control
- [[electric chair position]] - Natural progression from lockdown when you secure underhook and elevate opponent
- [[Deep Half Guard]] - Alternative bottom half guard variation; can transition from lockdown by inverting
- [[dogfight position]] - Common transition when you whip up to your knees from lockdown
- [[Rubber Guard]] - Related 10th Planet position also using leg control from guard, sharing systematic philosophy
- [[Z-Guard]] - Another half guard variation using knee shield; can transition between lockdown and Z-guard
- [[Half Guard Top]] - Understanding top position helps anticipate opponent's counters and defenses

## Optimal Submission Paths

**Fastest path to submission** (direct attack):
[[Lockdown Position]] → [[Vaporizer Submission]] → [[Won by Submission]]
*Reasoning: Direct leg attack from lockdown when opponent's leg is trapped. Requires specific knowledge and opponent vulnerability, but available immediately without transitions. Success rate lower but time to submission fastest.*

**High-percentage path** (systematic):
[[Lockdown Position]] → [[electric chair position]] → [[electric chair Sweep]] → [[Top Half Guard]] → [[Pass to Mount]] → [[Submission from Mount]] → [[Won by Submission]]
*Reasoning: Using lockdown to establish electric chair control, sweeping to top, then passing and submitting. More steps but each has high success rate. Follows 10th Planet systematic approach.*

**Old School Sweep path** (classic):
[[Lockdown Position]] → [[Old School Sweep]] → [[Top Half Guard]] → [[Pass to Side Control]] → [[Submission from Side Control]] → [[Won by Submission]]
*Reasoning: Classic Eddie Bravo sequence using rolling sweep to reverse position, then standard top game progression. High percentage sweep when opponent drives forward pressure.*

**Back Take path** (advanced):
[[Lockdown Position]] → [[Homer Simpson Back Take]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: Advanced technique using lockdown stretch to facilitate back take. Requires precise timing but leads directly to most dominant position. Best against opponent who extends trying to free leg.*

## Timing Considerations

**Best Times to Enter**:
- When opponent has one leg trapped in traditional half guard and drives forward pressure
- After recovering guard from side control when you catch one leg
- When opponent is tired and their leg awareness is diminished

**Best Times to Attack**:
- Immediately after securing lockdown (first 10-15 seconds) while opponent is adjusting
- When opponent drives forward pressure (Old School timing)
- When opponent posts hands to extract leg (Whip Up timing)
- When opponent establishes high posture (Electric Chair timing)

**Vulnerable Moments**:
- During initial lockdown entry - leg is exposed before triangle completes
- When attempting to switch from lockdown to other positions
- When lockdown loses tension and triangle becomes loose
- If opponent sprawls hard backwards while you're attacking

**Fatigue Factors**:
- Maintaining lockdown for extended periods drains hip flexor and quad endurance
- Old School and Electric Chair sweeps are explosive, requiring burst energy
- Extended lockdown battles where neither player advances creates mutual fatigue
- Opponent's fatigue makes your sweeps more effective; your fatigue makes lockdown weaker

## Competition Considerations

**Point Scoring**: Lockdown Position itself scores zero points (bottom half guard). Sweeps from lockdown score depending on rule set: 2 points (IBJJF), 2-4 points (ADCC for reversal). Submissions score finish. Position primarily valuable for its sweeping potential rather than point value.

**Time Management**: In gi competition under IBJJF, passive lockdown holding can draw stalling penalties. Must actively attack within 15-20 seconds of establishing position. In submission-only formats, lockdown is more viable for extended control as there are no stalling calls. Use lockdown aggressively early in match when fresh, or strategically late when opponent is fatigued.

**Rule Set Adaptations**: IBJJF gi - focus on Old School and Electric Chair sweeps for points, use lockdown briefly. ADCC no-gi - lockdown works exceptionally well, reversal scoring rewards sweeps highly, less friction aids techniques. Submission-only - can hold lockdown longer, focus on submissions like Vaporizer. Some rule sets restrict certain leg attacks from half guard - verify rules before competing.

**Competition Strategy**: Use lockdown as surprise weapon if opponent hasn't trained against it. Many traditional BJJ players lack lockdown defense experience. However, against 10th Planet trained opponents, they'll expect it and have counters. Consider lockdown when losing on points and need sweep for comeback - high percentage reversal. Be aware that some judges/referees view lockdown negatively or as stalling tactic - stay actively offensive to avoid perception issues.

## Historical Context

The Lockdown Position was developed and popularized by Eddie Bravo in the early 2000s as a cornerstone technique of his 10th Planet Jiu-Jitsu system. Eddie created the lockdown while training in no-gi competition, finding that traditional half guard lacked the control needed without gi grips. By adapting leg control concepts and creating the triangle lock around the opponent's leg, he transformed half guard bottom from primarily defensive into an offensive position.

The position gained fame after Eddie used it successfully against Royler Gracie in their ADCC 2003 superfight, helping him secure the famous submission victory. This match demonstrated that "Rubber Guard" and lockdown-based systems could work at the highest levels, even against legendary Gracie family members. The techniques spread rapidly through no-gi competition and MMA.

While traditional Brazilian Jiu-Jitsu practitioners initially viewed the lockdown skeptically, it has become increasingly accepted and integrated into modern BJJ, particularly in no-gi contexts. The position represents Eddie Bravo's philosophy of constantly innovating and adapting BJJ techniques beyond traditional gi-based approaches. Today, the lockdown is taught worldwide as a legitimate half guard variation, though it remains most strongly associated with 10th Planet schools and their systematic approach to the position.

## Coaching Cues

- "Triangle your legs tight - make it uncomfortable"
- "Don't just hold - sweep or submit"
- "Underhook for elevation, bicep grip for roll"
- "Angle your hips - never stay square"
- "Hide your exposed foot beneath their leg"
- "Pulse the lockdown to off-balance"
- "Old School when they're heavy, Electric Chair when they're tall"
- "Whip before you sweep"
- "Attack within 15 seconds or transition"
- "Your legs are a vice - constant tension"
