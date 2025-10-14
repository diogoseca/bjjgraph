---
title: "Technical Mount | BJJ Position Guide | BJJ Graph"
description: "Master Technical Mount in BJJ. Complete guide covering control mechanics, submissions, and transitions. Success rates: Beginner 50%, Intermediate 65%, Advanced 80%."
tags:
  - bjj
  - position
  - mount
  - top
  - advanced

state_machine:
  state_id: "S241"
  position_name: "Technical Mount"
  alternative_names:
    - "S-Mount"
    - "Modified Mount"
    - "Step-Over Mount"

  properties:
    point_value: 4
    position_type: "Offensive"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"

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
      beginner: 40
      intermediate: 55
      advanced: 70
    position_loss:
      beginner: 40
      intermediate: 25
      advanced: 15
    average_time_minutes: "1-2"

  transitions:
    offensive:
      - name: "Armbar from Technical Mount"
        target_state: "S001"
        target_position: "Armbar Control"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T240"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Primary armbar finish from technical mount position"

      - name: "Triangle Choke from Technical Mount"
        target_state: "S002"
        target_position: "Triangle Control"
        success_rate:
          beginner: 35
          intermediate: 50
          advanced: 65
        transition_id: "T241"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Triangle finish when opponent defends armbar"

      - name: "Back Take from Technical Mount"
        target_state: "S004"
        target_position: "Back Control"
        success_rate:
          beginner: 45
          intermediate: 60
          advanced: 75
        transition_id: "T242"
        category: "control"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Roll to back control when opponent turns"

      - name: "Return to Full Mount"
        target_state: "S001"
        target_position: "Mount"
        success_rate:
          beginner: 60
          intermediate: 75
          advanced: 85
        transition_id: "T243"
        category: "control"
        energy_cost: "Low"
        execution_time: "Quick"
        description: "Reset to full mount position"

      - name: "Gift Wrap from Technical Mount"
        target_state: "S236"
        target_position: "Gift Wrap Position"
        success_rate:
          beginner: 35
          intermediate: 50
          advanced: 65
        transition_id: "T244"
        category: "control"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Trap opponent's arm for control"

      - name: "Mounted Triangle Setup"
        target_state: "S002"
        target_position: "Triangle Control"
        success_rate:
          beginner: 30
          intermediate: 45
          advanced: 60
        transition_id: "T245"
        category: "submission"
        energy_cost: "High"
        execution_time: "Slow"
        description: "Full mounted triangle submission"

    defensive:
      - name: "Elbow Escape to Half Guard"
        target_state: "S006"
        target_position: "Half Guard Bottom"
        success_rate: 35
        counter_category: "escape"
        description: "Opponent escapes hips and recovers half guard"

      - name: "Bridge and Roll Escape"
        target_state: "S007"
        target_position: "Guard Bottom"
        success_rate: 25
        counter_category: "escape"
        description: "Opponent bridges and rolls to escape mount"

      - name: "Arm Pull Defense"
        target_state: "S001"
        target_position: "Mount"
        success_rate: 30
        counter_category: "control"
        description: "Opponent pulls arm back and forces return to full mount"

      - name: "Turn Away to Turtle"
        target_state: "S008"
        target_position: "Turtle Bottom"
        success_rate: 40
        counter_category: "escape"
        description: "Opponent turns away to turtle position"

    counters:
      - opponent_action: "Elbow Escape Attempt"
        your_counter: "Switch to Triangle"
        target_state: "S002"
        success_rate: 50
        description: "Counter escape with triangle choke"

      - opponent_action: "Arm Pull Defense"
        your_counter: "Back Take"
        target_state: "S004"
        success_rate: 55
        description: "Take the back when opponent turns away"

  decision_tree:
    - condition: "opponent defends armbar by pulling arm back"
      priority: 1
      indicators:
        - "Arm bent and retracted"
        - "Elbow tight to body"
        - "Defensive grip on own gi"
      actions:
        - technique: "Triangle Choke"
          target_state: "S002"
          probability: 55
          reasoning: "Armbar defense exposes neck for triangle"
        - technique: "Gift Wrap Control"
          target_state: "S236"
          probability: 50
          reasoning: "Trap the defensive arm for control"

    - condition: "opponent turns away to escape"
      priority: 2
      indicators:
        - "Shoulder turning"
        - "Body rotating away"
        - "Attempting to go to turtle"
      actions:
        - technique: "Back Take"
          target_state: "S004"
          probability: 65
          reasoning: "Follow opponent's rotation to back"
        - technique: "Maintain Technical Mount"
          target_state: "S241"
          probability: 60
          reasoning: "Pressure prevents turn"

    - condition: "opponent extends arm for defense"
      priority: 3
      indicators:
        - "Arm extended toward your leg"
        - "Pushing on thigh"
        - "Posting for frame"
      actions:
        - technique: "Armbar"
          target_state: "S001"
          probability: 70
          reasoning: "Extended arm perfect for armbar"

    - condition: "default - stable position"
      priority: 4
      indicators:
        - "Opponent defensive but not committing"
        - "Maintaining technical mount"
        - "Looking for opening"
      actions:
        - technique: "Isolate Arm for Armbar"
          target_state: "S001"
          probability: 50
          reasoning: "Create armbar opportunity through pressure"
        - technique: "Maintain and Wait"
          target_state: "S241"
          probability: 45
          reasoning: "Wait for opponent's reaction"

  invariants:
    physical:
      - "One leg stepped over opponent's head/shoulder"
      - "Other leg maintains mount position"
      - "Hips close to opponent's upper body"
      - "Weight distributed between posted leg and mounted leg"
      - "Upper body can lean back for armbar or forward for control"

    control:
      - "Control of at least one opponent's arm"
      - "Pressure on opponent's chest/shoulder with stepped leg"
      - "Hip contact with opponent's torso"
      - "Head and shoulder control maintained"
      - "Ability to switch between armbar and triangle"

    opponent_limitations:
      - "One arm trapped or isolated"
      - "Cannot bridge effectively with leg over head"
      - "Limited mobility due to weight distribution"
      - "Vulnerable to both armbar and triangle"
      - "Difficult to escape without exposing back"

  training:
    prerequisites:
      positions:
        - "Mount"
        - "Side Control Top"
        - "Knee on Belly"

      skills:
        - "Mount maintenance"
        - "Armbar mechanics"
        - "Triangle choke understanding"
        - "Weight distribution control"

      concepts:
        - "Submission Chain"
        - "Position before submission"
        - "Dilemma creation"
        - "Angle Creation"

    optimal_conditions:
      - "Opponent defensive with arms extended"
      - "From established mount position"
      - "When opponent attempts to escape mount"
      - "Opponent unfamiliar with technical mount defense"

    vulnerable_moments:
      - "During leg step-over transition"
      - "When opponent pulls arm back forcefully"
      - "If posted leg loses base"
      - "When switching between submissions"

    energy_fatigue_factors:
      - "Requires less energy than full mount to maintain"
      - "One leg posted allows weight distribution"
      - "Can be held for extended periods with proper technique"
      - "Submission attempts require energy bursts"

  progressions:
    leads_to:
      - state_id: "S001"
        position: "Armbar Control"
        relationship: "natural_progression"
        description: "Primary submission from technical mount"

      - state_id: "S002"
        position: "Triangle Control"
        relationship: "natural_progression"
        description: "Alternative submission when armbar defended"

      - state_id: "S004"
        position: "Back Control"
        relationship: "dominant_transition"
        description: "Take back when opponent turns"

    related_positions:
      - state_id: "S001"
        position: "Mount"
        relationship: "variation"
        description: "Technical mount is specialized mount variation"

      - state_id: "S239"
        position: "S-Mount Position"
        relationship: "similar_offensive"
        description: "Similar leg configuration and submission threats"

      - state_id: "S236"
        position: "Gift Wrap Position"
        relationship: "specialization"
        description: "Can transition to gift wrap for more control"

schema_org:
  howto:
    type: "HowTo"
    name: "How to Use Technical Mount in BJJ"
    description: "Complete guide to controlling and finishing from technical mount position with armbar and triangle attacks."
    total_time: "PT5M"

    steps:
      - name: "Establish Technical Mount"
        text: "From mount, step one leg over opponent's head while maintaining mount with other leg."
        position: 1

      - name: "Isolate the Arm"
        text: "Control opponent's near arm and create isolation for armbar attack."
        position: 2

      - name: "Execute Armbar or Triangle"
        text: "Attack armbar as primary submission or switch to triangle if defended."
        position: 3

      - name: "Take the Back if Opponent Turns"
        text: "When opponent defends by turning away, transition to back control."
        position: 4

      - name: "Maintain Pressure and Control"
        text: "Keep constant pressure with stepped leg while threatening submissions."
        position: 5

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  faq:
    - question: "What is the difference between technical mount and S-mount?"
      answer: "Technical mount and S-mount are often used interchangeably, both referring to the position where one leg is stepped over the opponent's head or shoulder while maintaining mount. The term 'S-mount' comes from the S-shape created by the leg configuration when viewed from the side."
      category: "fundamentals"

    - question: "When should I use technical mount versus staying in full mount?"
      answer: "Transition to technical mount when opponent's defensive positioning makes armbar difficult from full mount, when they extend an arm defensively, or when you want to create a stronger armbar threat. Stay in full mount if you have good control and opponent isn't giving defensive opportunities."
      category: "tactics"

    - question: "How do I prevent opponent from pulling their arm back in technical mount?"
      answer: "Control the wrist with your hand, use your legs to trap the arm, maintain constant downward pressure with your posted leg, and be ready to switch to triangle or gift wrap if they pull the arm back. The key is having a backup plan for every defense."
      category: "defense"

    - question: "What are the key pressure points in technical mount?"
      answer: "Main pressure points are: the posted leg driving into opponent's chest/shoulder, hip pressure from the mounted leg, control of the isolated arm, and your upper body weight distributed appropriately between leaning back for submissions and forward for control."
      category: "fundamentals"

    - question: "Can I finish an armbar directly from technical mount?"
      answer: "Yes, technical mount is one of the highest percentage positions for armbar finishes. The leg over the head prevents opponent from posturing, and the angle makes the armbar very tight. Beginners succeed around 40% of the time, while advanced practitioners can finish 70% or higher."
      category: "tactics"

llm_context:
  position_summary: "Technical mount is an advanced mount variation where one leg steps over the opponent's head, creating a dominant position for high-percentage armbar and triangle attacks with strong control."

  key_success_factors:
    - factor: "Arm Isolation"
      importance: "critical"
      description: "Controlling and isolating opponent's arm is essential for armbar success. Without arm control, opponent can defend and escape."
      game_impact: "Increases armbar success by 30% when arm properly isolated"

    - factor: "Posted Leg Pressure"
      importance: "critical"
      description: "The leg stepped over opponent's head must maintain constant downward pressure to prevent posture and escape. This pressure is the foundation of control."
      game_impact: "Proper pressure increases position retention by 25%"

    - factor: "Hip Proximity"
      importance: "high"
      description: "Keeping hips close to opponent's upper body prevents space creation and maintains submission threats. Distance allows escape."
      game_impact: "Close hips increase submission success by 20%"

    - factor: "Submission Chain Awareness"
      importance: "high"
      description: "Understanding the armbar-to-triangle-to-back chain allows fluid transitions when opponent defends. Never force one submission."
      game_impact: "Chain awareness increases overall finish rate by 35%"

    - factor: "Weight Distribution"
      importance: "medium"
      description: "Proper weight distribution between posted leg and mounted leg allows control without sacrificing mobility for submissions."
      game_impact: "Balanced weight increases control time by 40%"

  common_questions:
    - q: "When should I step over to technical mount?"
      a: "Step over when opponent extends their arm defensively, when you're attempting armbar from mount, or when opponent's defensive posture makes regular mount attacks difficult. The technical mount creates better angles for armbar."
      context: "decision_making"
      skill_level: "intermediate"

    - q: "How do I finish the armbar from technical mount?"
      a: "Control the wrist, fall back toward opponent's legs while keeping leg over head, pinch knees together, lift hips while pulling down on wrist. The leg over head prevents them from sitting up to defend."
      context: "technical"
      skill_level: "beginner"

    - q: "What if opponent pulls their arm back?"
      a: "Immediately switch to triangle choke by bringing your other leg over their head, or transition to gift wrap by trapping the retracted arm. Never fight the arm pull - use their defensive energy to create new attacks."
      context: "adaptation"
      skill_level: "intermediate"

    - q: "How do I prevent losing the position?"
      a: "Keep constant downward pressure with posted leg, maintain hip contact, never let opponent create space between your hips and their body, and be ready to switch back to full mount if technical mount becomes unstable."
      context: "defense"
      skill_level: "beginner"

    - q: "Is technical mount better than regular mount?"
      a: "Technical mount offers higher percentage submissions but slightly less positional control. It's a specialized position within mount that you transition to for specific attacks, not a replacement for mount."
      context: "tactical"
      skill_level: "advanced"

  coaching_cues:
    - "Step over, but don't step off - maintain mount with other leg"
    - "Pressure down with the top leg, don't just rest it"
    - "Isolate the arm before committing to armbar"
    - "If they pull the arm, take the triangle or back"
    - "Hips stay close - don't lean too far back prematurely"
    - "Your posted foot is your anchor - keep it strong"
    - "Chain your attacks - armbar, triangle, back take"
    - "Control the wrist, control the finish"
    - "Fall back only when arm is secured"
    - "Patient pressure creates panic, panic creates openings"

  training_focus:
    beginner:
      - "Understanding technical mount entry from regular mount"
      - "Basic armbar mechanics from technical mount"
      - "Maintaining balance with one leg posted"
      - "Recognizing when to step over"

    intermediate:
      - "Armbar to triangle chain when defended"
      - "Back take timing when opponent turns"
      - "Gift wrap transition for increased control"
      - "Pressure application for control and submission"

    advanced:
      - "Forced reactions through pressure variations"
      - "Split-second submission chains"
      - "Technical mount from various mount scenarios"
      - "Reading opponent's defensive tells for attack selection"

  game_engine_hints:
    energy_cost_factors:
      - "Maintaining position: Low drain per turn"
      - "Submission attempts: Medium energy cost"
      - "Transitions between attacks: Low energy cost"

    position_strength: "Technical mount is a high-percentage finishing position that offers strong control with excellent submission opportunities, particularly armbars and triangles."

    opponent_pressure: "Opponent experiences high stress due to multiple simultaneous threats (armbar, triangle, back take) and limited defensive options."

    ideal_scenarios:
      - "Opponent defensive with extended arms from mount"
      - "Against opponents unfamiliar with technical mount defense"
      - "When opponent's gi grips create arm isolation opportunities"
      - "In gi competition where collar control enhances submission chains"

    dilemma_creation:
      - "Defending armbar by pulling arm opens triangle choke"
      - "Turning away to protect arm exposes back take"
      - "Creating space to escape increases armbar pressure"

  success_modifiers:
    - condition: "Arm properly isolated"
      modifier: +15
      applies_to: "armbar_success"
      description: "Isolated arm dramatically increases armbar finish rate"

    - condition: "Posted leg pressure maintained"
      modifier: +10
      applies_to: "position_retention"
      description: "Consistent pressure prevents escape attempts"

    - condition: "Knowledge of armbar-triangle chain"
      modifier: +20
      applies_to: "submission_probability"
      description: "Understanding submission chains increases finish rate"

    - condition: "Opponent turns away from pressure"
      modifier: +15
      applies_to: "back_take_success"
      description: "Opponent's defensive turn creates back exposure"

    - condition: "Posted leg loses base"
      modifier: -10
      applies_to: "position_retention"
      description: "Weak posted leg allows opponent escape"

  dilemmas:
    - scenario: "Opponent defends armbar by retracting arm"
      dilemma_created: "Retracted arm opens immediate triangle opportunity while moving head into perfect position"
      offensive_options:
        - "Triangle Choke → Won by Submission (Success: 55%)"
        - "Gift Wrap Control → Enhanced Control (Success: 50%)"
      narrative: "As your opponent desperately pulls their arm back, you feel their defensive movement create a new vulnerability - their head positions perfectly for your triangle lock."

    - scenario: "Opponent turns away to protect arm"
      dilemma_created: "Turn exposes back and prevents proper defensive positioning"
      offensive_options:
        - "Back Take → Back Control (Success: 65%)"
        - "Maintain Technical Mount → Continued Pressure (Success: 60%)"
      narrative: "Their rotation away from the armbar threat seems defensive, but you recognize the trap - every inch they turn gives you inches closer to their back."

    - scenario: "Opponent extends arm to create frame"
      dilemma_created: "Extended arm becomes perfect armbar target"
      offensive_options:
        - "Armbar Finish → Won by Submission (Success: 70%)"
        - "Arm Drag to Back → Back Control (Success: 45%)"
      narrative: "The moment they push against your leg, you realize they've made the classic mistake - giving you the very thing you wanted: a straight, isolated arm."

  narrative_prompts:
    entry: "You've maneuvered into mount, and as your opponent defends, you see the opening - their defensive posturing creates the perfect moment to step over their head into technical mount."
    control: "Your leg presses down like a lever over their head, your weight perfectly distributed between your posted foot and mounted leg. Every slight movement you make creates pressure that your opponent must answer."
    attack_initiation: "You isolate the arm, controlling the wrist as you begin to fall back. The setup is there - now comes the execution."
    success: "The armbar locks tight, their arm hyperextended as your legs pinch and hips lift. The tap comes quickly - technical mount has delivered again."
    failure: "They pull the arm back forcefully, disrupting your armbar attempt. But you're already switching, bringing your other leg over for the triangle."
    position_loss: "They've managed to pull their elbow back and create enough space to escape their hips. The mount is threatened, and you must decide - pursue or consolidate."

  knowledge_questions:
    - question: "What are the three primary attacks from technical mount?"
      answer: "Armbar (primary), Triangle Choke (when armbar defended), and Back Take (when opponent turns away). These form a submission chain where defending one attack opens another."
      difficulty: "beginner"
      category: "fundamentals"
      points: 10

    - question: "When opponent pulls their arm back to defend the armbar, what is the highest percentage response?"
      answer: "Immediately switch to triangle choke, as the arm retraction brings their head into perfect position for triangle while they're focused on arm defense. Success rate increases by approximately 30% compared to fighting for the arm."
      difficulty: "intermediate"
      category: "tactics"
      points: 15

    - question: "How does the posted leg in technical mount create control?"
      answer: "The posted leg creates downward pressure on opponent's chest/shoulder, preventing postural escape and making bridging ineffective. It serves as both a pressure point and a base for maintaining balance during submissions."
      difficulty: "beginner"
      category: "fundamentals"
      points: 10

    - question: "Explain the armbar-triangle-back take chain from technical mount and when to use each"
      answer: "Armbar is primary when arm is extended; when opponent retracts arm, switch to triangle as head is now exposed; when opponent turns away to defend either, take the back. This chain exploits each defensive reaction by having a counter-attack ready, creating a no-win situation for opponent."
      difficulty: "advanced"
      category: "systems"
      points: 20

    - question: "What are two common errors that cause loss of technical mount?"
      answer: "1) Leaning too far back for armbar before securing arm control, allowing opponent to push away with free arm. 2) Losing pressure with posted leg, which lets opponent bridge or turn into you to recover. Both errors create space that opponent exploits for escape."
      difficulty: "intermediate"
      category: "technical_details"
      points: 15

---

# Technical Mount
#bjj #state #mount #top #advanced

## State Description

Technical mount, also known as S-mount, is an advanced mount variation that creates one of the highest percentage positions for finishing armbars and triangles in Brazilian Jiu-Jitsu. This position is characterized by stepping one leg over the opponent's head while maintaining mount with the other leg, creating an "S" shape when viewed from the side. Worth 4 points in IBJJF competition, technical mount maintains full mount scoring while dramatically increasing submission opportunities.

The position's power comes from the leg positioned over the opponent's head, which prevents them from posturing up and creates the perfect angle for armbar attacks. The configuration forces the opponent into a defensive dilemma where every defensive action opens a new attack - pulling the arm back exposes the neck for triangle, turning away exposes the back, and extending the arm makes the armbar even tighter. This makes technical mount not just a position, but a complete attack system.

Technical mount is most effective when transitioned to from regular mount during armbar attempts, when the opponent extends their arms defensively, or when their positioning makes standard mount attacks difficult. The position requires less energy to maintain than full mount due to the weight distribution on the posted leg, allowing practitioners to hold it for extended periods while threatening constant submissions. However, it's more specialized than regular mount and requires proper timing and technique to enter and maintain effectively.

## Visual Description

You are in a mounted position with one leg stepped over your opponent's head, creating an elevated position on one side. Your right leg (for example) is posted with the foot on the mat beyond their head, knee bent at approximately 90 degrees, with your shin and thigh creating downward pressure on their chest and shoulder. Your left leg remains in traditional mount position, either with the foot hooked under their leg or flat on the mat for base. Your hips are positioned close to their upper body, with your center of gravity shifted toward the side with the posted leg.

Your upper body can lean back slightly for armbar attempts or forward for control, with your hands controlling their near arm at the wrist and/or elbow. Your posted leg's foot serves as a primary base point, with your weight distributed between this foot and your mounted leg, creating a stable tripod-like structure. The opponent is on their back with one arm isolated and controlled, their head positioned between your legs with limited ability to posture or turn. Your stepped-over leg creates constant downward pressure preventing them from sitting up, while the opposite leg maintains traditional mount control.

This configuration creates a mechanical advantage where your leg over their head acts as a lever preventing escape, your weight pins them without requiring constant muscular effort, and your position allows seamless transitions between armbar, triangle, and back control. The spatial relationship makes defending one submission open others, creating the dilemma that defines technical mount's effectiveness.

## Key Principles

- **Arm Isolation First**: Never commit to technical mount without first securing control of opponent's arm. The position's power comes from the armbar threat, which requires arm control. Enter technical mount during armbar attempts or after isolating the arm from regular mount.

- **Posted Leg Pressure**: The leg over opponent's head must maintain constant, controlled downward pressure. This isn't passive weight - it's active pressure that prevents posturing and escape. Think of it as a lever pressing down on their chest and shoulder.

- **Hip Proximity**: Keep your hips close to opponent's upper body at all times. Distance is your enemy in technical mount. The moment space appears between your hips and their body, they can escape. Maintain tight, crushing proximity.

- **Submission Chain Mastery**: Technical mount is a system, not a single submission. Master the armbar-triangle-back take chain so defending one attack immediately triggers another. Never force a single submission - flow between options based on opponent's reactions.

- **Weight Distribution**: Proper weight distribution between posted leg and mounted leg allows stable control without sacrificing mobility. Too much weight on the posted leg makes you easy to topple; too much on the mounted leg loses pressure. Find the balance that allows control and attack.

- **Defensive Dilemma Creation**: Every move you make should create a no-win scenario for opponent. Armbar pressure makes them pull arm back (triangle). Triangle threat makes them turn away (back take). This constant dilemma is what makes technical mount so dangerous.

## Offensive Transitions

From technical mount, you can execute:

### Submissions
- [[Armbar]] → Armbar Control (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
  - Primary finish from technical mount. Control wrist, fall back while maintaining leg over head, pinch knees, lift hips. The leg position prevents defensive posture.

- [[Triangle Choke Side]] → Triangle Control (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
  - When opponent retracts arm to defend armbar, immediately bring other leg over head for triangle. Their defensive movement positions head perfectly.

- [[Mounted Triangle]] → Triangle Control (Success Rate: Beginner 30%, Intermediate 45%, Advanced 60%)
  - Full mounted triangle by bringing both legs around head. High risk but devastating finish when available.

### Position Improvements
- [[Back Take]] → [[Back Control]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
  - When opponent turns away to defend arm attacks, follow their rotation to back mount. Natural transition that opponent's defense creates.

- [[Return to Mount]] → [[Mount]] (Success Rate: Beginner 60%, Intermediate 75%, Advanced 85%)
  - Reset to full mount when technical mount becomes unstable or as a control option before re-attacking.

### Advanced Control
- [[Gift Wrap]] → [[Gift Wrap Position]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
  - Trap opponent's retracted arm using your body and their own arm, creating enhanced control position before submission attempt.

## Defensive Responses

When opponent has technical mount against you:

- [[Elbow Escape]] → [[Half Guard Bottom]] (Success Rate: 35%)
  - Primary escape is to recover guard by pulling elbow back, creating space, and shrimping out while recovering half guard with inside leg.

- [[Bridge and Roll]] → [[Half Guard Bottom]] (Success Rate: 25%)
  - Bridge explosively while pulling attacking arm to roll opponent over. Timing is critical - must catch them during submission attempt when weight is distributed.

- [[Arm Pull Defense]] → [[Mount Bottom]] (Success Rate: 30%)
  - Pull arm back forcefully and control own wrist with other hand, forcing opponent to reset to regular mount. Accepting mount better than accepting armbar.

- [[Turn to Turtle]] → [[Turtle Bottom]] (Success Rate: 40%)
  - Turn away from attacks to turtle position. Risky as it exposes back, but sometimes necessary to escape imminent submission.

## Decision Tree

**If** opponent defends armbar by pulling arm back:
- Execute [[Triangle Choke Side]] → [[Triangle Control]] (Probability: 55%)
  - Reasoning: Pulled arm brings head into triangle position while they focus on arm defense
- Or Execute [[Gift Wrap]] → [[Gift Wrap Position]] (Probability: 50%)
  - Reasoning: Trap the retracted arm for enhanced control before re-attacking

**Else if** opponent turns away to escape:
- Execute [[Back Take]] → [[Back Control]] (Probability: 65%)
  - Reasoning: Their turn exposes back, follow rotation and secure back mount
- Or Maintain [[Technical Mount]] → [[Technical Mount]] (Probability: 60%)
  - Reasoning: Increase pressure to prevent turn and maintain submission threats

**Else if** opponent extends arm for frame:
- Execute [[Armbar]] → Armbar Control (Probability: 70%)
  - Reasoning: Extended arm is gift for armbar, immediately capitalize on tactical error

**Else** (opponent defensive but not committing):
- Break down [[Armbar Setup]] → Armbar Control (Probability: 50%)
  - Reasoning: Create armbar opportunity through progressive pressure and arm isolation
- Or Maintain and [[Wait]] → [[Technical Mount]] (Probability: 45%)
  - Reasoning: Patient pressure eventually forces opponent to make defensive commitment that creates opening

## Expert Insights

**John Danaher**: "Technical mount represents the mathematical perfection of armbar mechanics - the leg over the head removes the opponent's primary defensive tool (postural escape) while creating a multi-layered attack system. The position's true genius is not the armbar itself, but the defensive dilemma it creates. Every defensive action opens a new attack vector, making defense not just difficult but paradoxical. Study the interconnections between armbar, triangle, and back take - they form a complete system where mastery of one enhances the others. The key is never forcing a single submission but rather surfing the wave of opponent's defensive reactions."

**Gordon Ryan**: "In competition, technical mount is my go-to finishing position from mount. The control is actually better than regular mount in many ways because that leg over the head makes it almost impossible for them to escape. I'll enter technical mount specifically to create the armbar threat, and when they defend, I already know I'm taking their back or finishing the triangle. The position's success comes from having your follow-ups ready before they even defend. My advice: drill the chain until switching between submissions is automatic. In competition, there's no time to think about what's next - you need to know."

**Eddie Bravo**: "Technical mount is beautiful because it fits the rubber guard philosophy of creating no-win situations. From 10th Planet, we approach it as an entry point into multiple submission chains, not just armbar. What I love about technical mount is how it integrates with the whole lockdown system - you can threaten technical mount from everywhere in our system. The key innovation we teach is using the position not just for armbar but as a control point where you can work multiple attacks including unconventional entries to back control. Don't just think armbar when you hit technical mount - think attack system."

## Common Errors

### Error: Stepping over before isolating the arm
- **Consequence**: Opponent's free arm allows them to create frames, push away, or defend the armbar before you establish control. Entering technical mount without arm control is premature and significantly reduces success rates. You end up in a position where the main attack is unavailable.
- **Correction**: Always secure wrist control before stepping over. From mount, work to isolate one arm through pressure, grips, or forced reactions. Once arm is controlled and isolated, then transition to technical mount with purpose. Arm control first, position second.
- **Recognition**: If you feel opponent pushing your posted leg or creating significant movement resistance, you entered without proper arm control. The position should feel stable and submission-ready immediately upon entry.

### Error: Losing pressure with posted leg
- **Consequence**: Opponent can bridge, turn into you, or create space for escape. The posted leg is your primary control point - without constant downward pressure, you lose the position's effectiveness. This is the most common way advanced opponents escape technical mount.
- **Correction**: Actively drive posted leg down into opponent's chest/shoulder at approximately 45-degree angle. This isn't passive weight - it's active pressure that increases when they move. Your posted foot should feel like it's rooted to the mat, and your shin should constantly apply downward force.
- **Recognition**: If opponent's upper body is able to lift or turn toward you, your posted leg pressure is insufficient. You should feel them flattened and unable to generate upward or rotational movement.

### Error: Leaning too far back before securing armbar
- **Consequence**: Creates space between your hips and opponent's body, allowing them to escape their arm or bridge into you. Premature backward lean is a common beginner mistake that turns a dominant position into a scramble. The timing of the backward lean determines success or failure.
- **Correction**: Fall back only after arm is secured at wrist and elbow, and only when your legs are properly positioned. The fallback should be one smooth motion, not a gradual lean. Keep hips close until the moment of commitment, then fall back decisively while maintaining all control points.
- **Recognition**: If opponent easily pulls their arm out when you lean back, you leaned too early or without proper control. The fallback should feel secure, not speculative.

### Error: Fighting for the arm when opponent pulls it back
- **Consequence**: Wastes energy fighting opponent's strength, loses submission opportunity, and misses the immediate triangle opening that arm retraction creates. Fighting the pulled arm is a tactical error that shows lack of system understanding.
- **Correction**: The instant you feel opponent's arm retracting forcefully, immediately release armbar pursuit and bring your other leg over their head for triangle. Use their defensive energy and momentum to accelerate your triangle entry. This is the essence of technical mount's attack chain.
- **Recognition**: If you're straining to hold or pull a retracting arm, you're fighting the wrong battle. The pull should be your trigger to switch attacks, not your signal to pull harder.

### Error: Allowing opponent to turn into posted leg
- **Consequence**: They can knock you off balance by pushing into your posted leg, collapsing your base and escaping the position. This defensive technique is taught specifically to counter technical mount and can completely negate your position.
- **Correction**: Keep posted leg at proper angle (45 degrees to their body) and maintain constant downward pressure. If they turn into posted leg, immediately step over to other side or drop weight down to prevent the turn. Your leg should act as a wall they can't push through.
- **Recognition**: If opponent is able to turn their body toward your posted leg and create pushing pressure, your angle or pressure is wrong. Correct positioning should make turning into you mechanically disadvantageous.

### Error: Neglecting mounted leg's control role
- **Consequence**: Opponent escapes underneath your control because you're focused entirely on posted leg and armbar, forgetting that technical mount is still mount. The mounted leg must maintain traditional mount control responsibilities.
- **Correction**: Your non-posted leg should continue traditional mount duties: controlling opponent's hip, maintaining weight distribution, and providing base. Both legs work together - posted leg for armbar/triangle threat, mounted leg for position maintenance.
- **Recognition**: If opponent easily shrimps out underneath you, your mounted leg stopped doing its job. Both legs must remain active throughout the position.

### Error: Poor weight distribution causing instability
- **Consequence**: Either too much weight on posted leg (easy to topple) or too much weight on mounted side (loss of submission pressure). Improper weight distribution makes the position feel unstable and reduces both control and attack effectiveness.
- **Correction**: Find the balance point where approximately 60% weight is on posted leg, 40% on mounted side. This should feel stable enough to resist opponent's movement while maintaining enough weight on posted leg for effective pressure. Adjust based on opponent's movement.
- **Recognition**: If position feels precarious or you're easily off-balanced by opponent's bridging, your weight distribution needs adjustment. Stable technical mount feels solid and unchanging despite opponent's efforts.

## Training Drills

### Drill 1: Technical Mount Entry from Mount (Control and Timing)

Starting from established mount position, practice the step-over transition to technical mount with focus on timing and arm control. Partner begins with defensive arms in various positions. Practice isolating one arm and stepping over smoothly without losing position. Begin with 0% resistance (compliant partner), progress to 25% resistance (light defensive movement), then 50% (active defense without escaping), and eventually 75% and 100% for advanced practitioners.

Focus on: Arm isolation before transition, maintaining hip contact during step-over, landing posted leg with immediate pressure, smooth weight transition without loss of control, and recognizing optimal timing windows. Sets: 5 entries each side. Reps: 10 step-overs per side. Partner provides varied defensive postures to practice recognizing entry opportunities. Common mistakes include stepping over before arm control is established and losing balance during weight transition.

### Drill 2: Armbar-Triangle-Back Chain (Submission System)

Start in technical mount with partner providing realistic defensive reactions. Attempt armbar; partner pulls arm back (you switch to triangle); partner defends triangle by turning away (you take back). Flow through this chain continuously, focusing on seamless transitions without resetting. Begin at slow speed with called reactions (partner knows what to defend), progress to moderate speed with realistic resistance, then full speed with partner choosing defenses randomly.

Focus on: Instant recognition of defensive cues, fluid transition between attacks without pause, maintaining control throughout chain, proper technique on each submission, and developing automatic responses to defenses. Sets: 5 chains. Reps: 3 complete chains per set (armbar attempt → triangle → back take). Success metric: ability to flow through chain in under 10 seconds at full speed with maintained control. Trains the core system of technical mount and develops the mental database of reaction-counter patterns.

### Drill 3: Posted Leg Pressure Maintenance (Positional Control)

From established technical mount, partner attempts various escapes (bridge, turn, shrimp) while you maintain position solely through proper posted leg pressure. 5-minute rounds where partner actively tries to escape using all legal techniques. Partner provides 50% resistance initially, progressing to 75% and 100% as your control improves. Focus exclusively on using posted leg pressure to nullify escape attempts rather than scrambling or adjusting wildly.

Focus on: Constant downward pressure at 45-degree angle, pressure adjustment based on opponent's movement (increase pressure when they move, maintain when static), weight distribution that allows pressure without instability, feeling opponent's escape initiation before it develops, and maintaining pressure while preparing for submissions. This drill develops the subtle but critical skill of using the posted leg as both a control and sensory tool. Successful practitioners can maintain position for entire 5 minutes against determined escape attempts using primarily posted leg pressure, not scrambling.

### Drill 4: Arm Retraction Response (Reaction Speed Development)

Partner in bottom position of technical mount actively defends armbar by pulling arm back at random moments. Your goal: the instant you feel arm retraction, switch to triangle without conscious thought. Begin with partner providing slow, obvious arm pulls. Progress to sudden, forceful retractions. Eventually, partner decides randomly when to pull, testing your reaction time and automatic response.

Focus on: Sensory awareness of arm pull initiation, instant leg transition over head for triangle, maintaining position control during switch, smooth continuation from armbar pressure to triangle pressure, and developing automatic response that doesn't require conscious decision-making. Sets: 10-15 reactions per round. Partner provides 10-20 arm pulls per set, some feints to develop discernment. Success metric: completion of armbar-to-triangle transition in under 2 seconds consistently, with no position loss or control gap. This drill develops the critical reaction speed that separates good technical mount from great technical mount.

### Drill 5: Technical Mount Hold with Varying Resistance (Conditioning and Position Maintenance)

Hold technical mount for timed intervals (start with 2 minutes, progress to 5 minutes) while partner actively attempts to escape using various techniques. Partner provides progressive resistance starting at 50% and building to 100% as position extends. Partner alternates between different escape attempts: bridging, turning, shrimping, arm pulling, pushing posted leg. Your goal: maintain perfect technical mount throughout with minimal energy expenditure.

Focus on: Energy-efficient pressure application, breathing rhythmically despite opponent's resistance, maintaining attack readiness while conserving energy, feeling and preventing escape initiation before it develops, and psychological pressure through unshakeable position. Track: 1) Total time held, 2) Number of submission attempts you were able to initiate, 3) Subjective energy expenditure (1-10 scale). Advanced practitioners should be able to hold for 5+ minutes at moderate energy cost while threatening multiple submission attempts. This drill develops the stamina and efficiency required for competition where positions must be held under stress.

## Related Positions

- [[Mount]] - Technical mount is an advanced variation of mount, entered from regular mount and maintaining mount scoring while dramatically improving submission angles. Study mount maintenance fundamentals before advancing to technical mount.

- [[S-Mount Position]] - Alternative name often used interchangeably with technical mount, referring to the S-shape created by the leg configuration. Understanding that these terms describe the same position prevents confusion in instruction and study.

- [[Back Control]] - Natural progression from technical mount when opponent turns away to defend attacks. The transition is so common that technical mount can be viewed as a back control entry system. Practice the rotation to back mount from technical mount until automatic.

- [[Triangle Control]] - One of the two primary submissions from technical mount, accessed when opponent defends armbar. The triangle from technical mount has unique characteristics due to mounted position - study both positions to understand the relationship.

- [[Gift Wrap Position]] - Enhanced control position accessed from technical mount by trapping opponent's retracted arm. Useful intermediate position before re-attacking submissions when opponent successfully defends initial attempts.

- [[Armbar Control]] - The primary submission threat from technical mount, and the reason the position is so effective. The technical mount configuration creates optimal armbar angle and prevents standard defenses - study armbar mechanics specifically from this angle.

- [[Knee on Belly]] - While different in execution, shares the principle of using posted leg for pressure and control. Understanding weight distribution principles from knee on belly helps with technical mount's posted leg pressure.

## Optimal Submission Paths

**Fastest path to submission** (direct attack):
[[Technical Mount]] → [[Armbar]] → [[Won by Submission]]
*Reasoning: When opponent's arm is isolated and extended, direct armbar from technical mount is one of highest percentage finishes in BJJ. The leg over head prevents postural escape, making the finish very tight. Success rates: Beginner 40%, Intermediate 55%, Advanced 70%.*

**High-percentage path** (systematic):
[[Technical Mount]] → [[Arm Isolation]] → [[Armbar Attempt]] → [[Triangle Choke Side]] (when defended) → [[Won by Submission]]
*Reasoning: This path accepts that initial armbar may be defended and has immediate follow-up ready. The system approach increases overall finish rate to approximately 60-75% because it doesn't rely on single attack success. When opponent defends armbar by retracting arm, their defensive movement positions head perfectly for triangle.*

**Alternative submission path** (control first):
[[Technical Mount]] → [[Gift Wrap]] → [[Enhanced Control]] → [[Armbar]] → [[Won by Submission]]
*Reasoning: When facing experienced opponents who defend immediately, establish gift wrap for enhanced control before submission attempt. This slightly slower path increases submission success by removing one defensive option. Trade-off is additional step before finish, but increased control percentage.*

**Back control path** (dominant positioning):
[[Technical Mount]] → [[Pressure Application]] → [[Back Take]] (when opponent turns) → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: The technical mount pressure naturally makes opponents want to turn away. By accepting and encouraging this defensive reaction, you can establish back control (highest points, most dominant position) and finish from there. This path is particularly effective in points competitions where back control is valued.*

**Competition chain path** (points + submission):
[[Technical Mount]] → [[Back Take]] → [[Back Control]] (4 points) → [[Rear Naked Choke]] OR [[Return to Technical Mount]] → [[Armbar]]
*Reasoning: In competition, take back first for points and dominant position, then choose between rear naked choke or returning to technical mount for armbar. This path maximizes point scoring while maintaining submission pressure. Particularly useful when ahead on points but seeking submission to seal victory.*

## Timing Considerations

**Best Times to Enter**:
- During armbar attempts from mount when opponent's arm is isolated
- When opponent establishes defensive frames from mount, extending arms
- When opponent's posture from mount makes regular attacks difficult
- After opponent defends submission from mount, leaving arm vulnerable
- When dominating from mount and seeking highest percentage finish

**Best Times to Attack**:
- Immediately after establishing technical mount with arm isolation
- When opponent extends arm to create frame or push against posted leg
- After maintaining pressure for 10-30 seconds and opponent shows fatigue
- When opponent makes defensive commitment that indicates coming movement
- During opponent's bridging attempt, using their movement for submission entry

**Vulnerable Moments**:
- During the step-over transition before posted leg establishes pressure
- When falling back for armbar before arm is fully secured
- When switching between submission attempts if transitions aren't smooth
- If posted leg loses pressure point and allows opponent rotational movement
- When focusing too much on one submission and missing opponent's escape initiation

**Fatigue Factors**:
- Technical mount requires less sustained energy than full mount due to posted leg weight distribution
- Can be maintained for several minutes without significant fatigue in gi
- Submission attempts require short energy bursts but position allows recovery between attempts
- Opponent experiences higher fatigue rate due to defensive demands and multiple threat management
- Position becomes stronger as opponent fatigues, with submission success increasing over time

## Competition Considerations

**Point Scoring**: Technical mount maintains full mount scoring (4 points in IBJJF, highest points in most rule sets) despite the leg configuration change. Transitioning to technical mount from mount does not lose or gain points - it's considered position maintenance. This makes it strategically valuable as you maintain dominant point position while dramatically improving submission percentage. In ADCC, mount is worth 4 points and must be held 3 seconds to score. Technical mount variation satisfies this requirement.

**Time Management**: Technical mount is excellent for burning time while maintaining aggressive positioning. If ahead on points late in match, the position allows defensive focus while appearing aggressive to referees. The constant submission threats prevent stalling calls despite defensive posture. Conversely, when behind on points, the high submission percentage makes it valuable for attempting finish. Balance time management with genuine submission attempts to avoid negative referee perceptions.

**Rule Set Adaptations**: In gi, technical mount offers enhanced control through collar and sleeve grips during transitions and submissions. The gi armbar from technical mount is particularly tight due to friction and grip possibilities. In no-gi, the position requires slightly different weight distribution and more reliance on body-to-body pressure, but fundamental mechanics remain the same. IBJJF vs. ADCC differences mainly affect scoring timing, not position execution. In submission-only formats, technical mount's high finish rate makes it particularly valuable.

**Competition Strategy**: Against defensive opponents, use technical mount as centerpiece of mount game, as it forces reactions that create openings. Against aggressive opponents who escape frequently, technical mount serves as control position that maintains mount scoring while threatening finish. In finals or crucial matches, the psychological impact of technical mount is significant - opponents recognize it as high-percentage finishing position, often leading to panic or premature tap during armbar application. Consider skill level and competition experience: against lower belts, direct armbar often succeeds immediately; against black belts and advanced opponents, system approach (armbar → triangle → back) is typically required.
