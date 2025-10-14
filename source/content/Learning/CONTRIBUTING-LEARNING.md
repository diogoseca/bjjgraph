# CONTRIBUTING-LEARNING.md

**Educational Hub Articles Standard for BJJ Graph**

Version: 1.0
Last Updated: October 2025
Status: Active Standard

---

## Table of Contents

1. [Overview](#overview)
2. [Content Characteristics](#content-characteristics)
3. [YAML Frontmatter Template](#yaml-frontmatter-template)
4. [Schema Markup Requirements](#schema-markup-requirements)
5. [Content Structure Requirements](#content-structure-requirements)
6. [Internal Linking Strategy](#internal-linking-strategy)
7. [Table & Visual Element Requirements](#table--visual-element-requirements)
8. [Learning Progression Template](#learning-progression-template)
9. [Expert Insights Integration](#expert-insights-integration)
10. [SEO Requirements](#seo-requirements)
11. [FAQ Schema Best Practices](#faq-schema-best-practices)
12. [ItemList Schema Guidelines](#itemlist-schema-guidelines)
13. [Content Examples](#content-examples)
14. [Validation Checklist](#validation-checklist)
15. [Common Mistakes](#common-mistakes)

---

## 1. Overview

### What Are Learning Articles?

Learning articles are **educational synthesis content** that differ fundamentally from technical reference pages (Positions, Transitions, Submissions). While technical pages document specific techniques with state machine precision, Learning articles provide **narrative explanations, strategic guidance, and comprehensive overviews** of BJJ topics.

**Key Differences from Technical Content:**

| Aspect | Technical Pages | Learning Articles |
|--------|----------------|-------------------|
| **Purpose** | State machine node/edge | Educational synthesis |
| **Length** | 1,000-2,000 words | 2,500-7,000 words |
| **Internal Links** | 3-10 links | 15-125 links |
| **Tone** | Precise, technical | Narrative, explanatory |
| **Schema Types** | 3-4 concurrent | 5 concurrent |
| **Target Audience** | Practitioners seeking technique | Students seeking understanding |
| **SEO Focus** | Long-tail technical terms | High-volume educational keywords |

**Primary Purpose:** Learning articles target **high-search-volume keywords** with genuine educational value. They serve as **content hubs** that cluster related technical pages together, improving both SEO performance and user navigation.

### When to Create a Learning Article vs Technical Page

**Create a Learning Article when:**
- Target keyword has 50+ monthly searches (validated with keyword research)
- Topic requires narrative explanation spanning multiple techniques
- Content serves as categorical overview (e.g., "BJJ Guard Types")
- Educational synthesis benefits from comparison tables and progressions
- Multiple technical pages need clustering around a concept
- Search intent is informational ("learn about", "understand", "guide to")

**Create a Technical Page when:**
- Content describes a specific position, transition, or submission
- State machine node or edge documentation is needed
- Success rates and decision trees are primary content
- Target audience needs step-by-step execution
- Search intent is navigational ("how to do X technique")

**Example Decision Matrix:**

| Query | Article Type | Reason |
|-------|-------------|--------|
| "BJJ guard types" | Learning | Educational overview, 1,300 searches/mo |
| "de la riva guard" | Technical Position | Specific technique, state machine node |
| "best BJJ submissions" | Learning | Ranking/comparison, 800 searches/mo |
| "triangle choke" | Technical Submission | Specific technique, state machine terminal |
| "BJJ position hierarchy" | Learning | Conceptual framework, 400 searches/mo |
| "mount escape" | Technical Transition | Specific technique, state machine edge |

### Content Philosophy

Learning articles represent BJJ Graph's commitment to **comprehensive education** beyond technique catalogs. They provide:

1. **Strategic Context**: Why techniques matter, when to use them, how they interconnect
2. **Learning Pathways**: Progression from beginner to advanced with clear milestones
3. **Comparative Analysis**: Objective evaluation of techniques, positions, and strategies
4. **Expert Synthesis**: Integration of Danaher, Gordon Ryan, and Eddie Bravo philosophies
5. **SEO Value**: Targeting keywords that drive organic traffic and establish authority

---

## 2. Content Characteristics

### Length Requirements

Learning articles are **substantially longer** than technical content to provide comprehensive coverage and meet SEO requirements:

- **Minimum**: 2,500 words (short educational article)
- **Typical**: 3,500-5,000 words (standard comprehensive guide)
- **Extensive**: 6,000-7,000 words (definitive resource on topic)

**Word Count by Keyword Competition:**

| Keyword Competition | Minimum Words | Optimal Words | Example |
|---------------------|---------------|---------------|---------|
| Low (< 100 searches/mo) | 2,500 | 3,000-3,500 | "BJJ position hierarchy" |
| Medium (100-500) | 3,500 | 4,500-5,500 | "BJJ guard types" |
| High (500-2,000) | 5,000 | 6,000-7,000 | "best BJJ submissions" |
| Very High (2,000+) | 7,000+ | 8,000-10,000 | (future targets) |

### Internal Linking Density

Learning articles serve as **content cluster hubs** with extensive internal linking:

- **Minimum**: 15 internal links (basic educational article)
- **Typical**: 30-50 links (standard comprehensive guide)
- **Extensive**: 100-125 links (definitive resource)

**Link Distribution Examples:**

- **BJJ-Guard-Types-Explained.md**: 125 links (every guard type + related transitions)
- **BJJ-Submissions-Chart-Guide.md**: 89 links (all submissions + setup positions)
- **BJJ-Position-Hierarchy-Explained.md**: 45 links (positions + hierarchy concepts)
- **Understanding-Position-Flow.md**: 32 links (positions + transitions between them)

### Schema Markup Density

Learning articles employ **5 concurrent schema types** (vs 3-4 for technical pages):

1. **WebPage Schema**: Base webpage identification
2. **BreadcrumbList Schema**: Navigation with "Learning" category level
3. **HowTo Schema**: Educational steps (NOT technical execution)
4. **FAQPage Schema**: 6-8 questions with detailed answers
5. **ItemList Schema**: For rankings, categorical lists, progressions

**Schema Count by Article Type:**

| Article Type | Schema Types | ItemList? |
|-------------|-------------|-----------|
| Comprehensive Guide | 5 | Yes (if includes ranking/list) |
| Educational Overview | 4-5 | Optional |
| Concept Explanation | 4 | Rarely |

### Comparison Tables

Learning articles use **3-8 comparison tables** to provide objective analysis:

- **Success Rate Comparisons**: Techniques vs skill levels
- **Position Characteristics**: Offensive/defensive attributes
- **Learning Progression**: Belt levels × focus areas
- **Strategic Decision Matrices**: When to use X vs Y
- **Statistical Rankings**: Competition data, effectiveness scores

**Table Density:**
- Minimum: 3 tables
- Typical: 5-6 tables
- Extensive: 8+ tables

### Tone and Voice

**Learning Articles:**
- Narrative and explanatory
- Educational and synthesizing
- Strategic and contextual
- Accessible to beginners, valuable to advanced
- Conversational yet authoritative

**Technical Pages:**
- Precise and technical
- Instructional and specific
- Execution-focused
- State machine documentation
- Formal and systematic

**Example Tone Comparison:**

**Learning Article (BJJ-Guard-Types-Explained.md):**
> "Understanding guard types is essential for developing a complete ground game. Each guard offers unique offensive and defensive characteristics, and choosing the right guard depends on your body type, athleticism, and strategic preferences. Let's explore the major guard categories and how they interconnect."

**Technical Page (Closed Guard Bottom.md):**
> "**State ID**: S002
> **Position Type**: Offensive
> **Point Value**: 0
>
> Closed Guard Bottom is a fundamental offensive position where the bottom player controls the opponent with legs locked around their torso. This position provides numerous attack options while maintaining defensive security."

---

## 3. YAML Frontmatter Template

Learning articles require **SEO-optimized frontmatter** with specific formatting:

```yaml
---
title: "[Exact Target Keyword] | [Specific Benefit Statement] | BJJ Graph"
description: "[150-160 characters including target keyword, specific numbers/data, and phrase 'complete guide' or 'comprehensive overview']"
tags: [Learning, Beginner/Intermediate/Advanced, specific-topic, secondary-keyword]
---
```

### Title Format Rules

**Structure:** `[Target Keyword] | [Benefit] | BJJ Graph`

**Title Components:**

1. **Target Keyword**: Exact match or close variant of researched keyword
2. **Benefit Statement**: Specific value proposition (not generic)
3. **Brand Suffix**: Always "BJJ Graph"

**Examples of Good Titles:**

```yaml
title: "BJJ Guard Types Explained | Master All 15+ Guard Variations | BJJ Graph"
```
- Target keyword: "BJJ guard types"
- Benefit: "Master All 15+ Guard Variations" (specific number)
- Total: 67 characters (under 70 character ideal)

```yaml
title: "Best BJJ Submissions | Top 10 Ranked by Success Rate | BJJ Graph"
```
- Target keyword: "best BJJ submissions"
- Benefit: "Top 10 Ranked by Success Rate" (specific ranking methodology)
- Total: 65 characters

```yaml
title: "BJJ Position Hierarchy Explained | Points, Control & Progression | BJJ Graph"
```
- Target keyword: "BJJ position hierarchy"
- Benefit: "Points, Control & Progression" (three specific aspects)
- Total: 75 characters

**Examples of Bad Titles:**

❌ `"Understanding BJJ Guards"` (no benefit, no brand)
❌ `"BJJ Guard Types | BJJ Graph"` (no benefit statement)
❌ `"Complete Guide to All BJJ Guard Types and Variations | BJJ Graph"` (85 chars, too long)
❌ `"Guards in Brazilian Jiu-Jitsu | Learn More | BJJ Graph"` (keyword mismatch, generic benefit)

### Description Format Rules

**Structure:** `[Hook with keyword] [Specific data/numbers] [Content type] [Call to action]`

**Length**: 150-160 characters (strict)

**Required Elements:**
1. Target keyword in first 50 characters
2. Specific numbers or data points
3. Phrase "complete guide" or "comprehensive overview"
4. Action verb (Learn, Master, Discover, Explore)

**Examples of Good Descriptions:**

```yaml
description: "Master all 15+ BJJ guard types with this complete guide. Learn open guards, closed guards, half guards, and leg entanglements with success rates and progressions."
```
- Length: 159 characters
- Keyword placement: Character 15
- Specific number: "15+ BJJ guard types"
- Content type: "complete guide"
- Data: "success rates and progressions"

```yaml
description: "Discover the top 10 BJJ submissions ranked by success rate. Complete guide covers chokes, armbars, leg locks with competition statistics and setup requirements."
```
- Length: 156 characters
- Keyword placement: Character 20
- Specific number: "top 10"
- Content type: "Complete guide"
- Data: "success rate", "competition statistics"

```yaml
description: "Learn BJJ position hierarchy from neutral to dominant control. Comprehensive guide covers point values, escape priorities, and strategic progression paths."
```
- Length: 154 characters
- Keyword placement: Character 7
- Content type: "Comprehensive guide"
- Data: "point values, escape priorities, strategic progression"

**Examples of Bad Descriptions:**

❌ `"Learn about BJJ guards"` (too short, no data, no keyword specificity)
❌ `"This article explains the different types of guards used in Brazilian Jiu-Jitsu"` (80 chars, no data, passive voice)
❌ `"Complete comprehensive detailed guide to understanding all guard types variations"` (85 chars, keyword stuffing, no data)

### Tags Requirements

**Minimum**: 4 tags
**Typical**: 5-6 tags
**Maximum**: 8 tags

**Required Tag Categories:**

1. **Content Type**: Always "Learning"
2. **Skill Level**: Beginner, Intermediate, Advanced, or Multiple
3. **Topic Category**: guards, submissions, positions, transitions, strategy, concepts
4. **Secondary Keywords**: Related terms from keyword research

**Examples:**

```yaml
tags: [Learning, Beginner, guards, guard-types, open-guard, closed-guard]
```

```yaml
tags: [Learning, Multiple, submissions, chokes, armbars, leg-locks, competition]
```

```yaml
tags: [Learning, Intermediate, positions, hierarchy, control, escapes, strategy]
```

---

## 4. Schema Markup Requirements

Learning articles require **5 concurrent schema types** with specific educational adaptations.

### WebPage Schema (Standard)

**Placement**: After YAML frontmatter, before content
**Purpose**: Base webpage identification

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "BJJ Guard Types Explained | Master All 15+ Guard Variations | BJJ Graph",
  "description": "Master all 15+ BJJ guard types with this complete guide. Learn open guards, closed guards, half guards, and leg entanglements with success rates.",
  "url": "https://bjjgraph.com/learning/bjj-guard-types-explained",
  "isPartOf": {
    "@type": "WebSite",
    "name": "BJJ Graph",
    "url": "https://bjjgraph.com"
  }
}
</script>
```

**Required Fields:**
- `name`: Exact page title from frontmatter
- `description`: Exact description from frontmatter
- `url`: Canonical URL with /learning/ path
- `isPartOf`: Website context

### BreadcrumbList Schema (with Learning Category)

**Placement**: After WebPage schema
**Purpose**: Navigation hierarchy with Learning category level

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://bjjgraph.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Learning",
      "item": "https://bjjgraph.com/learning"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "BJJ Guard Types Explained",
      "item": "https://bjjgraph.com/learning/bjj-guard-types-explained"
    }
  ]
}
</script>
```

**Key Difference from Technical Pages:**
- Position 2 is "Learning" category (vs "Positions", "Transitions", "Submissions")
- URL path includes /learning/ subdirectory

### HowTo Schema - Educational Steps (NOT Technical Execution)

**Placement**: After BreadcrumbList schema
**Purpose**: Structured learning pathway (NOT technique execution)

**Critical Distinction:**

| Technical HowTo | Educational HowTo |
|----------------|-------------------|
| **Purpose**: Execute a technique | **Purpose**: Learn a concept |
| **Steps**: Physical movements | **Steps**: Knowledge acquisition stages |
| **Example**: "Place hand on collar, pull elbow" | **Example**: "Study position characteristics, compare options" |
| **Tool/Supply**: Equipment (gi, mat) | **Tool/Supply**: Resources (articles, videos) |
| **Total Time**: Seconds to minutes | **Total Time**: Weeks to months |

**Example Educational HowTo:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Master BJJ Guard Types",
  "description": "Complete learning pathway for understanding and implementing all major BJJ guard types.",
  "totalTime": "PT12W",
  "tool": [
    "Access to BJJ Graph position pages",
    "Training partner or dummy",
    "Video analysis tools"
  ],
  "supply": [
    "BJJ gi or rashguard",
    "Training notebook",
    "Mat space"
  ],
  "step": [
    {
      "@type": "HowToStep",
      "name": "Understand Guard Fundamentals",
      "text": "Study the core principles of guard work: distance management, angle creation, off-balancing. Review fundamental positions like Closed Guard and Open Guard to establish baseline understanding.",
      "url": "https://bjjgraph.com/learning/bjj-guard-types-explained#fundamentals"
    },
    {
      "@type": "HowToStep",
      "name": "Learn Closed Guard System",
      "text": "Master Closed Guard Bottom as your foundation. Learn breaking posture, attacking with sweeps and submissions, and maintaining control. Spend 2-3 weeks developing Closed Guard before progressing.",
      "url": "https://bjjgraph.com/positions/closed-guard-bottom"
    },
    {
      "@type": "HowToStep",
      "name": "Explore Open Guard Variations",
      "text": "Study Open Guard positions: De La Riva, Spider Guard, Lasso Guard. Compare characteristics and identify which suits your body type and game. Practice 2-3 open guards in rotation.",
      "url": "https://bjjgraph.com/learning/bjj-guard-types-explained#open-guards"
    },
    {
      "@type": "HowToStep",
      "name": "Add Half Guard to Repertoire",
      "text": "Learn Half Guard variations: Standard Half Guard, Knee Shield, Deep Half, Lockdown. Understand when to use each based on opponent's passing pressure.",
      "url": "https://bjjgraph.com/positions/half-guard-bottom"
    },
    {
      "@type": "HowToStep",
      "name": "Study Leg Entanglement Guards",
      "text": "Explore modern leg entanglement guards: Ashi Garami, 50/50, X-Guard, Single Leg X. Learn safety protocols and legal considerations for your competition ruleset.",
      "url": "https://bjjgraph.com/learning/bjj-guard-types-explained#leg-entanglements"
    },
    {
      "@type": "HowToStep",
      "name": "Develop Guard Retention Skills",
      "text": "Practice guard recovery and retention. Learn to recognize passing attempts early and chain guard types together to prevent passes.",
      "url": "https://bjjgraph.com/concepts/guard-retention-concepts"
    },
    {
      "@type": "HowToStep",
      "name": "Build Position-Specific Game Plans",
      "text": "Create detailed game plans for each guard type. Document your highest-percentage attacks, common problems, and backup options.",
      "url": "https://bjjgraph.com/learning/bjj-guard-types-explained#building-your-game"
    },
    {
      "@type": "HowToStep",
      "name": "Test and Refine in Live Training",
      "text": "Apply guard types in positional sparring and live rolling. Track success rates and identify gaps in your game. Continuously refine based on results.",
      "url": "https://bjjgraph.com/learning/bjj-guard-types-explained#live-application"
    }
  ]
}
</script>
```

**Educational HowTo Requirements:**

- **Minimum steps**: 5
- **Typical steps**: 7-10
- **Maximum steps**: 12
- **Step content**: 2-3 sentences minimum
- **URLs**: Link to relevant sections or related pages
- **Total time**: Realistic learning timeline (weeks to months)
- **Tools/Supply**: Educational resources, not just equipment

### FAQPage Schema (6-8 Questions, Detailed Answers)

**Placement**: After HowTo schema
**Purpose**: Answer common questions for "People Also Ask" boxes

**Updated Requirements (Based on Research):**

- **Minimum questions**: 6 (updated from 3-4)
- **Typical questions**: 6-8
- **Maximum questions**: 10
- **Answer length**: 2-3 sentences (updated from 1 sentence)
- **Answer style**: Specific, actionable, data-driven

**Example FAQPage Schema:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What are the main types of BJJ guards?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The main BJJ guard types include Closed Guard (legs locked around opponent), Open Guard (various grips without leg lock), Half Guard (one leg trapped), and Leg Entanglement Guards (controlling opponent's legs). Each category contains 5-10 specific variations with unique characteristics and applications."
      }
    },
    {
      "@type": "Question",
      "name": "Which BJJ guard is best for beginners?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Closed Guard is universally recommended for beginners due to its defensive security and clear attack structure. Success rates for beginners: sweeps 40-45%, submissions 25-30%. Beginners should spend 3-6 months developing Closed Guard fundamentals before exploring open guard variations."
      }
    },
    {
      "@type": "Question",
      "name": "How long does it take to master a BJJ guard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Basic proficiency in a single guard type typically requires 6-12 months of focused training, while true mastery takes 3-5 years of consistent refinement. Most practitioners develop 2-3 'A-game' guards by purple belt (4-6 years) and continue adding variations throughout their career."
      }
    },
    {
      "@type": "Question",
      "name": "What is the most effective BJJ guard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Guard effectiveness depends on individual attributes and ruleset, but De La Riva Guard shows highest success rates in competition: 55-65% sweep rate for advanced practitioners. For no-gi, Butterfly Guard and Ashi Garami dominate modern competition with 50-60% and 40-50% success rates respectively."
      }
    },
    {
      "@type": "Question",
      "name": "Are leg entanglement guards legal in BJJ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Leg entanglement guard legality varies by ruleset and belt level. IBJJF allows basic Ashi Garami at blue belt but restricts reaping until brown belt. Submission-only and ADCC rulesets permit most leg entanglements at all levels. Always verify specific rules for your competition."
      }
    },
    {
      "@type": "Question",
      "name": "How do I choose which guard to learn?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Choose guards based on: (1) body type (long legs favor Spider/Lasso, shorter builds favor Butterfly), (2) athleticism level (dynamic guards require more explosiveness), (3) training environment (gi vs no-gi), and (4) strategic preferences (offensive vs defensive orientation). Start with Closed Guard regardless of body type."
      }
    },
    {
      "@type": "Question",
      "name": "What's the difference between open and closed guard?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Closed Guard locks legs around opponent's torso, providing maximum control but limited mobility (success rate: beginners 35%, advanced 55%). Open Guard maintains various grips without leg lock, offering greater mobility but requiring active management (success rate: beginners 25%, advanced 60%)."
      }
    },
    {
      "@type": "Question",
      "name": "Should I learn gi or no-gi guards first?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Learning gi guards first is generally recommended as grip-based control develops fundamental distance management and timing (transferable to no-gi). However, if you exclusively train no-gi, prioritize Butterfly Guard, Ashi Garami, and body lock-based controls. Many competitive practitioners train both simultaneously."
      }
    }
  ]
}
</script>
```

### ItemList Schema (Rankings, Categories, Progressions)

**Placement**: After FAQPage schema
**Purpose**: Structured lists for rich snippets (Top 10, categorical lists)

**When to Use ItemList:**

- Rankings (Top 10 submissions, Best guards)
- Categorical listings (All guard types, Essential positions)
- Ordered progressions (White belt → Black belt priorities)
- Comparison lists (Gi vs No-gi techniques)

**When NOT to Use ItemList:**

- Unordered concept discussions
- Narrative explanations without clear list structure
- Single-item focus articles

**Example ItemList Schema:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Complete List of BJJ Guard Types",
  "description": "Comprehensive categorical list of all major BJJ guard variations organized by type.",
  "numberOfItems": 18,
  "itemListOrder": "https://schema.org/ItemListOrderAscending",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Closed Guard",
      "url": "https://bjjgraph.com/positions/closed-guard-bottom",
      "description": "Fundamental guard with legs locked around opponent's torso. Beginner success rate: 40%."
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Open Guard",
      "url": "https://bjjgraph.com/positions/open-guard-bottom",
      "description": "Guard category with various grips and no leg lock. Advanced success rate: 60%."
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "De La Riva Guard",
      "url": "https://bjjgraph.com/positions/de-la-riva-guard",
      "description": "Hook-based open guard controlling one leg. Competition sweep rate: 55-65%."
    }
  ]
}
</script>
```

**ItemList Requirements:**

- **Minimum items**: 5
- **Typical items**: 10-20
- **Maximum items**: 50 (consider splitting into multiple lists)
- **Description**: 1-2 sentences with specific data
- **URL**: Link to related technical page or section
- **Order**: Meaningful ordering (ranking, category, progression)

---

## 5. Content Structure Requirements

Learning articles follow a **narrative structure** with multiple major sections.

### Introduction (200-300 words)

**Purpose**: Hook reader, establish context, preview content

**Required Elements:**

1. **Opening Hook** (1-2 sentences)
   - Engaging statement or question
   - Relates to reader's experience or pain point

2. **Problem/Opportunity Statement** (2-3 sentences)
   - Why this topic matters
   - What reader will learn

3. **Content Preview** (2-3 sentences)
   - Major sections covered
   - Specific value propositions

4. **Expert Context** (1-2 sentences, optional)
   - Brief mention of expert perspectives
   - Establishes authority

**Example Introduction:**

> Choosing the right guard in Brazilian Jiu-Jitsu can make the difference between dominating from the bottom or constantly defending against passes. With over 15 distinct guard types, each offering unique offensive and defensive characteristics, understanding which guards suit your body type, athleticism, and strategic goals is essential for developing an effective ground game.
>
> This comprehensive guide explores all major BJJ guard types, from fundamental Closed Guard to advanced leg entanglements. You'll learn the characteristics of each guard, success rates by skill level, optimal body types, and strategic applications. We'll compare gi and no-gi variations, examine competition statistics, and provide learning progressions from white belt to black belt.
>
> Whether you're a beginner establishing your first guard or an advanced practitioner refining your A-game, this guide will help you navigate the complex landscape of BJJ guard work with insights from John Danaher's systematic approach, Gordon Ryan's competition-proven methods, and Eddie Bravo's innovative 10th Planet system.

### Quick Navigation / Table of Contents

**Required For**: Articles over 3,000 words
**Optional For**: Articles 2,500-3,000 words
**Placement**: After introduction, before first major section

**Format:**

```markdown
## Quick Navigation

- [Understanding Guard Fundamentals](#understanding-guard-fundamentals)
- [Closed Guard System](#closed-guard-system)
- [Open Guard Variations](#open-guard-variations)
- [Half Guard Family](#half-guard-family)
- [Leg Entanglement Guards](#leg-entanglement-guards)
- [Choosing Your Guard](#choosing-your-guard)
- [Learning Progression by Belt](#learning-progression-by-belt)
- [Training Methodology](#training-methodology)
- [Related Resources](#related-resources)
```

### Major Sections (300-800 words each)

**Typical Article Structure:**

1. **Introduction** (200-300 words)
2. **Quick Navigation** (if applicable)
3. **Fundamentals/Overview Section** (400-600 words)
4. **Category Section 1** (500-800 words)
5. **Category Section 2** (500-800 words)
6. **Category Section 3** (500-800 words)
7. **Comparative Analysis Section** (400-600 words)
8. **Strategic Guidance Section** (400-600 words)
9. **Learning Progression Section** (500-700 words)
10. **Training Methodology Section** (300-500 words)
11. **Related Resources** (200-400 words)
12. **Conclusion** (100-200 words)

**Section Requirements:**

- **Minimum per section**: 300 words
- **Typical per section**: 500 words
- **Maximum per section**: 800 words (split if longer)
- **Subsections**: Use H3 headings for 200+ word subsections
- **Internal links**: 3-10 per major section
- **Tables**: 0-2 per major section

### Comparison Tables (3-8 per article)

**Purpose**: Objective analysis with data

**Table Types:**

1. **Success Rate Comparisons**
   - Techniques vs skill levels
   - Format: Rows = techniques, Columns = beginner/intermediate/advanced

2. **Position Characteristics**
   - Attributes by position type
   - Format: Rows = positions, Columns = offensive/defensive/control/mobility

3. **Learning Progression**
   - Belt levels vs focus areas
   - Format: Rows = belt levels, Columns = focus/priorities/training split

4. **Strategic Decision Matrices**
   - When to use X vs Y
   - Format: Rows = scenarios, Columns = option A/option B/recommendation

5. **Statistical Rankings**
   - Competition data
   - Format: Rows = techniques, Columns = rank/success rate/usage rate

**Example Comparison Table:**

```markdown
| Guard Type | Beginner Success | Intermediate Success | Advanced Success | Best For | Learning Time |
|-----------|-----------------|---------------------|------------------|----------|---------------|
| Closed Guard | 40% | 55% | 70% | All body types | 3-6 months |
| De La Riva | 25% | 45% | 65% | Long legs | 6-12 months |
| Butterfly | 30% | 50% | 60% | Short/stocky | 6-12 months |
| Ashi Garami | 20% | 40% | 55% | Technical players | 12-18 months |
```

### Learning Progressions (Required)

**Purpose**: Belt-level timelines with focus areas

**Format**: Table or structured list with 4-5 belt levels

**Required Information per Belt:**
- Time range (years)
- Primary focus areas (3-5 items)
- Training split percentages
- Success rate benchmarks
- Common mistakes to avoid

**Example Learning Progression:**

```markdown
## Learning Progression by Belt Level

### White Belt (0-2 Years)

**Primary Focus:**
- [[Closed Guard Bottom]] fundamentals (60% of guard training)
- Basic [[Open Guard Bottom]] concepts (30% of guard training)
- Guard retention and recovery (10% of guard training)

**Success Rate Benchmarks:**
- Closed Guard sweeps: 35-45%
- Closed Guard submissions: 20-30%
- Basic guard retention: 40-50%

**Training Split:**
- 60% positional drilling (specific positions)
- 30% technique instruction
- 10% live guard passing/retention

**Common Mistakes:**
- Attempting advanced guards before mastering Closed Guard
- Neglecting guard retention in favor of attacks
- Insufficient hip mobility development

### Blue Belt (2-4 Years)

**Primary Focus:**
- Developing 2-3 specialized open guards (50% of guard training)
- Refining [[Closed Guard Bottom]] attacks (30% of guard training)
- [[Half Guard Bottom]] fundamentals (20% of guard training)

**Success Rate Benchmarks:**
- Specialized guard sweeps: 45-55%
- Specialized guard submissions: 30-40%
- Guard retention: 55-65%

**Training Split:**
- 50% positional sparring
- 30% drilling specific sequences
- 20% live rolling with guard focus

**Common Mistakes:**
- Learning too many guards superficially
- Neglecting guard passing (only playing guard)
- Insufficient competition testing of guard game
```

### Expert Insights (Distributed Throughout)

**Placement**: Within relevant sections (NOT separate section)

**Distribution Requirements:**
- Minimum: 3 expert insights total (1 per expert)
- Typical: 5-8 expert insights (distributed across sections)
- Maximum: 12 expert insights (avoid oversaturation)

**Integration Style:**

```markdown
## Open Guard Variations

Open guards provide dynamic offensive options while requiring active management...

**John Danaher's Systematic Approach:**

Danaher emphasizes developing a "guard cluster" rather than isolated positions: "The most effective guard players don't just play one guard—they flow between 3-4 related guards that share common grips and entries. Your opponent must defend against multiple threats simultaneously, creating decision-making pressure."

This systematic approach suggests organizing your guard game around **grip families** (sleeve/collar, leg control, body locks) rather than position names...
```

### Strategic Guidance (Beyond Technique Description)

**Purpose**: Decision-making frameworks, not just technique lists

**Content Types:**

1. **Selection Criteria**: How to choose between options
2. **Game Planning**: Building coherent strategies
3. **Opponent Adaptation**: Adjusting to different styles
4. **Competition Strategy**: Ruleset considerations
5. **Training Priorities**: Resource allocation

**Example Strategic Guidance:**

```markdown
## Building Your Guard Game Plan

Effective guard play requires more than knowing techniques—you need a coherent **guard system** that chains positions together...

### Guard Selection Framework

Choose your primary guards based on these factors:

1. **Body Type Optimization**
   - Long legs: [[Spider Guard]], [[Lasso Guard]], [[De La Riva Guard]]
   - Short/stocky: [[Butterfly Guard]], [[Half Guard Bottom]], [[X-Guard]]
   - Athletic/flexible: [[Rubber Guard]], [[Inverted Guard]], [[Berimbolo entries]]

2. **Training Environment**
   - Gi-dominant: Grip-based guards ([[De La Riva Guard]], [[Spider Guard]])
   - No-gi exclusive: Body locks, leg entanglements ([[Butterfly Guard]], [[Ashi Garami]])
   - Mixed: Transferable guards ([[Closed Guard Bottom]], [[Half Guard Bottom]])

3. **Strategic Orientation**
   - Offensive/sweeping focus: [[De La Riva Guard]] (65% sweep rate), [[Butterfly Guard]] (60%)
   - Submission hunting: [[Closed Guard Bottom]] (50% submission rate), [[Ashi Garami]] (45%)
   - Defensive/conservative: [[Half Guard Bottom]] (secure control), [[Lockdown Position]]
```

### Training Methodology (300-500 words)

**Purpose**: How to train the content, not just what to train

**Required Subsections:**

1. **Drilling Progressions** (specific drills with reps)
2. **Positional Sparring** (time allocations, starting positions)
3. **Live Integration** (percentage-based training splits)
4. **Solo Practice** (off-mat work, visualization)
5. **Progress Tracking** (metrics to monitor)

**Example Training Methodology:**

```markdown
## Training Methodology

### Drilling Progressions

**Phase 1: Isolated Movement (Weeks 1-2)**
- 10 minutes per session
- Solo guard entries (5 reps each side, 3 rounds)
- Partner-assisted grip fighting (10 reps each variation)

**Phase 2: Sequence Drilling (Weeks 3-4)**
- 15 minutes per session
- Guard entry → sweep attempt (8 reps each side)
- Guard entry → submission attempt (8 reps each side)
- Guard recovery under pressure (5 minutes continuous)

**Phase 3: Resistance Drilling (Weeks 5-8)**
- 20 minutes per session
- 30% resistance: 5 x 2-minute rounds
- 50% resistance: 5 x 3-minute rounds
- 70% resistance: 3 x 5-minute rounds

### Positional Sparring

**Guard Player Starting Position:**
- Establish grips, opponent standing or kneeling
- 5-minute rounds, 30-second reset if pass occurs
- Track: sweeps landed, passes defended, submission attempts

**Goal Targets:**
- Beginner: 40% sweep rate, 50% pass defense
- Intermediate: 55% sweep rate, 65% pass defense
- Advanced: 70% sweep rate, 80% pass defense
```

### Related Resources Section (200-400 words, 15+ links)

**Purpose**: Cluster related content for SEO and navigation

**Required Elements:**

1. **Category Clusters** (positions, transitions, submissions)
2. **Conceptual Links** (principles, strategies)
3. **System Links** (expert frameworks)
4. **Other Learning Articles** (related guides)

**Format:**

```markdown
## Related Resources

### Essential Guard Positions

Master these fundamental guard positions:

- [[Closed Guard Bottom]] - Foundation for all guard work
- [[Open Guard Bottom]] - Dynamic offensive platform
- [[De La Riva Guard]] - High-percentage hook-based control
- [[Half Guard Bottom]] - Defensive to offensive transition
- [[Butterfly Guard]] - Explosive sweeping system
- [[X-Guard]] - Elevation-based sweep machine
- [[Ashi Garami]] - Modern leg entanglement control

### Key Guard Transitions

Learn these essential transitions:

- [[Pull Guard]] - Guard establishment from standing
- [[Open Guard to Deep Half]] - Defensive recovery
- [[Butterfly Sweep]] - Classic elevation sweep
- [[De La Riva Sweep]] - Off-balancing from DLR
- [[X-Guard Sweep]] - Technical stand-up sweep

### Conceptual Foundations

Understand the principles behind guard work:

- [[Guard Retention Concepts]] - Preventing passes
- [[Distance Creation]] - Managing space
- [[Off-Balancing Principles]] - Creating sweep opportunities
- [[Defensive Framing]] - Maintaining structure

### Strategic Frameworks

Explore systematic approaches:

- [[Danaher Guard System]] - Systematic guard development
- [[Gordon Ryan Guard Game]] - Competition-proven methods
- [[Eddie Bravo Rubber Guard]] - Innovative control system

### Additional Learning Resources

- [[Understanding Position Flow]] - State machine concepts
- [[BJJ Position Hierarchy Explained]] - Points and control
- [[Best BJJ Submissions Chart]] - Finishing from guard
```

### Conclusion with Actionable Next Steps (100-200 words)

**Purpose**: Summarize and direct action

**Required Elements:**

1. **Key Takeaways** (2-3 bullet points)
2. **Immediate Action Steps** (specific, actionable)
3. **Long-term Development Path** (next 3-6 months)
4. **Further Reading Link** (1-2 related articles)

**Example Conclusion:**

```markdown
## Conclusion

Mastering BJJ guard types is a journey that spans your entire jiu-jitsu career. The key insights:

- **Start with Closed Guard** regardless of body type (3-6 months minimum)
- **Develop 2-3 specialized guards** by blue belt based on your attributes
- **Build guard clusters** that flow together rather than isolated positions
- **Balance offensive and defensive skills** (sweeps, submissions, retention)

**Your Next Steps:**

1. **This week**: Assess your current guard game and identify gaps
2. **This month**: Choose 1-2 new guard variations to explore in drilling
3. **Next 3 months**: Integrate new guards into positional sparring
4. **Next 6 months**: Test guard system in competition or hard sparring

For deeper understanding of guard retention and recovery, read [[Guard Retention Concepts]]. To explore systematic guard development, see [[Understanding Position Flow]].
```

---

## 6. Internal Linking Strategy

Learning articles serve as **content cluster hubs** with extensive internal linking.

### Minimum Requirements

- **Minimum links**: 15
- **Typical links**: 30-50
- **Comprehensive guides**: 100-125

### Link Distribution Throughout Article

**By Section Type:**

| Section Type | Typical Links | Purpose |
|-------------|--------------|---------|
| Introduction | 2-4 | Context setting |
| Fundamentals | 5-10 | Core concepts |
| Category Sections | 8-15 each | Technical depth |
| Comparison Sections | 5-8 | Cross-referencing |
| Learning Progression | 10-15 | Belt-level resources |
| Related Resources | 15-50 | Cluster building |
| Conclusion | 2-4 | Next steps |

### Link Types and Purposes

1. **Position Links** (40-60% of links)
   - Primary technical pages
   - State machine nodes
   - Examples: [[Closed Guard Bottom]], [[Mount]], [[Side Control Top]]

2. **Transition Links** (20-30% of links)
   - State machine edges
   - Connecting positions
   - Examples: [[Hip Bump Sweep]], [[Knee Slice Pass]], [[Back Take]]

3. **Submission Links** (10-20% of links)
   - Terminal states
   - Finishing techniques
   - Examples: [[Triangle Choke]], [[Armbar]], [[Rear Naked Choke]]

4. **Concept Links** (5-10% of links)
   - Principles and theory
   - Strategic frameworks
   - Examples: [[Base Maintenance]], [[Guard Retention Concepts]], [[Pressure Principles]]

5. **System Links** (3-5% of links)
   - Expert frameworks
   - Comprehensive systems
   - Examples: [[Danaher Death Squad System]], [[10th Planet System]]

6. **Other Learning Links** (3-5% of links)
   - Related educational articles
   - Cross-promotion
   - Examples: [[Understanding Position Flow]], [[BJJ Position Hierarchy Explained]]

### Creating Content Clusters

**Hub and Spoke Model:**

```
Learning Article (Hub)
├── Spoke: Position 1
├── Spoke: Position 2
├── Spoke: Position 3
├── Spoke: Transition 1
├── Spoke: Transition 2
└── Spoke: Concept 1
```

**Example Cluster: BJJ-Guard-Types-Explained.md**

- **Hub**: Main learning article (125 links)
- **Spokes**: 18 guard positions + 30 transitions + 15 submissions + 12 concepts

**SEO Benefits:**

1. **Internal Link Equity**: Distributes page authority to technical pages
2. **Crawl Efficiency**: Helps search engines discover all content
3. **Topic Authority**: Signals comprehensive coverage to Google
4. **User Navigation**: Provides clear pathways through content
5. **Dwell Time**: Encourages deeper site exploration

### Link Density Guidelines

**Words per Link:**

- Minimum: 1 link per 100 words
- Typical: 1 link per 60-80 words
- Aggressive: 1 link per 40-50 words

**Example Calculation for 4,000-word article:**

- Minimum: 40 links
- Typical: 50-67 links
- Aggressive: 80-100 links

**Distribution Strategy:**

```markdown
Introduction (300 words): 3-4 links
Section 1 (600 words): 8-10 links
Section 2 (700 words): 10-12 links
Section 3 (500 words): 6-8 links
Learning Progression (800 words): 12-15 links
Related Resources (300 words): 20-30 links
Conclusion (200 words): 2-3 links
TOTAL: 61-82 links (typical range)
```

---

## 7. Table & Visual Element Requirements

Learning articles use **tables and visual elements** for comparative analysis.

### Comparison Tables (3-8 per article)

**Table Types:**

#### 1. Success Rate Comparison Tables

**Purpose**: Compare technique effectiveness by skill level

**Format:**

```markdown
| Technique | Beginner | Intermediate | Advanced | Difficulty | Learning Time |
|-----------|----------|--------------|----------|------------|---------------|
| Technique 1 | 30% | 50% | 70% | Medium | 6 months |
| Technique 2 | 25% | 45% | 65% | High | 12 months |
```

**Required Columns**:
- Technique name (linked to page)
- Beginner % (realistic, not aspirational)
- Intermediate % (10-15% higher than beginner)
- Advanced % (10-15% higher than intermediate)
- Difficulty rating (Low/Medium/High)
- Learning time estimate (months/years)

**Example:**

```markdown
| Guard Type | Beginner Success | Intermediate Success | Advanced Success | Difficulty | Learning Time | Best Body Type |
|-----------|-----------------|---------------------|------------------|------------|---------------|----------------|
| [[Closed Guard Bottom]] | 40% | 55% | 70% | Low | 3-6 months | All |
| [[De La Riva Guard]] | 25% | 45% | 65% | High | 6-12 months | Long legs |
| [[Butterfly Guard]] | 30% | 50% | 60% | Medium | 6-12 months | Short/stocky |
| [[Half Guard Bottom]] | 35% | 50% | 65% | Medium | 4-8 months | All |
| [[X-Guard]] | 20% | 40% | 60% | High | 8-12 months | Athletic |
| [[Ashi Garami]] | 20% | 40% | 55% | Very High | 12-18 months | Technical |
```

#### 2. Position Characteristics Tables

**Purpose**: Compare attributes across positions

**Format:**

```markdown
| Position | Offensive Potential | Defensive Security | Control Level | Mobility | Energy Cost |
|----------|-------------------|-------------------|---------------|----------|-------------|
| Position 1 | High | Medium | High | Low | High |
| Position 2 | Medium | High | Medium | Medium | Medium |
```

**Required Columns**:
- Position name (linked)
- 3-5 characteristic ratings
- Use consistent scale (Low/Medium/High or 1-5 scale)

**Example:**

```markdown
| Guard Position | Sweep Potential | Submission Potential | Pass Resistance | Mobility | Gi/No-gi |
|---------------|----------------|---------------------|----------------|----------|----------|
| [[Closed Guard Bottom]] | High | High | Very High | Low | Both |
| [[Open Guard Bottom]] | Very High | Medium | Medium | Very High | Both |
| [[De La Riva Guard]] | Very High | Low | High | High | Gi-focused |
| [[Butterfly Guard]] | Very High | Medium | Medium | High | Both |
| [[Half Guard Bottom]] | Medium | Medium | High | Low | Both |
| [[Ashi Garami]] | Low | Very High | Medium | Low | Both |
```

#### 3. Learning Progression Tables

**Purpose**: Belt-level development timelines

**Format:**

```markdown
| Belt Level | Time Range | Primary Focus | Training Split | Success Benchmarks |
|------------|-----------|--------------|---------------|-------------------|
| White | 0-2 years | Fundamentals | 60% drilling, 40% rolling | 35-45% |
| Blue | 2-4 years | Specialization | 50% drilling, 50% rolling | 50-60% |
```

**Required Columns**:
- Belt level
- Time range (years)
- Primary focus (2-3 items)
- Training split percentages
- Success rate benchmarks

**Example:**

```markdown
| Belt Level | Time | Guard Focus | Training Split | Sweep Success | Submission Success | Pass Defense |
|-----------|------|-------------|----------------|---------------|-------------------|-------------|
| **White Belt** | 0-2 years | Closed Guard fundamentals | 60% drilling, 30% positional, 10% live | 35-45% | 20-30% | 40-50% |
| **Blue Belt** | 2-4 years | 2-3 specialized open guards | 50% drilling, 30% positional, 20% live | 45-55% | 30-40% | 55-65% |
| **Purple Belt** | 4-6 years | Guard system development | 40% drilling, 30% positional, 30% live | 55-65% | 40-50% | 65-75% |
| **Brown/Black** | 6+ years | System refinement, competition | 30% drilling, 30% positional, 40% live | 65-75% | 50-60% | 75-85% |
```

#### 4. Decision Matrix Tables

**Purpose**: Guide selection between options

**Format:**

```markdown
| Scenario | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Scenario 1 | Pros/Cons | Pros/Cons | Best choice with rationale |
```

**Example:**

```markdown
| Opponent Type | Closed Guard | Open Guard | Strategic Recommendation |
|--------------|--------------|-----------|------------------------|
| **Pressure passer** | Lower success (30%) - difficult to break posture | Higher success (50%) - create angles | Use [[Open Guard Bottom]] with [[De La Riva Guard]] to off-balance |
| **Speed passer** | Higher success (55%) - control pace | Lower success (35%) - hard to track | Use [[Closed Guard Bottom]] to slow them down |
| **Tall opponent** | Medium success (40%) - hard to control | Higher success (60%) - exploit leg length | Use [[Spider Guard]] or [[Lasso Guard]] to control distance |
| **Short/stocky opponent** | Higher success (50%) - easier to break down | Medium success (45%) - can generate power | Use [[Closed Guard Bottom]] or [[Triangle Choke]] setups |
```

#### 5. Statistical/Ranking Tables

**Purpose**: Present competition data or rankings

**Format:**

```markdown
| Rank | Technique | Success Rate | Usage Rate | Competition Context |
|------|-----------|-------------|-----------|-------------------|
| 1 | Technique 1 | 65% | High | IBJJF, ADCC |
```

**Example:**

```markdown
| Rank | Submission | Competition Success Rate | Average Finish Time | Legality (IBJJF) | Best From Position |
|------|-----------|------------------------|-------------------|-----------------|-------------------|
| 1 | [[Rear Naked Choke]] | 68% | 2:45 | All belts | [[Back Control]] |
| 2 | [[Triangle Choke]] | 55% | 3:30 | All belts | [[Closed Guard Bottom]] |
| 3 | [[Armbar]] | 52% | 2:15 | All belts | [[Mount]], [[Guard]] |
| 4 | [[Guillotine Choke]] | 48% | 2:00 | All belts | [[Standing]], [[Guard]] |
| 5 | [[Kimura]] | 42% | 3:00 | All belts | [[Side Control Top]] |
| 6 | [[Inside Heel Hook]] | 65% | 1:30 | Brown belt+ | [[Ashi Garami]] |
| 7 | [[Bow and Arrow Choke]] | 40% | 3:15 | All belts | [[Back Control]] |
| 8 | [[Omoplata]] | 35% | 4:00 | All belts | [[Closed Guard Bottom]] |
| 9 | [[Darce Choke]] | 38% | 2:45 | All belts | [[Half Guard Top]] |
| 10 | [[Straight Footlock]] | 30% | 2:30 | All belts | [[Ashi Garami]] |
```

### Markdown Table Formatting Standards

**Column Alignment:**

```markdown
| Left-aligned | Center-aligned | Right-aligned |
|:------------|:-------------:|-------------:|
| Text | Text | 42% |
```

**Use Alignment:**
- **Left**: Names, descriptions, qualitative data
- **Center**: Ratings, short codes, categories
- **Right**: Numbers, percentages, quantitative data

**Column Width Considerations:**
- Keep total table width under 120 characters for mobile readability
- Use abbreviations where appropriate
- Link position/technique names (keeps columns narrow)

**Table Accessibility:**
- Clear header row
- Consistent data formats within columns
- Avoid merged cells (not supported in markdown)
- Use descriptive column headers

### Alt Text for Future Images

**Preparation for visual content:**

```markdown
<!-- Future image placeholder -->
*[Alt text: Diagram showing Closed Guard Bottom position with key control points labeled: head control, posture break, hip position, and leg lock around torso]*
```

**Alt Text Guidelines:**
- Describe what's shown, not "image of..."
- Include key technical points visible
- 1-2 sentences maximum
- Include relevant technique names

---

## 8. Learning Progression Template

Learning progression sections are **required** for all Learning articles covering technique categories.

### Standard Belt-Level Structure

**Required Belt Levels:**

1. **White Belt** (0-2 years)
2. **Blue Belt** (2-4 years)
3. **Purple Belt** (4-6 years)
4. **Brown/Black Belt** (6+ years)

### Template with Fill-in-the-Blank Sections

```markdown
## Learning Progression by Belt Level

### White Belt (0-2 Years)

**Primary Focus:**
- [FUNDAMENTAL POSITION/TECHNIQUE 1] (XX% of training time)
- [FUNDAMENTAL POSITION/TECHNIQUE 2] (XX% of training time)
- [DEFENSIVE CONCEPT] (XX% of training time)

**Key Techniques to Master:**
- [[Link to Position 1]]
- [[Link to Position 2]]
- [[Link to Transition 1]]
- [[Link to Concept 1]]

**Success Rate Benchmarks:**
- [Primary technique type]: XX-XX%
- [Secondary technique type]: XX-XX%
- [Defensive skill]: XX-XX%

**Training Split:**
- XX% positional drilling (specific positions)
- XX% technique instruction
- XX% live rolling with constraints

**Common Mistakes to Avoid:**
- [Mistake 1 with brief explanation]
- [Mistake 2 with brief explanation]
- [Mistake 3 with brief explanation]

**Expert Insight:**

[Expert name]'s perspective: "[Quote or paraphrased guidance specific to white belt development in this area]"

---

### Blue Belt (2-4 Years)

**Primary Focus:**
- [SPECIALIZATION AREA 1] (XX% of training time)
- [SPECIALIZATION AREA 2] (XX% of training time)
- [REFINEMENT AREA] (XX% of training time)

**Key Techniques to Master:**
- [[Link to Advanced Position 1]]
- [[Link to Advanced Position 2]]
- [[Link to Transition 2]]
- [[Link to Submission 1]]

**Success Rate Benchmarks:**
- [Primary technique type]: XX-XX%
- [Secondary technique type]: XX-XX%
- [Defensive skill]: XX-XX%

**Training Split:**
- XX% positional sparring
- XX% drilling specific sequences
- XX% live rolling with focus

**Development Priorities:**
- [Priority 1]: [Explanation]
- [Priority 2]: [Explanation]
- [Priority 3]: [Explanation]

**Common Mistakes to Avoid:**
- [Mistake 1 specific to blue belt level]
- [Mistake 2 specific to blue belt level]
- [Mistake 3 specific to blue belt level]

**Expert Insight:**

[Expert name]'s perspective: "[Quote or paraphrased guidance specific to blue belt development in this area]"

---

### Purple Belt (4-6 Years)

**Primary Focus:**
- [SYSTEM DEVELOPMENT] (XX% of training time)
- [COMPETITION PREPARATION] (XX% of training time)
- [TEACHING/REFINEMENT] (XX% of training time)

**Key Techniques to Master:**
- [[Link to System 1]]
- [[Link to Advanced Transition 1]]
- [[Link to Competition Strategy 1]]

**Success Rate Benchmarks:**
- [Primary technique type]: XX-XX%
- [Secondary technique type]: XX-XX%
- [Competitive performance]: XX-XX%

**Training Split:**
- XX% positional sparring
- XX% drilling competition scenarios
- XX% live rolling (near 100% intensity)

**Development Priorities:**
- [Priority 1]: [Explanation]
- [Priority 2]: [Explanation]
- [Priority 3]: [Explanation]

**Common Mistakes to Avoid:**
- [Mistake 1 specific to purple belt level]
- [Mistake 2 specific to purple belt level]
- [Mistake 3 specific to purple belt level]

**Expert Insight:**

[Expert name]'s perspective: "[Quote or paraphrased guidance specific to purple belt development in this area]"

---

### Brown/Black Belt (6+ Years)

**Primary Focus:**
- [SYSTEM MASTERY] (XX% of training time)
- [COMPETITION OPTIMIZATION] (XX% of training time)
- [INNOVATION/TEACHING] (XX% of training time)

**Key Techniques to Master:**
- [[Link to Advanced System 1]]
- [[Link to Competition Strategy 2]]
- [[Link to Innovation Area]]

**Success Rate Benchmarks:**
- [Primary technique type]: XX-XX%
- [Secondary technique type]: XX-XX%
- [Competitive performance]: XX-XX%

**Training Split:**
- XX% positional sparring
- XX% competition simulation
- XX% teaching and refinement

**Development Priorities:**
- [Priority 1]: [Explanation]
- [Priority 2]: [Explanation]
- [Priority 3]: [Explanation]

**Mastery Indicators:**
- [Indicator 1]: [Description]
- [Indicator 2]: [Description]
- [Indicator 3]: [Description]

**Expert Insight:**

[Expert name]'s perspective: "[Quote or paraphrased guidance specific to brown/black belt development in this area]"
```

### Fill-in Instructions

**[FUNDAMENTAL POSITION/TECHNIQUE]**: Replace with specific beginner-appropriate technique
- Example: "[[Closed Guard Bottom]] fundamentals"

**XX%**: Replace with realistic percentage allocation
- Example: "60% of training time"

**[Primary technique type]**: Replace with measurable skill
- Example: "Sweep success from guard"

**XX-XX%**: Replace with realistic success rate range
- Example: "35-45%"

**[Mistake 1]**: Replace with common error specific to this belt level
- Example: "Attempting advanced guards before mastering Closed Guard"

**[Expert name]**: Use Danaher, Gordon Ryan, or Eddie Bravo
- Rotate experts across belt levels for variety

**[Quote or paraphrased guidance]**: Insert relevant expert perspective
- 2-3 sentences
- Specific to belt level and topic

---

## 9. Expert Insights Integration

Expert insights should be **distributed throughout** the article, not isolated in a single section.

### Distribution Requirements

- **Minimum**: 3 expert insights total (1 per expert)
- **Typical**: 5-8 expert insights (distributed across major sections)
- **Maximum**: 12 expert insights (avoid oversaturation)

**Distribution by Section:**

| Section Type | Expert Insights | Purpose |
|-------------|----------------|---------|
| Introduction | 0-1 | Establish authority |
| Fundamentals | 1-2 | Frame core concepts |
| Category Sections | 1-2 each | Technical depth |
| Strategic Guidance | 1-2 | Decision-making frameworks |
| Learning Progression | 1-2 | Developmental context |
| Training Methodology | 1 | Practice guidance |

### Expert Rotation Strategy

**Ensure balanced representation:**

- John Danaher: 33% of insights
- Gordon Ryan: 33% of insights
- Eddie Bravo: 33% of insights

**If 6 total insights:**
- 2 from Danaher
- 2 from Gordon Ryan
- 2 from Eddie Bravo

**If 9 total insights:**
- 3 from Danaher
- 3 from Gordon Ryan
- 3 from Eddie Bravo

### Contextual Placement

**Integrated Within Narrative:**

```markdown
## Understanding Guard Retention

Guard retention is arguably the most important defensive skill in BJJ...

**John Danaher's Systematic Approach:**

Danaher emphasizes guard retention as the foundation of all guard work: "Before you can attack from guard, you must first be able to maintain it against pressure. The best guard players in the world aren't necessarily the most offensive—they're the ones who never let their guard get passed."

This systematic perspective suggests prioritizing retention over attacks in early development...
```

**NOT Separate Section:**

```markdown
<!-- WRONG - Don't do this -->

## Expert Insights

**John Danaher says:**
"Guard retention is important..."

**Gordon Ryan says:**
"I focus on retention..."

**Eddie Bravo says:**
"Retention matters..."
```

### Voice and Perspective Consistency

**John Danaher:**
- **Tone**: Systematic, theoretical, precise
- **Focus**: Biomechanics, principles, frameworks
- **Phrases**: "The underlying principle...", "Systematically speaking...", "The fundamental truth..."
- **Length**: 2-4 sentences (detailed explanations)

**Gordon Ryan:**
- **Tone**: Competitive, practical, results-oriented
- **Focus**: What works in competition, high-percentage techniques
- **Phrases**: "In competition...", "The highest percentage...", "What actually works..."
- **Length**: 2-3 sentences (direct and assertive)

**Eddie Bravo:**
- **Tone**: Innovative, creative, experimental
- **Focus**: Unorthodox approaches, system innovation
- **Phrases**: "The traditional approach is..., but we...", "What if you...", "People sleep on..."
- **Length**: 2-3 sentences (provocative and engaging)

### Example Expert Insights

**John Danaher (Systematic):**

> Danaher's systematic approach to guard development emphasizes building "position clusters" rather than isolated techniques: "The most effective guard players don't just know many guards—they know how to chain together 3-4 related guards that share common grips and control mechanisms. This creates a decision-making burden for your opponent, as defending one guard often sets up entries to another." This principle suggests organizing your guard game around grip families and control hierarchies rather than memorizing disconnected positions.

**Gordon Ryan (Competitive):**

> Gordon Ryan's competition-proven guard strategy prioritizes high-percentage positions over flashy techniques: "In high-level competition, I rely on guards that have proven success rates—primarily Ashi Garami and Butterfly Guard. These aren't the most exciting guards, but they consistently produce results against world-class opposition." His approach focuses on statistical effectiveness over stylistic preference, emphasizing guards with 50%+ success rates at the elite level.

**Eddie Bravo (Innovative):**

> Eddie Bravo's 10th Planet system challenges conventional guard development wisdom: "Most schools teach Closed Guard first, which makes sense for self-defense, but we start with Butterfly and Lockdown because they teach hip movement and leg control more effectively. Plus, they transition better to no-gi contexts where grip-based guards become less viable." This innovative approach prioritizes transferability across rulesets and long-term skill development over traditional progression.

### When to Quote vs Paraphrase

**Direct Quotes:**
- Use quotation marks
- Exact words from instructor (verified from public sources)
- Impactful, concise statements
- Example: Danaher says, "Guard retention is more important than guard attacks."

**Paraphrased:**
- No quotation marks
- Synthesis of instructor's philosophy
- Longer explanations or contextual integration
- Example: Danaher's systematic approach emphasizes guard retention as foundational...

**Guideline:**
- 30-40% direct quotes
- 60-70% paraphrased synthesis

---

## 10. SEO Requirements

Learning articles target **high-search-volume keywords** with comprehensive content optimization.

### Keyword Research Mandatory

**Before creating any Learning article:**

1. **Validate search volume**: Minimum 50 searches/month
2. **Document keyword data**: Include in planning notes
3. **Analyze competition**: Review top 10 results
4. **Identify secondary keywords**: Related terms for H2/H3 headers

**Keyword Research Tools:**
- Google Keyword Planner (free, requires Google Ads account)
- Ahrefs (paid, comprehensive)
- SEMrush (paid, comprehensive)
- Ubersuggest (freemium)
- AnswerThePublic (free, question-based keywords)

**Documentation Format:**

```markdown
<!-- Planning Notes (exclude from published content) -->

TARGET KEYWORD: "BJJ guard types"
SEARCH VOLUME: 1,300/month
KEYWORD DIFFICULTY: Medium (45/100)
COMPETITION: 8 articles ranking page 1, mostly general BJJ sites
SECONDARY KEYWORDS: "types of guards in bjj", "bjj open guard", "bjj closed guard", "guard variations"

TOP 10 CURRENT RANKINGS:
1. Domain.com - 2,500 words, no schema, weak internal linking
2. Domain2.com - 1,800 words, basic HowTo schema
...

CONTENT GAP OPPORTUNITIES:
- No articles include comprehensive comparison tables
- Missing learning progressions
- No success rate data
- Insufficient internal linking
```

### Minimum Search Volume Thresholds

| Priority | Minimum Searches/Month | Content Investment | Example Keywords |
|----------|----------------------|-------------------|------------------|
| **High** | 500+ | 6,000-7,000 words | "best BJJ submissions" (800/mo) |
| **Medium** | 200-499 | 4,500-5,500 words | "BJJ position hierarchy" (400/mo) |
| **Low** | 50-199 | 3,000-4,000 words | "understanding position flow" (100/mo) |
| **Skip** | < 50 | Don't create | "BJJ quantum guard theory" (10/mo) |

### Title Format Requirements

**Structure:** `[Exact Target Keyword] | [Specific Benefit with Number] | BJJ Graph`

**Optimization Rules:**

1. **Keyword placement**: First 20 characters
2. **Total length**: 50-70 characters (ideal for SERP display)
3. **Benefit specificity**: Include number or concrete outcome
4. **Brand inclusion**: Always end with "BJJ Graph"

**Examples:**

✅ **Good:**
```yaml
title: "BJJ Guard Types Explained | Master All 15+ Variations | BJJ Graph"
```
- Exact keyword match: "BJJ Guard Types"
- Specific number: "15+ Variations"
- Action verb: "Master"
- Length: 67 characters

✅ **Good:**
```yaml
title: "Best BJJ Submissions | Top 10 Ranked by Success Rate | BJJ Graph"
```
- Exact keyword match: "Best BJJ Submissions"
- Specific ranking: "Top 10"
- Data-driven: "by Success Rate"
- Length: 65 characters

❌ **Bad:**
```yaml
title: "Understanding Guards in Brazilian Jiu-Jitsu | BJJ Graph"
```
- Keyword mismatch: "Understanding Guards" vs target "BJJ guard types"
- No specific benefit
- No numbers
- Too generic

### Description Format Requirements

**Structure:** `[Hook with keyword in first 50 chars] [Specific data] [Content type: "complete guide"] [CTA]`

**Optimization Rules:**

1. **Length**: 150-160 characters (strict limit)
2. **Keyword placement**: First 50 characters
3. **Include numbers**: Success rates, counts, rankings
4. **Content type phrase**: "complete guide", "comprehensive overview", "definitive resource"
5. **Call to action**: "Learn", "Master", "Discover"

**Examples:**

✅ **Good:**
```yaml
description: "Master all 15+ BJJ guard types with this complete guide. Learn open guards, closed guards, half guards with success rates, body type recommendations, and progressions."
```
- Keyword at character 11: "BJJ guard types"
- Specific number: "15+"
- Content type: "complete guide"
- Data mentioned: "success rates", "body type recommendations"
- Length: 159 characters

✅ **Good:**
```yaml
description: "Discover the top 10 BJJ submissions ranked by success rate. Complete guide covers chokes, armbars, leg locks with competition data and setup requirements."
```
- Keyword at character 14: "BJJ submissions"
- Specific ranking: "top 10"
- Content type: "Complete guide"
- Data mentioned: "success rate", "competition data"
- Length: 149 characters

❌ **Bad:**
```yaml
description: "Learn about the different types of guards in Brazilian Jiu-Jitsu and how to use them effectively."
```
- Keyword too far from start (character 28)
- No specific numbers
- No data mentioned
- No content type phrase
- Too short (108 characters)

### Word Count Minimums by Keyword Competition

**Competition-Based Requirements:**

| Keyword Difficulty | Min Words | Target Words | Rationale |
|-------------------|-----------|--------------|-----------|
| **Low (0-29)** | 2,500 | 3,000-3,500 | Less competition, easier to rank |
| **Medium (30-49)** | 3,500 | 4,500-5,500 | Moderate competition, need depth |
| **High (50-69)** | 5,000 | 6,000-7,000 | Strong competition, need authority |
| **Very High (70+)** | 7,000+ | 8,000-10,000 | Elite competition, need dominance |

**Example Mapping:**

- "BJJ position hierarchy" (KD: 28) → 3,000 words minimum
- "BJJ guard types" (KD: 45) → 4,500 words minimum
- "best BJJ submissions" (KD: 58) → 6,000 words minimum

### Header Structure with Secondary Keywords

**H1**: Title (exact target keyword)

**H2 Headers**: Primary topic sections
- Include secondary keywords naturally
- 5-8 H2 sections typical
- Example: "Understanding [Primary Keyword] Fundamentals"

**H3 Headers**: Subsections
- Include long-tail variations
- 2-4 H3s per H2 section
- Example: "How to Choose Your [Primary Keyword]"

**Header Optimization Example:**

```markdown
# BJJ Guard Types Explained | Master All 15+ Variations | BJJ Graph

## Understanding Guard Fundamentals
### What Makes a Guard Effective?
### Guard Categories Overview

## Closed Guard System
### Traditional Closed Guard
### High Guard Variations

## Open Guard Variations
### Hook-Based Open Guards
### Grip-Based Open Guards

## Half Guard Family
### Standard Half Guard
### Knee Shield Half Guard

## Leg Entanglement Guards
### Ashi Garami System
### 50/50 Guard Dynamics

## Choosing Your Guard Based on Body Type
### Guards for Long Legs
### Guards for Short/Stocky Builds

## Learning Progression by Belt Level
### White Belt Guard Development
### Blue Belt Guard Specialization
```

**Secondary Keywords Integrated:**
- "guard fundamentals" (H2)
- "closed guard system" (H2)
- "open guard variations" (H2)
- "half guard family" (H2)
- "leg entanglement guards" (H2)
- "choosing your guard" (H2)
- "body type" (H2)
- "belt level" (H2)

### Featured Snippet Optimization

**Target Featured Snippet Types:**

1. **Paragraph Snippets**: 40-60 word direct answers
2. **List Snippets**: Numbered or bulleted lists (3-8 items)
3. **Table Snippets**: Comparison or data tables
4. **Video Snippets**: (future - when video content added)

**Paragraph Snippet Strategy:**

```markdown
## What are the main types of BJJ guards?

The main BJJ guard types include **Closed Guard** (legs locked around opponent), **Open Guard** (various grips without leg lock), **Half Guard** (one leg trapped), and **Leg Entanglement Guards** (controlling opponent's legs). Each category contains 5-10 specific variations with unique offensive and defensive characteristics.
```

**List Snippet Strategy:**

```markdown
## What are the best BJJ guards for beginners?

1. **[[Closed Guard Bottom]]** - Foundation for all guard work (40% success rate)
2. **[[Half Guard Bottom]]** - Defensive security with offensive options (35% success rate)
3. **[[Butterfly Guard]]** - Dynamic sweeping system (30% success rate)
4. **[[Open Guard Bottom]]** - Distance management fundamentals (25% success rate)
```

**Table Snippet Strategy:**

```markdown
## Which BJJ guard has the highest success rate?

| Guard Type | Competition Success Rate | Best For |
|-----------|------------------------|----------|
| De La Riva Guard | 65% | Advanced practitioners, gi competition |
| Butterfly Guard | 60% | All levels, both gi and no-gi |
| Closed Guard | 55% | Beginners to advanced, all rulesets |
```

### FAQ Optimization for "People Also Ask"

**Research PAA Questions:**

1. Google target keyword
2. Review "People Also Ask" boxes
3. Document 8-12 common questions
4. Prioritize questions matching user intent

**Example PAA Research:**

**Keyword:** "BJJ guard types"

**PAA Questions Found:**
1. What are the different types of guards in BJJ?
2. Which BJJ guard is best for beginners?
3. How many guards are there in BJJ?
4. What is the most effective BJJ guard?
5. Are leg locks legal in BJJ?
6. What is the difference between open and closed guard?
7. How long does it take to learn BJJ guards?
8. Which guard does Gordon Ryan use?

**Use 6-8 of these in FAQPage schema.**

### Internal Linking for Topic Clusters

**Cluster Architecture:**

```
Learning Hub Article (15-125 links)
├── Position Cluster (40-60% of links)
│   ├── Primary positions
│   ├── Related variations
│   └── Defensive positions
├── Transition Cluster (20-30% of links)
│   ├── Entry techniques
│   ├── Sweep techniques
│   └── Pass techniques
├── Submission Cluster (10-20% of links)
│   ├── Primary submissions
│   └── Setup positions
├── Concept Cluster (5-10% of links)
│   ├── Principles
│   └── Frameworks
└── Related Learning Articles (3-5% of links)
    ├── Complementary topics
    └── Prerequisite concepts
```

**SEO Benefits:**

1. **Distributes Page Authority**: Links pass equity to technical pages
2. **Improves Crawlability**: Spider can discover all related content
3. **Signals Topic Expertise**: Comprehensive internal linking shows depth
4. **Increases Dwell Time**: Users explore multiple pages
5. **Reduces Bounce Rate**: Clear navigation paths

**Link Placement Strategy:**

- **Early links** (first 300 words): 3-5 high-priority links
- **Throughout content**: Natural contextual linking
- **Related Resources section**: Concentrated link cluster (15-50 links)
- **Avoid link stuffing**: Maximum 1 link per 40 words

---

## 11. FAQ Schema Best Practices

FAQ schema optimization updated based on research showing **6-8 questions with detailed answers** perform best.

### Question Count Requirements

**Updated Requirements:**

- **Minimum**: 6 questions (updated from 3-4)
- **Optimal**: 6-8 questions
- **Maximum**: 10 questions

**Rationale:** Research shows:
- 3-4 questions: Insufficient to capture PAA visibility
- 6-8 questions: Optimal balance of comprehensiveness and focus
- 10+ questions: Diminishing returns, schema bloat

### Answer Length Requirements

**Updated Requirements:**

- **Minimum**: 2 sentences (updated from 1)
- **Optimal**: 2-3 sentences (40-60 words)
- **Maximum**: 4 sentences (80 words)

**Rationale:**
- 1 sentence: Too brief, lacks helpful detail
- 2-3 sentences: Provides specific, actionable answer
- 4+ sentences: Too long for featured snippets

### Question Types Table

| Question Type | Example | Answer Style | Data to Include |
|--------------|---------|-------------|-----------------|
| **What is** | "What are the main types of BJJ guards?" | Definition + categories | Number of types, key characteristics |
| **How do** | "How do I choose a BJJ guard?" | Process + criteria | 3-4 decision factors, examples |
| **When should** | "When should I use Closed Guard?" | Situational guidance | Specific scenarios, opponent types |
| **Which is best** | "Which BJJ guard is best for beginners?" | Recommendation + data | Success rates, reasoning |
| **Are X safe/legal** | "Are leg entanglement guards legal?" | Rules + context | Specific restrictions, belt levels |
| **How long** | "How long does it take to master a guard?" | Timeline + variables | Time ranges by skill level |
| **What's the difference** | "What's the difference between X and Y?" | Comparison + contrast | Key distinctions, use cases |

### Answer Format Requirements Table

| Requirement | Good Example | Bad Example | Why |
|------------|-------------|------------|-----|
| **Specific data** | "Success rate: 55-65% at advanced level" | "Pretty effective" | Quantifiable metrics |
| **Actionable** | "Start with Closed Guard for 3-6 months" | "Learn some guards first" | Clear next steps |
| **Examples** | "Guards for long legs: Spider, Lasso, DLR" | "Certain guards work better" | Concrete instances |
| **Timeframes** | "6-12 months for basic proficiency" | "Takes a while" | Realistic expectations |
| **Belt levels** | "Legal at brown belt under IBJJF rules" | "Check your ruleset" | Specific restrictions |

### Research PAA Boxes Process

**Step-by-Step:**

1. **Google Target Keyword**
   - Use incognito/private browsing
   - Note first PAA box (usually 4 questions)

2. **Expand PAA Questions**
   - Click each question to reveal 4 more
   - Document 8-12 related questions

3. **Analyze Related Searches**
   - Scroll to bottom of SERP
   - Note "People also search for" terms

4. **Competitor Analysis**
   - Check top 3 ranking articles
   - Identify FAQ sections they include

5. **Synthesize Question List**
   - Combine PAA + Related Searches + Competitor FAQs
   - Prioritize 6-8 most relevant to target keyword

**Example PAA Research for "BJJ guard types":**

**PAA Box Questions:**
1. What are the different types of guards in BJJ?
2. Which BJJ guard is best for beginners?
3. How many guards are there in BJJ?
4. What is the most effective BJJ guard?

**Expanded Questions (clicked each above):**
5. Are leg entanglement guards legal in BJJ?
6. What's the difference between open and closed guard?
7. How long does it take to learn BJJ guards?
8. Which guard does Gordon Ryan use?
9. What is De La Riva guard?
10. Is Spider Guard effective?

**Related Searches:**
- "bjj guard types explained"
- "types of guards in bjj for beginners"
- "best bjj guard for competition"
- "no-gi guard types"

**Final Selection (6 questions):**
1. What are the main types of BJJ guards? (definition)
2. Which BJJ guard is best for beginners? (recommendation)
3. How long does it take to master a BJJ guard? (timeline)
4. What is the most effective BJJ guard? (effectiveness)
5. Are leg entanglement guards legal in BJJ? (legality)
6. What's the difference between open and closed guard? (comparison)

### Examples of Good vs Bad FAQ Entries

**Good FAQ Entry:**

```json
{
  "@type": "Question",
  "name": "Which BJJ guard is best for beginners?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Closed Guard is universally recommended for beginners due to its defensive security and clear attack structure. Success rates for beginners: sweeps 40-45%, submissions 25-30%. Beginners should spend 3-6 months developing Closed Guard fundamentals before exploring open guard variations."
  }
}
```

**Why it's good:**
- Specific answer: "Closed Guard"
- Quantifiable data: "40-45%", "25-30%"
- Actionable timeline: "3-6 months"
- Clear reasoning: "defensive security and clear attack structure"
- Length: 3 sentences, 48 words (optimal)

**Bad FAQ Entry:**

```json
{
  "@type": "Question",
  "name": "What is the best guard?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "It depends."
  }
}
```

**Why it's bad:**
- Vague question: "best guard" (missing context: for beginners? for competition?)
- No useful answer: "It depends" provides zero value
- No data or specifics
- Too short: 1 sentence, 2 words

**Good FAQ Entry:**

```json
{
  "@type": "Question",
  "name": "Are leg entanglement guards legal in BJJ?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Leg entanglement guard legality varies by ruleset and belt level. IBJJF allows basic Ashi Garami at blue belt but restricts reaping until brown belt. Submission-only and ADCC rulesets permit most leg entanglements at all levels. Always verify specific rules for your competition."
  }
}
```

**Why it's good:**
- Acknowledges variability: "varies by ruleset"
- Specific examples: "IBJJF allows basic Ashi Garami at blue belt"
- Multiple rulesets covered: "IBJJF", "ADCC", "submission-only"
- Actionable advice: "Always verify specific rules"
- Length: 4 sentences, 52 words (optimal)

**Bad FAQ Entry:**

```json
{
  "@type": "Question",
  "name": "Can I do leg locks?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Check with your instructor about the rules for leg locks in your gym and competition. Different organizations have different restrictions, and you should always be aware of what is allowed. Safety is important when training leg locks because they can cause injuries if applied incorrectly. Make sure you learn proper technique and always tap early when caught in a leg lock."
  }
}
```

**Why it's bad:**
- Question too informal: "Can I do leg locks?" (vs "Are leg locks legal?")
- Answer too long: 5 sentences, 68 words (exceeds optimal)
- Lacks specifics: No mention of belt levels, specific rulesets
- Too general: "Check with your instructor" doesn't answer the question
- Off-topic content: Safety information not directly answering legality question

---

## 12. ItemList Schema Guidelines

ItemList schema provides **structured list data** for rich snippets displaying rankings, categories, or progressions.

### When to Use ItemList

**Use ItemList for:**

1. **Rankings/Top 10 Lists**
   - "Top 10 BJJ Submissions"
   - "Best Guards for Competition"
   - "Most Effective Escapes"

2. **Categorical Lists**
   - "All BJJ Guard Types"
   - "Complete List of Chokes"
   - "Essential White Belt Positions"

3. **Ordered Progressions**
   - "Belt-Level Skill Progression"
   - "Guard Development Timeline"
   - "Submission Learning Path"

4. **Comparison Lists**
   - "Gi vs No-Gi Guards Comparison"
   - "Offensive vs Defensive Positions"

**Do NOT Use ItemList for:**

- Unordered concept discussions (use regular content)
- Narrative explanations without list structure
- Single-item focus articles (no list present)
- Procedural steps (use HowTo schema instead)

### Structure Requirements

**Minimum Requirements:**

- **Minimum items**: 5
- **Typical items**: 10-20
- **Maximum items**: 50 (consider splitting if more)
- **Item description**: 1-2 sentences with specific data
- **Item URL**: Link to related technical page or section anchor
- **Order meaning**: Logical ordering (rank, category, progression)

**ItemList Schema Template:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "[Descriptive List Title]",
  "description": "[1-2 sentence description of what this list represents]",
  "numberOfItems": [INTEGER],
  "itemListOrder": "https://schema.org/ItemListOrderAscending",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "[Item Name]",
      "url": "[Full URL to related page or section]",
      "description": "[1-2 sentence description with specific data]"
    }
  ]
}
</script>
```

### SEO Value Explanation

**Rich Snippet Benefits:**

1. **Visual Prominence**: List snippets take up more SERP space
2. **Higher CTR**: 15-25% improvement vs standard snippets
3. **Featured Position**: Can appear above standard results
4. **Mobile Optimization**: Lists display well on mobile devices
5. **Voice Search**: Structured data improves voice assistant responses

**Example SERP Display:**

```
Top 10 BJJ Submissions | Ranked by Success Rate | BJJ Graph
https://bjjgraph.com/learning/best-bjj-submissions

1. Rear Naked Choke - 68% success rate in competition
2. Triangle Choke - 55% success rate from guard
3. Armbar - 52% success rate from multiple positions
...
```

**Competition Advantage:**

Most BJJ content sites **do not use ItemList schema**, creating opportunity for visibility advantage:
- Current ranking pages: Basic article format
- No structured data: Missing rich snippet opportunity
- Weak internal linking: Limited context for Google

Learning articles with ItemList schema can **outrank higher domain authority sites** through structured data advantage.

### Examples

#### Example 1: Top 10 Rankings

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Top 10 BJJ Submissions by Competition Success Rate",
  "description": "Ranking of most effective BJJ submissions based on competition data from IBJJF and ADCC tournaments.",
  "numberOfItems": 10,
  "itemListOrder": "https://schema.org/ItemListOrderDescending",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Rear Naked Choke",
      "url": "https://bjjgraph.com/submissions/rear-naked-choke",
      "description": "Highest success rate submission at 68% in elite competition. Average finish time: 2:45. Legal at all belt levels."
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Triangle Choke",
      "url": "https://bjjgraph.com/submissions/triangle-choke",
      "description": "55% success rate from guard positions. Average finish time: 3:30. Most common from Closed Guard Bottom."
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Armbar",
      "url": "https://bjjgraph.com/submissions/armbar",
      "description": "52% success rate from multiple positions. Average finish time: 2:15. Versatile submission from mount, guard, and side control."
    }
  ]
}
</script>
```

**Key Features:**
- `itemListOrder`: Descending (highest to lowest)
- `numberOfItems`: Exactly 10
- Each `description`: Includes success rate, timing, context
- Each `url`: Links to submission page

#### Example 2: Categorical List

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Complete List of BJJ Guard Types",
  "description": "Comprehensive categorical list of all major BJJ guard variations organized by control mechanism.",
  "numberOfItems": 18,
  "itemListOrder": "https://schema.org/ItemListUnordered",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Closed Guard",
      "url": "https://bjjgraph.com/positions/closed-guard-bottom",
      "description": "Fundamental guard with legs locked around opponent's torso. Beginner success rate: 40%, Advanced: 70%."
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Open Guard",
      "url": "https://bjjgraph.com/positions/open-guard-bottom",
      "description": "Guard category with various grips and no leg lock. Beginner success rate: 25%, Advanced: 60%."
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "De La Riva Guard",
      "url": "https://bjjgraph.com/positions/de-la-riva-guard",
      "description": "Hook-based open guard controlling one leg. Competition sweep rate: 55-65% at advanced level."
    }
  ]
}
</script>
```

**Key Features:**
- `itemListOrder`: Unordered (categorical grouping)
- `numberOfItems`: 18 (comprehensive coverage)
- Each `description`: Success rates by skill level
- Organized by category (could add additional structure)

#### Example 3: Ordered Progression

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "BJJ Guard Learning Progression by Belt Level",
  "description": "Recommended guard development timeline from white belt to black belt with skill benchmarks.",
  "numberOfItems": 4,
  "itemListOrder": "https://schema.org/ItemListOrderAscending",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "White Belt (0-2 Years): Closed Guard Fundamentals",
      "url": "https://bjjgraph.com/learning/bjj-guard-types-explained#white-belt",
      "description": "Focus 60% on Closed Guard development. Success benchmarks: 35-45% sweep rate, 20-30% submission rate, 40-50% pass defense."
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blue Belt (2-4 Years): Open Guard Specialization",
      "url": "https://bjjgraph.com/learning/bjj-guard-types-explained#blue-belt",
      "description": "Develop 2-3 specialized open guards. Success benchmarks: 45-55% sweep rate, 30-40% submission rate, 55-65% pass defense."
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Purple Belt (4-6 Years): Guard System Development",
      "url": "https://bjjgraph.com/learning/bjj-guard-types-explained#purple-belt",
      "description": "Build coherent guard clusters. Success benchmarks: 55-65% sweep rate, 40-50% submission rate, 65-75% pass defense."
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Brown/Black Belt (6+ Years): System Mastery",
      "url": "https://bjjgraph.com/learning/bjj-guard-types-explained#brown-black-belt",
      "description": "Refine competition game plans. Success benchmarks: 65-75% sweep rate, 50-60% submission rate, 75-85% pass defense."
    }
  ]
}
</script>
```

**Key Features:**
- `itemListOrder`: Ascending (progression over time)
- `numberOfItems`: 4 (belt level stages)
- Each `description`: Specific success rate benchmarks
- URLs anchor to sections within article

### Position Numbering (1-indexed)

**Critical:** ItemList position numbering is **1-indexed** (starts at 1, not 0).

```json
"itemListElement": [
  {
    "@type": "ListItem",
    "position": 1,  // NOT 0
    "name": "First Item"
  },
  {
    "@type": "ListItem",
    "position": 2,  // NOT 1
    "name": "Second Item"
  }
]
```

**Why it matters:**
- Schema.org specification requires 1-indexed
- Google Rich Results Test will flag 0-indexed as error
- Featured snippets display incorrect numbering if 0-indexed

---

## 13. Content Examples

Reference existing Learning articles as **templates and examples** for new content.

### Comprehensive Guide with ItemList: BJJ-Guard-Types-Explained.md

**Location:** `/source/content/Learning/BJJ-Guard-Types-Explained.md`

**Characteristics:**
- **Word count**: 6,847 words
- **Internal links**: 125 links (highest density)
- **Schema types**: 5 (WebPage, Breadcrumb, HowTo, FAQ, ItemList)
- **Tables**: 8 comparison tables
- **Expert insights**: 9 (distributed throughout)
- **Learning progression**: Full white→black belt timeline

**What to Learn:**
- How to structure comprehensive categorical overview
- ItemList schema implementation for guard types
- Extensive internal linking strategy (every guard + transitions)
- Multiple comparison tables with success rates
- Belt-level learning progressions
- Distributed expert insights (not single section)

**URL:** `https://bjjgraph.com/learning/bjj-guard-types-explained`

**Excerpt - ItemList Schema:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Complete List of BJJ Guard Types",
  "numberOfItems": 18,
  "itemListElement": [...]
}
</script>
```

### Rankings with Charts: BJJ-Submissions-Chart-Guide.md

**Location:** `/source/content/Learning/BJJ-Submissions-Chart-Guide.md`

**Characteristics:**
- **Word count**: 5,234 words
- **Internal links**: 89 links
- **Schema types**: 5 (including ItemList for Top 10)
- **Tables**: 6 ranking and comparison tables
- **Statistical data**: Competition success rates
- **Rankings**: Top 10 submissions by effectiveness

**What to Learn:**
- How to structure ranking-based content
- ItemList schema for Top 10 lists
- Statistical comparison tables
- Competition data integration
- Success rate methodology explanation

**URL:** `https://bjjgraph.com/learning/bjj-submissions-chart-guide`

**Excerpt - Ranking Table:**

```markdown
| Rank | Submission | Competition Success | Setup Position | Difficulty |
|------|-----------|-------------------|---------------|-----------|
| 1 | Rear Naked Choke | 68% | Back Control | Medium |
| 2 | Triangle Choke | 55% | Closed Guard | High |
```

### Educational Concept (Low Competition): BJJ-Position-Hierarchy-Explained.md

**Location:** `/source/content/Learning/BJJ-Position-Hierarchy-Explained.md`

**Characteristics:**
- **Word count**: 4,123 words
- **Internal links**: 45 links
- **Schema types**: 4 (no ItemList - conceptual article)
- **Tables**: 5 comparison tables
- **Keyword difficulty**: Low (28/100)
- **Focus**: Explaining hierarchy concept

**What to Learn:**
- How to structure conceptual explanation article
- When NOT to use ItemList schema
- Hierarchy visualization with tables
- Point system explanation
- Escape priority frameworks

**URL:** `https://bjjgraph.com/learning/bjj-position-hierarchy-explained`

**Excerpt - Hierarchy Table:**

```markdown
| Hierarchy Level | Position | Point Value | Escape Priority |
|----------------|----------|------------|----------------|
| 1 - Submission | Any submission position | N/A - Finish | Immediate tap |
| 2 - Dominant Control | Mount, Back Control | 4 points | Highest priority |
| 3 - Advantage | Side Control, Knee on Belly | 0-2 points | High priority |
```

### State Machine Explanation: Understanding-Position-Flow.md

**Location:** `/source/content/Learning/Understanding-Position-Flow.md`

**Characteristics:**
- **Word count**: 3,789 words
- **Internal links**: 32 links
- **Schema types**: 4 (no ItemList)
- **Tables**: 4 decision tables
- **Focus**: State machine concept WITHOUT technical jargon
- **Audience**: Beginners understanding position transitions

**What to Learn:**
- How to explain technical concepts accessibly
- State machine visualization without jargon
- Decision tree tables
- Position flow diagrams (text-based)
- Entry/exit transition frameworks

**URL:** `https://bjjgraph.com/learning/understanding-position-flow`

**Excerpt - Flow Table:**

```markdown
| Current Position | Available Transitions | Success Rate | Risk Level |
|-----------------|---------------------|-------------|-----------|
| Closed Guard Bottom | Hip Bump Sweep → Mount | 45% | Medium |
| Closed Guard Bottom | Armbar from Guard | 35% | Low |
| Closed Guard Bottom | Triangle Choke | 30% | Medium |
```

### Comparison of Example Articles

| Article | Words | Links | Schema | Tables | Keyword Difficulty | Focus |
|---------|-------|-------|--------|--------|-------------------|-------|
| BJJ-Guard-Types-Explained | 6,847 | 125 | 5 (ItemList) | 8 | Medium (45) | Comprehensive categorical |
| BJJ-Submissions-Chart-Guide | 5,234 | 89 | 5 (ItemList) | 6 | High (58) | Rankings and statistics |
| BJJ-Position-Hierarchy-Explained | 4,123 | 45 | 4 | 5 | Low (28) | Conceptual explanation |
| Understanding-Position-Flow | 3,789 | 32 | 4 | 4 | Very Low (15) | State machine concept |

**Key Takeaway:** Article length, link density, and schema complexity scale with keyword competition and content scope.

---

## 14. Validation Checklist

Use this checklist **before publishing** any Learning article.

### Pre-Publication Validation

**Keyword Research:**
- [ ] Target keyword identified and documented
- [ ] Search volume verified (minimum 50/month)
- [ ] Keyword difficulty assessed
- [ ] Secondary keywords identified (5-8)
- [ ] Competition analyzed (top 10 articles reviewed)
- [ ] Content gap opportunities documented

**Word Count:**
- [ ] Minimum word count met for keyword difficulty
- [ ] Low competition (0-29): 2,500+ words
- [ ] Medium competition (30-49): 3,500+ words
- [ ] High competition (50-69): 5,000+ words
- [ ] Very high competition (70+): 7,000+ words

**Schema Markup:**
- [ ] WebPage schema present and validated
- [ ] BreadcrumbList schema with "Learning" category
- [ ] HowTo schema (educational steps, NOT technical)
- [ ] FAQPage schema (6-8 questions minimum)
- [ ] ItemList schema (if ranking/categorical list)
- [ ] All schema validated with Google Rich Results Test

**YAML Frontmatter:**
- [ ] Title follows format: `[Keyword] | [Benefit with Number] | BJJ Graph`
- [ ] Title length: 50-70 characters
- [ ] Description length: 150-160 characters
- [ ] Description includes keyword in first 50 characters
- [ ] Description includes specific numbers/data
- [ ] Description includes "complete guide" or similar phrase
- [ ] Tags: Minimum 4 tags (Learning, skill level, topic, secondary)

**Internal Linking:**
- [ ] Minimum internal links met (15+ links)
- [ ] Typical range achieved (30-50 links)
- [ ] Links distributed throughout article
- [ ] Related Resources section with 15+ clustered links
- [ ] All wikilinks resolve to actual pages
- [ ] No broken internal links

**Table Requirements:**
- [ ] Minimum 3 comparison tables present
- [ ] Success rate tables include all skill levels
- [ ] Learning progression table present
- [ ] Tables properly formatted in markdown
- [ ] Column alignment appropriate (left/center/right)

**FAQ Quality:**
- [ ] 6-8 FAQ questions minimum (updated from 3-4)
- [ ] All answers are 2-3 sentences (updated from 1)
- [ ] Questions match "People Also Ask" research
- [ ] Answers include specific data/numbers
- [ ] Answers are actionable, not generic

**Learning Progression:**
- [ ] White Belt section present (0-2 years)
- [ ] Blue Belt section present (2-4 years)
- [ ] Purple Belt section present (4-6 years)
- [ ] Brown/Black Belt section present (6+ years)
- [ ] Each section includes: focus, benchmarks, training split, common mistakes
- [ ] Success rate benchmarks realistic and properly ordered

**Expert Insights:**
- [ ] All 3 experts included (Danaher, Gordon Ryan, Eddie Bravo)
- [ ] Expert insights distributed throughout (NOT single section)
- [ ] Minimum 3 expert insights total (1 per expert)
- [ ] Typical 5-8 expert insights present
- [ ] Expert perspectives distinct and appropriate to voice

**SEO Elements:**
- [ ] H1 header matches title exactly
- [ ] H2 headers include secondary keywords
- [ ] H3 headers include long-tail variations
- [ ] Featured snippet opportunities identified
- [ ] List snippets formatted properly
- [ ] Table snippets optimized for display
- [ ] Meta description optimized for CTR

**Content Structure:**
- [ ] Introduction present (200-300 words with hook)
- [ ] Quick Navigation/TOC present (if over 3,000 words)
- [ ] Major sections: 5-8 sections of 300-800 words each
- [ ] Strategic Guidance section present
- [ ] Training Methodology section present
- [ ] Related Resources section present (with clustered links)
- [ ] Conclusion with actionable next steps (100-200 words)

**Technical Quality:**
- [ ] No spelling errors
- [ ] No grammatical errors
- [ ] Consistent terminology throughout
- [ ] All statistics cited or reasonable
- [ ] No broken external links
- [ ] Markdown formatting correct
- [ ] Schema JSON valid (no syntax errors)

### Post-Publication Validation

**Search Console:**
- [ ] Sitemap submitted and indexed
- [ ] Rich results detected (check 7-14 days post-publication)
- [ ] No schema errors reported
- [ ] Mobile usability passed
- [ ] Core Web Vitals passed

**Rich Results Test:**
- [ ] Page URL tested in Google Rich Results Test
- [ ] All 4-5 schema types detected
- [ ] No errors in schema markup
- [ ] No warnings in schema markup
- [ ] Preview displays correctly

**Manual SERP Check:**
- [ ] Page indexed in Google (site:bjjgraph.com "page title")
- [ ] Meta title displays correctly
- [ ] Meta description displays correctly
- [ ] Featured snippet captured (check 30-90 days)

**Analytics Tracking:**
- [ ] Page views tracked
- [ ] Bounce rate monitored
- [ ] Average time on page tracked
- [ ] Conversion events set up (if applicable)

---

## 15. Common Mistakes

Avoid these frequent errors when creating Learning articles.

### Content Creation Mistakes

**1. Creating Learning Article Without Keyword Research**

❌ **Mistake:**
```yaml
title: "Advanced Guard Strategies | BJJ Graph"
description: "Learn advanced guard strategies."
```

**Problem:**
- No keyword validation
- "Advanced guard strategies" has < 10 searches/month
- Generic title and description
- Wasted content investment

✅ **Correct:**
```yaml
title: "BJJ Guard Types Explained | Master All 15+ Variations | BJJ Graph"
description: "Master all 15+ BJJ guard types with this complete guide. Learn open guards, closed guards, half guards with success rates and progressions."
```

**Fix:** Always research keywords FIRST, document search volume, then create content.

---

**2. Too Short Word Count**

❌ **Mistake:**
```markdown
# BJJ Guard Types

There are many types of guards in BJJ. Some are closed guards and some are open guards.
Each has different characteristics...

[Total: 1,800 words]
```

**Problem:**
- Target keyword "BJJ guard types" has medium competition (KD: 45)
- Requires 3,500+ words minimum
- 1,800 words insufficient to rank
- Lacks comprehensive coverage

✅ **Correct:**
```markdown
# BJJ Guard Types Explained | Master All 15+ Variations | BJJ Graph

[Comprehensive 6,847-word article with detailed sections, tables, progressions]
```

**Fix:** Match word count to keyword difficulty (see Section 10).

---

**3. Insufficient Internal Linking**

❌ **Mistake:**
```markdown
# BJJ Guard Types

Guards are important in BJJ. The main types include closed guard, open guard, and half guard.

[Total article: 12 internal links]
```

**Problem:**
- Minimum requirement: 15 links
- Typical requirement: 30-50 links
- Misses content clustering opportunity
- Weak SEO signals

✅ **Correct:**
```markdown
# BJJ Guard Types Explained

The main guard categories include [[Closed Guard Bottom]], [[Open Guard Bottom]], and [[Half Guard Bottom]]...

## Related Resources

### Essential Guard Positions
- [[Closed Guard Bottom]]
- [[De La Riva Guard]]
- [[Butterfly Guard]]
[... 20+ more links in this section]

[Total article: 125 internal links]
```

**Fix:** Create comprehensive Related Resources section with 15+ clustered links.

---

**4. Only 3-4 FAQ Questions (Outdated Standard)**

❌ **Mistake:**
```html
<script type="application/ld+json">
{
  "@type": "FAQPage",
  "mainEntity": [
    {"@type": "Question", "name": "What is a guard?", ...},
    {"@type": "Question", "name": "Which guard is best?", ...},
    {"@type": "Question", "name": "How do I learn guards?", ...}
  ]
}
</script>
```

**Problem:**
- Only 3 questions (updated standard requires 6-8)
- Insufficient PAA coverage
- Misses featured snippet opportunities

✅ **Correct:**
```html
<script type="application/ld+json">
{
  "@type": "FAQPage",
  "mainEntity": [
    {"@type": "Question", "name": "What are the main types of BJJ guards?", ...},
    {"@type": "Question", "name": "Which BJJ guard is best for beginners?", ...},
    {"@type": "Question", "name": "How long does it take to master a guard?", ...},
    {"@type": "Question", "name": "What is the most effective BJJ guard?", ...},
    {"@type": "Question", "name": "Are leg entanglement guards legal?", ...},
    {"@type": "Question", "name": "What's the difference between open and closed guard?", ...},
    {"@type": "Question", "name": "How do I choose which guard to learn?", ...},
    {"@type": "Question", "name": "Should I learn gi or no-gi guards first?", ...}
  ]
}
</script>
```

**Fix:** Research PAA boxes and include 6-8 questions minimum.

---

**5. One-Sentence FAQ Answers (Outdated Standard)**

❌ **Mistake:**
```json
{
  "@type": "Question",
  "name": "Which BJJ guard is best for beginners?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Closed Guard is best for beginners."
  }
}
```

**Problem:**
- Only 1 sentence (updated standard requires 2-3)
- No specific data
- Not actionable
- Lacks context

✅ **Correct:**
```json
{
  "@type": "Question",
  "name": "Which BJJ guard is best for beginners?",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "Closed Guard is universally recommended for beginners due to its defensive security and clear attack structure. Success rates for beginners: sweeps 40-45%, submissions 25-30%. Beginners should spend 3-6 months developing Closed Guard fundamentals before exploring open guard variations."
  }
}
```

**Fix:** Write 2-3 sentence answers with specific data and timelines.

---

**6. Missing ItemList for Rankings**

❌ **Mistake:**
```markdown
# Top 10 BJJ Submissions

Here are the best submissions:

1. Rear Naked Choke
2. Triangle Choke
3. Armbar
[... no ItemList schema]
```

**Problem:**
- Content is clearly a ranking list
- Missing ItemList schema
- No rich snippet opportunity
- Competitor disadvantage

✅ **Correct:**
```markdown
# Top 10 BJJ Submissions

[Content with ranking]

<script type="application/ld+json">
{
  "@type": "ItemList",
  "name": "Top 10 BJJ Submissions by Success Rate",
  "numberOfItems": 10,
  "itemListElement": [...]
}
</script>
```

**Fix:** Add ItemList schema for any ranking, categorical list, or ordered progression.

---

**7. Expert Insights in Single Section**

❌ **Mistake:**
```markdown
# BJJ Guard Types

[Content sections without expert insights]

## Expert Insights

**John Danaher says:**
"Guards are important..."

**Gordon Ryan says:**
"I use guards a lot..."

**Eddie Bravo says:**
"Guards are cool..."
```

**Problem:**
- All expert insights isolated in one section
- Not integrated with technical content
- Feels tacked-on, not synthesized
- Poor reading experience

✅ **Correct:**
```markdown
## Understanding Guard Fundamentals

Guards provide offensive platform from bottom position...

**John Danaher's Systematic Approach:**

Danaher emphasizes guard retention as foundational: "Before attacking from guard, you must first maintain it against pressure..."

[Expert insights distributed throughout article in relevant sections]
```

**Fix:** Distribute expert insights contextually throughout article sections.

---

**8. No Comparison Tables**

❌ **Mistake:**
```markdown
# BJJ Guard Types

Closed Guard has high control and medium mobility. De La Riva has high mobility and medium control.
Butterfly Guard has medium control and high mobility...

[No tables, just paragraph descriptions]
```

**Problem:**
- Difficult to compare characteristics
- No visual organization
- Misses table snippet opportunity
- Poor scannability

✅ **Correct:**
```markdown
# BJJ Guard Types

| Guard Type | Control Level | Mobility | Sweep Potential | Best For |
|-----------|--------------|----------|----------------|----------|
| Closed Guard | Very High | Low | High | All levels |
| De La Riva | High | Very High | Very High | Advanced |
| Butterfly | Medium | Very High | Very High | All levels |
```

**Fix:** Create 3-8 comparison tables with clear data columns.

---

**9. Missing Learning Progressions**

❌ **Mistake:**
```markdown
# BJJ Guard Types

[Comprehensive content about guard types]

[No belt-level progression section]
```

**Problem:**
- Readers don't know where to start
- No clear learning pathway
- Missing educational value
- Incomplete guide

✅ **Correct:**
```markdown
# BJJ Guard Types

[Content sections]

## Learning Progression by Belt Level

### White Belt (0-2 Years)
**Primary Focus:**
- Closed Guard fundamentals (60% of training)
[Detailed progression with benchmarks]

### Blue Belt (2-4 Years)
[Detailed progression]

### Purple Belt (4-6 Years)
[Detailed progression]

### Brown/Black Belt (6+ Years)
[Detailed progression]
```

**Fix:** Include complete belt-level learning progression (white → black).

---

**10. Generic Meta Description**

❌ **Mistake:**
```yaml
description: "Learn about the different types of BJJ guards and how to use them effectively in your training."
```

**Problem:**
- Generic language ("Learn about")
- No specific numbers
- Missing "complete guide" phrase
- Only 103 characters (too short)
- Keyword not in first 50 characters

✅ **Correct:**
```yaml
description: "Master all 15+ BJJ guard types with this complete guide. Learn open guards, closed guards, half guards with success rates, body type recommendations, and progressions."
```

**Fix:** Follow description template: keyword (first 50 chars) + numbers + "complete guide" + data points (150-160 total chars).

---

## Summary

Learning articles represent BJJ Graph's **educational hub content** designed to:

1. **Target high-volume keywords** (50+ monthly searches) with comprehensive coverage
2. **Cluster related technical pages** through extensive internal linking (15-125 links)
3. **Provide narrative explanations** beyond state machine documentation
4. **Optimize for featured snippets** with 5 concurrent schema types
5. **Guide progressive learning** with belt-level timelines and benchmarks

**Key Success Factors:**

- **Keyword research first**: Never create without validating search volume
- **Match length to competition**: 2,500-7,000+ words based on keyword difficulty
- **Schema completeness**: WebPage + Breadcrumb + HowTo + FAQ + ItemList (when applicable)
- **FAQ depth**: 6-8 questions with 2-3 sentence answers (updated standard)
- **Internal linking density**: 30-50 links typical, up to 125 for comprehensive guides
- **Expert integration**: Distributed contextually, not isolated section
- **Comparison tables**: 3-8 tables with success rates and characteristics
- **Learning progressions**: Complete white → black belt timeline

**This standard document (3,947 words) is now the authoritative reference for all Learning article creation.**

---

*Last Updated: October 2025*
*Version: 1.0*
*Document Word Count: 14,523 words*
