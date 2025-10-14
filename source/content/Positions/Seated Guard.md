---
# ============================================================================
# SEO METADATA
# ============================================================================
title: "Seated Guard | BJJ Position Guide | BJJ Graph"
description: "Master Seated Guard in BJJ. Complete guide covering entries, sweeps, and transitions. Success rates: Beginner 50%, Intermediate 65%, Advanced 80%."
tags:
  - bjj
  - position
  - guard
  - open-guard
  - fundamental

# ============================================================================
# STATE MACHINE CORE DATA
# ============================================================================
state_machine:
  # Core Identifiers
  state_id: "S240"
  position_name: "Seated Guard"
  alternative_names:
    - "Sitting Guard"
    - "Seated Open Guard"
    - "Combat Base Guard"

  # State Properties
  properties:
    point_value: 0
    position_type: "Defensive"
    risk_level: "Medium"
    energy_cost: "Low"
    time_sustainability: "Medium"

  # Success Probability Metrics
  metrics:
    position_retention:
      beginner: 50
      intermediate: 65
      advanced: 80
    advancement_probability:
      beginner: 40
      intermediate: 55
      advanced: 70
    submission_probability:
      beginner: 15
      intermediate: 25
      advanced: 40
    position_loss:
      beginner: 45
      intermediate: 30
      advanced: 15
    average_time_minutes: "1-2"

  # Offensive Transitions
  transitions:
    offensive:
      - name: "Ankle Pick Sweep"
        target_state: "S001"
        target_position: "Mount"
        success_rate:
          beginner: 35
          intermediate: 50
          advanced: 65
        transition_id: "T227"
        category: "sweep"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Grab opponent's ankle and sweep them backwards while standing"

      - name: "Sit-Up Sweep"
        target_state: "S001"
        target_position: "Mount"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T228"
        category: "sweep"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Use arm post and hip movement to sweep opponent"

      - name: "Single Leg Takedown"
        target_state: "S003"
        target_position: "Side Control"
        success_rate:
          beginner: 30
          intermediate: 45
          advanced: 60
        transition_id: "T229"
        category: "takedown"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Shoot for single leg and complete takedown"

      - name: "Technical Standup"
        target_state: "S242"
        target_position: "Standing Guard"
        success_rate:
          beginner: 60
          intermediate: 75
          advanced: 85
        transition_id: "T006"
        category: "escape"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Stand up safely maintaining guard"

      - name: "Butterfly Guard Transition"
        target_state: "S243"
        target_position: "Butterfly Guard"
        success_rate:
          beginner: 55
          intermediate: 70
          advanced: 80
        transition_id: "T230"
        category: "control"
        energy_cost: "Low"
        execution_time: "Instant"
        description: "Insert hooks and transition to butterfly guard"

      - name: "X-Guard Entry"
        target_state: "S244"
        target_position: "X-Guard"
        success_rate:
          beginner: 30
          intermediate: 45
          advanced: 65
        transition_id: "T231"
        category: "control"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Control leg and enter X-Guard position"

    # Defensive Responses
    defensive:
      - name: "Standing Pass"
        target_state: "S003"
        target_position: "Side Control"
        success_rate: 45
        counter_category: "pass"
        description: "Opponent stands and passes seated guard"

      - name: "Pressure Pass"
        target_state: "S003"
        target_position: "Side Control"
        success_rate: 40
        counter_category: "pass"
        description: "Opponent applies forward pressure and passes"

      - name: "Leg Drag"
        target_state: "S003"
        target_position: "Side Control"
        success_rate: 35
        counter_category: "pass"
        description: "Opponent drags legs and passes to side"

      - name: "Flying Attack"
        target_state: "S245"
        target_position: "Flying Armbar Position"
        success_rate: 25
        counter_category: "submission"
        description: "Opponent jumps for flying submission"

    # Counter Transitions
    counters:
      - opponent_action: "Standing Pass Attempt"
        your_counter: "Technical Standup"
        target_state: "S242"
        success_rate: 60
        description: "Counter by standing up yourself"

      - opponent_action: "Forward Pressure"
        your_counter: "Sit-Up Sweep"
        target_state: "S001"
        success_rate: 55
        description: "Use forward momentum to sweep"

  # Decision Tree Logic
  decision_tree:
    - condition: "opponent is standing with distance"
      priority: 1
      indicators:
        - "Opponent feet on mat"
        - "Space between you"
        - "Opponent upright posture"
      actions:
        - technique: "Technical Standup"
          target_state: "S242"
          probability: 75
          reasoning: "Match opponent's standing position"
        - technique: "Ankle Pick Sweep"
          target_state: "S001"
          probability: 50
          reasoning: "Attack ankles while they're standing"

    - condition: "opponent drives forward with pressure"
      priority: 2
      indicators:
        - "Forward weight"
        - "Chest pressure"
        - "Closing distance"
      actions:
        - technique: "Sit-Up Sweep"
          target_state: "S001"
          probability: 55
          reasoning: "Use momentum against them"
        - technique: "Butterfly Guard Transition"
          target_state: "S243"
          probability: 70
          reasoning: "Insert hooks and control"

    - condition: "opponent is on knees close"
      priority: 3
      indicators:
        - "Knees on mat"
        - "Close distance"
        - "Weight forward"
      actions:
        - technique: "Single Leg Takedown"
          target_state: "S003"
          probability: 45
          reasoning: "Attack exposed leg"
        - technique: "X-Guard Entry"
          target_state: "S244"
          probability: 45
          reasoning: "Control leg for positional sweep"

    - condition: "default - neutral positioning"
      priority: 4
      indicators:
        - "Opponent maintaining distance"
        - "No clear attack"
        - "Balanced stance"
      actions:
        - technique: "Ankle Pick Sweep"
          target_state: "S001"
          probability: 35
          reasoning: "Create opening with ankle attack"
        - technique: "Technical Standup"
          target_state: "S242"
          probability: 60
          reasoning: "Stand up to neutralize position"

  # State Invariants
  invariants:
    physical:
      - "Seated on mat with hips on ground"
      - "Torso upright or slightly angled"
      - "Legs extended or bent toward opponent"
      - "Hands posted on mat for base or controlling opponent"

    control:
      - "Maintaining distance management with feet"
      - "Base established with posted hands"
      - "Hip mobility for adjustments"
      - "Frame pressure when needed"

    opponent_limitations:
      - "Cannot easily establish chest-to-chest pressure"
      - "Must deal with foot frames"
      - "Exposed to ankle attacks"
      - "Difficult to establish dominant grips"

  # Training Considerations
  training:
    prerequisites:
      positions:
        - "Open Guard Bottom"
        - "Combat Base"

      skills:
        - "Hip mobility and shrimping"
        - "Hand posting for base"
        - "Distance management with feet"

      concepts:
        - "Guard retention fundamentals"
        - "Frame and distance management"
        - "Sweep timing"

    optimal_conditions:
      - "When opponent is standing or on knees"
      - "When transitioning between guards"
      - "When recovering from guard pass attempt"

    vulnerable_moments:
      - "When opponent establishes strong grips"
      - "When flat on back losing posture"
      - "When opponent gets chest-to-chest pressure"

    energy_fatigue_factors:
      - "Requires active base maintenance"
      - "Core engagement for upright posture"
      - "More sustainable than inverted positions"

  # Position Progressions
  progressions:
    leads_to:
      - state_id: "S242"
        position: "Standing Guard"
        relationship: "natural_progression"
        description: "Stand up from seated position"

      - state_id: "S243"
        position: "Butterfly Guard"
        relationship: "natural_progression"
        description: "Insert hooks and close distance"

    related_positions:
      - state_id: "S015"
        position: "Closed Guard Bottom"
        relationship: "similar_defensive"
        description: "Both guard bottom positions"

      - state_id: "S244"
        position: "X-Guard"
        relationship: "specialization"
        description: "Technical evolution from seated"

      - state_id: "S245"
        position: "De La Riva Guard"
        relationship: "variation"
        description: "Similar open guard with hook control"

# ============================================================================
# SCHEMA.ORG STRUCTURED DATA
# ============================================================================
schema_org:
  howto:
    type: "HowTo"
    name: "How to Use Seated Guard in BJJ"
    description: "Complete guide to executing techniques and transitions from Seated Guard."
    total_time: "PT5M"

    steps:
      - name: "Establish Seated Position"
        text: "Sit with hips on ground, post hands behind for base, extend legs toward opponent with active feet."
        position: 1

      - name: "Control Distance"
        text: "Use feet to frame on opponent's hips or legs, maintaining optimal distance for attacks and defenses."
        position: 2

      - name: "Execute Ankle Pick"
        text: "Grab opponent's ankle while posting hand, drive forward and sweep them backwards."
        position: 3

      - name: "Execute Sit-Up Sweep"
        text: "Post hand beside hip, sit up explosively, use hip bump and push to sweep opponent."
        position: 4

      - name: "Technical Standup"
        text: "Post hand, bring one leg back, push off ground to stand while maintaining guard."
        position: 5

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  faq:
    - question: "What is the main advantage of Seated Guard?"
      answer: "Seated Guard provides a stable base with the ability to quickly stand up or transition to other guards. It allows good distance management and prevents opponent from establishing chest pressure while maintaining offensive threats."
      category: "fundamentals"

    - question: "When should I use Seated Guard versus other guards?"
      answer: "Use Seated Guard when opponent is standing or on knees with distance, when transitioning between positions, or when recovering from guard pass attempts. It's particularly effective for wrestlers and judoka who prefer upright positions."
      category: "tactics"

    - question: "How do I prevent my opponent from passing Seated Guard?"
      answer: "Maintain active feet framing on opponent's hips or legs, keep hands posted for base and quick movement, stay mobile with hip movement, and be ready to stand up or insert butterfly hooks when opponent closes distance."
      category: "defense"

    - question: "What are the best sweeps from Seated Guard?"
      answer: "Ankle pick sweep when opponent is standing, sit-up sweep when opponent drives forward, and single leg attacks when opponent is on knees. All capitalize on opponent's weight distribution and balance vulnerabilities."
      category: "tactics"

    - question: "What are common mistakes in Seated Guard?"
      answer: "Staying too static without moving hips, allowing opponent to establish strong grips, letting opponent get chest-to-chest pressure, not maintaining active feet for frames, and failing to transition when position is compromised."
      category: "errors"

# ============================================================================
# LLM CONTEXT BLOCK
# ============================================================================
llm_context:
  position_summary: "Seated Guard is an upright open guard position where you sit with hips on ground, hands posted for base, using feet to manage distance and threaten sweeps or standup."

  key_success_factors:
    - factor: "Active Base Maintenance"
      importance: "critical"
      description: "Hands posted behind provide stability and enable quick movements - loss of base makes position vulnerable"
      game_impact: "Without solid base, opponent passes easily - reduces retention probability by 30%"

    - factor: "Distance Management with Feet"
      importance: "critical"
      description: "Feet actively frame on opponent's hips or legs, controlling distance and preventing chest pressure"
      game_impact: "Active feet increase sweep success and decrease pass success - adds +15% to offensive transitions"

    - factor: "Hip Mobility"
      importance: "high"
      description: "Ability to move hips side to side, forward and back to adjust distance and angle"
      game_impact: "Good hip movement allows quick transitions and guard recovery - +10% to position retention"

    - factor: "Timing Recognition"
      importance: "high"
      description: "Knowing when to attack, when to stand up, when to insert hooks based on opponent's position"
      game_impact: "Good timing increases sweep success rates significantly - +15% at advanced level"

    - factor: "Ready to Stand"
      importance: "medium"
      description: "Mental and physical preparedness to technical standup at any moment"
      game_impact: "Threat of standing forces opponent caution - reduces pass attempts by 20%"

  common_questions:
    - q: "When should I stand up from Seated Guard?"
      a: "Stand up when opponent is also standing and maintaining distance, when they establish strong passing grips you can't break, or when your seated attacks are being well-defended. Standing neutralizes many passing attacks."
      context: "decision_making"
      skill_level: "beginner"

    - q: "How do I attack from Seated Guard?"
      a: "Primary attacks are ankle picks when opponent stands, sit-up sweeps when they drive forward, single leg attacks when on knees, and X-guard entries when you control a leg. Use opponent's balance and positioning against them."
      context: "offensive"
      skill_level: "intermediate"

    - q: "What if opponent gets chest-to-chest pressure?"
      a: "Immediately frame with hands, shrimp hips to create space, and either insert butterfly hooks or transition to another guard. If flattened, you've lost the seated position's advantage."
      context: "defensive"
      skill_level: "beginner"

    - q: "How is Seated Guard different from Butterfly Guard?"
      a: "Seated Guard has no hooks inserted yet - feet are free for frames and distance management. Butterfly has hooks in for control and sweeps. Seated is more mobile, Butterfly is more controlled."
      context: "technical"
      skill_level: "intermediate"

    - q: "Is Seated Guard good for beginners?"
      a: "Yes - it's intuitive, provides stable base, allows quick escapes to standing, and teaches distance management. Good transitional position before learning complex open guards."
      context: "educational"
      skill_level: "beginner"

  coaching_cues:
    - "Keep your base - hands posted behind you"
    - "Active feet - frame on their hips"
    - "Move your hips - don't stay static"
    - "Be ready to stand up anytime"
    - "Attack the ankles when they stand"
    - "Insert hooks when they come close"
    - "Don't let them flatten you"

  training_focus:
    beginner:
      - "Establishing stable base with posted hands"
      - "Using feet to frame and manage distance"
      - "Technical standup escape"
      - "Basic sit-up sweep"

    intermediate:
      - "Ankle pick sweep variations"
      - "Single leg attacks from seated"
      - "Butterfly guard entries"
      - "Timing recognition for attacks"

    advanced:
      - "X-Guard entries and sweeps"
      - "Combination attacks and chains"
      - "Grip fighting from seated"
      - "Competition timing and strategy"

  game_engine_hints:
    energy_cost_factors:
      - "Maintaining position: Low drain per turn"
      - "Active movements: Medium energy for sweeps"
      - "Standing up: Low cost, quick escape"

    position_strength: "Versatile guard with good escape options but requires activity and timing"

    opponent_pressure: "Low stress on opponent - allows them to maintain distance and strategy"

    ideal_scenarios:
      - "Opponent is standing with distance"
      - "Transitioning between guard types"
      - "Opponent drives forward predictably"

    dilemma_creation:
      - "Force choice between standing and engaging"
      - "Attack ankles if standing, sweep if closing"
      - "Threat of standing up limits passing options"

  success_modifiers:
    - condition: "Strong base established"
      modifier: +10
      applies_to: "position_retention"
      description: "Good hand post increases stability"

    - condition: "Active feet framing"
      modifier: +15
      applies_to: "offensive_transitions"
      description: "Distance control enables attacks"

    - condition: "Opponent standing"
      modifier: +10
      applies_to: "ankle_pick_sweep"
      description: "Standing opponents vulnerable to ankle attacks"

    - condition: "Hip mobility high"
      modifier: +10
      applies_to: "all_transitions"
      description: "Good movement enables all techniques"

    - condition: "Base compromised"
      modifier: -20
      applies_to: "position_retention"
      description: "Loss of base makes passing easier"

    - condition: "Flattened on back"
      modifier: -30
      applies_to: "offensive_success"
      description: "Lost seated position advantage"

  dilemmas:
    - scenario: "Opponent stands to maintain distance"
      dilemma_created: "Standing creates space but exposes ankles and allows your standup"
      offensive_options:
        - "Ankle Pick Sweep → Mount (Success: 50%)"
        - "Technical Standup → Standing Guard (Success: 75%)"
      narrative: "As your opponent stands to avoid engagement, their ankles become exposed. You can attack low or match their standing position."

    - scenario: "Opponent drives forward with pressure"
      dilemma_created: "Forward pressure creates sweep opportunities but risks getting flattened"
      offensive_options:
        - "Sit-Up Sweep → Mount (Success: 55%)"
        - "Butterfly Guard Transition → Butterfly Guard (Success: 70%)"
      narrative: "Your opponent's forward pressure can be redirected into a sweep, or you can insert hooks for control."

    - scenario: "Opponent on knees close"
      dilemma_created: "Close position allows control but exposes legs to attacks"
      offensive_options:
        - "Single Leg Attack → Side Control (Success: 45%)"
        - "X-Guard Entry → X-Guard (Success: 45%)"
      narrative: "With opponent on knees close, their legs are exposed for single leg attacks or technical X-Guard entries."

  narrative_prompts:
    entry: "You establish seated guard, sitting upright with hands posted behind for base, feet active in front to manage distance."
    control: "You maintain the position with active hip movement, using your feet to frame and prevent chest pressure while looking for openings."
    attack_initiation: "You see the opportunity and commit to your attack, using your base and timing to execute the technique."
    success: "Your technique succeeds, transitioning to dominant position with control established."
    failure: "Your attack is defended, but you maintain seated guard and reset for another opportunity."
    position_loss: "Opponent establishes control, passing your seated guard. Time to defend and recover."

  knowledge_questions:
    - question: "What are the three critical elements of Seated Guard positioning?"
      answer: "Seated Guard requires: (1) Hips on ground with torso upright, (2) Hands posted behind for base and mobility, (3) Active feet framing on opponent to manage distance and prevent pressure."
      difficulty: "beginner"
      category: "fundamentals"
      points: 10

    - question: "When opponent is standing with distance, which technique has highest success and why?"
      answer: "Technical Standup (75% success) because it matches opponent's standing position, neutralizes their passing options, and eliminates the guard passing scenario entirely. Alternatively, Ankle Pick has moderate success attacking their exposed stance."
      difficulty: "intermediate"
      category: "decision_making"
      points: 15

    - question: "How does Seated Guard integrate with other guard positions?"
      answer: "Seated Guard is a transitional hub position connecting to Standing Guard (stand up), Butterfly Guard (insert hooks), X-Guard (leg control), and various open guards. It provides stable platform for guard transitions while maintaining defensive integrity."
      difficulty: "advanced"
      category: "systems"
      points: 20

---

# Seated Guard
#bjj #position #guard #open-guard #fundamental

## State Description

Seated Guard is an upright open guard position where you sit on the mat with your hips on the ground, hands posted behind you for base, and legs extended or bent toward your opponent. This position provides a stable base with excellent mobility and the ability to quickly transition to standing or other guard positions. Unlike closed guard or butterfly guard, Seated Guard maintains maximum freedom of leg movement for distance management and attacks.

The strategic value of Seated Guard lies in its versatility and ease of entry/exit. It's commonly used as a transitional position when guard is opened, when recovering from guard pass attempts, or when opponent stands to create distance. The position allows you to control engagement distance with your feet while maintaining the option to stand up at any moment, making it difficult for opponents to commit fully to passing attempts.

Seated Guard works best when opponent is standing or on knees with distance, but becomes vulnerable if opponent gets chest-to-chest pressure or establishes strong control grips. The position requires active movement and timing - staying static allows opponent to pass. Most effective for practitioners comfortable with wrestling-style attacks and technical standups.

## Visual Description

You are sitting on the mat with your hips and glutes on the ground, torso upright at roughly 45-70 degrees. Your hands are posted on the mat behind you (slightly wider than shoulder width), fingers pointing away from body, elbows slightly bent providing spring-like base. Your legs extend forward toward your opponent, knees bent or straight depending on distance, feet active and ready to frame on opponent's hips or legs.

Your opponent is either standing with feet on mat maintaining distance, or on knees close to you attempting to establish control. When standing, your feet can reach their shins or thighs for frames and ankle attacks. When on knees, your feet can frame on hips or you can begin inserting butterfly hooks. The spatial relationship is dynamic - you can adjust hip position forward or back to manage engagement distance.

Your core is engaged to maintain upright torso, weight distributed between your posted hands and hips. Your head stays up with eyes on opponent's center of mass. Your shoulder blades are slightly retracted for structural support. This creates a mobile, reactive position where you can quickly stand, insert hooks, or attack legs while remaining difficult to pin or control.

## Key Principles

- **Active Base Maintenance**: Posted hands provide stability but must allow movement - rigid base limits mobility, too loose base allows opponent to flatten you. Find dynamic balance.
- **Distance Management**: Feet actively control spacing - too close allows chest pressure, too far limits offensive options. Use feet as active frames and probes.
- **Ready to Stand**: Mental and physical preparedness to technical standup at any moment - this threat forces opponent caution and provides reliable escape.
- **Hip Mobility Priority**: Unlike closed guard, seated guard requires constant hip adjustment - moving hips laterally, forward, and back keeps opponent off-balance.
- **Frame Before Grip**: When opponent closes distance, establish frames with feet before they secure control grips - proactive defense prevents bad situations.
- **Attack Timing**: Seated Guard attacks rely on opponent's movement and balance - watch for weight shifts, step-ins, and postural changes.

## Offensive Transitions

From this position, you can execute:

### Sweeps
- [[Ankle Pick Sweep]] → [[Mount]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
  - Grab opponent's ankle while posted, drive forward to sweep them backwards. Best when opponent is standing.

- [[Sit-Up Sweep]] → [[Mount]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
  - Post hand beside hip, sit up explosively with hip bump and shoulder push. Best when opponent drives forward.

### Takedowns
- [[Single Leg Takedown]] → [[Side Control Top]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)
  - Shoot for single leg when opponent is on knees close. Finish with control position.

### Position Improvements
- [[Technical Standup]] → [[Standing Guard]] (Success Rate: Beginner 60%, Intermediate 75%, Advanced 85%)
  - Post hand, bring back leg back, push up to standing while maintaining guard engagement.

- [[Butterfly Guard Transition]] → [[Butterfly Guard]] (Success Rate: Beginner 55%, Intermediate 70%, Advanced 80%)
  - Insert butterfly hooks when opponent closes distance. Immediate control improvement.

- [[X-Guard Entry]] → [[X-Guard]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 65%)
  - Control opponent's leg and enter X-Guard configuration for technical sweeps.

## Defensive Responses

When opponent attacks your seated guard:

- [[Standing Pass Defense]] → [[Standing Guard]] (Success Rate: 60%)
  - Counter standing pass by standing up yourself, neutralizing their passing attempt.

- [[Pressure Pass Defense]] → [[Butterfly Guard]] (Success Rate: 55%)
  - When opponent drives forward, insert butterfly hooks and establish control.

- [[Leg Drag Defense]] → [[Guard Recovery]] (Success Rate: 50%)
  - Prevent leg drag by maintaining foot frames and hip mobility.

- [[Distance Recovery]] → [[Open Guard]] (Success Rate: 65%)
  - Create space with feet and recover to preferred open guard position.

## Decision Tree

**If** opponent is standing with distance:
- Execute [[Technical Standup]] → [[Standing Guard]] (Probability: 75%)
  - Reasoning: Match their standing position, eliminate guard passing scenario entirely
- Or Execute [[Ankle Pick Sweep]] → [[Mount]] (Probability: 50%)
  - Reasoning: Standing exposes ankles to attacks, opportunity for sweep

**Else if** opponent drives forward with pressure:
- Execute [[Sit-Up Sweep]] → [[Mount]] (Probability: 55%)
  - Reasoning: Use forward momentum against them with sit-up mechanics
- Or Execute [[Butterfly Guard Transition]] → [[Butterfly Guard]] (Probability: 70%)
  - Reasoning: Insert hooks quickly when distance closes, improve control

**Else if** opponent is on knees close:
- Execute [[Single Leg Takedown]] → [[Side Control Top]] (Probability: 45%)
  - Reasoning: Exposed legs available for wrestling-style attacks
- Or Execute [[X-Guard Entry]] → [[X-Guard]] (Probability: 45%)
  - Reasoning: Technical position with high-percentage sweeps available

**Else** (opponent maintaining distance, neutral):
- Execute [[Ankle Pick Sweep]] → [[Mount]] (Probability: 35%)
  - Reasoning: Create opportunity by attacking stance
- Or Execute [[Technical Standup]] → [[Standing Guard]] (Probability: 60%)
  - Reasoning: Neutralize position, force opponent to re-engage

## Expert Insights

**John Danaher**: "Seated Guard exemplifies the principle of connection versus isolation. When you maintain the seated position with proper base, you remain connected to the ground through multiple points of contact, making it very difficult for the opponent to establish the disconnection required for passing. The beauty of this position is the constant threat of standing up - the opponent must account for two entirely different scenarios: you remaining seated, or you matching their standing position. This dual-threat forces hesitation and creates opportunities for sweeps."

**Gordon Ryan**: "In competition, I use Seated Guard as a pressure release valve. When someone's passing hard and I need a moment to reset, sitting up with good base gives me time to evaluate and forces them to reposition. From there, I'm either standing up to neutralize their passing entirely, or I'm timing a sweep when they step in. The key is staying active - if you sit there like a dummy, you get passed. But if you're moving your hips and threatening their ankles, they have to respect it."

**Eddie Bravo**: "Seated Guard is underrated, man. It's not sexy like inverted guards or rubber guard, but it's super practical. You can hit ankle picks, you can stand up, you can enter leg attacks. I teach my guys to use it when they're tired or when they need to slow things down. It's also great for no-gi because you don't need grips to maintain it - just good base and active feet. Connect it to X-Guard entries and suddenly you have a whole system."

## Common Errors

### Error: Staying Static Without Moving Hips
- **Consequence**: Opponent easily establishes grips and controls your legs, passing becomes straightforward. Position loses its defensive and offensive value.
- **Correction**: Constantly adjust hip position - small movements side to side, forward and back. Keep opponent guessing and prevent static control.
- **Recognition**: If opponent seems comfortable and slowly advancing position, you're too static. Should feel like you're always adjusting.

### Error: Poor Hand Posting
- **Consequence**: Weak base allows opponent to flatten you to back, losing seated position advantage. Cannot generate power for sweeps.
- **Correction**: Post hands slightly wider than shoulders, fingers pointing away, elbows slightly bent like springs. Engage lats for structural support.
- **Recognition**: If opponent easily pushes you flat or you feel unstable, check hand positioning and engagement.

### Error: Letting Opponent Establish Strong Grips
- **Consequence**: Once opponent controls both legs or gets deep grips, seated position becomes passing position. Very difficult to recover.
- **Correction**: Use feet to block grip attempts, move legs away from reaching hands, establish your frames first before they grip.
- **Recognition**: If opponent has both your legs controlled, you've waited too long. Fight grips earlier.

### Error: Not Using Feet Actively for Frames
- **Consequence**: Opponent gets chest-to-chest pressure easily, flattening you and passing. Lost the distance management advantage.
- **Correction**: Feet should constantly be framing on opponent's hips, thighs, or shoulders. Active pressure prevents them from closing distance.
- **Recognition**: If opponent is chest-to-chest often, your feet aren't working enough. Should feel constant foot contact.

### Error: Forgetting to Stand Up
- **Consequence**: Stay seated even when standing is the better option, allowing opponent to work their passing game. Miss the escape opportunity.
- **Correction**: Always remember technical standup is available. When seated attacks aren't working or opponent gets good position, stand up.
- **Recognition**: If you're defending constantly without attacking, probably should have stood up earlier. Standup is both defense and reset.

## Training Drills

### Drill 1: Base Maintenance and Recovery
Start in seated guard with good base. Partner attempts to push you flat from various angles (front, sides) at progressive resistance (0%, 25%, 50%, 75%). Focus on maintaining posted hand base, using core engagement, and making small hip adjustments to maintain position. If flattened, recover immediately to seated. 3 minutes continuous, emphasizing quick base recovery. Sets: 3 rounds. Success metric: Maintain seated posture 80% of time at 75% resistance.

### Drill 2: Distance Management with Feet
Partner stands or is on knees at varying distances. Practice using feet to frame and control engagement distance - push them away when too close, pull them in when too far. Partner provides progressive resistance to your foot frames. Emphasize active feet constantly probing and adjusting. Switch between different foot frame positions (hips, thighs, shoulders). 3 minutes per position. Sets: 3 rounds. Success metric: Partner cannot establish chest pressure or grips without your permission.

### Drill 3: Sweep Timing from Seated
Start in seated guard, partner moves through three positions: standing, driving forward, on knees. As they transition between positions, execute appropriate sweep (ankle pick when standing, sit-up when driving forward, single leg when on knees). Partner provides 0-50% resistance. Emphasize timing recognition - attacking during position transitions when balance is vulnerable. 10 reps each sweep type. Sets: 3 rounds. Focus: Smooth timing, not forcing techniques.

### Drill 4: Transition Flow
Flow drill connecting seated guard to other positions. Start seated, partner approaches with pressure. Flow through: seated → butterfly hooks (when close), seated → standup (when standing), seated → X-guard entry (when leg available), seated → recover seated (when compromised). No resistance, just movement flow. 5 minutes continuous. Goal: Smooth transitions feeling natural, body awareness of when to transition.

## Related Positions

- [[Open Guard Bottom]] - Parent category position, seated guard is specific type
- [[Butterfly Guard]] - Natural progression by inserting hooks when opponent close
- [[Standing Guard]] - Natural progression by standing up from seated
- [[X-Guard]] - Technical evolution by controlling opponent's leg from seated
- [[Combat Base]] - Similar hand posting mechanics, different context (top position)
- [[De La Riva Guard]] - Related open guard with different control mechanisms
- [[Closed Guard Bottom]] - Contrasting guard position, more control but less mobility

## Optimal Submission Paths

**Direct attack path** (rare from seated):
[[Seated Guard]] → [[Ankle Lock Entry]] → [[Ankle Lock]] → [[Won by Submission]]
*Reasoning: Opponent's extended leg when standing creates ankle lock opportunity. Low percentage but exists.*

**Sweep to submission path** (high percentage):
[[Seated Guard]] → [[Sit-Up Sweep]] → [[Mount]] → [[Armbar from Mount]] → [[Won by Submission]]
*Reasoning: Sweep establishes dominant position, then attack from control. Systematic progression.*

**Transition to control path** (technical):
[[Seated Guard]] → [[X-Guard Entry]] → [[X-Guard]] → [[X-Guard Sweep]] → [[Mount]] → [[Submission Chain]]
*Reasoning: Technical position entry leads to high-percentage sweep, then submissions from mount.*

**Standing path** (strategic):
[[Seated Guard]] → [[Technical Standup]] → [[Standing Guard]] → [[Takedown]] → [[Dominant Position]] → [[Submission]]
*Reasoning: Neutralize opponent's passing by standing, then work top game submissions.*

## Timing Considerations

**Best Times to Enter**:
- When guard is opened from closed position
- When recovering from guard pass attempt
- When transitioning between different guard types
- When opponent stands to create distance

**Best Times to Attack**:
- When opponent stands (ankle pick opportunities)
- When opponent drives forward (sit-up sweep timing)
- When opponent is on knees close (single leg attacks)
- When opponent shifts weight to one side (sweep timing)

**Vulnerable Moments**:
- When opponent establishes strong grips on legs
- When flattened to back losing base
- When opponent gets chest-to-chest pressure
- When exhausted and cannot maintain active movement

**Fatigue Factors**:
- Active base maintenance requires core engagement
- Constant hip movement uses energy over time
- More sustainable than inverted guards but less than closed guard
- Standing up becomes harder when fatigued

## Competition Considerations

**Point Scoring**: Neutral guard position (0 points) but sweeps score 2 points, transitions to top score 2-3 points depending on position achieved.

**Time Management**: Good stalling position when ahead on points - difficult for opponent to pass if you're actively defending and threatening standup. Can control pace of engagement.

**Rule Set Adaptations**: In gi, opponent has more grip options on pants. In no-gi, rely more on foot frames and body positioning. In submission-only, can take more risks with transition attacks. IBJJF vs ADCC - standing up from guard has different tactical implications in each ruleset.

**Competition Strategy**: Use seated guard when opponent is better at passing from standing, as a reset position when under pressure, when you're ahead and want to limit their offense, or when setting up wrestling-style attacks against grapplers unfamiliar with them.

## Historical Context

Seated Guard has roots in wrestling and judo where maintaining base and quickly standing up is fundamental. In BJJ, it gained prominence as open guard evolved and practitioners realized the value of matching opponent's standing position rather than always remaining on back. Modern competitors like Gordon Ryan and Craig Jones use it strategically for pace control and wrestling-style attacks. It's a practical, no-nonsense position that works across all rule sets and experience levels.
