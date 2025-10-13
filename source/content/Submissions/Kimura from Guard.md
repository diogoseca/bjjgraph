---
# Core Identifiers
title: "Kimura from Guard"
submission_id: "SUB211"
alternative_names: ["Double Wristlock from Guard", "Ude Garami from Guard", "Gyaku Ude-Garami", "Reverse Shoulder Lock"]
submission_category: "Joint Lock"
submission_type: "Shoulder Lock"
target_area: "Shoulder joint, rotator cuff"

# State Machine Properties
starting_state: "S015"
starting_position_name: "Closed Guard Bottom"
ending_state: "Terminal - Won by Submission"
is_terminal: true

# Success Probability by Skill Level
success_rate:
  beginner: 30
  intermediate: 50
  advanced: 70

# Submission Properties
setup_complexity: "Medium"
execution_speed: "Slow"
escape_difficulty: "Medium"
damage_potential: "CRITICAL"

# SAFETY CONSIDERATIONS (MANDATORY)
safety:
  injury_risks:
    - "Shoulder dislocation (weeks to months recovery, possible surgery)"
    - "Rotator cuff tear (months recovery, often requires surgery)"
    - "Anterior capsule tear (months recovery)"
    - "Ligament damage (AC joint, glenohumeral) (weeks to months recovery)"
    - "Spiral fracture of humerus in extreme cases (months recovery, surgery required)"
  risk_level: "CRITICAL"
  application_speed: "SLOW and progressive - 5-7 seconds minimum in training"
  tap_signals: ["Verbal tap", "Physical tap with free hand", "Physical tap with feet", "Verbal 'tap' or 'stop'"]
  release_protocol: "1) Stop all rotational pressure immediately, 2) Release figure-four grip slowly, 3) Allow arm to return to neutral position, 4) Check partner's shoulder mobility and ROM, 5) Ask about pain level"
  minimum_skill_level: "Beginner (with supervision)"
  training_restrictions:
    - "Never apply explosive rotation - shoulder joints are extremely fragile"
    - "Apply pressure progressively over 5-7 seconds minimum"
    - "Partner must have clear tap access"
    - "Instructor supervision for first 50+ repetitions"
    - "Stop immediately if shoulder makes popping sound"
    - "Never continue if partner shows extreme pain reaction"

# Prerequisites for Safe Attempt
prerequisites:
  position_control: "Closed guard established with opponent's posture broken"
  setup_requirements:
    - "Opponent's arm isolated and controlled"
    - "Figure-four grip secured (hand grips own wrist)"
    - "Opponent's wrist brought toward their lower back"
    - "Perpendicular angle created to maximize leverage"
    - "Opponent's elbow tight to their torso"
    - "Head control or trapped"
    - "Partner aware of submission attempt and can tap"
  opponent_vulnerability: "Arm posted on mat, reaching for grip, or extended for defense"
  technical_skill_level: "Beginner with supervision; solo practice requires 4+ months experience"

# Schema.org Integration (SEO)
schema_type: "HowTo"
estimated_time: "PT7M"
difficulty: "Intermediate"
supply_needed: ["Gi or No-Gi", "Mat space", "Training partner", "Instructor supervision"]

# Tags for classification
tags:
  - submission
  - joint_lock
  - shoulder_lock
  - both
  - upper_body
  - safety_critical
  - guard_bottom

# Related Content (Wikilinks)
related_positions:
  - "[[Closed Guard Bottom]]"
  - "[[Kimura Trap]]"
  - "[[High Guard]]"
related_transitions:
  - "[[Hip Bump Sweep]]"
  - "[[Kimura Sweep]]"
  - "[[Back Take from Kimura]]"
related_defenses:
  - "[[Kimura Defense - Hitchhiker]]"
  - "[[Kimura Escape - Roll Through]]"

# Metadata
date_created: "2025-10-13"
date_updated: "2025-10-13"
author: "BJJGraph Content Team"
version: "2.0"
---

## LLM Context: Submission Data Structure

**Purpose**: Kimura from Guard is a shoulder lock submission from bottom guard position. It's a terminal state resulting in shoulder dislocation or rotator cuff tear if held after tap. Safety is paramount - this technique can cause permanent shoulder damage in 5-7 seconds with full pressure.

**Setup Requirements Checklist**:
- [ ] Starting position: [[Closed Guard Bottom]] (S015) established
- [ ] Position control quality: Guard closed, opponent's posture broken
- [ ] Required grips: Opponent's wrist controlled, figure-four grip secured
- [ ] Angle optimization: Body perpendicular to opponent, elbow tight to their torso
- [ ] Opponent vulnerability: Arm posted, reaching, or extended
- [ ] Space elimination: Wrist brought to lower back, rotation pathway clear
- [ ] Timing recognition: Opponent posts hand or reaches across body

**Defense Awareness**:
- Early defense (setup <70% complete): 60% escape success - pull arm back, break grip, maintain posture
- Hand fighting (figure-four forming, not locked): 50% escape success - grip fighting, arm withdrawal
- Technical escape (kimura locked but minimal pressure): 35% escape success - hitchhiker escape, roll through
- Inevitable submission (arm behind back, rotation applied): 0% escape → TAP IMMEDIATELY

**Safety Q&A Patterns**:
Q: "How fast should pressure be applied?"
A: "SLOW and progressive. Kimura from guard should take minimum 5-7 seconds in training. Shoulder rotates slowly - never jerk or spike the rotation. Competition speed only in competition."

Q: "What are the tap signals?"
A: "Verbal 'tap' or 'stop', physical tap with free hand on opponent or mat, physical tap with feet on opponent or mat, any vocalization indicating shoulder pain."

Q: "What if my partner doesn't tap?"
A: "STOP IMMEDIATELY if: shoulder makes popping/clicking sound, partner's face shows extreme pain, partner's arm goes limp, shoulder visibly dislocates. Release and seek medical attention."

Q: "What are the injury risks?"
A: "Shoulder dislocation (serious - weeks to months recovery, possible surgery), rotator cuff tear (very serious - often requires surgery, 6-12 months recovery), anterior capsule tear, ligament damage, spiral fracture in extreme cases. Always release immediately upon tap."

**Decision Tree for Execution**:
```
IF guard_closed AND opponent_posture_broken AND arm_isolated:
    → Attempt kimura setup (Success Rate: [skill_level]%)
ELIF figure_four_locked AND perpendicular_angle AND arm_to_back:
    → Apply progressive rotational pressure (5-7 seconds)
    → WATCH FOR TAP CONTINUOUSLY
ELIF tap_signal_received:
    → RELEASE IMMEDIATELY per protocol
    → Check partner's shoulder mobility
ELSE:
    → Maintain guard, wait for better opportunity or use for sweep/back take
```

## ⚠️ SAFETY NOTICE

**This submission can cause SHOULDER DISLOCATION or ROTATOR CUFF TEAR if applied improperly.**

- **Injury Risks**:
  - Shoulder dislocation (anterior - most common, weeks to months recovery, possible surgery)
  - Rotator cuff tear (subscapularis, supraspinatus - months recovery, often requires surgery)
  - Anterior capsule tear (months recovery, creates chronic instability)
  - Ligament damage (AC joint, glenohumeral - weeks to months recovery)
  - Spiral fracture of humerus in extreme cases (rare but catastrophic - months recovery, surgery required)
- **Application Speed**: SLOW and progressive. 5-7 seconds minimum from setup to tap.
- **Tap Signals**: Verbal "tap" or "stop", physical tap with free hand/feet on opponent or mat
- **Release Protocol**:
  1. Stop all rotational pressure immediately
  2. Release figure-four grip slowly (don't let arm snap back)
  3. Allow arm to return to neutral position at partner's pace
  4. Check partner's shoulder - ask them to rotate and lift arm
  5. Monitor for pain, limited ROM, instability
  6. If injury suspected, stop training and seek medical attention
- **Training Requirement**: Beginner level acceptable with instructor supervision
- **Never**: Apply explosive rotation or continue after tap - shoulder damage is often permanent

**Remember**: Your training partner trusts you with their shoulder joint. The shoulder is the most mobile joint in the body, which makes it the most vulnerable to injury. Respect the tap immediately and apply pressure slowly. A damaged shoulder can end a BJJ career.

## Overview

The Kimura from Guard is a fundamental and versatile shoulder lock executed from [[Closed Guard Bottom]] (S015). Also known as the double wristlock or ude garami, this submission attacks the shoulder joint by isolating the opponent's arm and applying rotational pressure that forces internal rotation and extension beyond the shoulder's safe range of motion.

What makes the kimura from guard particularly dangerous is that it attacks from a seemingly defensive position. When the opponent posts their hand on the mat to maintain base or reach for grips, they expose their arm to the kimura grip. The figure-four configuration provides tremendous mechanical advantage, allowing the bottom player to control and submit a larger, stronger opponent through proper technique.

The kimura from guard is not just a submission - it's a control position that opens numerous offensive options. From the kimura grip, the practitioner can execute sweeps, take the back, or transition to other submissions. This versatility makes it one of the most important techniques to master from guard.

From [[Closed Guard Bottom]] (S015), the kimura requires breaking the opponent's posture, isolating one arm, securing the figure-four grip, and creating the angle necessary to attack the shoulder. When properly applied with correct angle and rotational pressure, the submission causes immediate pain and can result in serious shoulder injury if the opponent doesn't tap.

### Submission Properties

From [[Closed Guard Bottom]] (S015):

**Success Rates**:
- Beginner: 30%
- Intermediate: 50%
- Advanced: 70%

**Technical Characteristics**:
- **Setup Complexity**: Medium - requires specific arm isolation and figure-four grip
- **Execution Speed**: Slow - 5-7 seconds from grip to tap in training (shoulder damage occurs slowly)
- **Escape Difficulty**: Medium - several escapes exist if caught early
- **Damage Potential**: CRITICAL - can cause shoulder dislocation, rotator cuff tear, permanent damage
- **Target Area**: Shoulder joint (glenohumeral joint, rotator cuff, anterior capsule)

## Visual Finishing Sequence

With your opponent trapped in your closed guard, you control their right wrist with your left hand while your right arm threads under their right upper arm. Your right hand connects to your left wrist, forming a tight figure-four grip. You open your guard and create a perpendicular angle to your opponent, placing their right hand on the mat near your left hip. Your left hand pulls their wrist while your right arm creates a fulcrum at their elbow, keeping it tight to their torso. You slowly rotate their shoulder internally, bringing their hand toward their lower back.

Your opponent experiences increasing rotational pressure on their shoulder joint. The subscapularis and other rotator cuff muscles begin to strain. The anterior capsule is stretched beyond normal range. The shoulder feels like it's being wrenched from the socket. Recognizing that the submission is inevitable and further pressure will cause injury, they tap repeatedly on your leg with their free hand. You immediately stop all rotational pressure, slowly release the figure-four grip, and allow their arm to return to neutral position while monitoring for any signs of injury.

**Body Positioning**:
- **Your position**: On your back with guard closed or open, body angled perpendicular to opponent, figure-four grip secured with their wrist at your chest level, left hand pulling wrist, right arm controlling their elbow tight to your body
- **Opponent's position**: Posture broken or recovering, right arm trapped in figure-four grip with hand near mat or lower back, left arm free to tap, body typically on their side or stacked
- **Key pressure points**: Shoulder joint experiences rotational force (internal rotation + extension), elbow is fulcrum preventing arm withdrawal, wrist is controlled preventing hitchhiker defense
- **Leverage creation**: Figure-four grip provides massive mechanical advantage - your entire body creates leverage against their isolated shoulder

## Setup Requirements

Conditions that **must** be satisfied before attempting:

1. **Position Establishment**: [[Closed Guard Bottom]] (S015) established with guard closed and opponent controlled

2. **Control Points**:
   - Guard hooks in place (feet locked behind opponent's back) OR ready to open for angle creation
   - Opponent's posture broken or recovering
   - One opponent arm targeted and controlled
   - Other opponent arm free to tap clearly
   - Opponent's body controlled to prevent escape

3. **Angle Creation**:
   - Body able to shift perpendicular to opponent
   - Space to place opponent's hand on mat near your hip
   - Opponent's arm cannot be withdrawn during setup
   - Clear pathway to rotate shoulder

4. **Grip Acquisition**:
   - Same-side hand controlling opponent's wrist (your left hand on their right wrist)
   - Other arm threaded under opponent's upper arm near tricep
   - Figure-four grip secured (your right hand grips your left wrist)
   - Grip tight enough to prevent escape but allows movement for rotation
   - Opponent's elbow controlled tight to your body

5. **Space Elimination**:
   - Opponent's wrist brought to mat level or toward lower back
   - Elbow tight to your torso acting as fulcrum
   - No space for opponent to pull arm back or turn thumb
   - Perpendicular angle eliminates escape options

6. **Timing Recognition**:
   - Opponent posts hand on mat for base
   - Opponent reaches for collar or belt grip
   - Opponent attempts to open guard with hand pressure
   - Opponent's arm crosses your body
   - Failed attempt at another technique creates arm exposure

7. **Safety Verification**:
   - Partner aware this is shoulder lock submission
   - Partner has at least one free hand to tap
   - Clear verbal communication established
   - Both participants know release protocol
   - Partner understands injury risks

**Position Quality Required**: Closed guard should be secure with opponent's posture broken or vulnerable. If opponent maintains perfect posture with arms retracted, kimura setup becomes difficult. The technique is most effective when opponent makes positional errors with arm placement.

## Execution Steps

**SAFETY REMINDER**: Apply rotational pressure SLOWLY over 5-7 seconds minimum. Watch for tap signals continuously. Shoulder joints are extremely fragile - never jerk or spike the rotation.

### Step-by-Step Execution

1. **Initial Grip** (Setup Phase)
   - From closed guard, break opponent's posture or wait for them to post hand
   - When opponent posts right hand on mat, immediately control their right wrist with your left hand
   - Pull their wrist toward your chest to prevent withdrawal
   - Safety check: Ensure partner's left arm is free to tap

2. **Figure-Four Formation** (Grip Phase)
   - Maintain wrist control with left hand
   - Thread your right arm under opponent's right upper arm (near tricep area)
   - Reach through with right hand to grab your own left wrist
   - Lock figure-four grip by securing firm grip on your wrist
   - Pull opponent's elbow tight to your right side/ribs
   - Partner check: Confirm they understand kimura is coming and can tap

3. **Angle Creation** (Positioning Phase)
   - Open your guard to create mobility
   - Hip out to your left side, creating perpendicular angle to opponent
   - Plant left foot on mat for leverage
   - Opponent's trapped arm should be pointing across your body
   - Their hand should be near mat level on your left side
   - Speed: Positioning should be smooth and controlled
   - Watch for: Partner attempting to pull arm back or turn thumb down

4. **Arm Isolation** (Control Phase)
   - Pull opponent's right wrist with your left hand
   - Use your right arm to keep their elbow tight to your body
   - Begin to guide their hand toward the mat near your left hip
   - Ensure their elbow stays bent at approximately 90 degrees
   - Create strong fulcrum with your body at their elbow
   - Monitor: Arm should be fully controlled, no slack in grip

5. **Initial Rotation** (Pressure Initiation Phase)
   - Begin slowly rotating opponent's shoulder internally
   - Movement: Pull their wrist toward their lower back
   - Keep their elbow tight to your body as fulcrum
   - Rotation should be smooth, not jerky
   - Speed: SLOW - 5-7 seconds for full rotation
   - Watch for: Partner's face, shoulder position, tap signals
   - Feel: Resistance increasing in their shoulder

6. **Progressive Tightening** (Execution Phase)
   - Continue slow internal rotation of shoulder
   - Pull wrist further toward their lower back
   - Maintain elbow tight to your body
   - Incrementally increase rotational pressure
   - Monitor: Partner's face for pain, listening for tap
   - Stop at: Any resistance that feels like joint is at limit

7. **Submission Recognition & Release** (Finish/Safety Phase)
   - FEEL FOR TAP: Hand tapping your leg/body, foot tapping mat, verbal "tap" or "stop"
   - **RELEASE IMMEDIATELY**:
     - Stop all rotational pressure instantly
     - Hold position briefly (don't let arm snap back)
     - Slowly release figure-four grip
     - Allow their arm to return to neutral position at their pace
     - Open guard completely
   - Post-submission: Ask "shoulder okay?", watch them rotate arm, look for pain or limited ROM
   - Check for: Shoulder instability, popping sensation, inability to move arm normally

**Total Execution Time in Training**: Minimum 5-7 seconds from figure-four lock to tap. In drilling, apply even slower (10-15 seconds) to develop sensitivity and control. Shoulder damage occurs progressively - don't rush.

## Anatomical Targeting & Injury Awareness

### Primary Target
- **Anatomical Structure**: Glenohumeral joint (shoulder ball-and-socket joint), rotator cuff muscles (subscapularis, supraspinatus, infraspinatus, teres minor)
- **Pressure Direction**: Internal rotation + extension - forcing arm behind back while rotating shoulder internally
- **Physiological Response**: Rotator cuff strain → anterior capsule stretch → pain → joint damage if continued

### Secondary Effects
- **Subscapularis Muscle**: Primary internal rotator, most vulnerable to kimura pressure
- **Anterior Capsule**: Ligamentous structure at front of shoulder, stretched by rotation
- **AC Joint**: Acromioclavicular joint experiences stress during rotation
- **Bicep Tendon**: Long head of bicep can be strained
- **Humerus**: In extreme cases, spiral fracture can occur (very rare but catastrophic)

### INJURY RISKS & PREVENTION

**Potential Injuries**:
- **Shoulder Dislocation (Anterior)**: Most common serious injury from kimura. Humeral head dislocates anteriorly from glenoid socket. Requires medical reduction. Recovery: 6-16 weeks, often requires surgery in athletes, high recurrence rate. Can create chronic instability.

- **Rotator Cuff Tear** (Subscapularis): Complete or partial tear of subscapularis muscle/tendon. Often requires surgical repair for active individuals. Recovery: 6-12 months including surgery and rehab. Can cause permanent weakness and limited ROM.

- **Rotator Cuff Tear** (Supraspinatus): Secondary tear from extreme rotation. Often requires surgery. Recovery: 6-12 months. Affects arm elevation and rotation permanently if not properly treated.

- **Anterior Capsule Tear**: Labral tear or capsule damage. Creates chronic shoulder instability. Recovery: 3-6 months, often requires surgery. Can end athletic careers.

- **Ligament Damage** (AC Joint, Glenohumeral): Stretching or tearing of shoulder ligaments. Recovery: 4-12 weeks depending on severity. Grade 3 sprains may require surgery.

- **Spiral Fracture of Humerus**: Extremely rare but catastrophic. Occurs when rotation is applied with extreme force while arm is trapped. Requires surgery, 3-6 months recovery. This is why explosive kimuras are never acceptable.

**Prevention Measures**:
- Apply rotational pressure SLOWLY - take 5-7 seconds minimum in training
- Never "spike" or "jerk" the kimura with explosive movement
- Ensure arm is controlled before applying rotation
- Keep elbow tight to body as stable fulcrum
- Watch partner's face continuously for pain reaction
- Stop at ANY shoulder popping/clicking sound
- Verbal check-ins during drilling: "Shoulder okay?" "Feel that?"
- Release immediately upon ANY tap signal
- After release, check partner's shoulder ROM and pain level

**Warning Signs to Stop IMMEDIATELY**:
- Any popping, clicking, or grinding sound from shoulder
- Partner's face shows extreme pain (eyes wide, grimacing, yelling)
- Shoulder visibly dislocates or changes shape
- Partner's arm goes limp
- Partner unable to tap (rare - should have one arm free)
- ANY uncertainty about partner's safety
- Partner doesn't respond to verbal check
- Your instinct says something is wrong - TRUST IT

## Opponent Defense Patterns

### Common Escape Attempts

Defensive responses with success rates and safety windows:

**Early Defense** (Submission <70% complete - setup phase)
- [[Kimura Defense - Arm Withdrawal]] → [[Closed Guard Bottom]] (Success Rate: 60%, Window: 3-4 seconds)
- Defender action: Pull arm back immediately, prevent figure-four grip, maintain strong posture
- Attacker response: Secure wrist grip quickly, break posture more, threaten sweeps
- Safety note: Best time to defend - kimura not locked yet

**Hand Fighting** (Figure-four forming, not locked)
- [[Kimura Defense - Grip Breaking]] → [[Guard Recovery]] (Success Rate: 50%, Window: 2-3 seconds)
- Defender action: Use free hand to break attacker's grip, push on elbow, pull trapped arm back
- Attacker response: Lock figure-four grip quickly, create angle immediately, use leg control
- Safety note: Critical window - must escape now or kimura will lock

**Technical Escape 1** (Kimura locked but minimal rotation)
- [[Kimura Escape - Hitchhiker]] → [[Side Control Top]] (Success Rate: 35%, Window: 2-3 seconds)
- Defender action: Point thumb toward ceiling ("thumbs up"), rotate arm externally, posture up and pass
- Attacker response: Adjust angle immediately, control thumb position, switch to sweep or back take
- Safety critical: If rotation has begun, hitchhiker becomes very difficult and dangerous to force

**Technical Escape 2** (Kimura locked, moderate pressure)
- [[Kimura Escape - Roll Through]] → [[Top Position Recovery]] (Success Rate: 30%, Window: 2-3 seconds)
- Defender action: Roll forward over shoulder in direction of rotation, relieve pressure, scramble to top
- Attacker response: Maintain grip for sweep, follow roll for back take, adjust for submission
- Safety critical: Roll must be smooth - forcing it risks injury

**Inevitable Submission** (Arm behind back, full rotation applied)
- [[Tap Out]] → Terminal State (Success Rate: 0% escape)
- **Defender must**: TAP IMMEDIATELY - multiple taps on leg/body, mat, or verbal "tap" or "stop"
- **Attacker must**: RELEASE IMMEDIATELY upon feeling/hearing tap
- Safety principle: NO SHAME IN TAPPING - shoulder injuries often require surgery and end careers

### Defensive Decision Logic

```
If [wrist being controlled] AND [figure-four not formed]:
- Execute [[Kimura Defense - Arm Withdrawal]] (Success Rate: 60%)
- Window: 3-4 seconds to prevent grip
- Action: Pull arm back, break posture, prevent threading

Else if [figure-four locked] but [minimal rotation]:
- Execute [[Kimura Escape - Hitchhiker]] (Success Rate: 35%)
- Window: 2-3 seconds before serious rotation
- Action: Thumbs up, external rotation, posture
- HIGH URGENCY: Window closing rapidly

Else if [rotation applied] AND [arm behind back]:
- Execute [[Tap Out]] (Immediate)
- Window: 2-3 seconds before injury
- CRITICAL: Tap multiple times clearly
- NO SHAME: Preserve shoulder integrity

Else [any sign of shoulder pain or instability]:
- Partner should: Release immediately
- Defender: May not be able to tap if injury occurred
- TRAINING CULTURE: Stop if partner's shoulder makes sound or shows extreme pain
```

### Resistance Patterns & Safety Considerations

- **Strength-Based Resistance**: Using arm and shoulder strength to resist rotation
  - Safety concern: Creates dangerous tug-of-war on fragile shoulder joint
  - Better option: Technical escape or immediate tap
  - Reality: Strength won't overcome proper kimura mechanics - will add muscle tears to joint injury

- **Hitchhiker Defense**: Rotating thumb up to externally rotate shoulder
  - Safest defensive approach when kimura first locked
  - Must be executed before significant rotation applied
  - If attacker has already rotated arm significantly, forcing hitchhiker causes injury
  - If hitchhiker doesn't work immediately, tap

- **Rolling Through**: Forward roll to relieve pressure
  - Viable escape in early phase of rotation
  - Can lead to scramble or sweep for attacker
  - Must be smooth roll - never force it
  - If roll doesn't relieve pressure, tap immediately

- **Static Resistance**: Holding position and waiting
  - Only viable in very early phase
  - Once rotation begins, no time to wait
  - Kimura pressure accumulates - shoulder damage is progressive
  - Don't wait for escape opportunity that may not come

**CRITICAL TRAINING CULTURE NOTE**:
In training, if you hear your partner's shoulder make ANY sound (pop, click, grind), RELEASE IMMEDIATELY even if you haven't felt a tap. Shoulder injuries often require surgery and 6-12 months recovery. Your partner's career longevity is more important than "getting the tap." This is the mark of a respected training partner.

## Training Progressions & Safety Protocols

Safe learning pathway emphasizing control before completion:

### Phase 1: Technical Understanding (Week 1-2)
- Study kimura mechanics without partner
- Watch instructional videos showing proper grip and rotation
- Understand shoulder anatomy (rotator cuff, capsule, joint structure)
- Learn specific injury risks (dislocation, rotator cuff tears)
- Study and memorize tap signals
- Practice figure-four grip on grappling dummy
- **No live application yet**
- Quiz yourself: What muscles make up rotator cuff? How does internal rotation damage shoulder?

### Phase 2: Slow Practice (Week 3-4)
- Controlled application with willing partner
- Partner provides ZERO resistance
- Focus: Grip acquisition, angle creation, arm positioning only
- Speed: EXTRA SLOW (15+ seconds per repetition)
- Partner gives "tap" at grip lock stage (ZERO rotation)
- Practice release protocol every single repetition
- Verbal communication: "Shoulder feel okay?" "Any pressure?"
- Instructor supervision required for first 30-50 repetitions
- Goal: Build muscle memory for grip and positioning, not finishing

### Phase 3: Progressive Resistance (Week 5-8)
- Partner provides mild resistance to setup
- Practice reading defensive cues (arm withdrawal, grip fighting)
- Speed: SLOW (10-12 seconds per rep from setup to tap)
- Partner taps at initial rotation (20-30% pressure maximum)
- Develop sensitivity to shoulder resistance and rotation limits
- Emphasize control over completion
- Begin recognizing optimal angle for leverage
- Practice: If partner doesn't tap at 30%, release and reset
- Goal: Learn setup against defense, maintain safety standards

### Phase 4: Timing Development (Week 9-12)
- Partner provides realistic but not full resistance
- Recognize optimal opportunities (posted hands, reaching arms)
- Speed: MODERATE (7-10 seconds from lock to tap)
- Partner taps at 40-50% rotation
- Learn to transition to sweeps and back takes from kimura
- Safety maintained as priority
- Start recognizing "point of no return" feel
- Practice: Still release and reset if anything feels unsafe
- Goal: Develop timing sense and kimura system while maintaining control

### Phase 5: Safety Integration (Week 13-20)
- Light rolling integration (50-70% intensity)
- Proper tap recognition ingrained as reflex
- Speed: Controlled in training (5-7 seconds minimum)
- Partner taps at 50-60% rotation
- Competition speed ONLY in competition
- Respect partner safety absolutely
- Develop reputation as safe training partner
- Practice: Immediate release is automatic response to tap
- Goal: Safe application becomes default, not something you think about

### Phase 6: Live Application (Ongoing - 5+ months experience)
- Full sparring integration with safety emphasis
- Read situations for kimura opportunities
- Use kimura for control, sweeps, and back takes primarily
- Finish submission only when optimal and safe
- Apply at appropriate speed for context (training vs competition)
- Never sacrifice partner safety for "getting the tap"
- Continue refining control and sensitivity
- Mentor newer students on safety protocols
- Practice: You can destroy training partners' shoulders - you choose not to
- Goal: Mastery means control + safety + effectiveness + versatility

**CRITICAL**: Progress through phases only when previous phase is mastered. Most shoulder injuries occur when practitioners skip steps and rush to "finishing." Kimura requires LONGER progression than most submissions because shoulder damage is often permanent and career-ending. Your goal is to become the training partner everyone wants to work with because they trust you completely.

**Training Partner Trust Scale**:
- Weeks 1-4: Partner must trust you not to apply rotation
- Weeks 5-12: Partner must trust you to apply rotation very slowly
- Weeks 13+: Partner must trust you to release immediately
- 6+ months: Partner rolls freely because your safety is proven
- 1+ year: Newer students ask to drill with you because you're known as safe

## Expert Insights

### John Danaher Perspective
> "The kimura from guard is not primarily a submission - it is a control position that happens to contain a devastating submission as one option among many. The proper perspective is to view the kimura grip as a key that unlocks multiple doors: the submission, the sweep, the back take, the positional improvement. When you secure the figure-four grip from guard, you have created what I call a 'control hierarchy' - even if the submission is defended, you maintain superior control that forces your opponent into predictable responses. The biomechanics are elegant: the figure-four configuration creates a compound lever system where your entire body generates force against an isolated joint. The shoulder joint, being a ball-and-socket with high mobility, sacrifices stability for movement - this is the structural weakness we exploit. In training, your goal is to achieve the kimura control position and explore the system - submission is just one branch of a larger strategic tree. Apply rotational pressure progressively, developing sensitivity to your partner's limits. Release immediately upon tap - shoulder injuries often require surgical intervention and create permanent limitations. The kimura system is one of the most important concepts in guard bottom offense, but only when practiced with appropriate respect for its destructive potential."

**Key Technical Detail**: The figure-four grip creates compound leverage where your body weight, arm strength, and leverage combine to overwhelm the isolated shoulder joint.

**Safety Emphasis**: Danaher's systematic approach views kimura as a control system first. Students learn to use the position for sweeps and transitions, making the submission finish just one option. This reduces pressure to "finish at all costs" and emphasizes safer application.

### Gordon Ryan Perspective
> "From guard, I use the kimura grip way more for back takes and sweeps than I do for the finish. The finish is there, don't get me wrong - I've tapped plenty of guys with it. But the smart play is usually to use that grip to off-balance them, take the back, or sweep to mount. In competition, if I'm going for the finish, I'm applying serious pressure - probably 2-3 seconds once I have it locked. In training? I'm taking 7-10 seconds minimum, and I'm stopping at maybe 50-60% of what I'd do in competition. Your training partners need to trust that you're not going to blow out their shoulder. I've seen too many guys get hurt by kimuras - rotator cuff tears, shoulder dislocations, stuff that requires surgery and months of recovery. It's not worth it. In training, I'm using the kimura to practice the system: grip, control, sweep, or back take. The submission is almost like a bonus. If it's there and it's safe, great. If not, I'll sweep you and pass your guard. Both get me the win. The difference is one doesn't require me to risk injuring my training partner."

**Competition Application**: Ryan's competition success with kimura comes from using it as a control position that creates back takes and sweeps, with submission as one option.

**Training Modification**: In training, use kimura for system development (sweeps, back takes, transitions), finish submission only when optimal and safe. This builds better overall game while protecting partners.

### Eddie Bravo Perspective
> "The kimura from guard is huge in 10th Planet. We've got kimura trap series, kimura to back, kimura sweeps - it's a whole system. But I tell my students: be creative with the entries and the control, not with the finish. Once you've got that figure-four locked and you're rotating the shoulder, the mechanics are the same whether you're in gi or no-gi, rubber guard or closed guard. Slow, controlled rotation. Watch for the tap. Release immediately. We've built 10th Planet's reputation on being innovative with positions - lockdown, rubber guard, truck, twister. But we've also built our reputation on safe training. My guys train hard, but they don't injure each other. The kimura is one of those submissions that can end someone's BJJ career if you're reckless with it. Shoulder surgery is no joke - 6 months recovery, sometimes permanent weakness. So we use the kimura primarily for control and transitions. If the submission is there and the angle is perfect and my partner isn't defending properly, sure, I'll finish it. But I'm doing it slowly, I'm watching for the tap, and I'm releasing the second I feel it. Be deadly with your technique, not with your training partners."

**Innovation Focus**: 10th Planet system has countless creative kimura entries and uses (rubber guard, lockdown, truck position), but finish mechanics remain standardized and safe.

**Safety Non-Negotiable**: Bravo's 10th Planet culture values both innovation and safety. Creative system development, strict safety standards for finishing. Reputation matters.

## Common Errors

### Technical Errors

**Error 1: Weak Figure-Four Grip**
- Mistake: Loose grip on own wrist, or not securing grip properly before angle creation
- Why it fails: Opponent can break grip or pull arm free, losing control of position
- Correction: Grab your own wrist firmly with full grip, pull tight before creating angle
- Safety impact: Weak grip leads to lost position and practitioners compensating with excessive force

**Error 2: Insufficient Perpendicular Angle**
- Mistake: Staying too parallel to opponent instead of creating 90-degree angle
- Why it fails: Without proper angle, leverage is poor, rotation is ineffective
- Correction: Hip out to side, create clear perpendicular line between your body and theirs
- Safety impact: Poor angle leads to excessive force and frustrated attempts

**Error 3: Elbow Not Tight to Body**
- Mistake: Allowing space between opponent's elbow and your torso
- Why it fails: Opponent can pull arm back, reduces leverage, allows escapes
- Correction: Pull their elbow tight against your side/ribs, creating solid fulcrum
- Safety impact: Loose elbow control makes submission ineffective and leads to forcing

**Error 4: Wrong Rotation Direction**
- Mistake: Rotating shoulder externally instead of internally, or pulling wrong direction
- Why it fails: External rotation doesn't create kimura pressure, may actually relieve it
- Correction: Rotate internally (hand toward their back), not externally (hand away from body)
- Safety impact: Wrong direction causes confusion and incorrect pressure application

**Error 5: Hand Too High or Too Low**
- Mistake: Opponent's hand positioned at chest level instead of hip/lower back level
- Why it fails: Hand position affects leverage and rotation pathway dramatically
- Correction: Guide their hand to mat near your hip or toward their lower back
- Safety impact: Poor hand positioning reduces effectiveness and may cause compensation

**Error 6: Opening Guard Too Early**
- Mistake: Opening guard before securing figure-four grip and control
- Why it fails: Opponent can escape guard completely, passing opportunity
- Correction: Secure grip first, create initial angle, THEN open guard for full perpendicular movement
- Safety impact: Lost position leads to desperation moves

### SAFETY ERRORS (CRITICAL)

**DANGER: Explosive Rotation**
- Mistake: Jerking or spiking the shoulder rotation rapidly
- Why dangerous: Shoulder has no time to feel pressure before injury - instant dislocation or rotator cuff tear possible
- Injury risk: SHOULDER DISLOCATION, rotator cuff tear (requires surgery), anterior capsule tear, months recovery, possible permanent damage
- Correction: Rotate shoulder slowly and progressively over 5-7 seconds minimum, feel resistance increasing gradually
- **This can end training partnerships and cause permanent career-ending shoulder damage**

**DANGER: Ignoring Tap Signals**
- Mistake: Continuing rotational pressure after feeling tap or hearing verbal tap
- Why dangerous: Shoulder damage occurs progressively - each second after tap causes more injury
- Injury risk: Severe shoulder sprain, dislocation, rotator cuff tear, anterior capsule damage, COMPLETE BREACH OF TRUST
- Correction: Release IMMEDIATELY upon ANY tap signal - hand tap, foot tap, verbal tap, any vocalization
- **This is the most serious error in BJJ - can end training partnerships and cause permanent injury**

**DANGER: Competition Speed in Drilling**
- Mistake: Applying kimura at competition speed (2-3 second finish) during drilling or light rolling
- Why dangerous: Partner not defending at full intensity, can't protect themselves, no time to tap before injury
- Injury risk: Shoulder dislocation, rotator cuff tear, capsule damage, breach of training agreement
- Correction: Match speed to context - drilling is extra slow (15+ seconds), light rolling is slow (10 seconds), hard rolling is moderate (7 seconds), competition is fast (2-3 seconds)
- **Save competition speed for competition - your training partners are not your opponents**

**DANGER: Continuing After Shoulder Sound**
- Mistake: Hearing pop/click/grind from shoulder but continuing to apply pressure
- Why dangerous: Sound indicates structural damage has begun - continuing causes severe injury
- Injury risk: Complete rotator cuff tear, shoulder dislocation, labral tear, permanent instability
- Correction: STOP IMMEDIATELY if you hear ANY sound from partner's shoulder - release and check for injury
- **Shoulder sounds mean STOP - no exceptions, no questions**

**DANGER: Not Monitoring Partner**
- Mistake: Looking away, not watching partner's face during kimura application
- Why dangerous: Miss critical signs of injury (extreme pain, shoulder dislocation, inability to tap)
- Injury risk: Delayed recognition of injury, excessive pressure without tap
- Correction: WATCH your partner's face continuously; look for pain reaction, shoulder position changes, distress signals
- **Your responsibility includes monitoring for signs partner is injured or needs help**

**DANGER: Training Through Shoulder Pain**
- Mistake: Not tapping when kimura is locked and rotation is applied (defender error)
- Why dangerous: Shoulder damage occurs progressively - "toughness" doesn't prevent rotator cuff tears
- Injury risk: Rotator cuff tear (often requires surgery), shoulder dislocation, anterior capsule tear, permanent weakness
- Correction: Tap EARLY when kimura is locked and rotation begins - tap to the position, not the pain
- **No shame in tapping to a well-locked kimura - shoulder surgery can end your BJJ career**

**DANGER: Forcing Through Hitchhiker Defense**
- Mistake: Continuing to rotate shoulder when opponent is doing hitchhiker defense (thumb up)
- Why dangerous: Creates opposing forces on shoulder - your rotation vs their external rotation - massively increases injury risk
- Injury risk: Immediate rotator cuff tear, shoulder dislocation during struggle
- Correction: If opponent successfully executes hitchhiker, either adjust angle or release and transition to sweep/back take
- **Never force submission against active defense - this causes injuries**

### Setup Errors

**Error 7: Insufficient Wrist Control**
- Mistake: Not securing firm grip on opponent's wrist before threading arm
- Why it fails: Opponent pulls arm back during setup, escaping before figure-four forms
- Correction: Control wrist firmly first, ensure they cannot withdraw arm, then thread for figure-four
- Safety impact: Poor initial control leads to lost positions and rushed attempts

**Error 8: Slow Figure-Four Formation**
- Mistake: Taking too long to connect figure-four grip after threading arm
- Why it fails: Gives opponent time to recognize threat and defend (pull arm, break posture)
- Correction: Once arm is threaded, immediately reach through and grab wrist quickly
- Safety impact: Slow setup allows escapes that create frustration and rushing

## Variations & Setups

### Primary Setup (Most Common)
From [[Closed Guard Bottom]]:
- Opponent posts right hand on mat for base or posture
- Immediately control their right wrist with your left hand
- Thread right arm under their right upper arm near tricep
- Connect figure-four grip (right hand grabs left wrist)
- Open guard, hip out to left, create perpendicular angle
- Place their hand near mat by your left hip
- Apply slow internal rotation toward their lower back
- Success rate: Beginner 30%, Intermediate 50%, Advanced 70%
- Setup time: 3-4 seconds for grip, 5-7 seconds for finish
- Safety considerations: Most common entry, ensure smooth controlled rotation

### Alternative Setup 1: From Failed Hip Bump Sweep
From [[Hip Bump Sweep]]:
- Attempt hip bump sweep, opponent posts right hand to defend
- As sweep fails, trap posted arm immediately
- Already have angle from sweep attempt - perfect for kimura
- Secure figure-four grip using sweep momentum
- Transition directly to kimura finish or sweep
- Best for: Opportunistic finish when sweep defended
- Safety notes: Use sweep energy for setup, not for explosive finish

### Alternative Setup 2: From High Guard
From [[High Guard]]:
- Feet on opponent's hips, controlling their posture
- Opponent posts right hand on mat to create base
- Immediately drop feet and secure wrist control
- Thread arm under for figure-four grip
- Already have broken posture - easier control
- Best for: When opponent is defensive and posting for safety
- Safety notes: Good angle already established, focus on grip security

### Alternative Setup 3: From Failed Armbar
From [[Armbar from Guard]] attempt:
- Attempting armbar, opponent pulls arm out in hitchhiker defense
- As they extract arm, it often crosses your body
- Release armbar configuration, catch wrist immediately
- Thread arm under for figure-four grip
- Use their escape momentum for setup
- Best for: Opportunistic catch when armbar is defended
- Safety notes: Quick transition requires extra care with grip and angle

### Alternative Setup 4: From Collar Grip Break
From collar grip defense:
- Opponent has deep collar grip with right hand
- Use both hands to push their elbow up and out
- As grip breaks, trap wrist immediately
- Thread under arm for figure-four grip
- Use their overcommitment to grip for setup
- Best for: When opponent is over-committed to collar control
- Safety notes: Grip breaking creates momentum - control it carefully

### Chain Combinations

**Kimura to Sweep**:
From [[Kimura Grip from Guard]]:
- Secure kimura grip but opponent defends submission well
- Use figure-four control to off-balance opponent
- Rock them forward and to side using grip
- Sweep to [[Side Control Top]] or [[Mount]]
- Maintain kimura grip through sweep if possible
- Can finish kimura from top or use for transition
- Safety: Sweeping motion, not submission finish

**Kimura to Back Take**:
From [[Kimura Grip from Guard]]:
- Secure kimura grip, opponent defends by pulling arm back
- Follow their movement, coming up to seated position
- Swing leg over their back as they turn away from pressure
- Establish [[Back Control]] with hooks
- Can maintain kimura grip or release for collar chokes
- Safety: Controlled movement, focus on position not finish

**Failed Kimura to Triangle**:
From [[Kimura Attempt from Guard]]:
- Attempting kimura, opponent pulls arm free or hitchhikes
- As arm crosses body during defense, trap it for triangle
- Swing leg over shoulder, lock triangle configuration
- Transition from shoulder lock to choke
- Safety: Smooth transition maintains control throughout

### No-Gi vs Gi Modifications

**Gi Version**:
- Grips: Can use sleeve grip to assist wrist control initially
- Advantages: Sleeve grip prevents arm withdrawal, gi friction helps maintain grip
- Adjustments: Can control with sleeve grip before committing to figure-four
- Figure-four grip is same in gi and no-gi
- Safety: Gi grips very strong - even more important to apply slow rotation

**No-Gi Version**:
- Grips: Must secure wrist with direct hand grip (no sleeve)
- Modifications: Wrist control must be very firm from start, no gi assistance
- Advantages: No gi material to create space, more direct feel of arm position
- Figure-four grip is same in gi and no-gi
- Safety: Less friction means ensure tight grip before rotation, slippage is possible

## Mechanical Principles

### Leverage Systems
- **Fulcrum**: Your body at opponent's elbow, creating stable pivot point
- **Effort Arm**: Your entire body pulling their wrist + right arm controlling their elbow = combined rotational force
- **Resistance Arm**: Opponent's rotator cuff muscles and shoulder ligaments (relatively weak against rotation)
- **Mechanical Advantage**: Entire body weight and strength (150-200+ lbs force potential) against isolated shoulder joint that can only resist 40-60 lbs of rotational force before injury
- **Efficiency**: Figure-four grip unifies both arms into single force application, perpendicular angle maximizes leverage

### Pressure Distribution
- **Primary Pressure Point**: Glenohumeral joint (ball-and-socket shoulder joint)
- **Force Vector**: Internal rotation + extension = compound force on shoulder
- **Pressure Type**: Rotational torque on joint that exceeds normal ROM (range of motion)
- **Progressive Loading**: Initial grip creates control (0%), angle creation begins tension (20%), internal rotation increases stress (50-70%), full rotation to back causes injury (100%)
- **Threshold**: ~40 lbs of rotational force causes pain and tap; ~60 lbs causes structural damage (dislocation, tear)

### Structural Weakness
- **Why It Works**: Shoulder is most mobile joint in body, sacrificing stability for movement. Rotator cuff muscles (especially subscapularis) are relatively small and weak against rotational force. Anterior capsule is thin ligamentous structure easily overstretched.

- **Body's Response**: Rotator cuff strain → anterior capsule stretch → pain signals → tap response. If pressure continues: muscle/tendon tears → capsule rupture → joint dislocation.

- **Damage Mechanism**: Internal rotation beyond normal ROM causes:
  1. Subscapularis muscle/tendon overstretch and potential tear
  2. Anterior capsule stretch beyond elastic limit
  3. Labral damage (cartilage rim of socket)
  4. Humeral head translates anteriorly
  5. Complete dislocation if pressure continues

- **Protection Limits**: Body has limited muscular defense against kimura - external rotators (infraspinatus, teres minor) are weaker than attacker's force application. Only option is to tap early.

### Timing Elements
- **Setup Window**: 3-5 seconds to control wrist and form figure-four before opponent defends
- **Application Phase**: 5-7 seconds from grip lock to tap in training (2-3 seconds in competition)
- **Escape Windows**:
  - Pre-grip: 4-5 seconds (60% escape rate)
  - During grip formation: 3-4 seconds (50% escape rate)
  - After grip, before rotation: 2-3 seconds (35% escape rate)
  - During rotation: 1-2 seconds (10% escape rate)
- **Point of No Return**: When figure-four is locked, angle is perpendicular, and internal rotation has brought arm behind back - no reliable escape exists
- **Injury Timeline**: 5-7 seconds from full rotation to serious injury (slower than joint locks, faster than most chokes)
- **Tap Recognition**: Attacker must respond to tap within 0.5-1 second to prevent injury

### Progressive Loading (Safety Critical)

This is the most important mechanical principle for safety:

- **Initial Contact** (0-20% pressure):
  - Figure-four grip locked, elbow tight to body
  - Perpendicular angle established
  - Hand near hip level, no rotation yet
  - Partner feels control but no shoulder stress
  - Time: 1-2 seconds

- **Early Phase** (20-40% pressure):
  - Begin internal rotation of shoulder
  - Hand moving toward lower back slowly
  - Partner feels shoulder beginning to rotate
  - Subscapularis muscle beginning to stretch
  - Easy escape still possible with hitchhiker
  - Time: 2-3 seconds

- **Middle Phase** (40-60% pressure):
  - Increased internal rotation
  - Hand approaching lower back position
  - Partner feels significant shoulder stress
  - Rotator cuff muscles near limit of safe ROM
  - Anterior capsule stretching
  - Decision point for tap in training
  - Time: 2-3 seconds

- **Completion Phase** (60-100% pressure):
  - Full internal rotation applied
  - Hand at or past lower back
  - Partner should tap or injury will occur
  - Rotator cuff at maximum safe strain
  - Anterior capsule at limit
  - 2-3 seconds until injury without tap
  - Time: 1-2 seconds

- **Training Protocol**:
  - In drilling: Stop at 20-30% pressure, partner taps
  - In light rolling: Stop at 40-50% pressure, partner taps
  - In hard rolling: Stop at 50-60% pressure, partner taps
  - In competition: Continue to 80-90%, partner taps or injury

- **Competition Protocol**:
  - Continue to 100% pressure
  - Release upon tap signal
  - If partner doesn't tap, continue to injury (referee stops)

**CRITICAL UNDERSTANDING**: The difference between safe training and dangerous training is respecting these pressure phases. In training, you never need to go above 50-60% pressure to know the technique works. Your training partners trust you to stop there. Shoulder injuries often require surgery and can end careers.

## Knowledge Assessment

Test understanding before live application. Minimum 5/6 correct required.

### Question 1: Setup Recognition (Safety Critical)
**Q**: What position and controls must be established before attempting kimura from guard safely?

**A**: Starting position must be [[Closed Guard Bottom]] (S015) with guard closed. Required controls: (1) Opponent's posture broken or vulnerable, (2) One opponent arm targeted and wrist controlled (same-side hand), (3) Figure-four grip secured (other arm threaded under opponent's upper arm, hand grips own wrist), (4) Other opponent arm free to tap clearly, (5) Perpendicular angle to opponent established or achievable, (6) Opponent's elbow controlled tight to your body, (7) Partner awareness that kimura submission is being attempted and tap signals are clear. Safety verification includes ensuring partner has free limb to tap and understands shoulder injury risks.

**Why It Matters**: Attempting kimura without proper setup leads to forcing/muscling the position, which increases shoulder injury risk dramatically. Kimura requires precise control before rotation. Proper setup makes the finish inevitable and safe.

---

### Question 2: Technical Execution (Mechanics)
**Q**: What creates the rotational pressure in kimura from guard, and what is the primary target?

**A**: Pressure is created by: (1) Figure-four grip locking opponent's arm in bent position, (2) Your body at their elbow creating fulcrum, (3) Left hand pulling their wrist toward their lower back, (4) Right arm keeping their elbow tight to your body as stable pivot, (5) Perpendicular body angle that creates maximum leverage, (6) Internal rotation of their shoulder beyond normal ROM. Primary target is the glenohumeral joint (shoulder ball-and-socket) and rotator cuff muscles (especially subscapularis). The technique works by forcing internal rotation beyond the shoulder's safe range, creating rotational stress that tears muscles, stretches capsule, and can dislocate the joint.

**Why It Matters**: Understanding mechanics allows controlled application rather than forcing. Knowing that shoulder is extremely fragile and damage is progressive helps practitioners recognize when pressure is sufficient. The goal is control and tap, not maximum rotation.

---

### Question 3: Safety Understanding (CRITICAL)
**Q**: How fast should pressure be applied in training, what are the proper tap signals, and what happens if the submission is held after tap?

**A**:

**Application Speed**:
- Drilling: 15+ seconds (extra slow), stop at 20-30% pressure
- Light rolling: 10-12 seconds (slow), stop at 40-50% pressure
- Hard rolling: 7-10 seconds (moderate), stop at 50-60% pressure
- Competition: 2-3 seconds (fast), continue to tap or injury

**Tap Signals**:
- Physical tap with free hand on opponent's leg, body, or mat (multiple taps)
- Physical tap with feet on opponent or mat
- Verbal "tap" or "stop" or any vocalization indicating pain
- Any indication of extreme distress

**Holding After Tap**:
- Immediate: Rotator cuff strain, severe pain
- 2-3 seconds: Rotator cuff tear (partial or complete - requires surgery, 6-12 months recovery)
- 3-5 seconds: Shoulder dislocation (requires medical reduction, weeks to months recovery, possible surgery)
- Continued: Anterior capsule tear, complete rotator cuff rupture, permanent shoulder instability, career-ending injury
- Complete breach of training trust
- Can result in being banned from academy

**Release Protocol**:
1. Stop all rotational pressure immediately
2. Hold position briefly (don't let arm snap back)
3. Slowly release figure-four grip
4. Allow arm to return to neutral at partner's pace
5. Open guard
6. Check partner's shoulder mobility and pain level

**Why It Matters**: This is the most critical safety information for kimura. Shoulder injuries often require surgery and months of recovery. Rotator cuff tears can end athletic careers. Understanding application speed, tap signals, and consequences prevents life-altering injuries and maintains safe training environment.

---

### Question 4: Defense Awareness (Tactical)
**Q**: What is the best defense against kimura from guard, and when must it be executed? At what point is tapping the only safe option?

**A**:

**Best Defense**: Early arm withdrawal - pull arm back immediately when opponent begins wrist control, prevent figure-four grip from forming, maintain strong posture. Success rate: 60% if executed before figure-four is locked.

**Timing Window**: Must be executed in setup phase, before figure-four grip is secured. Once figure-four is locked, escape success drops to 35% (hitchhiker - thumb up, external rotation) or 30% (roll through). Once significant rotation is applied and arm is behind back, escape rate drops to near 0%.

**Tap Decision Point**: When figure-four is locked tight, perpendicular angle is established, and internal rotation is bringing hand toward or behind lower back. At this point, attempting escape risks injury - shoulder is being rotated beyond safe ROM. Tap immediately and learn from the position.

**Physical Indicators to Tap**:
- Figure-four grip feels very tight and secure
- Your shoulder is being rotated internally (hand going toward lower back)
- Significant pressure or pain in shoulder joint
- Opponent's angle is perpendicular with solid control
- Your elbow is tight against their body (can't pull arm back)
- Hitchhiker defense isn't relieving pressure
- Any popping or unusual sensation in shoulder

**Why It Matters**: Knowing when to tap prevents career-ending shoulder injuries. Smart grapplers tap to position, not to pain with kimura - shoulder damage is progressive and often requires surgery. Recognizing inevitable submissions preserves training longevity.

---

### Question 5: Anatomical Knowledge (Technical)
**Q**: What specific anatomical structures are targeted, and what injuries can occur if pressure continues after the tap?

**A**:

**Primary Targets**:
- Glenohumeral joint (shoulder ball-and-socket joint)
- Rotator cuff muscles: subscapularis (primary target), supraspinatus, infraspinatus, teres minor
- Anterior shoulder capsule (ligamentous structure)
- Labrum (cartilage rim of shoulder socket)

**Mechanism**: Internal rotation + extension forces shoulder beyond normal ROM. Subscapularis muscle/tendon is stretched beyond limit, anterior capsule is overstretched, humeral head (ball) translates anteriorly from glenoid (socket).

**Injuries If Held After Tap**:
- Immediate (0-2 seconds): Grade 1-2 rotator cuff strain - pain, inflammation, 2-6 weeks recovery
- 2-5 seconds: Grade 2-3 rotator cuff tear - partial or complete subscapularis tear, requires surgery in athletes, 6-12 months recovery including surgery and rehab
- 5-7 seconds: Anterior shoulder dislocation - humeral head dislocates anteriorly, requires medical reduction, 6-16 weeks recovery, high recurrence rate, often requires surgery, chronic instability possible
- Continued: Complete rotator cuff rupture, anterior capsule tear, labral tear, possible spiral fracture of humerus (rare but catastrophic), permanent shoulder instability, career-ending injury

**Secondary Structures Affected**:
- AC joint (acromioclavicular) - can be sprained
- Bicep tendon (long head) - can be strained or torn
- Nerve damage possible in extreme cases (axillary nerve, brachial plexus)

**Recovery Reality**:
- Rotator cuff repair surgery: 6-12 months full recovery
- Shoulder dislocation: Often requires surgery for athletes, high recurrence without surgery
- Many shoulder injuries never fully heal - permanent weakness and instability common
- Career-ending potential for martial artists and athletes

**Why It Matters**: Understanding the specific injury potential creates appropriate respect for kimura. Shoulder injuries are among the most serious in BJJ - they often require surgery, have long recovery times, and frequently result in permanent limitations. This is why kimura must be applied with extreme care and slow progression. Partner's career longevity depends on your control.

---

### Question 6: Release Protocol (Safety Critical)
**Q**: What is the immediate action required when partner taps, and how do you safely release the kimura from guard?

**A**:

**Immediate Action**: STOP ALL ROTATIONAL PRESSURE IMMEDIATELY upon feeling or hearing any tap signal. Do not continue rotation even slightly.

**Release Steps**:
1. **Cease Rotation**: Stop all pulling motion on wrist, freeze position (0.5 seconds)
2. **Hold Position**: Keep figure-four grip but no pressure - prevent arm from snapping back suddenly (1 second)
3. **Slow Grip Release**: Gradually release figure-four grip, allowing arm to return to neutral slowly (1-2 seconds)
4. **Open Guard**: Release guard hooks (1 second)
5. **Monitor Arm Return**: Watch as partner's arm returns to normal position at their pace (2-3 seconds)
6. **Check Partner**: Watch partner's face, ask "shoulder okay?" (ongoing)
7. **Verify ROM**: Ask partner to rotate arm, lift arm, move shoulder normally (10-15 seconds)
8. **Look for Injury Signs**: Watch for pain during movement, limited ROM, instability, holding shoulder protectively

**What to Watch For After Release**:
- Partner's ability to rotate shoulder normally (full ROM)
- Any pain during arm movement
- Instability sensation (shoulder feels loose or wrong)
- Popping or clicking during movement (indicates injury)
- Limited ability to lift arm
- Partner holding shoulder or showing protective behavior
- Serious signs: If partner shows significant pain, limited ROM, or instability, stop training and recommend medical evaluation

**Total Release Time**: 5-7 seconds from tap to full separation and neutral position, then 10-15 seconds monitoring

**Critical**: With kimura, the release must be especially controlled - don't let trapped arm snap back to neutral quickly. The shoulder has been in compromised position under stress. Sudden return to neutral can cause additional injury.

**Why It Matters**: Proper release protocol prevents injury during disengagement and demonstrates respect for training partner. With kimura specifically, the release phase is as important as the application phase. Shoulder injuries often occur during release if arm snaps back suddenly. This is the difference between a trusted training partner and someone people avoid.

---

## Audio & Narration Elements

### Dramatic Commentary (For TTS/Game Narration)

**Setup Phase**:
> "Blue has closed guard, controlling white's posture. White posts their right hand on the mat to create base - the opening Blue was waiting for. Blue's left hand shoots to white's wrist. Control established. Blue's right arm begins threading under white's upper arm. White realizes the danger - the kimura is coming. Blue's right hand reaches through, connects to the left wrist. The figure-four is locked. White's eyes widen. This is deep."

**Tension Building**:
> "Blue opens the guard, hips out to the left side. The perpendicular angle is forming. White's right elbow is tight against Blue's body - solid fulcrum. Blue begins to guide white's hand toward the mat near the left hip. White is trying to pull the arm back, but the figure-four grip is iron tight. Blue's angle is perfect - 90 degrees, maximum leverage. The setup is complete. Now the question: can Blue finish this safely and methodically?"

**Critical Moment**:
> "Blue begins the rotation. Slowly. Methodically. White's hand is being guided toward their lower back. The internal rotation is starting. White's face shows concern - the shoulder pressure is building. Blue is watching carefully, applying progressive pressure over several seconds. The rotation continues. White's shoulder is approaching its limit. White has a decision: defend with hitchhiker escape now, or tap to the inevitable position. Blue's control is dominant. The position is locked. White's shoulder is rotating beyond comfort."

**Tap Recognition**:
> "The tap! White's left hand slaps Blue's leg repeatedly - clear tap signal. Blue stops immediately. All rotational pressure ceases. Blue holds the position briefly, then slowly releases the figure-four grip. White's arm returns to neutral position gradually. Blue opens the guard. White sits up, rotates the shoulder, tests the range of motion. Full mobility, no injury. A perfect example of control and safety. Blue's technique was inevitable, white recognized it and tapped intelligently, Blue's release was immediate and careful."

**Victory Declaration**:
> "And it's over! Victory by kimura from guard! Blue executed one of the most technical and dangerous submissions in BJJ with absolute precision and control. From the moment white posted that hand, the trap was set. The figure-four grip was solid, the angle was perpendicular perfection, and the rotational pressure was slow and progressive. Most importantly - the release was immediate and controlled. This is how the kimura from guard should be performed. A fundamental submission, executed with mastery and respect. White's shoulder is safe, Blue's reputation as a safe and technical training partner is reinforced. Let's analyze what made this work."

**Expert Analysis**:
> "[Danaher voice] What we witnessed here was a systematic application of one of grappling's most devastating joint locks, executed with appropriate respect for its destructive potential. When white posted that right hand, Blue immediately recognized the opportunity - this is pattern recognition developed through thousands of guard repetitions. The initial wrist control was immediate - Blue's left hand secured white's right wrist before white could retract the arm. The figure-four formation was efficient - right arm threaded under upper arm, right hand connected to left wrist. This grip configuration creates what I call a 'compound lever system' - both of Blue's arms work in unison, creating force that white's isolated shoulder cannot resist. Notice the angle creation - Blue didn't attempt to finish from parallel position. The hip-out movement created a perpendicular angle, approximately 90 degrees. This angle is biomechanically critical - it transforms the kimura from a strength contest into a mechanical inevitability. The fulcrum is white's elbow against Blue's body. The effort arm is Blue's entire torso pulling white's wrist. The resistance arm is white's rotator cuff musculature and shoulder capsule. The mechanical advantage is overwhelming - Blue's whole body versus white's small shoulder stabilizers. Observe the application speed - Blue rotated white's shoulder progressively over approximately 7 seconds. This is controlled finishing. White felt the progression: initial rotation, increasing shoulder stress, recognition of inevitability. White tapped intelligently when the position was locked and rotation was underway - this is tap-early culture. Blue's immediate cessation of pressure shows understanding of injury mechanics. The shoulder joint sacrifices stability for mobility - it's the most mobile joint but also the most vulnerable. The rotator cuff muscles, particularly the subscapularis targeted by internal rotation, are small and easily damaged. Continuing pressure after the tap risks rotator cuff tears that require surgical repair and 6-12 months recovery. Blue's controlled release - holding position briefly, then slowly releasing grip, allowing arm to return gradually - prevents injury during disengagement. This is not just a submission victory - this is a demonstration of technical mastery, biomechanical understanding, and ethical training practices. The kimura is a position of control first, a submission second. Blue could have used this grip for sweeps or back takes. The submission finish was one option among many, selected because the opportunity was optimal and the application was safe."

### Technical Instruction (For Training Mode)

**Setup Cues**:
- "Establish closed guard with hooks in"
- "Break opponent's posture or wait for hand post"
- "Watch for opponent posting hand on mat for base"
- "Control posting wrist immediately - same-side hand"
- "Don't let them pull arm back - secure wrist first"
- "Verify partner can tap with other hand"

**Execution Guidance**:
- "Thread arm under opponent's upper arm near tricep"
- "Reach through with hand to grab your own wrist"
- "Lock figure-four grip tight - this is your control"
- "Pull their elbow tight against your body - solid fulcrum"
- "Open guard to create mobility"
- "Hip out to side - create perpendicular angle"
- "Guide their hand toward mat near your hip"
- "Begin slow internal rotation - hand toward their lower back"
- "Watch partner's face - monitor for pain or distress"
- "Feel resistance in shoulder - progressive pressure over 5-7 seconds"

**Safety Reminders**:
- "Remember: 5-7 seconds minimum from grip to tap"
- "Watch for the tap signal continuously"
- "Never jerk or spike the rotation - slow progressive pressure"
- "Monitor partner's shoulder - watch for extreme pain reaction"
- "Release immediately upon any tap signal"
- "After release, check partner's shoulder ROM and pain level"
- "If anything feels wrong, stop and check"

**Completion Confirmation**:
- "Hold position with progressive rotation - don't rush"
- "Maintain perpendicular angle and tight elbow control"
- "Wait for tap signal - could be hand, foot, or verbal"
- "Perfect - feel the tap, stop all pressure immediately"
- "Hold position briefly, then release grip slowly"
- "Kimura complete - safe finish, controlled release"
- "Partner's shoulder is safe - excellent control and respect"

### Educational Emphasis (For Training Content)

**Safety First Messages**:
> "In training, your goal with the kimura from guard is to achieve the control position and explore the system - sweeps, back takes, and positional improvements. The submission finish should be reserved for optimal situations where the angle is perfect, the control is dominant, and the application can be slow and safe. You should finish training sessions with training partners who respect your technical ability with the kimura system and trust your safety awareness completely. This reputation is worth infinitely more than any tap you could force with dangerous pressure."

**Controlled Application**:
> "The kimura from guard attacks the shoulder joint through rotational pressure. The shoulder is the most mobile joint in the human body, which makes it the most vulnerable to injury. Rotator cuff tears often require surgery and 6-12 months of recovery. Shoulder dislocations create chronic instability and frequently end athletic careers. Apply rotational pressure progressively over 5 to 7 seconds minimum in training. You should feel the position locking - the figure-four grip, the perpendicular angle, the elbow tight to your body, then the slow internal rotation. Each element builds on the last. If you find yourself jerking or spiking to finish, your setup needs improvement - never compensate for poor positioning with dangerous application speed. The kimura system offers sweeps, back takes, and transitions. Use those options. Reserve the finish for optimal situations only."

**Partner Respect**:
> "Every time a training partner allows you to practice the kimura, they are literally putting their shoulder joint and their BJJ career in your hands. The shoulder is a fragile structure - four small rotator cuff muscles and a thin capsule are all that stabilize the most mobile joint. Your technique forces internal rotation that these structures cannot safely resist. This creates serious injury risk if you're careless. Your partner trusts that you won't cause career-ending injury. Honor that trust. Release immediately when you feel the tap. Check on them after - watch them move their shoulder, ask about pain. This is how you build a reputation as someone everyone wants to train with. The best training partners in the world are known not just for their technical skill, but for their safety consciousness and respect for partners."

**Learning Focus**:
> "You will learn more about the kimura from guard by achieving the locked position with perfect angle and then exploring the system - sweeps, back takes, transitions - than you will ever learn from finishing explosively. When you rush to the finish, you miss the larger strategic picture. The kimura grip is a control position that unlocks multiple offensive options. Build the habit of systematic exploration now, and you'll develop a complete kimura game that's more effective than just the submission. The finish will come naturally when needed, but the system development is what creates high-level offense from guard. Study Danaher's approach - control, position, system, then submission if optimal. This builds better jiu-jitsu and keeps everyone safe."

**Injury Prevention**:
> "Smart training partners who apply submissions safely, especially shoulder locks, have long successful training careers. They're welcomed at every gym, they have dozens of willing training partners, and they progress quickly because everyone wants to train with them. Reckless training partners who apply kimuras dangerously have short training careers. They run out of partners, develop bad reputations, and eventually quit or get banned. Choose which type you want to be. With the kimura specifically, your safety habits matter more than with almost any other technique - shoulder injuries often require surgery, have long recovery times, and frequently result in permanent limitations. I've seen training partners whose careers ended because someone applied a kimura too fast. Don't be that person. Develop safe habits now and they'll serve you throughout your entire BJJ journey. Your reputation as a safe, technical training partner is your most valuable asset."

## SEO Content

### Meta Description Template
"Master kimura from guard in BJJ. Complete guide covering safe setup from closed guard, figure-four grip, execution mechanics, defenses, and injury prevention. Learn proper rotational pressure, tap signals, and release protocol. Step-by-step instructions with expert insights from Danaher, Gordon Ryan, and Eddie Bravo."

### Schema.org HowTo Markup (Embedded in YAML)
```yaml
schema_type: "HowTo"
estimated_time: "PT7M"
difficulty: "Intermediate"
supply_needed: ["Gi or No-Gi", "Mat space", "Training partner", "Instructor supervision"]
```

**Steps Derived**:
1. Establish closed guard with posture broken
2. Control opponent's wrist when they post hand
3. Thread arm under opponent's upper arm
4. Lock figure-four grip (hand to own wrist)
5. Open guard and create perpendicular angle
6. Pull opponent's elbow tight to your body
7. Guide their hand toward your hip
8. Apply slow internal rotation over 5-7 seconds
9. Watch for tap signal continuously
10. Release immediately and check shoulder

### Target Keywords
- **Primary**: "kimura from guard", "bjj kimura from guard", "kimura guard technique"
- **Secondary**: "double wristlock from guard", "how to do kimura from closed guard", "kimura setup from guard"
- **Long-tail**: "kimura from guard defense", "kimura from guard tutorial", "kimura guard safety", "figure four grip from guard", "kimura shoulder lock from guard"
- **Variations**: "ude garami from guard", "reverse shoulder lock", "kimura trap system"

### Internal Linking (Minimum 3-5)
- [[Closed Guard Bottom]] (S015) - primary setup position
- [[Kimura Trap]] - control system and position
- [[High Guard]] - alternative setup position
- [[Kimura Defense - Hitchhiker]] - main defensive counter
- [[Hip Bump Sweep]] - related technique and setup opportunity
- [[Kimura Sweep]] - offensive option from same grip
- [[Back Take from Kimura]] - transition option
- [[Shoulder Lock Safety]] - injury prevention principles
- [[Figure-Four Grip Theory]] - grip mechanics education

---

## Additional Resources

**Video Reference** (conceptual - not actual links):
- "Kimura from Guard Mechanics" - Danaher detailed breakdown
- "Kimura System from Guard" - Multiple offensive options
- "Competition Kimura Setups" - Gordon Ryan competition footage
- "Kimura Trap System" - Eddie Bravo 10th Planet approach
- "Kimura Safety and Release Protocol" - Safe training practices

**Related Reading**:
- [[Submission Safety Protocols]] - Academy-wide safety standards
- [[Shoulder Lock Physiology]] - Medical understanding of shoulder injury
- [[Tap Early Tap Often]] - Training philosophy and ego management
- [[Guard Bottom Theory]] - Positional framework and attacking principles
- [[Figure-Four Grip Applications]] - Multiple uses of kimura grip

---

## Version History

**V2.0** (2025-10-13): Initial creation using Submission Standard V2
- Complete YAML frontmatter with all fields
- LLM context block for AI consumption
- Enhanced safety focus throughout all sections (CRITICAL damage potential)
- Progressive loading mechanics detailed
- Training progression expanded to 6 phases (longer than most due to injury severity)
- 6 knowledge questions including safety-critical items
- Complete audio/narration elements for game integration
- SEO optimization with schema markup
- Emphasis on kimura as control system, not just submission
- Detailed injury awareness and prevention protocols

---

## License & Usage

This content is part of the BJJGraph knowledge base. Free for educational use. When citing, please reference: "BJJGraph - Kimura from Guard (SUB211)"

**Training Usage**: This document may be used for instructor reference, student education, and safe training protocol development. Academies are encouraged to adapt safety protocols to their specific needs while maintaining core principles. Given the serious injury potential of kimura, extra emphasis on safety protocols is strongly recommended.

**AI/Game Usage**: This structured data is optimized for AI consumption and game engine integration. The YAML frontmatter and LLM context blocks provide machine-readable data for probabilistic state machine processing.

---

*Remember: The best submission is the one your partner taps to safely, learns from, and wants to train with you again tomorrow. With kimura from guard, this principle is especially critical - shoulder injuries often require surgery and can end careers. Control, system development, and safety are more important than the finish.*
