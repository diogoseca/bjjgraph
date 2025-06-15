# Standing Position
#bjj #state #neutral #takedown #standing

## State Properties
- **State ID**: S044
- **Point Value**: 0 (Neutral)
- **Position Type**: Neutral starting position
- **Risk Level**: Medium
- **Energy Cost**: Medium to High
- **Time Sustainability**: Medium to Long

## State Description
The Standing Position represents the fundamental neutral starting state in BJJ and grappling. This position is characterized by both practitioners standing upright and engaging through various grips, postures, and movements while seeking advantageous entries to ground exchanges. In competition, this is typically the position where matches begin and can also result from stand-ups or resets. The Standing Position encompasses a wide range of specific scenarios depending on grip configurations, stance, and relative positioning, but generally involves both practitioners seeking to establish dominant grips, create off-balancing opportunities, and set up either takedowns or tactical guard pulls. This position serves as the gateway to all subsequent BJJ exchanges and requires a unique blend of skills that differ from ground-based grappling.

## Key Principles
- Establish proper base and balance through effective stance
- Control distance through strategic footwork and movement
- Secure advantageous grips while denying opponent's grip objectives
- Create and exploit off-balancing opportunities
- Maintain defensive posture to prevent easy takedowns
- Recognize and capitalize on transition opportunities
- Manage energy through efficient movement and grip fighting

## Prerequisites
- Understanding of proper stance mechanics
- Grip fighting fundamentals
- Recognition of takedown opportunities
- Defensive awareness against common attacks
- Balance and base development

## State Invariants
- Both practitioners in upright posture
- No ground contact except feet
- Dynamic engagement through movement and grips
- Neutral starting point for exchanges
- Various grip configurations possible

## Defensive Responses (When Opponent Has This State)
- [[Grip Fighting]] → [[Grip Advantage]]
- [[Distance Management]] → [[Safe Range]]
- [[Defensive Stance]] → [[Takedown Prevention]]
- [[Sprawl Ready Position]] → [[Takedown Defense]]
- [[Collar Tie Counter]] → [[Tie-Up Negation]]

## Offensive Transitions (Available From This State)
- [[Double Leg Entry]] → [[Double leg takedown]]
- [[Single Leg Setup]] → [[Single Leg Takedown]]
- [[Collar Drag]] → [[Top Position]]
- [[Arm Drag]] → [[Back Control Standing]]
- [[Pull Guard]] → [[Closed Guard Bottom]]
- [[Foot Sweep]] → [[Osoto Gari]]
- [[Hip Throw Setup]] → [[Seoi Nage]]
- [[Ankle Pick]] → [[Top Position]]
- [[Snap Down]] → [[Front Headlock]]
- [[Pull to Single Leg X]] → [[Single Leg X Guard]]

## Counter Transitions
- [[Re-establish Neutral]] → [[Standing Position]] (after defending)
- [[Defensive Grip Break]] → [[Grip Fighting]] (when grips compromised)
- [[Level Change Counter]] → [[Sprawl]] (against shots)

## Expert Insights
- **Danaher System**: Emphasizes the critical importance of grip fighting as the foundation for all standing exchanges. Focuses on systematic approaches to establishing dominant grips that facilitate specific takedown entries while denying the opponent's preferred grips. Creates a methodical connection between standing exchanges and ground transitions, viewing the standing position as the first phase of a continuous grappling sequence.
- **Gordon Ryan**: Approaches the standing position with a strategic mindset that balances takedown threats with tactical guard pulling. Emphasizes the importance of grip sequencing and timing, particularly focusing on using false attacks to set up primary offensive options. Often employs the standing position to initiate leg entanglement entries through specialized pulling techniques.
- **Eddie Bravo**: Has developed specialized approaches to the standing position that prioritize entries to 10th Planet-specific positions. Emphasizes the importance of developing tactics that bridge the gap between conventional takedown approaches and the unique requirements of no-gi submission grappling. Often focuses on direct entries to leg entanglements and front headlock positions.

## Common Errors
- Poor posture → Vulnerability to takedowns
- Neglecting grip fighting → Loss of control
- Stationary positioning → Predictable patterns
- Overextended stance → Balance compromise
- Telegraphing intentions → Defensive reads

## Training Drills
- Grip fighting sequences with progressive resistance
- Movement patterns that maintain balance while creating angles
- Stance transitions under varying pressure
- Defensive reaction drills against common takedown entries
- Grip to technique flow sequences

## Related States
- [[Double leg takedown]] - Common takedown from standing
- [[Single Leg Takedown]] - Fundamental takedown option
- [[Pull guard]] - Strategic transition to ground
- [[Front Headlock]] - Standing control position
- [[Clinch Position]] - Close-range standing control

## Decision Tree
If opponent establishes collar tie:
- Execute [[Collar Tie Counter]] or [[Snap Down]]

Else if opponent bends at waist:
- Execute [[Double Leg Entry]] or [[Front Headlock]]

Else if opponent has wide stance:
- Execute [[Single Leg Setup]] or [[Ankle Pick]]

Else if opponent maintains upright posture:
- Execute [[Collar Drag]] or [[Hip Throw Setup]]

Else if takedown not available:
- Execute [[Pull Guard]] or [[Pull to Single Leg X]]

## Position Metrics
- Success Rate: 50% offensive transition probability (neutral position)
- Average Time in Position: 30-120 seconds
- Takedown Probability: 40%
- Guard Pull Probability: 45%
- Defensive Maintenance Probability: 50%

## Optimal Paths
Takedown path:
[[Standing Position]] → [[Double Leg Entry]] → [[Double leg takedown]] → [[Side Control]] → dominant position sequence

Guard pull path:
[[Standing Position]] → [[Pull Guard]] → [[Closed Guard Bottom]] → submission attack sequence

Modern entanglement path:
[[Standing Position]] → [[Pull to Single Leg X]] → [[Single Leg X Guard]] → [[Ashi Garami]] → leg lock sequence

## Rules Considerations
Standing Position tactics vary significantly between rulesets:
- IBJJF: Limited leg reaping options, no heel hooks, double guard pulls penalized
- ADCC: Increased standing time requirements, penalties for guard pulling in certain rounds
- MMA: Striking considerations dramatically change grip fighting and posture
- Self-defense: Environmental factors and multiple opponent considerations

## Computer Science Analogy
The Standing Position represents the "initial state" in the BJJ state machine, serving as the root node in the decision tree of grappling exchanges. This creates a high-branching factor state where multiple pathways with varying probabilities must be constantly evaluated. The position implements a form of "heuristic search algorithm" where practitioners must estimate the value of potential state transitions (takedowns, pulls, etc.) with incomplete information. The continuous nature of standing exchanges creates a "real-time strategy" scenario requiring constant adaptation to changing grip configurations and positional dynamics.
