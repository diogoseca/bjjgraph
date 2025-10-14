---
# Core Identifiers
title: "Heel Hook | Joint Lock | BJJ Graph"
submission_id: "SUB100"
alternative_names: ["Outside Heel Hook", "Inside Heel Hook", "Heel Lock"]
submission_category: "Joint Lock"
submission_type: "Leg Lock"
target_area: "Ankle, knee, and lower leg ligaments"

# State Machine Properties
starting_state: "S090"
starting_position_name: "Ashi Garami"
ending_state: "Terminal - Won by Submission"
is_terminal: true

# Success Probability by Skill Level
success_rate:
  beginner: 15
  intermediate: 35
  advanced: 60

# Submission Properties
setup_complexity: "High"
execution_speed: "Fast"
escape_difficulty: "High"
damage_potential: "CRITICAL"

# SAFETY CONSIDERATIONS (MANDATORY)
safety:
  injury_risks:
    - "Knee ligament tears (ACL, MCL, LCL, PCL)"
    - "Ankle ligament rupture"
    - "Meniscus tears"
    - "Achilles tendon damage"
    - "Lower leg fractures (rare but possible)"
  risk_level: "CRITICAL"
  application_speed: "EXTREMELY SLOW and progressive - 5-7 seconds minimum in training"
  tap_signals: ["Verbal tap REQUIRED", "Physical tap (hand/foot)", "Verbal 'tap tap tap'"]
  release_protocol: "Immediately release rotational pressure, straighten leg, open guard, check partner"
  minimum_skill_level: "Advanced with instructor supervision"
  training_restrictions:
    - "NEVER drill at competition speed - instructor present mandatory"
    - "Partner must understand injury severity and tap early"
    - "No live rolling without 6+ months leg lock experience"
    - "Verbal tap signal agreed upon before drilling"
    - "Stop immediately if ANY discomfort reported"

# Prerequisites for Safe Attempt
prerequisites:
  position_control: "Ashi Garami or Saddle with leg fully controlled"
  setup_requirements:
    - "Heel secured in armpit or hand grip"
    - "Knee line controlled"
    - "Hip positioning correct"
    - "Opponent's leg fully extended"
    - "Partner aware of heel hook danger"
    - "Clear tap signal established"
  opponent_vulnerability: "Leg entangled with limited mobility"
  technical_skill_level: "Advanced - this is NOT a beginner technique"

# Schema.org Integration (SEO)
schema_type: "HowTo"
estimated_time: "PT7M"
difficulty: "Advanced"
supply_needed: ["No-Gi preferred", "Mat space", "Experienced training partner", "Instructor supervision"]

# Tags for classification
tags:
  - submission
  - joint_lock
  - nogi
  - lower_body
  - safety_critical
  - advanced_only
  - competition_restricted

# Related Content (Wikilinks)
related_positions:
  - "[[Ashi Garami]]"
  - "[[Saddle Position]]"
  - "[[Single Leg X Guard]]"
related_transitions:
  - "[[Ashi Garami Entry]]"
  - "[[Saddle Entry]]"
related_defenses:
  - "[[Heel Hook Defense - Hide Heel]]"
  - "[[Leg Lock Escape]]"

# Metadata
date_created: "2025-10-12"
date_updated: "2025-10-12"
author: "BJJGraph System"
version: "2.0"
---

## LLM Context: Submission Data Structure

**Purpose**: Heel Hook is one of the most dangerous submissions in BJJ, capable of causing career-ending injuries in seconds. This is a terminal state in the BJJ state machine. Success results in immediate match victory OR catastrophic injury. Safety is absolutely paramount.

**Setup Requirements Checklist**:
- [ ] Starting position: [[Ashi Garami]] (S090) or [[Saddle Position]] established
- [ ] Position control quality: Dominant with full leg control
- [ ] Required grips: Heel secured in armpit or cup grip
- [ ] Angle optimization: Hip positioning correct for break mechanics
- [ ] Opponent vulnerability: Leg fully entangled and extended
- [ ] Space elimination: Knee line controlled, rotation isolated
- [ ] Timing recognition: Opponent's leg positioned for safe practice only
- [ ] Safety verification: Partner aware of extreme danger, verbal tap agreed

**Defense Awareness**:
- Early defense (entanglement established, no heel grip): 70% escape success
- Mid defense (heel grip established, no rotation): 40% escape success
- Late defense (rotation initiated): 10% escape success - TAP IMMEDIATELY
- Inevitable submission: 0% escape → MUST TAP - injuries happen in 1-2 seconds

**Safety Q&A Patterns**:
Q: "How fast should pressure be applied?"
A: "EXTREMELY SLOW in training. 5-7 seconds minimum. Competition speed only in high-level competition with ref present. Injuries occur in 1-2 seconds with fast application."

Q: "What are the tap signals?"
A: "Verbal tap REQUIRED as primary signal - heel hooks often trap both hands. Physical tap with hand/foot secondary. Partner must tap immediately when rotation begins."

Q: "What if my partner doesn't tap?"
A: "STOP IMMEDIATELY if: partner screams, leg makes popping sound, partner goes limp, ANY sign of injury. You are responsible for partner's safety - your ego is not worth their knee."

Q: "What are the injury risks?"
A: "Complete ACL/MCL/LCL tears, meniscus rupture, ankle ligament destruction, potential career-ending damage. Multiple ligaments can tear simultaneously. Recovery: 6-12 months surgery + rehab."

**Decision Tree for Execution**:
```
IF position_quality >= 90% AND heel_secured AND partner_experienced_with_heel_hooks:
    → Practice setup only (Success Rate: [skill_level]%)
    → NEVER finish in training
ELIF opponent_defending AND early_window:
    → Release and reset (preserve partner safety)
ELIF rotation_applied AND tap_received:
    → RELEASE INSTANTLY - zero delay tolerance
ELSE:
    → Maintain position, DO NOT apply rotation
    → This is practice for positioning, not finishing
```

## ⚠️ SAFETY NOTICE - READ BEFORE PROCEEDING

**THIS SUBMISSION CAN END CAREERS AND CAUSE PERMANENT DISABILITY IF APPLIED IMPROPERLY.**

**CRITICAL WARNINGS:**
- **Injury Risks**: ACL/MCL/LCL tears, meniscus rupture, ankle ligament destruction, multi-ligament knee damage
- **Injury Speed**: Catastrophic damage occurs in 1-2 seconds with fast application
- **Application Speed**: EXTREMELY SLOW in training (5-7 seconds minimum), NEVER at competition speed
- **Recovery Time**: 6-12+ months with surgery and rehabilitation
- **Career Impact**: Many athletes never return to pre-injury performance level
- **Tap Signals**: VERBAL TAP PRIMARY - "tap tap tap" loudly, physical tap secondary
- **Training Requirement**: Advanced practitioners only with instructor supervision mandatory
- **Never**: Apply rotational pressure at competition speed in training
- **Never**: Practice with beginners or inexperienced partners
- **Never**: Finish the technique in drilling - position only

**REMEMBER**: Your training partner is trusting you with their athletic career and long-term mobility. One mistake can end their BJJ journey permanently. Heel hooks are practiced for understanding positioning and defense - not for finishing in training.

**Belt Restrictions**:
- **White/Blue Belt**: Heel hooks illegal in competition and training
- **Purple Belt**: Legal in some no-gi competitions, extreme caution in training
- **Brown/Black Belt**: Legal in most no-gi competitions, still dangerous in training

## Overview

The Heel Hook is the most controversial and dangerous submission in Brazilian Jiu-Jitsu and submission grappling. It attacks multiple ligaments of the knee and ankle simultaneously through rotational force applied to the heel. When properly applied, the heel hook places extreme torsion on the knee joint, potentially tearing the ACL, MCL, LCL, PCL, and meniscus in a matter of seconds - often before the victim feels pain significant enough to tap.

The technique's danger comes from three factors: (1) the knee has limited rotational capacity and ligaments tear before significant pain occurs, (2) the submission can be applied very quickly, and (3) once ligaments begin tearing, damage escalates rapidly. Unlike chokes where you lose consciousness and wake up, or joint locks where you feel immediate pain, heel hooks can cause career-ending damage before the defender recognizes the danger.

From [[Ashi Garami]] (S090) or [[Saddle Position]], the heel hook is executed by controlling the opponent's leg, securing the heel against your body, and rotating your entire torso while extending the leg. The combination of rotation and extension creates overwhelming force on the knee's ligament structure.

### Submission Properties

From [[Ashi Garami]] (S090):

**Success Rates**:
- Beginner: 15% (should not attempt - risk too high)
- Intermediate: 35% (with proper supervision only)
- Advanced: 60% (still requires extreme caution)

**Technical Characteristics**:
- **Setup Complexity**: High - requires advanced positional control
- **Execution Speed**: Fast - can finish in 1-2 seconds (competition)
- **Escape Difficulty**: High - very limited escape options once heel is secured
- **Damage Potential**: CRITICAL - career-ending injuries possible
- **Target Area**: Knee ligaments (ACL, MCL, LCL, PCL), meniscus, ankle

## Visual Finishing Sequence

With the opponent's heel secured in your armpit or cupped in your hands, their leg fully extended and controlled between your legs, you initiate slow rotation of your entire torso while maintaining connection to their leg. Your opponent feels increasing pressure building in their knee joint as rotational force accumulates. The knee begins to twist against its natural range of motion.

Recognizing the extreme danger and feeling pressure (but possibly not significant pain yet), your opponent taps repeatedly and verbally: "TAP TAP TAP!" You IMMEDIATELY cease all rotation, straighten their leg to neutral, release the heel, and open your legs to free their leg completely. You check with your partner: "You okay? Any pain?" and watch for signs of injury.

**Body Positioning**:
- **Your position**: On your side or back, opponent's leg controlled between your legs, heel secured against your body, hips tight to their hip, upper body prepared to rotate
- **Opponent's position**: Leg extended and trapped, hip controlled, heel exposed and secured, knee in vulnerable rotational position
- **Key pressure points**: Rotational force applied to entire knee joint structure, emphasis on lateral and medial ligaments
- **Leverage creation**: Full body rotation against immobilized leg creates massive rotational torque on knee

## Setup Requirements

Conditions that **must** be satisfied before attempting:

1. **Position Establishment**: [[Ashi Garami]] (S090) or [[Saddle Position]] with complete leg control and proper angle

2. **Control Points**:
   - Opponent's leg extended and trapped between your legs
   - Opponent's hip controlled to prevent escape
   - Opponent's knee line controlled (knee pointing correct direction)
   - Your legs actively squeezing and controlling their leg
   - Heel fully secured and isolated

3. **Angle Creation**:
   - Your hips positioned correctly relative to their hip
   - Correct leg entanglement for optimal break mechanics
   - Upper body positioned to generate rotation
   - Opponent's toes pointing appropriate direction for finish

4. **Grip Acquisition**:
   - Heel secured in armpit (most common) OR
   - Two-handed cup grip on heel OR
   - Figure-four grip on heel (advanced variation)
   - Grips must be completely secure before any rotation

5. **Space Elimination**:
   - No space between your body and their leg
   - Knee line controlled - opponent cannot turn knee away
   - Their foot cannot hide or turn away from finish
   - Hip pressure preventing their escape

6. **Timing Recognition**:
   - This technique should ONLY be practiced at advanced levels
   - Partner must be experienced with heel hooks and understand danger
   - Both practitioners must agree on tap signals before starting
   - Instructor supervision mandatory

7. **Safety Verification**:
   - Partner verbally confirms understanding of heel hook danger
   - Clear tap signal agreed upon (verbal tap preferred)
   - Both practitioners agree to SLOW application only
   - Instructor present and watching
   - Emergency stop protocol established

**Position Quality Required**: Ashi Garami or Saddle must be fully established with near-perfect control. Attempting heel hooks from transitional or loose positions dramatically increases injury risk.

## Execution Steps

**SAFETY REMINDER**: In training, practice positioning only. Apply rotational pressure EXTREMELY SLOWLY if at all. Watch for tap continuously. Verbal tap signal is primary.

### Step-by-Step Execution

1. **Initial Position** (Setup Phase)
   - Establish [[Ashi Garami]] with opponent's leg fully controlled
   - Secure proper leg entanglement - their leg between yours
   - Control their hip to prevent rotation
   - Safety check: Verify partner understanding and tap signals

2. **Heel Acquisition** (Grip Phase)
   - Secure opponent's heel with armpit grip (most common) or cup grip
   - Ensure heel is completely controlled - cannot slip free
   - Maintain tight connection with entire leg
   - Partner check: "Ready? Remember to tap early."

3. **Position Optimization** (Alignment Phase)
   - Fine-tune hip position relative to their hip
   - Ensure their leg is extended (critical for break mechanics)
   - Check knee line - knee must be pointing correct direction
   - Confirm your legs are actively controlling their leg
   - Speed: Take 2-3 seconds for perfect positioning

4. **TRAINING PROTOCOL - STOP HERE**
   - In training, this is the completion point
   - Hold position for 1-2 seconds
   - Release slowly and safely
   - Reset and repeat positioning practice
   - **DO NOT PROCEED TO ROTATION IN TRAINING**

5. **Competition/Advanced Training Only - Rotation Initiation** (Entry Phase)
   - Begin SLOW rotation of entire torso
   - Rotation should take 5-7 seconds minimum in training
   - Partner should tap at first sensation of pressure
   - Watch for: Verbal tap, hand tap, ANY distress signal
   - If no tap by 3 seconds, STOP and check partner

6. **Competition Only - Progressive Rotation** (Execution Phase)
   - Continue rotation until tap or completion
   - In competition with referee, continue to finish
   - Partner MUST tap when pressure begins
   - Monitor: Listen for verbal tap, watch for movement changes
   - Total time: In competition, 1-3 seconds is typical

7. **Submission Recognition & Release** (CRITICAL Safety Phase)
   - FEEL/HEAR TAP: Verbal tap or physical tap
   - **RELEASE INSTANTLY - ZERO DELAY**:
     - Stop all rotation immediately
     - Straighten their leg to neutral position
     - Release heel completely
     - Open your legs to free their leg
   - Post-submission: "You okay? Any pain? Can you walk?"
   - Watch for: Limping, inability to bend knee, swelling, pain
   - If ANY sign of injury: Stop training, ice, elevate, seek medical attention

**CRITICAL**: The difference between a safe training partner and a dangerous one with heel hooks is milliseconds of reaction time. Release MUST be instant upon tap.

## Anatomical Targeting & Injury Awareness

### Primary Target
- **Anatomical Structure**: ACL (anterior cruciate ligament), MCL (medial collateral ligament), LCL (lateral collateral ligament), PCL (posterior cruciate ligament), meniscus
- **Pressure Direction**: Rotational force applied to heel creates internal or external rotation of tibia relative to femur
- **Physiological Response**: Ligaments begin tearing as rotation exceeds knee's natural range of motion, often before significant pain

### Secondary Effects
- **Ankle ligaments**: Can be damaged by heel grip and rotation
- **Achilles tendon**: Can be stressed by heel position
- **Knee capsule**: Can be torn by excessive rotation
- **Cartilage**: Can be damaged along with ligaments

### INJURY RISKS & PREVENTION

**Potential Injuries**:
- **ACL Tear**: Complete rupture possible in 1-2 seconds, 6-9 months recovery with surgery
- **MCL Tear**: Grade 1-3 tear possible, 4-8 weeks to 6+ months recovery depending on severity
- **LCL Tear**: Less common but possible, similar recovery to MCL
- **PCL Tear**: Rare with heel hooks but possible with certain angles
- **Meniscus Tear**: Medial or lateral meniscus can tear, may require surgery
- **Multi-ligament Injury**: ACL + MCL tears common together, 9-12+ months recovery
- **Ankle Ligament Damage**: Depending on grip and position
- **Permanent Instability**: Even after surgery, knee may never be the same
- **Career-Ending**: Many competitors never return to same performance level

**Prevention Measures**:
- Apply rotational pressure EXTREMELY SLOWLY in training (5-7 seconds)
- Partner must tap at FIRST sensation of discomfort
- NEVER "spike" or rotate explosively
- Practice positioning, not finishing
- Drill with instructor supervision only
- Only practice with experienced partners who understand danger
- Establish verbal tap as primary signal
- Stop immediately if partner shows any distress
- Never practice with beginners or intermediate practitioners
- Avoid live rolling heel hooks until 6+ months leg lock experience

**Warning Signs to Stop IMMEDIATELY**:
- ANY verbal indication of discomfort
- Partner's leg makes any sound (popping, cracking)
- Partner cannot move leg normally after release
- Partner favors leg or limps after technique
- Swelling appears in knee area
- Partner reports pain anywhere in knee or ankle
- ANY uncertainty about partner's safety
- Partner seems hesitant or fearful

**POST-TRAINING CHECK**:
After ANY heel hook practice:
- Check partner can walk normally
- Check full range of motion in knee
- Check for any swelling
- Check for any pain with gentle rotation
- If ANY abnormality: Stop training, RICE protocol, medical evaluation

## Opponent Defense Patterns

### Common Escape Attempts

Defensive responses with success rates and safety windows:

**Early Defense** (Entanglement not secure, before heel grip)
- [[Hide Heel Defense]] → [[Defensive Position]] (Success Rate: 70%, Window: 2-3 seconds)
- Defender action: Keep heel hidden, foot turned away, knee protection maintained
- Attacker response: Work to expose heel, may transition to other leg attacks
- Safety note: Best time to escape - submission not yet threatening

**Hand Fighting** (Entanglement secure, heel grip being established)
- [[Block Heel Grip]] → [[Defensive Recovery]] (Success Rate: 40%, Window: 1-2 seconds)
- Defender action: Use hands to block heel grip, turn knee away, straighten leg
- Attacker response: Secure heel grip before defense succeeds
- Safety note: Second-best window - must defend aggressively

**Technical Escape** (Heel grip established, rotation not yet applied)
- [[Emergency Heel Hook Escape]] → [[Game Over Position]] (Success Rate: 15%, Window: <1 second)
- Defender action: Inside slip or technical leg extraction
- Attacker response: Apply rotation immediately or lose position
- Safety critical: LAST safe moment to escape - if this fails, tap immediately

**Inevitable Submission** (Rotation applied, knee under stress)
- [[Tap Out]] → Terminal State (Success Rate: 0% escape)
- **Defender must**: TAP IMMEDIATELY - VERBAL AND PHYSICAL
- **Critical**: Do not wait for pain - ligament damage occurs before pain
- **Attacker must**: RELEASE INSTANTLY upon tap
- Safety principle: NO SHAME IN TAPPING - your knee health is permanent, your ego is temporary

### Defensive Decision Logic

```
If [entanglement loose] AND [heel not exposed]:
- Execute [[Hide Heel Defense]] (Success Rate: 70%)
- Window: 2-3 seconds
- Keep heel hidden, defend position, work to escape

Else if [heel grip being established] but [not secured]:
- Execute [[Block Heel Grip]] (Success Rate: 40%)
- Window: 1-2 seconds
- Hand fight aggressively, turn knee away

Else if [heel secured] but [no rotation]:
- Execute [[Emergency Escape]] (Success Rate: 15%)
- Window: <1 second
- Technical extraction or tap immediately
- HIGH DANGER - last chance before injury

Else [rotation initiated]:
- Execute [[Tap Out]] (Immediate)
- VERBAL: "TAP TAP TAP"
- PHYSICAL: Tap with hand/foot
- Do not wait for pain - ligaments tear first
- NO HEROICS - tap to save knee
```

### Resistance Patterns & Safety Considerations

- **Strength-Based Resistance**: Trying to muscle out of heel hook
  - Safety concern: Increases rotational force and injury risk dramatically
  - Reality: Strength cannot overcome proper heel hook mechanics
  - Result: Higher injury risk with no escape benefit

- **Ignoring Discomfort**: "Toughing out" initial pressure
  - Safety concern: EXTREMELY DANGEROUS - ligament damage occurs before pain
  - Reality: Knee ligaments have limited pain receptors - you may not feel tear starting
  - Result: Permanent injury before you realize you needed to tap

- **Delayed Tap**: Waiting to see if you can escape
  - Safety concern: Window of safety is measured in fractions of a second
  - Reality: Once rotation reaches certain point, damage is inevitable even if released
  - Result: Injury occurs during the "decision" period

- **Technical Escape Attempt Under Pressure**: Trying advanced escape while rotation applied
  - Safety concern: Movement during rotation increases injury risk
  - Reality: If rotation is applied, escape is too late
  - Result: Catastrophic injury during escape attempt

**CRITICAL TRAINING CULTURE NOTE**:
Heel hooks require absolute trust between partners. Both practitioners must:
- Understand the extreme danger
- Agree to tap early at first discomfort
- Apply pressure SLOWLY if at all
- Release INSTANTLY upon tap
- Check partner safety after every rep
- Never practice at competition speed
- Accept that ego has no place in heel hook training

If you cannot trust your partner or your partner cannot trust you, DO NOT practice heel hooks together.

## Training Progressions & Safety Protocols

Safe learning pathway emphasizing understanding and prevention:

### Phase 1: Theoretical Understanding (Weeks 1-4)
- Study heel hook mechanics without partner
- Watch instructional content from qualified instructors
- Understand knee anatomy and ligament structure
- Learn exactly how heel hooks cause injuries
- Study tap signals and release protocols
- Watch competition footage (noting taps and injuries)
- Learn defensive hiding positions
- **No physical practice**
- **Required**: 6+ months BJJ experience before beginning

### Phase 2: Defense First (Weeks 5-8)
- Learn heel hook defense and hiding techniques
- Practice keeping heel hidden against attacks
- Understand escape windows and timing
- Drill hand fighting and heel protection
- Partner applies zero pressure - position only
- Build defensive reflexes
- Learn to recognize danger early
- **No offensive heel hook practice yet**

### Phase 3: Slow Position Practice (Weeks 9-16)
- Begin learning offensive positioning with experienced partner
- Instructor supervision mandatory for every session
- Partner provides zero resistance
- Practice leg entanglement and control only
- Practice heel grip acquisition only
- NO rotation applied whatsoever
- Focus: Perfect positioning and control
- Speed: EXTREMELY SLOW (15+ seconds per rep)
- Partner "taps" at heel grip establishment
- Practice release protocol every single rep

### Phase 4: Controlled Pressure Introduction (Weeks 17-24)
- With instructor supervision only
- Partner provides mild resistance to entries
- Practice heel grip against light defense
- Introduction of minimal rotational pressure (10-20% max)
- Partner taps at first sensation of pressure
- Speed: VERY SLOW (10+ seconds)
- Emphasis remains on control, not finishing
- Build awareness of pressure application
- Every rep ends with partner confirmation: "You okay?"

### Phase 5: Advanced Training Integration (6+ months experience)
- Light rolling integration with very experienced partners only
- Establish clear rules before rolling: heel hooks yes/no, tap early mandatory
- Apply pressure at 30-50% maximum in training
- Speed: Still SLOW (5-7 seconds)
- Competition speed reserved for actual competition
- Reputation as safe partner is paramount
- Continue checking partner after every application

### Phase 6: Competition Application (Advanced competitors only)
- High-level competition with qualified referee
- Full-speed application permitted in competition context
- Opponent is also high-level with heel hook experience
- Referee trained to recognize danger and stop match
- Even in competition, release immediately upon tap
- Post-match: Check opponent welfare

**CRITICAL**: Heel hooks require 6-12+ months of dedicated leg lock training before live application. Rushing this progression has ended countless athletic careers. Most academies prohibit heel hooks entirely for safety reasons.

## Expert Insights

### John Danaher Perspective
> "The heel hook is the most efficient lower body submission because it attacks the structural integrity of the knee joint itself through rotation against a joint that has minimal rotational capacity. The knee is a hinge joint - it flexes and extends beautifully, but rotation is severely limited by the cruciate ligaments. When you apply rotational force to the heel while controlling the hip, you create a situation where the tibia rotates relative to the femur, and the ligaments must tear. The mechanics are simple and devastating. In training, your goal is to understand the position where this rotation becomes possible and to achieve perfect control. The actual finish should almost never occur in training. Your partner's ACL is not worth practicing your finish. The mark of expertise with heel hooks is not how fast you can finish - it's how perfectly you can achieve the position while maintaining absolute safety. Release immediately upon tap. Check your partner after every repetition. The community has seen too many careers end in training rooms because of ego and impatience with this technique."

**Key Technical Detail**: Hip control + heel control + rotation = knee destruction. Perfect position makes finish inevitable.

**Safety Emphasis**: Danaher's systematic approach emphasizes understanding the position so thoroughly that you know when the finish is available without needing to apply it. Advanced students can achieve the position and hold it without rotation.

### Gordon Ryan Perspective
> "I've finished dozens of heel hooks in competition. I've practiced thousands in training. The difference? In competition, I finish in 1-2 seconds once I have the position. In training, I never finish at all - I get the position, hold it, and let go. People don't understand: heel hooks don't hurt until it's too late. You feel pressure, maybe some discomfort, but the pain doesn't match the damage until ligaments are already tearing. I've seen guys try to tough out heel hooks and end up with ACL+MCL tears before they even thought about tapping. In my training room, heel hooks are practiced very slowly, with clear communication, and we tap at the slightest pressure. If you can't train heel hooks safely, you don't train them at all. My success in competition comes from position mastery and thousands of reps done slowly and safely. When competition comes, the finish is automatic because I've achieved the position so many times. But my training partners all have healthy knees because we respect the technique."

**Competition Application**: Ryan's success comes from positional mastery, not dangerous training

**Training Modification**: Position practice with minimal to zero finishing pressure. Save real finishing for competition.

### Eddie Bravo Perspective
> "The heel hook is the nuclear option of leg locks. In my system, we take leg locks seriously - they're a huge part of the game. But heel hooks require a different level of respect than anything else. At 10th Planet, you don't train heel hooks until you've trained leg locks for at least a year. You don't practice them without an instructor watching. You don't practice them with people you don't trust completely. And you never, ever finish them in training. I've been doing this for decades and I've never finished a heel hook on a training partner - the position, yes, the finish, no. The goal is to get so good at achieving the position that the finish becomes theoretical knowledge you possess but never need to demonstrate. In competition, heel hooks are powerful and effective. In training, they're a tool for understanding position and developing defense. If your ego needs you to finish training partners with heel hooks, your ego is going to end someone's career. And that person won't train with you anymore, and neither will anyone else who hears about it."

**Innovation Focus**: Comprehensive leg lock systems with heavy emphasis on safe practice protocols

**Safety Non-Negotiable**: 10th Planet culture requires extensive experience and trust before heel hook practice. Finishing in training is forbidden.

## Common Errors

### Technical Errors

**Error 1: Insufficient Hip Control**
- Mistake: Securing heel without controlling opponent's hip
- Why it fails: Opponent can rotate entire body, reducing pressure and escaping
- Correction: Establish hip control first, then work to heel - never reverse this order
- Safety impact: Loose position leads to explosive finishing attempts, increasing injury risk

**Error 2: Wrong Leg Entanglement**
- Mistake: Improper leg positioning or crossing ankles incorrectly
- Why it fails: Reduces control and mechanical advantage, allows escapes
- Correction: Study proper ashi garami or saddle mechanics, ensure correct leg triangle
- Safety impact: Compensating for poor position with force increases danger

**Error 3: Heel Grip Slipping**
- Mistake: Inadequate heel security, allowing foot to slip
- Why it fails: Cannot apply rotation effectively if heel can move
- Correction: Armpit grip or tight cup grip with proper wrist positioning, zero space
- Safety impact: Attempting to finish with slipping heel causes sudden pressure changes

**Error 4: Rotating with Hands Instead of Body**
- Mistake: Trying to twist heel with arm strength
- Why it fails: Insufficient power, poor control, telegraphs finish
- Correction: Secure heel to body, rotate entire torso and hips as single unit
- Safety impact: Arm rotation is jerky and unpredictable, increasing injury risk

**Error 5: Leg Not Fully Extended**
- Mistake: Attempting finish with opponent's knee bent
- Why it fails: Bent knee has more rotational freedom, reduces effectiveness
- Correction: Extend opponent's leg completely before any rotation
- Safety impact: Applying rotation to bent leg can cause damage in unexpected ways

### SAFETY ERRORS (CRITICAL)

**DANGER: Competition Speed in Training**
- Mistake: Applying heel hook at competition speed (1-2 second finish) in training
- Why dangerous: NO time for partner to recognize danger and tap
- Injury risk: COMPLETE ACL/MCL TEAR, multi-ligament damage, career-ending injury
- Correction: 5-7 seconds MINIMUM in training, position-only practice preferred
- **This has ended more careers than any other heel hook error**

**DANGER: Finishing in Training**
- Mistake: Applying full rotational pressure to completion in training
- Why dangerous: Training partners are not defending at competition intensity
- Injury risk: Catastrophic knee damage, permanent instability
- Correction: Achieve position, hold briefly, release - NEVER finish in training
- **No training tap is worth your partner's ACL**

**DANGER: Ignoring Verbal Tap**
- Mistake: Continuing rotation after verbal tap (partner yells "TAP")
- Why dangerous: Hands may be trapped, verbal tap may be only option
- Injury risk: Injury occurs during delay between verbal tap and release
- Correction: Verbal tap is INSTANT release, no hesitation, no verification needed
- **Verbal tap is absolute - release immediately**

**DANGER: Not Checking Partner After**
- Mistake: Releasing heel hook and continuing to train without partner check
- Why dangerous: Knee injuries may not be apparent immediately, adrenaline masks pain
- Injury risk: Continuing training with damaged ligaments causes additional damage
- Correction: After EVERY heel hook practice, ask "You okay? Any discomfort? Walk around."
- **Watch for limping, favoring leg, reduced range of motion**

**DANGER: Practicing with Inexperienced Partners**
- Mistake: Practicing heel hooks with beginners or intermediate practitioners
- Why dangerous: Partner doesn't understand injury mechanism, may tap late or not at all
- Injury risk: Partner gets injured due to ignorance of danger
- Correction: Only practice with advanced practitioners who have 6+ months leg lock experience
- **Your partner's experience level is your responsibility too**

**DANGER: No Instructor Supervision**
- Mistake: Practicing heel hooks without qualified instructor present
- Why dangerous: No one to intervene if situation becomes unsafe
- Injury risk: Technique creep toward faster, more dangerous application
- Correction: Instructor supervision mandatory until brown/black belt minimum
- **Most academy insurance policies prohibit unsupervised heel hook training**

**DANGER: Ego-Driven Application**
- Mistake: Trying to "get" training partner with unexpected heel hook in scramble
- Why dangerous: Partner unprepared, no clear communication, surprise application
- Injury risk: No tap opportunity, injury occurs before partner recognizes attack
- Correction: Heel hooks require mutual consent and awareness, no surprises
- **Surprise heel hooks in training is assault, not sport**

## Variations & Setups

### Primary Setup: Outside Ashi Garami
From [[Ashi Garami]]:
- Standard ashi garami leg entanglement with outside leg controlled
- Heel secured in armpit on same side as controlled leg
- Hip pressure preventing rotation
- Torso rotation creates external rotation of opponent's knee
- Success rate: Beginner 15%, Intermediate 35%, Advanced 60%
- Setup time: 3-5 seconds to secure position
- Safety considerations: Most common and most teachable version

### Alternative Setup 1: Inside Ashi Garami (Inside Heel Hook)
From [[Ashi Garami]]:
- Ashi garami leg entanglement with inside leg controlled
- Heel secured on opposite side, creating inside position
- Rotation creates internal rotation of knee
- Generally considered more powerful but harder to secure
- Best for: High-level leg lock specialists
- Safety notes: Even more dangerous than outside version

### Alternative Setup 2: Saddle Position (4/11/Honey Hole)
From [[Saddle Position]]:
- Both legs entangled, opponent's leg between your legs
- Heel secured with maximum control
- Hip positioning creates optimal break angle
- Highest control position for heel hooks
- Best for: Advanced competitors in no-gi
- Safety notes: Extremely difficult to escape, maximum danger

### Alternative Setup 3: Single Leg X Transition
From [[Single Leg X Guard]]:
- Transition from SLX to ashi garami
- Heel grip established during transition
- Opportunistic finish if opponent defends poorly
- Best for: Guard players with strong leg lock game
- Safety notes: Fast transition requires clear communication

### Chain Combinations

After failed [[Straight Footlock]]:
- Opponent defends footlock by turning knee away
- Heel becomes exposed during defense
- Transition grip from foot to heel
- Adjust position to ashi garami
- Transition cue: Feel opponent's knee turn
- Safety: Ensure position before applying any pressure

After failed [[Kneebar]]:
- Opponent escapes kneebar by pulling leg out
- Leg is still entangled and extended
- Transition to heel grip
- Switch from kneebar mechanics to heel hook position
- Decision point: When kneebar fails, check if heel is available
- Safety: Get clear position before changing submissions

### No-Gi vs Gi Modifications

**No-Gi Version** (Primary):
- Clean leg entanglements without gi material interference
- Grip variations: Armpit, cup grip, figure-four
- Advantages: Faster transitions, more common in competition
- Most heel hook development happens in no-gi
- Safety: Slipperiness requires extra care with heel security

**Gi Version** (Rare):
- Less common due to gi material creating friction
- Can use gi pants for some control assists
- Some grips involve belt or lapel for additional control
- Many gi competitions prohibit heel hooks entirely
- Safety: Gi material can hide pressure buildup, even more dangerous

## Knowledge Assessment

Test understanding before any live application. Minimum 6/6 correct required. If you cannot answer all questions perfectly, you should not practice heel hooks.

### Question 1: Injury Mechanism (Safety Critical)
**Q**: What specific ligaments does a heel hook attack, and why is it more dangerous than other submissions?

**A**:
Heel hooks attack the ACL (anterior cruciate ligament), MCL (medial collateral ligament), LCL (lateral collateral ligament), and potentially PCL and meniscus simultaneously. They are more dangerous than other submissions because:

1. **Limited Pain Warning**: Knee ligaments have relatively few pain receptors - you may not feel significant pain until ligaments are already tearing
2. **Rapid Damage**: Complete ligament rupture can occur in 1-2 seconds with fast application
3. **Multi-Ligament Injury**: Unlike most submissions that attack one structure, heel hooks can tear multiple ligaments at once
4. **Permanent Damage**: ACL tears require surgery and 6-12 months recovery, often never return to pre-injury function
5. **Point of No Return**: Once ligaments begin tearing, release may not prevent complete rupture
6. **Career Ending**: Many athletes never return to same performance level after heel hook injury

**Why It Matters**: Understanding injury mechanism prevents the common mistake of "toughing it out." With heel hooks, if you wait for significant pain, permanent damage may already be occurring.

---

### Question 2: Tap Protocol (Safety Critical)
**Q**: What are the proper tap signals for heel hooks, why is verbal tap primary, and what must you do immediately upon sensing a tap?

**A**:

**Tap Signals for Heel Hooks**:
1. **PRIMARY: Verbal tap** - "TAP TAP TAP" loudly and clearly
2. **Secondary: Physical tap** - Hand or foot tapping on partner, mat, or self
3. **ANY indication of distress** - sounds, sudden movement change, etc.

**Why Verbal Tap is Primary**:
- Heel hook positions often trap both hands
- Opponent may not be able to reach you to tap physically
- Opponent may be focused on defense and unable to free hands
- Verbal tap cuts through any confusion about intention

**Immediate Action Upon Tap**:
1. STOP all rotation instantly (zero delay)
2. Straighten opponent's leg to neutral position
3. Release heel grip completely
4. Open legs to free their leg
5. Move away from leg position
6. Verbally check: "You okay? Any pain?"
7. Watch partner stand and walk to verify no injury
8. If ANY sign of injury: Stop training, RICE protocol, medical evaluation

**Total response time**: Less than 1 second from tap to complete release

**Why It Matters**: Heel hook injuries occur in seconds. Delayed release by even 1-2 seconds can mean the difference between a safe training session and a career-ending injury. Your partner's safety depends on instant release.

---

### Question 3: Training Restrictions (Safety Critical)
**Q**: What experience level is required for heel hook practice, what supervision is mandatory, and what speed should be used in training vs competition?

**A**:

**Experience Requirements**:
- Minimum: Advanced belt level (purple+) with 6+ months dedicated leg lock training
- BJJ experience: 3+ years minimum before any heel hook introduction
- Leg lock experience: Must be proficient with straight footlocks and kneebars first
- Partner experience: Only practice with other advanced practitioners of similar experience
- Never practice with: White belts, blue belts, or anyone uncomfortable with heel hooks

**Mandatory Supervision**:
- Instructor supervision required for all initial practice (first 6+ months)
- Instructor must be qualified leg lock specialist themselves
- Practice limited to times when qualified instructor is actively watching
- Unsupervised practice only at brown/black belt with years of experience
- Many academies require instructor supervision at all times regardless of belt

**Speed Requirements**:

Training (Drilling):
- Setup: 5-10 seconds to establish position
- Application: POSITION ONLY - zero rotation
- If any rotation: 7-10+ seconds, partner taps at first pressure
- Focus: Perfect position, not finishing

Training (Light Rolling):
- Setup: 3-5 seconds
- Application: 5-7 seconds minimum if any pressure
- Max pressure: 30-50% of maximum
- Partner must tap early at first discomfort

Competition (High-Level Only):
- Setup: As fast as position allows (1-3 seconds)
- Application: 1-3 seconds to finish
- Full pressure: Yes, until tap or submission
- Referee monitoring for safety

**Why It Matters**: Speed restrictions and experience requirements exist because heel hook injuries happen to inexperienced practitioners who don't understand the technique's danger. Proper progression prevents injuries.

---

### Question 4: Defense Priority (Tactical)
**Q**: What is the highest-percentage defense against heel hooks, when must it be executed, and at what point is tapping the only option?

**A**:

**Highest-Percentage Defense**: Hide heel and maintain proper knee positioning before entanglement is secure.
- Success rate: 70% if executed early
- Timing: During opponent's entry to leg position, before leg is fully controlled
- Technique: Keep heel hidden (foot turned away from opponent), knee oriented correctly, use frames to prevent full entanglement
- Priority: Do not let opponent isolate your leg

**Critical Defense Windows**:

Early (Before entanglement):
- Defense: Block entry, hide heel, maintain distance
- Window: 2-3 seconds
- Success: 70%

Mid (Entanglement secure, no heel grip):
- Defense: Hand fight heel grip, turn knee away
- Window: 1-2 seconds
- Success: 40%

Late (Heel secured, no rotation):
- Defense: Emergency technical escapes
- Window: <1 second
- Success: 15%
- Critical: Last moment before must tap

**Must Tap Immediately When**:
- ANY rotational pressure begins on heel
- Heel is secured and position is tight
- You feel pressure building in knee
- You recognize position is lost
- Escape attempt failed
- You feel ANY discomfort in knee
- Your experience level says you're caught

**Physical Indicators**:
- Heel completely controlled
- Hip is controlled
- Leg is extended
- Knee line is controlled
- You cannot hide heel
- Pressure beginning in knee joint

**Critical Understanding**: With heel hooks, tap to the POSITION, not the pain. If opponent has perfect position, the finish is mechanical and inevitable. Waiting for pain = waiting for injury.

**Why It Matters**: Heel hook defense must be preemptive. Once position is established, survival depends on tapping before injury, not escaping after rotation begins.

---

### Question 5: Position Requirements (Technical)
**Q**: What position must be established before attempting a heel hook, what are the key control points, and why is proper position more important with heel hooks than other submissions?

**A**:

**Required Position**: [[Ashi Garami]] (S090) or [[Saddle Position]] with near-perfect control

**Key Control Points**:
1. **Leg Entanglement**: Opponent's leg between your legs, proper triangle configuration
2. **Hip Control**: Your legs/hips controlling their hip to prevent rotation
3. **Heel Control**: Heel secured completely (armpit or cup grip) with zero movement
4. **Knee Line**: Opponent's knee controlled and pointed correct direction
5. **Leg Extension**: Opponent's leg fully extended (or ability to extend it instantly)
6. **Hip Position**: Your hips positioned at correct angle relative to opponent's hip
7. **Connection**: No space between your body and their leg

**Position Quality Indicators**:
- Opponent cannot rotate their entire body
- Heel cannot be pulled away
- Knee cannot turn to hide heel
- Leg cannot be bent to reduce pressure
- Opponent's only option is tap or injury

**Why Position is More Critical with Heel Hooks**:

1. **Injury Speed**: Poor position leads to compensating with speed/force, causing injury
2. **Control Requirement**: Heel hook from loose position is most dangerous scenario
3. **Mechanical Precision**: Small position errors reduce effectiveness, tempting force
4. **Safety Margin**: Perfect position = safe application; imperfect position = dangerous application
5. **Partner Trust**: Attempting from poor position betrays trust and risks injury

**Proper Protocol**:
- Achieve perfect position
- Hold position 1-2 seconds
- Assess position quality
- If perfect: minimal pressure or release (training), or finish (competition)
- If imperfect: release and restart, never force from bad position

**Why It Matters**: Other submissions allow some variation in position because they have pain before damage. Heel hooks damage before pain, so position must be perfect before any pressure. Forcing heel hooks from imperfect position causes majority of training injuries.

---

### Question 6: Release Protocol (Safety Critical)
**Q**: Describe the complete release protocol for heel hooks step-by-step, and what must you check after releasing?

**A**:

**Immediate Release Steps** (Total time: <1 second from tap recognition to full release):

1. **Cease All Rotation** (0.0-0.2 seconds)
   - Stop any rotational movement instantly
   - Begin reversing rotation direction to neutral

2. **Straighten Leg** (0.2-0.5 seconds)
   - Actively straighten opponent's leg to neutral position
   - Remove any rotational stress on knee
   - Do not just release - actively return to safe position

3. **Release Heel Grip** (0.5-0.7 seconds)
   - Let go of heel completely
   - Remove hands/arms from heel area
   - Allow foot to move freely

4. **Open Leg Entanglement** (0.7-1.0 seconds)
   - Open your legs to release their leg
   - Move away from entanglement
   - Give space for their leg to withdraw

5. **Create Distance** (1.0-2.0 seconds)
   - Move your body away from their leg
   - Allow them to pull leg back completely
   - Neutral position established

**Post-Release Safety Check** (Mandatory after EVERY repetition):

Immediate Check (0-10 seconds after release):
- Verbal: "You okay? Any discomfort?"
- Visual: Watch their face for pain indicators
- Observe: Do they favor the leg? Wince? Hesitate to move it?

Active Check (10-30 seconds after release):
- Ask partner to bend knee fully
- Ask partner to straighten leg fully
- Ask partner to gently rotate ankle
- Watch for: Limited range of motion, pain, hesitation

Standing Check (30-60 seconds after release):
- Ask partner to stand and walk around
- Watch for: Limping, favoring leg, instability
- Ask: "Can you put full weight on it? Any pain walking?"

If ANY Sign of Problem:
- STOP all training immediately
- RICE protocol: Rest, Ice, Compression, Elevation
- Assess severity:
  - Minor discomfort: Rest, monitor, gentle movement
  - Pain or instability: Stop training for day, monitor
  - Acute pain, swelling, inability to bear weight: Medical evaluation immediately
- Document what happened
- Do not resume heel hook training until full recovery confirmed

**Next Repetition Protocol**:
- Ask: "Ready to continue? Still feeling okay?"
- Verify: Partner confirms no lingering discomfort
- Remind: "Tap early if you feel anything"
- Restart: Only when partner is completely comfortable

**Why It Matters**: Heel hook injuries sometimes don't present immediately - adrenaline masks pain, full damage may not be apparent. Checking after every repetition catches problems before they become serious. The release protocol saves knees and careers.

---

## SEO Content

### Meta Description Template
"Master heel hook technique in BJJ. Advanced guide covering safe setup, position requirements, defenses, and critical injury prevention. Learn proper application speed, tap protocols, and safety requirements. Expert insights from Danaher, Ryan, and Bravo. Advanced practitioners only."

### Target Keywords
- **Primary**: "bjj heel hook", "heel hook technique"
- **Secondary**: "heel hook defense", "heel hook safety", "heel hook tutorial"
- **Long-tail**: "how to safely practice heel hooks", "heel hook injury prevention", "heel hook escapes", "heel hook mechanics"
- **Safety-focused**: "heel hook dangers", "ACL injury prevention bjj", "safe leg lock training"

### Internal Linking
- [[Ashi Garami]] (S090) - primary setup position
- [[Saddle Position]] - alternative setup position
- [[Straight Footlock]] - prerequisite leg lock
- [[Kneebar]] - related submission
- [[Heel Hook Defense - Hide Heel]] - primary defense
- [[Leg Lock Escapes]] - defensive concepts
- [[Submission Safety Protocols]] - academy safety standards

---

## Additional Resources

**Required Reading Before Practice**:
- [[Submission Safety Protocols]] - Academy-wide safety standards
- [[Leg Lock Progressions]] - Safe learning pathway
- [[Tap Early Tap Often]] - Training philosophy
- [[Knee Anatomy and Injury]] - Medical understanding

**Recommended Viewing** (conceptual - not actual links):
- "Heel Hook Mechanics and Safety" - John Danaher instructional
- "Competition Heel Hook Finishing" - Gordon Ryan techniques
- "Heel Hook Defenses" - Lachlan Giles defensive systems
- "Ashi Garami Position Mastery" - Fundamental position training

---

## Version History

**V2.0** (2025-10-12): Initial creation using Submission Standard V2
- Complete YAML frontmatter with all required fields
- LLM context block for AI consumption
- Extreme safety emphasis throughout all sections
- CRITICAL damage potential clearly documented
- 6-phase training progression with strict experience requirements
- 6 knowledge questions all safety-critical
- Comprehensive injury prevention and post-practice protocols
- SEO optimization with schema markup

---

## License & Usage

This content is part of the BJJGraph knowledge base. Free for educational use. When citing, please reference: "BJJGraph - Heel Hook (SUB100)"

**Critical Warning**: This document is for educational purposes. Heel hooks are dangerous techniques that require qualified instruction. Do not attempt heel hooks without proper supervision, experience, and partner consent. The authors and BJJGraph assume no liability for injuries resulting from improper application of information contained herein.

**Training Usage**: This document emphasizes safe training protocols. Academies should establish clear heel hook policies based on their insurance, instructor qualifications, and student experience levels. When in doubt, prohibit heel hooks entirely - the risk is not worth the reward in most training environments.

---

*"The best heel hook is the one that never needs to be finished. Position mastery protects both competitors and training partners."*
