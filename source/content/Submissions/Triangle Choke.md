---
# Core Identifiers
title: "Triangle Choke | BJJ Submission | BJJ Graph"
submission_id: "SUB001"
alternative_names: ["Triangle Strangle", "Sankaku-Jime", "Triangle Hold"]
submission_category: "Choke"
submission_type: "Blood Choke"
target_area: "Carotid arteries and neck"

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
execution_speed: "Medium"
escape_difficulty: "High"
damage_potential: "Medium"

# SAFETY CONSIDERATIONS (MANDATORY)
safety:
  injury_risks:
    - "Loss of consciousness (3-8 seconds)"
    - "Neck strain from improper angle"
    - "Potential neurological issues if held too long"
  risk_level: "Medium"
  application_speed: "SLOW and progressive - 3-5 seconds minimum"
  tap_signals: ["Verbal tap", "Physical tap with free hand", "Physical tap with feet", "Verbal 'tap'"]
  release_protocol: "1) Release leg pressure immediately, 2) Open guard, 3) Move to side to allow blood flow restoration, 4) Monitor partner for 10-15 seconds"
  minimum_skill_level: "Beginner (with supervision)"
  training_restrictions:
    - "Never hold after tap - unconsciousness occurs rapidly"
    - "Partner must have clear tap access with at least one limb"
    - "Instructor supervision required for first 20+ repetitions"
    - "Practice release protocol every single repetition"

# Prerequisites for Safe Attempt
prerequisites:
  position_control: "Closed guard established with posture broken"
  setup_requirements:
    - "One arm trapped across centerline"
    - "Hip angle adjusted for leg positioning"
    - "Leg triangle locked (ankle behind knee)"
    - "Angle created (shoulder to hip line)"
    - "Partner's arm isolated"
    - "Head position controlled"
  opponent_vulnerability: "Posture broken, arm out of position, defensive frames compromised"
  technical_skill_level: "Beginner with supervision; solo practice requires 3+ months experience"

# Schema.org Integration (SEO)
schema_type: "HowTo"
estimated_time: "PT5M"
difficulty: "Intermediate"
supply_needed: ["Gi or No-Gi", "Mat space", "Training partner"]

# Tags for classification
tags:
  - submission
  - choke
  - both
  - upper_body
  - safety_critical
  - guard_bottom

# Related Content (Wikilinks)
related_positions:
  - "[[Closed Guard Bottom]]"
  - "[[High Guard]]"
  - "[[Triangle Control]]"
related_transitions:
  - "[[Hip Bump Sweep]]"
  - "[[Armbar from Guard]]"
related_defenses:
  - "[[Triangle Defense - Posture]]"

# Metadata
date_created: "2025-10-13"
date_updated: "2025-10-13"
author: "BJJGraph Agent System"
version: "2.0"
---

## LLM Context: Submission Data Structure

**Purpose**: Triangle Choke is a blood choke submission from guard positions. It's a terminal state resulting in unconsciousness if held beyond tap. Safety is paramount - this technique can render opponent unconscious in 3-8 seconds.

**Setup Requirements Checklist**:
- [ ] Starting position: [[Closed Guard Bottom]] (S015) established
- [ ] Position control quality: Guard secured with posture broken
- [ ] Required grips: One arm trapped across centerline, head controlled
- [ ] Angle optimization: Hip angle adjusted 45 degrees, shoulder-to-hip line created
- [ ] Opponent vulnerability: Posture compromised, arm positioning error
- [ ] Space elimination: Triangle locked (ankle behind knee), no space under leg
- [ ] Timing recognition: Opponent reaches across centerline or posture breaks

**Defense Awareness**:
- Early defense (setup <70% complete): 60% escape success - maintain posture, pull arm out
- Hand fighting (legs coming up, not locked): 45% escape success - hand fighting, posture restoration
- Technical escape (triangle locked but loose): 30% escape success - stack pass, posture recovery
- Inevitable submission (triangle tight, angle created): 0% escape → TAP IMMEDIATELY

**Safety Q&A Patterns**:
Q: "How fast should pressure be applied?"
A: "SLOW and progressive. Triangle should take minimum 3-5 seconds in training. Partner will feel pressure building gradually. Competition speed only in competition."

Q: "What are the tap signals?"
A: "Verbal 'tap', physical tap with free hand on opponent or mat, physical tap with feet on opponent or mat. If partner's arm is trapped, verbal tap is primary signal."

Q: "What if my partner doesn't tap?"
A: "STOP IMMEDIATELY if: partner goes limp (unconscious), partner's color changes, partner makes gurgling sounds, partner's eyes close. Release and monitor for full consciousness."

Q: "What are the injury risks?"
A: "Loss of consciousness in 3-8 seconds if held after tap. Neck strain if angle is too sharp. Potential neurological complications if held excessively. Always release immediately upon tap."

**Decision Tree for Execution**:
```
IF guard_closed AND opponent_posture_broken AND arm_across_centerline:
    → Attempt triangle setup (Success Rate: [skill_level]%)
ELIF triangle_locked AND angle_created:
    → Apply progressive pressure (3-5 seconds)
    → WATCH FOR TAP CONTINUOUSLY
ELIF tap_signal_received:
    → RELEASE IMMEDIATELY per protocol
    → Monitor partner for consciousness
ELSE:
    → Maintain guard, wait for better opportunity
```

## ⚠️ SAFETY NOTICE

**This submission can cause LOSS OF CONSCIOUSNESS if applied improperly or held after tap.**

- **Injury Risks**:
  - Loss of consciousness (3-8 seconds after full pressure)
  - Neck strain from improper angle
  - Potential neurological issues if held too long
- **Application Speed**: SLOW and progressive. 3-5 seconds minimum from pressure initiation to tap.
- **Tap Signals**: Verbal "tap", physical tap with free hand/feet on opponent or mat
- **Release Protocol**:
  1. Release leg pressure immediately
  2. Open guard completely
  3. Move to side to allow blood flow restoration
  4. Monitor partner for 10-15 seconds to ensure full consciousness
- **Training Requirement**: Beginner level acceptable with instructor supervision
- **Never**: Hold after tap - unconsciousness occurs within seconds

**Remember**: Your training partner trusts you with their safety. The triangle choke affects blood flow to the brain. Respect the tap immediately and monitor your partner after release.

## Overview

The Triangle Choke is one of the most iconic submissions in Brazilian Jiu-Jitsu, executed from guard positions by trapping the opponent's head and one arm inside a leg triangle configuration while excluding the other arm. This blood choke compresses the carotid arteries using the opponent's own shoulder and the practitioner's legs, cutting off blood flow to the brain.

The triangle is highly effective because it uses the powerful leg muscles against the relatively weak neck structure, creating overwhelming mechanical advantage. When properly applied with correct angle, the submission is nearly impossible to escape and results in unconsciousness in 3-8 seconds if the opponent doesn't tap.

From [[Closed Guard Bottom]] (S015), the triangle is typically set up when the opponent makes positional errors with arm placement, particularly reaching across the centerline or driving forward with poor posture. The technique exemplifies the principle of using superior position (guard) to create offensive threats while remaining relatively safe.

### Submission Properties

From [[Closed Guard Bottom]] (S015):

**Success Rates**:
- Beginner: 30%
- Intermediate: 50%
- Advanced: 70%

**Technical Characteristics**:
- **Setup Complexity**: Medium - requires specific arm positioning and angle creation
- **Execution Speed**: Medium - 3-5 seconds from lock to tap in training
- **Escape Difficulty**: High - very few escapes once angle is created
- **Damage Potential**: Medium - can cause unconsciousness, neck strain
- **Target Area**: Carotid arteries (both sides of neck)

## Visual Finishing Sequence

With your right leg across the back of the opponent's neck and your left ankle hooked behind your right knee, you create a triangle configuration trapping their head and left arm. Your hips are angled 45 degrees off center, creating a shoulder-to-hip line. You pull down on their head with both hands while squeezing your knees together, applying pressure to both carotid arteries.

Your opponent experiences increasing pressure on both sides of their neck, blood flow to the brain reducing rapidly. Their face may begin to change color. Recognizing the submission is inevitable and tightly locked, they tap repeatedly on your leg with their free hand. You immediately release leg pressure, open your guard, and move to the side while monitoring your partner's consciousness and recovery.

**Body Positioning**:
- **Your position**: On your back, hips angled 45 degrees, legs forming triangle with ankle behind knee, shoulders on mat for base, pulling opponent's head down while squeezing knees
- **Opponent's position**: Posture broken, head pulled down into triangle, one arm trapped inside triangle with shoulder pressing into their own neck, other arm outside and free to tap
- **Key pressure points**: Both carotid arteries compressed between your thigh/shin and their own shoulder
- **Leverage creation**: Leg strength + pulling arms + hip angle create pressure against much weaker neck structure

## Setup Requirements

Conditions that **must** be satisfied before attempting:

1. **Position Establishment**: [[Closed Guard Bottom]] (S015) established with hooks in and opponent controlled

2. **Control Points**:
   - Both hands controlling opponent's head/posture
   - One opponent arm trapped across your centerline
   - Other opponent arm excluded from triangle
   - Legs maintaining connection to opponent

3. **Angle Creation**:
   - Hips able to move off center line
   - Space created to bring leg high around head
   - Shoulder-to-hip line angle (approximately 45 degrees)
   - Leg positioned behind opponent's neck

4. **Grip Acquisition**:
   - One hand controlling back of head
   - Other hand controlling trapped arm/wrist
   - Ability to pull head down while locking triangle
   - Head control maintained throughout setup

5. **Space Elimination**:
   - Ankle locked behind knee (triangle secured)
   - No space between leg and opponent's neck
   - Trapped arm pulled tight against neck
   - Hip angle squeezing space closed

6. **Timing Recognition**:
   - Opponent reaches across centerline
   - Opponent's posture breaks forward
   - Opponent pushes into guard creating space
   - Opponent makes arm positioning error

7. **Safety Verification**:
   - Partner aware of tap signals
   - At least one of partner's limbs free to tap
   - Clear communication established
   - Verbal tap agreed upon if arms trapped

**Position Quality Required**: Closed guard must be secure with opponent's posture broken. If opponent maintains strong posture, triangle setup becomes much more difficult and lower percentage.

## Execution Steps

**SAFETY REMINDER**: Apply pressure SLOWLY over 3-5 seconds. Watch for tap signals continuously. Monitor partner's face/color throughout.

### Step-by-Step Execution

1. **Initial Grip** (Setup Phase)
   - Secure two-handed grip on back of opponent's head
   - Pull opponent's head down to break posture
   - Trap opponent's left arm across centerline with your grip control
   - Safety check: Ensure partner's right arm is free to tap

2. **Position Adjustment** (Alignment Phase)
   - Bring right leg high over opponent's left shoulder
   - Position right shin across back of opponent's neck
   - Bring left leg up underneath, placing left ankle behind right knee
   - Partner check: Confirm triangle configuration is forming correctly

3. **Pressure Initiation** (Entry Phase)
   - Lock triangle by hooking ankle behind knee
   - Begin to adjust hip angle off centerline (toward trapped arm)
   - Start pulling opponent's head down while squeezing knees slightly
   - Speed: SLOW progressive squeeze
   - Watch for: Partner's color, breathing, tap signals

4. **Progressive Tightening** (Execution Phase)
   - Squeeze knees together incrementally over 3-5 seconds
   - Increase pulling pressure on head gradually
   - Ensure trapped arm is pulled tight against their neck
   - Monitor: Partner's face color, consciousness, tap signals
   - Maintain: Hip angle creating shoulder-to-hip line

5. **Final Adjustment** (Completion Phase)
   - Micro-adjust angle for maximum pressure
   - Ensure no space exists under leg/neck connection
   - Pull head lower while squeezing knees tighter
   - Critical: WATCH FOR TAP continuously - partner may have only seconds

6. **Submission Recognition & Release** (Finish/Safety Phase)
   - FEEL FOR TAP: Hand tapping your leg, foot tapping mat, verbal "tap"
   - **RELEASE IMMEDIATELY**:
     - Stop squeezing legs instantly
     - Release head pull
     - Open triangle by unhooking ankle
     - Open guard completely
   - Move to side position
   - Post-submission: Monitor partner for full consciousness, ask "you good?", watch for any signs of distress

**Total Execution Time in Training**: Minimum 3-5 seconds from triangle lock to tap. In drilling, apply even slower (7-10 seconds) to develop sensitivity.

## Anatomical Targeting & Injury Awareness

### Primary Target
- **Anatomical Structure**: Bilateral carotid arteries (common carotid, internal carotid)
- **Pressure Direction**: Inward and slightly upward, compressing arteries against neck structure
- **Physiological Response**: Reduced blood flow to brain → lightheadedness → loss of consciousness (3-8 seconds)

### Secondary Effects
- **Windpipe Compression**: Some air choke element if angle is off (less ideal)
- **Cervical Spine Pressure**: Mild pressure on neck vertebrae (avoid excessive pulling)
- **Jaw Pressure**: Potential TMJ stress if head position is wrong

### INJURY RISKS & PREVENTION

**Potential Injuries**:
- **Loss of Consciousness**: If held 3-8 seconds after full pressure, partner will go unconscious. Brain damage can occur if held significantly longer. RELEASE IMMEDIATELY upon tap.
- **Neck Strain**: Sharp angles or excessive pulling can strain cervical muscles/ligaments. Recovery: days to weeks depending on severity.
- **Neurological Issues**: Rarely, excessive pressure on carotid can cause complications. Always apply progressively, never explosively.
- **Windpipe Damage**: If triangle is too high on neck and pressure is explosive, windpipe can be damaged. Use proper neck positioning.

**Prevention Measures**:
- Apply pressure SLOWLY and progressively (3-5 seconds minimum)
- Never "spike" the triangle by explosive squeezing
- Never "jerk" the head down - pull progressively
- Watch partner's face/color continuously during application
- Stop at ANY sign of distress (color change, eyes closing, body going limp)
- Verbal check-ins during drilling: "Pressure okay?" "Feel that?"
- Release immediately upon ANY tap signal
- After release, monitor partner for 10-15 seconds

**Warning Signs to Stop IMMEDIATELY**:
- Partner unable to tap (rare - always leave one arm free)
- Partner's face color changes (redness → purple)
- Partner's eyes close or roll back
- Partner's body goes limp
- Partner makes gurgling or choking sounds
- ANY uncertainty about partner's consciousness
- Partner doesn't respond to verbal check
- Your instinct says something is wrong - TRUST IT

## Opponent Defense Patterns

### Common Escape Attempts

Defensive responses with success rates and safety windows:

**Early Defense** (Submission <70% complete - setup phase)
- Defense mechanism: Maintain strong posture, prevent leg from coming over shoulder, keep arms inside, frames on hips
- Success Rate: 60%, Window: 3-4 seconds
- Attacker response: Break posture with grips, create angles, threaten sweeps to force reactions
- Safety note: Best time to defend - submission not locked yet

**Hand Fighting** (Leg over shoulder, triangle not locked)
- Defense mechanism: Fight grips, push knee away from head, restore posture, pull trapped arm out
- Success Rate: 45%, Window: 2-3 seconds
- Attacker response: Secure triangle lock quickly, break posture more, switch to other attacks
- Safety note: Window still exists for safe escape before triangle locks

**Technical Escape** (Triangle locked but angle not perfected)
- Defense mechanism: Stack by standing up, pass weight over head, create space, pop head out
- Success Rate: 30%, Window: 1-2 seconds
- Attacker response: Adjust angle immediately, pull head down harder, transition to armbar
- Safety critical: Last moment to escape - if angle is created, must tap

**Inevitable Submission** (Triangle tight, angle created, no space)
- **Defender must**: TAP IMMEDIATELY - multiple taps on leg, mat, or verbal "tap"
- **Attacker must**: RELEASE IMMEDIATELY upon feeling/hearing tap
- Success Rate: 0% escape
- Safety principle: NO SHAME IN TAPPING - unconsciousness occurs in 3-8 seconds

## Training Progressions & Safety Protocols

Safe learning pathway emphasizing control before completion:

### Phase 1: Technical Understanding (Week 1-2)
- Study triangle mechanics without partner
- Watch instructional videos from multiple angles
- Understand blood choke vs air choke difference
- Learn specific injury risks (consciousness loss, neck strain)
- Study and memorize tap signals
- Practice release protocol without pressure
- **No live application yet**
- Quiz yourself: Where are carotid arteries? How long until unconsciousness?

### Phase 2: Slow Practice (Week 3-4)
- Controlled application with willing partner
- Partner provides ZERO resistance
- Focus: Leg positioning, ankle lock, angle creation only
- Speed: EXTRA SLOW (10+ seconds per repetition)
- Partner gives "tap" at 20-30% pressure (light squeeze only)
- Practice release protocol every single repetition
- Verbal communication: "Feel pressure?" "Too much?"
- Instructor supervision required for first 10-20 repetitions
- Goal: Build muscle memory for positioning, not finishing

### Phase 3: Progressive Resistance (Week 5-8)
- Partner provides mild resistance to setup
- Practice reading defensive cues (posture, hand fighting)
- Speed: SLOW (7-10 seconds per rep from lock to tap)
- Partner taps at 40-50% pressure
- Develop sensitivity to triangle tightness
- Emphasize control over completion
- Begin recognizing when angle is correct
- Practice: If partner doesn't tap at 50%, release and reset
- Goal: Learn setup against defense, maintain safety standards

### Phase 4: Timing Development (Week 9-12)
- Partner provides realistic but not full resistance
- Recognize optimal opportunities (arm positioning errors)
- Speed: MODERATE (5-7 seconds from lock to tap)
- Partner taps at 60-70% pressure
- Learn to transition to other attacks (armbar, omoplata)
- Safety maintained as priority
- Start recognizing "point of no return" feel
- Practice: Still release and reset if anything feels unsafe
- Goal: Develop timing sense while maintaining control

### Phase 5: Safety Integration (Week 13-16)
- Light rolling integration (50-70% intensity)
- Proper tap recognition ingrained as reflex
- Speed: Controlled in training (3-5 seconds minimum)
- Partner taps at 70-80% pressure
- Competition speed ONLY in competition
- Respect partner safety absolutely
- Develop reputation as safe training partner
- Practice: Immediate release is automatic response to tap
- Goal: Safe application becomes default, not something you think about

### Phase 6: Live Application (Ongoing - 4+ months experience)
- Full sparring integration with safety emphasis
- Read situations for triangle opportunities
- Apply at appropriate speed for context (training vs competition)
- Never sacrifice partner safety for "getting the tap"
- Continue refining control and sensitivity
- Mentor newer students on safety protocols
- Practice: You can finish training partners - you choose not to
- Goal: Mastery means control + safety + effectiveness

**CRITICAL**: Progress through phases only when previous phase is mastered. Most injuries occur when practitioners skip steps and rush to "finishing." Your goal is to become the training partner everyone wants to work with because they trust you.

## Expert Insights

### John Danaher Perspective
> "The triangle choke is perhaps the most mechanically efficient submission in grappling because it creates a situation where your opponent's own shoulder does most of the work in compressing their carotid arteries. The key detail that separates a good triangle from a great triangle is the angle - you must create an approximately 45-degree angle from your shoulder to your hip, which makes their shoulder act as a wedge against their own neck. In training, your goal is to achieve the position where this angle is perfected and the submission becomes inevitable. The actual finishing is secondary - if you have the correct angle and configuration, the tap is automatic. Release pressure immediately upon tap. There is no educational value in holding a submission after your partner has already submitted."

**Key Technical Detail**: The 45-degree hip angle transforms the triangle from "tight squeeze" to "inevitable submission"

**Safety Emphasis**: Danaher's systematic approach emphasizes position perfection over explosive finishing. Students learn to recognize the correct configuration and understand that from that position, the finish is guaranteed - no need to rush or force.

### Gordon Ryan Perspective
> "In competition, I finish triangles fast - probably 1-2 seconds from lock to tap. In training, I finish them slow - 5 seconds minimum. You know why? Because in competition, I've got one opponent and I need to win. In training, I've got 20 training partners and I need them healthy next week. The difference between a 1-second triangle and a 5-second triangle isn't technique - it's intent. Both finish the same way. I've tapped hundreds of high-level opponents with triangles, and the setup is always the same: get the angle perfect, make sure their arm is trapped tight, and squeeze progressively. The competitors tap because they know I have it locked. Your training partners should tap for the same reason - not because you choked them unconscious. If you're finishing training partners unconscious, you're not good at triangles - you're bad at training."

**Competition Application**: Ryan's competition success comes from setup mastery, not dangerous application

**Training Modification**: Competition intensity in competition, training intensity in training. Your training partners allow you to practice - honor that with safety.

### Eddie Bravo Perspective
> "The triangle is so fundamental that I've got probably 15 different ways to set it up in my system. Traditional triangle from closed guard, reverse triangle from turtle, triangle from rubber guard, inside sankaku from truck - on and on. But you know what's the same in every single one? The finish. Once that triangle is locked and the angle is set, the mechanics are identical: progressive squeeze, watch for the tap, release immediately. Be creative with entries, not with safety. My students know: if you hurt a training partner because you didn't respect the tap or you went too hard in training, you're out. I don't care how good you are. We've built a reputation for wild positions and crazy setups, but we've also built a reputation for safe training. Both matter. The triangle is one of those submissions that can put someone out very fast - respect that power."

**Innovation Focus**: Endless creativity in setups and entries from unconventional positions

**Safety Non-Negotiable**: Bravo's 10th Planet culture values both innovation and safety. Creative entries, standardized safe finishing.

## Common Errors

### Technical Errors

**Error 1: Insufficient Angle Creation**
- Mistake: Keeping hips directly in line with opponent instead of creating 45-degree angle
- Why it fails: Without angle, their shoulder doesn't wedge against neck effectively - creates more of an uncomfortable squeeze than true blood choke
- Correction: Shift hips off centerline toward trapped arm side, creating shoulder-to-hip diagonal line
- Safety impact: Poor angle leads to longer application time and practitioners compensating with excessive force

**Error 2: Triangle Locked Too Loosely**
- Mistake: Ankle hooked behind knee with space remaining, or not squeezing legs together
- Why it fails: Space allows opponent to posture up, turn, or slip head out - dramatically reduces effectiveness
- Correction: Ankle must be TIGHT behind knee, squeeze knees together to eliminate all space, no daylight visible
- Safety impact: Loose triangle tempts practitioners to squeeze explosively to compensate

**Error 3: Pulling Head at Wrong Angle**
- Mistake: Pulling opponent's head straight down instead of toward hip
- Why it fails: Creates air choke on windpipe instead of blood choke on carotids - less effective, more uncomfortable
- Correction: Pull head DOWN and toward the hip on trapped arm side, creating diagonal pull matching hip angle
- Safety impact: Wrong angle increases windpipe pressure and risk of trachea injury

**Error 4: Wrong Leg Configuration**
- Mistake: Crossing ankles instead of ankle behind knee, or having legs switched (ankle on wrong side)
- Why it fails: Ankle lock is mechanically weaker than proper ankle-behind-knee configuration
- Correction: Bottom leg (side of trapped arm) has ankle; top leg (side of free arm) has knee to hook ankle behind
- Safety impact: Weak configuration leads to frustration and excessive squeezing

**Error 5: Trapped Arm Not Controlled**
- Mistake: Opponent's trapped arm has space or isn't pulled tight against their own neck
- Why it fails: Their arm acts as a frame creating space, preventing proper carotid compression
- Correction: Pull trapped arm tight across your centerline, use hands to control wrist/forearm, eliminate any space between their arm and neck
- Safety impact: Poor arm control makes submission less effective, increasing temptation to over-squeeze

### SAFETY ERRORS (CRITICAL)

**DANGER: Explosive Triangle Lock**
- Mistake: Locking triangle and squeezing maximally immediately
- Why dangerous: No time for partner to recognize submission and tap - can cause unconsciousness in 3-4 seconds
- Injury risk: LOSS OF CONSCIOUSNESS, potential neurological complications
- Correction: Lock triangle, THEN apply progressive squeezing pressure over 3-5 seconds minimum
- **This can cause your partner to go unconscious before they can tap**

**DANGER: Ignoring Tap Signals**
- Mistake: Continuing to squeeze after feeling tap on leg or hearing verbal tap
- Why dangerous: Blood choke causes unconsciousness very rapidly once full pressure is achieved
- Injury risk: Unnecessary unconsciousness, potential brain damage if held excessively, COMPLETE BREACH OF TRUST
- Correction: RELEASE IMMEDIATELY upon ANY tap signal - hand tap, foot tap, verbal tap, body tap
- **This is the most serious error in BJJ - can end training partnerships and cause serious harm**

**DANGER: Explosive Head Jerking**
- Mistake: Yanking or jerking opponent's head down violently to finish triangle
- Why dangerous: Sudden force on cervical spine and neck muscles
- Injury risk: Neck strain, whiplash effect, cervical muscle tears (days to weeks recovery)
- Correction: Pull head down progressively and smoothly, no sudden jerking motions
- **Neck injuries can have long-term consequences**

**DANGER: Competition Speed in Drilling**
- Mistake: Applying triangle at competition speed (1-2 second finish) during drilling or light rolling
- Why dangerous: Partner not defending at full intensity, can't protect themselves, no time to tap safely
- Injury risk: Unconsciousness, neck strain, breach of training agreement
- Correction: Match speed to context - drilling is slow (7-10 seconds), light rolling is moderate (5-7 seconds), competition is fast (1-3 seconds)
- **Save competition speed for competition - your training partners are not your competition opponents**

**DANGER: No Free Limbs to Tap**
- Mistake: Trapping both opponent's arms inside triangle or controlling both hands, leaving no way to tap
- Why dangerous: If partner cannot physically tap and goes unconscious, you may not notice immediately
- Injury risk: Unconsciousness without warning, extended pressure without tap signal
- Correction: Always ensure partner has at least one free limb to tap with; establish verbal "tap" as backup signal
- **Verbal "tap" is always valid when limbs are trapped**

## Variations & Setups

### Primary Setup (Most Common)
From [[Closed Guard Bottom]]:
- Opponent reaches across centerline with left arm
- Control opponent's left wrist with your right hand, pull across your chest
- Simultaneously control head with left hand, pull down to break posture
- Bring right leg high over opponent's left shoulder
- Left ankle comes up and hooks behind right knee, locking triangle
- Success rate: Beginner 30%, Intermediate 50%, Advanced 70%
- Setup time: 2-3 seconds for setup, 3-5 seconds for finish
- Safety considerations: Most common entry, ensure at least one opponent arm free to tap

### Alternative Setup 1: Arm Drag to Triangle
From [[Closed Guard Bottom]]:
- Arm drag opponent's right arm across body
- As they defend by reaching with left arm, trap that arm
- Hip out to side and bring leg over shoulder
- Lock triangle and create angle
- Best for: Grapplers with strong arm drag game
- Safety notes: Faster transition than standard setup, maintain slow finish

### Alternative Setup 2: Failed Sweep to Triangle
From [[Hip Bump Sweep]]:
- Attempt hip bump sweep when opponent posts left hand
- When sweep fails, trap posted arm
- Use momentum to bring right leg over shoulder
- Lock triangle from advantageous angle
- Best for: Opportunistic finish when sweep defended
- Safety notes: Angle often pre-created by sweep attempt

### No-Gi vs Gi Modifications

**Gi Version**:
- Grips: Can use collar grips to break posture, sleeve grips to control trapped arm
- Advantages: Better posture control, more setup time, easier to maintain position
- Adjustments: Can finish with collar grip pull instead of pulling head directly
- Safety: Gi grips very strong - even more important to apply slow progressive pressure

**No-Gi Version**:
- Grips: Behind-the-head grip (gable or S-grip), wrist control on trapped arm
- Modifications: Must be faster in setup as opponent is more slippery, angle even more critical
- Advantages: Head control is more direct, no gi material to create space
- Safety: Slipperiness means adjust positioning frequently; maintain slow squeeze despite position adjustments

## Mechanical Principles

### Leverage Systems
- **Fulcrum**: Back of opponent's neck where your shin crosses
- **Effort Arm**: Your leg squeezing + arms pulling head = combined force application
- **Resistance Arm**: Opponent's neck structure (relatively weak compared to legs)
- **Mechanical Advantage**: Leg adductor strength (~200-300 lbs force) + arm pulling strength (~50-100 lbs) = ~250-400 lbs potential force against neck structure that can only resist ~50 lbs
- **Efficiency**: Using opponent's own shoulder as wedge means you don't need to generate all pressure - their anatomy works against them

### Pressure Distribution
- **Primary Pressure Point**: Both common carotid arteries (one on each side of neck)
- **Force Vector**: Inward compression from outer thighs, aided by downward pull from arms
- **Pressure Type**: Bilateral compression - both arteries compressed simultaneously
- **Progressive Loading**: Initial lock creates light pressure (20%), angle adjustment increases (50%), knee squeeze + head pull completes (100%)
- **Threshold**: ~10 lbs of sustained pressure on carotid arteries begins restricting blood flow; ~20 lbs largely cuts off flow causing unconsciousness in 3-8 seconds

### Structural Weakness
- **Why It Works**: Carotid arteries are vulnerable surface vessels with no significant protective structure; located on sides of neck accessible from multiple angles
- **Body's Response**: Baroreceptors in carotid detect pressure drop → brain stem reduces blood pressure → reduced oxygen to brain → loss of consciousness
- **Damage Mechanism**: If held after unconsciousness, continued lack of blood flow causes brain damage (minor: 10-20 seconds, serious: 30+ seconds, potentially fatal: 3-5 minutes)
- **Protection Limits**: Body has no effective defense against properly applied blood choke - only option is to escape position or submit

## Knowledge Assessment

Test understanding before live application. Minimum 5/6 correct required.

### Question 1: Setup Recognition (Safety Critical)
**Q**: What position and controls must be established before attempting this submission safely?

**A**: Starting position must be [[Closed Guard Bottom]] (S015) with guard closed and hooks in. Required controls: (1) Opponent's posture broken with head pulled down, (2) One opponent arm trapped across your centerline (inside the triangle), (3) Other opponent arm outside and free to tap, (4) Strong grip on back of head, (5) Hip mobility to create angle, (6) Partner awareness that triangle is being attempted and tap signals are clear. Safety verification includes ensuring at least one of partner's limbs is free to tap clearly.

**Why It Matters**: Attempting triangle without proper setup leads to forcing/muscling the position, which increases injury risk and teaches poor technique. Proper setup makes the finish inevitable and safe.

---

### Question 2: Technical Execution (Mechanics)
**Q**: What creates the pressure in this technique, and what is the primary target?

**A**: Pressure is created by: (1) Leg adductor muscles (inner thighs) squeezing knees together, (2) Arms pulling opponent's head down toward hip, (3) Creating 45-degree hip angle that makes opponent's own shoulder wedge against their neck, (4) Ankle-behind-knee lock that maintains triangle configuration. Primary target is bilateral carotid arteries on both sides of the neck. The technique works by compressing these arteries between your inner thigh and their own shoulder, reducing blood flow to the brain.

**Why It Matters**: Understanding mechanics allows controlled application rather than relying on force. Knowing the exact target helps practitioners recognize when the position is correct and finish is inevitable.

---

### Question 3: Safety Understanding (CRITICAL)
**Q**: How fast should pressure be applied in training, what are the proper tap signals, and what happens if the submission is held after tap?

**A**:

**Application Speed**:
- Drilling: 7-10 seconds (extra slow), stop at 40-50% pressure
- Light rolling: 5-7 seconds (slow), stop at 60-70% pressure
- Hard rolling: 3-5 seconds (moderate), stop at 70-90% pressure
- Competition: 1-3 seconds (fast), continue to tap or unconsciousness

**Tap Signals**:
- Physical tap with free hand on opponent's leg, body, or mat (multiple taps)
- Physical tap with feet on opponent or mat
- Verbal "tap" or "tap tap tap"
- Any indication of distress (color change, eyes rolling, body going limp)

**Holding After Tap**:
- Loss of consciousness occurs 3-8 seconds after full pressure
- Brain damage possible if held 20-30+ seconds
- Complete breach of training trust
- Can result in being asked to leave academy

**Release Protocol**:
1. Stop squeezing legs immediately
2. Release head pull
3. Unhook ankle, open triangle
4. Open guard completely
5. Move to side
6. Monitor partner for 10-15 seconds

**Why It Matters**: This is the most critical safety information for triangles. Blood chokes cause rapid unconsciousness. Understanding application speed, tap signals, and consequences prevents serious injuries and maintains safe training environment.

---

### Question 4: Defense Awareness (Tactical)
**Q**: What is the best defense against this submission, and when must it be executed? At what point is tapping the only safe option?

**A**:

**Best Defense**: Early posture maintenance - maintain strong upright posture, keep arms inside guard or correctly positioned, use frames on hips to prevent leg from coming over shoulder. Success rate: 60% if executed before leg crosses shoulder.

**Timing Window**: Must be executed in setup phase, before triangle is locked (ankle behind knee). Once triangle is locked, escape success drops to 30% and requires technical escapes (stack pass, posture explosion). Once angle is created (45-degree hip angle with tight lock), escape rate drops to near 0%.

**Tap Decision Point**: When triangle is locked tight (no space), angle is created (shoulder-to-hip line), and pressure is increasing. At this point, no reliable escape exists. Attempting to escape at this stage wastes oxygen, increases pressure time, and risks unconsciousness. Tap immediately and learn from the position.

**Physical Indicators to Tap**:
- Triangle feels very tight with no space
- Pressure building on both sides of neck
- Your trapped arm cannot create frame
- Opponent's angle is set
- Beginning to feel lightheaded
- Vision starting to narrow ("tunnel vision")

**Why It Matters**: Knowing when to tap prevents unconsciousness and injury. Smart grapplers tap to position, not to pain - recognizing inevitable submissions is a skill that prevents injuries and accelerates learning.

---

### Question 5: Anatomical Knowledge (Technical)
**Q**: What specific anatomical structure is targeted, and what injury can occur if pressure continues after the tap?

**A**:

**Primary Target**: Bilateral common carotid arteries, located on both sides of the neck. These vessels carry oxygenated blood from the heart to the brain.

**Mechanism**: Compression of carotid arteries reduces blood flow to the brain. Baroreceptors in the carotid sense pressure and signal the brain stem, which can further reduce blood pressure. Combined effect causes rapid decrease in brain oxygen.

**Unconsciousness Timeline**: 3-8 seconds from full pressure to loss of consciousness

**Injury If Held After Tap**:
- Continued unconsciousness (immediate)
- Potential petechiae (small burst blood vessels in eyes/face)
- Temporary cognitive impairment upon waking
- If held 20-30 seconds: Risk of minor brain damage
- If held 1-2 minutes: Risk of serious brain damage
- If held 3-5+ minutes: Risk of death

**Secondary Injuries Possible**:
- Neck strain from pulling pressure (days to weeks recovery)
- Cervical muscle tears if jerked (weeks recovery)
- TMJ stress if jaw positioned wrong (days recovery)
- Windpipe damage if angle wrong (rare, serious)

**Why It Matters**: Understanding the specific injury potential creates appropriate respect for the technique. Triangle choke is not painful - it causes unconsciousness. This requires different awareness than joint locks. Practitioners must recognize that lack of pain doesn't mean lack of danger.

---

### Question 6: Release Protocol (Safety Critical)
**Q**: What is the immediate action required when partner taps, and how do you safely release this submission?

**A**:

**Immediate Action**: STOP ALL PRESSURE IMMEDIATELY upon feeling or hearing any tap signal.

**Release Steps**:
1. **Cease Squeezing**: Stop all leg squeezing pressure instantly (0.5 seconds)
2. **Release Head Pull**: Let go of head control, stop pulling down (0.5 seconds)
3. **Open Triangle**: Unhook ankle from behind knee, open legs (1 second)
4. **Open Guard**: Release guard hooks, separate legs from opponent (1 second)
5. **Move to Side**: Shift your position to side to allow partner to breathe/recover (1 second)
6. **Monitor Partner**: Watch partner's face, consciousness, breathing for 10-15 seconds
7. **Verbal Check**: Ask "You good?" and wait for clear response
8. **Observe**: Watch for full color return, clear eyes, normal breathing

**What to Watch For After Release**:
- Partner's color returning to normal
- Partner's consciousness (alert, making eye contact)
- Partner's breathing (regular, not gasping)
- Any signs of confusion or disorientation
- Rare: If partner went unconscious, elevate legs, monitor breathing, call for help if needed

**Total Release Time**: 3-5 seconds from tap to full separation

**Why It Matters**: Proper release protocol prevents injury during disengagement and demonstrates respect for training partner. How you release is as important as how you apply. This is the difference between a trusted training partner and someone people avoid rolling with.
