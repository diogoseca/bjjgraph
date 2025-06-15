# Seoi Nage
#bjj #transition #takedown #judo #throw

## Required Properties for State Machine

### Core Identifiers
- **Transition ID**: T064
- **Transition Name**: Seoi Nage
- **Alternative Names**: Shoulder Throw, Ippon Seoi Nage

### State Machine Properties
- **Transition Type**: Takedown - from standing to ground control via throw
- **Starting Position**: [[Standing Position]], [[Clinch Position]]
- **Ending Position**: [[Top Position]], [[Side Control]]
- **Transition Path**: Standing to ground with top dominance

### Transition Properties
- **Success Probability**: Beginner 25%, Intermediate 45%, Advanced 65% - core probability data
- **Execution Complexity**: High - requires precise grip, hip placement, and timing
- **Energy Cost**: High - demands explosive movement and upper body strength
- **Risk Level**: Medium to High - potential for losing position if mistimed
- **Execution Speed**: Fast - must be executed quickly to off-balance opponent

### Physical Requirements
- **Strength Requirements**: High for upper body control and throwing motion
- **Flexibility Requirements**: Medium for hip rotation and shoulder mobility
- **Coordination Requirements**: High for timing grip, hip entry, and throw
- **Speed Requirements**: High for quick entry and off-balancing action

## State Machine Content Elements

### Visual Execution Sequence
Detailed step-by-step description for clear movement sequence visualization:

From a Standing Position or Clinch Position, you begin facing the opponent with a strong grip, typically a collar grip with one hand on the back of their gi collar or neck and a sleeve grip with the other hand controlling their arm at the elbow or wrist, maintaining an upright posture to control their upper body and set up the takedown, while keeping your feet shoulder-width apart for a stable base, ready to step in. You maintain close contact with the opponent, keeping your elbows in to prevent them from pulling away, while your head is positioned to the side of their chest or shoulder to avoid head clashes, ensuring your hips are slightly lower than theirs to prepare for the entry, as you use your grips to pull them slightly forward or to the side to break their balance (kuzushi). As you initiate the throw, you step in deeply with one foot (often your dominant side) between or outside their legs, turning your back to them while pulling their controlled arm across your shoulder, simultaneously dropping your hips below theirs and bending your knees to load their weight onto your back, using your collar grip to pull their upper body tightly over your shoulder, creating the leverage for the throw. With the opponent off-balanced and loaded onto your back, you continue the motion by straightening your legs explosively and rotating your torso, throwing them over your shoulder to the mat in front of you, maintaining control of their arm and upper body as they fall to their back or side, ensuring you follow through by turning to face them, often landing in a top position like side control or directly into mount if their defenses are open. You consolidate the position by securing an underhook or crossface to prevent their immediate escape, having successfully executed a powerful judo throw to reverse the position from standing to top dominance.

**Template**: "From Standing Position or Clinch Position, secure collar grip on neck and sleeve grip on arm, maintain upright posture. Keep close contact, elbows in, lower hips, pull opponent forward/sideways to break balance. Step in deeply, turn back to opponent, pull arm across shoulder, drop hips, load weight on back. Straighten legs explosively, rotate torso, throw opponent over shoulder to mat. Follow through to top position or side control, secure underhook/crossface for dominance."

### Execution Steps (Numbered Sequence)
1. **Setup Requirements**: Start in Standing Position or Clinch Position
2. **Grip Establishment**: Secure collar grip on neck/back, sleeve grip on arm
3. **Posture Control**: Maintain upright stance, keep elbows in for close contact
4. **Balance Breaking**: Pull opponent forward or sideways to disrupt balance (kuzushi)
5. **Hip Preparation**: Lower hips below opponent's, prepare for deep entry
6. **Entry Step**: Step in with dominant foot between/outside opponent's legs
7. **Back Turn**: Turn back to opponent, pull controlled arm across shoulder
8. **Loading Action**: Drop hips, bend knees, load opponent's weight on back
9. **Throw Execution**: Straighten legs explosively, rotate torso, throw over shoulder
10. **Position Consolidation**: Follow through to top position, secure underhook/crossface

### Key Technical Details
Critical elements that determine success:
- **Grip Control**: Strong collar and sleeve grips to manipulate opponent's upper body
- **Balance Breaking**: Effective kuzushi to off-balance opponent before entry
- **Hip Placement**: Deep hip entry below opponent's center of gravity for leverage
- **Loading Mechanics**: Proper loading of opponent's weight onto back for throw
- **Explosive Finish**: Quick leg extension and torso rotation for powerful throw

### Success Modifiers
Factors that increase/decrease probability:
- **Grip Strength**: Effectiveness of collar and sleeve control (+/-20%)
- **Opponent Balance**: Degree of kuzushi or forward lean (+/-15%)
- **Hip Entry**: Depth and alignment of hip placement (+/-15%)
- **Explosive Power**: Speed and strength of leg extension (+/-10%)
- **Knowledge Test Performance**: Understanding judo throw mechanics (+/-10%)

## Counter-Attack Analysis

### Common Counters
Opponent responses with success rates:
- **Posture Recovery**: Stepping back to regain balance → [[Standing Position]] (Success Rate: 40%, Conditions: early recognition)
- **Hip Block**: Preventing deep hip entry with stance → [[Clinch Position]] (Success Rate: 30%, Conditions: quick reaction)
- **Arm Freeing**: Pulling controlled arm free from grip → [[Neutral Position]] (Success Rate: 20%, Conditions: strong grip break)
- **Counter Throw**: Using throw momentum for own takedown → [[Top Position]] (Success Rate: 10%, Conditions: advanced skill)

Format: `[[Counter Technique]] → [[Result State]] (Success Rate: X%, Conditions: [when applicable])`

### Decision Logic
```
If [throw setup] is recognized early:
- Execute [[Posture Recovery]] (Probability: 40%)

Else if [stance] can block hip entry:
- Execute [[Hip Block]] (Probability: 30%)

Else if [grip break] can free controlled arm:
- Attempt [[Arm Freeing]] (Probability: 20%)

Else [advanced skill] allows counter attack:
- Attempt [[Counter Throw]] (Probability: 10%)

Else [optimal execution]:
- Accept transition (Probability: Success Rate - Modifiers)
```

## Educational Content

### Expert Insights
Commentary as if from recognized authorities:
- **John Danaher**: "Seoi Nage is a classic judo throw that exemplifies the principle of using an opponent's momentum against them through precise balance breaking. The key is in the deep hip entry and the coordinated pulling action to load their weight onto your back, demonstrating how leverage can overcome strength. This takedown teaches critical principles of kuzushi and timing that are essential for all standing grappling systems."
- **Gordon Ryan**: "In competition, Seoi Nage is a high-impact move for gi grappling, especially when you can catch an opponent leaning forward. I focus on securing the collar grip and exploding through the throw with maximum power to ensure they land hard. This technique shows how judo throws can be adapted into dominant BJJ takedowns for scoring and control."
- **Eddie Bravo**: "Seoi Nage is a powerful throw that blends classic judo with modern BJJ stand-up game, offering a dynamic way to take the fight to the ground. It’s a great move for grapplers who like to control the upper body and create explosive takedowns, often chaining into submissions. This throw integrates well with systems that prioritize aggressive stand-up transitions."

Each insight should focus on one key technical or strategic element.

### Common Errors
For knowledge test generation:
- **Error**: Insufficient balance breaking (kuzushi) before entry
- **Why It Fails**: Lacks disruption to opponent's posture, making throw difficult
- **Correction**: Pull opponent forward or sideways to break balance before stepping in
- **Recognition**: Opponent remains stable or easily steps back

- **Error**: Shallow hip entry or poor back alignment
- **Why It Fails**: Reduces leverage, prevents loading opponent's weight effectively
- **Correction**: Step in deeply, ensure hips are below opponent's center of gravity
- **Recognition**: Throw stalls or opponent blocks with hip resistance

- **Error**: Lack of explosive power or torso rotation
- **Why It Fails**: Fails to generate enough force to complete the throw
- **Correction**: Straighten legs explosively and rotate torso for maximum power
- **Recognition**: Opponent lands partially or counters during slow execution

### Timing Considerations
When to attempt this transition:
- **Optimal Conditions**: When opponent leans forward or overcommits in clinch
- **Avoid When**: Opponent maintains low, defensive posture with strong base
- **Setup Sequences**: After establishing collar and sleeve grips for upper body control
- **Follow-up Windows**: Must complete throw within 2-3 seconds to avoid counters

### Prerequisites
Requirements before attempting:
- **Technical Skills**: Understanding of judo throw principles and balance breaking
- **Physical Preparation**: Upper body strength and explosive power for throwing
- **Positional Understanding**: Control points in standing and clinch positions
- **Experience Level**: Intermediate to Advanced - requires precise timing and power

## Technical Assessment Elements

### Knowledge Assessment Questions
5 technical questions with multiple choice answers:
- **Mechanical Understanding**: "What creates the leverage in a Seoi Nage throw?"
- **Timing Recognition**: "When is the optimal moment to initiate a Seoi Nage?"
- **Error Prevention**: "What is the most common mistake in executing a Seoi Nage?"
- **Setup Requirements**: "Which grip is essential for starting a Seoi Nage?"
- **Adaptation**: "How do you adjust if the opponent resists during a Seoi Nage?"

### Variants and Adaptations
Different versions for various scenarios:
- **Ippon Seoi Nage**: Classic one-arm shoulder throw with deep hip entry
- **Morote Seoi Nage**: Two-arm variation for added control and power
- **No-Gi Adaptation**: Modified grips on neck and arm without gi
- **Counter Adaptation**: Applied as counter to opponent's failed takedown attempt
- **Combination Setup**: Used in chain with other judo throws or wrestling takedowns

### Training Progressions
Skill development pathway:
- **Solo Practice**: Hip entry and torso rotation drills without partner
- **Cooperative Drilling**: Partner allows throw for technique development
- **Resistant Practice**: Partner provides progressive resistance to setup
- **Sparring Integration**: Attempt during live stand-up scenarios
- **Troubleshooting**: Identify and correct issues with kuzushi or hip entry

## Audio & Narration Elements

### Action Descriptions
Dynamic language for TTS narration:
- **Movement Verbs**: Grip, pull, step, turn, load, drop, straighten, rotate, throw, follow
- **Spatial References**: Collar grip, hip entry, shoulder load, mat landing
- **Pressure Dynamics**: Balance breaking, loading weight, explosive force
- **Momentum Descriptions**: Quick entry, powerful rotation, dynamic throw

### Coaching Commentary
Real-time instruction and feedback:
- **Setup Cues**: "Secure collar and sleeve grips, pull to break their balance"
- **Execution Guidance**: "Step in deep, turn your back, load them on shoulder, throw with power"
- **Adaptation Prompts**: "If they resist, adjust angle or switch to another takedown"
- **Completion Confirmation**: "Throw them over, land on top, secure side control or mount"

## Technical Specifications

### Animation Keyframes
For potential visual development:
- **Starting Position**: Standing with collar and sleeve grips
- **Transition Points**: Balance breaking, hip entry, loading, throw execution
- **Finishing Position**: Top position or side control after throw
- **Alternative Outcomes**: Failed attempt leading to neutral position or counter

### Biomechanical Analysis
Scientific movement breakdown:
- **Force Vectors**: Pulling force on upper body, rotational force through hips
- **Leverage Ratios**: Shoulder and back as fulcrum for opponent's body weight
- **Range of Motion**: Hip rotation and shoulder extension for throw mechanics
- **Power Generation**: Leg and core strength for explosive straightening and rotation

## Validation Checklist

Every transition file must include:
- [x] All required properties with specific numeric values
- [x] Detailed visual execution sequence (minimum 4 sentences)
- [x] Complete numbered execution steps (minimum 6 steps)
- [x] At least 3 common counters with success rates
- [x] Decision logic for opponent behavior
- [x] Expert insights from all three authorities
- [x] Minimum 3 common errors with corrections
- [x] 5 knowledge test questions with answers
- [x] Timing considerations and prerequisites
- [x] Training progression pathway

## Example Implementation

See [[Hip Bump Sweep]] for a complete example implementing all standard requirements.

## Notes for Developers

This standard ensures:
- Consistent transition data for state machine implementation
- Probability calculations with modifier systems
- Rich content for comprehensive technical documentation
- Educational value through expert analysis
- Technical depth for authentic understanding
- Structured decision analysis patterns
- Knowledge assessment integration
- Training progression guidance

Updates to this standard should be reflected across all transition files to maintain consistency and educational value.

## Related Techniques
- **Standing Position** - Primary starting position for this takedown
- **Clinch Position** - Alternative starting position with close control
- **Osoto Gari** - Similar judo throw with different mechanics
- **Top Position** - Common outcome after successful throw

## Competition Applications
- **IBJJF Rules**: Legal at all belt levels, scores as takedown (2 points)
- **No-Gi Competition**: Effective with modified grip setups
- **Self-Defense**: Useful for taking down an aggressor in real-world scenarios
- **MMA Applications**: Applicable with adjustments for striking defense

## Historical Context
Seoi Nage is a traditional judo technique developed by Jigoro Kano as part of the Kodokan judo system in the late 19th century. It has been adapted into Brazilian Jiu-Jitsu for its effectiveness in gi grappling, becoming a staple in BJJ competition for scoring takedown points and establishing top control.

## Safety Considerations
- **Controlled Throw**: Execute with control to avoid injuring opponent on fall
- **Personal Safety**: Be prepared to adjust if throw fails or opponent counters
- **Partner Communication**: Ensure opponent is ready for dynamic stand-up movement
- **Training Environment**: Use in controlled settings with proper mats to prevent injury

## Position Integration
**Common Seoi Nage combinations:**
- [[Standing Position]] → [[Seoi Nage]] → [[Top Position]]
- [[Clinch Position]] → [[Seoi Nage]] → [[Side Control]]
- [[Standing Position]] → [[Failed Seoi Nage]] → [[Neutral Position]]

## Training Applications
- **Takedown Development**: Essential for stand-up grappling game
- **Competition Preparation**: High-impact move for scoring takedown points
- **Control Training**: Builds skills in balance breaking from standing position
- **Power Mastery**: Encourages development of explosive strength and timing
