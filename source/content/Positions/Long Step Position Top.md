---
# ============================================================================
# SEO METADATA
# ============================================================================
title: "Long Step Position Top | BJJ Position Guide | BJJ Graph"
description: "Master Long Step Position Top in BJJ. Complete guide covering guard passing mechanics, leg clearing, and control transitions. Success rates: Beginner 40%, Intermediate 55%, Advanced 70%."
tags:
  - bjj
  - position
  - guard-passing
  - top
  - intermediate

# ============================================================================
# STATE MACHINE CORE DATA
# ============================================================================
state_machine:
  # Core Identifiers
  state_id: "S263"
  position_name: "Long Step Position Top"
  alternative_names:
    - "Long Step Pass"
    - "Distance Pass Position"
    - "Standing Long Step"
    - "Extended Step Pass"

  # State Properties
  properties:
    point_value: 0
    position_type: "Offensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Short"

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
      beginner: 5
      intermediate: 10
      advanced: 15
    position_loss:
      beginner: 45
      intermediate: 30
      advanced: 15
    average_time_minutes: "1-2"

  # Offensive Transitions (Your Actions from This Position)
  transitions:
    offensive:
      - name: "Complete Long Step Pass"
        target_state: "S017"
        target_position: "Side Control"
        success_rate:
          beginner: 45
          intermediate: 60
          advanced: 75
        transition_id: "T335"
        category: "pass"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Clear legs completely and establish side control after long step"

      - name: "Transition to Knee Slice"
        target_state: "S050"
        target_position: "Knee Cut Position"
        success_rate:
          beginner: 50
          intermediate: 65
          advanced: 80
        transition_id: "T336"
        category: "pass"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Convert long step to knee slice pass when bottom player frames"

      - name: "Stack Pass Entry"
        target_state: "S001"
        target_position: "Top Position"
        success_rate:
          beginner: 35
          intermediate: 50
          advanced: 65
        transition_id: "T337"
        category: "pass"
        energy_cost: "High"
        execution_time: "Medium"
        description: "Drive forward with stacking pressure when opponent squares hips"

      - name: "Leg Drag Transition"
        target_state: "S052"
        target_position: "Leg Drag Position"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T338"
        category: "pass"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Control near leg and transition to leg drag passing position"

      - name: "Headquarters Position"
        target_state: "S041"
        target_position: "Headquarters Position"
        success_rate:
          beginner: 55
          intermediate: 70
          advanced: 85
        transition_id: "T339"
        category: "control"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Establish headquarters control when bottom player retains guard"

      - name: "Backstep Pass"
        target_state: "S004"
        target_position: "Back Control"
        success_rate:
          beginner: 30
          intermediate: 45
          advanced: 60
        transition_id: "T340"
        category: "pass"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Backstep over leg when opponent turns away exposing back"

    # Defensive Responses (When Opponent Has This Position Against You)
    defensive:
      - name: "Shin Shield Recovery"
        target_state: "S046"
        target_position: "Knee Shield Half Guard"
        success_rate: 50
        counter_category: "guard_retention"
        description: "Establish shin shield frame against passer's torso"

      - name: "Deep Half Entry"
        target_state: "S028"
        target_position: "Deep Half Guard"
        success_rate: 40
        counter_category: "guard_retention"
        description: "Dive under passer's hips to achieve deep half position"

      - name: "Inversion Recovery"
        target_state: "S002"
        target_position: "Closed Guard Bottom"
        success_rate: 35
        counter_category: "escape"
        description: "Invert under passer and recover closed guard"

      - name: "Single Leg X Entry"
        target_state: "S089"
        target_position: "Single Leg X Guard"
        success_rate: 45
        counter_category: "guard_retention"
        description: "Establish single leg X hooks on extended leg"

    # Counter Transitions (Responses to Opponent's Attempts)
    counters:
      - opponent_action: "Shin Shield Frame Attempt"
        your_counter: "Transition to Knee Slice"
        target_state: "S050"
        success_rate: 60
        description: "When bottom player establishes shin shield, convert to knee slice mechanics"

      - opponent_action: "Deep Half Entry Attempt"
        your_counter: "Headquarters Position"
        target_state: "S041"
        success_rate: 55
        description: "Sprawl and establish headquarters when opponent dives deep"

      - opponent_action: "Hip Escape to Re-Guard"
        your_counter: "Leg Drag Transition"
        target_state: "S052"
        success_rate: 55
        description: "Control escaping leg and transition to leg drag pass"

  # Decision Tree Logic (Machine-Readable for Game Engine)
  decision_tree:
    - condition: "legs are clear and path to side control is open"
      priority: 1
      indicators:
        - "Bottom player's legs past your hips"
        - "No frames between your chest and their torso"
        - "Clear path to crossface position"
      actions:
        - technique: "Complete Long Step Pass"
          target_state: "S017"
          probability: 60
          reasoning: "Clear leg position enables direct pass completion to side control"
        - technique: "Stack Pass Entry"
          target_state: "S001"
          probability: 50
          reasoning: "Forward pressure secures pass when legs are cleared"

    - condition: "opponent establishes shin shield or knee frame"
      priority: 2
      indicators:
        - "Shin or knee between your torso and theirs"
        - "Frame pushing against your chest or shoulder"
        - "Legs not fully cleared"
      actions:
        - technique: "Transition to Knee Slice"
          target_state: "S050"
          probability: 65
          reasoning: "Knee slice mechanics bypass frame better than continuing long step"
        - technique: "Leg Drag Transition"
          target_state: "S052"
          probability: 55
          reasoning: "Control framing leg and drag to passing position"

    - condition: "opponent attempts to dive under or recover deep position"
      priority: 3
      indicators:
        - "Bottom player's movement toward your legs"
        - "Hips elevating to create space underneath"
        - "Arms reaching for your legs or hips"
      actions:
        - technique: "Headquarters Position"
          target_state: "S041"
          probability: 70
          reasoning: "Sprawl and headquarters control prevents deep guard entries"
        - technique: "Stack Pass Entry"
          target_state: "S001"
          probability: 50
          reasoning: "Drive forward pressure prevents diving motion"

    - condition: "default - opponent defending but legs not clear"
      priority: 4
      indicators:
        - "Static defensive position"
        - "Legs partially engaged but not fully clear"
        - "No immediate passing or guard recovery"
      actions:
        - technique: "Transition to Knee Slice"
          target_state: "S050"
          probability: 65
          reasoning: "Knee slice provides most reliable pass from partially cleared position"
        - technique: "Headquarters Position"
          target_state: "S041"
          probability: 70
          reasoning: "Establish headquarters control for methodical passing approach"

  # State Invariants (Conditions That Define This Position)
  invariants:
    physical:
      - "Top player standing or in low crouch with one leg stepped far outside"
      - "Bottom player on back with legs partially engaged or cleared"
      - "Top player's extended leg positioned outside bottom player's legs"
      - "Top player's base foot planted wide for stability"
      - "Top player's weight distributed between feet and hands/arms"
      - "Distance maintained between hips preventing full guard recovery"

    control:
      - "Grip on bottom player's pants, belt, or collar maintaining connection"
      - "Extended leg positioning controls bottom player's hip line"
      - "Pressure angle preventing bottom player from fully recovering guard"
      - "Hand or arm creating frame against bottom player's knee or hip"
      - "Base positioning enabling forward pressure or lateral movement"
      - "Distance control preventing bottom player from closing distance"

    opponent_limitations:
      - "Cannot easily re-establish full closed guard due to distance"
      - "Must defend against multiple passing options simultaneously"
      - "Hip mobility restricted by top player's leg positioning"
      - "Cannot generate significant off-balancing pressure on standing opponent"
      - "Must create frames to prevent pass completion"
      - "Limited time to recover guard before pass completes"

  # Training Considerations
  training:
    prerequisites:
      positions:
        - "Standing Guard"
        - "Headquarters Position"
        - "Knee Cut Position"

      skills:
        - "Standing guard passing mechanics"
        - "Balance and base maintenance while standing"
        - "Grip fighting and control maintenance"
        - "Distance management and spacing control"
        - "Transition timing between passing styles"
        - "Reading bottom player's defensive reactions"

      concepts:
        - "Guard Passing Principles"
        - "Pressure Application"
        - "Distance Creation"
        - "Base Maintenance"
        - "Control Point Hierarchy"
        - "Passing Counter System"

    optimal_conditions:
      - "When bottom player's legs are extended or creating distance"
      - "Against opponents who play open guard with leg extension"
      - "When transitioning from standing to passing"
      - "Against bottom players who avoid close guard positions"
      - "In gi when pants grips provide control during long step"
      - "When top player has good balance and mobile base"

    vulnerable_moments:
      - "During initial long step when balance is on one leg"
      - "If bottom player establishes strong shin shield frame"
      - "When opponent dives under for deep half or single leg X"
      - "During transition between passing styles if commitment is unclear"
      - "When extended leg position becomes too far without forward progress"
      - "If grips are lost during long step execution"

    energy_fatigue_factors:
      - "Position requires good balance and leg strength for extended stance"
      - "Maintaining distance control while standing drains leg endurance"
      - "Multiple passing attempts from long step require explosive energy"
      - "Position is transitional and typically short-lived (1-2 minutes)"
      - "Failed long steps require recovery and repositioning energy"
      - "Standing base more fatiguing than grounded passing over time"

  # Position Progressions and Relationships
  progressions:
    leads_to:
      - state_id: "S017"
        position: "Side Control"
        relationship: "dominant_transition"
        description: "Completing long step pass achieves side control when legs are fully cleared"

      - state_id: "S050"
        position: "Knee Cut Position"
        relationship: "natural_progression"
        description: "Converting to knee slice is common when long step meets frame resistance"

      - state_id: "S041"
        position: "Headquarters Position"
        relationship: "control_position"
        description: "Establishing headquarters provides stable platform when guard is retained"

      - state_id: "S052"
        position: "Leg Drag Position"
        relationship: "alternative"
        description: "Leg drag transition when controlling near leg during long step"

    related_positions:
      - state_id: "S083"
        position: "Standing Position"
        relationship: "entry_position"
        description: "Long step typically initiated from standing guard position"

      - state_id: "S041"
        position: "Headquarters Position"
        relationship: "similar_offensive"
        description: "Both are standing/crouched passing positions with distance control"

      - state_id: "S050"
        position: "Knee Cut Position"
        relationship: "variation"
        description: "Knee slice is alternative passing approach from similar positioning"

      - state_id: "S085"
        position: "Smash Pass Position"
        relationship: "similar_offensive"
        description: "Both involve leg clearing and pressure-based passing mechanics"

# ============================================================================
# SCHEMA.ORG STRUCTURED DATA (SEO Optimization)
# ============================================================================
schema_org:
  # HowTo Schema for Technical Content
  howto:
    type: "HowTo"
    name: "How to Use Long Step Position Top in BJJ"
    description: "Complete guide to executing long step guard passing, leg clearing techniques, and control transitions."
    total_time: "PT5M"

    steps:
      - name: "Establish Long Step Position"
        text: "From standing guard, step one leg far outside opponent's legs while maintaining grip control, creating distance and clearing leg position."
        position: 1

      - name: "Control Distance and Hips"
        text: "Use extended leg positioning to control opponent's hip line while maintaining grips on pants, belt, or collar for connection."
        position: 2

      - name: "Complete Long Step Pass"
        text: "When legs are clear, drive forward and establish side control by securing crossface and hip control."
        position: 3

      - name: "Transition to Knee Slice"
        text: "If opponent establishes shin shield frame, convert long step to knee slice mechanics by cutting knee across body."
        position: 4

      - name: "Establish Headquarters Control"
        text: "When opponent retains guard, establish headquarters position by sprawling hips and maintaining distance control for methodical passing."
        position: 5

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  # FAQ Schema for Rich Snippets
  faq:
    - question: "What makes Long Step Position effective for guard passing?"
      answer: "Long Step creates distance and leg clearing through extended stance positioning, enabling pass completion when legs are cleared. The position provides multiple transition options including knee slice, leg drag, or headquarters when primary pass is defended, making it versatile passing approach with 60-75% success rate for advanced practitioners."
      category: "fundamentals"

    - question: "When should I complete the Long Step Pass vs transition to Knee Slice?"
      answer: "Complete Long Step Pass when legs are fully cleared with no frames between your chest and opponent's torso (60-75% success). Transition to Knee Slice when opponent establishes shin shield or knee frame blocking direct pass (65% success). Knee slice mechanics bypass frames more effectively than continuing long step against resistance."
      category: "tactics"

    - question: "How do I prevent opponent from recovering guard during Long Step?"
      answer: "Maintain distance through extended leg positioning preventing them from closing distance, keep constant grip control on pants/belt/collar maintaining connection, control their hip line with leg position, and drive forward pressure continuously preventing recovery time. If they begin diving under, immediately establish headquarters or drive stack pass."
      category: "defense"

    - question: "What are the key control points in Long Step Position?"
      answer: "Critical control points include: extended leg positioning controlling hip line, grip on pants/belt/collar maintaining connection, base foot planted wide for stability, pressure angle preventing guard recovery, and distance management preventing opponent from closing gap. Extended leg position is most important for controlling their hip mobility."
      category: "fundamentals"

    - question: "When is the best time to transition to Headquarters from Long Step?"
      answer: "Transition to Headquarters when opponent successfully retains guard despite long step attempt, when they begin diving under for deep half or single leg X (prevents deep entries), when you need stable platform to reset passing approach, or when multiple long step attempts have not succeeded. Headquarters provides methodical control for continued passing attacks."
      category: "tactics"

    - question: "What makes Long Step vulnerable to Deep Half Guard entries?"
      answer: "Extended leg positioning during long step creates space under passer's hips that skilled bottom players exploit by diving deep. Standing or crouched stance provides entry opportunity when passer commits weight forward. Counter by maintaining headquarters position with sprawled hips and preventing opponent from getting under your center of gravity."
      category: "defensive"

# ============================================================================
# LLM CONTEXT BLOCK (AI/Game Engine Optimization)
# ============================================================================
llm_context:
  # One-Sentence Summary for AI Context
  position_summary: "Long Step Position Top is a standing guard passing position featuring extended leg stance outside opponent's legs that creates distance and leg clearing for side control completion, with versatile transitions to knee slice, leg drag, or headquarters when defended."

  # Key Success Factors (Prioritized)
  key_success_factors:
    - factor: "Distance and Leg Clearing"
      importance: "critical"
      description: "Extended leg positioning creates distance preventing guard recovery while clearing leg position for pass completion, making distance control the position's primary mechanism"
      game_impact: "Increases pass success by +20% and reduces guard recovery by -15%"

    - factor: "Grip Control Maintenance"
      importance: "critical"
      description: "Maintaining grips on pants, belt, or collar throughout long step provides connection preventing opponent from disengaging or creating better angles"
      game_impact: "Increases position retention by +15% and enables transition control"

    - factor: "Balance and Base Maintenance"
      importance: "high"
      description: "Maintaining stable base while on one leg or in extended stance prevents off-balancing and enables pressure application when pass opens"
      game_impact: "Increases pass completion by +10% and reduces sweep vulnerability"

    - factor: "Transition Recognition and Adaptation"
      importance: "high"
      description: "Reading when long step is succeeding versus being defended and transitioning appropriately to knee slice, leg drag, or headquarters preserves offensive momentum"
      game_impact: "Increases overall passing success by +15% through tactical adaptation"

    - factor: "Forward Pressure Timing"
      importance: "medium"
      description: "Applying forward pressure at correct moment when legs are clear achieves pass completion while avoiding premature commitment that enables escapes"
      game_impact: "Increases pass success by +10% through proper timing"

  # Common Questions (Q&A Patterns for LLM/Chatbot)
  common_questions:
    - q: "When should I use Long Step Position versus other passing styles?"
      a: "Use Long Step when bottom player extends legs creating distance in open guard, when transitioning from standing to passing, or against players who avoid close guard positions. Long step excels at distance management and leg clearing. Avoid against bottom players who play tight guard with strong frames or who are skilled at deep guard entries."
      context: "decision_making"
      skill_level: "intermediate"

    - q: "How do I maintain balance during the long step?"
      a: "Plant base foot wide for stability, distribute weight between feet and hands/arms maintaining connection, keep center of gravity over base points, and avoid overextending stepping leg beyond control range. Practice long step repeatedly to develop proprioception and balance confidence. Start with smaller steps and increase range as balance improves."
      context: "technical"
      skill_level: "beginner"

    - q: "What if opponent establishes strong shin shield during my long step?"
      a: "Immediately transition to knee slice pass mechanics rather than forcing long step against frame. Knee slice cuts through frames more effectively. Alternatively, transition to leg drag by controlling the framing leg, or establish headquarters to reset. Don't waste energy fighting losing long step—adapt to their defense with better option."
      context: "problem_solving"
      skill_level: "intermediate"

    - q: "How do I choose between completing pass versus transitioning to control?"
      a: "Complete pass when legs are fully clear with no frames blocking path to side control (highest success 60-75%). Establish headquarters control when guard is retained despite long step attempt—this provides stable platform for continued passing. Transition to knee slice or leg drag when specific frames or defensive structures suggest those mechanics will be more successful. Read their defense and choose accordingly."
      context: "tactical"
      skill_level: "intermediate"

    - q: "What makes Long Step effective against open guard players?"
      a: "Open guard often involves extended legs creating distance, which long step exploits by stepping outside leg position and controlling hip line. The extended stance matches their distance game while providing passing structure. Bottom players playing extended guards have difficulty recovering closed distance once long step is established. Position turns their distance management against them."
      context: "tactical"
      skill_level: "intermediate"

    - q: "How do I prevent Deep Half Guard entries during Long Step?"
      a: "Maintain headquarters position with sprawled hips when opponent attempts to dive under, avoid committing weight too far forward over your extended leg, control their movement toward your legs with grips and pressure angle, and be ready to drive stack pass forward if they try to get deep. Reading their diving attempt early is critical—prevention is easier than escape."
      context: "defensive"
      skill_level: "advanced"

  # Coaching Cues (Natural Language for Instruction)
  coaching_cues:
    - "Long step outside their legs - create the distance"
    - "Wide base, stable platform - balance first, pass second"
    - "Grips control the connection - never lose your control"
    - "Legs clear? Drive forward. Frames present? Transition"
    - "Headquarters is your friend - don't force failing passes"
    - "Distance prevents guard recovery - maintain the gap"
    - "Read their defense before they execute - anticipation wins"
    - "Knee slice beats frames - adapt when they establish structure"
    - "One leg at a time - clear systematically, not all at once"
    - "Forward pressure closes the deal - timing is everything"

  # Training Focus by Skill Level
  training_focus:
    beginner:
      - "Developing balance and base in extended long step stance"
      - "Learning to maintain grips during position changes"
      - "Understanding basic pass completion when legs are clear"
      - "Recognizing when long step position is achieved versus still in guard"

    intermediate:
      - "Transitioning smoothly to knee slice when frames are established"
      - "Developing headquarters control for methodical passing"
      - "Reading bottom player's defensive reactions and adapting passes"
      - "Chaining multiple passing attempts from long step platform"

    advanced:
      - "Mastering backstep pass opportunities when opponent turns away"
      - "Integrating leg drag transitions during long step execution"
      - "Preventing deep guard entries through timing and pressure"
      - "Developing systematic passing approach using long step as entry"

  # Game Engine Hints
  game_engine_hints:
    energy_cost_factors:
      - "Maintaining position: Medium drain per turn (standing base fatigues)"
      - "Pass completion: Medium energy (forward drive required)"
      - "Transitions: Low-Medium energy (technical adjustments)"
      - "Position typically short-lived (1-2 minutes) before resolution"

    position_strength: "Moderately strong offensive passing position with excellent transition versatility, effective when distance and grip control are maintained"

    opponent_pressure: "Medium stress on opponent due to passing threat and distance control, increasing when legs become cleared"

    ideal_scenarios:
      - "Against open guard players with extended leg positions"
      - "When transitioning from standing guard to passing"
      - "Against opponents uncomfortable with distance-based passing"
      - "When top player has good balance and mobile base"

    dilemma_creation:
      - "Defending long step pass exposes opponent to knee slice transition"
      - "Establishing frames opens leg drag passing opportunities"
      - "Diving under for deep guard enables headquarters sprawl control"
      - "Hip escaping to recover guard creates leg drag vulnerability"

  # Success Modifiers (Probabilistic Adjustments for Game Engine)
  success_modifiers:
    - condition: "Legs fully cleared with no frames"
      modifier: +20
      applies_to: "pass_completion"
      description: "Clear leg position enables direct pass with high success rate"

    - condition: "Strong grip control maintained"
      modifier: +15
      applies_to: "all_offensive_transitions"
      description: "Grip control prevents disengagement and enables transitions"

    - condition: "Opponent establishes shin shield frame"
      modifier: -15
      applies_to: "long_step_pass_completion"
      description: "Frame blocks direct pass requiring transition to knee slice"

    - condition: "Good balance and base"
      modifier: +10
      applies_to: "position_retention|pass_success"
      description: "Stable base prevents off-balancing and enables pressure application"

    - condition: "Opponent attempts deep guard entry"
      modifier: +10
      applies_to: "headquarters_transition"
      description: "Diving attempt facilitates headquarters sprawl control"

    - condition: "Extended leg position overcommitted"
      modifier: -10
      applies_to: "position_retention"
      description: "Overextension creates balance vulnerability and recovery difficulty"

    - condition: "Knowledge test passed (80%+)"
      modifier: +10
      applies_to: "transition_recognition|pass_completion"
      description: "Understanding passing mechanics enables proper technique selection"

    - condition: "Grip control lost"
      modifier: -20
      applies_to: "all_offensive_transitions"
      description: "Lost grips enable opponent disengagement and guard recovery"

  # Dilemma Structures (Craig Jones Philosophy)
  dilemmas:
    - scenario: "Opponent establishes shin shield frame blocking long step"
      dilemma_created: "Frame defends long step pass but creates vulnerability to knee slice or leg drag transitions"
      offensive_options:
        - "Transition to Knee Slice → Side Control (Success: 65%)"
        - "Leg Drag Transition → Leg Drag Position (Success: 55%)"
      narrative: "Your opponent smartly establishes shin shield, blocking your long step path. But their frame just created your next attack. Convert to knee slice and cut through that frame, or grab the framing leg and drag it across for a different angle. One defense, two new attacks."

    - scenario: "Opponent attempts to dive under for deep half guard"
      dilemma_created: "Diving under defends long step but exposes opponent to headquarters sprawl and stack pass"
      offensive_options:
        - "Headquarters Position → Headquarters Position (Success: 70%)"
        - "Stack Pass Entry → Top Position (Success: 50%)"
      narrative: "Your opponent sees your long step and tries to dive deep, getting under your hips. Smart move, but you're ready. Sprawl back into headquarters and they're stuck, or drive forward with stack pressure. Their escape attempt just gave you better control."

    - scenario: "Opponent uses hip escape to create distance and recover guard"
      dilemma_created: "Hip escaping creates distance but exposes near leg to leg drag control and passing"
      offensive_options:
        - "Leg Drag Transition → Leg Drag Position (Success: 55%)"
        - "Transition to Knee Slice → Side Control (Success: 65%)"
      narrative: "Your opponent hip escapes hard, trying to create the distance they need to recover guard. But their escaping leg is now yours. Grab it, drag it across, and you're passing from a new angle. Their escape just became your pass."

    - scenario: "Opponent maintains static defense without clear commitment"
      dilemma_created: "Static defense prevents immediate pass but allows top player to establish headquarters for methodical passing"
      offensive_options:
        - "Headquarters Position → Headquarters Position (Success: 70%)"
        - "Transition to Knee Slice → Side Control (Success: 65%)"
      narrative: "Your opponent plays defensive, not committing to escapes or deep entries. Smart, but not smart enough. You establish headquarters, controlling the pace. Now you can pick your passing moment systematically. Their patience bought them time, but you bought position."

  # Narrative Generation Prompts
  narrative_prompts:
    entry: "You step long, extending your leg outside their guard. Distance created, legs clearing. The long step is set, and the pass is beginning."
    control: "Your extended stance controls their hip line, grips maintaining connection. Distance prevents their guard recovery. You control the passing pace."
    attack_initiation: "Legs are clear, path is open. Time to drive forward, secure the crossface, take side control. The pass is yours."
    success: "Forward pressure, cleared legs, secured position. Side control achieved. Long step pass successful."
    failure: "Frame established, pass blocked. But you're not done—transition to knee slice, maintain pressure. Different angle, same goal."
    position_loss: "Guard recovered, long step lost. Reset, establish standing position, try again. Learning opportunity."
    pass_completion: "The moment arrives—legs completely clear, no frames blocking. Drive forward with purpose, crossface securing, side control yours."
    transition_execution: "Their defense changes your attack. Shin shield appears? Knee slice awaits. They dive deep? Headquarters sprawls. Adaptation is mastery."
    defensive_counter: "They're recovering guard, but your grips hold firm. Control their movement, establish headquarters, maintain passing threat. Defense becomes position."

  # Knowledge Assessment Questions
  knowledge_questions:
    - question: "What are the three critical control elements that define Long Step Position?"
      answer: "The three critical elements are: (1) Extended leg positioning outside opponent's legs controlling hip line and creating distance, (2) Grip control on pants/belt/collar maintaining connection throughout position, and (3) Wide stable base providing balance for pressure application and transitions. These elements work together to clear legs and enable pass completion."
      difficulty: "beginner"
      category: "fundamentals"
      points: 10

    - question: "When opponent establishes shin shield frame during long step, which transition has highest success and why?"
      answer: "Transition to Knee Slice has highest success (65%+) because knee slice mechanics cut through frames more effectively than continuing long step against established structure. Knee cutting motion bypasses shin shield whereas long step forward drives into the frame. This exemplifies reading defense and adapting passing style to opponent's structure."
      difficulty: "intermediate"
      category: "tactics"
      points: 15

    - question: "How does Long Step Position integrate with Headquarters Position in systematic guard passing?"
      answer: "Long step creates distance and leg clearing as offensive passing attempt. When guard is retained despite long step, transition to headquarters provides stable control platform for methodical passing continuation. Headquarters serves as reset position enabling continued passing attempts from structured base. This creates systematic approach: attempt dynamic long step pass, establish headquarters control if retained, continue passing from stable platform. Integration enables both dynamic and methodical passing approaches."
      difficulty: "advanced"
      category: "systems"
      points: 20

    - question: "Explain why Long Step Position is particularly effective against open guard players."
      answer: "Open guard players typically extend legs creating distance, which long step exploits by stepping outside their leg positioning and controlling hip line. Extended stance matches their distance game while providing passing structure. Bottom players with extended legs have difficulty recovering closed distance once long step controls hip positioning. Position essentially uses their preferred distance against them, turning open guard spacing into passing opportunity. Most effective against spider guard, lasso, or distance-based open guards."
      difficulty: "intermediate"
      category: "tactical"
      points: 15

    - question: "Describe the decision-making process for choosing when to complete pass versus establish control."
      answer: "Complete long step pass when: legs are fully clear with no frames blocking path (60-75% success), forward pressure will secure side control, opponent has no defensive structures remaining. Establish headquarters control when: guard is retained despite attempt, opponent creates strong defensive structures, multiple passing attempts have not succeeded, need stable platform to reset approach (70% control success). Headquarters provides methodical continuation when dynamic pass is defended, enabling systematic rather than forcing approach."
      difficulty: "advanced"
      category: "decision_making"
      points: 20

    - question: "What makes Long Step Position vulnerable to Deep Half Guard entries and how do you prevent them?"
      answer: "Long step creates space under passer's hips through extended stance, which skilled bottom players exploit by diving deep when passer commits weight forward. Prevention requires: maintaining headquarters position with sprawled hips when opponent attempts dive, avoiding overcommitting weight forward on extended leg, controlling opponent's movement toward legs with grips and pressure, reading diving attempt early. Headquarters sprawl is primary counter—prevents opponent from getting under center of gravity. Position awareness and proactive headquarters transition are critical."
      difficulty: "advanced"
      category: "defensive"
      points: 20

---

# Long Step Position Top
#bjj #state #guard-passing #top #intermediate

## State Description

Long Step Position Top is a standing guard passing position characterized by extended leg stance where one leg steps far outside the opponent's legs, creating distance and leg clearing for direct pass completion to side control. With a point value of 0 (passing position, not yet scoring), this position is classified as offensive with primary focus on advancing to side control while maintaining versatile transition options. It is particularly effective against open guard players who extend legs creating distance and provides systematic approach to leg clearing and pass completion.

This position emphasizes distance management and leg clearing mechanics through extended stance positioning. The long step creates hip line control preventing guard recovery while clearing opponent's legs for pass completion. When direct pass is defended through frames or defensive structures, the position offers high-percentage transitions to knee slice, leg drag, or headquarters control, making it versatile passing platform rather than single-option attack. The grip control throughout long step execution provides connection enabling transitions and preventing opponent disengagement.

Long Step Position excels when the top player maintains balance in extended stance while controlling distance and grip connection. The position's strength lies in its versatility—providing direct pass when legs clear and multiple transition options when defended. However, it becomes vulnerable during initial step when balance is momentary on one leg, when opponent establishes strong shin shield frames, or when bottom players dive under for deep guard entries. The position carries medium energy cost due to standing base requirements and is typically short-lived (1-2 minutes) before resolution through pass completion or guard recovery.

## Visual Description

You are standing or in low crouch position with one leg stepped far outside opponent's legs in extended stance, creating significant distance and lateral displacement from their center line. Your opponent is on their back with legs partially engaged or cleared, unable to fully recover closed guard due to distance and your positioning. Your extended leg is positioned outside their legs controlling their hip line with knee or thigh, while your base leg is planted wide providing stability and balance. Your hands maintain grip control on their pants, belt, or collar depending on gi or no-gi, providing connection despite distance. Your weight is distributed between your feet and your hands/arms which frame or control opponent's knees or hips.

The spatial relationship creates distance barrier where opponent cannot close gap to recover full guard while your extended stance clears their leg position for passing. Your center of gravity is positioned over your base points maintaining balance despite extended stance, with torso angled forward for pressure application but not overcommitted. The pressure distribution places control through your extended leg on their hip line and your grips maintaining connection, while base leg stabilizes entire structure. Your head positioning tracks opponent's movement preparing for forward drive to pass or lateral transitions to alternative passing styles.

This creates dynamic passing environment where opponent must simultaneously defend multiple passing threats while attempting guard recovery, forcing defensive priority and limiting offensive options.

## Key Principles

- **Distance and Leg Clearing**: Extended leg stance creates distance preventing guard recovery while clearing opponent's leg positioning, providing primary mechanism for pass completion through geometric control
- **Grip Control Throughout Movement**: Maintaining pants/belt/collar grips during long step execution provides connection preventing opponent disengagement and enabling smooth transitions between passing styles
- **Balance and Base Maintenance**: Stable base with wide foot positioning prevents off-balancing during extended stance, enabling pressure application when pass opens and safety during transitions
- **Versatile Transition Options**: Understanding when to complete long step versus transitioning to knee slice, leg drag, or headquarters based on defensive structures preserves passing momentum and adapts to opponent's defense
- **Hip Line Control**: Extended leg positioning controls opponent's hip line preventing lateral movement and guard recovery, creating geometric constraint on their defensive options
- **Forward Pressure Timing**: Applying forward pressure at correct moment when legs are fully clear achieves pass while avoiding premature commitment that creates escape opportunities
- **Defensive Structure Recognition**: Reading opponent's frames, diving attempts, or hip escapes early enables proactive transition choices rather than reactive scrambling after defenses succeed

## Offensive Transitions

From this position, you can execute:

### Guard Passes
- [[Side Control]] via Complete Long Step Pass (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
  - Clear legs completely and drive forward establishing side control when path is open with no defensive frames

- [[Knee Cut Position]] via Transition to Knee Slice (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)
  - Convert long step to knee slice mechanics when opponent establishes shin shield or knee frame

- [[Top Position]] via Stack Pass Entry (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
  - Drive forward with stacking pressure when opponent squares hips or creates tight defensive structure

- [[Leg Drag Position]] via Leg Drag Transition (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
  - Control near leg and transition to leg drag passing when opponent uses leg for framing or escaping

- [[Back Control]] via Backstep Pass (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)
  - Backstep over leg when opponent turns away exposing back during defensive movement

### Control Positions
- [[Headquarters Position]] (Success Rate: Beginner 55%, Intermediate 70%, Advanced 85%)
  - Establish headquarters control when guard is retained, providing stable platform for methodical passing continuation

## Defensive Responses

When opponent has this position against you (you are bottom), available counters:

- [[Knee Shield Half Guard]] via Shin Shield Recovery (Success Rate: 50%)
  - Establish shin shield frame against passer's torso preventing pass completion and creating guard retention structure

- [[Deep Half Guard]] via Deep Half Entry (Success Rate: 40%)
  - Dive under passer's hips exploiting space created by extended stance to achieve deep half position

- [[Closed Guard Bottom]] via Inversion Recovery (Success Rate: 35%)
  - Invert under passer and recover closed guard by closing distance they created

- [[Single Leg X Guard]] via Single Leg X Entry (Success Rate: 45%)
  - Establish single leg X hooks on passer's extended leg converting their stance into guard position

## Decision Tree

**If** legs are clear and path to side control is open:
- Execute [[Complete Long Step Pass]] → [[Side Control]] (Probability: 60%)
  - Reasoning: Clear leg position with no frames enables direct pass completion with high success rate
- Or Execute [[Stack Pass Entry]] → [[Top Position]] (Probability: 50%)
  - Reasoning: Forward driving pressure secures pass when geometric obstacles are cleared

**Else if** opponent establishes shin shield or knee frame:
- Execute [[Transition to Knee Slice]] → [[Knee Cut Position]] (Probability: 65%)
  - Reasoning: Knee slice mechanics bypass frame structures more effectively than continuing long step
- Or Execute [[Leg Drag Transition]] → [[Leg Drag Position]] (Probability: 55%)
  - Reasoning: Control framing leg and drag to different passing angle exploiting their defensive structure

**Else if** opponent attempts to dive under or recover deep position:
- Execute [[Headquarters Position]] (Probability: 70%)
  - Reasoning: Sprawl and headquarters control prevents deep guard entries and provides stable passing platform
- Or Execute [[Stack Pass Entry]] → [[Top Position]] (Probability: 50%)
  - Reasoning: Forward pressure prevents diving motion by closing space they need

**Else** (opponent defending but legs not clear):
- Execute [[Transition to Knee Slice]] → [[Knee Cut Position]] (Probability: 65%)
  - Reasoning: Knee slice provides most reliable pass from partially cleared position
- Or Execute [[Headquarters Position]] (Probability: 70%)
  - Reasoning: Establish headquarters control for methodical passing when dynamic long step is defended

## Expert Insights

**John Danaher**: "Long step passing represents distance-based guard passing where geometric control of hip line prevents guard recovery while clearing leg position for pass completion. The position's sophistication lies not in single technique but in systematic approach: attempt dynamic long step pass, recognize when frame structures require transition to knee slice or leg drag, establish headquarters control when guard is retained. Study the hip line control principle—your extended leg position creates geometric constraint preventing their lateral movement and guard closure. The transition recognition is critical: forcing failing long step wastes energy, while proactive adaptation to knee slice or headquarters maintains passing momentum. Balance and grip control throughout movement enable all transitions."

**Gordon Ryan**: "In competition, long step is my go-to when opponent plays distance-based open guard. The key is maintaining grip control as you step—those grips enable all your transitions. I focus on the knee slice transition when they establish frames, because knee slice cuts through defensive structures better than forcing long step. Headquarters is your reset button when passes aren't opening—establish control, be patient, wait for better moment. Against high-level players, long step creates passing opportunities through leg clearing mechanics that pressure passing alone won't achieve. Train the transitions extensively because your opponent will defend the initial pass—your backup options determine your success rate."

**Eddie Bravo**: "Long step is part of distance management game in passing. I teach it as entry to multiple passing styles rather than isolated technique. The creativity comes in reading their defense and flowing between long step, knee slice, leg drag seamlessly. When they establish shin shield, boom, you're cutting the knee. When they try deep half, boom, you're sprawling into headquarters. It's all about being unpredictable and keeping them defending multiple threats. The position works great in no-gi when grip control focuses on leg positioning and body connection. Don't get stuck on completing one pass—the system is the strength, not any single technique."

## Common Errors

### Error: Overextending the long step beyond control range
- **Consequence**: Excessive extension creates balance vulnerability on base leg, reduces ability to recover if off-balanced, and creates space that enables deep half guard entries. Overcommitment makes position less stable and harder to maintain.
- **Correction**: Step with controlled range maintaining balance over base leg throughout movement. Extended stance should feel stable with ability to adjust positioning. Practice progressively increasing step length as balance improves. If balance feels compromised, reduce step length.
- **Recognition**: If you feel unstable on base leg, or if opponent easily off-balances you during long step, extension is too far. Should maintain confident balance throughout movement.

### Error: Losing grip control during long step execution
- **Consequence**: Lost grips enable opponent to disengage and recover guard, eliminate connection needed for transitions, and reduce passing success dramatically (-20% modifier). All passing options become significantly less effective without grip control.
- **Correction**: Prioritize grip maintenance as first priority during long step execution, adjust grip positions as needed during movement rather than releasing completely, and establish immediate replacement grip if one is lost. Grip control enables all transitions.
- **Recognition**: If opponent is able to move away or change angles freely, or if your transitions feel disconnected and awkward, grip control is insufficient. Should feel constant connection throughout position.

### Error: Forcing long step pass against established shin shield frames
- **Consequence**: Driving forward into shin shield frame wastes energy without progress, telegraphs intention enabling better defense, and ignores better passing option (knee slice) that bypasses frame. Stubbornness reduces overall passing effectiveness.
- **Correction**: Immediately recognize shin shield establishment and transition to knee slice mechanics rather than forcing long step. Knee slice cuts through frames that block long step path. Adapt to their defense proactively rather than forcing failing technique.
- **Recognition**: If you're pushing into their frame repeatedly without progress, or if you feel stuck against their knee/shin, you're forcing failing pass. Transition recognition should occur within 1-2 seconds of frame establishment.

### Error: Failing to establish headquarters when guard is retained
- **Consequence**: Attempting repeated long step passes without stable control platform wastes energy, gives opponent recovery time between attempts, and ignores position that provides methodical passing continuation. Lack of headquarters limits passing system completeness.
- **Correction**: Establish headquarters control after failed long step attempt rather than immediately trying same pass again. Headquarters provides stable platform enabling better passing moment recognition and energy conservation. Think systematically: attempt dynamic pass, establish control if retained, continue methodically.
- **Recognition**: If you're repeatedly attempting long step without success and feeling fatigued, or if opponent is recovering between your attempts, you need headquarters control. Should establish stable position rather than continuous failed attempts.

### Error: Inadequate balance and base during extended stance
- **Consequence**: Poor balance creates sweep vulnerability, reduces pressure application capability, prevents smooth transitions between passing styles, and signals instability to opponent. Unstable base undermines all passing attempts from long step platform.
- **Correction**: Plant base foot wide for maximum stability, distribute weight appropriately between feet and hands/arms, maintain center of gravity over base points, and practice long step stance repeatedly to develop proprioception. Balance is foundational requirement.
- **Recognition**: If you feel unstable or wobbly during long step, or if opponent can easily off-balance you with minimal effort, base and balance are insufficient. Should feel confident and stable throughout movement.

### Error: Ignoring opponent's diving attempts for deep guard
- **Consequence**: Opponent successfully enters deep half or single leg X when diving attempts are not recognized and countered, creating defensive scramble situation and losing passing advantage. Deep entries can completely reverse positional advantages.
- **Correction**: Read diving attempts early by observing opponent's hip elevation and movement toward your legs. Immediately sprawl into headquarters or drive stack pass forward preventing them from getting under your center of gravity. Proactive recognition prevents deep entries.
- **Recognition**: If opponent repeatedly gets deep underneath you, or if you're scrambling defensively after their entries, you're not reading diving attempts early enough. Should recognize and counter before they achieve depth.

### Error: Maintaining long step position too long without resolution
- **Consequence**: Extended standing position drains leg endurance, gives opponent time to develop better defensive structures, and wastes the temporary advantage long step creates. Position is transitional and should resolve relatively quickly.
- **Correction**: Commit to pass completion, transition to alternative passing style, or establish headquarters within 10-20 seconds of achieving long step. Don't maintain stance indefinitely without progress. Make decision and execute.
- **Recognition**: If you're holding long step stance for extended time (30+ seconds) without attempting pass or transition, and feeling leg fatigue building, position is being maintained too long. Should resolve more quickly through action.

## Training Drills

### Drill 1: Long Step Entry and Balance Development
Start standing in closed guard. Partner opens guard and you execute long step entry, focusing exclusively on balance maintenance and stable base positioning. Begin with small step length (25% range), progress to medium (50%), then full extension (100%). Hold stable long step stance for 10 seconds at each position. Partner provides no resistance initially, then adds light pressure testing balance (25%), then moderate testing (50%). Perform 3-minute rounds with emphasis on feeling stable throughout full extension. Develops proprioception and confidence in extended stance.

### Drill 2: Grip Control During Movement
Partner in open guard position provides various leg configurations. You execute long step while maintaining constant grip control on pants/belt/collar throughout movement. Partner attempts to strip grips or create distance (50% resistance). Focus on grip adjustment and maintenance rather than pass completion. When grip is lost, reset and repeat. Perform 4-minute rounds. Success metric: maintaining at least one control grip throughout entire long step execution. Critical for transition capability.

### Drill 3: Pass Completion from Clear Legs
Partner in open guard allows you to achieve long step with clear legs (no defensive frames). Practice recognizing clear position and immediately driving forward to complete pass to side control. Begin with partner static (0% resistance), progress to partner creating light frames requiring adjustment (25%), then partner attempting late recovery (50%). Emphasize recognizing clear position and committing to pass without hesitation. Perform 3-minute rounds. Develops recognition and commitment timing.

### Drill 4: Transition Flow to Knee Slice and Leg Drag
Start in established long step position. Partner establishes specific defensive structures: (1) shin shield frame → transition to knee slice, (2) hip escape movement → transition to leg drag, (3) diving attempt → establish headquarters. Practice smooth technical transitions rather than forcing original pass. Begin with partner calling out defense (25% resistance), progress to no verbal cues with realistic defense (75%). Perform 5-minute rounds. Develops adaptive transition skills.

### Drill 5: Live Long Step Passing with Progression
Start standing in opponent's open guard. Attempt complete long step passing sequence with all transition options available. Partner provides progressive resistance: (1) passive defense (25%), (2) active defense with frames and movement (50%), (3) offensive defense with guard recovery attempts and sweeps (75%), (4) full competition resistance (100%). Progress through resistance levels over weeks of training. Perform 5-minute rounds. Integrates all skills in realistic context with increasing challenge.

## Related Positions

- [[Standing Position]] - Entry position from which long step is typically initiated during guard passing
- [[Headquarters Position]] - Control position established when long step is defended, providing stable passing platform
- [[Knee Cut Position]] - Primary transition when shin shield frames block long step path, utilizing knee slice mechanics
- [[Leg Drag Position]] - Alternative transition utilizing opponent's leg positioning during long step
- [[Side Control]] - Terminal position achieved through successful long step pass completion
- [[Smash Pass Position]] - Related pressure-based passing position with similar leg clearing emphasis

## Optimal Submission Paths

**Fastest path to control** (direct):
[[Long Step Position Top]] → [[Side Control]] → [[Mount]] → [[Submission Chain]] → [[Won by Submission]]
*Reasoning: Direct pass completion to side control when legs are clear, progression through dominant positions to mount. Fast when geometric obstacles are cleared (60-75% success advanced). Mount provides multiple high-percentage submissions.*

**High-percentage path** (systematic):
[[Long Step Position Top]] → [[Headquarters Position]] → [[Knee Cut Position]] → [[Side Control]] → [[Mount]] → [[Submission Chain]] → [[Won by Submission]]
*Reasoning: When direct pass is defended, establish headquarters control for stable platform, transition to knee slice pass, progress through positions. More reliable through systematic approach controlling each stage. Emphasizes position-over-submission progression.*

**Alternative path** (transition-based):
[[Long Step Position Top]] → [[Leg Drag Position]] → [[Side Control]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: Transition to leg drag when opponent uses leg for framing, achieve side control, progress to back exposure. Different geometric approach providing alternative when long step angle is defended.*

**Back take path** (opportunistic):
[[Long Step Position Top]] → [[Backstep Pass]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: When opponent turns away defending long step pass, backstep over exposed back is available. Direct path to dominant back control (30-60% success depending on opponent's reaction). Requires recognition of back exposure timing.*

**Control-focused path** (methodical):
[[Long Step Position Top]] → [[Headquarters Position]] → [[Knee Cut Position]] → [[Side Control Consolidation]] → [[Mount Control]] → [[Armbar Finish]] → [[Won by Submission]]
*Reasoning: Systematic progression through control positions emphasizing retention at each stage before advancing. Most reliable for competition when points and position security are priorities. Each transition solidified before progression.*

## Timing Considerations

**Best Times to Enter**:
- When opponent opens closed guard creating distance
- After standing up in closed or open guard position
- When opponent plays distance-based open guard with extended legs
- During transitions when guard structure is temporarily disrupted

**Best Times to Attack**:
- When legs are fully cleared with no defensive frames (pass completion timing)
- When opponent's frames are first established (transition to knee slice timing)
- During opponent's hip escape movement (leg drag opportunity)
- When opponent begins diving motion for deep guard (headquarters sprawl timing)

**Vulnerable Moments**:
- During initial long step when balance is momentarily on one leg
- When grip control is being adjusted or re-established
- If opponent successfully establishes strong shin shield frame before recognition
- During transition between passing styles if commitment is unclear

**Fatigue Factors**:
- Standing extended stance drains leg endurance more than grounded positions
- Multiple failed long step attempts deplete explosive energy for transitions
- Balance maintenance requires constant core and leg engagement
- Position typically short-lived (1-2 minutes) before resolution through pass or guard recovery

## Competition Considerations

**Point Scoring**: Long step is passing position (0 points) but provides direct path to side control pass (3 points IBJJF) or back take (4 points). Effective for building points through successful passing. When pass completion seems difficult, headquarters control enables methodical approach maintaining passing pressure.

**Time Management**: Position resolves relatively quickly (1-2 minutes typical) through pass completion or guard retention. Early in match, can be used aggressively for pass attempts. Late in match when ahead, headquarters from long step provides stable control minimizing risk.

**Rule Set Adaptations**: In gi competition, pants grips provide excellent control during long step execution. In no-gi, grip control focuses on leg positioning and body connection requiring different mechanics. Under IBJJF rules, backstep opportunities must avoid leg reaping penalties. Under ADCC or submission-only, aggressive passing from long step is encouraged.

**Competition Strategy**: Use long step when opponent plays distance-based open guard, as position exploits their leg extension. Transition versatility (knee slice, leg drag, headquarters) makes it reliable passing system rather than single-option attack. Against defensive guard players, headquarters from long step provides stable platform for patient methodical passing. Monitor energy expenditure—don't waste effort forcing failing long step when transitions offer better paths.
