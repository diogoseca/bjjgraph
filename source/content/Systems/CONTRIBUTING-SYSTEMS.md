# System Standard V2 for BJJ State Machine
#bjj #standard #systems #statemachine

## Overview
This document defines the required structure and content for all system files in the BJJ state machine. Systems represent comprehensive attack or defense frameworks that chain multiple techniques together based on expert methodologies (e.g., Danaher's Back Attack System, Gordon Ryan's Guard Passing System). Every system must include the standardized elements below to ensure proper integration with state machine processing, decision tree logic, and comprehensive strategic documentation.

## YAML Frontmatter (Required)

### Required Fields

All system files must begin with YAML frontmatter for SEO and metadata:

```yaml
---


<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "System Standard V2 for BJJ State Machine",
  "description": "This document defines the required structure and content for all system files in the BJJ state machine. Systems represent comprehensive attack or defense frameworks that chain multiple techniques t...",
  "url": "https://bjjgraph.com/systems/contributing-systems",
  "isPartOf": {
    "@type": "WebSite",
    "name": "BJJ Graph",
    "url": "https://bjjgraph.com"
  }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://bjjgraph.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Systems",
      "item": "https://bjjgraph.com/systems/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "System Name",
      "item": "https://bjjgraph.com/systems/contributing-systems"
    }
  ]
}
</script>


title: "System Name | BJJ System | BJJ Graph"
description: "Master System Name in BJJ. Comprehensive framework connecting multiple techniques and positions for high-percentage outcomes."
---
```

### Field Definitions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | SEO-optimized system title | `"Kimura Trap System | BJJ System | BJJ Graph"` |
| `description` | string | Meta description (150-160 chars) emphasizing comprehensive framework | `"Master Kimura Trap System in BJJ. Comprehensive framework connecting Kimura control to multiple submissions and back takes."` |

## Required Properties for State Machine

### Chain Properties
- **Chain ID**: Unique identifier (format: SC###, e.g., SC009)
- **System Name**: Clear, descriptive name matching filename
- **Primary Submissions**: List of main finishing techniques (minimum 2)
- **Starting Positions**: Positions from which system can be initiated
- **Difficulty Level**: [Beginner/Intermediate/Advanced/Beginner to Advanced]
- **Strategic Value**: [Low/Medium/High/Extremely High] - competitive and training importance

### System Classification
- **System Type**: [Attack/Defense/Passing/Guard/Control] - primary tactical purpose
- **Expert Attribution**: [Danaher/Gordon Ryan/Eddie Bravo/Multiple] - methodology source
- **Skill Level Requirements**: Technical prerequisites for effective implementation
- **Competition Applicability**: [IBJJF/ADCC/MMA/No-Gi/Gi/Universal] - rule set compatibility

## System Description

### Comprehensive Overview
Detailed explanation covering:
- **Strategic Foundation**: What makes this system comprehensive and effective
- **Positional Dominance**: Why these positions create systemic advantage
- **Mechanical Integration**: How techniques connect within the framework
- **Adaptability**: How system handles different body types, defensive styles, contexts
- **Philosophical Basis**: Expert philosophy underlying the systematic approach

**Template**: "The [System Name] represents [strategic value proposition], built around [core positions/principles]. This system encompasses [scope of techniques] that addresses [tactical problems solved]. What distinguishes this system is [unique advantages]. The system operates from [starting positions], offering [submission pathways] that [how techniques chain together]."

### Core Mechanical Principles
3-7 fundamental concepts that govern the entire system:
- **Control Principle**: How system maintains dominant positioning
- **Attack Sequencing**: Logic for chaining techniques
- **Defensive Neutralization**: How system breaks opponent's defensive resources
- **Space Management**: Creating/eliminating space strategically
- **Energy Efficiency**: Sustainable pressure and control mechanics
- **Adaptability Framework**: Responding to defensive variations
- **Incremental Progression**: Building toward submissions systematically

Format: Bullet list with principle name and 1-2 sentence explanation

## Submission Sequence (Structured Data)

### Primary Attack Chain
Ordered sequence of submissions based on defensive reactions:

1. **Primary Attack**: [[Submission Name]]
   - Execution focus: Specific technical emphasis
   - Success Rate: Beginner X%, Intermediate Y%, Advanced Z%
   - Defensive triggers: What opponent does that triggers transition

2. **Secondary Attack**: [[Submission Name]]
   - Transition mechanics: How to flow from primary to secondary
   - Execution focus: Technical adjustment or alternative approach
   - Success Rate: Beginner X%, Intermediate Y%, Advanced Z%
   - Defensive triggers: Opponent response pattern

3. **Tertiary Attack**: [[Submission Name]]
   - Transition mechanics: Connection from secondary or primary
   - Execution focus: Exploitation of specific defensive commitment
   - Success Rate: Beginner X%, Intermediate Y%, Advanced Z%
   - Defensive triggers: Final defensive option exploited

(Continue for additional attacks as applicable - minimum 2, typically 3-5)

### Alternative Pathways
Non-submission options within system:
- **Position Improvements**: Transitions to better controlling positions
- **Control Recaptures**: Resetting to system entry points
- **System Maintenance**: Preventing escapes while maintaining attack threats

## Decision Tree (LLM Context Block)

### Extensive Branching Logic
Comprehensive if/then structure for AI decision-making:

```
Primary Defense Response:
- If opponent defends [specific action] with [defensive technique]:
  → Execute [[Attack/Adjustment]] (Probability: X%)
  → Reasoning: [Why this response is optimal]

Alternative Defense Response:
- If opponent defends [different action] with [alternative defense]:
  → Execute [[Attack/Adjustment]] (Probability: Y%)
  → Reasoning: [Mechanical advantage explanation]

Escape Attempt Response:
- If opponent attempts [escape type]:
  → Counter with [[Technique]] → [[Result State]] (Probability: Z%)
  → Reasoning: [How this maintains system control]

Space Creation Response:
- If opponent creates [type of space]:
  → Eliminate space via [[Control Method]] (Probability: X%)
  → Reasoning: [Why space elimination is critical]

Positional Adjustment Response:
- If opponent achieves [positional change]:
  → Transition to [[System Variation]] (Probability: Y%)
  → Reasoning: [How system adapts while maintaining framework]

Energy/Fatigue Consideration:
- If opponent shows fatigue indicators:
  → Increase pressure via [[Method]] → Higher submission probability (+10-15%)
  → Reasoning: [How fatigue creates submission windows]

System Reset:
- If position is compromised but control maintained:
  → Reset to [[Starting Position]] → Re-initiate system (Probability: Z%)
  → Reasoning: [Sustainable attacking approach]
```

### Decision Priority Framework
Hierarchical decision-making logic:
1. **Maintain Control**: Position retention takes priority over submission attempts
2. **Recognize Defensive Pattern**: Identify opponent's primary defense strategy
3. **Select Attack Path**: Choose submission based on defensive commitment
4. **Adapt to Response**: Adjust technique based on real-time reaction
5. **Chain to Alternative**: Flow to secondary attack if primary is defended
6. **Consolidate or Reset**: Secure position or restart system sequence

## Expert Insights

### System-Specific Commentary
Deep analysis from three perspectives:

- **Danaher System**: [2-4 sentences] Focus on systematic methodology, mechanical precision, breaking defensive structures methodically, specific grip configurations, sustainable attacking platforms, treatment as problem-solving process rather than isolated techniques. Emphasize how this expert approaches the strategic framework.

- **Gordon Ryan**: [2-4 sentences] Focus on competitive effectiveness, high-percentage application under elite resistance, patience and incremental improvements, specific competitive adaptations, refinements that maximize finishing rates. Emphasize proven success in elite competition contexts.

- **Eddie Bravo**: [2-4 sentences] Focus on innovative entries, unconventional control variations, signature technique integration, 10th Planet system connections, creative responses to modern defenses. Emphasize unique perspectives that expand traditional approaches.

### Cross-System Integration
How this system connects to other frameworks:
- **Complementary Systems**: Other systems that pair effectively
- **Entry Combinations**: Position sequences that lead to system initiation
- **Defensive Counters**: How to defend against this system (for educational completeness)

## Setup Positions

### System Entry Points
Positions from which system can be initiated:

- [[Position Name]] → [Entry mechanism] → [[System Starting Position]]
- [[Position Name]] → [Entry mechanism] → [[System Starting Position]]
- [[Position Name]] → [Entry mechanism] → [[System Starting Position]]

(Minimum 3 entry points, typically 4-8)

Format: `[[Starting Position]] → [Technical action/transition] → [[System Control Position]]`

### Entry Requirements
Conditions necessary for successful system initiation:
- **Positional Control**: Minimum control requirements
- **Grip Establishment**: Essential grips or contact points
- **Opponent State**: Favorable opponent positioning
- **Timing Windows**: When entry is most effective

## Common Defensive Reactions

### Opponent Response Catalog
Comprehensive defensive patterns with system responses:

- **Defense Type 1**: [Specific defensive action] → [System response with technique] → [Outcome probability]
- **Defense Type 2**: [Specific defensive action] → [System response with technique] → [Outcome probability]
- **Defense Type 3**: [Specific defensive action] → [System response with technique] → [Outcome probability]

(Minimum 5 defensive reactions, typically 7-10)

Format: `[Defensive Action] → [System Counter/Adjustment] → [Result with probability if applicable]`

### Defensive Pattern Recognition
Teaching pattern recognition for adaptive response:
- **Hand Fighting Patterns**: Grip fighting strategies and counters
- **Space Creation Attempts**: How opponents create frames and separation
- **Positional Escapes**: Common escape sequences and neutralization
- **Counter-Attack Responses**: Aggressive defensive reactions
- **Energy Management**: How opponents conserve/expend energy defensively

## Training Methodology

### Progressive Skill Development
Structured learning pathway:

- **Conceptual Understanding**: Study system philosophy and mechanical principles
- **Isolated Technique Practice**: Master individual submissions independently
- **Positional Sparring**: System-specific position training with increasing resistance
- **Transition Flow Drills**: Chain techniques smoothly based on defensive patterns
- **Submission Chains**: Practice attack sequences without pausing
- **Defensive Recognition**: Identify and respond to specific defensive patterns
- **Live Integration**: Apply system during regular sparring
- **Video Analysis**: Study high-level application in competition

### Drilling Protocols
Specific training exercises:
- **Setup Sequences**: Repeatedly practice entries from various positions
- **Defensive Break Drills**: Practice stripping grips and eliminating frames
- **Submission Flows**: Continuous movement between attacks
- **Escape Prevention**: Maintain control against attempted escapes
- **Timing Development**: Recognize optimal windows for technique execution
- **Pressure Application**: Build sustainable, methodical pressure

### Coaching Cues
Key reminders for instruction:
- "[Control principle reminder]"
- "[Technical detail emphasis]"
- "[Common error prevention]"
- "[Strategic patience guidance]"
- "[Mechanical efficiency focus]"

## Competition Application

### Competitive Effectiveness
Real-world success analysis:

Discuss statistical effectiveness, competition data, high-level examples of success, why system works against informed defenders, psychological advantages created, strategic value across competition formats (IBJJF, ADCC, MMA), adaptations for different rule sets.

**Template**: "The [System Name] [demonstrates/remains/has shown] [effectiveness evidence] across [competition contexts]. Analysis [reveals/shows] [statistical data or trends]. The system demonstrates [specific strengths] in [competitive situations] where [other approaches fail/succeed less frequently]. When properly executed, [mechanical advantages] allow it to succeed even against [elite defensive capabilities]. [Additional competitive advantages like psychological impact, defensive safety, strategic positioning]."

### Strategic Considerations
Competitive tactics and timing:
- **Match Stage Application**: When to initiate system during match
- **Point Position**: How system affects scoring opportunities
- **Time Management**: Using system for strategic time control
- **Opponent Scouting**: Pre-match preparation for system application
- **Risk/Reward Analysis**: When system provides optimal advantage

## Computer Science Analogy

### Technical Framework Analysis
Systematic analysis using CS/engineering concepts:

Explain the system using analogies from computer science, game theory, optimization algorithms, security systems, state machines, or engineering principles. This section helps technically-minded practitioners understand the systematic logic.

**Template**: "The [System Name] exemplifies [CS/engineering concept] in [field]. [Detailed analogy explaining how system mirrors technical concept]. From a [perspective] standpoint, [technical analysis]. The relationship between [system elements] demonstrates [concept], where [specific mechanism]. In terms of [framework], the system implements [approach], where [detailed explanation]. From a [theory] perspective, [strategic analysis explaining fundamental advantages]."

Examples of useful analogies:
- **State Machine Analysis**: Node advantages, transition probabilities, terminal states
- **Resource Exhaustion**: Depleting defensive resources systematically
- **Optimization Algorithms**: Gradient descent toward submission
- **Game Theory**: Dominant strategies, Nash equilibria
- **Security Concepts**: Privilege escalation, attack surfaces
- **Network Topology**: Hub-and-spoke attacking structures

### Algorithmic Properties
System characteristics from computational perspective:
- **Convergence**: How system inevitably leads toward submission
- **Robustness**: Resilience against defensive variations
- **Efficiency**: Optimal path through technique space
- **Scalability**: Effectiveness across skill levels
- **Determinism**: Predictable outcomes from specific inputs

## LLM Integration Elements

### Narrative Generation Prompts
Context for AI story generation:
- **Position Establishment**: "You secure [position], feeling [sensations]. Your opponent [reactions]."
- **Attack Initiation**: "You begin [technique], systematically [mechanical action]. [Opponent state]."
- **Defensive Response**: "Your opponent defends by [action], but you [counter], maintaining [control]."
- **Submission Progression**: "You increase pressure through [method], and your opponent [response leading to tap/escape/continuation]."

### Image Generation Context
Detailed descriptions for visual AI:
- **Key Positions**: Specific body configurations for visualization
- **Transition Moments**: Critical frames showing technique execution
- **Submission Details**: Hand positions, body angles, pressure application
- **Spatial Relationships**: Relative positioning of both athletes

### Audio Narration Cues
Dynamic language for TTS:
- **Action Verbs**: Explosive, technical, methodical descriptors
- **Tension Building**: Escalating pressure descriptions
- **Technical Commentary**: Real-time coaching and analysis
- **Outcome Resolution**: Clear finish or continuation language

## Validation Checklist

Every system file must include:
- [ ] YAML frontmatter with title and description
- [ ] All chain properties with specific values (SC###, submissions, positions)
- [ ] Comprehensive system description (minimum 3 paragraphs)
- [ ] 5-7 core mechanical principles
- [ ] Structured submission sequence with success rates (minimum 2 attacks)
- [ ] Extensive decision tree with minimum 6 branching conditions
- [ ] Expert insights from all three authorities (2-4 sentences each)
- [ ] Minimum 3 setup positions with entry mechanisms
- [ ] Minimum 5 common defensive reactions with system responses
- [ ] Complete training methodology with progressive development
- [ ] Competition application analysis
- [ ] Computer science analogy section
- [ ] LLM integration elements for game engine

## Complete Working Example

---

```yaml
---
title: "Back Attack System | BJJ System | BJJ Graph"
description: "Master Back Attack System in BJJ. Comprehensive framework connecting back control to multiple high-percentage submissions and dominant positions."
---
```

# Back Attack System
#bjj #submission #chain #back_control #back_attack #choke

## Chain Properties
- **Chain ID**: SC009
- **Primary Submissions**: [[Rear Naked Choke]], [[Bow and Arrow Choke]], [[Armbar from Back]], [[Triangle from Back]]
- **Starting Positions**: [[Back Control]], [[Turtle Top]], [[Technical Back Mount]]
- **Difficulty Level**: Beginner to Advanced
- **Strategic Value**: Extremely High

## Chain Description
The Back Attack System represents the most comprehensive and statistically dominant submission framework in Brazilian Jiu-Jitsu, built around the premier offensive position in grappling: back control. This system encompasses a complete attacking methodology that addresses all aspects of offensive back control, including the establishment and maintenance of the position, the systematic breakdown of defensive resources, and the execution of various submission attacks.

What distinguishes the Back Attack System is its exceptional positional dominance combined with high-percentage submission threats. Unlike many positions that offer either strong control or submission opportunities, back control provides both simultaneously at an unparalleled level. This creates a uniquely advantageous attacking platform where the practitioner can maintain positional superiority while systematically working through a progression of submission threats based on the opponent's defensive reactions.

The system operates from several related back control variations, including traditional back mount with hooks, the body triangle, technical back mount, and turtle-based back control. From these controlling positions, the system offers multiple submission pathways focusing primarily on strangulations (Rear Naked Choke, Bow and Arrow Choke, Collar Chokes) with complementary joint locks (Armbar, Kimura) that exploit common defensive patterns. This creates a comprehensive attacking framework with exceptional adaptability across body types, defensive styles, and competitive contexts.

## Core Mechanical Principles
- **Chest-to-Back Connection**: Maintaining persistent spinal alignment and connection eliminates defensive space and prevents opponent movement
- **Hip Control**: Controlling opponent's hip movement through hooks or body triangle removes their ability to generate escape power
- **Defensive Neutralization**: Systematically eliminating defensive hand fighting resources by stripping grips and removing frames
- **Space Elimination**: Removing all defensive space to maximize control and submission effectiveness through continuous pressure
- **Harness Control**: Establishing and maintaining upper body control through proper gripping mechanics (seatbelt, gift wrap variations)
- **Submission Chaining**: Connecting different submission threats based on defensive responses creates inevitable attacking sequences
- **Preventative Defense**: Anticipating and preventing common escape attempts before they develop momentum
- **Incremental Pressure**: Building control and submission pressure progressively rather than explosively maintains sustainability

## Submission Sequence
1. **Primary Attack**: [[Rear Naked Choke]]
   - Execution focus: Establishing proper seatbelt control and systematically eliminating hand defenses before choking
   - Success Rate: Beginner 60%, Intermediate 80%, Advanced 95%
   - Defensive triggers: Opponent defends by protecting neck with hands or chin tucking

2. **Secondary Attack**: [[Bow and Arrow Choke]] (Gi) or [[Short Choke]] (No-Gi)
   - Transition mechanics: Utilize collar grip or modified choke when opponent effectively defends RNC with two-on-one grip
   - Execution focus: Creating choking pressure through collar control or alternative arm positioning while maintaining back control
   - Success Rate: Beginner 45%, Intermediate 65%, Advanced 80%
   - Defensive triggers: Opponent successfully defends neck with strong grip fighting but exposes collar or body positioning

3. **Tertiary Attack**: [[Armbar from Back]]
   - Transition mechanics: Isolate and control arm when opponent focuses entirely on neck defense, creating joint lock opportunity
   - Execution focus: Maintaining back control while transitioning to proper armbar position without losing dominance
   - Success Rate: Beginner 40%, Intermediate 60%, Advanced 75%
   - Defensive triggers: Opponent overcommits both hands to neck protection, leaving arms vulnerable to isolation

## Decision Tree

Primary Rear Naked Choke Defense:
- If opponent defends RNC with two-on-one grip on choking arm:
  → Focus on systematically stripping grips OR transition to [[Bow and Arrow Choke]] (Probability: 65%)
  → Reasoning: Two-on-one grip prevents direct choke but exposes collar and body positioning for alternative attacks

Chin Tuck Defense:
- If opponent defends RNC by tucking chin aggressively:
  → Apply face covering variation creating discomfort OR transition to [[Short Choke]] (Probability: 70%)
  → Reasoning: Chin tuck prevents clean choke entry but creates pressure point opportunities and exhausts opponent

Rolling Escape Attempt:
- If opponent defends by rolling forward or sideways:
  → Follow movement maintaining chest-to-back connection and re-establish [[Back Control]] (Probability: 85%)
  → Reasoning: Rolling attempts create movement but rarely escape if connection maintained properly

Arm Isolation Opportunity:
- If opponent overcommits both arms to neck defense:
  → Attack isolated arm with [[Armbar from Back]] or [[Kimura from Back]] (Probability: 60%)
  → Reasoning: Overcommitment to neck creates joint lock vulnerabilities on extended limbs

Body Angle Defense:
- If opponent turns slightly creating angle change:
  → Adjust to [[Technical Back Mount]] and apply [[Bow and Arrow Choke]] (Probability: 65%)
  → Reasoning: Body angle change weakens direct RNC but optimizes collar chokes from technical mount

Space Creation Attempt:
- If opponent defends by creating separation between bodies:
  → Strengthen [[Body Triangle]] and reset attack sequence (Probability: 80%)
  → Reasoning: Space creation must be eliminated immediately to prevent escape development

Hook Peeling Defense:
- If opponent attempts to peel hooks systematically:
  → Switch to [[Body Triangle]] or adjust hook position to opposite configuration (Probability: 75%)
  → Reasoning: Hook peeling indicates escape attempt requiring immediate control reconfiguration

Energy Depletion Recognition:
- If opponent shows fatigue indicators (heavy breathing, slowed responses, weakening grips):
  → Increase submission pressure and tempo → Higher success probability (+10-15%)
  → Reasoning: Fatigue compromises defensive capability and creates finishing windows

System Reset Protocol:
- If position is compromised but some control maintained:
  → Reset to [[Turtle Top]] or [[Side Control]] → Re-initiate back taking sequence (Probability: 70%)
  → Reasoning: Sustainable attacking requires ability to recapture position rather than force compromised submissions

## Expert Insights
- **Danaher System**: John Danaher has revolutionized back attacking methodology through his comprehensive "Straitjacket System," which focuses on methodically breaking down defensive hand structures before attempting submissions. His approach emphasizes precise mechanical details in both the control and submission phases, treating back control as a systematic problem-solving process rather than a single technique. Danaher particularly focuses on specific grip configurations and body positioning that maximize control while minimizing energy expenditure, creating a sustainable attacking platform that can be maintained for extended periods against strong defensive opposition. The system prioritizes maintaining connection and incrementally improving position over explosive submission attempts.

- **Gordon Ryan**: As Danaher's most accomplished student, Ryan has refined the back attack system to unprecedented competitive effectiveness, demonstrating perhaps the highest percentage back control finishing rate in elite competition. His approach emphasizes creating and maintaining a specific "harness grip" from the back that provides maximum control while systematically eliminating defensive options. Ryan particularly focuses on patience and incremental improvements in position, often maintaining back control for extended periods while methodically breaking down defensive resources until submission becomes inevitable. His competitive success demonstrates that proper back control mechanics succeed even against fully informed elite defenders.

- **Eddie Bravo**: Within the 10th Planet system, Bravo has developed specialized back control mechanisms including his "Twister Side Control" and "Truck" positions that create unique entries to traditional back control. His system emphasizes unconventional entries to the back and specialized control variations that opponents are less familiar defending. When attacking from the back, Bravo focuses on creating control positions that facilitate his signature submissions, including the Twister and various Rubber Guard-based transitions that can be applied from back control variations. His approach brings innovation to traditional back attacking frameworks through non-standard control configurations.

## Setup Positions
- [[Turtle Top]] → Back exposure recognition → [[Back Control]]
- [[Side Control]] → Far-arm isolation and back taking sequence → [[Back Control]]
- [[Mount]] → Technical transition when opponent turns → [[Technical Back Mount]]
- [[Half Guard Top]] → Flattening control and back exposure → [[Back Taking Position]]
- [[Standing Rear Clinch]] → Takedown maintaining back position → [[Back Control]]
- [[Closed Guard Bottom]] → Sweep to [[Turtle Top]] → [[Back Control]]
- [[Butterfly Guard]] → Elevator sweep to turtle → [[Back Control]]
- [[X-Guard]] → Opponent stands and turns → [[Standing Back Control]]

## Common Defensive Reactions
- Hand fighting (two-on-one grip on choking arm) → Systematic grip stripping or transition to alternative choke like Bow and Arrow
- Chin tucking aggressively → Apply modified RNC with jaw pressure or transition to Short Choke creating discomfort
- Forward rolling escape attempt → Follow movement maintaining spinal connection to prevent separation
- Hip movement and bridging → Adjust hook placement immediately and maintain chest-to-back connection
- Attempting to turn into attacker → Recognize rotation and transition to technical mount or armbar position
- Creating separation by pushing on arms → Re-establish harness control and eliminate space through body triangle
- Peeling hooks systematically → Switch to body triangle or adjust hook position to opposite configuration
- Explosive stand-up attempt → Drag opponent back down using harness control and re-establish hooks
- Grabbing own collar defensively → Recognize grip and transition to alternative attack angles
- Shoulder walking escape → Prevent hip movement through tighter hook control and body triangle

## Training Methodology
- **Conceptual Foundation**: Study back control philosophy emphasizing systematic breakdown rather than explosive finishes
- **Progressive Back Control Sparring**: Position-specific training with increasing resistance from static to dynamic
- **Hand Fighting Sequences**: Isolated practice of stripping defensive grips and establishing choking positions
- **Transition Flow Drills**: Smooth movement between different back control variations and submission attempts
- **Submission Chain Drilling**: Continuous practice based on defensive recognition without resetting position
- **Escape Prevention Drills**: Maintain control against attempted escapes focusing on connection maintenance
- **Video Analysis**: Study high-level back control in competition identifying patterns and timing
- **Defensive Simulation**: Partner provides specific defensive responses to develop adaptive attack selection
- **System Integration**: Practice entries from various positions to complete attacking framework
- **Timing Development**: Recognize optimal windows for submission attempts based on defensive fatigue

## Competition Application
The Back Attack System remains the most statistically dominant positional framework across all levels of competition and all grappling formats. Analysis of competition data consistently shows that back control leads to the highest submission rates of any position, making it the ultimate positional goal in competitive grappling.

The system demonstrates exceptional effectiveness in high-level competition where other attacking approaches often fail against elite defensive skills. When properly executed, the mechanical dominance of back control allows it to succeed even against fully informed defenders who understand the attacking mechanics. This creates a uniquely powerful competitive tool, representing the position most likely to lead to definitive victory across all competitive contexts.

In MMA and combat sports contexts, back control offers the additional advantage of providing both offensive opportunities and defensive safety, with the controlling practitioner largely protected from strikes while maintaining powerful submission threats. This has established the back attack system as a cornerstone of effective MMA grappling strategy.

The psychological impact of back control creates additional competitive advantages beyond the direct submission threat. Competitors forced to defend the back often demonstrate increased respiratory rates, elevated stress responses, and compromised decision-making, creating compounding advantages for the controlling practitioner. This makes the back attack system not only a technical solution but a strategic weapon that can fundamentally alter the competitive dynamics of a match.

## Computer Science Analogy
The Back Attack System exemplifies what computer scientists would recognize as a "resource exhaustion attack" in cybersecurity. The system methodically targets and depletes the defender's critical resources (defensive grips, frames, and movement options) until the defensive system can no longer maintain its integrity, creating an inevitable path to submission.

From a state machine perspective, back control represents the most advantageous non-terminal node in the BJJ positional graph. What makes this state particularly powerful is its asymmetric transition properties—the controlling player has many high-value transition options (to submissions or other dominant positions), while the controlled player has very few viable escape paths, each with low probability of success. This creates a positional state with exceptionally high expected value across all possible future sequences.

The relationship between control and submission in the back attack system demonstrates the concept of "privilege escalation" in security systems. The attacker begins with positional privileges (back control) and systematically leverages these initial privileges to gain additional access (breaking defensive structures) until achieving complete system compromise (submission). This staged approach to attacking complex defensive systems proves far more effective than attempting to achieve submission directly without first establishing the prerequisite control conditions.

In terms of algorithmic design, the back attack system implements a form of "gradient descent optimization," where each adjustment and transition serves to incrementally minimize the distance to the optimal solution (submission) through small, iterative improvements. Rather than attempting to force a direct path to submission, the system continuously makes small adjustments that cumulatively lead to inevitable success, similar to how sophisticated optimization algorithms find global maxima through incremental local improvements.

From a game theory perspective, back control represents a position of such significant advantage that it fundamentally alters the strategic landscape of the match. The position creates what game theorists call a "dominant strategy"—one that yields better outcomes than alternative approaches regardless of the opponent's defensive choices. This explains its persistent effectiveness across competition formats and skill levels, as it represents a fundamental structural advantage that cannot be fully neutralized through defensive knowledge alone.

## LLM Integration Elements

### Narrative Generation Prompts
- **Position Establishment**: "You secure back control, feeling your chest pressed firmly against your opponent's back. Your hooks are deep, legs wrapped around their hips, controlling their movement completely. Your opponent's body tenses as they recognize the danger."
- **Attack Initiation**: "You slide your arm under their chin, systematically breaking their defensive grip. Your opponent frantically grabs your choking arm with both hands, but you maintain connection and begin adjusting."
- **Defensive Response**: "Your opponent defends by tucking their chin aggressively and grabbing your choking arm with a two-on-one grip, but you feel their collar exposed and begin transitioning to a Bow and Arrow Choke, maintaining dominant control."
- **Submission Progression**: "You increase pressure through your choking arm while your other hand controls their collar. Your opponent's defensive grips weaken as fatigue sets in. They tap urgently against your arm."

### Image Generation Context
- **Back Control Position**: Attacker behind opponent with chest-to-back connection, hooks deep around hips, seatbelt grip established (one arm under armpit, one over shoulder), opponent's posture broken forward
- **Rear Naked Choke Application**: Attacker's choking arm under opponent's chin (blade of forearm against neck), opposite hand behind opponent's head, both hooks secured, opponent's hands grabbing choking arm defensively
- **Bow and Arrow Choke Setup**: Attacker controlling opponent's collar with one hand, opposite leg straightening to create angle, opponent turning slightly, visible tension in gi fabric
- **Armbar Transition**: Attacker controlling isolated arm while maintaining one hook, body beginning to rotate, opponent's arm extended, defensive hand protecting neck

### Audio Narration Cues
- "You methodically secure the back position"
- "Your hooks sink deep as you establish control"
- "You systematically strip their defensive grip"
- "Your choking arm slides under their chin"
- "Pressure builds as they struggle to defend"
- "Their grip weakens and they tap desperately"

---

## Notes for Developers

This standard ensures:
- **YAML Frontmatter**: Required for SEO and metadata integration
- **Comprehensive System Documentation**: Full strategic framework rather than isolated techniques
- **State Machine Integration**: Structured data (SC###, submissions, positions) for game engine
- **Extensive Decision Trees**: LLM-ready logic for AI opponent behavior and narrative generation
- **Expert Methodology**: Authentic representation of systematic approaches from recognized authorities
- **Competition Context**: Real-world effectiveness analysis and strategic application
- **Training Pathways**: Progressive skill development for educational value
- **LLM Integration**: Narrative, image, and audio generation context for game engine
- **Technical Depth**: Computer science analogies for systematic understanding
- **Educational Value**: Complete learning resource beyond state machine data

Updates to this standard should be reflected across all system files to maintain consistency, technical depth, and game engine compatibility.

---

## SEO Optimization for System Pages

System pages require specialized SEO optimization that emphasizes the comprehensive framework nature of the content while highlighting expert attribution and systematic methodology. Unlike individual technique pages that focus on single movements, system pages must communicate the interconnected nature of multiple techniques working together as a unified strategic approach.

### Title Format Standards

System page titles follow a strict three-part format that maximizes keyword targeting while maintaining brand consistency:

**Format**: `"[System Name] | BJJ System | BJJ Graph"`

**Examples**:
- "Back Attack System | BJJ System | BJJ Graph"
- "Kimura Trap System | BJJ System | BJJ Graph"
- "Danaher Guard Passing System | BJJ System | BJJ Graph"
- "10th Planet Lockdown System | BJJ System | BJJ Graph"
- "Gordon Ryan Mount System | BJJ System | BJJ Graph"

The first segment should use the established name of the system (Danaher System, Eddie Bravo System, etc.) when applicable, as this captures search intent from practitioners familiar with these expert frameworks. For systems without established names, use descriptive names that include the primary position or tactical goal (e.g., "Triangle Attack System", "Half Guard Escape System").

### Meta Description Template

System descriptions must communicate the comprehensive framework nature in 150-160 characters while including key success indicators:

**Template**: "Master [System Name] in BJJ. Comprehensive framework connecting [X technique types] across [Y positions] for high-percentage outcomes. Expert insights from [attributed expert]."

**Examples**:
- "Master Back Attack System in BJJ. Comprehensive framework connecting 5+ submissions from back control for 80%+ finishing rates. Expert insights from John Danaher."
- "Master Kimura Trap System in BJJ. Comprehensive framework connecting Kimura control to 8+ submissions and back takes. Danaher's systematic approach."
- "Master 10th Planet Lockdown System in BJJ. Comprehensive framework connecting half guard control to sweeps and submissions. Eddie Bravo's innovative method."

The description should emphasize: (1) comprehensive framework nature, (2) multiple connected techniques, (3) success metrics when available, (4) expert attribution for credibility.

### Target Keywords

System pages should target both general system keywords and expert-specific search patterns:

**Primary Keywords**:
- "[system name] bjj"
- "bjj [position] system"
- "[expert name] [position] system"
- "[position] attack system"
- "bjj submission chains"

**Long-Tail Keywords**:
- "how to use [system name] in bjj"
- "[expert name] system instructional"
- "bjj [position] systematic approach"
- "submission chains from [position]"
- "[position] attack sequence bjj"

**Expert Attribution Keywords**:
- "john danaher [system] system"
- "gordon ryan [position] approach"
- "eddie bravo [technique] system"
- "10th planet system bjj"
- "danaher systematic approach"

### Content Structure for SEO

System pages should structure content to maximize relevance signals:

**Opening Paragraphs**: Include primary keywords and expert attribution within first 100 words. State the system's strategic value explicitly.

**Chain Sequence Prominence**: The submission sequence section should appear early in content (within first 50% of page) and use structured formatting (numbered lists, clear progression) that search engines can parse easily.

**Expert Attribution Throughout**: Mention attributed expert multiple times naturally throughout content, not just in dedicated expert insights section. This reinforces topical authority.

**Internal Linking Strategy**: Every technique mentioned in system should link to its individual page using consistent wikilink format. This creates strong topical clustering and distributes PageRank effectively.

**Position Interconnections**: Link all setup positions and related positions mentioned throughout system documentation. This establishes the system as a hub page within the broader positional graph.

### Schema Requirements

System pages require comprehensive schema markup that communicates the framework structure:

**Required Schema Types**:

1. **HowTo Schema**: For learning/applying the system
   - Name: "[System Name] in BJJ"
   - Description: Full system overview
   - Steps: High-level system implementation phases (not individual techniques)
   - Supply: Prerequisites, required positions, foundational techniques
   - TotalTime: Estimated learning timeframe

2. **FAQPage Schema**: 6-8 system-specific questions
   - "What is the [System Name]?"
   - "How does the [System Name] work?"
   - "What positions can I start [System Name] from?"
   - "What submissions are included in [System Name]?"
   - "How long does it take to learn [System Name]?"
   - "[Expert name] approach to [system concept]?"

3. **ItemList Schema**: Chain sequences
   - Ordered list of techniques in primary attack chain
   - Each item links to individual technique page
   - Demonstrates system structure to search engines

4. **WebPage Schema**: Standard metadata
   - Name, description, URL
   - isPartOf relationship to BJJ Graph site

5. **BreadcrumbList Schema**: Navigation hierarchy
   - Home → Systems → [System Name]

**Schema Example for Back Attack System**:

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Back Attack System in BJJ",
  "description": "Comprehensive framework for attacking from back control with multiple submission chains",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Back Control",
      "text": "Secure dominant back position with proper hook and harness control"
    },
    {
      "@type": "HowToStep",
      "name": "Break Defensive Structures",
      "text": "Systematically eliminate hand fighting and defensive frames"
    },
    {
      "@type": "HowToStep",
      "name": "Execute Primary Attack",
      "text": "Apply Rear Naked Choke with proper mechanics"
    },
    {
      "@type": "HowToStep",
      "name": "Chain to Alternatives",
      "text": "Transition to Bow and Arrow or Armbar based on defensive response"
    }
  ],
  "supply": ["Back Control", "Seatbelt Grip", "Hook Control"],
  "totalTime": "PT6M"
}
```

### FAQ Focus for System Pages

System FAQs should address strategic and systematic questions rather than technical mechanics:

**Strategic Questions**:
- When should I use this system in competition?
- What skill level is required for this system?
- How does this system compare to [alternative approach]?

**Learning Questions**:
- What's the learning progression for this system?
- What prerequisites do I need before learning this system?
- How long does it take to become proficient with this system?

**Integration Questions**:
- How does this system integrate with other attacking frameworks?
- What positions lead into this system?
- Which submissions work best from this system?

**Expert Attribution Questions**:
- How does [expert name] teach this system?
- What makes [expert name]'s approach to this system unique?
- Where can I learn more about [expert name]'s system?

### Expert Attribution in Descriptions

Schema descriptions should explicitly mention attributed expert for topical authority:

**Examples**:
- "John Danaher's systematic approach to back attacks"
- "Gordon Ryan's competition-proven mount system"
- "Eddie Bravo's innovative 10th Planet Lockdown framework"

This helps capture search queries that include expert names alongside technique searches.

---

## Learning Article Synthesis

System pages serve as both technical documentation and educational resources, requiring integration with broader learning content across the BJJ Graph ecosystem. Understanding how systems are explained in educational contexts ensures system pages support the full learning journey from conceptual understanding to practical application.

### System Representation in Educational Content

When systems appear in learning articles, guides, and educational content, they are typically presented through several complementary lenses:

**Conceptual Introduction**: Learning articles introduce systems by explaining the strategic problem they solve and the philosophical foundation underlying the systematic approach. For example, articles explaining back control don't just list techniques—they explain why systematic breakdown of defensive resources is more effective than isolated submission attempts.

**Progressive Skill Building**: Educational content presents systems in staged learning progressions, often breaking the full system into digestible components that build upon each other. A beginner article might introduce basic back control maintenance, while advanced articles explore the complete submission chain structure.

**Comparative Analysis**: Learning articles often compare different expert systems addressing the same tactical situation, helping practitioners understand when different approaches might be optimal. For example, comparing Danaher's systematic back attacks versus Eddie Bravo's unconventional back control variations provides strategic context for system selection.

**Troubleshooting Guidance**: Educational articles address common challenges practitioners face when implementing systems, providing targeted solutions that aren't always evident in technical documentation alone.

### Expert System Philosophies in Learning Articles

Different expert systems embody distinct teaching philosophies that should be reflected consistently across all educational content:

**John Danaher Systems**: Learning articles emphasizing Danaher systems focus on mechanical precision, systematic problem-solving, defensive structure breakdown, and incremental progression. Educational content should communicate the patient, methodical nature of his approach and the emphasis on understanding underlying principles rather than memorizing technique sequences.

**Gordon Ryan Approach**: Educational content featuring Gordon Ryan's competitive refinements emphasizes proven effectiveness under elite resistance, tactical patience, positional consolidation before submission attempts, and practical adaptations that maximize finishing percentages. Learning articles should communicate the competitive pragmatism of his approach.

**Eddie Bravo Innovation**: Educational articles covering 10th Planet systems emphasize creative problem-solving, unconventional entries, signature position integration, and modern defensive adaptations. Learning content should communicate the innovative spirit while acknowledging both advantages and contextual limitations of unorthodox approaches.

### Systematic Approaches in Guides

BJJ Graph learning guides reference systems in several strategic contexts:

**Competition Preparation**: Articles on competition strategy discuss which systems are most effective under specific rule sets (IBJJF, ADCC, submission-only) and how to build game plans around systematic frameworks.

**Skill Level Progression**: Learning roadmaps identify which systems are appropriate for different belt levels, creating structured learning pathways from fundamental systems (mount escapes) to advanced frameworks (leg lock systems).

**Positional Specialization**: Educational content helps practitioners develop systematic expertise in specific positional categories (guard passing systems, back attack systems, submission chains from mount), creating focused training plans.

**Defensive Strategy**: Learning articles on defensive BJJ present defensive systems with the same systematic rigor as offensive frameworks, ensuring balanced skill development.

### Integration with Position/Transition/Submission Content

System pages create natural hubs that connect and contextualize individual technique pages:

**Technique Contextualization**: When learning articles reference individual techniques, they should link to both the technique page and the relevant system page, helping practitioners understand how isolated techniques fit within broader strategic frameworks.

**Positional Strategy**: Articles explaining positions should reference applicable systems, showing how systematic approaches leverage positional advantages. For example, mount articles should reference mount attack systems and mount escape systems.

**Training Programming**: Educational content on training methodology should organize technique practice around systematic frameworks rather than isolated drills, reflecting how systems are actually learned and applied.

---

## Schema Markup Quick Reference

System pages require multiple schema types working together to communicate the comprehensive framework structure to search engines. This quick reference provides templates and examples specific to system content.

### Required Schema Types

**1. WebPage Schema**
Standard metadata for all pages. Establishes page identity and site relationship.

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "[System Name] | BJJ System | BJJ Graph",
  "description": "Master [System Name] in BJJ. [Brief system description]",
  "url": "https://bjjgraph.com/systems/[system-name]",
  "isPartOf": {
    "@type": "WebSite",
    "name": "BJJ Graph",
    "url": "https://bjjgraph.com"
  }
}
```

**2. BreadcrumbList Schema**
Navigation hierarchy. Helps Google display breadcrumb trails in search results.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://bjjgraph.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Systems",
      "item": "https://bjjgraph.com/systems/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "[System Name]",
      "item": "https://bjjgraph.com/systems/[system-name]"
    }
  ]
}
```

### Recommended Schema Types

**3. HowTo Schema**
For learning/applying the system. Focus on high-level system implementation, not individual technique steps.

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "[System Name] in BJJ",
  "description": "Learn to apply the [System Name] framework with systematic progression",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Phase 1: [System Entry]",
      "text": "[How to establish system starting position]"
    },
    {
      "@type": "HowToStep",
      "name": "Phase 2: [Control Establishment]",
      "text": "[How to maintain systematic control]"
    },
    {
      "@type": "HowToStep",
      "name": "Phase 3: [Attack Initiation]",
      "text": "[How to begin attacking sequence]"
    },
    {
      "@type": "HowToStep",
      "name": "Phase 4: [Chain Execution]",
      "text": "[How to chain techniques based on defense]"
    }
  ],
  "supply": [
    "[Required position or prerequisite 1]",
    "[Required position or prerequisite 2]",
    "[Required control or grip 3]"
  ],
  "totalTime": "PT10M"
}
```

**4. FAQPage Schema**
6-8 system-specific questions focusing on strategic application, learning progression, and expert attribution.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the [System Name]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Brief system overview with strategic purpose]"
      }
    },
    {
      "@type": "Question",
      "name": "How does the [System Name] work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Explanation of system mechanics and chain logic]"
      }
    },
    {
      "@type": "Question",
      "name": "What positions can I start the [System Name] from?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[List of entry positions with brief context]"
      }
    },
    {
      "@type": "Question",
      "name": "What submissions are included in the [System Name]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[List of primary submissions in attack chain]"
      }
    },
    {
      "@type": "Question",
      "name": "What skill level is required for the [System Name]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Skill level requirements and prerequisites]"
      }
    },
    {
      "@type": "Question",
      "name": "How long does it take to learn the [System Name]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Realistic timeframe with progressive milestones]"
      }
    }
  ]
}
```

**5. ItemList Schema**
For primary attack chains. Shows technique sequences and system structure.

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "[System Name] Attack Chain",
  "description": "Primary submission sequence in [System Name]",
  "itemListOrder": "https://schema.org/ItemListOrderAscending",
  "numberOfItems": 4,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "[Primary Attack Name]",
      "url": "https://bjjgraph.com/submissions/[primary-attack]"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "[Secondary Attack Name]",
      "url": "https://bjjgraph.com/submissions/[secondary-attack]"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "[Tertiary Attack Name]",
      "url": "https://bjjgraph.com/submissions/[tertiary-attack]"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "[Additional Attack Name]",
      "url": "https://bjjgraph.com/submissions/[additional-attack]"
    }
  ]
}
```

### System-Specific Schema Examples

**Example: Kimura Trap System**

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Kimura Trap System in BJJ",
  "description": "John Danaher's systematic approach to Kimura-based attacks with 8+ submission options",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Kimura Control",
      "text": "Secure figure-four grip on opponent's arm with proper body positioning"
    },
    {
      "@type": "HowToStep",
      "name": "Create Control Hierarchy",
      "text": "Establish dominant positioning that prioritizes control over submission"
    },
    {
      "@type": "HowToStep",
      "name": "Recognize Defensive Pattern",
      "text": "Identify how opponent defends the Kimura finish"
    },
    {
      "@type": "HowToStep",
      "name": "Chain to Alternative",
      "text": "Transition to appropriate submission based on defensive commitment"
    }
  ],
  "supply": ["Kimura Grip", "Top Position", "Arm Isolation"],
  "totalTime": "PT8M"
}
```

**Example: Eddie Bravo Lockdown System**

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "10th Planet Lockdown System Attack Chain",
  "description": "Eddie Bravo's systematic approach to attacks from lockdown half guard",
  "itemListOrder": "https://schema.org/ItemListOrderAscending",
  "numberOfItems": 5,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Electric Chair Sweep",
      "url": "https://bjjgraph.com/transitions/electric-chair-sweep"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Old School Sweep",
      "url": "https://bjjgraph.com/transitions/old-school-sweep"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Banana Split",
      "url": "https://bjjgraph.com/submissions/banana-split"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Back Take from Lockdown",
      "url": "https://bjjgraph.com/transitions/lockdown-back-take"
    },
    {
      "@type": "ListItem",
      "position": 5,
      "name": "Twister Setup",
      "url": "https://bjjgraph.com/submissions/twister-setup"
    }
  ]
}
```

### Expert Attribution in Schema Descriptions

When attributing systems to specific experts, include expert names in schema descriptions for topical authority:

**Danaher Systems**:
- "John Danaher's systematic approach to [tactical goal]"
- "Danaher Death Squad methodology for [position]"
- "Systematic breakdown framework developed by John Danaher"

**Gordon Ryan Systems**:
- "Gordon Ryan's competition-proven approach to [position]"
- "High-percentage system refined by Gordon Ryan"
- "Elite-level framework demonstrated by Gordon Ryan"

**Eddie Bravo Systems**:
- "Eddie Bravo's innovative 10th Planet system for [position]"
- "Unconventional framework developed by Eddie Bravo"
- "10th Planet systematic approach to [tactical situation]"

### Schema Validation Checklist

Before publishing system pages, verify:

- [ ] All five required schema types present (WebPage, BreadcrumbList, HowTo, FAQPage, ItemList)
- [ ] HowTo steps describe system phases, not individual technique steps
- [ ] FAQ questions focus on strategic/learning aspects, not just mechanics
- [ ] ItemList includes all techniques in primary attack chain with working URLs
- [ ] Expert attribution included in descriptions where applicable
- [ ] All JSON-LD is valid (no syntax errors)
- [ ] URLs match actual page locations
- [ ] Breadcrumbs follow Home → Systems → [System Name] hierarchy

---

*End of System Standard V2 Documentation*
