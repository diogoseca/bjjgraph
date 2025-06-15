# Back Control
#bjj #state #dominant #control #back_control

## State Properties
- **State ID**: S005
- **Point Value**: 4 (Highly dominant position)
- **Position Type**: Offensive/Controlling
- **Risk Level**: Low
- **Energy Cost**: Medium
- **Time Sustainability**: Long

## State Description
Back Control is widely considered the most dominant position in Brazilian Jiu-Jitsu. The practitioner controls the opponent from behind, with their chest against the opponent's back, legs wrapped around their waist (hooks), and arms controlling the upper body. This position offers exceptional attacking opportunities with minimal defensive risks, as the opponent cannot directly see or easily counter the attacks.

## Key Principles
- Maintain chest-to-back connection at all times
- Control opponent's hip movement with leg hooks or body triangle
- Establish and maintain harness control of upper body
- Prevent opponent's rotation to face you
- Manage opponent's defensive hand fighting
- Create and exploit attacking angles for submissions

## Prerequisites
- Successful transition from mount, side control, or turtle
- Control of opponent's upper body and prevention of rotation
- Proper insertion of hooks or body triangle
- Seatbelt or double-underhook control

## State Invariants
- Chest connected to opponent's back
- Opponent facing away from you
- Control of upper body through harness grip
- Control of hips through hooks or body triangle

## Defensive Responses (When Opponent Has This State)
- [[Hand Fighting Defense]] → [[Escape Position]]
- [[Hook Removal]] → [[Half Guard Recovery]]
- [[Chair Sit Escape]] → [[Guard Recovery]]
- [[Rolling Escape]] → [[Guard Recovery]] or [[Scramble]]

## Offensive Transitions (Available From This State)
- [[Rear Naked Choke]] → [[Won by Submission]]
- [[Bow and Arrow Choke]] → [[Won by Submission]]
- [[Armbar from Back]] → [[Armbar Control]]
- [[Triangle from Back]] → [[Triangle Control]]
- [[Transition to Mount]] → [[Mount]]
- [[Crucifix Transition]] → [[Crucifix Control]]
- [[Back Triangle]] → [[Triangle Control]]

## Counter Transitions
- [[Re-establish Back Control]] → [[Back Control]] (against escape attempts)
- [[Switch to Technical Mount]] → [[Technical Mount]] (if control compromised)
- [[Switch to Turtle Top]] → [[Turtle Top]] (if opponent turns to knees)

## Expert Insights
- **Danaher System**: Emphasizes a systematic approach to controlling defensive structures before attempting submissions. The "straitjacket system" focuses on controlling both of the opponent's arms to eliminate defensive options before attacking the neck. Emphasizes the body triangle over hooks for maximum control.
- **Gordon Ryan**: Known for exceptional back control retention and ability to maintain the position for extended periods. Uses precise weight distribution and a methodical approach to breaking down defensive hand fighting. Often transitions between harness grip and a modified cross grip to create submission entries.
- **Eddie Bravo**: Incorporates unique control mechanisms such as the "Zombie Control" and modified harness grips. Focuses on the body triangle and creating angles for submissions, with an emphasis on unconventional finish variations like the "Invisible Collar" choke.

## Common Errors
- Losing chest-to-back connection → Position compromise
- High hooks that allow opponent to turn → Loss of control
- Overcommitting to submission attempts → Escape opportunities
- Poor harness control → Ineffective upper body control
- Crossing feet in front of opponent → Vulnerability to leg locks

## Training Drills
- Back control maintenance against increasing resistance
- Transition cycles between different back control variations
- Hand fighting sequences and submission entries
- Escape prevention and recovery drills
- Body triangle control and pressure development

## Related States
- [[Back Mount]] - Back control with opponent flat on stomach
- [[Technical Back Mount]] - Modified back control with opponent on side
- [[Crucifix]] - Specialized back control with arm isolation
- [[Body Triangle]] - Specific back control configuration with legs
- [[Turtle Top]] - Controlling opponent in defensive turtle position

## Decision Tree
If opponent defends neck with both hands:
- Execute [[Arm Trap to RNC]] or [[Transition to Armbar]]

Else if opponent attempts to turn into you:
- Execute [[Hip Switch]] → [[Technical Back Mount]]

Else if opponent tries to peel hooks:
- Execute [[Body Triangle]] or [[Switch to Crucifix]]

Else (full control established):
- Execute [[Rear Naked Choke]] or [[Bow and Arrow Choke]]

## Position Metrics
- Success Rate: 90% retention (competition data)
- Average Time in Position: 2-3 minutes
- Submission Probability: 70%
- Positional Advancement Probability: 20% (to mount/crucifix)
- Position Loss Probability: 10%

## Optimal Submission Paths
The shortest path to submission from this position:
[[Back Control]] → [[Rear Naked Choke]] → [[Won by Submission]]

High-percentage path:
[[Back Control]] → [[Arm Trap]] → [[Rear Naked Choke]] → [[Won by Submission]]

Alternative path:
[[Back Control]] → [[Bow and Arrow Grip]] → [[Bow and Arrow Choke]] → [[Won by Submission]]

## Computer Science Analogy
Back control can be modeled as a directed graph with high asymmetry, where the controlling player has many offensive edges (transitions to submissions) while the controlled player has very few viable escape edges. This makes back control a state with exceptional expected value when analyzed through a game theory lens.
