# Guillotine Control
#bjj #state #submission #choke #guillotine

## State Properties
- **State ID**: S027
- **Point Value**: 2 (Advantageous submission control)
- **Position Type**: Submission control position
- **Risk Level**: Medium
- **Energy Cost**: Medium to High
- **Time Sustainability**: Short to Medium

## State Description
Guillotine Control is a powerful submission position where one practitioner controls their opponent's head and neck in a front headlock-type position with the intent to apply a strangle. The controlling practitioner wraps one arm around the opponent's neck, typically with the forearm against the throat, while securing their choking arm with their other hand. This position can be established from numerous scenarios including sprawls, guard positions, and scrambles, making it one of the most versatile submission controls in BJJ. The position serves as both an immediate submission threat and a powerful positional control mechanism.

## Key Principles
- Secure deep grip around opponent's neck
- Position choking arm properly against carotid arteries
- Maintain proper wrist/arm alignment for maximum leverage
- Control opponent's posture and mobility
- Establish body position that complements the choke
- Apply strategic pressure to prevent escapes
- Manage energy expenditure during control phase

## Prerequisites
- Understanding of proper guillotine mechanics
- Grip strength and endurance
- Recognition of entry opportunities
- Knowledge of finishing mechanics from various positions

## State Invariants
- Control of opponent's head and neck with one arm
- Gripping configuration to secure the choking arm
- Posture control preventing opponent's escape
- Choking arm positioned against neck/carotid arteries
- Wrist typically flexed to create wedge in neck

## Defensive Responses (When Opponent Has This State)
- [[Von Flue Counter]] → [[Von Flue Position]]
- [[Posture and Pop]] → [[Neutral Position]]
- [[Stack Defense]] → [[Top Position]]
- [[Two-on-One Grip Break]] → [[Grip Fighting]]
- [[Roll to Guard]] → [[Top Closed Guard]]

## Offensive Transitions (Available From This State)
- [[Arm-in Guillotine]] → [[Won by Submission]]
- [[High-Elbow Guillotine]] → [[Won by Submission]]
- [[Guillotine to Mount]] → [[Mounted Guillotine]]
- [[Guillotine to Closed Guard]] → [[Closed Guard Guillotine]]
- [[Front Headlock Transition]] → [[Front Headlock]]
- [[Guillotine to D'arce]] → [[D'arce Control]]
- [[Guillotine to Anaconda]] → [[Anaconda Control]]
- [[Marcelotine Adjustment]] → [[Won by Submission]]

## Counter Transitions
- [[Re-establish Guillotine]] → [[Guillotine Control]] (against escapes)
- [[Switch to Front Headlock]] → [[Front Headlock]] (if submission fails)
- [[Transition to Arm Triangle]] → [[Arm Triangle]] (based on defense)

## Expert Insights
- **Danaher System**: Emphasizes the guillotine as part of the "Front Headlock System" where proper mechanical alignment is prioritized over strength. Creates a systematic approach to guillotine variations based on the opponent's defensive reactions and arm positioning relative to the neck. Focuses particularly on the high-elbow variation for its mechanical efficiency.
- **Gordon Ryan**: Utilizes the guillotine extensively within his submission system, emphasizing the proper wrist positioning and body alignment to maximize leverage. Often connects the guillotine threat with other front headlock attacks to create a decision tree that forces predictable defensive responses.
- **Eddie Bravo**: Incorporates guillotine control within the 10th Planet system with unique setups and configurations. Emphasizes the rubber guard as a pathway to specialized guillotine variations and connects the position to other 10th Planet-specific techniques like the Twister and Truck.

## Common Errors
- Insufficient wrist flexion → Reduced choking pressure
- Squeezing with arms only → Energy inefficiency
- Poor body positioning → Leverage compromise
- Telegraphing submission intent → Defensive counters
- Overcommitment to single variation → Adaptability limitations

## Training Drills
- Guillotine entry and control maintenance with progressive resistance
- Transition flows between guillotine and related submissions
- Body positioning and alignment exercises
- Defensive recognition and counter drills
- Energy management and grip endurance development

## Related States
- [[Front Headlock]] - Related control position
- [[Mounted Guillotine]] - Positional variation
- [[Closed Guard Guillotine]] - Positional variation
- [[Arm Triangle]] - Related head and arm submission
- [[D'arce Control]] - Related front headlock submission

## Decision Tree
If opponent's arm is inside (between bodies):
- Execute [[Arm-in Guillotine]] or [[Guillotine to D'arce]]

Else if opponent postures up:
- Execute [[High-Elbow Guillotine]] or [[Marcelotine Adjustment]]

Else if opponent drives forward with pressure:
- Execute [[Guillotine to Closed Guard]] or [[Guillotine to Mount]]

Else if opponent attempts to grip fight:
- Execute [[Front Headlock Transition]] or [[Guillotine to Anaconda]]

## Position Metrics
- Success Rate: 65% submission or advancement (competition data)
- Average Time in Position: 10-30 seconds
- Submission Probability: 50%
- Counter Vulnerability: 25%
- Position Loss Probability: 20%

## Optimal Paths
Standard submission path:
[[Guillotine Control]] → [[High-Elbow Guillotine]] → [[Won by Submission]]

Mounted variation path:
[[Guillotine Control]] → [[Guillotine to Mount]] → [[Mounted Guillotine]] → [[Won by Submission]]

Guard variation path:
[[Guillotine Control]] → [[Guillotine to Closed Guard]] → [[Closed Guard Guillotine]] → [[Won by Submission]]

## Computer Science Analogy
The Guillotine Control represents a specialized node in the BJJ state graph with multiple pathways to terminal submission states. It implements a "branch and bound" algorithm concept where initial control (bounding) creates constraints on the opponent's movement, while variations (branching) allow adaptation to defensive reactions. This creates a decision tree optimization problem where path selection is based on opponent's defensive patterns, with multiple valid solutions to reach the terminal state (submission).
