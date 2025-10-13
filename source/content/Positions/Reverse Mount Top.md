---
# ============================================================================
# SEO METADATA
# ============================================================================
title: "Reverse Mount Top | BJJ Position Guide | BJJ Graph"
description: "Master Reverse Mount Top in BJJ. Complete guide covering submissions, transitions, and control. Success rates: Beginner 50%, Intermediate 65%, Advanced 80%."
tags:
  - bjj
  - position
  - mount
  - top-control
  - advanced
  - submissions

# ============================================================================
# STATE MACHINE CORE DATA
# ============================================================================
state_machine:
  # Core Identifiers
  state_id: "S106"
  position_name: "Reverse Mount Top"
  alternative_names:
    - "Reverse Mount"
    - "Back Facing Mount"
    - "Inverse Mount"

  # State Properties
  properties:
    point_value: 4
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
      beginner: 35
      intermediate: 50
      advanced: 65
    position_loss:
      beginner: 40
      intermediate: 25
      advanced: 15
    average_time_minutes: "0.5-1"

  # Offensive Transitions
  transitions:
    offensive:
      - name: "Transition to Standard Mount"
        target_state: "S001"
        target_position: "Mount"
        success_rate:
          beginner: 55
          intermediate: 70
          advanced: 85
        transition_id: "T109"
        category: "control"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Turn body to face opponent converting to traditional mount position"

      - name: "Armbar from Reverse Mount"
        target_state: "Terminal"
        target_position: "Won by Submission"
        success_rate:
          beginner: 35
          intermediate: 50
          advanced: 65
        transition_id: "SUB100"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Isolate near arm and execute armbar while maintaining reverse mount control"

      - name: "Transition to Back Control"
        target_state: "S002"
        target_position: "Back Control"
        success_rate:
          beginner: 45
          intermediate: 60
          advanced: 75
        transition_id: "T110"
        category: "control"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Insert hooks and establish back control from reverse mount"

      - name: "Twister Submission"
        target_state: "Terminal"
        target_position: "Won by Submission"
        success_rate:
          beginner: 20
          intermediate: 35
          advanced: 50
        transition_id: "SUB357"
        category: "submission"
        energy_cost: "High"
        execution_time: "Slow"
        description: "Advanced spinal lock submission from reverse mount control"

      - name: "Collar Choke from Reverse Mount"
        target_state: "Terminal"
        target_position: "Won by Submission"
        success_rate:
          beginner: 30
          intermediate: 45
          advanced: 60
        transition_id: "SUB101"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Use gi collar to apply choke from reverse position"

      - name: "Transition to S-Mount"
        target_state: "S054"
        target_position: "S-Mount Top"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T111"
        category: "control"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Advance to S-Mount configuration for armbar setup"

    # Defensive Responses
    defensive:
      - name: "Bridge and Roll Escape"
        target_state: "S001"
        target_position: "Mount"
        success_rate: 45
        counter_category: "escape"
        description: "Bridge explosively to reverse position back to bottom mount"

      - name: "Elbow Escape to Guard"
        target_state: "S015"
        target_position: "Closed Guard Bottom"
        success_rate: 35
        counter_category: "escape"
        description: "Create space with elbows and recover guard position"

      - name: "Turn and Turtle"
        target_state: "S003"
        target_position: "Turtle Position Bottom"
        success_rate: 40
        counter_category: "escape"
        description: "Turn toward opponent and establish defensive turtle"

      - name: "Backdoor Escape"
        target_state: "S014"
        target_position: "Open Guard Bottom"
        success_rate: 30
        counter_category: "escape"
        description: "Slip out the back using hip movement"

    # Counter Transitions
    counters:
      - opponent_action: "Bridge and Roll Attempt"
        your_counter: "Weight Shift and Maintain"
        target_state: "S106"
        success_rate: 60
        description: "Post hands and shift weight to counter bridge"

      - opponent_action: "Elbow Frame Creation"
        your_counter: "Transition to Standard Mount"
        target_state: "S001"
        success_rate: 70
        description: "Use their framing to turn into standard mount"

  # Decision Tree Logic
  decision_tree:
    - condition: "opponent creates defensive frames with elbows"
      priority: 1
      indicators:
        - "Elbows pushing into your hips"
        - "Creating space between bodies"
        - "Defensive posture established"
      actions:
        - technique: "Transition to Standard Mount"
          target_state: "S001"
          probability: 70
          reasoning: "Easier to control facing them, frames indicate position is compromised"
        - technique: "Armbar from Reverse Mount"
          target_state: "Terminal"
          probability: 50
          reasoning: "Framing arms become submission targets"

    - condition: "opponent remains flat and defensive"
      priority: 2
      indicators:
        - "Flat on back"
        - "Arms protecting neck/body"
        - "Limited movement"
      actions:
        - technique: "Collar Choke from Reverse Mount"
          target_state: "Terminal"
          probability: 60
          reasoning: "Flat position makes neck vulnerable to collar attacks"
        - technique: "Transition to Back Control"
          target_state: "S002"
          probability: 75
          reasoning: "Can insert hooks easily from reverse mount on flat opponent"

    - condition: "opponent attempts to turn toward you"
      priority: 3
      indicators:
        - "Hip movement starting"
        - "Shoulder rotation"
        - "Trying to face you"
      actions:
        - technique: "Twister Submission"
          target_state: "Terminal"
          probability: 50
          reasoning: "Their turning motion creates spinal control opportunity"
        - technique: "Transition to Standard Mount"
          target_state: "S001"
          probability: 85
          reasoning: "Follow their rotation to achieve standard mount"

    - condition: "default - opponent stable but not escaping"
      priority: 4
      indicators:
        - "Moderate defensive structure"
        - "Not actively escaping"
        - "Balanced position"
      actions:
        - technique: "Transition to S-Mount"
          target_state: "S054"
          probability: 55
          reasoning: "Advance to more dominant position for armbar"
        - technique: "Transition to Standard Mount"
          target_state: "S001"
          probability: 70
          reasoning: "Convert to more sustainable and familiar position"

  # State Invariants
  invariants:
    physical:
      - "Sitting on opponent's torso/chest facing away from their head"
      - "Knees controlling opponent's sides or hips"
      - "Weight distributed through buttocks on their chest"
      - "Legs positioned for base and control"

    control:
      - "Body weight pinning opponent to mat"
      - "Knees controlling hip movement"
      - "Balance maintained despite facing away"
      - "Pressure preventing opponent sit-up"

    opponent_limitations:
      - "Cannot easily establish head control (you're facing away)"
      - "Limited ability to create effective frames"
      - "Difficult to bridge effectively with weight distribution"
      - "Compromised defensive structure due to position angle"

  # Training Considerations
  training:
    prerequisites:
      positions:
        - "[[Mount]]"
        - "[[Back Control]]"
        - "[[Turtle Position Top]]"

      skills:
        - "Balance and base maintenance"
        - "Weight distribution control"
        - "Transition timing and smoothness"

      concepts:
        - "[[Position Hierarchy]]"
        - "[[Control Maintenance]]"
        - "[[Submission Chains]]"

    optimal_conditions:
      - "Transitioning from failed back take attempts"
      - "After turtle position reversal"
      - "When opponent turns away during standard mount"

    vulnerable_moments:
      - "During initial establishment (most vulnerable)"
      - "When opponent bridges explosively"
      - "If weight shifts too far forward or back"

    energy_fatigue_factors:
      - "Relatively low energy cost to maintain"
      - "Short-term position - should transition quickly"
      - "Balance maintenance requires core engagement"

  # Position Progressions
  progressions:
    leads_to:
      - state_id: "S001"
        position: "Mount"
        relationship: "natural_progression"
        description: "Most common transition - turn to face opponent for standard mount"

      - state_id: "S002"
        position: "Back Control"
        relationship: "dominant_transition"
        description: "Insert hooks to establish superior back control position"

    related_positions:
      - state_id: "S054"
        position: "S-Mount Top"
        relationship: "specialized"
        description: "Advanced position for armbar attacks"

      - state_id: "S003"
        position: "Turtle Position Top"
        relationship: "similar_offensive"
        description: "Often precedes reverse mount establishment"

      - state_id: "S001"
        position: "Mount"
        relationship: "variation"
        description: "Standard mount is primary variation facing forward"

# ============================================================================
# SCHEMA.ORG STRUCTURED DATA
# ============================================================================
schema_org:
  howto:
    type: "HowTo"
    name: "How to Use Reverse Mount Top in BJJ"
    description: "Complete guide to controlling and attacking from Reverse Mount Top position."
    total_time: "PT4M"

    steps:
      - name: "Establish Reverse Mount"
        text: "From turtle top or scramble, sit on opponent's chest facing away from their head, establish base with knees"
        position: 1

      - name: "Secure Weight Distribution"
        text: "Distribute weight through buttocks on chest, maintain balance with knees controlling sides"
        position: 2

      - name: "Control Opponent Movement"
        text: "Use weight and knee positioning to prevent opponent from bridging or creating space"
        position: 3

      - name: "Transition to Standard Mount"
        text: "Turn body to face opponent, establishing traditional mount position for more control options"
        position: 4

      - name: "Attack with Submissions"
        text: "Execute armbar, collar choke, or twister if opponent creates opportunities through movement"
        position: 5

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  faq:
    - question: "Why is Reverse Mount considered less stable than Standard Mount?"
      answer: "Reverse Mount is less stable because you're facing away from opponent's head, making it harder to control their upper body and anticipate escape attempts. The position is typically transitional, serving as bridge to standard mount or back control."
      category: "fundamentals"

    - question: "When should I transition to Standard Mount vs. attempt submissions?"
      answer: "Transition to Standard Mount immediately if opponent creates strong defensive frames or begins escaping effectively. Attempt submissions only when opponent is flat and defensive. Most practitioners should prioritize converting to standard mount for better control."
      category: "tactics"

    - question: "How do I prevent opponent from bridging in Reverse Mount?"
      answer: "Maintain weight distribution through buttocks on their chest, keep knees wide for base, post hands if needed for balance. If they begin powerful bridge, transition to standard mount following their motion rather than fighting it."
      category: "defense"

    - question: "What are the key control points in Reverse Mount?"
      answer: "Key controls: weight through buttocks on chest/abdomen, knees controlling sides preventing hip movement, balanced posture preventing tipping. Unlike standard mount, you lack head control so weight distribution is more critical."
      category: "fundamentals"

    - question: "When does Reverse Mount occur in training?"
      answer: "Reverse Mount typically occurs transitionally: after failed back take attempts, when opponent turns away during standard mount, from turtle position control, or during scrambles where you end up sitting backward on top."
      category: "tactics"

# ============================================================================
# LLM CONTEXT BLOCK
# ============================================================================
llm_context:
  position_summary: "Reverse Mount Top is a transitional dominant position where practitioner sits on opponent's chest facing away from their head, typically converting quickly to standard mount or back control."

  key_success_factors:
    - factor: "Quick Recognition as Transitional Position"
      importance: "critical"
      description: "Understanding this is temporary position requiring fast transition to more stable positions (standard mount or back control)"
      game_impact: "Staying too long in reverse mount increases escape probability by 30%"

    - factor: "Weight Distribution Control"
      importance: "high"
      description: "Proper weight through buttocks on chest prevents bridging escapes and maintains control"
      game_impact: "Poor weight distribution increases escape success by 25%"

    - factor: "Transition Readiness"
      importance: "high"
      description: "Mentally and physically prepared to transition to standard mount or back control immediately"
      game_impact: "Hesitation in transitioning reduces position retention by 20%"

    - factor: "Balance Maintenance"
      importance: "high"
      description: "Maintaining balance despite facing away requires core engagement and knee positioning"
      game_impact: "Lost balance allows opponent bridge escapes"

    - factor: "Opportunistic Submission Recognition"
      importance: "medium"
      description: "Recognizing brief submission windows (armbar, twister) while prioritizing position conversion"
      game_impact: "Forcing submissions from reverse mount reduces success by 15%"

  common_questions:
    - q: "Should I stay in reverse mount or immediately convert to standard mount?"
      a: "Immediately convert to standard mount in most situations. Reverse mount is inherently less stable and sustainable. Only stay if clear submission opportunity exists (flat opponent, arm exposed) and you're experienced with reverse mount attacks. Default action: transition to standard mount."
      context: "decision_making"
      skill_level: "intermediate"

    - q: "How do I convert from reverse mount to standard mount smoothly?"
      a: "Turn your body toward opponent's head while maintaining weight pressure on their chest. Use your knees to pivot, keep buttocks heavy on their torso throughout rotation. Opponent's defensive frames actually help provide pivot points for your rotation. Complete turn in one smooth motion."
      context: "technical"
      skill_level: "beginner"

    - q: "What submissions are highest percentage from reverse mount?"
      a: "Armbar from reverse mount (advanced: 65% success) is highest percentage followed by collar chokes (advanced: 60%). Twister is lower percentage (advanced: 50%) but devastating when available. Most practitioners should prioritize position conversion over submissions from reverse mount."
      context: "offensive"
      skill_level: "advanced"

    - q: "How do I insert hooks for back control from reverse mount?"
      a: "Your legs are already positioned near their sides. Slide one knee toward their back, insert first hook inside their thigh, then follow with second hook. Maintain chest pressure throughout transition. Success rate is high (75% advanced) because opponent is already controlled."
      context: "tactical"
      skill_level: "intermediate"

    - q: "When does reverse mount happen accidentally?"
      a: "Most commonly during scrambles: failed back take attempts where you end up sitting backward, opponent turning away during standard mount, transitioning from turtle top control. Recognize it quickly and convert rather than trying to force reverse mount control."
      context: "adaptation"
      skill_level: "beginner"

  coaching_cues:
    - "Recognize reverse mount immediately - it's transitional"
    - "Heavy hips on chest - weight distribution is key"
    - "Turn to standard mount - safest option"
    - "Balance with knees - prevent tipping"
    - "If they bridge, ride it to standard mount"
    - "Back control available - insert hooks"
    - "Quick submissions only - don't force them"
    - "Position before submission - convert first"

  training_focus:
    beginner:
      - "Recognizing reverse mount when it occurs"
      - "Basic transition to standard mount"
      - "Weight distribution fundamentals"
      - "Understanding position hierarchy"

    intermediate:
      - "Smooth transitions to standard mount or back control"
      - "Reading opponent escape attempts"
      - "Basic submission opportunities (armbar, collar choke)"
      - "Balance maintenance under pressure"

    advanced:
      - "Opportunistic twister setups"
      - "Flowing between reverse mount, standard mount, back control"
      - "Submission chains from reverse position"
      - "Using opponent movement to facilitate transitions"

  game_engine_hints:
    energy_cost_factors:
      - "Maintaining position: Medium drain per turn"
      - "Transitioning away: Low energy cost"
      - "Submission attempts: Medium-High energy cost"

    position_strength: "Transitional dominant position offering path to superior positions (standard mount, back control) but inherently less stable long-term"

    opponent_pressure: "Medium-High stress - opponent is controlled but has more escape options than standard mount"

    ideal_scenarios:
      - "Transitioning from failed back take (common occurrence)"
      - "Opponent turns away during standard mount (defensive mistake)"
      - "Quick conversion to standard mount or back control (optimal path)"

    dilemma_creation:
      - "Opponent bridging to escape opens standard mount transition"
      - "Opponent staying flat allows back control insertion"
      - "Opponent framing with arms creates armbar opportunities"

  success_modifiers:
    - condition: "Heavy weight distribution on chest"
      modifier: +10
      applies_to: "position_retention"
      description: "Proper weight prevents bridging escapes"

    - condition: "Opponent attempts bridge"
      modifier: +20
      applies_to: "standard_mount_transition"
      description: "Bridge motion facilitates turn to standard mount"

    - condition: "Extended time in reverse mount (>30 seconds)"
      modifier: -20
      applies_to: "position_retention"
      description: "Position becomes less stable over time"

    - condition: "Quick transition mindset"
      modifier: +15
      applies_to: "all_transitions"
      description: "Recognizing position as transitional improves success"

    - condition: "Opponent flat and passive"
      modifier: +10
      applies_to: "back_control_transition"
      description: "Passivity allows easy hook insertion"

    - condition: "Forcing submission from reverse mount"
      modifier: -15
      applies_to: "submission_success"
      description: "Position doesn't favor extended submission attempts"

  dilemmas:
    - scenario: "Opponent bridges explosively to escape"
      dilemma_created: "Bridge motion provides momentum to convert to standard mount"
      offensive_options:
        - "[[Transition to Standard Mount]] → [[Mount]] (Success: 85%)"
        - "[[Weight Shift and Maintain]] → [[Reverse Mount Top]] (Success: 60%)"
      narrative: "As your opponent bridges powerfully, their motion actually helps you rotate into standard mount. Ride the bridge and complete your turn."

    - scenario: "Opponent remains flat and defensive"
      dilemma_created: "Flat position allows hook insertion for back control"
      offensive_options:
        - "[[Transition to Back Control]] → [[Back Control]] (Success: 75%)"
        - "[[Collar Choke from Reverse Mount]] → [[Won by Submission]] (Success: 60%)"
      narrative: "Your opponent's defensive flat position inadvertently exposes their back. Your legs can easily slide into hooks for superior control."

    - scenario: "Opponent creates frames with elbows"
      dilemma_created: "Framing arms become armbar targets or facilitate mount transition"
      offensive_options:
        - "[[Armbar from Reverse Mount]] → [[Won by Submission]] (Success: 65%)"
        - "[[Transition to Standard Mount]] → [[Mount]] (Success: 70%)"
      narrative: "Their defensive frames give you pivot points to turn into standard mount, or you can isolate the framing arm for an armbar."

  narrative_prompts:
    entry: "You find yourself sitting on your opponent's chest facing away from their head - reverse mount established. Recognize the transitional nature immediately."
    control: "Your weight presses down on their chest. Your knees control their sides. Balance maintained despite the backward orientation. This position won't last long."
    attack_initiation: "You recognize the opportunity - their arm extends, or their body stays flat. Quick decision: transition or submit?"
    success: "The transition flows smoothly, your body rotates into standard mount. Or the submission locks perfectly from the reverse angle. Position advanced successfully."
    failure: "They bridge powerfully, or slip out the back, or create too much space. The reverse mount is lost - recover quickly."
    position_loss: "The position becomes untenable. Too much movement, lost balance, or powerful escape. Transition away or risk reversal."

    submission_setup: "Their arm extends defensively. The armbar appears. Or their flat body exposes the neck for collar choke. Brief opportunity window."
    transition_setup: "Your body prepares to rotate. Weight shifts, knees adjust. Standard mount incoming, or hooks sliding toward their back."
    defensive_hold: "They struggle beneath you. Your weight stays heavy. Balance adjusts to their movements. Temporary control maintained."

  knowledge_questions:
    - question: "What makes Reverse Mount inherently less stable than Standard Mount?"
      answer: "Reverse Mount is less stable because: 1) Facing away from opponent's head eliminates head/neck control, 2) Cannot anticipate facial expressions or upper body movements, 3) Weight distribution is less natural, 4) Opponent's legs can be used more effectively for bridging. Position is designed to be transitional, not sustained."
      difficulty: "intermediate"
      category: "fundamentals"
      points: 15

    - question: "In what situations should you prioritize submissions over transitioning from Reverse Mount?"
      answer: "Prioritize submissions only when: 1) Opponent is completely flat and passive (no escape attempt), 2) Clear submission setup exists (arm extended, neck exposed), 3) You have advanced experience with reverse mount submissions, 4) Opponent is exhausted or injured. Otherwise, default to position transition for better control."
      difficulty: "advanced"
      category: "decision_making"
      points: 20

    - question: "What is the most reliable transition from Reverse Mount and why?"
      answer: "Transition to Standard Mount (85% advanced success rate) is most reliable because: 1) Simple rotation movement using opponent's body as pivot, 2) Maintains weight pressure throughout transition, 3) Opponent's defensive movements (bridging, framing) actually facilitate the turn, 4) Results in more stable and familiar position with more attack options."
      difficulty: "intermediate"
      category: "tactics"
      points: 15

    - question: "How does weight distribution differ between Reverse Mount and Standard Mount?"
      answer: "In Reverse Mount, weight distributes primarily through buttocks on chest/abdomen with less ability to use chest pressure or head control. Standard Mount allows chest pressure, head control, and more natural weight distribution. Reverse Mount requires more core engagement for balance due to backward orientation."
      difficulty: "beginner"
      category: "technical_details"
      points: 10

    - question: "Why is Reverse Mount considered a transitional position in the BJJ positional hierarchy?"
      answer: "Reverse Mount is transitional because: 1) Inherently less stable than standard mount or back control, 2) Typically occurs accidentally during scrambles or failed techniques, 3) Limited control points (no head control, no chest pressure options), 4) Superior positions (standard mount, back control) are easily accessible from reverse mount. Best practice is quick conversion to more dominant positions."
      difficulty: "advanced"
      category: "systems"
      points: 20
---

# Reverse Mount Top
#bjj #position #mount #top_control #advanced

## State Description

Reverse Mount Top is a transitional dominant position where the practitioner sits on the opponent's chest or abdomen while facing away from their head, essentially mounted in the opposite direction from standard mount. This position scores 4 points (same as standard mount in IBJJF) but is inherently less stable and more difficult to maintain long-term. It typically occurs during scrambles, failed back take attempts, or when opponents turn away during standard mount control.

The defining characteristic of reverse mount is the backward orientation: the top practitioner's back faces the opponent's head while sitting on their torso. This creates unique challenges - no head control, inability to see opponent's face for reaction cues, and different weight distribution requirements. However, it also creates opportunities for specific submissions (armbar, twister, collar chokes) and serves as an excellent transitional platform to standard mount or back control.

The position's main strategic value is as a stepping stone rather than a destination. Experienced practitioners recognize reverse mount immediately and flow smoothly to standard mount (simply turning to face forward) or back control (inserting hooks from the reverse position). Attempting to hold reverse mount for extended periods typically results in increased escape success for the opponent. The position's moderate risk level reflects its transitional nature - dominant enough to score points and create submissions, but vulnerable enough to require quick decision-making about which superior position to convert to.

## Visual Description

You are sitting on your opponent's chest or upper abdomen with your buttocks as the primary contact point, but facing toward their legs rather than their head - essentially mounted backward. Your knees are positioned on either side of their torso, similar to standard mount but reversed. Your legs extend toward their legs, with feet potentially hooking under their thighs or positioned on the mat for base. Your back faces their head, eliminating any head control.

Your opponent lies flat on their back beneath you, with your weight pinning their chest. Their head is behind your back where you cannot see it. Their arms are either defensive against their body or attempting to create frames against your hips/back. Weight distribution runs through your sitting bones onto their chest/abdomen, requiring balance maintenance through core engagement and knee positioning since you lack the natural balance of facing forward.

The spatial relationship creates an unusual control dynamic: you have significant weight pressure controlling their torso, but limited ability to control their upper body or anticipate their movements. Your hands are free for grips, posting, or initiating transitions. Control mechanisms include body weight pinning, knee pressure on sides, and balance adjustments. Movement capabilities include rotating to standard mount (simple turn), inserting hooks for back control (legs already positioned), or attacking with submissions (armbar, choke). Restrictions include inability to see opponent's face, limited upper body control, and inherent instability compared to standard mount.

This creates strategic advantages of transitional opportunities and unique submission angles, while maintaining dominant point value but requiring quick conversion to more stable positions for sustained control.

## Key Principles

- **Transitional Recognition**: Understanding this position is temporary and should convert quickly to standard mount or back control
- **Weight Distribution**: Proper weight through buttocks onto chest prevents bridging escapes despite backward orientation
- **Balance Through Core**: Core engagement maintains balance while facing away from opponent's center of mass
- **Quick Transition Mindset**: Mental preparedness to flow immediately to superior positions rather than forcing reverse mount control
- **Opportunistic Submissions**: Recognizing brief submission windows without over-committing to attacks from unstable position
- **Knee Control**: Wide knee positioning provides base and prevents opponent hip movement
- **Position Hierarchy Awareness**: Recognizing that standard mount and back control are superior end goals

## Offensive Transitions

From this position, you can execute:

### Position Improvements
- [[Transition to Standard Mount]] → [[Mount]] (Success Rate: Beginner 55%, Intermediate 70%, Advanced 85%)
  - Turn body to face opponent in one smooth rotation, maintaining weight pressure throughout turn

- [[Transition to Back Control]] → [[Back Control]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
  - Insert hooks from reverse position, legs already positioned near opponent's sides for easy insertion

- [[Transition to S-Mount]] → [[S-Mount Top]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
  - Advance leg position to S-configuration for armbar setup, requires opponent compliance or fatigue

### Submissions
- [[Armbar from Reverse Mount]] → [[Won by Submission]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
  - Isolate near arm and execute armbar while maintaining reverse position control

- [[Collar Choke from Reverse Mount]] → [[Won by Submission]] (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)
  - Use gi collar to apply choke from reverse position, requires opponent to be flat

- [[Twister Submission]] → [[Won by Submission]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 50%)
  - Advanced spinal lock requiring specific positioning and opponent turning motion

## Defensive Responses

When opponent has this position against you, available counters:

- [[Bridge and Roll Escape]] → [[Mount]] (Success Rate: 45%)
  - Explosive bridge to reverse position back to mount bottom or create space

- [[Elbow Escape to Guard]] → [[Closed Guard Bottom]] (Success Rate: 35%)
  - Create space with elbow frames and recover guard position

- [[Turn and Turtle]] → [[Turtle Position Bottom]] (Success Rate: 40%)
  - Turn toward opponent establishing defensive turtle to escape mount

- [[Backdoor Escape]] → [[Open Guard Bottom]] (Success Rate: 30%)
  - Slip out the back using hip movement and space creation

## Decision Tree

**If** opponent creates defensive frames with elbows:
- Execute [[Transition to Standard Mount]] → [[Mount]] (Probability: 70%)
  - Reasoning: Easier to control facing them, frames indicate reverse position is compromised
- Or Execute [[Armbar from Reverse Mount]] → [[Won by Submission]] (Probability: 50%)
  - Reasoning: Framing arms become submission targets if opponent is experienced

**Else if** opponent remains flat and defensive:
- Execute [[Collar Choke from Reverse Mount]] → [[Won by Submission]] (Probability: 60%)
  - Reasoning: Flat position makes neck vulnerable to collar attacks in gi
- Or Execute [[Transition to Back Control]] → [[Back Control]] (Probability: 75%)
  - Reasoning: Can insert hooks easily from reverse mount on flat opponent

**Else if** opponent attempts to turn toward you:
- Execute [[Twister Submission]] → [[Won by Submission]] (Probability: 50%)
  - Reasoning: Their turning motion creates spinal control opportunity (advanced)
- Or Execute [[Transition to Standard Mount]] → [[Mount]] (Probability: 85%)
  - Reasoning: Follow their rotation to achieve standard mount easily

**Else** (balanced opponent / default):
- Execute [[Transition to Standard Mount]] → [[Mount]] (Probability: 70%)
  - Reasoning: Convert to more sustainable and familiar position with better control
- Or Execute [[Transition to S-Mount]] → [[S-Mount Top]] (Probability: 55%)
  - Reasoning: Advance to more dominant position for armbar if opponent is stable

## Expert Insights

**John Danaher**: "Reverse mount exists primarily as a transitional position in the hierarchy, not a destination. The key understanding is that you're essentially already in position for back control - your legs are positioned perfectly to insert hooks. The question is whether to convert to back control or rotate to standard mount, and the answer depends on opponent's defensive structure. If they're flat and passive, back control is optimal. If they're framing or bridging, standard mount is the path. From a systematic perspective, treat reverse mount as a decision point rather than a sustained position. The mechanical disadvantage of facing away from opponent's center of control means extended time here increases escape probability. Make your decision quickly: back control for passive opponents, standard mount for active defenders."

**Gordon Ryan**: "In competition, reverse mount happens a lot during scrambles - usually when you're attacking the back and they defend by turning. I never try to stay in reverse mount. I'm immediately thinking: can I get hooks in for back control? If yes, do it. If no, turn to standard mount. That's it. No complicated decision tree. The position scores the same points as mount but it's way less stable, so why stay there? Sometimes I'll hit a quick armbar if their arm is way out of position, but 95% of the time I'm transitioning. In training, drill smooth transitions FROM reverse mount rather than trying to develop a reverse mount game. It's a bridge, not a house."

**Eddie Bravo**: "Reverse mount is interesting because it's actually the setup position for some of our advanced 10th Planet techniques, particularly the twister. But here's the thing - the twister requires very specific positioning and opponent movement. Most of the time, you're better off converting to standard mount or getting hooks in. Where reverse mount shines is in the transition itself - you can flow smoothly from turtle top control to reverse mount to either back control or standard mount. Don't think of it as static position; think of it as part of a flow sequence. If you're in reverse mount, you should already be moving to your next position. The exception is if you see the twister setup clear as day - then go for it because it's devastating. But don't force it."

## Common Errors

### Error: Attempting to Maintain Reverse Mount Long-Term
- **Consequence**: Position becomes progressively less stable over time, opponent adapts to unusual control dynamic, escape probability increases significantly, energy expenditure increases
- **Correction**: Recognize reverse mount as transitional immediately, make decision within 3-5 seconds (standard mount, back control, or quick submission), execute transition smoothly
- **Recognition**: If you've been in reverse mount for more than 10-15 seconds without clear submission setup, you're making this error

### Error: Poor Weight Distribution
- **Consequence**: Opponent can bridge effectively, creates space for escapes, makes position unstable and easy to reverse
- **Correction**: Keep weight heavy through buttocks directly on opponent's chest/abdomen, avoid leaning too far forward (toward their legs) or back (toward their head)
- **Recognition**: If opponent's bridges are moving you significantly or you feel unstable, weight distribution is wrong

### Error: Forcing Submissions from Unstable Position
- **Consequence**: Submission attempts from reverse mount without secure position control result in lost position and failed attacks
- **Correction**: Only attempt submissions if opponent is flat, passive, and arm/neck clearly exposed; otherwise transition to standard mount first
- **Recognition**: If your submission attempts are failing AND you're losing position, you're over-committing

### Error: Neglecting to Turn to Standard Mount
- **Consequence**: Staying in less stable position when simple rotation would provide better control and more attack options
- **Correction**: Default action should be turning to standard mount unless clear reason exists to stay reverse (back control opportunity, perfect submission setup)
- **Recognition**: If unsure what to do from reverse mount, you should be turning to standard mount

### Error: Not Recognizing Back Control Opportunity
- **Consequence**: Missing easy transition to superior back control position when hooks can be easily inserted
- **Correction**: When opponent is flat, immediately assess if hooks can insert; back control is superior to reverse mount
- **Recognition**: If opponent's legs are accessible and they're not defending, back control opportunity exists

### Error: Losing Balance During Transition
- **Consequence**: Opponent escapes during your rotation to standard mount or during hook insertion
- **Correction**: Maintain heavy weight pressure throughout transitions, use smooth controlled movements rather than quick jerky motions
- **Recognition**: If opponent escapes during your transitions FROM reverse mount frequently, balance maintenance is problem

### Error: Ignoring Opponent's Bridge Setup
- **Consequence**: Allowing opponent to establish bridge position and explosively reverse the mount
- **Correction**: As soon as opponent's feet plant and hips prepare to lift, either post hands for base or initiate transition to standard mount
- **Recognition**: If opponent successfully bridges and reverses you, you missed their setup indicators

## Training Drills

### Drill 1: Reverse Mount to Standard Mount Transition (Flow Repetition)
Start in reverse mount on willing partner. Practice smooth rotation to standard mount while maintaining weight pressure throughout. Partner provides 0% resistance (allows transition), progress to 25% (mild resistance), 50% (realistic resistance), 75% (strong defense). 10 transitions at each resistance level before progressing. Focus: maintaining weight contact with chest throughout rotation, using opponent's body as pivot point, smooth one-motion turn. Common mistake: lifting off opponent during rotation creating space. Success metric: completing transition at 75% resistance without opponent creating escape space.

### Drill 2: Position Recognition and Decision Making (Choice Drill)
Partner places you in reverse mount randomly during rolling. You must immediately recognize position and make decision: standard mount, back control, or submission. Instructor calls out scenario ("opponent flat and passive" = back control, "opponent framing" = standard mount, "arm extended" = armbar). 20 reps with quick recognition and execution. Focus: instant recognition of reverse mount, decision-making under pressure, smooth transition execution. This drill develops the mental pattern recognition that reverse mount is transitional.

### Drill 3: Weight Distribution Maintenance (Balance and Pressure)
Hold reverse mount on partner who provides progressive defensive movements (staying flat → mild squirming → bridging attempts → full defensive escape attempts). You must maintain position purely through weight distribution without using hands. Start with 30 seconds static (partner flat), then 30 seconds mild movement, then 30 seconds active defense. Focus: buttocks pressure on chest, core engagement for balance, knee positioning for stability. Common mistake: leaning too far forward or back losing balance. Success metric: maintaining position for full 90 seconds through all resistance phases.

### Drill 4: Back Control Insertion from Reverse Mount (Hook Mechanics)
From reverse mount on partner, practice inserting hooks smoothly to establish back control. Partner provides progressive resistance: 0% (allows hook insertion), 25%, 50%, 75%, 100%. 5 repetitions at each resistance level. Focus: first hook slides inside opponent's thigh while maintaining chest pressure, second hook follows immediately, seat belt grip established before releasing reverse mount control. Common mistake: trying to insert both hooks simultaneously instead of sequentially. Success metric: establishing back control from reverse mount at 75% resistance within 3-4 seconds.

### Drill 5: Submission Opportunism (Attack Windows)
Partner randomly provides submission opportunities from reverse mount (extends arm, stays flat with exposed neck, begins turning). You must recognize opportunity and attempt submission IF position is secure, OR transition to better position if setup is insufficient. Instructor evaluates decision quality. 15 scenarios with mix of submission opportunities and transition requirements. Focus: risk assessment, recognizing difference between legitimate opening and trap, prioritizing position over submission. This drill develops judgment about when to attack vs. when to transition.

## Related Positions

- [[Mount]] - Standard mount is primary progression and more stable variation facing forward
- [[Back Control]] - Superior progression from reverse mount via hook insertion
- [[S-Mount Top]] - Advanced progression for armbar setup from reverse mount
- [[Turtle Position Top]] - Often precedes reverse mount establishment during scrambles
- [[Technical Mount]] - Related dominant position with different control characteristics

## Optimal Submission Paths

**Fastest path to submission** (direct attack):
[[Reverse Mount Top]] → [[Armbar from Reverse Mount]] → [[Won by Submission]]
*Reasoning: If opponent's arm is clearly extended and exposed, immediate armbar from reverse position (Advanced: 65% success). Requires arm isolation and secure position.*

**High-percentage path** (systematic):
[[Reverse Mount Top]] → [[Transition to Standard Mount]] → [[Armbar from Mount]] → [[Won by Submission]]
*Reasoning: Converting to standard mount first (85% success) provides more stable platform for submission attacks with better control and more attack options*

**Alternative submission path** (gi variation):
[[Reverse Mount Top]] → [[Collar Choke from Reverse Mount]] → [[Won by Submission]]
*Reasoning: When opponent is flat in gi, collar choke available (60% advanced success) without transition requirement*

**Back control path** (superior position):
[[Reverse Mount Top]] → [[Transition to Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: Back control provides highest-percentage submission position; inserting hooks from reverse mount (75% success) leads to best finishing position*

**Advanced path** (twister specialty):
[[Reverse Mount Top]] → [[Twister Submission]] → [[Won by Submission]]
*Reasoning: When opponent turns or conditions perfect, twister available (50% advanced success). Requires specific positioning and advanced skill.*

## Timing Considerations

**Best Times to Enter**:
- During scrambles from turtle position control
- After failed back take attempts when you end up backward
- When opponent turns away during standard mount
- From successful truck position transitions

**Best Times to Attack**:
- Immediately recognize reverse mount and initiate transition (within 3-5 seconds)
- Attack with submissions only if opponent is flat, passive, and clear opening exists
- Convert to back control if opponent's legs are accessible and undefended

**Vulnerable Moments**:
- During initial establishment (most unstable phase)
- When opponent begins explosive bridge attempt
- Extended time in position (>15 seconds) without transition
- If weight shifts incorrectly during balance adjustments

**Fatigue Factors**:
- Medium energy cost to maintain due to balance requirements
- Should be short-duration position (under 30 seconds typically)
- Core engagement for balance becomes fatiguing if extended

## Competition Considerations

**Point Scoring**: Reverse Mount scores 4 points (same as standard mount) in IBJJF. Points awarded when position established with control. Position counts as mount for scoring purposes.

**Time Management**: Not ideal for maintaining position to protect leads due to instability. Better to convert to standard mount or back control for time management. Use reverse mount as transition to superior positions quickly.

**Rule Set Adaptations**: In all major rule sets (IBJJF, ADCC, submission-only), reverse mount scores/counts as mount position. No special rule adaptations needed. In gi, collar choke options increase. In no-gi, focus on position transitions.

**Competition Strategy**: Reverse mount typically occurs unexpectedly during scrambles. Best strategy: recognize immediately, assess opponent state (flat/defensive/bridging), make quick decision (standard mount, back control, or quick submission), execute transition smoothly. Don't waste time trying to develop reverse mount "game" - it's transitional by nature.

## Historical Context

Reverse mount gained attention primarily through Eddie Bravo's 10th Planet Jiu-Jitsu system which uses it as a setup position for the twister submission. However, in traditional BJJ, reverse mount has always been recognized as a transitional position occurring during scrambles rather than a destination. The position highlights the evolutionary path of BJJ from position-focused grappling to more fluid, transition-based systems where practitioners flow through multiple positions within seconds.
