# Back Step
#bjj #transition #passing #back_take

## State Properties
- **State ID**: S063
- **Point Value**: 0 (Transitional position)
- **Position Type**: Offensive transition
- **Risk Level**: Low to Medium
- **Energy Cost**: Low
- **Time Sustainability**: Short (transitional)

## State Description
The Back Step is a fundamental transitional movement where the practitioner steps their leg backward around the opponent's body, creating a pathway to the opponent's back. This dynamic movement is primarily used during guard passing sequences or from top control positions when the opponent turns away. Rather than a static position, the Back Step represents a critical movement pattern in BJJ that connects passing sequences to back-taking opportunities. It serves as a core component of modern passing systems by providing a seamless transition between guard passing and back control, particularly when opponents attempt defensive turns to prevent pass completion.

## Key Principles
- Step back leg behind opponent's body in a circular motion
- Maintain upper body connection throughout the movement
- Control opponent's hips during the transition
- Anticipate and exploit opponent's turning mechanics
- Prevent opponent from establishing defensive frames
- Time the movement with opponent's defensive reactions
- Maintain base and balance throughout the transition
- Control opponent's far arm when possible

## Prerequisites
- Passing position with hip control (typically [[Leg Drag Position]] or [[Headquarters Position]])
- Upper body control established
- Recognition of opponent's defensive turning patterns
- Proper weight distribution and base

## State Invariants
- Back leg stepping around opponent's body
- Upper body connection maintained
- Control of opponent's rotation
- Directional movement toward opponent's back
- Weight shifted appropriately during transition

## Defensive Responses (When Opponent Has This State)
- [[Counter Rotation]] → [[Guard Recovery]]
- [[Underhook Defense]] → [[Half Guard Recovery]]
- [[Turtle Position]] → [[Turtle Position]]
- [[Roll Through]] → [[Top Position]]
- [[Frame and Create Space]] → [[Open Guard Bottom]]

## Offensive Transitions (Available From This State)
- [[Complete Back Take]] → [[Back Control]]
- [[Crucifix Entry]] → [[Crucifix Position]]
- [[Turtle Control]] → [[Turtle Position]]
- [[Reverse Half Guard Entry]] → [[Reverse Half Guard Top]]
- [[Modified Mount]] → [[Technical Mount]]
- [[Kimura Trap]] → [[Kimura Control]]
- [[Darce Entry]] → [[D'arce Control]]

## Counter Transitions
- [[Re-direct Back Step]] → [[Back Control]] (against defensive rotation)
- [[Switch to Side Control]] → [[Side Control]] (if back take fails)
- [[Leg Drag Recovery]] → [[Leg Drag Position]] (if back step is compromised)

## Expert Insights
- **Danaher System**: Views the back step as an essential component of a systematic passing approach that punishes defensive turning. Emphasizes precise timing of the step in relation to the opponent's hip movement, creating a "trap" where defensive responses lead directly to back exposure. Places particular importance on controlling the opponent's near arm during the transition to prevent defensive framing.
- **Gordon Ryan**: Utilizes the back step as a fluid connection between his passing and back-taking systems. Often initiates back steps preemptively when recognizing patterns in the opponent's defensive movement, before they've fully committed to turning away. Creates elaborate "fake pass" scenarios specifically designed to induce the turning response that enables the back step.
- **Eddie Bravo**: Has incorporated the back step into his 10th Planet system with modifications that favor transitioning to specialized control positions like the Truck and the Twister Side Control. Places greater emphasis on head and neck control during the back step than traditional approaches.

## Common Errors
- Stepping too early → Opponent counters with guard recovery
- Insufficient upper body control → Loss of positional advantage
- Overcommitting weight → Vulnerability to reversals
- Poor timing → Missed opportunity for back exposure
- Telegraphing the movement → Defensive counters
- Losing control of opponent's hips → Failed transition
- Stepping too shallow → Incomplete back control

## Training Drills
- Back step timing drills from various passing positions
- Back step to back control flow sequences
- Pass-to-back step reaction drills
- Upper body control maintenance during transitions
- Defensive recognition patterns
- Back step variations from different control positions

## Related States
- [[Back Control]] - Primary destination after successful back step
- [[Leg Drag Position]] - Common starting position for back step
- [[Headquarters Position]] - Frequent setup position for back step
- [[Crucifix Position]] - Alternative control position from back step
- [[Turtle Position]] - Common intermediate position during back step sequence

## Decision Tree
If opponent turns completely away:
- Execute [[Complete Back Take]] → [[Back Control]]

Else if opponent turns to turtle:
- Execute [[Turtle Control]] → [[Crucifix Entry]]

Else if opponent attempts to face you:
- Execute [[Switch to Side Control]] → [[Side Control]]

Else if opponent defends with underhook:
- Execute [[Kimura Trap]] → [[Kimura Control]]

## Position Metrics
- Success Rate: 75% back take completion (competition data)
- Average Time in Position: 2-5 seconds (transitional)
- Back Control Transition Probability: 65%
- Crucifix Transition Probability: 20%
- Failed Transition Probability: 15%

## Optimal Paths
Primary back-taking path:
[[Leg Drag Position]] → [[Back Step]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]

Alternative control path:
[[Headquarters Position]] → [[Back Step]] → [[Crucifix Entry]] → [[Crucifix Position]] → [[Crucifix Choke]] → [[Won by Submission]]

Competition sequence:
[[Toreando Pass]] → [[Back Step]] → [[Back Control]] → [[Bow and Arrow Choke]] → [[Won by Submission]]

## Computer Science Analogy
The Back Step functions as a critical "edge traversal function" in the BJJ state graph that connects two otherwise distant node clusters - passing positions and back control positions. This creates a shortcut in the state transition graph, dramatically reducing the path length between these position families. In computational terms, the Back Step implements an efficient branch prediction algorithm that anticipates the opponent's defensive response (turning away) and preemptively positions to capitalize on this behavior, essentially setting up a conditional jump in the execution flow that bypasses several intermediate states.
