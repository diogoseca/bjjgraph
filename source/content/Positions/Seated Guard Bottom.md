---
# ============================================================================
# SEO METADATA
# ============================================================================
title: "Seated Guard Bottom | BJJ Position Guide | BJJ Graph"
description: "Master Seated Guard Bottom in BJJ. Complete guide covering leg attacks, sweeps, and transitions. Success rates: Beginner 60%, Intermediate 70%, Advanced 80%."
tags:
  - bjj
  - position
  - guard
  - open-guard
  - intermediate
  - leg-locks
  - seated

# ============================================================================
# STATE MACHINE CORE DATA
# ============================================================================
state_machine:
  # Core Identifiers
  state_id: "S105"
  position_name: "Seated Guard Bottom"
  alternative_names:
    - "Sitting Guard"
    - "Seated Open Guard"
    - "Butterfly Seated Position"

  # State Properties
  properties:
    point_value: 0
    position_type: "Defensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  # Success Probability Metrics
  metrics:
    position_retention:
      beginner: 60
      intermediate: 70
      advanced: 80
    advancement_probability:
      beginner: 40
      intermediate: 55
      advanced: 70
    submission_probability:
      beginner: 25
      intermediate: 40
      advanced: 60
    position_loss:
      beginner: 35
      intermediate: 25
      advanced: 15
    average_time_minutes: "1-2"

  # Offensive Transitions
  transitions:
    offensive:
      - name: "Butterfly Sweep"
        target_state: "S001"
        target_position: "Mount"
        success_rate:
          beginner: 45
          intermediate: 60
          advanced: 75
        transition_id: "T108"
        category: "sweep"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Hook sweep using butterfly hooks to off-balance and sweep opponent"

      - name: "Estima Lock"
        target_state: "Terminal"
        target_position: "Won by Submission"
        success_rate:
          beginner: 20
          intermediate: 35
          advanced: 55
        transition_id: "SUB099"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Inverted ankle lock attacking extended leg from seated position"

      - name: "Ankle Pick Sweep"
        target_state: "S007"
        target_position: "Side Control Top"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T211"
        category: "sweep"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Grab opponent's ankle and pull while pushing to sweep"

      - name: "Pull to Closed Guard"
        target_state: "S015"
        target_position: "Closed Guard Bottom"
        success_rate:
          beginner: 60
          intermediate: 70
          advanced: 80
        transition_id: "T030"
        category: "control"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Pull opponent into closed guard for more control"

      - name: "Straight Ankle Lock"
        target_state: "Terminal"
        target_position: "Won by Submission"
        success_rate:
          beginner: 25
          intermediate: 40
          advanced: 60
        transition_id: "SUB039"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Traditional straight ankle lock from seated guard leg control"

      - name: "Transition to X-Guard"
        target_state: "S025"
        target_position: "X-Guard Bottom"
        success_rate:
          beginner: 35
          intermediate: 50
          advanced: 65
        transition_id: "T064"
        category: "control"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Insert hooks to create X-Guard configuration"

    # Defensive Responses
    defensive:
      - name: "Pass to Side Control"
        target_state: "S007"
        target_position: "Side Control Top"
        success_rate: 45
        counter_category: "pass"
        description: "Opponent circles around legs to achieve side control"

      - name: "Standing Pass"
        target_state: "S005"
        target_position: "Standing Guard Pass"
        success_rate: 40
        counter_category: "pass"
        description: "Opponent stands up and controls distance to pass"

      - name: "Knee Cut Pass"
        target_state: "S007"
        target_position: "Side Control Top"
        success_rate: 50
        counter_category: "pass"
        description: "Opponent drives knee through legs to pass guard"

      - name: "Sprawl and Disengage"
        target_state: "S004"
        target_position: "Standing Neutral"
        success_rate: 35
        counter_category: "escape"
        description: "Opponent sprawls away and disengages from guard entirely"

    # Counter Transitions
    counters:
      - opponent_action: "Standing Guard Pass Attempt"
        your_counter: "Ankle Pick Sweep"
        target_state: "S007"
        success_rate: 55
        description: "Counter standing pass with ankle attack"

      - opponent_action: "Pressure Forward"
        your_counter: "Butterfly Sweep"
        target_state: "S001"
        success_rate: 60
        description: "Use forward pressure against them with butterfly hooks"

  # Decision Tree Logic
  decision_tree:
    - condition: "opponent maintains low base with knees wide"
      priority: 1
      indicators:
        - "Knees outside your frame"
        - "Low center of gravity"
        - "Strong base position"
      actions:
        - technique: "Butterfly Sweep"
          target_state: "S001"
          probability: 60
          reasoning: "Wide base makes them vulnerable to hook sweeps"
        - technique: "Ankle Pick Sweep"
          target_state: "S007"
          probability: 55
          reasoning: "Exposed ankles during low base"

    - condition: "opponent stands up creating distance"
      priority: 2
      indicators:
        - "Feet on mat"
        - "Hips elevated"
        - "Creating space"
      actions:
        - technique: "Ankle Pick Sweep"
          target_state: "S007"
          probability: 70
          reasoning: "Standing makes ankles primary target"
        - technique: "Straight Ankle Lock"
          target_state: "Terminal"
          probability: 40
          reasoning: "Extended leg vulnerable to leg locks"

    - condition: "opponent extends leg for pass"
      priority: 3
      indicators:
        - "Leg extended"
        - "Attempting leg drag"
        - "Knee slice attempt"
      actions:
        - technique: "Estima Lock"
          target_state: "Terminal"
          probability: 55
          reasoning: "Extended leg creates leg lock opportunity"
        - technique: "Pull to Closed Guard"
          target_state: "S015"
          probability: 70
          reasoning: "Close distance to negate pass"

    - condition: "default - opponent in neutral stance"
      priority: 4
      indicators:
        - "Balanced position"
        - "Grip fighting"
        - "No clear commitment"
      actions:
        - technique: "Transition to X-Guard"
          target_state: "S025"
          probability: 50
          reasoning: "Create more powerful sweeping position"
        - technique: "Pull to Closed Guard"
          target_state: "S015"
          probability: 70
          reasoning: "Establish more controlling guard variant"

  # State Invariants
  invariants:
    physical:
      - "Buttocks on mat, weight supported by sitting"
      - "Legs active and mobile in front of body"
      - "Torso upright or leaning slightly back"
      - "Hands free for grips and posting"

    control:
      - "Legs positioned to block opponent's advance"
      - "Active foot positioning on opponent's hips/legs"
      - "Grip control on opponent's sleeves/arms"
      - "Distance management with leg frames"

    opponent_limitations:
      - "Cannot easily establish strong chest pressure"
      - "Must navigate around active legs"
      - "Vulnerable to sweeps when standing"
      - "Exposed to leg attacks if extending legs"

  # Training Considerations
  training:
    prerequisites:
      positions:
        - "[[Open Guard Bottom]]"
        - "[[Butterfly Guard Bottom]]"

      skills:
        - "Hip mobility and flexibility"
        - "Active foot placement"
        - "Grip fighting fundamentals"

      concepts:
        - "[[Distance Management]]"
        - "[[Guard Retention]]"
        - "[[Leg Lock Basics]]"

    optimal_conditions:
      - "When opponent stands or creates distance"
      - "During scrambles requiring quick guard recovery"
      - "Against opponents vulnerable to leg attacks"

    vulnerable_moments:
      - "When opponent drives forward with heavy pressure"
      - "If back is flat on mat (loss of seated posture)"
      - "When legs are controlled or passed"

    energy_fatigue_factors:
      - "Requires core strength to maintain upright posture"
      - "Leg activity drains energy over extended periods"
      - "Less restful than closed guard positions"

  # Position Progressions
  progressions:
    leads_to:
      - state_id: "S025"
        position: "X-Guard Bottom"
        relationship: "natural_progression"
        description: "Insert hooks to create more powerful sweeping position"

      - state_id: "S015"
        position: "Closed Guard Bottom"
        relationship: "dominant_transition"
        description: "Pull opponent close for more controlling guard"

    related_positions:
      - state_id: "S019"
        position: "Butterfly Guard Bottom"
        relationship: "similar_offensive"
        description: "Similar seated position with butterfly hooks inserted"

      - state_id: "S014"
        position: "Open Guard Bottom"
        relationship: "variation"
        description: "Generic open guard with similar defensive principles"

      - state_id: "S050"
        position: "Leg Entanglement Position"
        relationship: "specialized"
        description: "Leg lock specific positions from seated guard"

# ============================================================================
# SCHEMA.ORG STRUCTURED DATA
# ============================================================================
schema_org:
  howto:
    type: "HowTo"
    name: "How to Use Seated Guard Bottom in BJJ"
    description: "Complete guide to executing techniques and transitions from Seated Guard Bottom."
    total_time: "PT5M"

    steps:
      - name: "Establish Seated Guard"
        text: "From standing or scramble, sit down with legs active in front, maintain upright posture"
        position: 1

      - name: "Control Distance with Legs"
        text: "Use feet on opponent's hips/thighs to manage distance and prevent pressure passing"
        position: 2

      - name: "Grip Fighting"
        text: "Establish sleeve or wrist grips to control opponent's posture and movement"
        position: 3

      - name: "Execute Butterfly Sweep"
        text: "Insert butterfly hooks and elevate opponent while off-balancing to sweep"
        position: 4

      - name: "Attack Extended Legs"
        text: "When opponent extends leg, attack with Estima Lock or ankle lock variations"
        position: 5

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  faq:
    - question: "What is the main advantage of Seated Guard Bottom?"
      answer: "Seated Guard provides excellent mobility and versatility, allowing quick transitions to sweeps, leg locks, and other guard variations. The seated posture maintains offensive threat while managing distance from standing opponents."
      category: "fundamentals"

    - question: "When should I use Butterfly Sweep from Seated Guard?"
      answer: "Execute Butterfly Sweep when opponent maintains low base with knees wide. Their wide stance makes them vulnerable to hook elevation. Insert butterfly hooks and sweep when their weight is centered or slightly forward."
      category: "tactics"

    - question: "How do I prevent opponent from passing Seated Guard?"
      answer: "Maintain active leg frames on opponent's hips/thighs, keep hands grip fighting, stay upright (not flat), and constantly adjust distance. If opponent pressures forward, use butterfly sweep or pull to closed guard."
      category: "defense"

    - question: "What are the key control points in Seated Guard Bottom?"
      answer: "Key controls: active foot positioning on opponent's body, sleeve/wrist grips preventing posture control, upright seated posture (not flat), hip mobility to adjust angles. Distance management through leg frames is critical."
      category: "fundamentals"

    - question: "When are leg locks available from Seated Guard?"
      answer: "Leg locks become available when opponent extends leg during pass attempts, stands up creating distance, or commits leg forward during engagement. Estima Lock and straight ankle locks are highest percentage from this position."
      category: "tactics"

# ============================================================================
# LLM CONTEXT BLOCK
# ============================================================================
llm_context:
  position_summary: "Seated Guard Bottom is a mobile open guard position where practitioner sits upright with active legs managing distance, creating opportunities for sweeps and leg attacks."

  key_success_factors:
    - factor: "Active Leg Frames"
      importance: "critical"
      description: "Feet must constantly adjust on opponent's hips/thighs to manage distance and prevent heavy pressure passing"
      game_impact: "Without active legs, position retention drops 30%"

    - factor: "Upright Posture Maintenance"
      importance: "critical"
      description: "Core strength keeps torso upright preventing flat back position which eliminates offensive threats"
      game_impact: "Flat back position reduces sweep success by 40%"

    - factor: "Grip Control"
      importance: "high"
      description: "Sleeve or wrist grips prevent opponent from controlling distance and establishing dominant grips"
      game_impact: "No grips reduces position retention by 20%"

    - factor: "Distance Management"
      importance: "high"
      description: "Legs adjust distance constantly - too close allows pressure passing, too far reduces control"
      game_impact: "Poor distance management increases pass success by 25%"

    - factor: "Hip Mobility"
      importance: "medium"
      description: "Ability to shift weight and adjust angles creates sweep opportunities and prevents passes"
      game_impact: "Limited hip mobility reduces sweep success by 15%"

  common_questions:
    - q: "When should I pull to closed guard vs. stay seated?"
      a: "Pull to closed guard when opponent pressures forward heavily or you want more control. Stay seated when you want mobility, sweep opportunities, or leg lock attacks. Advanced players stay seated more often."
      context: "decision_making"
      skill_level: "intermediate"

    - q: "How do I deal with standing passes from seated guard?"
      a: "When opponent stands: attack ankles with pick sweeps, threaten leg locks to force them back down, transition to X-guard for elevation sweeps, or pull them back into closed guard if possible."
      context: "defensive"
      skill_level: "intermediate"

    - q: "What makes seated guard effective for leg locks?"
      a: "Seated position naturally isolates opponent's legs when they attempt passes. Extended legs during passing create leg lock opportunities. Your seated posture gives angle advantage for inverted ankle locks like Estima Lock."
      context: "offensive"
      skill_level: "advanced"

    - q: "How do I maintain energy in seated guard?"
      a: "Use strategic moments to flatten briefly and rest while maintaining leg frames. Don't fight grip battles you can't win. Transition to closed guard if needing recovery. Focus on efficiency over constant activity."
      context: "tactical"
      skill_level: "intermediate"

    - q: "When is seated guard vulnerable?"
      a: "Most vulnerable when: flat on back (lost seated posture), legs controlled or pinned, opponent establishes heavy chest pressure, or when fatigued and unable to maintain active leg frames."
      context: "defensive"
      skill_level: "beginner"

  coaching_cues:
    - "Stay upright - core engaged, don't flatten"
    - "Active feet - constantly adjust on hips and legs"
    - "Grip fight - control their sleeves, not their grips"
    - "Distance management - not too close, not too far"
    - "When they stand, attack their ankles"
    - "Butterfly hooks when they come low"
    - "Leg locks when legs extend"
    - "Pull to closed guard if overwhelmed"

  training_focus:
    beginner:
      - "Maintaining seated posture without falling flat"
      - "Basic distance management with leg frames"
      - "Simple butterfly sweep mechanics"
      - "Pull to closed guard when pressured"

    intermediate:
      - "Ankle pick sweeps against standing passes"
      - "Grip fighting to prevent opponent control"
      - "Basic leg lock attacks (straight ankle)"
      - "Transitions to X-Guard and other guards"

    advanced:
      - "Estima Lock and inverted ankle attacks"
      - "Complex sweep chains and combinations"
      - "Reading opponent pass attempts for counters"
      - "Energy management and position sustainability"

  game_engine_hints:
    energy_cost_factors:
      - "Maintaining position: Medium drain per turn (core work)"
      - "Active sweep attempts: Medium-High energy cost"
      - "Leg lock attacks: Medium energy requirement"

    position_strength: "Versatile guard offering offensive leg attacks and sweeps while maintaining defensive mobility"

    opponent_pressure: "Medium stress - opponent must navigate active legs and defend leg lock threats"

    ideal_scenarios:
      - "Opponent stands up creating distance (ankle attacks)"
      - "Opponent maintains wide low base (butterfly sweeps)"
      - "Opponent extends legs during pass attempts (leg locks)"

    dilemma_creation:
      - "Standing to pass opens ankle attacks and leg locks"
      - "Staying low with wide base opens butterfly sweep opportunities"
      - "Driving forward heavily opens pulling to closed guard or off-balancing sweeps"

  success_modifiers:
    - condition: "Strong leg frames established"
      modifier: +10
      applies_to: "position_retention"
      description: "Active foot control prevents pressure passing"

    - condition: "Opponent standing"
      modifier: +15
      applies_to: "ankle_attacks"
      description: "Standing exposes ankles and creates leg lock opportunities"

    - condition: "Opponent flat on back"
      modifier: -30
      applies_to: "all_offensive_transitions"
      description: "Losing upright posture eliminates offensive threats"

    - condition: "Grip control established"
      modifier: +10
      applies_to: "sweeps"
      description: "Sleeve grips improve sweep timing and control"

    - condition: "Knowledge test passed (80%+)"
      modifier: +10
      applies_to: "position_retention|leg_attacks"
      description: "Understanding seated guard mechanics improves execution"

    - condition: "Opponent pressures heavily forward"
      modifier: +10
      applies_to: "butterfly_sweep"
      description: "Forward pressure aids elevation sweeps"

  dilemmas:
    - scenario: "Opponent stands to pass guard"
      dilemma_created: "Standing creates distance but exposes ankles to attacks"
      offensive_options:
        - "[[Ankle Pick Sweep]] → [[Side Control Top]] (Success: 70%)"
        - "[[Straight Ankle Lock]] → [[Won by Submission]] (Success: 40%)"
      narrative: "As your opponent stands, their ankles become primary targets. Attack quickly before they establish passing distance."

    - scenario: "Opponent stays low with wide base"
      dilemma_created: "Low base prevents leg locks but creates butterfly sweep opportunity"
      offensive_options:
        - "[[Butterfly Sweep]] → [[Mount]] (Success: 60%)"
        - "[[Pull to Closed Guard]] → [[Closed Guard Bottom]] (Success: 70%)"
      narrative: "Your opponent's wide low base makes them stable against leg attacks but vulnerable to elevation sweeps using butterfly hooks."

    - scenario: "Opponent drives forward with pressure"
      dilemma_created: "Forward pressure threatens to pass but allows closed guard pull or off-balance"
      offensive_options:
        - "[[Pull to Closed Guard]] → [[Closed Guard Bottom]] (Success: 75%)"
        - "[[Butterfly Sweep]] → [[Mount]] (Success: 55%)"
      narrative: "Their forward momentum can be redirected - pull them into closed guard for control or use their weight against them with a sweep."

  narrative_prompts:
    entry: "You establish seated guard, sitting upright with legs active between you and your opponent. Your feet find their hips, managing distance."
    control: "Your legs frame constantly, adjusting pressure and distance. Your grips control their sleeves. You maintain the dynamic equilibrium of seated guard."
    attack_initiation: "You recognize the opportunity - their leg extends or their base widens. Your legs prepare for the sweep or your hands move toward their ankle."
    success: "The technique works perfectly. Their base crumbles or you sweep them over. You transition smoothly to dominant position."
    failure: "They defend effectively, maintaining their balance and base. You reset, legs still active, looking for the next opening."
    position_loss: "Heavy pressure drives you flat or they navigate past your legs. The seated guard is compromised - recover quickly or accept the pass."

    sweep_setup: "You feel their weight distribution shift, their base widen. The sweep opportunity appears - hooks insert, elevation begins."
    leg_lock_setup: "Their leg extends during the pass attempt. Your hands recognize the ankle lock opportunity before they do. The trap closes."
    defensive_hold: "You maintain active leg frames against their pressure. Distance stays optimal. Your grips prevent their control. The guard holds."

  knowledge_questions:
    - question: "What are the three critical elements for maintaining Seated Guard Bottom?"
      answer: "1) Upright seated posture (not flat), 2) Active leg frames on opponent's body managing distance, 3) Grip control on sleeves/wrists preventing opponent's posture dominance. These three elements work together to maintain position integrity and offensive threat."
      difficulty: "beginner"
      category: "fundamentals"
      points: 10

    - question: "When opponent stands in your seated guard, which attack has highest success rate and why?"
      answer: "Ankle Pick Sweep (70% advanced success rate) because standing exposes their ankles as primary targets while creating base vulnerability. Their elevated hips make them susceptible to pulling attacks on ankle support points."
      difficulty: "intermediate"
      category: "tactics"
      points: 15

    - question: "How does Seated Guard integrate with leg lock systems?"
      answer: "Seated Guard naturally creates leg lock opportunities when opponents extend legs during pass attempts. The seated angle provides optimal positioning for inverted ankle locks (Estima Lock) and straight ankle locks. Position isolates opponent's legs while maintaining your offensive angle advantage."
      difficulty: "advanced"
      category: "systems"
      points: 20

    - question: "What is the primary difference between Seated Guard and Butterfly Guard?"
      answer: "Seated Guard is general seated position with active legs managing distance. Butterfly Guard specifically has butterfly hooks (feet on inner thighs) inserted. Seated Guard is preparatory; Butterfly Guard is committed sweep position. Transition occurs when hooks insert."
      difficulty: "intermediate"
      category: "technical_details"
      points: 15

    - question: "Why does losing upright posture (falling flat) make Seated Guard ineffective?"
      answer: "Flat back position eliminates core engagement needed for sweeps, reduces hip mobility for angle adjustments, makes it difficult to insert butterfly hooks, and allows opponent to establish heavy chest pressure. Upright posture is fundamental to all seated guard offensive capabilities."
      difficulty: "beginner"
      category: "fundamentals"
      points: 10
---

# Seated Guard Bottom
#bjj #position #guard #open_guard #intermediate

## State Description

Seated Guard Bottom is a dynamic open guard position where the practitioner sits upright on the mat with an engaged core, using active legs to manage distance and create offensive opportunities. This position serves as a versatile platform for sweeps, leg attacks, and transitions to other guard variations. Unlike closed guard's static control, seated guard prioritizes mobility and adaptability.

The position is characterized by the defender sitting upright (buttocks on mat, torso elevated) with legs active in front of the body, feet typically positioned on the opponent's hips, thighs, or knees to control distance. The hands work grip fighting, usually controlling the opponent's sleeves or wrists to prevent them from establishing dominant control. This guard is particularly effective against opponents who stand or create distance, as it maintains offensive threat while allowing quick reactions to passing attempts.

Seated guard offers excellent versatility - it creates opportunities for butterfly sweeps when the opponent stays low, ankle attacks when they stand, and leg locks when they extend their legs during passes. The primary disadvantage is energy demand: maintaining an upright seated posture requires constant core engagement, and active leg framing drains energy faster than more restful guard positions. The position becomes vulnerable when the practitioner falls flat on their back (losing the seated posture) or when the opponent establishes heavy forward pressure that compromises distance management.

## Visual Description

You are seated on your buttocks with your back off the mat, torso upright or leaning slightly back at approximately 45 degrees, core engaged to maintain this posture. Your legs are active and mobile in front of you, knees bent with feet positioned on your opponent's hips, thighs, or knees depending on their distance. Your arms extend forward, hands controlling their sleeves or wrists with grip fighting engagement.

Your opponent is positioned in front of you, either kneeling with knees wide apart or standing, trying to navigate past your leg frames. Your feet create constant pressure points on their body - pushing, pulling, or adjusting to maintain optimal distance. Weight distribution is on your sitting bones with some support from your hands when posting for stability or mobility.

The spatial relationship creates a dynamic distance management scenario: too close and opponent can drive heavy pressure; too far and you lose offensive control. Your active legs function as adjustable barriers - lifting when they drive forward, pulling when they create too much distance, framing laterally when they try to circle. Control mechanisms include foot pressure on their body, grip control preventing their posture dominance, and core strength maintaining your upright position. Movement capabilities include quick transitions to butterfly guard (insert hooks), X-guard (deep hook insertion), closed guard (pull close), or stand-up (if needed), while restrictions include limited upper body posting positions and vulnerability to losing upright posture under heavy pressure.

This creates strategic advantages of mobility, versatility, and leg attack opportunities while maintaining defensive flexibility against various passing styles.

## Key Principles

- **Core Engagement**: Constant core activation maintains upright seated posture which is fundamental to all seated guard capabilities
- **Active Leg Frames**: Feet must continuously adjust positioning on opponent's body to manage distance and prevent pressure passing
- **Distance Management**: Maintain optimal range - close enough for offensive control, far enough to prevent being flattened by pressure
- **Grip Fighting Priority**: Control opponent's sleeves/wrists to prevent their posture dominance and grip establishment
- **Hip Mobility**: Ability to shift weight and adjust angles creates sweep opportunities and defensive adjustments
- **Opportunistic Transitions**: Recognize windows to transition to butterfly guard, X-guard, closed guard, or leg attacks based on opponent positioning
- **Energy Efficiency**: Use strategic moments to briefly rest while maintaining frames; don't exhaust yourself with constant maximum effort

## Offensive Transitions

From this position, you can execute:

### Sweeps
- [[Butterfly Sweep]] → [[Mount]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
  - Insert butterfly hooks when opponent maintains low wide base, elevate and off-balance using hip elevation and hook pressure

- [[Ankle Pick Sweep]] → [[Side Control Top]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
  - When opponent stands, attack their ankle support by grabbing and pulling while pushing upper body

### Submissions
- [[Estima Lock]] → [[Won by Submission]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 55%)
  - Inverted ankle lock attacking opponent's extended leg during pass attempt with unique grip configuration

- [[Straight Ankle Lock]] → [[Won by Submission]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 60%)
  - Traditional ankle lock when opponent extends leg or attempts leg drag pass

### Position Improvements
- [[Pull to Closed Guard]] → [[Closed Guard Bottom]] (Success Rate: Beginner 60%, Intermediate 70%, Advanced 80%)
  - Pull opponent close and close legs to establish more controlling guard when needed

- [[Transition to X-Guard]] → [[X-Guard Bottom]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
  - Insert deep hooks to create powerful elevation sweeping position with superior angle control

## Defensive Responses

When opponent has this position against you, available counters:

- [[Pass to Side Control]] → [[Side Control Top]] (Success Rate: 45%)
  - Circle around active legs, control hip, establish chest pressure to achieve side control

- [[Standing Pass]] → [[Standing Guard Pass]] (Success Rate: 40%)
  - Stand up creating vertical distance, control grips, navigate past leg frames from standing

- [[Knee Cut Pass]] → [[Side Control Top]] (Success Rate: 50%)
  - Drive knee through legs cutting across body to achieve passing position

- [[Sprawl and Disengage]] → [[Standing Neutral]] (Success Rate: 35%)
  - Sprawl hips back away from leg frames, create distance, reset standing

## Decision Tree

**If** opponent maintains low base with knees wide:
- Execute [[Butterfly Sweep]] → [[Mount]] (Probability: 60%)
  - Reasoning: Wide base makes them vulnerable to hook elevation and off-balancing
- Or Execute [[Ankle Pick Sweep]] → [[Side Control Top]] (Probability: 55%)
  - Reasoning: Wide stance exposes ankles to grabbing attacks

**Else if** opponent stands up creating distance:
- Execute [[Ankle Pick Sweep]] → [[Side Control Top]] (Probability: 70%)
  - Reasoning: Standing makes ankles primary target, elevated hips create base vulnerability
- Or Execute [[Straight Ankle Lock]] → [[Won by Submission]] (Probability: 40%)
  - Reasoning: Standing often extends one leg forward, creating leg lock opportunity

**Else if** opponent extends leg for pass:
- Execute [[Estima Lock]] → [[Won by Submission]] (Probability: 55%)
  - Reasoning: Extended leg during pass creates inverted ankle lock opportunity
- Or Execute [[Pull to Closed Guard]] → [[Closed Guard Bottom]] (Probability: 70%)
  - Reasoning: Close distance quickly to negate pass attempt and establish control

**Else** (balanced opponent / default):
- Execute [[Transition to X-Guard]] → [[X-Guard Bottom]] (Probability: 50%)
  - Reasoning: Create more powerful sweeping position with hook insertion
- Or Execute [[Pull to Closed Guard]] → [[Closed Guard Bottom]] (Probability: 70%)
  - Reasoning: Establish more controlling guard variant when no clear opening exists

## Expert Insights

**John Danaher**: "Seated guard represents the intersection of mobility and offensive capability. The key principle is understanding that the upright posture is non-negotiable - without it, all offensive mechanisms disappear. The position creates a dynamic equilibrium where your leg frames and core strength work together to manage distance. From a systematic perspective, seated guard is the gateway position to both leg lock attacks and elevation sweeps. The opponent faces a dilemma: staying low makes them vulnerable to butterfly sweeps, standing exposes their ankles. This is efficient position design - multiple offensive paths from one defensive configuration. Maintain the seated posture, keep legs active, and the transitions become obvious."

**Gordon Ryan**: "In competition, I use seated guard as a transition position more than a long-term holding position. It's perfect when scrambling, when opponents stand, or when I want to threaten leg locks to force them back down. The energy cost is real - you can't sit in this position forever like closed guard. I'm looking for quick opportunities: they stand, I attack ankles; they stay low with wide base, I insert butterfly hooks and sweep. The position forces opponents to make decisions, and those decisions create openings. In training, develop your sensitivity to when to transition - staying seated too long against heavy pressure is fighting a losing battle. Know when to pull to closed guard or move to a different guard variant."

**Eddie Bravo**: "Seated guard integrates perfectly into the 10th Planet system because it's naturally set up for leg locks and rubber guard transitions. From seated position, you've got access to ankle locks, you can threaten the lockdown by grabbing their leg, you can work toward trucks and twister positions. What I teach my students is that seated guard is aggressive - you're sitting up, you're threatening, you're making them deal with your legs. It's not passive like lying back. Use the position to create chaos and opportunities. When they don't know whether you're going to sweep them, leg lock them, or pull them into rubber guard, they start making mistakes. That's when you capitalize. Stay creative, stay threatening, and don't just sit there - be actively dangerous."

## Common Errors

### Error: Falling Flat on Back
- **Consequence**: Losing upright posture eliminates all offensive capabilities, turns seated guard into defensive open guard with limited options, allows opponent to establish heavy chest pressure
- **Correction**: Constant core engagement to maintain upright position, use hands to post if needed, focus on sitting bones staying weighted on mat with torso elevated
- **Recognition**: If you feel your back touching mat behind shoulder blades, posture is lost and position is compromised

### Error: Passive Leg Frames
- **Consequence**: Static feet allow opponent to easily navigate past frames or establish dominant pressure, reduces position retention significantly
- **Correction**: Feet must constantly adjust - lifting, lowering, angling - to maintain optimal distance and pressure on opponent's body
- **Recognition**: If opponent is making steady progress toward passing without needing to address your legs, your frames are too passive

### Error: Over-Committing to Single Attack
- **Consequence**: Focusing too narrowly on one technique (e.g., only looking for butterfly sweep) makes you predictable and easier to defend
- **Correction**: Chain attacks together - if butterfly sweep defended, transition to ankle attack or pull to closed guard; maintain flexibility in offensive options
- **Recognition**: If you find yourself repeatedly attempting same technique with declining success, you're over-committing

### Error: Poor Distance Management
- **Consequence**: Too close allows opponent to flatten you with pressure; too far reduces your control and offensive threat
- **Correction**: Optimal distance has your feet on their hips/thighs with slight tension - can push or pull as needed without losing connection
- **Recognition**: If opponent easily establishes chest-to-chest pressure or if your feet are barely reaching them, distance is wrong

### Error: Neglecting Grip Fighting
- **Consequence**: Opponent establishes dominant sleeve or collar grips, controls your posture, makes passing attempts more successful
- **Correction**: Actively fight for sleeve/wrist control, prevent them from achieving dominant grips, break grips when disadvantageous
- **Recognition**: If opponent's grips feel controlling and you can't create movement, you lost the grip battle

### Error: Ignoring Energy Management
- **Consequence**: Maintaining maximum intensity seated guard for extended periods causes rapid fatigue, leading to position loss
- **Correction**: Use strategic moments to briefly rest (maintain frames but reduce intensity), transition to closed guard if needing recovery
- **Recognition**: If breathing heavily and struggling to keep torso upright, energy management is failing

### Error: Staying Seated When Should Transition
- **Consequence**: Remaining in seated guard during unfavorable circumstances (heavy pressure, fatigue, dominant opponent grips) leads to being passed
- **Correction**: Recognize when to pull to closed guard for more control, when to stand up, or when to transition to different guard variant
- **Recognition**: If feeling overwhelmed and defensive options narrowing, seated guard may not be appropriate position for current situation

## Training Drills

### Drill 1: Seated Posture Maintenance (Core Endurance)
Start in seated guard with partner applying progressively increasing forward pressure. Focus solely on maintaining upright seated posture without falling flat. Partner begins at 0% pressure (no forward drive), gradually increases to 25%, 50%, 75% as drill progresses. Duration: 3 sets of 60 seconds with 30-second rest. Focus points: core engagement, breathing pattern, posture maintenance under pressure. Common mistake in drill: allowing shoulders to fall backward toward mat. Success metric: maintaining upright position for full 60 seconds at 75% pressure.

### Drill 2: Active Leg Frame Adjustment (Distance Management)
Partner moves in various directions (forward, backward, circling left/right) while you maintain seated guard with active leg frames. Your feet must constantly adjust to maintain consistent distance and pressure on their hips/body. Start with slow deliberate movement (partner at 25% speed), progress to 50%, 75%, then 100% movement speed. 5-minute continuous drill with role switching. Focus: reactive foot positioning, maintaining optimal distance, preventing both chest pressure and losing connection. Success metric: partner cannot establish close chest pressure OR create complete separation throughout drill.

### Drill 3: Transition Recognition (Opportunity Drilling)
Partner randomly executes different actions (stands up, drives forward, widens base, extends leg for pass) while you recognize appropriate counter from seated guard. When they stand: ankle pick or ankle lock. When they drive forward: pull to closed guard or butterfly sweep. When base widens: butterfly sweep. When leg extends: leg lock or guard pull. Start at slow speed with partner calling out action before executing (learning phase), progress to full speed with no warning (testing phase). 10 reps each action type. Focus: pattern recognition, quick reaction, smooth transitions. Common mistake: defaulting to same response regardless of opponent action.

### Drill 4: Butterfly Sweep Progression (Sweep Mechanics)
From seated guard, insert butterfly hooks and practice elevation sweeps with progressive resistance. Partner provides 0% resistance (allows sweep completion), progress through 25% (mild resistance), 50% (realistic resistance), 75% (strong resistance), 100% (maximum defensive effort). 3 sweeps at each resistance level before progressing. Focus: hook insertion timing, elevation mechanics, off-balancing direction, follow-through to mount. Success metric: completing sweep successfully at 75% resistance without excessive struggle.

### Drill 5: Leg Lock Entry (Submission Setup)
Partner extends leg during simulated pass attempt; you establish grip for straight ankle lock or Estima Lock from seated guard. Drill emphasizes safe grip establishment and control WITHOUT completing submission. Partner extends leg at 50% speed, you catch it, establish grip, show position control, then release safely. 10 reps each leg, alternating straight ankle lock and Estima Lock grips. Focus: grip configuration, safety protocols, control before pressure, immediate release. This drill develops leg lock awareness and safety habits - never apply pressure during this specific drill.

## Related Positions

- [[Open Guard Bottom]] - Generic open guard serving as foundation for seated guard principles
- [[Butterfly Guard Bottom]] - Natural progression when butterfly hooks are inserted from seated position
- [[X-Guard Bottom]] - Advanced progression with deep hook insertion for powerful elevation sweeps
- [[Closed Guard Bottom]] - Alternative control position when pulling opponent close from seated guard
- [[Leg Entanglement Position]] - Specialized leg lock positions arising from seated guard leg attacks

## Optimal Submission Paths

**Fastest path to submission** (direct attack):
[[Seated Guard Bottom]] → [[Estima Lock]] → [[Won by Submission]]
*Reasoning: When opponent extends leg during pass, immediate inverted ankle lock creates fast finish if executed properly. Success rate varies by leg lock experience level (Advanced: 55%)*

**High-percentage path** (systematic):
[[Seated Guard Bottom]] → [[Transition to X-Guard]] → [[X-Guard Sweep]] → [[Mount]] → [[Armbar from Mount]] → [[Won by Submission]]
*Reasoning: Building to dominant position first (mount) provides higher overall success rate through positional progression rather than submission from guard*

**Alternative submission path** (variation):
[[Seated Guard Bottom]] → [[Pull to Closed Guard]] → [[Triangle Choke]] → [[Won by Submission]]
*Reasoning: When opponent drives forward heavily, pull to closed guard and attack neck, using their forward pressure against them*

**Sweep to dominance path** (positional):
[[Seated Guard Bottom]] → [[Butterfly Sweep]] → [[Mount]] → [[Armbar from Mount]] → [[Won by Submission]]
*Reasoning: Sweep when opponent maintains low wide base, establish mount dominance, then attack with high-percentage submission*

## Timing Considerations

**Best Times to Enter**:
- During scrambles when both practitioners are mobile and position is transitional
- After opponent stands or creates distance in open guard
- When initiating guard pull from standing position (sit down directly)

**Best Times to Attack**:
- Immediately when opponent stands (ankle attacks highly available)
- When opponent widens base low (butterfly sweep opportunity window)
- During opponent's pass attempts when legs extend (leg lock opportunities)

**Vulnerable Moments**:
- When opponent establishes heavy forward chest pressure (risk of being flattened)
- If core fatigues and maintaining upright posture becomes difficult
- When opponent controls both sleeves with dominant grips

**Fatigue Factors**:
- Core engagement drains energy faster than passive guard positions
- Active leg framing requires constant muscle activation
- Extended time in seated guard (2+ minutes) typically requires transition to more restful position

## Competition Considerations

**Point Scoring**: Seated Guard Bottom scores 0 points (bottom position). Successful sweeps from seated guard score 2 points plus points for resulting position (mount = 4 additional, total 6 points).

**Time Management**: Not ideal for holding leads late in matches due to energy cost. Better used actively when seeking sweeps or submissions. Consider transitioning to closed guard for time management when protecting lead.

**Rule Set Adaptations**: In IBJJF, certain leg locks illegal at lower belts - check ruleset before training leg attacks. In no-gi/submission-only competitions, seated guard becomes more powerful due to legal leg lock access. In gi competition, can use fabric grips to enhance control.

**Competition Strategy**: Seated guard works well early in match when fresh, against standing opponents, or when seeking active offensive positions. Less ideal when fatigued or defending leads. Excellent position for forcing opponents to engage rather than stalling.

## Historical Context

Seated guard evolved from traditional butterfly guard principles, becoming more prominent in modern BJJ as practitioners developed sophisticated leg attack systems. The position gained significant attention through leg lock specialists who used seated positions as entry points for lower body submissions. In contemporary BJJ, seated guard represents the intersection of traditional sweeping systems and modern leg attack methodology, making it essential for no-gi competition where leg locks are more prevalent.
