# YAML Schema Documentation for BJJ Graph
#bjj #documentation #schema #validation #reference

## Overview

This document defines the complete YAML frontmatter schema for all content types in the BJJ Graph knowledge base. The YAML frontmatter appears at the top of each markdown file between `---` delimiters and provides structured metadata for SEO, state machine integration, and content organization.

## Table of Contents

1. [Positions Schema](#positions-schema)
2. [Transitions Schema](#transitions-schema)
3. [Submissions Schema](#submissions-schema)
4. [Concepts Schema](#concepts-schema)
5. [Systems Schema](#systems-schema)
6. [Learning Articles Schema](#learning-articles-schema)
7. [Validation Rules](#validation-rules)
8. [Best Practices](#best-practices)
9. [Schema.org Integration](#schemaorg-integration)
10. [SEO Schema Patterns](#seo-schema-patterns)

---

## Positions Schema

### Purpose
Positions represent nodes in the BJJ state machine. Each position file defines a physical configuration in BJJ with associated properties, transitions, and success probabilities.

### YAML Structure

```yaml
---
title: "Position Name | BJJ Position Guide | BJJ Graph"
description: "Master Position Name in BJJ. Complete guide covering setup, control, transitions. Success rates: Beginner X%, Intermediate Y%, Advanced Z%."
---
```

### Field Definitions

#### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | SEO-optimized page title following template | `"Mount Position | BJJ Position Guide | BJJ Graph"` |
| `description` | string | Meta description (150-160 chars) with success rates | `"Master Mount position in BJJ. Complete guide covering control, submissions, and transitions. Dominant 4-point position with 75% retention rate and 55% submission probability."` |

#### Content Body Requirements

The markdown body must include these sections with embedded metadata:

**State Properties Section:**
```markdown
## State Properties
- **State ID**: S### (unique identifier)
- **Point Value**: 0-4 (IBJJF scoring)
- **Position Type**: Offensive/Defensive/Neutral/Controlling
- **Risk Level**: Low/Medium/High
- **Energy Cost**: Low/Medium/High
- **Time Sustainability**: Short/Medium/Long
```

**Success Rate Data:**
```markdown
## Position Metrics
- **Position Retention Rate**: Beginner X%, Intermediate Y%, Advanced Z%
- **Advancement Probability**: Beginner X%, Intermediate Y%, Advanced Z%
- **Submission Probability**: Beginner X%, Intermediate Y%, Advanced Z%
- **Position Loss Probability**: Beginner X%, Intermediate Y%, Advanced Z%
```

**Transitions Format:**
```markdown
## Offensive Transitions (Available From This State)
- [[Technique Name]] → [[Resulting State]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)
```

### Complete Example

```yaml
---
title: "Closed Guard Bottom | BJJ Position Guide | BJJ Graph"
description: "Master Closed Guard Bottom in BJJ. Complete guide covering setup, control, sweeps, and submissions. Success rates: Beginner 60%, Intermediate 70%, Advanced 80%."
---
```

**Body includes:**
- State ID: S002
- Point Value: 0
- Position Type: Defensive with offensive options
- Risk Level: Low
- Energy Cost: Medium
- Time Sustainability: Long
- Position Retention Rate: Beginner 60%, Intermediate 70%, Advanced 80%

---

## Transitions Schema

### Purpose
Transitions represent edges in the BJJ state machine. Each transition defines a technique that moves from one position to another with skill-based success probabilities.

### YAML Structure

```yaml
---
title: "Technique Name | BJJ Technique | BJJ Graph"
description: "Learn Technique Name in BJJ. Step-by-step execution from Starting State to Ending State. Success: Beginner X%, Intermediate Y%, Advanced Z%."
---
```

### Field Definitions

#### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | SEO-optimized technique title | `"Hip Bump Sweep | BJJ Technique | BJJ Graph"` |
| `description` | string | Meta description with states and success rates | `"Learn Hip Bump Sweep in BJJ. Step-by-step execution from Closed Guard Bottom to Mount. Success: Beginner 50%, Intermediate 70%, Advanced 85%."` |

#### Content Body Requirements

**Transition Properties Section:**
```markdown
### Core Identifiers
- **Transition ID**: T### (unique identifier)
- **Transition Name**: Technique Name
- **Alternative Names**: Common variations

### State Machine Properties
- **Starting State**: [[Position Where Transition Begins]]
- **Ending State**: [[Position Where Transition Ends]]
- **Transition Type**: Escape/Attack/Advancement/Counter/Setup

### Transition Properties
- **Success Probability**: Beginner X%, Intermediate Y%, Advanced Z%
- **Execution Complexity**: Low/Medium/High
- **Energy Cost**: Low/Medium/High
- **Time Required**: Instant/Quick/Medium/Slow
- **Risk Level**: Low/Medium/High

### Physical Requirements
- **Strength Requirements**: Low/Medium/High
- **Flexibility Requirements**: Low/Medium/High
- **Coordination Requirements**: Low/Medium/High
- **Speed Requirements**: Low/Medium/High
```

**Success Modifiers:**
```markdown
### Success Modifiers
Factors that increase/decrease probability:
- **Setup Quality**: Description (+/-10%)
- **Timing Precision**: Description (+/-15%)
- **Opponent Fatigue**: Description (+/-5%)
- **Knowledge Test Performance**: Description (+/-10%)
- **Position Control**: Description (+/-5%)
```

### Complete Example

```yaml
---
title: "Hip Bump Sweep | BJJ Technique | BJJ Graph"
description: "Learn Hip Bump Sweep in BJJ. Step-by-step execution from Closed Guard Bottom to Mount. Success: Beginner 50%, Intermediate 70%, Advanced 85%."
---
```

**Body includes:**
- Transition ID: T045
- Starting State: [[Closed Guard Bottom]]
- Ending State: [[Mount]]
- Success Probability: Beginner 50%, Intermediate 70%, Advanced 85%
- Execution Complexity: Low
- Energy Cost: Low

---

## Submissions Schema

### Purpose
Submissions represent terminal states in the BJJ state machine. Each submission defines a finishing technique with setup requirements and safety considerations.

### YAML Structure

```yaml
---
title: "Submission Name | BJJ Submission | BJJ Graph"
description: "Learn Submission Name in BJJ. Complete guide from Starting Position. Success: Beginner X%, Intermediate Y%, Advanced Z%. Safety-first approach."
---
```

### Field Definitions

#### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | SEO-optimized submission title | `"Rear Naked Choke | BJJ Submission | BJJ Graph"` |
| `description` | string | Meta description with safety emphasis | `"Learn Rear Naked Choke in BJJ. Complete guide from Back Control. Success: Beginner 60%, Intermediate 80%, Advanced 95%. Safety-first approach."` |

#### Content Body Requirements

**Submission Properties Section:**
```markdown
### Core Identifiers
- **Submission ID**: SUB### (unique identifier)
- **Submission Name**: Technique Name
- **Alternative Names**: Regional variations

### State Machine Properties
- **Starting State**: [[Required Control Position]]
- **Ending State**: [[Won by Submission]]
- **Submission Type**: Choke/Joint Lock/Compression/Crank
- **Target Area**: Specific anatomical region

### Submission Properties
- **Success Probability**: Beginner X%, Intermediate Y%, Advanced Z%
- **Setup Complexity**: Low/Medium/High
- **Execution Speed**: Slow/Medium/Fast
- **Escape Difficulty**: Low/Medium/High
- **Damage Potential**: Low/Medium/High

### Physical Requirements
- **Strength Requirements**: Low/Medium/High
- **Flexibility Requirements**: Low/Medium/High
- **Coordination Requirements**: Low/Medium/High
- **Endurance Requirements**: Low/Medium/High
```

**Safety Section (Required):**
```markdown
### Safety Considerations
- **Injury Risks**: Potential damage from improper application
- **Application Speed**: Proper rate of pressure increase
- **Tap Recognition**: Identifying submission signals
- **Release Technique**: How to safely disengage after tap
- **Training Protocols**: Safe drilling and sparring guidelines
```

### Complete Example

```yaml
---
title: "Rear Naked Choke | BJJ Submission | BJJ Graph"
description: "Learn Rear Naked Choke in BJJ. Complete guide from Back Control. Success: Beginner 60%, Intermediate 80%, Advanced 95%. Safety-first approach."
---
```

**Body includes:**
- Submission ID: S201 (note: some files use S### instead of SUB###)
- Starting State: [[Back Control]]
- Ending State: [[Won by Submission]]
- Success Probability: Beginner 60%, Intermediate 80%, Advanced 95%
- Submission Type: Choke - Targets carotid arteries
- Safety considerations prominently featured

---

## Concepts Schema

### Purpose
Concepts represent fundamental principles and frameworks that apply across multiple positions and techniques. These are educational resources rather than state machine nodes.

### YAML Structure

Concepts typically use minimal YAML frontmatter or none at all, relying on markdown headers and tags.

```yaml
---
title: "Concept Name | BJJ Concept | BJJ Graph"
description: "Understand Concept Name in BJJ. Fundamental principle applicable across all positions and skill levels."
---
```

### Field Definitions

#### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | SEO-optimized concept title | `"Base Maintenance | BJJ Concept | BJJ Graph"` |
| `description` | string | Meta description for concept | `"Understand Base Maintenance in BJJ. Fundamental principle for stability and control across all positions."` |

#### Content Body Requirements

**Concept Properties Section:**
```markdown
## Concept Properties
- **Concept ID**: C### (unique identifier)
- **Application Level**: Fundamental/Intermediate/Advanced
- **Complexity Level**: Low/Medium/High
- **Development Timeline**: Beginner to Advanced / White Belt to Black Belt
```

**Key Sections:**
- Key Principles (bulleted list)
- Component Skills (sub-skills breakdown)
- Concept Relationships (links to related concepts)
- Expert Insights (Danaher, Gordon Ryan, Eddie Bravo)
- Common Errors (mistakes and corrections)
- Training Approaches (how to develop the skill)

### Complete Example

```yaml
---
title: "Base Maintenance | BJJ Concept | BJJ Graph"
description: "Understand Base Maintenance in BJJ. Fundamental principle for stability and control across all positions."
---
```

**Body includes:**
- Concept ID: C111
- Application Level: Fundamental
- Complexity Level: Medium
- Development Timeline: Beginner to Advanced
- No success rates (concepts don't have probabilistic outcomes)

---

## Systems Schema

### Purpose
Systems represent comprehensive attack or defense frameworks that chain multiple techniques together. These are strategic resources showing how experts combine techniques.

### YAML Structure

Systems use minimal YAML or none, similar to Concepts.

```yaml
---
title: "System Name | BJJ System | BJJ Graph"
description: "Master System Name in BJJ. Comprehensive framework connecting multiple techniques and positions for high-percentage outcomes."
---
```

### Field Definitions

#### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | SEO-optimized system title | `"Kimura Trap System | BJJ System | BJJ Graph"` |
| `description` | string | Meta description for system | `"Master Kimura Trap System in BJJ. Comprehensive framework connecting Kimura control to multiple submissions and back takes."` |

#### Content Body Requirements

**System Properties Section:**
```markdown
## Chain Properties
- **Chain ID**: SC### (unique identifier)
- **Primary Submissions**: [[Sub1]], [[Sub2]], [[Sub3]]
- **Starting Positions**: [[Pos1]], [[Pos2]], [[Pos3]]
- **Difficulty Level**: Beginner/Intermediate/Advanced
- **Strategic Value**: Low/Medium/High
```

**Key Sections:**
- Core Mechanical Principles
- Submission Sequence (ordered chain)
- Decision Tree (if/then logic)
- Expert Insights (system-specific wisdom)
- Setup Positions (where to initiate)
- Common Defensive Reactions (and responses)

### Complete Example

```yaml
---
title: "Kimura Trap System | BJJ System | BJJ Graph"
description: "Master Kimura Trap System in BJJ. Comprehensive framework connecting Kimura control to multiple submissions and back takes."
---
```

**Body includes:**
- Chain ID: SC002
- Primary Submissions: [[Kimura]], [[Armbar Control]], [[Arm Triangle]], [[Back Control]]
- Starting Positions: [[Half Guard Top]], [[Side Control]], [[Closed Guard Bottom]]
- Difficulty Level: Intermediate
- Strategic Value: High

---

## Learning Articles Schema

### Purpose
Learning articles are educational synthesis content that provide comprehensive overviews, strategic guidance, and narrative explanations of BJJ topics. Unlike technical pages that document specific techniques, Learning articles cluster related content into educational hubs targeting high-search-volume keywords.

### YAML Structure

Learning articles use minimal frontmatter focused on SEO optimization:

```yaml
---
title: "[Target Keyword] | [Benefit Statement] | BJJ Graph"
description: "[150-160 characters including keyword, specific numbers, and 'complete guide']"
tags:
  - learning
  - beginner/intermediate/advanced
  - topic-category
  - secondary-keywords
---
```

### Field Definitions

#### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | SEO-optimized title with keyword and benefit | `"BJJ Guard Types Explained | Master All 15+ Guard Variations | BJJ Graph"` |
| `description` | string | Meta description 150-160 chars with data | `"Master all 15+ BJJ guard types with this complete guide. Learn open guards, closed guards, half guards, and leg entanglements with success rates and progressions."` |
| `tags` | array | Minimum 4 tags: learning, skill level, category, keywords | `["learning", "beginner", "guards", "fundamentals"]` |

#### Content Characteristics

**Learning articles differ from technical pages:**

| Aspect | Learning Articles | Technical Pages |
|--------|------------------|-----------------|
| **Length** | 2,500-7,000 words | 1,000-2,000 words |
| **Internal Links** | 15-125 links | 3-10 links |
| **Schema Types** | 5 concurrent schemas | 3-4 schemas |
| **Tone** | Narrative, explanatory | Precise, technical |
| **Purpose** | Educational synthesis | State machine documentation |
| **Target Keywords** | High-volume educational terms | Long-tail technical terms |

**Schema Requirements (5 types):**
1. WebPage Schema - Base webpage identification
2. BreadcrumbList Schema - Navigation with "Learning" category level
3. HowTo Schema - Educational steps (NOT technical execution, PT10M-PT12M timeframes)
4. FAQPage Schema - 6-8 questions with 2-3 sentence detailed answers
5. ItemList Schema - Rankings, categorical lists, Top 10 patterns (when applicable)

### Complete Example

```yaml
---
title: "BJJ Position Hierarchy Explained | Learning | BJJ Graph"
description: "Master BJJ positional hierarchy from standing to submission. Complete guide to the position ladder, IBJJF points, strategic advancement, and defensive priorities with decision trees."
tags:
  - learning
  - hierarchy
  - strategy
  - beginner
  - fundamentals
  - positions
  - competition
---
```

**Body characteristics:**
- Word count: 5,800+ words
- Internal links: 45+ wikilinks to positions and transitions
- Schema types: All 5 (WebPage, Breadcrumb, HowTo, FAQ, ItemList not applicable)
- Tables: 6 comparison tables (success rates, pathways, risk assessment)
- Expert insights: Integrated throughout narrative sections
- Content sections: 15+ major sections with subsections
- FAQ questions: 8 detailed questions with 2-3 sentence answers

**Example Schema Markup from Learning Articles:**

**Educational HowTo Schema (PT12M timeframe):**
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Understanding BJJ Position Hierarchy",
  "description": "Learn to navigate the positional hierarchy in Brazilian Jiu-Jitsu from standing positions through submissions",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Understand Neutral Standing Position",
      "text": "Begin from the neutral standing position where both competitors have equal opportunity. This is the 0-point baseline where matches start."
    },
    {
      "@type": "HowToStep",
      "name": "Establish Guard Position",
      "text": "Progress to guard positions (0 points) where you control distance and create offensive opportunities. Guard is defensive but offers strategic advantage."
    }
  ],
  "totalTime": "PT12M"
}
```

**Detailed FAQ Schema (2-3 sentence answers):**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is positional hierarchy in BJJ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Positional hierarchy in BJJ is the systematic ranking of positions from neutral to dominant, where each position offers increasing control, submission opportunities, and point values. The hierarchy progresses from standing (0 points) to guard (0 points) to guard passing (3 points) to pins (4 points) to submissions (match win). This structure reflects biomechanical advantages where certain body configurations provide more control than others."
      }
    }
  ]
}
```

**ItemList Schema (Top 10 pattern):**
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "BJJ Guard Types",
  "description": "Complete list of Brazilian Jiu-Jitsu guard positions organized by category",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Closed Guard Bottom", "url": "https://bjjgraph.com/positions/closed-guard-bottom"},
    {"@type": "ListItem", "position": 2, "name": "Open Guard Bottom", "url": "https://bjjgraph.com/positions/open-guard-bottom"}
  ]
}
```

### Content Structure

**Required sections for Learning articles:**
1. Introduction with keyword placement (first 50 words)
2. Quick Navigation section (table of contents)
3. Overview/Definition section
4. 10-15 major topic sections with subsections
5. Comparison tables (minimum 3)
6. Expert Insights sections (integrated throughout)
7. Learning progression section (by belt level or skill)
8. Strategic guidance section (when/how to apply)
9. Common mistakes section
10. Conclusion with actionable takeaways
11. Related Content links (10-20 wikilinks)

**Internal Linking Density:**
- Minimum: 15 internal links
- Typical: 30-50 links
- Extensive: 100-125 links
- Examples: "BJJ-Guard-Types-Explained.md" has 125 links, "BJJ-Position-Hierarchy-Explained.md" has 45 links

### Reference Examples

Existing Learning articles demonstrating full schema implementation:
- `Learning/BJJ-Position-Hierarchy-Explained.md` - 5,800 words, 45+ links, 8 FAQ questions
- `Learning/BJJ-Guard-Types-Explained.md` - 7,200+ words, 125 links, 6 FAQ questions, ItemList schema
- `Learning/BJJ-Submissions-Chart-Guide.md` - 6,500+ words, 89 links, ranking tables
- `Learning/Understanding-Position-Flow.md` - 3,800 words, 32 links, decision trees

See `source/content/Learning/CONTRIBUTING-LEARNING.md` for complete Learning article standards.

---

## Validation Rules

### General Rules for All Content Types

1. **YAML Syntax**
   - Must be valid YAML (proper indentation, no tabs)
   - Frontmatter must start and end with `---`
   - Strings with special characters must be quoted
   - Multi-line strings use `>` or `|` indicators

2. **Title Format**
   - Pattern: `"[Name] | BJJ [Type] | BJJ Graph"`
   - Types: "Position Guide", "Technique", "Submission", "Concept", "System"
   - Must include pipe separators
   - Must be quoted if containing special characters

3. **Description Format**
   - Length: 150-160 characters (SEO optimal)
   - Must include key action verb (Master, Learn, Understand)
   - Should mention success rates for positions/transitions/submissions
   - Must be actionable and descriptive

### Position-Specific Rules

1. **State ID Format**
   - Pattern: `S###` where ### is 3-digit number (e.g., S002, S004)
   - Must be unique across all positions
   - Leading zeros required

2. **Point Value**
   - Must be integer 0-4
   - Based on IBJJF scoring system
   - 0 = neutral, 2 = advantage, 3 = guard pass, 4 = mount/back

3. **Success Rate Format**
   - Must include all three skill levels: Beginner, Intermediate, Advanced
   - Format: `Beginner X%, Intermediate Y%, Advanced Z%`
   - Percentages should be realistic (10-95% range)
   - Advanced percentage should be ≥ Intermediate ≥ Beginner

4. **Transition Links**
   - Format: `[[Technique]] → [[Position]] (Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)`
   - Must use `[[wikilink]]` syntax
   - Arrow symbol: `→` (not `->` or `==>`)
   - Success rates in parentheses

### Transition-Specific Rules

1. **Transition ID Format**
   - Pattern: `T###` where ### is 3-digit number (e.g., T045, T904)
   - Must be unique across all transitions
   - Leading zeros required

2. **Starting/Ending States**
   - Must be valid wikilinks to existing positions
   - Format: `[[Position Name]]`
   - Can have multiple ending states separated by commas

3. **Success Probability**
   - Required format: `Beginner X%, Intermediate Y%, Advanced Z%`
   - Must include all three levels
   - Should reflect realistic execution rates

4. **Physical Requirements**
   - All four must be specified: Strength, Flexibility, Coordination, Speed
   - Values: Low/Medium/High only
   - Each on separate line with proper formatting

### Submission-Specific Rules

1. **Submission ID Format**
   - Pattern: `SUB###` or `S###` (both in use)
   - Should standardize to `SUB###` going forward
   - Must be unique across all submissions

2. **Ending State**
   - Must always be `[[Won by Submission]]`
   - This is the terminal state

3. **Safety Requirements**
   - Safety section is MANDATORY
   - Must include: Injury Risks, Application Speed, Tap Recognition, Release Technique
   - Should emphasize controlled application

4. **Target Area**
   - Must specify anatomical target
   - Examples: "Carotid arteries", "Elbow joint", "Shoulder complex"

### Concept-Specific Rules

1. **Concept ID Format**
   - Pattern: `C###` where ### is 3-digit number (e.g., C111)
   - Must be unique across all concepts

2. **No Success Rates**
   - Concepts do not have probabilistic outcomes
   - Do not include success rate data

3. **Relationships Required**
   - Must link to related concepts
   - Minimum 3 related concepts recommended

### System-Specific Rules

1. **Chain ID Format**
   - Pattern: `SC###` where ### is 3-digit number (e.g., SC002)
   - Must be unique across all systems

2. **Submission Chain**
   - Must list primary submissions in logical order
   - Each should be a valid wikilink
   - Minimum 2 submissions in chain

3. **Decision Tree Required**
   - Must include if/then logic
   - Shows branching based on opponent reactions
   - Format: `If [condition] → [action]`

---

## Best Practices

### Content Writing Guidelines

1. **Wikilink Consistency**
   - Always use `[[Position Name]]` for internal links
   - Match exact position/technique names
   - Check for existing pages before creating new ones

2. **Success Rate Calibration**
   - Beginner: 20-60% typical range
   - Intermediate: 40-75% typical range
   - Advanced: 60-95% typical range
   - Defensive positions generally lower retention rates
   - Offensive positions generally higher success rates

3. **Expert Insights Format**
   - Always include all three: Danaher, Gordon Ryan, Eddie Bravo
   - Each 2-3 sentences maximum
   - Focus on different aspects (technical, competitive, innovative)
   - Write as if quoting the expert (third person)

4. **Common Errors Section**
   - Minimum 3 errors per page
   - Format: Error → Consequence → Correction
   - Include recognition tips
   - Focus on safety for submissions

5. **Tag Usage**
   - First line: `#bjj #[category] #[specific tags]`
   - Categories: position, transition, submission, concept, system
   - Add specific tags: fundamental, guard, sweep, choke, etc.

### SEO Optimization

1. **Title Templates**
   - Positions: `"[Name] | BJJ Position Guide | BJJ Graph"`
   - Transitions: `"[Name] | BJJ Technique | BJJ Graph"`
   - Submissions: `"[Name] | BJJ Submission | BJJ Graph"`
   - Concepts: `"[Name] | BJJ Concept | BJJ Graph"`
   - Systems: `"[Name] | BJJ System | BJJ Graph"`

2. **Description Templates**
   - Positions: `"Master [Name] in BJJ. Complete guide covering [key aspects]. Success rates: Beginner X%, Intermediate Y%, Advanced Z%."`
   - Transitions: `"Learn [Name] in BJJ. Step-by-step execution from [Start] to [End]. Success: Beginner X%, Intermediate Y%, Advanced Z%."`
   - Submissions: `"Learn [Name] in BJJ. Complete guide from [Position]. Success: Beginner X%, Intermediate Y%, Advanced Z%. Safety-first approach."`

3. **Keyword Integration**
   - Primary keyword in title
   - Primary keyword in description
   - Secondary keywords in H2 headers
   - Natural language (avoid keyword stuffing)

### State Machine Integration

1. **ID Uniqueness**
   - Maintain central registry of IDs
   - Check for duplicates before assigning
   - Sequential numbering recommended

2. **Transition Completeness**
   - Every position should have offensive transitions
   - Every position should have defensive responses
   - Link to real technique pages

3. **Success Rate Consistency**
   - If Position A → Position B has 70% success
   - And Position B → Position C has 60% success
   - Then Position A → Position C should be ~42% (70% × 60%)

4. **Decision Tree Logic**
   - Use if/else if/else structure
   - Cover all major defensive scenarios
   - Include probability estimates
   - Format consistently

---

## Schema.org Integration

### HowTo Schema (Positions & Transitions)

All position and transition files should include Schema.org HowTo markup:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Use [Position/Technique] in BJJ",
  "description": "Complete guide to executing techniques from [Position].",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Execute [Technique]",
      "text": "From this position, execute [Technique] to transition to [Result].",
      "position": 1
    }
  ],
  "tool": [
    "BJJ Gi or No-Gi attire",
    "Training partner",
    "Mat space"
  ],
  "totalTime": "PT5M"
}
</script>
```

### FAQ Schema (Optional Enhancement)

For position files with common errors:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is a common mistake in [Error]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Consequence]. The correction is: [Fix]."
      }
    }
  ]
}
</script>
```

### Schema Best Practices

1. **Structured Data Placement**
   - Place immediately after YAML frontmatter
   - Before main content headers
   - One HowTo schema per page
   - Optional FAQ schema for detailed pages

2. **Step Generation**
   - Extract from offensive transitions
   - Order by success rate or logical flow
   - Include starting position in text
   - Limit to 5-8 steps for readability

3. **Tool Array**
   - Standard tools for all BJJ content:
     - "BJJ Gi or No-Gi attire"
     - "Training partner"
     - "Mat space"
   - Add specific tools if needed

4. **Time Estimation**
   - Use ISO 8601 duration format
   - PT5M = 5 minutes (typical)
   - Adjust based on technique complexity

---

## SEO Schema Patterns

This section documents the different schema patterns used across BJJ Graph content types, with specific guidance on when to use each pattern and how they differ.

### Educational HowTo vs Technical HowTo

BJJ Graph uses two distinct HowTo schema patterns depending on content type:

#### Educational HowTo (Learning Articles)
**Purpose**: Teach conceptual understanding and learning progression
**Timeframe**: PT10M to PT12M (10-12 minutes reading time)
**Step Focus**: Educational concepts, not physical execution

**Example - Understanding a Concept:**
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Understanding BJJ Position Hierarchy",
  "description": "Learn to navigate the positional hierarchy in Brazilian Jiu-Jitsu from standing positions through submissions",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Understand Neutral Standing Position",
      "text": "Begin from the neutral standing position where both competitors have equal opportunity. This is the 0-point baseline where matches start.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Establish Guard Position",
      "text": "Progress to guard positions (0 points) where you control distance and create offensive opportunities. Guard is defensive but offers strategic advantage.",
      "position": 2
    }
  ],
  "tool": ["BJJ Gi or No-Gi attire", "Training partner", "Mat space"],
  "totalTime": "PT12M"
}
```

**Characteristics:**
- Steps describe learning progression, not physical technique
- Time reflects reading/comprehension time
- Focus on understanding concepts and relationships
- Narrative explanations in step text
- 5-7 steps typical

#### Technical HowTo (Positions/Transitions/Submissions)
**Purpose**: Teach physical technique execution
**Timeframe**: PT5M to PT8M (5-8 minutes execution time)
**Step Focus**: Physical execution steps

**Example - Executing a Technique:**
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Execute Hip Bump Sweep from Closed Guard",
  "description": "Step-by-step guide to performing Hip Bump Sweep technique from Closed Guard Bottom position",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Closed Guard Control",
      "text": "Lock your legs around opponent's waist with ankles crossed. Break their posture by pulling them forward with grip on collar or back of neck.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Create Off-Balance Angle",
      "text": "Post your left hand on the mat beside your hip. Sit up at 45-degree angle toward your left side, creating space between your hips and opponent.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Execute Hip Bump",
      "text": "Drive your hips up and forward into opponent's chest while pulling their head over your left shoulder. Use momentum to sweep them backward.",
      "position": 3
    }
  ],
  "tool": ["BJJ Gi or No-Gi attire", "Training partner", "Mat space"],
  "totalTime": "PT5M"
}
```

**Characteristics:**
- Steps describe physical movements
- Time reflects actual execution time
- Focus on body positioning and mechanics
- Specific instructions for each step
- 6-8 steps typical

### FAQ Schema Standards

FAQ schema requirements differ between content types based on educational depth and audience needs.

#### Standard FAQ (Positions/Transitions) - 5 Questions Minimum
**Audience**: Practitioners seeking technique clarification
**Answer Length**: 1-2 sentences
**Focus**: Technical execution, common mistakes, success rates

**Example:**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the success rate for Hip Bump Sweep?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Hip Bump Sweep success rates are: Beginner 50%, Intermediate 70%, Advanced 85%. Success increases with better timing and opponent posture recognition."
      }
    },
    {
      "@type": "Question",
      "name": "What is the most common mistake with Hip Bump Sweep?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The most common mistake is attempting the sweep without first breaking opponent's posture. This results in opponent posting their hand to prevent the sweep (failure rate 70%)."
      }
    }
  ]
}
```

#### Enhanced FAQ (Learning Articles) - 6-8 Questions
**Audience**: Students seeking comprehensive understanding
**Answer Length**: 2-3 sentences with specific data
**Focus**: Conceptual understanding, strategic application, comparisons

**Example:**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is positional hierarchy in BJJ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Positional hierarchy in BJJ is the systematic ranking of positions from neutral to dominant, where each position offers increasing control, submission opportunities, and point values. The hierarchy progresses from standing (0 points) to guard (0 points) to guard passing (3 points) to pins (4 points) to submissions (match win). This structure reflects biomechanical advantages where certain body configurations provide more control than others."
      }
    },
    {
      "@type": "Question",
      "name": "How does the IBJJF point system reflect positional hierarchy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The IBJJF point system awards points based on positional advancement: Guard Pass (3 points), Knee on Belly (2 points), Mount/Back Control (4 points), Sweep (2 points), Takedown (2 points). Higher point values reflect positions with greater control and submission potential, directly mirroring the hierarchical structure."
      }
    }
  ]
}
```

**FAQ Standards by Content Type:**

| Content Type | Minimum Questions | Answer Length | Data Requirements |
|--------------|------------------|---------------|-------------------|
| Positions | 5 | 1-2 sentences | Success rates, common errors |
| Transitions | 5 | 1-2 sentences | Success rates, physical requirements |
| Submissions | 6 | 2-3 sentences | Safety data, success rates, injuries |
| Learning Articles | 6-8 | 2-3 sentences | Statistics, comparisons, strategic data |
| Concepts | 5 | 1-2 sentences | Applications, principles |
| Systems | 5 | 2-3 sentences | System components, strategic value |

### ItemList Schema Usage

ItemList schema is used for rankings, categorical lists, and Top 10 patterns. It's primarily used in Learning articles and hub pages.

#### When to Use ItemList

**Use ItemList for:**
- Ranked lists (Top 10 Submissions, Best Guards for Beginners)
- Categorical organization (All Guards by Type)
- Learning progressions (White Belt → Black Belt techniques)
- Comparison rankings (Success Rates by Position)

**Do NOT use ItemList for:**
- Simple bulleted lists
- Navigation menus
- Unordered collections
- Related content suggestions

#### ItemList Examples

**Ranking Pattern (Top 10):**
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Top 10 BJJ Submissions by Success Rate",
  "description": "Highest percentage submissions in competition ranked by success rate across all belt levels",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Rear Naked Choke",
      "url": "https://bjjgraph.com/submissions/rear-naked-choke",
      "description": "75% average success rate from back control"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Armbar from Mount",
      "url": "https://bjjgraph.com/submissions/armbar-from-mount",
      "description": "68% average success rate from mount position"
    }
  ]
}
```

**Categorical Pattern (Guard Types):**
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "BJJ Guard Types by Category",
  "description": "Complete list of Brazilian Jiu-Jitsu guard positions organized by category",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Closed Guard Bottom",
      "url": "https://bjjgraph.com/positions/closed-guard-bottom"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Open Guard Bottom",
      "url": "https://bjjgraph.com/positions/open-guard-bottom"
    }
  ]
}
```

### Multiple Schema Coordination

Learning articles use 5 concurrent schemas that work together without conflict. Here's how they coordinate:

**Schema Stack for Learning Articles:**

1. **WebPage** (Base layer)
   - Identifies page as part of bjjgraph.com
   - Provides basic metadata
   - Required for all pages

2. **BreadcrumbList** (Navigation layer)
   - Shows page location in site hierarchy
   - Includes "Learning" category level
   - Helps Google understand content organization

3. **HowTo** (Educational layer)
   - Teaches conceptual progression
   - PT10M-PT12M reading timeframe
   - Educational steps, not technical execution

4. **FAQPage** (Q&A layer)
   - 6-8 detailed questions
   - 2-3 sentence answers with data
   - Addresses common student questions

5. **ItemList** (Organizational layer - when applicable)
   - Rankings or categorical organization
   - Only included when content has ranked/ordered lists
   - Optional based on content structure

**Coordination Rules:**
- All 5 schemas use same `@context`: "https://schema.org"
- Each schema in separate `<script type="application/ld+json">` tag
- Ordered: WebPage → BreadcrumbList → HowTo → FAQ → ItemList (if present)
- No overlapping properties between schemas
- Total schema markup: 3-5 KB per page (acceptable overhead)

**Example Schema Placement in Learning Article:**
```html
---
title: "Article Title"
description: "Article description"
---

<script type="application/ld+json">
{WebPage schema}
</script>

<script type="application/ld+json">
{BreadcrumbList schema}
</script>

<script type="application/ld+json">
{HowTo schema}
</script>

<script type="application/ld+json">
{FAQPage schema}
</script>

<script type="application/ld+json">
{ItemList schema - if applicable}
</script>

# Article Content Begins Here
```

### Schema Pattern Summary Table

| Content Type | HowTo Type | FAQ Count | FAQ Length | ItemList? | Total Schemas |
|--------------|-----------|-----------|------------|-----------|---------------|
| **Learning Articles** | Educational (PT12M) | 6-8 | 2-3 sentences | Often | 5 |
| **Positions** | Technical (PT5M) | 5 | 1-2 sentences | Rarely | 3-4 |
| **Transitions** | Technical (PT5M) | 5 | 1-2 sentences | No | 3-4 |
| **Submissions** | Technical (PT5M) | 6 | 2-3 sentences | No | 3-4 |
| **Hub Pages** | Educational (PT10M) | 6-8 | 2-3 sentences | Yes | 5 |
| **Concepts** | Educational (PT8M) | 5 | 1-2 sentences | Rarely | 3-4 |

---

## Validation Checklist

### Pre-Publication Checklist

Use this checklist before publishing any content:

#### YAML Frontmatter
- [ ] YAML is valid syntax
- [ ] Title follows template format
- [ ] Description is 150-160 characters
- [ ] Description includes success rates (if applicable)
- [ ] Description is actionable and descriptive

#### Content Body
- [ ] Includes proper ID (S###, T###, SUB###, C###, or SC###)
- [ ] ID is unique (checked against registry)
- [ ] All required sections present
- [ ] Success rates in correct format
- [ ] Wikilinks use correct syntax
- [ ] Expert insights from all three authorities
- [ ] Minimum error count met (3+)

#### State Machine Integration
- [ ] Transitions link to existing positions
- [ ] Success rates are realistic
- [ ] Decision tree is complete
- [ ] Physical requirements specified

#### SEO & Schema
- [ ] Schema.org markup included
- [ ] Keywords naturally integrated
- [ ] Internal linking to 3-5 related pages
- [ ] Alt text on images (if present)

#### Safety (Submissions Only)
- [ ] Safety section is comprehensive
- [ ] Injury risks documented
- [ ] Tap recognition emphasized
- [ ] Release technique described

---

## Common Validation Errors

### Error: Missing Success Rates

**Problem:**
```markdown
## Offensive Transitions
- [[Hip Bump Sweep]] → [[Mount]]
```

**Solution:**
```markdown
## Offensive Transitions
- [[Hip Bump Sweep]] → [[Mount]] (Success Rate: Beginner 50%, Intermediate 70%, Advanced 85%)
```

### Error: Incorrect ID Format

**Problem:**
```markdown
- **State ID**: S4
- **Transition ID**: T45
```

**Solution:**
```markdown
- **State ID**: S004
- **Transition ID**: T045
```

### Error: Invalid YAML Syntax

**Problem:**
```yaml
---
title: Mount Position | BJJ Position Guide | BJJ Graph
description: Master Mount position...
---
```

**Solution:**
```yaml
---
title: "Mount Position | BJJ Position Guide | BJJ Graph"
description: "Master Mount position in BJJ. Complete guide covering control, submissions, and transitions."
---
```

### Error: Missing Physical Requirements

**Problem:**
```markdown
### Physical Requirements
- **Strength Requirements**: Medium
```

**Solution:**
```markdown
### Physical Requirements
- **Strength Requirements**: Medium
- **Flexibility Requirements**: Low
- **Coordination Requirements**: Medium
- **Speed Requirements**: Low
```

### Error: Inconsistent Expert Insights

**Problem:**
```markdown
### Expert Insights
- **John Danaher**: Technical analysis here...
```

**Solution:**
```markdown
### Expert Insights
- **John Danaher**: Technical analysis here...
- **Gordon Ryan**: Competition focus here...
- **Eddie Bravo**: Innovative approach here...
```

---

## Migration Guide

### Updating Existing Content

If you have existing content that doesn't match this schema:

1. **Backup First**: Always create backup before mass updates
2. **Check YAML**: Ensure frontmatter follows current format
3. **Add Missing Fields**: Fill in any required fields
4. **Standardize IDs**: Convert to proper format (S###, T###, etc.)
5. **Update Success Rates**: Ensure all three levels present
6. **Add Schema Markup**: Include HowTo and/or FAQ schemas
7. **Validate Links**: Check all wikilinks resolve
8. **Test Locally**: Build site locally to catch errors

### Automated Validation

Consider creating validation scripts that check:
- YAML syntax validity
- Required field presence
- ID format correctness
- Success rate format
- Wikilink validity
- Schema.org markup presence

Example validation points:
```javascript
// Check State ID format
const stateIdRegex = /^S\d{3}$/;
if (!stateIdRegex.test(stateId)) {
  errors.push("Invalid State ID format");
}

// Check success rate format
const successRateRegex = /Beginner \d+%, Intermediate \d+%, Advanced \d+%/;
if (!successRateRegex.test(successRate)) {
  errors.push("Invalid success rate format");
}
```

---

## Version History

**Version 1.0** (Current)
- Initial comprehensive schema documentation
- Covers all five content types
- Includes validation rules and best practices
- Schema.org integration guidelines
- Common error patterns and solutions

**Future Enhancements:**
- Automated validation tooling
- JSON Schema definitions for programmatic validation
- Migration scripts for legacy content
- Extended examples for each content type
- Integration with CMS or content management tools

---

## Related Documentation

- [[Positions/CONTRIBUTING-POSITIONS]] - Position content creation guide (for contributors and improvement bot)
- [[Transitions/CONTRIBUTING-TRANSITIONS]] - Transition content creation guide (for contributors and improvement bot)
- [[Submissions/CONTRIBUTING-SUBMISSIONS]] - Submission content creation guide (for contributors and improvement bot)
- [[Systems/CONTRIBUTING-SYSTEMS]] - Systems content creation guide (for contributors and improvement bot)
- [[Concepts/CONTRIBUTING-CONCEPTS]] - Concepts content creation guide (for contributors and improvement bot)
- [Quartz Documentation](https://quartz.jzhao.xyz/) - Static site generator
- [Schema.org HowTo](https://schema.org/HowTo) - Structured data reference
- [YAML Specification](https://yaml.org/spec/) - YAML syntax reference

**Note**: The CONTRIBUTING-*.md files are excluded from the website via quartz.config.ts. They are reference documents for content creators and the automated improvement bot, not user-facing content.

---

## Support

For questions or issues with YAML schema:

1. Check this documentation first
2. Review example files in each content category
3. Validate YAML syntax using online validators
4. Test locally before publishing
5. Create issue if schema needs clarification or extension

**Maintainers**: This schema should be updated whenever standards change across the BJJ Graph content repository.
