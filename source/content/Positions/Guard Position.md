# Guard Position
#bjj #state #guard #fundamental

## State Properties
- **State ID**: S064
- **Point Value**: 0 (Neutral position)
- **Position Type**: Defensive with offensive options
- **Risk Level**: Low to Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Long

## State Description
The Guard Position represents the foundational defensive structure in Brazilian Jiu-Jitsu where the bottom practitioner uses their legs as barriers between themselves and the opponent to prevent being pinned or controlled. Unlike specific guard variations (closed, butterfly, open, etc.), the Guard Position encompasses the broader strategic framework of using the legs to control distance, create offensive opportunities, and neutralize the opponent's positional advantage. It serves as both a defensive sanctuary and an offensive launching pad, allowing a practitioner to manage risk while developing attacks from the bottom. The Guard Position is a defining feature of BJJ that distinguishes it from other grappling arts by enabling effective offense from the bottom.

## Key Principles
- Control the distance between you and your opponent
- Establish and maintain effective defensive barriers with legs
- Create and exploit angles through hip movement
- Control the opponent's posture and balance
- Threaten multiple offensive pathways simultaneously
- Prevent the opponent from establishing passing grips and pressure
- Connect upper and lower body control systems
- Transition between guard variations as needed

## Prerequisites
- Hip mobility and leg dexterity
- Understanding of framing mechanics
- Proper back positioning
- Base awareness and maintenance
- Grip fighting fundamentals

## State Invariants
- Legs positioned between you and opponent
- Back protected (on ground or supported)
- Maintenance of some form of defensive structure
- Control of distance and space
- Not in a fully passed position

## Defensive Responses (When Opponent Has This State)
- [[Guard Pass Attempt]] → [[Headquarters Position]]
- [[Pressure and Smash]] → [[Stack Pass]]
- [[Standing Pass]] → [[Toreando Pass]]
- [[Closed Guard Break]] → [[Combat Base]]
- [[Leg Drag Entry]] → [[Leg Drag Position]]

## Offensive Transitions (Available From This State)
- [[Sweep Attempt]] → [[Top Position]]
- [[Submission Entry]] → Various submission controls
- [[Guard Variation Transition]] → Specific guard positions
- [[Technical Stand-up]] → [[Standing Position]]
- [[Pull to Closed Guard]] → [[Closed Guard Bottom]]
- [[Butterfly Entry]] → [[Butterfly Guard]]
- [[Half Guard Recovery]] → [[Half Guard Bottom]]
- [[De La Riva Entry]] → [[De La Riva Guard]]
- [[Single Leg X Entry]] → [[Single Leg X Guard]]

## Counter Transitions
- [[Guard Retention]] → [[Guard Position]] (against pass attempts)
- [[Guard Recovery]] → [[Guard Position]] (from compromised positions)
- [[Re-guard Sequence]] → [[Guard Position]] (after defensive movement)

## Expert Insights
- **Danaher System**: Conceptualizes the guard as a comprehensive control system with clear defensive hierarchies and strategic offensive pathways. Emphasizes understanding the guard as a single interconnected system rather than isolated positions, with each guard variation serving specific tactical purposes within the larger framework. Focuses on systematically developing both defensive competence and offensive capabilities.
- **Gordon Ryan**: Approaches the guard as a dynamic position of constant adaptation and threat creation. Emphasizes a "connection-based" guard system where maintaining points of control on the opponent takes precedence over adhering to named guard positions. Creates a seamless flow between different guard variations based on the opponent's reactions and available grips.
- **Eddie Bravo**: Has developed an alternative approach to guard play through his 10th Planet system, emphasizing specialized control positions like the Rubber Guard and Williams Guard. Views the guard through the lens of "control chains" where specific sequences of movements create predictable response patterns that can be exploited.

## Common Errors
- Static positioning → Predictable patterns easily passed
- Overextension of limbs → Vulnerability to isolations and submissions
- Poor distance management → Inability to control opponent's pressure
- Disconnected upper and lower body → Passing lanes
- Passive defensive mindset → Limited offensive development
- Overcommitment to specific guard variations → Inflexible response patterns
- Neglecting grip fighting → Opponent control establishment

## Training Drills
- Guard retention against progressive passing pressure
- Transition flows between guard variations
- Offensive sequence development from various guards
- Distance management cycles
- Guard recovery from compromised positions
- Grip fighting progressions
- Submission entry timing drills

## Related States
- [[Closed Guard Bottom]] - Specific guard with legs wrapped around opponent
- [[Open Guard Bottom]] - Broader category of guards with extended legs
- [[Butterfly Guard]] - Specialized guard with hooks under opponent's thighs
- [[Half Guard Bottom]] - Partial guard with one leg trapped
- [[Guard Recovery]] - Transitional state returning to guard positions

## Decision Tree
If opponent stands tall in your guard:
- Transition to [[Open Guard Bottom]] with [[De La Riva Entry]] or [[Single Leg X Entry]]

Else if opponent maintains low pressure in your guard:
- Transition to [[Closed Guard Bottom]] or [[Butterfly Guard]]

Else if opponent attempts to pass with pressure:
- Execute [[Guard Retention]] → maintain [[Guard Position]]

Else if opponent establishes partial pass:
- Execute [[Guard Recovery]] → return to specific guard variation

## Position Metrics
- Success Rate: 65% retention against pass attempts (competition data)
- Average Time in Position: 1-4 minutes
- Sweep Probability: 40%
- Submission Probability: 30%
- Position Loss Probability: 35%

## Optimal Paths
Sweep-oriented path:
[[Guard Position]] → [[Butterfly Guard]] → [[Butterfly Sweep]] → [[Top Position]] → dominant position chain

Submission-oriented path:
[[Guard Position]] → [[Closed Guard Bottom]] → [[Triangle Setup]] → [[Triangle Control]] → [[Won by Submission]]

Modern competition path:
[[Guard Position]] → [[Single Leg X Entry]] → [[Single Leg X Guard]] → [[Technical Stand-up Sweep]] → [[Top Position]] → passing sequence

## Computer Science Analogy
The Guard Position functions as an abstract base class in object-oriented programming, defining a common interface and shared properties that are inherited and specialized by concrete guard variations (derived classes). This creates a polymorphic relationship where specific guard types implement the core defensive and offensive principles in unique ways while maintaining the fundamental characteristics of the parent class. The guard system as a whole represents a form of dynamic dispatch where the appropriate specialized behavior (guard variation) is selected at runtime based on the current context (opponent's actions and available grips/frames).
