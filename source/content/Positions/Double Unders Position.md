---
title: "Double Unders Position | BJJ Position Guide | BJJ Graph"
description: "Master Double Unders Position in BJJ. Complete guide covering control mechanics, passing sequences, and defensive responses. Success rates: Beginner 65%, Intermediate 80%, Advanced 90%."
tags:
  - bjj
  - position
  - passing
  - top-control
  - fundamental

state_machine:
  state_id: "S342"
  position_name: "Double Unders Position"
  alternative_names:
    - "Double Underhook Pass"
    - "Double Under Control"
    - "Stack Pass Setup"

  properties:
    point_value: 0
    position_type: "Offensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  metrics:
    position_retention:
      beginner: 65
      intermediate: 80
      advanced: 90
    advancement_probability:
      beginner: 55
      intermediate: 70
      advanced: 85
    submission_probability:
      beginner: 15
      intermediate: 25
      advanced: 35
    position_loss:
      beginner: 30
      intermediate: 20
      advanced: 10
    average_time_minutes: "1-2"

  transitions:
    offensive:
      - name: "Stack Pass"
        target_state: "S003"
        target_position: "Side Control"
        success_rate:
          beginner: 55
          intermediate: 70
          advanced: 85
        transition_id: "T284"
        category: "pass"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Drive shoulders over hips, stack opponent, pass to side control"

      - name: "Knee Slice Pass"
        target_state: "S003"
        target_position: "Side Control"
        success_rate:
          beginner: 50
          intermediate: 65
          advanced: 80
        transition_id: "T291"
        category: "pass"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Transition to knee slice when stack is defended"

      - name: "Double Under Choke"
        target_state: "S999"
        target_position: "Won by Submission"
        success_rate:
          beginner: 15
          intermediate: 25
          advanced: 35
        transition_id: "T999"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Slow"
        description: "Trap collar and apply pressure with shoulder"

      - name: "Back Take"
        target_state: "S007"
        target_position: "Back Control"
        success_rate:
          beginner: 20
          intermediate: 35
          advanced: 50
        transition_id: "T155"
        category: "advancement"
        energy_cost: "High"
        execution_time: "Medium"
        description: "Circle to back when opponent turns to side"

    defensive:
      - name: "Hip Escape to Guard"
        target_state: "S015"
        target_position: "Closed Guard Bottom"
        success_rate: 40
        counter_category: "escape"
        description: "Shrimp hips away and re-establish guard"

      - name: "Arm Frame and Push"
        target_state: "S018"
        target_position: "Open Guard Bottom"
        success_rate: 35
        counter_category: "pressure"
        description: "Create frames and push passer away"

      - name: "Butterfly Hook Insertion"
        target_state: "S022"
        target_position: "Butterfly Guard"
        success_rate: 30
        counter_category: "control"
        description: "Insert butterfly hooks to regain guard"

    counters:
      - opponent_action: "Stack Pass Attempt"
        your_counter: "Angle Off and Re-guard"
        target_state: "S018"
        success_rate: 45
        description: "Angle body off centerline when stacked"

      - opponent_action: "Shoulder Pressure"
        your_counter: "Hip Escape"
        target_state: "S015"
        success_rate: 40
        description: "Shrimp away from shoulder pressure"

  decision_tree:
    - condition: "opponent maintains closed guard with strong hooks"
      priority: 1
      indicators:
        - "Legs locked around waist"
        - "Strong ankle connection"
        - "Hips elevated"
      actions:
        - technique: "Stack Pass"
          target_state: "S003"
          probability: 70
          reasoning: "Stack pressure breaks closed guard structure"
        - technique: "Knee Slice Transition"
          target_state: "S003"
          probability: 65
          reasoning: "Alternative when stack is defended"

    - condition: "opponent opens guard to defend stack"
      priority: 2
      indicators:
        - "Legs unhook"
        - "Hips drop to mat"
        - "Frames appearing"
      actions:
        - technique: "Immediate Pass"
          target_state: "S003"
          probability: 75
          reasoning: "Open guard creates passing window"
        - technique: "Knee Slice"
          target_state: "S003"
          probability: 70
          reasoning: "Transition to knee slice when legs open"

    - condition: "opponent turns to side creating back exposure"
      priority: 3
      indicators:
        - "Body angled away"
        - "Back partially exposed"
        - "Defensive curl"
      actions:
        - technique: "Circle to Back"
          target_state: "S007"
          probability: 50
          reasoning: "Back exposure creates back take opportunity"

    - condition: "opponent maintains strong defensive structure"
      priority: 4
      indicators:
        - "Frames active"
        - "Hip mobility maintained"
        - "Guard retention active"
      actions:
        - technique: "Maintain Pressure and Wait"
          target_state: "S342"
          probability: 60
          reasoning: "Patient pressure creates opportunities"
        - technique: "Switch to Alternative Pass"
          target_state: "S003"
          probability: 55
          reasoning: "Change passing angle"

  invariants:
    physical:
      - "Both arms wrapped under opponent's legs"
      - "Hands locked in gable or S-grip"
      - "Chest-to-chest connection maintained"
      - "Weight forward on opponent"

    control:
      - "Underhooks prevent opponent from creating distance"
      - "Grip prevents opponent from breaking posture"
      - "Pressure pins hips to mat"
      - "Shoulder position controls upper body"

    opponent_limitations:
      - "Cannot create significant distance"
      - "Limited ability to frame effectively"
      - "Hip mobility restricted"
      - "Must defend stack pressure"

  training:
    prerequisites:
      positions:
        - "Closed Guard Top"
        - "Open Guard Top"

      skills:
        - "Strong gripping ability"
        - "Pressure application"
        - "Stack mechanics"

      concepts:
        - "Pressure Passing"
        - "Control Point Hierarchy"
        - "Guard Opening"

    optimal_conditions:
      - "Opponent in closed guard with elevated hips"
      - "Grips established early in pass attempt"
      - "Strong base with forward pressure"

    vulnerable_moments:
      - "Initial grip establishment phase"
      - "When opponent creates frames"
      - "If base is narrow or high"

    energy_fatigue_factors:
      - "Maintaining pressure requires constant energy"
      - "Grip strength demands are high"
      - "Stack position can be fatiguing"

  progressions:
    leads_to:
      - state_id: "S003"
        position: "Side Control"
        relationship: "natural_progression"
        description: "Most common completion of double under pass"

      - state_id: "S007"
        position: "Back Control"
        relationship: "alternative"
        description: "When opponent turns away from pressure"

    related_positions:
      - state_id: "S015"
        position: "Closed Guard Top"
        relationship: "similar_offensive"
        description: "Starting position for double under entry"

      - state_id: "S018"
        position: "Open Guard Top"
        relationship: "similar_offensive"
        description: "Alternative entry point"

      - state_id: "S046"
        position: "Stack Pass Position"
        relationship: "variation"
        description: "Specific application of double under control"

schema_org:
  howto:
    type: "HowTo"
    name: "How to Use Double Unders Position in BJJ"
    description: "Complete guide to executing techniques and transitions from Double Unders Position."
    total_time: "PT3M"

    steps:
      - name: "Establish Double Underhooks"
        text: "From guard top, wrap both arms under opponent's legs and lock hands with gable or S-grip behind their back."
        position: 1

      - name: "Create Forward Pressure"
        text: "Drive weight forward onto opponent's hips, maintaining chest-to-chest connection."
        position: 2

      - name: "Control Posture"
        text: "Use shoulder pressure to control opponent's upper body and prevent frames."
        position: 3

      - name: "Stack or Pass"
        text: "Drive shoulders over opponent's hips to stack, or transition to knee slice pass."
        position: 4

      - name: "Complete Pass"
        text: "Maintain pressure as you move to side control, securing dominant position."
        position: 5

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  faq:
    - question: "What is the most common error in Double Unders Position?"
      answer: "Releasing pressure too early allows opponent to create frames and recover guard. Maintain constant forward pressure with chest-to-chest connection."
      category: "errors"

    - question: "When should I stack vs. transition to knee slice?"
      answer: "Stack when opponent maintains closed guard structure. Transition to knee slice when they open guard to defend or create frames."
      category: "tactics"

    - question: "How do I prevent opponent from escaping with hip movement?"
      answer: "Maintain underhook control with locked hands, keep weight forward, and use shoulder pressure to restrict hip mobility."
      category: "defense"

    - question: "What are the key control points in Double Unders Position?"
      answer: "Underhooks on both legs, locked hands behind back, chest-to-chest pressure, shoulder position controlling upper body, and forward weight distribution."
      category: "fundamentals"

    - question: "Can I attack submissions from Double Unders?"
      answer: "Yes - collar chokes, shoulder pressure chokes, and arm attacks are available, though passing is typically higher percentage."
      category: "tactics"

llm_context:
  position_summary: "Double Unders Position is an offensive passing position where both arms are wrapped under opponent's legs with hands locked, creating control for stack passes or transitions."

  key_success_factors:
    - factor: "Tight Underhook Control"
      importance: "critical"
      description: "Both arms must be deep under legs with hands locked securely, preventing opponent from creating distance or effective frames"
      game_impact: "Loss of underhooks reduces pass success by 25-30%"

    - factor: "Forward Pressure"
      importance: "critical"
      description: "Constant weight driving forward onto opponent's hips, maintaining chest-to-chest connection"
      game_impact: "Weak pressure allows guard recovery at 40-50% rate"

    - factor: "Shoulder Position"
      importance: "high"
      description: "Shoulders positioned to control opponent's upper body and prevent effective framing"
      game_impact: "Poor shoulder position reduces control by 20%"

    - factor: "Grip Strength"
      importance: "high"
      description: "Hands must stay locked throughout pass attempt, requiring endurance"
      game_impact: "Broken grip resets position to neutral"

    - factor: "Base Width"
      importance: "medium"
      description: "Feet positioned wide enough for stability while maintaining forward pressure"
      game_impact: "Narrow base makes position vulnerable to sweeps"

  common_questions:
    - q: "When is the best time to establish double underhooks?"
      a: "Enter when opponent opens closed guard, when passing from standing, or when transitioning from other guard positions. Timing the entry when opponent's legs are not actively defensive is critical."
      context: "tactical"
      skill_level: "beginner"

    - q: "How do I maintain pressure without using all my energy?"
      a: "Use body weight rather than muscle - position chest over hips, breathe steadily, and let gravity do the work. Shift weight dynamically rather than pushing statically."
      context: "technical"
      skill_level: "intermediate"

    - q: "What if opponent creates strong frames on my hips?"
      a: "Maintain underhooks, walk hands higher up their back to elevate hips, or transition to knee slice by releasing one underhook and using it to control the knee line."
      context: "adaptation"
      skill_level: "intermediate"

    - q: "Should I stack immediately or wait for opportunity?"
      a: "Patient pressure often creates better stacking opportunities. Wait for opponent to make defensive movement, then capitalize with immediate stack when their structure is compromised."
      context: "decision_making"
      skill_level: "advanced"

    - q: "How do I prevent opponent from turning to turtle?"
      a: "Maintain strong underhooks and chest pressure. If they start turning, immediately follow their rotation and circle to their back rather than forcing the pass."
      context: "problem_solving"
      skill_level: "advanced"

  coaching_cues:
    - "Get those underhooks deep"
    - "Lock your hands behind their back"
    - "Chest to chest - stay heavy"
    - "Drive your weight forward"
    - "Control with shoulder pressure"
    - "Don't let them create frames"
    - "Stack or slice - choose your pass"
    - "Maintain connection throughout"

  training_focus:
    beginner:
      - "Establishing underhooks correctly"
      - "Maintaining basic forward pressure"
      - "Understanding stack pass concept"
      - "Not releasing pressure prematurely"

    intermediate:
      - "Transitioning between stack and knee slice"
      - "Reading opponent's defensive reactions"
      - "Maintaining efficiency under fatigue"
      - "Finishing passes cleanly"

    advanced:
      - "Submission chains from double unders"
      - "Back take timing from defensive turns"
      - "Energy-efficient pressure application"
      - "High-level grip fighting"

  game_engine_hints:
    energy_cost_factors:
      - "Maintaining position: Medium drain per turn"
      - "Stack pass attempt: Medium-High cost"
      - "Holding against resistance: High drain"

    position_strength: "Strong offensive passing position with high completion rate when properly executed"

    opponent_pressure: "High stress position - opponent must defend constantly and use significant energy"

    ideal_scenarios:
      - "Opponent in closed guard with elevated hips"
      - "Opponent has weak frames or limited hip mobility"
      - "Passer has strong grip endurance and base"

    dilemma_creation:
      - "Defending stack opens knee slice opportunity"
      - "Creating frames to push away weakens leg control"
      - "Turning away to escape exposes back"

  success_modifiers:
    - condition: "Strong underhooks maintained"
      modifier: +15
      applies_to: "all_offensive_transitions"
      description: "Deep underhooks dramatically increase pass success"

    - condition: "Opponent fatigued"
      modifier: +10
      applies_to: "all_transitions"
      description: "Tired opponent has weaker frames and hip movement"

    - condition: "Forward pressure consistent"
      modifier: +10
      applies_to: "passing_attempts"
      description: "Constant pressure prevents guard recovery"

    - condition: "Grip broken"
      modifier: -20
      applies_to: "all_offensive_transitions"
      description: "Lost underhooks allow opponent to recover"

    - condition: "Base too narrow"
      modifier: -10
      applies_to: "position_retention"
      description: "Poor base makes position vulnerable"

  dilemmas:
    - scenario: "Opponent defends stack by creating frames"
      dilemma_created: "Frames push against chest but open legs for knee slice transition"
      offensive_options:
        - "Transition to Knee Slice Pass → Side Control (Success: 70%)"
        - "Maintain Pressure and Re-Stack → Side Control (Success: 60%)"
      narrative: "As your opponent pushes against your chest with frames, they inadvertently open their leg structure. This creates the perfect window to release one underhook and slice through with your knee."

    - scenario: "Opponent turns away to avoid stack"
      dilemma_created: "Turning creates back exposure but escapes direct pass pressure"
      offensive_options:
        - "Circle to Back Take → Back Control (Success: 50%)"
        - "Switch to Side Control → Side Control (Success: 65%)"
      narrative: "Your opponent turns away from your crushing pressure, seeking escape. As they turn, their back becomes exposed - a golden opportunity for the savvy passer."

    - scenario: "Opponent opens guard to defend"
      dilemma_created: "Opening guard removes stack threat but eliminates primary defense"
      offensive_options:
        - "Immediate Pass → Side Control (Success: 75%)"
        - "Knee Slice Through → Side Control (Success: 80%)"
      narrative: "Feeling the stack pressure building, your opponent opens their guard in defense. This defensive choice removes their primary barrier - you're through."

  narrative_prompts:
    entry: "You wrap both arms deep under your opponent's legs, locking your hands securely behind their back. The double underhooks are established - you control the passing game now."
    control: "Forward pressure drives your chest into theirs. Your underhooks are deep, your base is wide, and your opponent's defensive options are limited. You feel them working to create space, but your control is suffocating."
    attack_initiation: "You read their defensive positioning and see the opening. It's time to commit - stack or slice, the pass is coming."
    success: "Your pressure overcomes their defense. The pass completes smoothly as you establish side control, your opponent's guard finally broken."
    failure: "They create a critical frame at the perfect moment, pushing your weight off balance. Your underhooks slip and they recover guard position."
    position_loss: "Your grip breaks or your base narrows - the control is lost. Your opponent capitalizes immediately, recovering their guard structure."

---

# Double Unders Position
#bjj #position #passing #top-control #fundamental

## State Description

The Double Unders Position is an offensive guard passing position where the top practitioner has both arms wrapped underneath the bottom practitioner's legs with hands locked together behind their back. This position creates significant control and pressure, setting up powerful passing sequences, particularly the stack pass and transitions to knee slice variations.

The position earns no points itself but represents a dominant passing control that typically leads to guard passing and achieving side control. The double underhook configuration prevents the bottom player from creating effective distance or frames, while the top player's forward pressure restricts hip mobility and guard retention options.

This position is most effective when the top player maintains constant forward pressure with chest-to-chest connection, uses wide base for stability, and reads defensive reactions to choose between stacking or transitioning to alternative passing methods. The position can be maintained for 1-2 minutes but requires significant grip strength and energy to sustain under resistance.

## Visual Description

You are positioned on top with your torso forward and both arms threaded deep underneath your opponent's legs, hands locked together in a gable or S-grip behind their lower back or buttocks. Your chest maintains constant contact with their chest or upper abdomen, creating downward and forward pressure. Your opponent is on their back with legs elevated, attempting to maintain closed guard or creating defensive frames. Your head position is typically beside theirs or pressing into their shoulder, using it to control their upper body and prevent effective framing. Your feet are positioned wide with toes dug in, providing stable base and drive for forward pressure. Your weight is distributed predominantly forward onto your opponent's hips and core, restricting their ability to shrimp or move their hips away.

The locked hands behind their back create a structural unity where your arms work together, preventing them from breaking the connection. Your shoulders are slightly elevated but driving forward, creating continuous pressure that pins their hips to the mat.

This creates offensive advantage through control and pressure while limiting their defensive options and setting up multiple passing pathways.

## Key Principles

- **Deep Underhooks**: Arms must thread deeply under legs with hands locked securely behind back or buttocks
- **Forward Pressure**: Constant weight driving chest-to-chest, pinning hips to mat
- **Shoulder Control**: Using shoulder position to prevent effective frames on face or chest
- **Base Maintenance**: Wide feet position provides stability against sweeps and hip escapes
- **Grip Endurance**: Locked hands must be maintained throughout passing sequence
- **Pressure Efficiency**: Using body weight and positioning rather than pure muscle tension
- **Reading Reactions**: Observing opponent's defensive movements to choose passing method

## Offensive Transitions

From this position, you can execute:

### Guard Passes
- [[Stack Pass]] → [[Side Control]] (Success Rate: Beginner 55%, Intermediate 70%, Advanced 85%)
  - Drive shoulders over hips, stack opponent's weight onto shoulders, pass to side

- [[Knee Slice Pass]] → [[Side Control]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)
  - Release one underhook, transition to knee slice when stack is defended

- [[Long Step Pass]] → [[Side Control]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
  - Step one leg wide and deep while maintaining underhook control

### Position Advancements
- [[Back Take from Double Unders]] → [[Back Control]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 50%)
  - Circle to back when opponent turns away from pressure

- [[Mount Transition]] → [[Mount]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)
  - Step over to mount when passing to high position

### Submissions
- [[Double Under Choke]] → [[Won by Submission]] (Success Rate: Beginner 15%, Intermediate 25%, Advanced 35%)
  - Trap collar and apply shoulder pressure for choke

- [[Arm Attack from Double Unders]] → [[Submission Control]] (Success Rate: Beginner 10%, Intermediate 20%, Advanced 30%)
  - Isolate arm when opponent frames

## Defensive Responses

When opponent has this position against you, available counters:

- [[Hip Escape from Double Unders]] → [[Closed Guard Bottom]] (Success Rate: 40%)
  - Shrimp hips away aggressively, creating space to recover guard

- [[Frame and Push]] → [[Open Guard Bottom]] (Success Rate: 35%)
  - Create strong frames on face/chest and push to create distance

- [[Butterfly Hook Insertion]] → [[Butterfly Guard]] (Success Rate: 30%)
  - Insert butterfly hooks between their chest and your legs

- [[Arm Trap and Roll]] → [[Top Position]] (Success Rate: 25%)
  - Trap one arm and execute bridge-and-roll sweep

## Decision Tree

**If** opponent maintains closed guard with strong hooks:
- Execute [[Stack Pass]] → [[Side Control]] (Probability: 70%)
  - Reasoning: Stack pressure breaks closed guard structure effectively
- Or Execute [[Knee Slice Transition]] → [[Side Control]] (Probability: 65%)
  - Reasoning: Alternative when direct stack meets resistance

**Else if** opponent opens guard to defend stack pressure:
- Execute [[Immediate Pass]] → [[Side Control]] (Probability: 75%)
  - Reasoning: Open guard eliminates primary defensive barrier
- Or Execute [[Knee Slice]] → [[Side Control]] (Probability: 80%)
  - Reasoning: Open legs create perfect knee slice opportunity

**Else if** opponent turns to side creating back exposure:
- Execute [[Circle to Back]] → [[Back Control]] (Probability: 50%)
  - Reasoning: Back exposure creates high-value back take opportunity

**Else** (opponent maintains strong defensive structure):
- Maintain pressure and wait for opening → [[Double Unders Position]] (Probability: 60%)
  - Reasoning: Patient pressure forces errors and creates opportunities
- Or Switch to alternative passing method → [[Side Control]] (Probability: 55%)
  - Reasoning: Changing attack angle disrupts defensive structure

## Expert Insights

**John Danaher**: The double unders position exemplifies the principle of control preceding advancement. By establishing both underhooks, you create a structural configuration where your opponent's defensive options are severely limited. The key detail is maintaining forward pressure through body positioning rather than muscular effort - when your chest is directly over their hips with proper weight distribution, the pressure becomes sustainable and exhausting for them to defend. The decision between stack pass and knee slice should be determined entirely by their defensive reaction - never commit to one passing method before observing their response to your pressure.

**Gordon Ryan**: In competition, double unders is my highest-percentage passing position because it eliminates so many of their offensive options while giving me multiple passing pathways. The secret is getting your underhooks extremely deep - I want my hands locked at their mid-back or higher, not just at their hips. This creates maximum control and makes the stack pass nearly impossible to defend. When they defend the stack by pushing my face or creating frames, I immediately transition to knee slice - that defensive choice opens the passing lane perfectly. The position also fatigues opponents rapidly because they're carrying your weight constantly while trying to maintain defensive structure.

**Eddie Bravo**: While double unders is traditionally associated with gi passing, it's incredibly effective in no-gi if you adjust your grip structure and pressure angles. In our system, we use it as a transitional control position - get the underhooks, apply pressure, but be ready to flow immediately to alternatives when they defend. The position also sets up submissions that people don't expect - collar chokes, shoulder pressure chokes, even arm attacks when they create frames. Don't be so focused on passing that you miss submission opportunities. Be creative with your offense from double unders.

## Common Errors

### Error: Releasing Pressure Too Early
- **Consequence**: Allows opponent to create frames and recover guard structure, losing passing advantage and resetting position to neutral
- **Correction**: Maintain constant chest-to-chest pressure throughout entire passing sequence, only release when pass is complete and side control is established
- **Recognition**: If opponent is able to push you away or create significant space, pressure was released prematurely

### Error: Hands Locked Too Low on Hips
- **Consequence**: Reduces leverage for stack pass and allows opponent to maintain better hip mobility and defensive positioning
- **Correction**: Walk hands higher up opponent's back, ideally reaching mid-back or higher for maximum control and stacking leverage
- **Recognition**: Feeling opponent's hips moving freely despite underhooks indicates hands are locked too low

### Error: Narrow Base
- **Consequence**: Makes position vulnerable to sweeps, reduces stability, and limits ability to drive forward pressure effectively
- **Correction**: Maintain wide foot position with toes dug in, creating stable platform for pressure application and sweep defense
- **Recognition**: Feeling off-balance or being swept easily indicates base needs widening

### Error: High Hips
- **Consequence**: Reduces forward pressure effectiveness and makes position vulnerable to guard recovery and reversal attempts
- **Correction**: Keep hips low and driving forward, maintaining downward pressure vector onto opponent's core
- **Recognition**: Opponent easily creating frames on chest indicates hips are likely too high

### Error: Not Reading Defensive Reactions
- **Consequence**: Committing to stack pass when knee slice is available, or vice versa, reducing passing efficiency and success rate
- **Correction**: Observe opponent's defensive movements - frames indicate knee slice opportunity, flat posture indicates stack opportunity
- **Recognition**: Repeatedly failing pass attempts despite good position indicates poor reaction reading

### Error: Muscling Through Resistance
- **Consequence**: Rapid fatigue, reduced technical efficiency, and giving opponent time to escape or counter
- **Correction**: Use body weight and positional leverage, breathe steadily, apply pressure through weight distribution rather than muscle tension
- **Recognition**: Getting exhausted quickly or breathing heavily indicates over-reliance on muscular effort

### Error: Breaking Grip Connection
- **Consequence**: Loses underhook control immediately, allowing opponent to create distance and recover guard structure
- **Correction**: Maintain locked hands throughout entire passing sequence, strengthen grip endurance through specific training
- **Recognition**: Feeling hands slipping apart or opponent breaking grip indicates insufficient grip strength or endurance

## Training Drills

### Drill 1: Double Under Entry and Pressure Maintenance
From guard top position, practice establishing double underhooks and locking hands behind opponent's back, then maintaining forward pressure for 30-second intervals. Partner provides 25% resistance initially, increasing to 75% as proficiency develops. Focus on deep underhook placement, efficient hand locking, and sustainable pressure application through body positioning rather than muscle. Progress from static pressure holds to maintaining pressure as partner attempts to create frames and movement. 5 rounds of 30-second holds with 15-second rest, gradually increasing resistance and partner's defensive activity.

### Drill 2: Stack Pass Execution
Starting from established double unders position, practice driving shoulders over opponent's hips to create stack position, then completing pass to side control. Partner provides progressive resistance from 0% (allowing completion) to 100% (full defensive effort). Focus on timing of stack initiation, maintaining underhook control throughout stack, and finishing pass cleanly. Practice reading partner's defensive reactions - when they push face, when they open guard, when they turn away. 10 repetitions at each resistance level, emphasizing smooth technical execution and energy efficiency.

### Drill 3: Stack to Knee Slice Transition
From double unders position, practice reading partner's defensive frames and transitioning smoothly from stack pass attempt to knee slice pass. Partner creates defensive frames to simulate realistic resistance. Focus on identifying frame creation as trigger for transition, releasing one underhook cleanly, and converting to knee slice control immediately. Develop sensitivity to opponent's defensive positioning and ability to flow between passing methods without losing pressure or control. 10-15 repetitions emphasizing smooth transitions and maintained pressure throughout position change.

### Drill 4: Grip Endurance and Pressure Stamina
Establish double unders position and maintain it for 1-2 minute rounds while partner uses full defensive effort to escape, create frames, and break grips. Focus on grip endurance, efficient pressure application, and mental discipline to maintain position under fatigue. This drill develops the stamina required for high-level passing sequences and teaches energy conservation techniques. 3-5 rounds of 1-2 minutes with 1-minute rest between rounds. Track improvement in time maintained and quality of pressure despite fatigue.

### Drill 5: Live Passing from Double Unders
Establish double unders position in live rolling scenario and work to complete pass to side control against partner's full resistance. Partner can use all available defenses. Focus on reading reactions in real-time, choosing appropriate passing method, and completing passes under realistic conditions. This integrates all technical elements developed in previous drills into live application. 5-minute rounds focusing exclusively on passing from double unders, with brief coaching breaks to address specific challenges encountered.

## Related Positions

- [[Closed Guard Top]] - Common starting position for entering double unders control
- [[Stack Pass Position]] - Specific application of double under control with elevated hips
- [[Open Guard Top]] - Alternative entry point for double underhooks
- [[Side Control]] - Primary completion position after successful pass
- [[Knee Slice Position]] - Related passing position used as transition from double unders

## Optimal Submission Paths

**Fastest path to pass** (direct approach):
[[Double Unders Position]] → [[Stack Pass]] → [[Side Control]]
*Reasoning: Most direct passing method when opponent maintains closed guard structure and doesn't create significant defensive frames*

**High-percentage path** (adaptive):
[[Double Unders Position]] → [[Read Defense]] → [[Stack or Knee Slice]] → [[Side Control]]
*Reasoning: Observing opponent's defensive reaction before committing to specific pass increases success rate significantly*

**Alternative completion path** (back take):
[[Double Unders Position]] → [[Opponent Turns Away]] → [[Circle to Back]] → [[Back Control]]
*Reasoning: When opponent turns to avoid stack pressure, high-value back take becomes available*

**Submission threat path** (pressure finish):
[[Double Unders Position]] → [[Collar Trap]] → [[Double Under Choke]] → [[Won by Submission]]
*Reasoning: Submission threat from double unders creates additional pressure and can finish match directly*

## Timing Considerations

**Best Times to Enter**:
- When opponent opens closed guard from top position
- During standing guard pass as opponent's legs separate
- After defending sweep attempts from open guard

**Best Times to Attack**:
- When opponent's defensive frames are weak or absent
- After opponent becomes fatigued from defending pressure
- When opponent makes positional error or creates opening

**Vulnerable Moments**:
- Initial grip establishment phase before underhooks are deep
- When base narrows during passing attempt
- If forward pressure is released prematurely

**Fatigue Factors**:
- Maintaining locked hands requires significant grip endurance
- Forward pressure demands sustained energy output
- Position becomes more difficult to maintain as fatigue increases

## Competition Considerations

**Point Scoring**: Position itself scores no points but typically leads to guard pass (3 points IBJJF) when transitioning to side control or mount.

**Time Management**: Position can be maintained for 1-2 minutes but requires energy expenditure - balance between patient pressure and efficient passing.

**Rule Set Adaptations**: Highly effective in all rule sets. In gi, collar grips can be integrated for choke threats. In no-gi, requires even deeper underhooks due to reduced friction.

**Competition Strategy**: Use as high-percentage passing position in later match stages when points are needed, or early to establish dominance and tire opponent through constant defensive demands.
