# Open Guard Top
#bjj #state #top #guard_passing

## State Properties
- **State ID**: S033
- **Point Value**: 1 (Slight advantage)
- **Position Type**: Passing/control position
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
Open Guard Top is the fundamental position where the top player engages with an opponent who is utilizing an open guard (any guard where the legs are not closed around the opponent's waist). The position encompasses a wide range of specific scenarios depending on the bottom player's guard configuration, but generally involves the top player standing or in combat base, working to navigate past the opponent's legs to establish a more dominant position. This position serves as the starting point for all guard passing sequences and represents one of the most complex and dynamic positional battles in BJJ.

## Key Principles
- Maintain proper posture and base to avoid sweeps
- Control opponent's legs to limit their mobility
- Create and exploit angles to bypass defensive frames
- Establish grip dominance to facilitate passes
- Manage distance appropriate to your passing style
- Anticipate and counter defensive guards and transitions
- Apply strategic pressure to break down guard structures

## Prerequisites
- Understanding of various guard types and mechanics
- Base and balance awareness
- Grip fighting fundamentals
- Recognition of passing opportunities
- Defensive awareness against sweeps and submissions

## State Invariants
- Top player standing or in combat base
- Bottom player utilizing open legs configuration
- No chest-to-chest connection established
- Distance managed through grips and positioning
- Dynamic engagement with opponent's legs

## Defensive Responses (When Opponent Has This State)
- [[Establish Specific Guard]] → [[Guard Control]]
- [[Offensive Gripping]] → [[Sweep Setup]]
- [[Distance Management]] → [[Guard Retention]]
- [[Off-Balancing Attempt]] → [[Sweep Execution]]
- [[Submission Entry]] → [[Submission Control]]

## Offensive Transitions (Available From This State)
- [[Headquarters Entry]] → [[Headquarters Position]]
- [[Leg Drag Setup]] → [[Leg Drag Pass]]
- [[Toreando Pass]] → [[Side Control]]
- [[Knee Cut Entry]] → [[Knee Cut Pass]]
- [[Double Under Pass]] → [[Side Control]]
- [[Over Under Pass]] → [[Side Control]]
- [[Body Lock Pass Setup]] → [[Body Lock Pass]]
- [[Stack Pass]] → [[Side Control]]
- [[Pressure Pass]] → [[Side Control]]
- [[Combat Base Transition]] → [[Combat Base]]

## Counter Transitions
- [[Re-establish Standing]] → [[Open Guard Top]] (against sweeps)
- [[Defensive Base]] → [[Combat Base]] (against submissions)
- [[Switch Passing Strategy]] → [[Open Guard Top]] (adapting approach)

## Expert Insights
- **Danaher System**: Emphasizes systematic categorization of open guards and developing appropriate passing strategies for each guard type. Creates a methodical approach to guard passing that begins with proper grip breaking and establishment of advantageous grips before committing to specific passes. Focuses particularly on the concept of addressing the opponent's defensive layers in the correct sequence.
- **Gordon Ryan**: Approaches open guard top with a pressure-based passing system that emphasizes creating dilemmas for the guard player through strategic weight distribution and grip configurations. Focuses on forcing predictable defensive reactions that can be exploited with pre-planned passing sequences, particularly favoring the headquarters position as a central hub.
- **Eddie Bravo**: Developed specialized passing approaches for his 10th Planet system that often involve unique passing angles and pressure distributions not commonly seen in traditional gi passing. Emphasizes the importance of posture breaking and creating pressure that forces the bottom player to make defensive compromises.

## Common Errors
- Poor posture → Vulnerability to sweeps
- Neglecting grip fighting → Loss of control
- Committing prematurely → Defensive counters
- Passive engagement → Allowing guard establishment
- Telegraphing passes → Predictable patterns

## Training Drills
- Grip fighting sequences against various guards
- Passing flow drills with progressive resistance
- Base and posture recovery exercises
- Defensive awareness against common sweeps
- Transitional drills between different passing approaches

## Related States
- [[Combat Base]] - Related top position with different posture
- [[Headquarters Position]] - Specialized passing control position
- [[Standing Position]] - Neutral upright position
- [[Closed Guard Top]] - Related guard top position
- [[Side Control]] - Common destination after successful pass

## Decision Tree
If opponent establishes collar/sleeve grips:
- Execute [[Grip Break Sequence]] → [[Headquarters Entry]]

Else if opponent plays with feet on hips:
- Execute [[Leg Drag Setup]] or [[Double Under Pass]]

Else if opponent uses seated guard:
- Execute [[Combat Base Transition]] or [[Pressure Pass]]

Else if opponent plays supine (lying) open guard:
- Execute [[Toreando Pass]] or [[Knee Cut Entry]]

## Position Metrics
- Success Rate: 60% passing probability (competition data)
- Average Time in Position: 30-90 seconds
- Pass Completion Probability: 55%
- Sweep Vulnerability: 35%
- Submission Vulnerability: 15%

## Optimal Paths
Standard passing path:
[[Open Guard Top]] → [[Headquarters Entry]] → [[Headquarters Position]] → [[Knee Cut Pass]] → [[Side Control]]

Pressure passing path:
[[Open Guard Top]] → [[Double Under Pass]] → [[Side Control]] → [[Mount]] → submission options

Dynamic passing path:
[[Open Guard Top]] → [[Leg Drag Setup]] → [[Leg Drag Pass]] → [[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]

## Computer Science Analogy
Open Guard Top represents a "search problem" in the BJJ state graph where the top player must navigate through a complex decision space with multiple possible paths (passes) and obstacles (guard configurations). The position requires implementing an adaptive search algorithm that constantly evaluates the current state and selects the optimal passing strategy based on the opponent's defensive structure. Similar to a pathfinding algorithm encountering dynamic obstacles, the guard passer must continuously reassess and adjust their approach as the guard player shifts their defensive configuration.
