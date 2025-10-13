---
# ============================================================================
# SEO METADATA
# ============================================================================
title: "Leg Weave Position Top | BJJ Position Guide | BJJ Graph"
description: "Master Leg Weave Position Top in BJJ. Complete guide covering leg weaving mechanics, guard passing, and control transitions. Success rates: Beginner 35%, Intermediate 50%, Advanced 70%."
tags:
  - bjj
  - position
  - guard-passing
  - top
  - advanced

# ============================================================================
# STATE MACHINE CORE DATA
# ============================================================================
state_machine:
  # Core Identifiers
  state_id: "S264"
  position_name: "Leg Weave Position Top"
  alternative_names:
    - "Leg Weave Pass"
    - "Weave Pass Position"
    - "Threaded Pass"
    - "Leg Lacing Pass"

  # State Properties
  properties:
    point_value: 0
    position_type: "Offensive"
    risk_level: "Medium"
    energy_cost: "High"
    time_sustainability: "Short"

  # Success Probability Metrics
  metrics:
    position_retention:
      beginner: 40
      intermediate: 55
      advanced: 75
    advancement_probability:
      beginner: 35
      intermediate: 50
      advanced: 70
    submission_probability:
      beginner: 5
      intermediate: 10
      advanced: 20
    position_loss:
      beginner: 55
      intermediate: 40
      advanced: 20
    average_time_minutes: "1-2"

  # Offensive Transitions (Your Actions from This Position)
  transitions:
    offensive:
      - name: "Complete Leg Weave Pass"
        target_state: "S017"
        target_position: "Side Control"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 75
        transition_id: "T341"
        category: "pass"
        energy_cost: "High"
        execution_time: "Medium"
        description: "Thread leg through opponent's guard and drive to side control"

      - name: "Mount Transition from Weave"
        target_state: "S063"
        target_position: "Mount"
        success_rate:
          beginner: 30
          intermediate: 45
          advanced: 65
        transition_id: "T342"
        category: "pass"
        energy_cost: "High"
        execution_time: "Medium"
        description: "Step over to mount when leg is woven and opponent's guard is controlled"

      - name: "North-South Transition"
        target_state: "S067"
        target_position: "North-South"
        success_rate:
          beginner: 35
          intermediate: 50
          advanced: 70
        transition_id: "T343"
        category: "pass"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Circle to north-south when leg weave controls hip movement"

      - name: "Backstep to Back Control"
        target_state: "S004"
        target_position: "Back Control"
        success_rate:
          beginner: 25
          intermediate: 40
          advanced: 60
        transition_id: "T344"
        category: "position_advancement"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Backstep over leg when opponent turns exposing back during defense"

      - name: "Knee Slice Transition"
        target_state: "S050"
        target_position: "Knee Cut Position"
        success_rate:
          beginner: 45
          intermediate: 60
          advanced: 75
        transition_id: "T345"
        category: "pass"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Convert weave to knee slice when opponent's leg position allows"

      - name: "Pressure Pass Conversion"
        target_state: "S017"
        target_position: "Side Control"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T346"
        category: "pass"
        energy_cost: "High"
        execution_time: "Medium"
        description: "Drive chest pressure through woven leg position to complete pass"

    # Defensive Responses (When Opponent Has This Position Against You)
    defensive:
      - name: "Hip Escape Recovery"
        target_state: "S002"
        target_position: "Closed Guard Bottom"
        success_rate: 45
        counter_category: "escape"
        description: "Escape hips and recover guard before pass completes"

      - name: "Inversion to Guard"
        target_state: "S047"
        target_position: "Inverted Guard"
        success_rate: 40
        counter_category: "guard_retention"
        description: "Invert under passer and recover guard position"

      - name: "Deep Half Entry"
        target_state: "S028"
        target_position: "Deep Half Guard"
        success_rate: 35
        counter_category: "guard_retention"
        description: "Dive under passer's weave to establish deep half position"

      - name: "Single Leg Attack"
        target_state: "S001"
        target_position: "Top Position"
        success_rate: 30
        counter_category: "counter"
        description: "Attack passer's standing leg during weave execution"

    # Counter Transitions (Responses to Opponent's Attempts)
    counters:
      - opponent_action: "Hip Escape Attempt"
        your_counter: "Pressure Pass Conversion"
        target_state: "S017"
        success_rate: 55
        description: "Drive chest pressure preventing escape and completing pass"

      - opponent_action: "Inversion Defense"
        your_counter: "North-South Transition"
        target_state: "S067"
        success_rate: 50
        description: "Follow inversion with north-south control capturing their movement"

      - opponent_action: "Deep Half Dive Attempt"
        your_counter: "Knee Slice Transition"
        target_state: "S050"
        success_rate: 60
        description: "Convert weave to knee slice when opponent dives deep"

  # Decision Tree Logic (Machine-Readable for Game Engine)
  decision_tree:
    - condition: "leg is fully woven through and hips are controlled"
      priority: 1
      indicators:
        - "Your leg threaded completely through their guard"
        - "Hip-to-hip connection secured"
        - "Opponent's guard structure collapsed"
      actions:
        - technique: "Complete Leg Weave Pass"
          target_state: "S017"
          probability: 55
          reasoning: "Full weave with hip control enables direct pass completion to side control"
        - technique: "Mount Transition from Weave"
          target_state: "S063"
          probability: 45
          reasoning: "Controlled position allows stepping over to mount for dominant positioning"

    - condition: "leg is woven but opponent maintains hip mobility"
      priority: 2
      indicators:
        - "Leg threaded but loose control"
        - "Opponent able to move hips"
        - "Guard not fully collapsed"
      actions:
        - technique: "Pressure Pass Conversion"
          target_state: "S017"
          probability: 55
          reasoning: "Chest pressure through weave immobilizes hips and completes pass"
        - technique: "Knee Slice Transition"
          target_state: "S050"
          probability: 60
          reasoning: "Convert to knee slice mechanics when weave control is loose"

    - condition: "opponent inverts or turns exposing back"
      priority: 3
      indicators:
        - "Opponent inverting under you"
        - "Back exposure during defensive rotation"
        - "Shoulder showing as they turn away"
      actions:
        - technique: "Backstep to Back Control"
          target_state: "S004"
          probability: 40
          reasoning: "Backstep captures exposed back during their defensive movement"
        - technique: "North-South Transition"
          target_state: "S067"
          probability: 50
          reasoning: "Follow their rotation with north-south control maintaining connection"

    - condition: "default - weave initiated but not complete"
      priority: 4
      indicators:
        - "Leg partially through guard"
        - "Opponent defending but not escaping"
        - "Position in transition phase"
      actions:
        - technique: "Pressure Pass Conversion"
          target_state: "S017"
          probability: 55
          reasoning: "Drive pressure to complete weave and pass simultaneously"
        - technique: "Knee Slice Transition"
          target_state: "S050"
          probability: 60
          reasoning: "Convert to more direct knee slice when weave is resisted"

  # State Invariants (Conditions That Define This Position)
  invariants:
    physical:
      - "Top player has one leg threaded or weaving through opponent's guard"
      - "Bottom player on back with guard structure compromised by weave"
      - "Top player's weight distributed between weaving leg and upper body"
      - "Top player in low crouch or driving forward position"
      - "Bottom player's legs partially controlled or entangled by weave"
      - "Close proximity between players with limited space"

    control:
      - "Weaving leg controlling or restricting opponent's hip movement"
      - "Upper body pressure maintaining forward momentum"
      - "Grips on opponent's gi or body controlling defensive reactions"
      - "Head positioning preventing opponent from sitting up"
      - "Chest pressure collapsing opponent's guard structure"
      - "Hip connection or proximity limiting opponent's mobility"

    opponent_limitations:
      - "Cannot maintain full guard structure due to leg weaving"
      - "Hip mobility restricted by threaded leg position"
      - "Must defend against multiple passing angles simultaneously"
      - "Cannot create distance due to close proximity and weave"
      - "Limited time to escape before pass completes"
      - "Defensive options constrained by leg entanglement"

  # Training Considerations
  training:
    prerequisites:
      positions:
        - "Open Guard Top"
        - "Knee Cut Position"
        - "Pressure Passing Framework"

      skills:
        - "Leg threading and weaving mechanics"
        - "Balance maintenance during complex leg movements"
        - "Hip pressure application through compromised guards"
        - "Reading opponent's defensive reactions"
        - "Transitioning between passing styles"
        - "Maintaining forward pressure while mobile"

      concepts:
        - "Guard Passing Principles"
        - "Pressure Application"
        - "Control Point Hierarchy"
        - "Passing Counter System"
        - "Space Management"
        - "Base Maintenance"

    optimal_conditions:
      - "When opponent plays open guard with legs separated"
      - "Against opponents who struggle with complex leg entanglements"
      - "When traditional pressure passing is defended"
      - "In gi when pants grips provide weaving control"
      - "When top player has good balance and hip mobility"
      - "Against opponents unfamiliar with leg weave defense"

    vulnerable_moments:
      - "During initial leg threading when balance is compromised"
      - "If opponent successfully inverts before weave completes"
      - "When weaving leg becomes entangled without forward progress"
      - "If opponent establishes strong frames during weave execution"
      - "When attempting weave against highly mobile guard players"
      - "If grips are lost during complex threading motion"

    energy_fatigue_factors:
      - "Leg weaving requires significant balance and coordination energy"
      - "Maintaining pressure while threading drains upper body endurance"
      - "Complex leg movements more fatiguing than simple passes"
      - "Position typically short-lived (1-2 minutes) due to intensity"
      - "Failed weave attempts require complete repositioning"
      - "High cognitive load managing entanglement and pressure simultaneously"

  # Position Progressions and Relationships
  progressions:
    leads_to:
      - state_id: "S017"
        position: "Side Control"
        relationship: "dominant_transition"
        description: "Completing leg weave pass achieves side control through hip control and threading"

      - state_id: "S063"
        position: "Mount"
        relationship: "dominant_transition"
        description: "Stepping over from controlled weave achieves mount position"

      - state_id: "S067"
        position: "North-South"
        relationship: "natural_progression"
        description: "Circling around opponent's head from weave achieves north-south control"

      - state_id: "S050"
        position: "Knee Cut Position"
        relationship: "alternative"
        description: "Converting weave to knee slice when threading is resisted"

    related_positions:
      - state_id: "S069"
        position: "Open Guard Top"
        relationship: "entry_position"
        description: "Leg weave typically initiated from open guard passing position"

      - state_id: "S050"
        position: "Knee Cut Position"
        relationship: "similar_offensive"
        description: "Both involve leg clearing and complex passing mechanics"

      - state_id: "S085"
        position: "Smash Pass Position"
        relationship: "variation"
        description: "Both utilize pressure and leg control for passing"

      - state_id: "S004"
        position: "Back Control"
        relationship: "opportunistic_transition"
        description: "Back take available when opponent inverts or turns during weave defense"

# ============================================================================
# SCHEMA.ORG STRUCTURED DATA (SEO Optimization)
# ============================================================================
schema_org:
  # HowTo Schema for Technical Content
  howto:
    type: "HowTo"
    name: "How to Use Leg Weave Position Top in BJJ"
    description: "Complete guide to executing leg weaving mechanics, guard passing, and control transitions from leg weave position."
    total_time: "PT6M"

    steps:
      - name: "Initiate Leg Threading"
        text: "From open guard top, begin threading one leg through opponent's guard structure while maintaining upper body pressure and control."
        position: 1

      - name: "Complete Leg Weave"
        text: "Fully thread leg through their guard while controlling their hips, collapsing guard structure through entanglement and pressure."
        position: 2

      - name: "Secure Hip Control"
        text: "Establish hip-to-hip connection using woven leg and upper body pressure, immobilizing opponent's mobility."
        position: 3

      - name: "Complete Pass to Side Control"
        text: "Drive forward pressure through woven position, clearing remaining legs and securing side control."
        position: 4

      - name: "Alternative Mount Transition"
        text: "From controlled weave, step over opponent to mount position when their guard is fully collapsed."
        position: 5

      - name: "North-South Option"
        text: "Circle to north-south control when opponent's defensive movement creates opening, maintaining connection throughout."
        position: 6

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  # FAQ Schema for Rich Snippets
  faq:
    - question: "What makes Leg Weave Position effective for guard passing?"
      answer: "Leg weaving creates complex entanglement that collapses opponent's guard structure while controlling hip mobility. The threaded leg position prevents guard recovery and creates multiple passing angles including side control, mount, and north-south. Success rate reaches 70-75% for advanced practitioners when executed with proper pressure and timing."
      category: "fundamentals"

    - question: "When should I complete the Leg Weave Pass vs transition to Mount?"
      answer: "Complete weave pass to side control when hip control is secured and forward path is clear (55-75% success). Transition to mount when weave has fully collapsed their guard and stepping over is available (45-65% success). Mount option is higher-value but requires complete guard collapse, while side control is more direct."
      category: "tactics"

    - question: "How do I prevent opponent from inverting during Leg Weave?"
      answer: "Maintain constant forward pressure preventing space for inversion, control their hips with woven leg and upper body weight, establish head control preventing sit-up attempts, and be ready to follow with north-south transition if inversion begins. If they successfully invert, convert to north-south or backstep to back control rather than trying to prevent completed inversion."
      category: "defense"

    - question: "What are the key control points in Leg Weave Position?"
      answer: "Critical control points include: woven leg controlling hip mobility, upper body pressure maintaining forward momentum, head positioning preventing opponent sit-up, chest pressure collapsing guard structure, and hip connection limiting their movement. Woven leg is primary control creating the entanglement that enables pass."
      category: "fundamentals"

    - question: "When is the best time to transition to Knee Slice from Leg Weave?"
      answer: "Transition to knee slice when weave threading is resisted and not progressing (60% success), when opponent maintains hip mobility despite weave attempt, when weaving leg becomes entangled without completing pass, or when clearer passing path opens through knee slice mechanics. Converting maintains passing momentum when weave is defended."
      category: "tactics"

    - question: "What makes Leg Weave technically challenging compared to other passes?"
      answer: "Leg weave requires: complex leg threading mechanics while maintaining balance, simultaneous pressure application and leg movement coordination, reading opponent's defensive reactions during dynamic threading, and managing multiple passing outcomes based on their response. Higher technical demands and energy cost compared to simpler passes like knee slice or long step, but provides unique solution when those passes are defended."
      category: "technical"

# ============================================================================
# LLM CONTEXT BLOCK (AI/Game Engine Optimization)
# ============================================================================
llm_context:
  # One-Sentence Summary for AI Context
  position_summary: "Leg Weave Position Top is an advanced guard passing position featuring complex leg threading through opponent's guard that collapses structure and controls hip mobility, enabling multiple passing outcomes including side control, mount, and north-south with high technical demands."

  # Key Success Factors (Prioritized)
  key_success_factors:
    - factor: "Leg Threading Mechanics and Balance"
      importance: "critical"
      description: "Successfully threading leg through guard while maintaining balance and forward pressure creates the entanglement that collapses opponent's defensive structure"
      game_impact: "Increases pass success by +25% and reduces guard retention by -20%"

    - factor: "Hip Control Through Entanglement"
      importance: "critical"
      description: "Woven leg position controls opponent's hip mobility preventing guard recovery and creating immobilization needed for pass completion"
      game_impact: "Increases position retention by +20% and pass completion by +15%"

    - factor: "Forward Pressure Maintenance"
      importance: "high"
      description: "Maintaining constant chest and upper body pressure throughout weaving prevents opponent from creating space for inversion or escape"
      game_impact: "Increases pass success by +15% and reduces defensive effectiveness"

    - factor: "Transition Recognition and Adaptation"
      importance: "high"
      description: "Reading when weave is succeeding versus being defended and converting to knee slice, north-south, or mount preserves passing momentum"
      game_impact: "Increases overall passing success by +15% through tactical flexibility"

    - factor: "Timing and Coordination"
      importance: "medium"
      description: "Coordinating leg threading, pressure application, and balance maintenance simultaneously requires developed technical proficiency and timing awareness"
      game_impact: "Increases execution success by +10% through proper technical sequencing"

  # Common Questions (Q&A Patterns for LLM/Chatbot)
  common_questions:
    - q: "When should I use Leg Weave Position versus simpler passing options?"
      a: "Use leg weave when opponent plays open guard with separated legs, when traditional pressure passing is defended with strong frames, or when you need alternative passing angle that bypasses their defensive structures. Avoid leg weave when opponent has highly mobile guard with strong inversion capability, or when simpler passes like knee slice are readily available. Leg weave is technical solution for specific defensive structures, not default passing approach."
      context: "decision_making"
      skill_level: "advanced"

    - q: "How do I maintain balance while threading my leg through their guard?"
      a: "Distribute weight between threading leg and upper body connection, maintain low center of gravity during threading motion, use grips to stabilize position, and thread progressively rather than attempting complete weave in single movement. Practice threading motion slowly developing proprioception before adding pressure and speed. Balance is fundamental requirement for successful weave execution."
      context: "technical"
      skill_level: "intermediate"

    - q: "What if opponent successfully inverts while I'm attempting leg weave?"
      a: "Don't try to prevent completed inversion—follow their movement with north-south transition maintaining connection, or backstep to back control capturing their exposed position. Inversion during weave creates opportunities for dominant position transitions if you read movement early and follow rather than resist. Their defensive inversion becomes your positional advancement."
      context: "problem_solving"
      skill_level: "advanced"

    - q: "How do I choose between completing pass to side control versus taking mount?"
      a: "Choose side control when hip control is secured and forward path is clear—more direct and reliable option (55-75% success). Choose mount when weave has fully collapsed their guard and stepping over is clearly available (45-65% success). Mount is higher-value position but requires complete guard collapse. Read position clarity and choose most secure option."
      context: "tactical"
      skill_level: "advanced"

    - q: "What makes Leg Weave effective against defensive guard players?"
      a: "Leg weave creates complex entanglement that defensive players struggle to manage while maintaining guard structure. The threading motion collapses defenses that work against linear passes, and creates multiple passing outcomes forcing defense of simultaneous threats. Most effective against players who defend with frames and structure rather than mobility and inversions."
      context: "tactical"
      skill_level: "advanced"

    - q: "How much energy does Leg Weave consume compared to other passes?"
      a: "Leg weave is high energy pass due to complex leg threading while maintaining pressure, balance coordination requirements, and muscular engagement throughout execution. Consumes approximately 20-30% more energy than simple knee slice or long step passes. Reserve for situations where simpler passes are defended. Position typically resolves within 1-2 minutes due to intensity demands."
      context: "energy_management"
      skill_level: "intermediate"

  # Coaching Cues (Natural Language for Instruction)
  coaching_cues:
    - "Thread the leg through - create the entanglement"
    - "Pressure forward constantly - never give them space"
    - "Balance first, weave second - don't sacrifice stability"
    - "Control the hips with your woven leg - immobilize their movement"
    - "When they invert, you follow - capture their defensive motion"
    - "Multiple outcomes available - read and choose best option"
    - "Convert to knee slice when weave is resisted - adapt early"
    - "Step over to mount when their guard collapses - seize opportunities"
    - "Head control prevents their sit-up - dominant positioning"
    - "Coordinate legs, pressure, and balance - symphony, not solo"

  # Training Focus by Skill Level
  training_focus:
    beginner:
      - "Understanding basic leg threading mechanics without opponent resistance"
      - "Developing balance during simple leg movements through guard"
      - "Learning to maintain pressure while moving legs"
      - "Recognizing when guard structure is collapsed versus intact"

    intermediate:
      - "Executing complete leg weave under moderate resistance"
      - "Developing hip control through woven leg positioning"
      - "Learning to recognize when to complete pass versus transition"
      - "Building coordination between threading and pressure application"

    advanced:
      - "Mastering mount and north-south transitions from weave"
      - "Reading opponent's inversion attempts and following with back control"
      - "Chaining weave attempts with knee slice conversions seamlessly"
      - "Developing systematic approach integrating weave into complete passing game"

  # Game Engine Hints
  game_engine_hints:
    energy_cost_factors:
      - "Maintaining position: High drain per turn (complex threading under pressure)"
      - "Pass completion: High energy (coordinated movement and pressure)"
      - "Transitions: Medium energy (technical adjustments)"
      - "Position typically short-lived (1-2 minutes) due to high intensity demands"

    position_strength: "Moderately strong offensive passing position with high technical demands but excellent collapse of defensive structures when executed properly"

    opponent_pressure: "High stress on opponent due to complex entanglement, hip immobilization, and multiple passing threats simultaneously"

    ideal_scenarios:
      - "Against opponents playing open guard with separated legs"
      - "When traditional pressure passes are defended with strong frames"
      - "Against defensive players who rely on structure over mobility"
      - "When top player has developed technical proficiency and good balance"

    dilemma_creation:
      - "Defending weave pass exposes opponent to mount transition"
      - "Maintaining guard structure opens north-south transition"
      - "Inverting to escape creates back control opportunity"
      - "Hip escaping allows pressure pass conversion to complete"

  # Success Modifiers (Probabilistic Adjustments for Game Engine)
  success_modifiers:
    - condition: "Leg fully woven with hip control secured"
      modifier: +25
      applies_to: "pass_completion"
      description: "Complete weave with hip immobilization enables high-percentage pass"

    - condition: "Constant forward pressure maintained"
      modifier: +15
      applies_to: "all_offensive_transitions"
      description: "Forward pressure prevents opponent from creating defensive space"

    - condition: "Opponent's guard structure collapsed"
      modifier: +20
      applies_to: "mount_transition|pass_completion"
      description: "Collapsed guard enables multiple high-percentage passing outcomes"

    - condition: "Balance compromised during threading"
      modifier: -20
      applies_to: "position_retention|pass_success"
      description: "Lost balance during weaving creates vulnerability and reduces effectiveness"

    - condition: "Opponent has strong inversion capability"
      modifier: -15
      applies_to: "weave_completion"
      description: "Mobile invertors can escape weave more effectively"

    - condition: "Gi grips securing threading control"
      modifier: +10
      applies_to: "position_retention|weave_completion"
      description: "Gi grips enhance control during complex threading motion"

    - condition: "Knowledge test passed (80%+)"
      modifier: +10
      applies_to: "transition_recognition|technical_execution"
      description: "Understanding mechanics enables proper execution and adaptation"

    - condition: "Weaving leg becomes entangled without progress"
      modifier: -15
      applies_to: "pass_success|position_retention"
      description: "Stuck weave without forward progress creates stalling situation"

  # Dilemma Structures (Craig Jones Philosophy)
  dilemmas:
    - scenario: "Opponent maintains guard structure defending weave pass"
      dilemma_created: "Maintaining structure prevents immediate pass but enables mount transition when guard finally collapses"
      offensive_options:
        - "Mount Transition from Weave → Mount (Success: 45%)"
        - "Pressure Pass Conversion → Side Control (Success: 55%)"
      narrative: "Your opponent fights hard to maintain their guard structure, defending against your weave pass. Good defense, but it won't last. As their structure finally gives way, you step over to mount. Their resistance just delayed the inevitable and gave you an even better position."

    - scenario: "Opponent inverts attempting to escape weave entanglement"
      dilemma_created: "Inversion escapes weave but exposes back and creates north-south or back control opportunity"
      offensive_options:
        - "Backstep to Back Control → Back Control (Success: 40%)"
        - "North-South Transition → North-South (Success: 50%)"
      narrative: "Your opponent inverts desperately, trying to escape your weave. Smart attempt, but you're reading their movement. Follow the inversion and capture their back, or circle to north-south maintaining connection. Their escape attempt just gave you dominant position. Thanks for showing me your back."

    - scenario: "Opponent attempts hip escape to create distance"
      dilemma_created: "Hip escaping creates movement but allows pressure pass conversion through the opening"
      offensive_options:
        - "Pressure Pass Conversion → Side Control (Success: 55%)"
        - "Knee Slice Transition → Knee Cut Position (Success: 60%)"
      narrative: "Your opponent hip escapes hard, trying to create the distance they need to recover. But their movement opens new passing lanes. Drive your pressure through that opening, or convert to knee slice. Their escape attempt just cleared your path to pass."

    - scenario: "Opponent maintains hip mobility despite weave attempt"
      dilemma_created: "Hip mobility defends weave but creates vulnerability to knee slice and pressure pass conversions"
      offensive_options:
        - "Knee Slice Transition → Knee Cut Position (Success: 60%)"
        - "Pressure Pass Conversion → Side Control (Success: 55%)"
      narrative: "Your opponent maintains hip mobility impressively, preventing your weave from immobilizing them. Skilled defense. But their mobile hips just created your knee slice opportunity. Convert seamlessly and pass from a different angle. One defense, one new attack."

  # Narrative Generation Prompts
  narrative_prompts:
    entry: "You begin threading your leg through their guard, creating complex entanglement. The weave initiates. Their guard structure begins to collapse."
    control: "Your leg is woven through their guard, hip control established. Forward pressure maintains constant threat. Their mobility is compromised."
    attack_initiation: "The weave is complete, hips controlled, guard collapsed. Time to finish. Drive forward to side control, or step over to mount. Victory is close."
    success: "Your pressure drives through, weave completed. Side control secured. The pass is complete. Technical execution pays off."
    failure: "The weave is defended, entanglement fails. But you're adaptive. Convert to knee slice, maintain pressure. Different path, same destination."
    position_loss: "Guard recovered, weave escaped. Position lost. Analyze what went wrong, adjust approach, attack again from standing."
    pass_completion: "Everything aligns—woven leg controls hips, pressure collapses defenses, path clears. Drive to completion. Side control is yours."
    mount_transition: "Their guard completely collapses under your weave. The opening appears. Step over confidently. Mount position achieved from technical passing."
    defensive_follow: "They invert escaping, but you follow their movement. North-south transition, or back control capture. Their defense becomes your advancement."

  # Knowledge Assessment Questions
  knowledge_questions:
    - question: "What are the three critical mechanical elements that define successful Leg Weave Position?"
      answer: "The three critical elements are: (1) Leg threading through opponent's guard creating entanglement that collapses structure, (2) Hip control through woven leg position immobilizing their mobility, and (3) Constant forward pressure maintaining throughout execution preventing defensive space. These elements work together to create passing mechanics that bypass traditional frame defenses."
      difficulty: "intermediate"
      category: "fundamentals"
      points: 15

    - question: "When opponent inverts during leg weave execution, which transition has highest success and why?"
      answer: "North-South Transition has highest success (50%+) because following their inversion with circling motion maintains connection and captures their movement. Alternatively, Backstep to Back Control is available (40%) when their shoulder clearly exposes. Following their defensive motion rather than resisting it converts their escape attempt into your positional advancement. This exemplifies using opponent's movement against them."
      difficulty: "advanced"
      category: "tactics"
      points: 20

    - question: "How does Leg Weave Position differ strategically from Knee Cut Position in guard passing?"
      answer: "Leg weave creates complex entanglement collapsing guard structure through threading mechanics, most effective against defensive players with frames and structure. Knee cut uses direct cutting motion through guard, more effective against mobile guards. Weave has higher technical demands and energy cost but provides unique solution when knee cut is framed. Weave offers mount transition option that knee cut lacks. Each has specific optimal applications based on opponent's defensive style and positioning."
      difficulty: "advanced"
      category: "systems"
      points: 20

    - question: "Explain why Leg Weave Position is more energy-intensive than simpler passing options."
      answer: "Leg weave requires: complex leg threading mechanics while maintaining balance (coordination demands), simultaneous pressure application and leg movement (muscular engagement), constant forward pressure throughout execution (endurance requirements), and managing multiple potential outcomes (cognitive load). Consumes 20-30% more energy than simple knee slice or long step due to technical complexity and coordination requirements. Position typically short-lived (1-2 minutes) before resolution due to intensity. Should be reserved for situations where simpler passes are defended."
      difficulty: "intermediate"
      category: "energy_management"
      points: 15

    - question: "Describe the decision-making process for choosing between completing weave pass to side control versus transitioning to mount."
      answer: "Choose side control pass when: hip control is secured, forward path to side is clear, most direct option available (55-75% success). Choose mount transition when: weave has fully collapsed opponent's guard structure, stepping over is clearly available, guard is completely compromised (45-65% success). Mount is higher-value position but requires complete collapse, while side control is more direct and reliable. Read position clarity—if mount requires forcing, choose side control. If mount is clearly available, take dominant position."
      difficulty: "advanced"
      category: "decision_making"
      points: 20

    - question: "What makes Leg Weave particularly effective against defensive guard players who rely on frames?"
      answer: "Leg weave creates complex entanglement that collapses defensive structures frames are designed to protect. Threading motion bypasses linear frame defenses by creating lateral and rotational pressure rather than direct forward pressure. Woven leg position controls hips making frames less effective since their defensive structure is already compromised. Creates multiple simultaneous passing threats (side control, mount, north-south) forcing defense of all options. Most effective against static defensive structures rather than mobile invertors. Defensive frames that stop pressure passes often fail against weaving mechanics."
      difficulty: "advanced"
      category: "tactical"
      points: 20

---

# Leg Weave Position Top
#bjj #state #guard-passing #top #advanced

## State Description

Leg Weave Position Top is an advanced guard passing position characterized by complex leg threading through the opponent's guard structure, creating entanglement that collapses their defensive positioning and controls hip mobility for pass completion. With a point value of 0 (passing position, not yet scoring), this position is classified as highly offensive with primary focus on advancing to side control, mount, or north-south through technical leg weaving mechanics. It is particularly effective against defensive guard players who rely on frames and structure rather than mobility and inversions, providing unique solution when traditional pressure passes are defended.

This position emphasizes technical proficiency and coordination, requiring simultaneous leg threading, pressure application, and balance maintenance throughout execution. The leg weaving motion creates complex entanglement that defensive players struggle to manage while maintaining guard structure, with the woven leg controlling hip mobility and preventing guard recovery. When executed properly, the position offers multiple high-percentage outcomes including direct pass to side control (55-75% advanced), mount transition (45-65% advanced), and north-south control (50-70% advanced), making it versatile finishing platform for passes.

Leg Weave Position excels when the top player possesses developed technical skill, good balance during complex movements, and ability to maintain forward pressure throughout threading mechanics. The position's strength lies in its unique approach to collapsing defensive structures—bypassing frames through entanglement rather than direct pressure. However, it carries significant vulnerabilities including balance compromise during threading, higher energy cost compared to simpler passes (20-30% more intensive), and vulnerability to opponent's inversion attempts if not recognized early. The position demands respect for technical complexity and should be developed progressively as advanced passing option rather than fundamental approach.

## Visual Description

You are in low crouch or driving forward position with one leg threading or fully woven through opponent's guard structure, creating complex entanglement between your bodies. Your opponent is on their back with guard structure compromised or collapsed by your leg threading, legs partially controlled or entangled by your weaving motion. Your threaded leg is positioned through their guard controlling their hip line and mobility with your knee or thigh applying pressure, while your other leg is posted for balance and base. Your upper body maintains forward pressure with chest driving toward them, hands gripping gi or controlling body positions preventing defensive movements. Your weight is distributed between your woven leg, posted leg, and upper body connection maintaining constant forward momentum.

The spatial relationship creates tight proximity with limited space between players as weaving mechanics require close contact throughout execution. Your center of gravity is positioned low and forward maintaining balance despite complex leg positioning, with torso angled to drive pressure through woven leg position. The pressure distribution places controlling force through your woven leg on their hips while your chest pressure collapses their guard structure, preventing them from creating space for recovery or escape. Your head positioning maintains control preventing them from sitting up or inverting easily, though skilled opponents may still attempt defensive inversions.

This creates high-pressure passing environment where opponent must simultaneously defend entanglement, prevent pass completion, and manage multiple potential outcomes including side control, mount, and north-south, forcing reactive defense and limiting offensive options.

## Key Principles

- **Leg Threading Mechanics and Balance**: Successfully threading leg through guard while maintaining stable balance creates the entanglement that collapses defensive structures, requiring coordination between leg movement and weight distribution
- **Hip Control Through Entanglement**: Woven leg position controls opponent's hip mobility preventing guard recovery and creating immobilization that enables multiple passing outcomes
- **Constant Forward Pressure**: Maintaining unrelenting chest and upper body pressure throughout weaving execution prevents opponent from creating space for inversion, escape, or guard recovery
- **Multiple Outcome Awareness**: Understanding that weave can result in side control pass, mount transition, or north-south control based on opponent's defensive reactions enables adaptive completion rather than forcing single option
- **Coordination Timing**: Synchronizing leg threading, pressure application, and balance maintenance simultaneously requires developed proprioception and technical proficiency
- **Transition Recognition**: Reading when weave is succeeding versus being effectively defended and converting to knee slice or alternative passes preserves passing momentum and prevents energy waste on failing techniques
- **Defensive Movement Following**: When opponent inverts or turns exposing back during weave defense, following their movement with north-south or back control converts their escape attempt into positional advancement

## Offensive Transitions

From this position, you can execute:

### Guard Passes
- [[Side Control]] via Complete Leg Weave Pass (Success Rate: Beginner 40%, Intermediate 55%, Advanced 75%)
  - Thread leg completely through guard and drive forward pressure to side control when hip control is secured

- [[Mount]] via Mount Transition from Weave (Success Rate: Beginner 30%, Intermediate 45%, Advanced 65%)
  - Step over opponent's body to mount when weave has fully collapsed their guard structure

- [[North-South]] via North-South Transition (Success Rate: Beginner 35%, Intermediate 50%, Advanced 70%)
  - Circle to north-south control when opponent's defensive movement creates angle or inversion attempt

- [[Side Control]] via Pressure Pass Conversion (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
  - Drive chest pressure through woven leg position completing pass when hip control allows

### Position Advancements
- [[Back Control]] via Backstep to Back Control (Success Rate: Beginner 25%, Intermediate 40%, Advanced 60%)
  - Backstep over leg capturing exposed back when opponent turns away during defensive rotation

- [[Knee Cut Position]] via Knee Slice Transition (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
  - Convert weave to knee slice mechanics when threading is resisted or not progressing

## Defensive Responses

When opponent has this position against you (you are bottom), available counters:

- [[Closed Guard Bottom]] via Hip Escape Recovery (Success Rate: 45%)
  - Escape hips and recover guard before weave completes and pass is secured

- [[Inverted Guard]] via Inversion to Guard (Success Rate: 40%)
  - Invert under passer's weave and recover guard position through rotation

- [[Deep Half Guard]] via Deep Half Entry (Success Rate: 35%)
  - Dive under passer's weaving structure to establish deep half position

- [[Top Position]] via Single Leg Attack (Success Rate: 30%)
  - Attack passer's standing or posted leg during weave execution creating counter-opportunity

## Decision Tree

**If** leg is fully woven through and hips are controlled:
- Execute [[Complete Leg Weave Pass]] → [[Side Control]] (Probability: 55%)
  - Reasoning: Complete weave with hip control enables direct pass completion with high success rate
- Or Execute [[Mount Transition from Weave]] → [[Mount]] (Probability: 45%)
  - Reasoning: Controlled position with collapsed guard allows stepping over for dominant mount positioning

**Else if** leg is woven but opponent maintains hip mobility:
- Execute [[Pressure Pass Conversion]] → [[Side Control]] (Probability: 55%)
  - Reasoning: Chest pressure through weave immobilizes hips and completes pass despite mobility
- Or Execute [[Knee Slice Transition]] → [[Knee Cut Position]] (Probability: 60%)
  - Reasoning: Converting to knee slice mechanics when weave control remains loose

**Else if** opponent inverts or turns exposing back:
- Execute [[Backstep to Back Control]] → [[Back Control]] (Probability: 40%)
  - Reasoning: Backstep captures exposed back during their defensive movement
- Or Execute [[North-South Transition]] → [[North-South]] (Probability: 50%)
  - Reasoning: Following their rotation with north-south maintains connection and captures movement

**Else** (weave initiated but not complete):
- Execute [[Pressure Pass Conversion]] → [[Side Control]] (Probability: 55%)
  - Reasoning: Drive pressure to complete weave and pass simultaneously
- Or Execute [[Knee Slice Transition]] → [[Knee Cut Position]] (Probability: 60%)
  - Reasoning: Convert to more direct knee slice when weave meets significant resistance

## Expert Insights

**John Danaher**: "Leg weave passing represents sophisticated approach to guard passing where complex entanglement collapses defensive structures that resist linear pressure passes. The position's effectiveness derives from geometric control—your threaded leg creates hip immobilization while simultaneously compromising their guard structure's integrity. Study the position hierarchically: leg weave when defensive frames prevent simpler passes, recognize multiple completion options based on opponent's reactions, maintain pressure throughout to prevent inversion escapes. The technical demands are significant—balance during threading, coordination of pressure and movement, reading defensive patterns. But when mastered, leg weave provides solution to defensive structures other passes cannot penetrate. The key principle is controlled entanglement with purpose, not complex movement for its own sake."

**Gordon Ryan**: "In competition, leg weave is my advanced option when opponent defends traditional pressure passes with strong frames. The threading motion bypasses their defensive structure creating passing opportunities that direct pressure alone won't achieve. I focus heavily on the mount transition when their guard fully collapses—that's the high-value outcome. If they start inverting during weave, I'm following to north-south or backstep to back control capturing their movement. The technical challenge is real—you need good balance and coordination. But against high-level defensive guard players, leg weave creates problems they struggle to solve. Train the complete position including all transition options, because your opponent's defense determines which finish opens."

**Eddie Bravo**: "Leg weave is part of advanced passing game that creates chaos in their guard through complex entanglement. I teach it as situational weapon rather than primary passing approach—when their frames are strong and traditional passes aren't opening, weave gives you different angle. The creativity comes in reading their defensive reactions and flowing to best outcome: side control, mount, north-south, back control all available based on how they defend. It's more applicable in gi where you can control their movements during threading, but no-gi weave works when you have good body control. Energy cost is real so don't spam it—use strategically when situation calls for complex solution. And always be ready to convert to simpler passes like knee slice if weave gets resisted."

## Common Errors

### Error: Losing balance during leg threading execution
- **Consequence**: Balance compromise during threading creates vulnerability to sweeps, prevents effective pressure application (-20% modifier), and may result in failed weave with complete position loss. Technical execution fails when balance is lost.
- **Correction**: Maintain low center of gravity during threading motion, distribute weight appropriately between weaving leg and upper body, use grips for stabilization, and thread progressively rather than attempting complete weave in single movement. Practice threading slowly developing balance awareness before adding resistance and speed.
- **Recognition**: If you feel unstable or off-balance during weave, or if opponent can easily disrupt your position, balance is insufficient. Should maintain confident stable positioning throughout complex leg movement.

### Error: Attempting weave without sufficient forward pressure
- **Consequence**: Insufficient pressure allows opponent to create space for inversion or escape, enables guard recovery despite threading, and reduces weave effectiveness dramatically. Pressure and threading must occur simultaneously for success.
- **Correction**: Maintain constant chest and upper body pressure driving forward throughout entire weaving motion. Think of pressure and threading as one unified action, not separate movements. Upper body drives while legs thread creating coordinated attack.
- **Recognition**: If opponent has space to move or invert during your weave attempt, or if they can sit up easily, forward pressure is inadequate. Should feel like you're driving them into mat continuously.

### Error: Forcing weave when opponent successfully defends with mobility
- **Consequence**: Stubbornly continuing weave against effective mobility defense wastes significant energy, telegraphs intention enabling better defensive positioning, and ignores better passing options like knee slice that may be available (-15% modifier on continued attempts).
- **Correction**: Recognize within 5-10 seconds when opponent maintains hip mobility despite weave attempt and immediately convert to knee slice transition or establish controlling position to reset. Adaptation preserves energy and maintains passing momentum.
- **Recognition**: If your weave attempts repeatedly fail to immobilize their hips, or if you feel like you're fighting against their movement constantly, defense is succeeding. Convert to alternative pass rather than forcing failing technique.

### Error: Not following opponent's inversion with position transitions
- **Consequence**: Allowing opponent to complete inversion without following enables guard recovery or escape, wastes positional advantage created by weave, and misses opportunity to capture back control or north-south. Their defensive movement should become your advancement.
- **Correction**: Read inversion attempts early and follow their movement with north-south transition maintaining connection, or backstep to back control capturing exposed position. Practice recognizing inversion initiation and reacting proactively rather than waiting until completed.
- **Recognition**: If opponent successfully inverts and recovers guard while you remain static, or if you lose connection during their rotation, you're not following defensive movement. Should maintain contact throughout their inversion.

### Error: Inadequate hip control through woven leg positioning
- **Consequence**: Loose woven leg position without hip control allows opponent to maintain guard structure, prevents pass completion despite threading, and reduces effectiveness of entire position. Primary control mechanism fails when hip control is not secured.
- **Correction**: Focus on using woven leg to actively control and immobilize opponent's hip movement, not just threading through space. Create constant pressure through woven leg maintaining hip connection. Hip control is purpose of threading, not threading for its own sake.
- **Recognition**: If opponent maintains significant hip mobility despite your woven leg position, or if their guard structure remains intact, hip control is insufficient. Should feel their hips immobilized by your leg positioning.

### Error: Attempting weave against highly mobile invertors
- **Consequence**: Mobile players with strong inversion capability can escape weave attempts through rotation before threading completes, making weave low-percentage option against this opponent type (-15% modifier). Wrong technique for specific defensive style.
- **Correction**: Recognize opponent's inversion capability early and choose alternative passes like knee slice or pressure passes that better address mobile defenders. Reserve weave for opponents who defend with structure and frames rather than mobility and inversions.
- **Recognition**: If opponent repeatedly escapes your weave attempts through inversion, or if they clearly have high mobility and rotation capability, weave is suboptimal choice. Select passing style that matches their defensive characteristics.

### Error: Neglecting grip control during complex threading motion
- **Consequence**: Lost grips during threading eliminate connection enabling opponent disengagement, reduce control during complex movement, and prevent smooth transitions between positions. Technical execution compromised without grip foundation.
- **Correction**: Maintain at least one strong grip throughout weaving motion, establish immediate replacement grip if one is lost, and use grips actively for stabilization and control during threading. Gi grips particularly important providing enhanced control (+10% modifier).
- **Recognition**: If you feel disconnected from opponent during weave, or if they can move independently of your position, grip control is inadequate. Should maintain constant connection through grips and body pressure.

## Training Drills

### Drill 1: Leg Threading Mechanics Development
Partner in open guard provides static position (0% resistance). Practice threading leg through their guard slowly focusing exclusively on balance maintenance and smooth motion. Begin with partial threading (threading to knee level), progress to three-quarter threading, then complete weave. Hold stable position at each stage for 5 seconds developing proprioception. Perform 3-minute rounds with emphasis on feeling balanced and controlled throughout threading motion. Foundational drill for developing mechanics without pressure.

### Drill 2: Pressure and Threading Coordination
Partner in open guard provides moderate resistance (50%). Practice coordinating upper body forward pressure simultaneously with leg threading motion. Focus on maintaining constant chest pressure while legs weave through guard. Partner provides feedback when pressure decreases during threading. Perform 4-minute rounds. Success metric: maintaining consistent forward pressure throughout entire threading sequence. Critical for developing unified pressure-threading coordination.

### Drill 3: Pass Completion from Established Weave
Partner allows you to establish woven leg position with moderate control. Practice recognizing when to complete pass to side control versus transition to mount. Partner provides 25% resistance initially allowing both options, progress to 50% resistance with one option defended requiring proper choice. Emphasize decision-making based on guard collapse level and available paths. Perform 3-minute rounds developing outcome recognition skills.

### Drill 4: Defensive Movement Following
Start in established leg weave. Partner executes specific defensive movements: (1) hip escape → follow with pressure pass conversion, (2) inversion → follow with north-south transition, (3) turning away → backstep to back control. Begin with partner calling out defense before executing (25% speed), progress to no verbal cues with realistic speed (75%). Perform 5-minute rounds. Develops reactive following of opponent's defensive movements.

### Drill 5: Live Weave Passing with Progressive Resistance
Start in opponent's open guard. Attempt complete leg weave passing sequence with all transition options available. Partner provides progressive resistance over training weeks: (1) passive structure defense (25%), (2) active frame and mobility defense (50%), (3) offensive guard recovery and sweeps (75%), (4) full competition resistance (100%). Perform 5-minute rounds. Integrates all skills in increasingly realistic context developing complete weave passing game.

## Related Positions

- [[Open Guard Top]] - Entry position from which leg weave is typically initiated during guard passing
- [[Knee Cut Position]] - Primary conversion position when weave threading is resisted or defended
- [[Side Control]] - Terminal position achieved through successful leg weave pass completion
- [[Mount]] - Alternative terminal position accessed by stepping over from collapsed guard
- [[North-South]] - Control position accessed by circling during opponent's defensive movements
- [[Back Control]] - Opportunistic position available when opponent inverts or turns exposing back
- [[Smash Pass Position]] - Related pressure-based passing with similar guard collapse emphasis

## Optimal Submission Paths

**Fastest path to dominance** (mount):
[[Leg Weave Position Top]] → [[Mount]] → [[Armbar Finish]] → [[Won by Submission]]
*Reasoning: Direct mount transition when weave fully collapses guard structure provides dominant position with multiple high-percentage submissions. Mount from weave (45-65% success advanced) leads to armbar, cross collar, or other mount attacks. Fastest to dominant finishing position when guard collapse is complete.*

**High-percentage path** (systematic):
[[Leg Weave Position Top]] → [[Side Control]] → [[Mount Control]] → [[Submission Chain]] → [[Won by Submission]]
*Reasoning: More reliable pass completion to side control (55-75% success advanced), progression through positional hierarchy to mount. Systematic approach controlling each stage before advancing. Emphasizes position-over-submission progression.*

**Alternative path** (north-south):
[[Leg Weave Position Top]] → [[North-South]] → [[North-South to Kimura]] → [[Won by Submission]]
*Reasoning: When opponent inverts or creates defensive movement, follow with north-south transition maintaining connection. North-south provides kimura, choke, and other finishing options. Different geometric approach when inversion occurs.*

**Back take path** (opportunistic):
[[Leg Weave Position Top]] → [[Backstep to Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: When opponent turns away exposing back during weave defense, backstep captures dominant back control (40-60% success advanced). Direct path to highest-value position with rear naked choke. Requires recognition of back exposure timing.*

**Control-focused path** (pressure):
[[Leg Weave Position Top]] → [[Pressure Pass Conversion]] → [[Side Control Consolidation]] → [[Mount]] → [[Submission Chain]] → [[Won by Submission]]
*Reasoning: Driving pressure through established weave completes pass when hip control allows. Methodical progression through side control to mount emphasizing retention. Most reliable for competition when positional points and control security are priorities.*

## Timing Considerations

**Best Times to Enter**:
- When opponent plays open guard with legs separated creating threading opportunity
- After traditional pressure passes are defended with strong frame structures
- When opponent's guard structure appears vulnerable to entanglement
- During transitions when guard position is temporarily disrupted

**Best Times to Attack**:
- When leg is fully woven with secure hip control (pass completion timing)
- When opponent's guard structure collapses under threading pressure (mount transition timing)
- During opponent's inversion attempt (north-south or back control opportunity)
- When hip escaping movement creates passing lanes (pressure conversion timing)

**Vulnerable Moments**:
- During initial leg threading when balance is momentarily compromised
- When attempting weave against highly mobile invertors
- If grips are lost during complex threading motion
- When weaving leg becomes entangled without forward progress
- During transition between weave and alternative passes if commitment is unclear

**Fatigue Factors**:
- Complex leg threading drains coordination and balance energy significantly
- Maintaining pressure while weaving requires sustained upper body engagement
- Position more energy-intensive (20-30% more) than simpler passing options
- Multiple failed weave attempts deplete energy reserves rapidly
- Typically short-lived (1-2 minutes) before resolution due to intensity demands

## Competition Considerations

**Point Scoring**: Leg weave is passing position (0 points) but provides paths to multiple scoring positions: side control pass (3 points IBJJF), mount (4 points), back control (4 points). Mount and back transitions from weave offer highest point values. Effective for building significant point advantages through dominant position achievements.

**Time Management**: Position resolves relatively quickly (1-2 minutes typical) through pass completion or guard retention due to high intensity demands. Early in match, can be used aggressively when energy is fresh. Late in match when ahead, simpler passes may be preferable due to energy conservation needs. Monitor energy expenditure carefully.

**Rule Set Adaptations**: In gi competition, pants and gi grips provide excellent control during threading motion enhancing weave effectiveness (+10% modifier). In no-gi, leg weave requires better body control without grip assistance making it more challenging. Under IBJJF rules, ensure threading motion doesn't create leg reaping penalties. Under ADCC or submission-only, aggressive weave with mount finish provides immediate dominance.

**Competition Strategy**: Use leg weave as advanced option when opponent defends traditional passes with strong frames and structure. Position provides unique solution bypassing linear defenses. Against mobile invertors, alternative passes may be more effective. Develop weave as part of complete passing system rather than primary approach. Reserve for situations where technical solution is needed. Mount transition from weave offers high-value outcome justifying energy investment. Monitor opponent's defensive style—weave excels against structural defenders, struggles against mobile invertors.
