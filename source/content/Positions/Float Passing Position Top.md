---
# ============================================================================
# SEO METADATA
# ============================================================================
title: "Float Passing Position Top | BJJ Position Guide | BJJ Graph"
description: "Master Float Passing Position Top in BJJ. Complete guide covering entries, pressure application, and transitions. Success rates: Beginner 45%, Intermediate 60%, Advanced 75%."
tags:
  - bjj
  - position
  - guard-passing
  - top-position
  - intermediate

# ============================================================================
# STATE MACHINE CORE DATA
# ============================================================================
state_machine:
  # Core Identifiers
  state_id: "S265"
  position_name: "Float Passing Position Top"
  alternative_names:
    - "Floating Pass Position"
    - "Pressure Float Top"
    - "Float Control Position"

  # State Properties
  properties:
    point_value: 0
    position_type: "Offensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  # Success Probability Metrics
  metrics:
    position_retention:
      beginner: 50
      intermediate: 65
      advanced: 80
    advancement_probability:
      beginner: 45
      intermediate: 60
      advanced: 75
    submission_probability:
      beginner: 15
      intermediate: 25
      advanced: 35
    position_loss:
      beginner: 40
      intermediate: 30
      advanced: 15
    average_time_minutes: "1-2"

  # Offensive Transitions (Your Actions from This Position)
  transitions:
    offensive:
      - name: "Knee Slice Pass"
        target_state: "S026"
        target_position: "Side Control Top"
        success_rate:
          beginner: 45
          intermediate: 60
          advanced: 75
        transition_id: "T071"
        category: "pass"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Drive knee across and establish side control with hip pressure"

      - name: "Leg Drag Pass"
        target_state: "S026"
        target_position: "Side Control Top"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T072"
        category: "pass"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Control legs and drag to side while establishing head control"

      - name: "Back Step to North-South"
        target_state: "S027"
        target_position: "North-South"
        success_rate:
          beginner: 35
          intermediate: 50
          advanced: 65
        transition_id: "T188"
        category: "pass"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Step over opponent's legs and circle to north-south control"

      - name: "Smash Pass"
        target_state: "S026"
        target_position: "Side Control Top"
        success_rate:
          beginner: 50
          intermediate: 65
          advanced: 80
        transition_id: "T073"
        category: "pass"
        energy_cost: "High"
        execution_time: "Slow"
        description: "Apply heavy pressure and grind through guard using weight"

      - name: "Headquarters Transition"
        target_state: "S078"
        target_position: "Headquarters Position"
        success_rate:
          beginner: 55
          intermediate: 70
          advanced: 85
        transition_id: "T189"
        category: "control"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Establish headquarters position with knee shield and control"

      - name: "Guillotine Setup"
        target_state: "S069"
        target_position: "Guillotine Control"
        success_rate:
          beginner: 20
          intermediate: 30
          advanced: 45
        transition_id: "T190"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Wrap neck as opponent attempts to reguard"

    # Defensive Responses (When Opponent Has This Position Against You)
    defensive:
      - name: "Reguard to Closed Guard"
        target_state: "S002"
        target_position: "Closed Guard Bottom"
        success_rate: 45
        counter_category: "escape"
        description: "Create space and reestablish closed guard control"

      - name: "Frame and Create Distance"
        target_state: "S010"
        target_position: "Open Guard Bottom"
        success_rate: 40
        counter_category: "posture"
        description: "Use frames to create space and prevent passing"

      - name: "Butterfly Hook Recovery"
        target_state: "S013"
        target_position: "Butterfly Guard"
        success_rate: 35
        counter_category: "escape"
        description: "Insert butterfly hooks and disrupt passing pressure"

      - name: "Deep Half Entry"
        target_state: "S021"
        target_position: "Deep Half Guard"
        success_rate: 30
        counter_category: "escape"
        description: "Dive under to deep half position when pressure is high"

    # Counter Transitions (Responses to Opponent's Attempts)
    counters:
      - opponent_action: "Frame and Push Defense"
        your_counter: "Pressure Switch to Smash"
        target_state: "S026"
        success_rate: 55
        description: "Use opponent's pushing energy to drive into smash pass"

      - opponent_action: "Hip Escape Attempt"
        your_counter: "Follow and Leg Drag"
        target_state: "S026"
        success_rate: 50
        description: "Track hip movement and secure leg drag position"

  # Decision Tree Logic (Machine-Readable for Game Engine)
  decision_tree:
    - condition: "opponent creates strong frames with extended arms"
      priority: 1
      indicators:
        - "Arms extended pushing against chest"
        - "Strong knee shield established"
        - "Creating distance with frames"
      actions:
        - technique: "Smash Pass"
          target_state: "S026"
          probability: 65
          reasoning: "Heavy pressure collapses frames and eliminates space"
        - technique: "Back Step to North-South"
          target_state: "S027"
          probability: 50
          reasoning: "Circling around frames rather than through them"

    - condition: "opponent's legs are extended or disengaged"
      priority: 2
      indicators:
        - "Legs not connected to your hips"
        - "Open guard distance created"
        - "Weak hook control"
      actions:
        - technique: "Leg Drag Pass"
          target_state: "S026"
          probability: 65
          reasoning: "Extended legs create leg drag opportunities"
        - technique: "Knee Slice Pass"
          target_state: "S026"
          probability: 60
          reasoning: "Opening allows knee insertion across center line"

    - condition: "opponent attempts to reguard with high guard recovery"
      priority: 3
      indicators:
        - "Hips elevating toward you"
        - "Attempting to close distance"
        - "Guard pulling motion initiated"
      actions:
        - technique: "Guillotine Setup"
          target_state: "S069"
          probability: 45
          reasoning: "Head exposed during reguard attempt"
        - technique: "Headquarters Transition"
          target_state: "S078"
          probability: 70
          reasoning: "Control hips and establish headquarters before guard closes"

    - condition: "default - balanced opponent with neutral guard"
      priority: 4
      indicators:
        - "Neutral hip position"
        - "Guards are engaged but not attacking"
        - "Waiting for passing commitment"
      actions:
        - technique: "Headquarters Transition"
          target_state: "S078"
          probability: 70
          reasoning: "Establish dominant position without overcommitting"
        - technique: "Knee Slice Pass"
          target_state: "S026"
          probability: 55
          reasoning: "Begin passing sequence from strong position"

  # State Invariants (Conditions That Define This Position)
  invariants:
    physical:
      - "You are on top, weight distributed above opponent's hips and legs"
      - "Opponent is on their back with guard open or partially controlled"
      - "Your chest is relatively low, maintaining pressure direction toward hips"
      - "Legs are positioned to maintain balance while preventing guard closure"

    control:
      - "Hands controlling opponent's hips, knees, or upper body"
      - "Pressure maintained toward opponent's lower body"
      - "Weight distribution preventing easy guard recovery"
      - "Grip control on pants, belt, or collar maintaining distance management"

    opponent_limitations:
      - "Cannot easily close guard or establish strong guard retention"
      - "Must defend against multiple passing directions"
      - "Limited ability to create offensive attacks from bottom"
      - "Requires defensive framing to prevent immediate pass"

  # Training Considerations
  training:
    prerequisites:
      positions:
        - "Open Guard Top"
        - "Combat Base"
        - "Headquarters Position"

      skills:
        - "Pressure application and weight distribution"
        - "Balance maintenance during guard passing"
        - "Grip fighting and control establishment"

      concepts:
        - "Pressure Passing Framework"
        - "Base Maintenance"
        - "Forward Pressure"

    optimal_conditions:
      - "When opponent's guard is open or partially broken"
      - "After successful grip breaking or frame collapse"
      - "When opponent is fatigued and defensive"

    vulnerable_moments:
      - "During initial pressure establishment when base is narrow"
      - "When overcommitting to single passing direction"
      - "If opponent successfully inserts strong frames or hooks"

    energy_fatigue_factors:
      - "Requires sustained pressure application draining shoulder and core strength"
      - "Maintaining heavy top pressure is more taxing than mobile passing"
      - "Opponent's defensive energy expenditure increases with pressure duration"

  # Position Progressions and Relationships
  progressions:
    leads_to:
      - state_id: "S026"
        position: "Side Control Top"
        relationship: "natural_progression"
        description: "Most common ending position after successful pass"

      - state_id: "S078"
        position: "Headquarters Position"
        relationship: "specialization"
        description: "Intermediate control position before final pass"

    related_positions:
      - state_id: "S003"
        position: "Closed Guard Top"
        relationship: "similar_offensive"
        description: "Both are top guard passing positions with pressure focus"

      - state_id: "S010"
        position: "Open Guard Bottom"
        relationship: "counter"
        description: "Opponent's perspective of this passing position"

# ============================================================================
# SCHEMA.ORG STRUCTURED DATA (SEO Optimization)
# ============================================================================
schema_org:
  # HowTo Schema for Technical Content
  howto:
    type: "HowTo"
    name: "How to Use Float Passing Position Top in BJJ"
    description: "Complete guide to executing techniques and transitions from Float Passing Position Top."
    total_time: "PT5M"

    steps:
      - name: "Establish Float Pressure"
        text: "From open guard top, distribute weight toward opponent's hips while maintaining low chest position and controlled grips on hips or legs."
        position: 1

      - name: "Control Opponent's Legs"
        text: "Use grips to control one or both legs, preventing guard recovery while maintaining pressure direction."
        position: 2

      - name: "Collapse Frames"
        text: "If opponent establishes frames, use weight and pressure to collapse defensive structures while advancing position."
        position: 3

      - name: "Execute Passing Direction"
        text: "Choose passing direction based on opponent's defensive reactions - knee slice, leg drag, or smash pass."
        position: 4

      - name: "Complete Pass"
        text: "Drive through to side control or north-south position while maintaining pressure and control throughout transition."
        position: 5

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  # FAQ Schema for Rich Snippets
  faq:
    - question: "What is the primary objective in Float Passing Position Top?"
      answer: "The primary objective is to maintain pressure toward the opponent's hips while controlling their legs, preventing guard recovery while setting up various passing options. This position creates a dilemma where the opponent must defend multiple passing directions simultaneously."
      category: "fundamentals"

    - question: "How do I deal with strong frames from bottom in Float Passing?"
      answer: "When opponent establishes strong frames, switch to smash pass by increasing pressure and weight, collapsing the frames through sustained heavy pressure. Alternatively, back step around the frames to circle to north-south position rather than fighting through them directly."
      category: "tactics"

    - question: "When should I use Float Passing versus other passing styles?"
      answer: "Float Passing is most effective against opponents who play defensive, reactive guards. Use it when the guard is already open or partially controlled. Against aggressive guard players with strong retention, more mobile passing styles may be preferable."
      category: "tactics"

    - question: "What are common mistakes in Float Passing Position?"
      answer: "Common mistakes include: standing too upright which reduces pressure effectiveness, overcommitting to one passing direction before establishing control, neglecting grip control which allows easy guard recovery, and using static pressure without adapting to opponent's defensive movements."
      category: "errors"

    - question: "How do I transition from Float Passing to submissions?"
      answer: "The primary submission opportunity is the guillotine when opponent attempts to reguard by elevating their head toward you. Wrap the neck as they commit to guard recovery. Other submissions are generally lower percentage from this position - focus on completing the pass first."
      category: "tactics"

# ============================================================================
# LLM CONTEXT BLOCK (AI/Game Engine Optimization)
# ============================================================================
llm_context:
  # One-Sentence Summary for AI Context
  position_summary: "Float Passing Position Top is an offensive guard passing position where the top practitioner maintains low pressure toward the opponent's hips while controlling their legs, creating multiple passing direction opportunities while preventing guard recovery."

  # Key Success Factors (Prioritized)
  key_success_factors:
    - factor: "Sustained Hip Pressure"
      importance: "critical"
      description: "Maintaining constant downward pressure toward opponent's hips prevents guard recovery and creates passing opportunities. Pressure must be directed properly to be effective."
      game_impact: "When pressure quality is rated 'strong', increase passing success rates by +15% and reduce reguard success by -20%"

    - factor: "Grip Control on Legs or Hips"
      importance: "high"
      description: "Controlling opponent's legs through grips on pants, ankles, or knees prevents them from reestablishing guard structure. Grip breaks must be addressed immediately."
      game_impact: "Loss of grip control reduces passing success by -10% and increases reguard probability by +15%"

    - factor: "Low Chest Position"
      importance: "high"
      description: "Keeping chest low and close to opponent maximizes pressure effectiveness and prevents them from creating defensive frames. Standing too upright negates pressure advantages."
      game_impact: "Upright posture reduces pressure effectiveness by -25% and allows frame insertion increasing defense success by +20%"

    - factor: "Balance Maintenance"
      importance: "high"
      description: "Maintaining stable base while applying pressure prevents sweeps and allows rapid direction changes when passing. Base must adapt to opponent's defensive movements."
      game_impact: "Poor base creates sweep vulnerability (+15% sweep success for opponent) and limits passing options"

    - factor: "Adaptive Passing Direction"
      importance: "medium"
      description: "Reading opponent's defensive reactions and choosing appropriate passing direction (knee slice, leg drag, smash) based on their positioning and energy expenditure."
      game_impact: "Correct direction choice increases passing success by +10%, wrong choice reduces it by -15%"

  # Common Questions (Q&A Patterns for LLM/Chatbot)
  common_questions:
    - q: "When should I transition from Float Passing to Headquarters Position?"
      a: "Transition to Headquarters when opponent is successfully defending multiple passing attempts and you need to consolidate control before making another passing commitment. This is especially effective when opponent is framing effectively and creating distance."
      context: "tactical"
      skill_level: "intermediate"

    - q: "How do I maintain pressure without using too much energy?"
      a: "Focus on positioning your bodyweight efficiently rather than muscling through. Keep your chest low and hips heavy, allowing gravity to do the work. Use your legs to maintain balance rather than gripping tightly with your arms."
      context: "technical"
      skill_level: "beginner"

    - q: "What if opponent keeps recovering guard from Float Passing?"
      a: "If guard recovery is succeeding repeatedly, you're likely giving too much space or not controlling their hips/legs effectively. Increase pressure, secure better grips, and consider transitioning to Headquarters to consolidate control before attempting pass."
      context: "problem_solving"
      skill_level: "intermediate"

    - q: "When should I use Smash Pass versus Leg Drag from Float Passing?"
      a: "Use Smash Pass when opponent establishes strong frames and is creating space - collapse their structure with pressure. Use Leg Drag when their legs are extended or disengaged, as this creates the opening for leg control and dragging motion."
      context: "decision_making"
      skill_level: "intermediate"

    - q: "How do I deal with butterfly hooks during Float Passing?"
      a: "When opponent inserts butterfly hooks, immediately address them by sprawling your hips back or driving forward to flatten them. Do not allow the hooks to lift your hips, as this creates sweep opportunities. Consider switching to different passing style if hooks are strongly established."
      context: "defensive"
      skill_level: "intermediate"

  # Coaching Cues (Natural Language for Instruction)
  coaching_cues:
    - "Stay heavy on their hips, don't stand up"
    - "Control those legs, don't let the guard close"
    - "Chest stays low, pressure stays constant"
    - "Feel their defensive reaction before committing to pass"
    - "Base wide when they push, narrow when advancing"
    - "Grips tight on the pants, control the distance"
    - "If frames come up, smash through or circle around"

  # Training Focus by Skill Level
  training_focus:
    beginner:
      - "Establishing and maintaining hip pressure"
      - "Basic grip control on opponent's legs"
      - "Simple knee slice pass execution"
      - "Preventing guard recovery basics"

    intermediate:
      - "Multiple passing direction options from same position"
      - "Reading defensive reactions and adapting"
      - "Pressure application efficiency and energy management"
      - "Transitioning to Headquarters when needed"

    advanced:
      - "Preemptive passing direction selection based on opponent tendencies"
      - "Submission setups during passing sequences"
      - "Complex grip fighting and frame collapsing"
      - "Seamless integration of multiple passing styles"

  # Game Engine Hints
  game_engine_hints:
    energy_cost_factors:
      - "Maintaining position: Medium drain per turn"
      - "Smash pass attempts: High energy cost"
      - "Leg drag passes: Low to medium energy cost"

    position_strength: "Strong offensive position with multiple passing options but requires active pressure maintenance to prevent guard recovery"

    opponent_pressure: "High defensive energy expenditure - opponent must constantly defend against multiple passing threats while preventing pressure accumulation"

    ideal_scenarios:
      - "Opponent is defensive and reactive rather than attacking from guard"
      - "Guard is already partially open or broken"
      - "Opponent is fatigued and struggles with sustained defensive framing"

    dilemma_creation:
      - "Defending knee slice opens leg drag opportunity on opposite side"
      - "Creating frames to prevent pressure opens back step and circle passes"
      - "Attempting to reguard exposes neck for guillotine setup"

  # Success Modifiers (Probabilistic Adjustments for Game Engine)
  success_modifiers:
    - condition: "Strong hip pressure maintained"
      modifier: +15
      applies_to: "all_offensive_transitions"
      description: "Effective pressure prevents defensive recovery and creates passing openings"

    - condition: "Opponent is fatigued"
      modifier: +10
      applies_to: "all_transitions"
      description: "Fatigue reduces frame effectiveness and guard recovery capability"

    - condition: "Secure grip control on legs"
      modifier: +10
      applies_to: "passing_techniques"
      description: "Controlling legs prevents guard closure and creates passing structure"

    - condition: "Knowledge test passed (80%+)"
      modifier: +10
      applies_to: "position_retention|advancement"
      description: "Understanding position principles improves pressure application and direction selection"

    - condition: "Opponent establishes strong frames"
      modifier: -15
      applies_to: "offensive_success"
      description: "Frames create distance reducing pressure effectiveness"

    - condition: "Base is compromised or narrow"
      modifier: -10
      applies_to: "position_retention"
      description: "Poor base creates sweep vulnerability and limits passing options"

  # Dilemma Structures (Craig Jones Philosophy)
  dilemmas:
    - scenario: "Opponent defends knee slice by blocking near leg"
      dilemma_created: "Blocking near leg opens far leg for leg drag pass on opposite side"
      offensive_options:
        - "Leg Drag Pass → Side Control Top (Success: 65%)"
        - "Back Step to North-South → North-South (Success: 50%)"
      narrative: "As your opponent commits to stopping your knee slice by controlling your near leg, they expose their far leg. Switch immediately to leg drag on the opposite side, using their defensive commitment against them."

    - scenario: "Opponent creates strong frames to prevent pressure"
      dilemma_created: "Extended arms for frames create structural weakness exploitable through heavy smash pressure or create space to circle around"
      offensive_options:
        - "Smash Pass → Side Control Top (Success: 70%)"
        - "Back Step to North-South → North-South (Success: 55%)"
      narrative: "Their frames push against you, but extended arms lack the structural integrity to withstand sustained pressure. Either collapse through them with heavy smash, or use the space they create to circle around to north-south."

    - scenario: "Opponent attempts to reguard by elevating hips"
      dilemma_created: "Hip elevation to close guard exposes neck and creates guillotine opportunity"
      offensive_options:
        - "Guillotine Setup → Guillotine Control (Success: 45%)"
        - "Headquarters Transition → Headquarters Position (Success: 70%)"
      narrative: "They try to recover guard by bringing their hips toward you, but this movement exposes their neck. Wrap it immediately for the guillotine or drive them back down to headquarters position."

  # Narrative Generation Prompts
  narrative_prompts:
    entry: "You establish float passing position, weight heavy on their hips, pressure constant and suffocating. Your grips control their legs, preventing any guard recovery attempt."
    control: "Maintaining the float, your pressure pins them to the mat while your mind calculates passing angles. Every defensive movement they make reveals the opening you need."
    attack_initiation: "You feel their defensive reaction and commit to the pass, driving forward with controlled aggression toward side control."
    success: "Their guard collapses as you complete the pass, establishing dominant side control position with your pressure unbroken throughout the transition."
    failure: "They frame successfully and create enough space to recover guard, forcing you to reset your passing approach from a more neutral position."
    position_loss: "Their defensive movements create an opening and they successfully reguard, pulling you back into their closed guard where your passing advantage evaporates."

  # Knowledge Assessment Questions
  knowledge_questions:
    - question: "What are the three most important control points in Float Passing Position Top?"
      answer: "The three critical control points are: (1) Hip pressure maintaining constant downward force toward opponent's lower body, (2) Grip control on opponent's legs/pants preventing guard recovery, and (3) Low chest position maximizing pressure effectiveness while preventing frame insertion."
      difficulty: "beginner"
      category: "fundamentals"
      points: 10

    - question: "When opponent establishes strong frames pushing against your chest, which passing direction is most effective?"
      answer: "Smash Pass is most effective because sustained heavy pressure collapses extended arm frames which lack structural integrity under sustained load. Alternatively, Back Step to circle around the frames rather than through them."
      difficulty: "intermediate"
      category: "tactics"
      points: 15

    - question: "How does Float Passing Position integrate with the Pressure Passing Framework?"
      answer: "Float Passing exemplifies pressure passing principles by using constant hip pressure to limit opponent's movement options while methodically advancing position through weight and control rather than speed and agility. The sustained pressure creates cumulative fatigue in defender while passer maintains pressure-based control throughout sequence."
      difficulty: "advanced"
      category: "systems"
      points: 20

    - question: "What is the primary indicator that you should transition from Float Passing to Headquarters Position?"
      answer: "Transition to Headquarters when opponent successfully defends multiple passing attempts and you need to consolidate control before making another commitment. This is indicated by opponent successfully creating frames, maintaining distance, or repeatedly preventing your passing advances."
      difficulty: "intermediate"
      category: "decision_making"
      points: 15

    - question: "How should you modify your base when opponent pushes strongly with frames versus when they attempt to pull you forward?"
      answer: "When opponent pushes with frames, widen your base and lower your center of gravity to create stability for pressure application. When they pull you forward, narrow your base slightly and post your hands to prevent being pulled into vulnerable position while maintaining forward pressure direction."
      difficulty: "advanced"
      category: "technical_details"
      points: 20

---

# Float Passing Position Top
#bjj #position #guard-passing #top-position #intermediate

## State Description

Float Passing Position Top is an offensive guard passing position where the practitioner maintains constant downward pressure toward the opponent's hips while controlling their legs to prevent guard recovery. This position represents a transitional control state between open guard top and completed pass, characterized by low chest positioning and sustained pressure application that limits the bottom player's defensive options.

The float passing position creates strategic advantages through pressure-based control that forces the opponent into reactive defensive mode while the passer methodically advances toward side control or other dominant positions. The sustained pressure prevents guard recovery while creating multiple passing direction opportunities - knee slice, leg drag, smash pass, or back step variations.

This position is most effective against defensive guard players and works well when combined with grip control on the opponent's pants or legs. The main disadvantage is the energy cost of maintaining sustained pressure and vulnerability to strong defensive frames if pressure quality decreases. Float passing excels in gi-based training where pants grips enhance control, though no-gi variations remain viable with proper technique adaptation.

## Visual Description

You are positioned on top with your weight distributed heavily toward the opponent's hips and lower body, chest low and parallel to the mat. Your hands control the opponent's legs, hips, or pants with firm grips preventing guard recovery. Your knees are positioned strategically - often one knee posted near opponent's hip while the other leg provides base stability. Your head is low, often near opponent's chest or shoulder level, maximizing downward pressure vector effectiveness.

The opponent is on their back with their guard open or partially controlled, struggling to maintain defensive frames or create enough space to recover closed guard. Your pressure pins them to the mat while your grip control limits their leg movement and guard restructuring attempts. The spatial relationship creates a pressure hierarchy where your bodyweight advantage is maximized through positioning rather than strength alone.

This creates significant positional advantages through sustained pressure that accumulates defensive fatigue while your controlled approach maintains energy efficiency and multiple passing direction options based on opponent's defensive reactions.

## Key Principles

- **Sustained Hip Pressure**: Maintain constant downward pressure toward opponent's hips using bodyweight positioning rather than muscle tension
- **Low Chest Position**: Keep chest low and close to opponent to maximize pressure effectiveness and prevent frame insertion
- **Grip Control Priority**: Secure and maintain grips on opponent's legs or pants to prevent guard recovery throughout passing sequence
- **Base Adaptation**: Adjust base width and configuration based on opponent's defensive reactions - wider for stability, narrower for mobility
- **Multiple Direction Threat**: Maintain ability to pass in multiple directions (knee slice, leg drag, smash, back step) forcing opponent to defend all simultaneously
- **Pressure Quality Over Quantity**: Focus on efficient bodyweight positioning rather than muscular force to create sustainable pressure
- **Reading Defensive Reactions**: Feel opponent's defensive movements and commit to passing direction based on their reactions rather than predetermined plan

## Offensive Transitions

From this position, you can execute:

### Guard Passes
- [[Knee Slice Pass]] → [[Side Control Top]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
  - Drive knee across centerline while maintaining hip pressure and head control

- [[Leg Drag Pass]] → [[Side Control Top]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
  - Control far leg and drag to side while circling head to opposite side for control

- [[Smash Pass]] → [[Side Control Top]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 80%)
  - Apply maximum pressure to collapse defensive frames and grind through to side control

- [[Back Step]] → [[North-South]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
  - Step over opponent's legs and circle to north-south position avoiding guard recovery

### Position Consolidation
- [[Headquarters Control]] → [[Headquarters Position]] (Success Rate: Beginner 55%, Intermediate 70%, Advanced 85%)
  - Establish intermediate control position before committing to final pass

### Submissions
- [[Guillotine Setup]] → [[Guillotine Control]] (Success Rate: Beginner 20%, Intermediate 30%, Advanced 45%)
  - Wrap neck when opponent attempts to reguard by elevating head toward you

## Defensive Responses

When opponent has this position against you, available counters:

- [[Hip Escape]] → [[Open Guard Bottom]] (Success Rate: 40%)
  - Create space through hip movement and reestablish open guard structure

- [[Frame Creation]] → [[Open Guard Bottom]] (Success Rate: 45%)
  - Establish strong frames against chest and hips to prevent passing advancement

- [[Butterfly Hook Recovery]] → [[Butterfly Guard]] (Success Rate: 35%)
  - Insert butterfly hooks under hips to disrupt pressure and create sweep opportunities

- [[Deep Half Entry]] → [[Deep Half Guard]] (Success Rate: 30%)
  - Dive under pressure to deep half position when direct guard recovery fails

## Decision Tree

**If** opponent establishes strong frames with extended arms:
- Execute [[Smash Pass]] → [[Side Control Top]] (Probability: 65%)
  - Reasoning: Heavy sustained pressure collapses extended arm frames which lack structural integrity
- Or Execute [[Back Step]] → [[North-South]] (Probability: 50%)
  - Reasoning: Circle around frames rather than fighting through them directly

**Else if** opponent's legs are extended or disengaged:
- Execute [[Leg Drag Pass]] → [[Side Control Top]] (Probability: 65%)
  - Reasoning: Extended legs create immediate leg drag opportunity with minimal resistance
- Or Execute [[Knee Slice Pass]] → [[Side Control Top]] (Probability: 60%)
  - Reasoning: Opening in guard structure allows knee insertion across centerline

**Else if** opponent attempts to reguard by elevating hips:
- Execute [[Guillotine Setup]] → [[Guillotine Control]] (Probability: 45%)
  - Reasoning: Head exposed during reguard attempt creates submission opportunity
- Or Execute [[Headquarters Transition]] → [[Headquarters Position]] (Probability: 70%)
  - Reasoning: Control hips and establish consolidated position before guard closes

**Else** (balanced opponent with neutral guard):
- Execute [[Headquarters Transition]] → [[Headquarters Position]] (Probability: 70%)
  - Reasoning: Establish dominant control without overcommitting to risky passing attempt
- Or Execute [[Knee Slice Pass]] → [[Side Control Top]] (Probability: 55%)
  - Reasoning: Begin passing sequence from position of pressure advantage

## Expert Insights

**John Danaher**: The float passing position represents optimal application of pressure passing principles where sustained directional force creates cumulative defensive fatigue while the passer maintains multiple passing vectors simultaneously. The key is understanding that pressure quality derives from efficient bodyweight positioning rather than muscular force - the chest must stay low, hips heavy on opponent's lower body, creating downward vector that prevents guard recovery. Systematically, float passing integrates with headquarters position as interim control point, creating structured progression from open guard control to passing completion. The position exemplifies how proper mechanics enable smaller practitioners to pass larger opponents through leverage and positioning rather than strength.

**Gordon Ryan**: In competition, float passing is one of my highest percentage approaches because it puts maximum pressure on opponent while I maintain control and energy efficiency. The key is not just maintaining pressure but reading their defensive reactions and choosing the right passing direction based on what they give you. When they frame hard, smash through. When legs extend, drag them. When they try to come up, guillotine them. The position is so effective because it creates decision fatigue - they have to defend everything simultaneously while I'm comfortable and methodical. I'll hold this position as long as needed, letting the pressure accumulate until the pass opens up naturally rather than forcing it prematurely.

**Eddie Bravo**: Float passing integrates beautifully with modern passing systems, especially when combined with 10th Planet concepts of creating pressure-based dilemmas for opponents. I emphasize to students that this isn't just about being heavy - it's about creating a pressure hierarchy where every defensive movement they make opens a different passing angle. The position works particularly well in no-gi when modified with overhooks and head control instead of pants grips. What makes float passing special is its adaptability - you can flow between pressure-based smash passing and more dynamic leg drag sequences seamlessly, keeping opponent off-balance mentally as well as physically. The guillotine threat when they try to come up is money.

## Common Errors

### Error: Standing too upright reducing pressure effectiveness
- **Consequence**: Upright posture eliminates the downward pressure vector that prevents guard recovery and makes frames more effective. Opponent can easily push you away or reestablish guard structure without facing sustained pressure. Your passing advantages evaporate and energy expenditure increases trying to maintain control without proper positioning.
- **Correction**: Keep chest low and parallel to mat, weight distributed heavily toward opponent's hips. Think "chest to their chest, hips on their hips" maintaining constant downward pressure through positioning rather than muscle. Your head should be near their chest level, not elevated above.
- **Recognition**: If opponent easily creates space with frames or if you feel like you're working hard to maintain position without progress, you're likely too upright. Your perspective should be looking down at them from close range, not from standing height.

### Error: Overcommitting to one passing direction without control
- **Consequence**: Committing fully to knee slice or leg drag before establishing sufficient control allows opponent to defend specifically against that one attack rather than multiple threats. This reduces success probability significantly and creates energy-wasting failed passing attempts that give opponent confidence and opportunities to counter.
- **Correction**: Establish strong float pressure first with secure grips and hip control before committing to specific passing direction. Read opponent's defensive reaction and choose passing direction based on what they give you, not predetermined plan. Maintain option to switch directions mid-sequence.
- **Recognition**: If your passing attempts are consistently defended or if you find yourself fighting hard against specific defensive responses, you're committing too early. Successful float passing feels methodical and reactive rather than forceful and predetermined.

### Error: Neglecting grip control allowing easy guard recovery
- **Consequence**: Without secure grips on opponent's legs or pants, they can freely manipulate their leg position to recover guard structure. Your pressure becomes ineffective because they can move their legs around your control attempts, recreating closed guard or strong open guard configurations that reset the passing sequence.
- **Correction**: Establish and maintain strong grips on pants at knees or ankles (in gi) or control legs through overhooks and underhooks (no-gi). These grips prevent leg manipulation and guard recovery. Fight for grip dominance before advancing passing attempts, and reset grips if broken.
- **Recognition**: If opponent easily recovers guard repeatedly or if their legs feel "free" to move despite your pressure, your grip control is insufficient. You should feel like you're controlling their leg movement throughout the passing sequence.

### Error: Static pressure without adapting to defensive movements
- **Consequence**: Maintaining unchanging pressure while opponent dynamically adjusts their defensive positioning creates stalemate or allows effective defense. Static approach allows opponent to establish optimal defensive structure because you're not forcing them to constantly readjust, giving them time to create strong frames and guard recovery setups.
- **Correction**: Adapt pressure direction and intensity based on opponent's movements. When they push, drive into them. When they create space, follow and maintain connection. Constantly make micro-adjustments to pressure angle and grip positions based on their defensive reactions, creating continuous defensive problem-solving rather than allowing static defensive structures.
- **Recognition**: If you feel stuck in position making no progress despite applying pressure, you're being too static. Effective float passing creates constant feeling of pressure variation and directional changes that prevent opponent from settling into comfortable defensive position.

### Error: Narrow base creating sweep vulnerability
- **Consequence**: Narrow base makes you unstable and vulnerable to sweeps, particularly when opponent inserts butterfly hooks or creates off-balancing leverage. Your passing attempts become compromised because you must focus on balance maintenance rather than pressure application and advancement. Single sweep success can reverse all positional advantages.
- **Correction**: Maintain wide base with knees spread appropriately for stability while applying pressure. When opponent attempts sweeps or creates lifting leverage, immediately widen base further and lower center of gravity. Base width should adapt to threat level - wider when stability needed, slightly narrower when advancing with control.
- **Recognition**: If you feel unstable or if opponent's lifting attempts or sweeps feel threatening, your base is too narrow. You should feel rooted and stable even when opponent creates movement or pressure from below.

## Training Drills

### Drill 1: Float Pressure Maintenance with Increasing Resistance
Start in float passing position with partner providing 0% resistance, simply maintaining position below. Focus on establishing proper chest position (low), hip pressure (heavy toward their hips), and grip control. Hold position for 30 seconds maintaining pressure quality. Gradually increase resistance: 25% (partner creates minor movements), 50% (partner attempts frames and hip escapes), 75% (partner actively defends with strong frames), 100% (full defensive resistance). At each level, focus on maintaining pressure quality without increase in your energy expenditure - efficiency through positioning rather than force. Common mistake is standing up when resistance increases - maintain low chest position throughout. 5 rounds of 2-minute holds at varying resistance levels.

### Drill 2: Passing Direction Selection Based on Defense
Start in float passing position with controlled pressure established. Partner provides specific defensive responses on coach's call: "frames" (establish strong pushing frames), "pull" (attempt to pull guard closed), "extend" (extend legs to create distance). You must read the defense and execute appropriate passing response: frames = smash pass or back step, pull = guillotine setup or headquarters, extend = leg drag or knee slice. Focus on rapid recognition of defensive pattern and immediate passing direction selection. This develops the decision-making skill of reading reactions rather than forcing predetermined techniques. 10 rounds of 1-minute intervals with rotating defensive patterns.

### Drill 3: Float Passing to Completion Flow
Start in open guard top. Establish float passing position, maintain control briefly, then complete pass to side control. Reset to open guard top and repeat continuously. Focus on smooth transitions between phases: entry to float, float maintenance, passing execution, side control establishment. Gradually increase speed and resistance through session. This develops the complete passing sequence as integrated flow rather than isolated components. Partner provides progressive resistance: cooperative (allows completion), moderate (defends but allows success), resistant (full defensive effort). 5-minute continuous flow rounds with 1-minute rest between.

### Drill 4: Grip Fighting in Float Position
Start in float passing position with loose grip control. Both practitioners actively grip fight - you attempting to secure and maintain control grips on legs/pants, partner attempting to break grips and establish defensive grips. Focus on grip priority: controlling their legs more important than preventing their grips on you initially. When grip is broken, immediately re-establish rather than continuing with compromised control. This develops grip dominance essential for successful float passing. 3-minute rounds with 30-second rest, focusing on grip fighting intensity and proper re-grip technique.

### Drill 5: Pressure Adaptation to Hip Escapes
Partner lies in bottom position and continuously performs hip escapes attempting to create space and recover guard. You maintain float passing position and pressure, following their hip movements while maintaining control. Focus on tracking their hips, keeping pressure connected throughout their movement, and preventing space accumulation. Common mistake is being "left behind" when they escape - you must move with them maintaining connection. This develops the ability to maintain pressure against dynamic defensive movement rather than static opponents. 5 rounds of 90 seconds with focus on connection maintenance.

## Related Positions

- [[Headquarters Position]] - Natural consolidation position from float passing when you need intermediate control before completing pass
- [[Side Control Top]] - Most common ending position after successful pass completion from float position
- [[North-South]] - Alternative passing completion through back step method avoiding guard recovery
- [[Combat Base]] - Starting position often used before establishing float passing pressure
- [[Open Guard Top]] - Initial position before establishing float passing control and pressure

## Optimal Submission Paths

**Fastest path to submission** (opportunistic):
[[Float Passing Position Top]] → [[Guillotine Setup]] → [[Won by Submission]]
*Reasoning: When opponent attempts to reguard by elevating hips toward you, their neck becomes exposed for immediate guillotine setup. This is opportunistic rather than systematic but represents fastest submission from this position when available. Success rate moderate (30-45%) depending on timing and opponent awareness.*

**High-percentage path** (positional first):
[[Float Passing Position Top]] → [[Knee Slice Pass]] → [[Side Control Top]] → [[Submission from Side Control]] → [[Won by Submission]]
*Reasoning: Complete the pass to establish dominant position first, then attack submissions from superior control position. This systematic approach has better overall success rates because side control provides more submission options with higher percentages than attacking from transitional passing position. Reflects position-before-submission philosophy.*

**Alternative passing path** (pressure-based):
[[Float Passing Position Top]] → [[Smash Pass]] → [[Side Control Top]] → [[Mount Transition]] → [[Submission from Mount]] → [[Won by Submission]]
*Reasoning: When opponent establishes strong frames, use smash passing to collapse their defensive structure then transition to mount for highest percentage submissions. This path takes longer but creates most dominant ending position when opponent's defense is strong.*

**System-based path** (Danaher approach):
[[Float Passing Position Top]] → [[Headquarters Position]] → [[Systematic Pass Completion]] → [[Side Control Top]] → [[Positional Control]] → [[Submission Opportunity]] → [[Won by Submission]]
*Reasoning: Methodical progression through intermediate control positions before committing to final pass, minimizing risk and maximizing control throughout sequence. This reflects systematic passing philosophy where each position builds upon previous, creating high-percentage progression to dominant position before submission attempts.*
