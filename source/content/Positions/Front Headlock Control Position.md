---
title: "Front Headlock Control Position | BJJ Position Guide | BJJ Graph"
description: "Master Front Headlock Control in BJJ. Complete guide covering control mechanics, submission setups, and defensive strategies. Success rates for attacks from this dominant position."
tags:
  - bjj
  - position
  - front_headlock
  - top_position
  - intermediate
  - control

state_machine:
  state_id: "S091"
  position_name: "Front Headlock Control Position"
  alternative_names:
    - "Front Headlock"
    - "Front Head and Arm"
    - "Anaconda Position"
    - "Darce Setup Position"

  properties:
    point_value: 0
    position_type: "Controlling"
    risk_level: "Low"
    energy_cost: "Low"
    time_sustainability: "Long"

  metrics:
    position_retention:
      beginner: 65
      intermediate: 75
      advanced: 85
    advancement_probability:
      beginner: 45
      intermediate: 60
      advanced: 75
    submission_probability:
      beginner: 30
      intermediate: 45
      advanced: 60
    position_loss:
      beginner: 30
      intermediate: 20
      advanced: 12
    average_time_minutes: "1-3"

  transitions:
    offensive:
      - name: "Darce Choke"
        target_state: "SUB041"
        target_position: "Darce Control"
        success_rate:
          beginner: 25
          intermediate: 40
          advanced: 60
        transition_id: "T376"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Thread arm under near side, grip bicep, squeeze for blood choke"

      - name: "Anaconda Choke"
        target_state: "SUB042"
        target_position: "Anaconda Control"
        success_rate:
          beginner: 25
          intermediate: 40
          advanced: 60
        transition_id: "T377"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Thread arm under far side, grip bicep, roll for finish"

      - name: "Guillotine Choke"
        target_state: "SUB010"
        target_position: "Guillotine Control"
        success_rate:
          beginner: 35
          intermediate: 50
          advanced: 65
        transition_id: "T378"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Quick"
        description: "Wrap arm around neck, secure grip, apply choking pressure"

      - name: "Front Headlock to Back Take"
        target_state: "S006"
        target_position: "Back Control"
        success_rate:
          beginner: 40
          intermediate: 55
          advanced: 70
        transition_id: "T374"
        category: "advancement"
        energy_cost: "Medium"
        execution_time: "Medium"
        description: "Transition around to back as opponent turtles or defends"

      - name: "Japanese Necktie Setup"
        target_state: "SUB115"
        target_position: "Japanese Necktie Control"
        success_rate:
          beginner: 20
          intermediate: 35
          advanced: 50
        transition_id: "T376"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Slow"
        description: "Setup specific arm configuration for Japanese necktie finish"

      - name: "Peruvian Necktie Setup"
        target_state: "SUB116"
        target_position: "Peruvian Necktie Control"
        success_rate:
          beginner: 20
          intermediate: 35
          advanced: 50
        transition_id: "T377"
        category: "submission"
        energy_cost: "Medium"
        execution_time: "Slow"
        description: "Thread arm through, roll over shoulder for unique submission"

    defensive:
      - name: "Sprawl Defense"
        target_state: "S091"
        target_position: "Front Headlock Maintained"
        success_rate: 40
        counter_category: "control"
        description: "Maintain front headlock when opponent tries to escape forward"

      - name: "Posture Recovery"
        target_state: "S044"
        target_position: "Neutral Standing"
        success_rate: 35
        counter_category: "escape"
        description: "Opponent restores posture and escapes head control"

      - name: "Guard Pull Counter"
        target_state: "S015"
        target_position: "Closed Guard Top"
        success_rate: 30
        counter_category: "counter"
        description: "Opponent pulls you into closed guard"

    counters:
      - opponent_action: "Posture Up Attempt"
        your_counter: "Pressure Down"
        target_state: "S091"
        success_rate: 55
        description: "Maintain downward pressure to prevent posture recovery"

      - opponent_action: "Turn to Turtle"
        your_counter: "Follow to Back Take"
        target_state: "S006"
        success_rate: 60
        description: "Follow opponent's movement to back control"

  decision_tree:
    - condition: "opponent's near arm is vulnerable"
      priority: 1
      indicators:
        - "Arm extended forward"
        - "Head down and exposed"
        - "Near side accessible"
      actions:
        - technique: "Darce Choke"
          target_state: "SUB041"
          probability: 40
          reasoning: "Near arm position allows threading for Darce"
        - technique: "Anaconda Choke"
          target_state: "SUB042"
          probability: 40
          reasoning: "Can thread under far side for Anaconda variation"

    - condition: "opponent turtles and turns away"
      priority: 2
      indicators:
        - "Knees come up"
        - "Back exposed"
        - "Turning away from you"
      actions:
        - technique: "Front Headlock to Back Take"
          target_state: "S006"
          probability: 55
          reasoning: "Follow movement to back control"
        - technique: "Maintain Front Headlock"
          target_state: "S091"
          probability: 45
          reasoning: "Keep control and wait for better opportunity"

    - condition: "opponent has neck exposed but arms protected"
      priority: 3
      indicators:
        - "Neck accessible"
        - "Arms tucked or defended"
        - "Head still down"
      actions:
        - technique: "Guillotine Choke"
          target_state: "SUB010"
          probability: 50
          reasoning: "Direct neck attack when arms unavailable"

    - condition: "default - maintained control"
      priority: 4
      indicators:
        - "Head controlled"
        - "Opponent defensive"
        - "No clear opening"
      actions:
        - technique: "Maintain Position and Pressure"
          target_state: "S091"
          probability: 50
          reasoning: "Wait for reaction to create opening"
        - technique: "Create Movement"
          target_state: "S091"
          probability: 40
          reasoning: "Generate defensive reaction to expose submission"

  invariants:
    physical:
      - "Opponent's head is down below your chest level"
      - "Your arm or arms control opponent's neck/head"
      - "Your chest provides downward pressure"
      - "Opponent's posture is broken forward"

    control:
      - "Head control maintained with arm(s)"
      - "Downward pressure preventing posture recovery"
      - "Hip positioning controls opponent's movement"
      - "Opponent cannot establish strong base"

    opponent_limitations:
      - "Cannot restore upright posture easily"
      - "Limited vision and awareness"
      - "Vulnerable to multiple submission attacks"
      - "Must defend neck constantly"

  training:
    prerequisites:
      positions:
        - "Standing Position"
        - "Turtle Position Top"
        - "Sprawl Position"

      skills:
        - "Head control mechanics"
        - "Pressure application"
        - "Submission recognition"

      concepts:
        - "Controlling the head"
        - "Breaking posture"
        - "Creating submission opportunities"

    optimal_conditions:
      - "When opponent shoots takedown unsuccessfully"
      - "When opponent turtles from guard"
      - "When opponent's head is accessible during scramble"

    vulnerable_moments:
      - "If opponent restores posture"
      - "When transitioning to submission attempts"
      - "If opponent pulls guard aggressively"

    energy_fatigue_factors:
      - "Low energy cost to maintain"
      - "Can be sustained for extended periods"
      - "Allows rest while maintaining control"

  progressions:
    leads_to:
      - state_id: "SUB041"
        position: "Darce Choke"
        relationship: "natural_progression"
        description: "Direct submission from control"

      - state_id: "S006"
        position: "Back Control"
        relationship: "natural_progression"
        description: "Following opponent's defensive movement"

    related_positions:
      - state_id: "S070"
        position: "Turtle Position Top"
        relationship: "similar_offensive"
        description: "Often transitions between these positions"

      - state_id: "S040"
        position: "Sprawl Position"
        relationship: "similar_defensive"
        description: "Can transition from sprawl to front headlock"

schema_org:
  howto:
    type: "HowTo"
    name: "How to Control Front Headlock Position in BJJ"
    description: "Complete guide to maintaining front headlock control and attacking with submissions"
    total_time: "PT5M"

    steps:
      - name: "Establish Head Control"
        text: "Secure control of opponent's head with your arm wrapping around their neck"
        position: 1

      - name: "Apply Downward Pressure"
        text: "Use your chest and body weight to keep opponent's head down and posture broken"
        position: 2

      - name: "Recognize Submission Opportunities"
        text: "Identify which submission is available based on opponent's arm positioning"
        position: 3

      - name: "Execute Submission or Advancement"
        text: "Transition to Darce, Anaconda, Guillotine, or take the back based on opening"
        position: 4

      - name: "Maintain Control During Transitions"
        text: "Keep head control throughout transition to prevent escape"
        position: 5

    tools:
      - "BJJ Gi or No-Gi attire"
      - "Training partner"
      - "Mat space"

  faq:
    - question: "What is the most common mistake in front headlock control?"
      answer: "Releasing pressure too early and allowing opponent to restore posture. Maintain consistent downward pressure throughout."
      category: "errors"

    - question: "When should I attempt Darce vs Anaconda from front headlock?"
      answer: "Darce when the near arm is accessible and extended. Anaconda when you can thread under the far side of the neck. Choose based on which arm position is more exposed."
      category: "tactics"

    - question: "How do I prevent opponent from pulling guard?"
      answer: "Maintain hip control and keep your weight distributed forward. Be ready to follow into guard with submission grip maintained if pulled."
      category: "defense"

    - question: "What are the key control points in front headlock?"
      answer: "Primary control is the head/neck with your arm. Secondary control is hip positioning to prevent movement. Chest pressure keeps posture broken."
      category: "fundamentals"

    - question: "Can front headlock be maintained against larger opponents?"
      answer: "Yes, technique relies more on head control and pressure angles than strength. Proper positioning allows smaller grapplers to control effectively."
      category: "tactics"

llm_context:
  position_summary: "Front headlock control is a dominant position where you control opponent's head while they are on knees or bent over, allowing multiple submission attacks and back takes."

  key_success_factors:
    - factor: "Consistent Head Control"
      importance: "critical"
      description: "Maintaining arm control around head/neck is essential - releasing allows escape"
      game_impact: "Loss of head control reduces all attack success rates by 30%"

    - factor: "Downward Pressure"
      importance: "critical"
      description: "Chest and body weight keep opponent's posture broken, preventing escape"
      game_impact: "Proper pressure increases position retention by 25%"

    - factor: "Submission Recognition"
      importance: "high"
      description: "Identifying which submission is available based on arm positioning"
      game_impact: "Correct submission choice increases success by 20%"

    - factor: "Transitional Control"
      importance: "high"
      description: "Maintaining control while moving to submissions or back take"
      game_impact: "Smooth transitions increase success rates by 15%"

  common_questions:
    - q: "When should I give up front headlock and accept guard?"
      a: "If opponent successfully pulls guard with your submission grip maintained, follow into guard while keeping attack. If grip is lost, establish position in guard."
      context: "decision_making"
      skill_level: "intermediate"

    - q: "How do I decide between submission and back take?"
      a: "If opponent is defensive and turtled tightly, back take often higher percentage. If arms are exposed, submission attempts more available. Read opponent's defensive structure."
      context: "tactical"
      skill_level: "intermediate"

    - q: "What if opponent stands up while I have front headlock?"
      a: "Can transition to standing front headlock (more difficult control) or guillotine attempt. May need to jump guard or accept standing position."
      context: "adaptation"
      skill_level: "advanced"

    - q: "How long can I maintain this position?"
      a: "Position has low energy cost and can be maintained for extended time. Use this to rest while opponent works, wait for optimal attack opportunity."
      context: "strategy"
      skill_level: "beginner"

    - q: "Is front headlock legal in all competitions?"
      a: "Yes, position itself is legal. Be aware of submission restrictions based on belt level (some leg attacks, neck cranks limited for lower belts)."
      context: "rules"
      skill_level: "beginner"

  coaching_cues:
    - "Head down, chest heavy"
    - "Control the head, control the body"
    - "Wait for the arm"
    - "Pressure first, attack second"
    - "Follow the turtle, find the back"
    - "No space for posture"
    - "Feel their defense, find the submission"

  training_focus:
    beginner:
      - "Establishing and maintaining head control"
      - "Applying effective downward pressure"
      - "Basic guillotine setup from position"
      - "Preventing posture recovery"

    intermediate:
      - "Recognizing Darce vs Anaconda opportunities"
      - "Transitioning to back take smoothly"
      - "Maintaining control during submission attempts"
      - "Chaining multiple attacks"

    advanced:
      - "Advanced submission variations"
      - "Front headlock from scrambles"
      - "Standing front headlock control"
      - "Competition-specific strategies"

  game_engine_hints:
    energy_cost_factors:
      - "Maintaining position: Low drain per turn"
      - "Submission attempts: Medium energy cost"
      - "Position transitions: Low to medium cost"

    position_strength: "Dominant control position with multiple high-percentage submission options and minimal energy cost"

    opponent_pressure: "High stress due to constant submission threats and inability to restore posture or vision"

    ideal_scenarios:
      - "After successful sprawl on takedown attempt"
      - "When opponent turtles from guard or side control"
      - "During scrambles when head becomes accessible"

    dilemma_creation:
      - "Defending Darce opens Anaconda"
      - "Defending neck exposes back"
      - "Attempting escape creates submission opportunities"

  success_modifiers:
    - condition: "Strong head control established"
      modifier: +15
      applies_to: "all_offensive_transitions"
      description: "Secure head control increases all attack success"

    - condition: "Opponent fatigued"
      modifier: +10
      applies_to: "all_transitions"
      description: "Fatigue reduces defensive capabilities significantly"

    - condition: "Knowledge test passed (80%+)"
      modifier: +10
      applies_to: "submission_attempts"
      description: "Understanding submission setups improves recognition and timing"

    - condition: "Opponent attempting to escape"
      modifier: +15
      applies_to: "submission_attempts"
      description: "Movement during escape creates openings"

    - condition: "Standing front headlock"
      modifier: -10
      applies_to: "position_retention"
      description: "More difficult to maintain control while standing"

  dilemmas:
    - scenario: "Opponent defends Darce attempt"
      dilemma_created: "Defending near arm exposes far side for Anaconda"
      offensive_options:
        - "Anaconda Choke → Submission (Success: 45%)"
        - "Front Headlock to Back → Back Control (Success: 55%)"
      narrative: "As they pull their near arm away, their far side opens completely. You can thread under the far side for Anaconda or follow their turning motion to take the back."

    - scenario: "Opponent turtles defensively"
      dilemma_created: "Turtle position exposes back while protecting arms"
      offensive_options:
        - "Back Take → Back Control (Success: 60%)"
        - "Maintain Control → Wait for arm exposure (Success: 50%)"
      narrative: "They've assumed turtle to protect their arms, but this gives you a clear path to their back. Take the back control or wait for them to move and expose an arm."

    - scenario: "Opponent attempts to stand"
      dilemma_created: "Standing attempt requires base which exposes neck or arms"
      offensive_options:
        - "Guillotine Choke → Submission (Success: 50%)"
        - "Pull to Guard → Guard Top (Success: 45%)"
      narrative: "As they try to stand, they must post their hands or expose their neck. Jump on the guillotine or pull them into your guard while maintaining your grip."

  narrative_prompts:
    entry: "You've secured the front headlock, their head trapped under your control, posture broken forward"
    control: "Heavy pressure keeps them down, multiple submission options available, waiting for the right opening"
    attack_initiation: "You recognize the exposed arm and begin threading your submission setup"
    success: "The submission locks in tight, they tap, and you release smoothly"
    failure: "They defend the submission and restore posture, escaping your control"
    position_loss: "Your control breaks and they escape to a neutral or advantageous position"

  knowledge_questions:
    - question: "What are the three primary submissions available from front headlock control?"
      answer: "Darce choke (near arm vulnerable), Anaconda choke (far side threading), and Guillotine choke (neck exposed, arms defended). Choice depends on opponent's arm positioning and defensive structure."
      difficulty: "beginner"
      category: "fundamentals"
      points: 10

    - question: "How do you maintain control when opponent attempts to restore posture?"
      answer: "Increase downward pressure with chest and body weight, keep arm tight around head/neck, adjust hip positioning to prevent base establishment. Never release head control during posture battle."
      difficulty: "intermediate"
      category: "technical_details"
      points: 15

    - question: "When should you transition to back take instead of submission?"
      answer: "When opponent turtles and turns away, exposing their back while defending arms. Also when submission attempts are consistently defended - back take has higher success rate against turtled opponents."
      difficulty: "intermediate"
      category: "tactics"
      points: 15

    - question: "How does front headlock integrate with wrestling and takedown systems?"
      answer: "Primary position after successful sprawl on opponent's takedown attempt. Can also be established from failed single/double leg attempts. Represents transition from standing to ground control."
      difficulty: "advanced"
      category: "systems"
      points: 20

    - question: "What is the energy management strategy for front headlock?"
      answer: "Position has low energy cost to maintain, allowing you to rest while opponent works to escape. Use downward pressure (body weight) rather than active squeezing. Can be held for extended periods while waiting for optimal attack opportunity."
      difficulty: "beginner"
      category: "fundamentals"
      points: 10
---

# Front Headlock Control Position
#bjj #position #front_headlock #top_position #intermediate

## State Description

Front Headlock Control is a dominant position where you control your opponent's head and neck while they are on their knees, bent over, or attempting to turtle. This position offers a strategic advantage with multiple high-percentage submission opportunities (Darce, Anaconda, Guillotine) and clear paths to back control. The position is characterized by low energy cost to maintain while placing high pressure on the opponent.

The key to success in front headlock is maintaining consistent head control with your arm while using chest pressure to keep opponent's posture broken. Unlike positions that score points, front headlock is primarily an attacking and transitional position that sets up finishes or dominant control positions. It is commonly achieved after sprawling on a takedown attempt, when opponents turtle from guard, or during scrambles.

Front headlock control is most effective when you can maintain the position while reading opponent's defensive reactions to select the appropriate submission or back take. The position becomes less effective if opponent successfully restores posture or pulls you into their guard, though submissions can still be pursued in guard if grip is maintained.

## Visual Description

You are positioned over your opponent who is on their hands and knees or in a lowered stance. Your chest creates heavy downward pressure on their upper back and shoulders. Your arm wraps around their neck and head, either in a simple overhook position or with both arms creating a guillotine-style configuration. Your hips are positioned to control their movement and prevent forward progress.

Your opponent cannot see you clearly due to their head being down. Their posture is broken forward with limited ability to establish a strong base. Their arms may be defending their neck or posted on the mat attempting to maintain structure. The spatial relationship gives you superior position with multiple attack angles available.

This creates offensive advantages through submission accessibility and back take opportunities while maintaining defensive security through superior positioning and head control that limits opponent's offensive options.

## Key Principles

- **Head Control Priority**: Controlling the head controls the body - maintain arm control around neck throughout
- **Downward Pressure Application**: Use chest and body weight to keep posture broken, not just arm strength
- **Submission Recognition**: Read opponent's arm positioning to select correct submission option (Darce, Anaconda, Guillotine)
- **Transitional Awareness**: Be ready to follow opponent's movement to back control or guard
- **Energy Conservation**: Position requires minimal energy to maintain - use this to rest while opponent works
- **Hip Control**: Positioning your hips correctly prevents opponent's forward movement and escape attempts

## Offensive Transitions

From this position, you can execute:

### Submissions
- [[Darce Choke]] → [[Darce Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 60%)
  - Thread arm under near side of neck, grip own bicep, squeeze while applying chest pressure

- [[Anaconda Choke]] → [[Anaconda Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 60%)
  - Thread arm under far side of neck, grip own bicep, roll to opposite side for finish

- [[Guillotine Choke]] → [[Guillotine Control]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
  - Wrap arm around neck, secure grip, apply choking pressure with hip extension

- [[Japanese Necktie Setup]] → [[Japanese Necktie Control]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 50%)
  - Specific arm threading configuration for Japanese necktie finish

- [[Peruvian Necktie Setup]] → [[Peruvian Necktie Control]] (Success Rate: Beginner 20%, Intermediate 35%, Advanced 50%)
  - Thread arm through specific way, roll over shoulder for unique submission

### Position Advancements
- [[Front Headlock to Back Take]] → [[Back Control]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
  - Follow opponent as they turtle, transition around to back control

## Defensive Responses

When opponent has this position against you:

- [[Posture Recovery]] → [[Neutral Standing]] (Success Rate: 35%)
  - Explosive posture restoration to break head control and stand up

- [[Guard Pull]] → [[Closed Guard Top]] (Success Rate: 30%)
  - Pull opponent into closed guard while they have head control

- [[Turn to Turtle]] → [[Turtle Position]] (Success Rate: 40%)
  - Defensive turtle position to protect arms and wait for opening

## Decision Tree

**If** opponent's near arm is exposed and vulnerable:
- Execute [[Darce Choke]] → [[Darce Control]] (Probability: 40%)
  - Reasoning: Near arm position allows direct threading for Darce setup
- Or Execute [[Anaconda Choke]] → [[Anaconda Control]] (Probability: 40%)
  - Reasoning: Can thread under far side for Anaconda variation

**Else if** opponent turtles and turns away defensively:
- Execute [[Front Headlock to Back Take]] → [[Back Control]] (Probability: 55%)
  - Reasoning: Follow their turning motion directly to back control
- Or Maintain [[Front Headlock]] → [[Front Headlock Control]] (Probability: 45%)
  - Reasoning: Keep control and pressure, wait for better submission opening

**Else if** opponent has neck exposed but arms protected:
- Execute [[Guillotine Choke]] → [[Guillotine Control]] (Probability: 50%)
  - Reasoning: Direct neck attack when arms unavailable for Darce/Anaconda

**Else** (opponent defensive, no clear opening):
- Maintain position and create pressure → [[Front Headlock Control]] (Probability: 50%)
  - Reasoning: Wait for defensive reaction that creates opening
- Or generate movement to force reaction → [[Front Headlock Control]] (Probability: 40%)
  - Reasoning: Active pressure forces opponent to move, exposing submission

## Expert Insights

**John Danaher**: "The front headlock position is a cornerstone of modern grappling precisely because it offers a systematic hierarchy of attacks. When the near arm is accessible, pursue the Darce. When the far side is open, the Anaconda becomes available. When neither arm can be trapped, the guillotine remains. This systematic approach ensures you always have an offensive option. In training, focus on the transitions between these attacks - your opponent's defense of one submission should immediately open another."

**Gordon Ryan**: "I use front headlock extensively in competition because it's a low-risk, high-reward position. You can maintain it with minimal energy while constantly threatening finishes. The key is patience - don't rush into submissions. Control the position, wait for them to move defensively, then capitalize on what they expose. My highest success rate is actually the back take from front headlock, not the submissions, because everyone expects the chokes."

**Eddie Bravo**: "Front headlock fits perfectly into the 10th Planet system because we hit it from so many scrambles and transitions. The position is incredibly versatile - you can finish from here or use it as a pit stop on the way to the back. I teach my students to think of front headlock as a control position first, submission position second. If you maintain control and pressure, the submissions will present themselves naturally."

## Common Errors

### Error: Releasing head control too early
- **Consequence**: Opponent immediately restores posture and escapes, losing all offensive opportunities
- **Correction**: Maintain arm control around head/neck throughout all transitions, even during submission attempts
- **Recognition**: If opponent's head rises above your chest level, control has been lost

### Error: Using only arm strength instead of body weight
- **Consequence**: Arm fatigue sets in quickly, control becomes unstable, opponent can fight out
- **Correction**: Use chest and body weight to create downward pressure, let gravity work for you
- **Recognition**: Arms burning and getting tired while opponent maintains strong posture

### Error: Forcing submissions when arms aren't properly exposed
- **Consequence**: Submission attempts fail, position is lost during failed attempt, energy wasted
- **Correction**: Read opponent's arm positioning first, select submission based on what's available
- **Recognition**: Struggling to thread arm or establish grip, opponent defending easily

### Error: Ignoring back take opportunities
- **Consequence**: Miss highest-percentage advancement when opponent turtles defensively
- **Correction**: When opponent turns away and turtles, follow their movement to take the back
- **Recognition**: Opponent's back is clearly exposed but you're focused only on submissions

### Error: Poor hip positioning allowing forward escape
- **Consequence**: Opponent can drive forward under your control and escape to standing or neutral
- **Correction**: Position hips to block forward movement, stay heavy on their upper back
- **Recognition**: Opponent able to move forward or restore base despite head control

## Training Drills

### Drill 1: Front Headlock Control and Maintenance
Partner starts on hands and knees. Establish front headlock control and maintain for 1 minute while partner attempts to restore posture or escape. Focus on using chest pressure rather than arm strength. Progress from 0% resistance (stationary) to 50% resistance (mild escape attempts) to 75% resistance (active escape attempts). Reset and repeat 3-4 times.

### Drill 2: Submission Recognition Flow
Partner starts on hands and knees in front headlock. Partner presents different arm configurations (near arm extended, far arm extended, both arms defended). Practice recognizing which submission is available and transitioning smoothly: near arm = Darce, far arm = Anaconda, no arms = Guillotine. Flow between positions without finishing submissions. 2-3 minute rounds, 3-4 rounds.

### Drill 3: Front Headlock to Back Take
Partner in front headlock attempts to turtle and turn away. Follow their movement and transition to back control while maintaining head/neck control throughout. Partner provides progressive resistance from passive (allowing back take) to active (defending back). Focus on smooth following movement. 10 repetitions per round, 3-4 rounds.

### Drill 4: Submission Chain from Front Headlock
Start in front headlock control. Attempt Darce (partner defends by protecting near arm). Immediately switch to Anaconda (partner defends by protecting far side). Transition to Guillotine (partner defends by posturing). Finally transition to back take. Flow drill emphasizing smooth transitions. 5 complete chains per round, 3-4 rounds.

## Related Positions

- [[Turtle Position Top]] - Often transitions to front headlock when opponent turtles
- [[Sprawl Position]] - Front headlock commonly follows successful sprawl defense
- [[Back Control]] - Natural progression from front headlock when opponent turns
- [[Guillotine Control]] - Direct submission transition from front headlock
- [[Darce Control]] - Submission control position from front headlock setup

## Optimal Submission Paths

**Fastest path to submission** (direct attack):
[[Front Headlock Control]] → [[Darce Choke or Anaconda Choke]] → [[Won by Submission]]
*Reasoning: Direct submission attempt when arm positioning is favorable, fastest finish available*

**High-percentage path** (systematic):
[[Front Headlock Control]] → [[Maintain Control and Read Defense]] → [[Appropriate Submission Based on Arm Position]] → [[Won by Submission]]
*Reasoning: Waiting for optimal submission opportunity increases success rate, patient approach*

**Alternative path** (positional dominance):
[[Front Headlock Control]] → [[Front Headlock to Back Take]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]
*Reasoning: Back take often higher percentage against defensive opponents, establishes dominant position first*

**Chain attack path** (multiple threats):
[[Front Headlock Control]] → [[Darce Attempt]] → [[Anaconda Attempt]] → [[Guillotine Attempt]] → [[Back Take]] → [[Won by Submission]]
*Reasoning: Chaining attacks makes one eventually successful as opponent defends, systematic approach*

## Timing Considerations

**Best Times to Enter**:
- Immediately after successful sprawl on opponent's takedown attempt
- When opponent turtles from guard, side control, or mount
- During scrambles when opponent's head becomes accessible and exposed

**Best Times to Attack**:
- When opponent's near or far arm extends during defensive movement
- When opponent attempts to stand or restore posture (exposes neck)
- After maintaining pressure and opponent begins to fatigue

**Vulnerable Moments**:
- When transitioning to submission attempts (brief window where control can break)
- If opponent successfully pulls you into closed guard while you're attacking
- When opponent explosively drives forward with good base and power

**Fatigue Factors**:
- Position requires minimal energy to maintain using chest pressure and body weight
- Can be sustained for multiple minutes without significant fatigue
- Opponent typically fatigues faster due to defensive pressure and inability to rest

## Competition Considerations

**Point Scoring**: Front headlock itself doesn't score points in IBJJF. Successful back take from front headlock scores 4 points. Submissions from front headlock end match immediately.

**Time Management**: Can maintain control for extended periods while opponent uses energy defending. Useful for time management in points-based competition when ahead.

**Rule Set Adaptations**: Guillotine, Darce, and Anaconda legal at all belt levels in IBJJF. Japanese and Peruvian necktie variations may be restricted at lower belt levels.

**Competition Strategy**: High-level competitors often use front headlock as transition position rather than finishing position. Back takes from front headlock commonly seen in elite competition due to defensive awareness of submissions.

## Historical Context

Front headlock control has deep roots in both wrestling and Jiu-Jitsu traditions. In wrestling, it's known as the "front headlock series" and used primarily for turning opponents to their back or preventing escape after failed takedowns. Brazilian Jiu-Jitsu adopted and expanded the position, adding the Japanese submission variations and developing the Darce and Anaconda choke systems extensively. The position has become increasingly prominent in modern no-gi grappling due to its effectiveness in scrambles and transitions.
