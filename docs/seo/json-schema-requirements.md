# JSON Schema Requirements for SEO Optimization

**Last Updated:** October 30, 2025

This document outlines the JSON data requirements for your `.md.jinja2` templates to generate optimal schema markup for SEO.

---

## Overview

Your templates generate rich schema markup (HowTo, FAQ, WebPage, BreadcrumbList) from JSON data. To maximize SEO benefits, your JSON files must contain sufficient, high-quality data for each schema type.

### Schema Limits (Standardized)

All templates now use consistent limits:
- **HowTo schema**: First 8 items (`[:8]`)
- **FAQ schema**: First 6 items (`[:6]`)

These limits are optimized for:
- Google rich snippet display (typically shows 3-5 items)
- Schema validation performance
- Mobile rendering
- Page load speed

---

## Transitions Template Requirements

**File**: `bjjgraph/source/templates/Transitions.md.jinja2`

### Required JSON Fields

#### For HowTo Schema (Minimum 3, Optimal 6-8):

```json
{
  "execution_steps": [
    {
      "step_number": 1,
      "action": "Control opponent's collar",
      "description": "Establish a deep cross-collar grip with your right hand",
      "timing": "Before opponent establishes posture"
    }
    // ... minimum 3, optimal 6-8 steps
  ]
}
```

**Quality Guidelines:**
- Each step should be actionable and specific
- Include timing information when relevant
- Descriptions should be 10-30 words
- Steps should flow logically

#### For FAQ Schema (Minimum 2, Optimal 5-6):

```json
{
  "knowledge_assessment": [
    {
      "question": "When is the best time to attempt this technique?",
      "answer": "Execute when opponent's posture is broken and their weight is forward."
    }
    // ... minimum 2, optimal 5-6 Q&As
  ]
}
```

**Quality Guidelines:**
- Questions should be natural language queries users would ask
- Answers should be concise but complete (20-50 words)
- Cover key aspects: timing, common mistakes, when to use

### Current Coverage Status

Based on SEO implementation report:
- ✅ HowTo schema: 70/70 transitions (100%)
- ✅ FAQ schema: Varies by content quality

---

## Positions Template Requirements

**File**: `bjjgraph/source/templates/Positions/TEMPLATE-SINGLE.md.jinja2`

### Required JSON Fields

#### For HowTo Schema (Minimum 3, Optimal 6-8):

```json
{
  "offensive_transitions": [
    {
      "technique": "Hip Bump Sweep",
      "target_position": "Mount",
      "success_rates": {
        "beginner": 50,
        "intermediate": 70,
        "advanced": 85
      }
    }
    // ... minimum 3, optimal 6-8 transitions
  ]
}
```

**Quality Guidelines:**
- Include realistic success rates based on skill level
- Target positions should link to actual position pages
- List transitions in order of importance/frequency

#### For FAQ Schema (Minimum 2, Optimal 5-6):

```json
{
  "common_errors": [
    {
      "error": "Not breaking opponent's posture first",
      "consequence": "Opponent easily defends sweep attempts and maintains base",
      "correction": "Always break posture before attempting sweeps - pull collar down and keep them broken"
    }
    // ... minimum 2, optimal 5-6 errors
  ]
}
```

**Quality Guidelines:**
- Errors should be common beginner/intermediate mistakes
- Consequences explain why the error is problematic
- Corrections provide clear, actionable fixes

### Current Coverage Status

Based on SEO implementation report:
- ⚠️ HowTo schema: 66/94 positions (70%)
  - 28 positions lack sufficient offensive_transitions data
- ⚠️ FAQ schema: 24/94 positions (26%)
  - 70 positions lack sufficient common_errors data

**Recommendation**: Prioritize adding 3-8 offensive_transitions and 5-6 common_errors to remaining position JSON files.

---

## Systems Template Requirements

**File**: `bjjgraph/source/templates/Systems.md.jinja2`

### Required JSON Fields

#### For HowTo Schema (Minimum 3, Optimal 6-8):

```json
{
  "implementation_sequence": [
    {
      "step_number": 1,
      "phase": "Foundation Building",
      "description": "Master the core positions within the system before attempting complex transitions",
      "key_points": [
        "Focus on positional control",
        "Develop muscle memory",
        "Understand decision points"
      ]
    }
    // ... minimum 3, optimal 6-8 phases
  ]
}
```

**Quality Guidelines:**
- Phases should represent logical learning stages
- Descriptions should explain what to focus on
- Key points provide actionable sub-steps

#### For FAQ Schema (Minimum 2, Optimal 5-6):

```json
{
  "common_obstacles": [
    {
      "obstacle": "Difficulty connecting positions smoothly",
      "solution": "Practice positional transitions in isolation before combining. Drill each connection 50+ times."
    }
    // ... minimum 2, optimal 5-6 obstacles
  ]
}
```

**Quality Guidelines:**
- Obstacles should be realistic challenges students face
- Solutions should be specific and actionable
- Focus on learning/training challenges, not just technical issues

---

## Additional Schema Opportunities

### Not Currently Implemented (Optional Future Enhancements)

#### 1. Review Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": {
    "@type": "Thing",
    "name": "Triangle Choke"
  },
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": "4.7",
    "bestRating": "5"
  },
  "author": {
    "@type": "Organization",
    "name": "BJJ Graph Community"
  }
}
```

**When to use:** If you collect user ratings/reviews for techniques
**Benefit:** Star ratings in search results
**Required data:** User ratings aggregated by technique

#### 2. VideoObject Schema

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "How to Execute Hip Bump Sweep",
  "description": "Step-by-step video demonstration",
  "thumbnailUrl": "https://bjjgraph.org/videos/hip-bump-thumb.jpg",
  "uploadDate": "2025-10-01",
  "duration": "PT3M45S",
  "contentUrl": "https://youtube.com/watch?v=..."
}
```

**When to use:** When adding video content to technique pages
**Benefit:** Video rich snippets in search results
**Required data:** Video URLs, thumbnails, duration

#### 3. AggregateRating Schema

```json
{
  "@context": "https://schema.org",
  "@type": "AggregateRating",
  "ratingValue": "4.6",
  "reviewCount": "342",
  "bestRating": "5",
  "worstRating": "1"
}
```

**When to use:** If collecting community ratings
**Benefit:** Star ratings displayed in search results
**Required data:** Aggregate user ratings

---

## Data Quality Checklist

Use this checklist when creating/updating JSON files:

### Transitions
- [ ] Has 6-8 execution_steps with clear descriptions
- [ ] Each step has step_number, action, description
- [ ] Has 5-6 knowledge_assessment Q&As
- [ ] Questions are natural language queries
- [ ] Answers are concise (20-50 words)
- [ ] Success rates provided for skill levels

### Positions
- [ ] Has 6-8 offensive_transitions
- [ ] Each transition has technique, target_position, success_rates
- [ ] Success rates realistic per skill level
- [ ] Has 5-6 common_errors
- [ ] Each error has error, consequence, correction
- [ ] Corrections are actionable

### Systems
- [ ] Has 6-8 implementation_sequence phases
- [ ] Each phase has step_number, phase, description
- [ ] Key_points provided for important phases
- [ ] Has 5-6 common_obstacles
- [ ] Each obstacle has obstacle and solution
- [ ] Solutions are specific and actionable

---

## Priority Improvements

Based on current SEO status, prioritize:

### High Priority (Direct SEO Impact)

1. **Complete Position HowTo Schema** (28 positions need data)
   - Add 6-8 offensive_transitions to positions lacking them
   - Ensure success_rates are realistic

2. **Expand Position FAQ Schema** (70 positions need data)
   - Add 5-6 common_errors to positions lacking them
   - Focus on beginner/intermediate mistakes

### Medium Priority (Enhancement)

3. **Standardize Success Rates**
   - Ensure realistic progression (beginner < intermediate < advanced)
   - Base on actual competition/training data when possible

4. **Improve Question Quality**
   - Review knowledge_assessment questions
   - Ensure they match actual user search queries
   - Use natural language

### Low Priority (Future)

5. **Add Video Schema** (when video content available)
6. **Add Review Schema** (if collecting user ratings)
7. **Add Course Schema** (for learning path features)

---

## Validation Process

After updating JSON files:

1. **Generate markdown**: Run your template generation script
2. **Extract schema**: View page source and copy JSON-LD blocks
3. **Validate schema**: 
   - Use https://validator.schema.org/
   - Use Google Rich Results Test
4. **Check rendering**: Verify in browser that content displays correctly

---

## SEO Impact Summary

### Current State (October 2025)

**Schema Coverage:**
- WebPage: 100% (270/270) ✅
- BreadcrumbList: 100% (270/270) ✅
- HowTo: 51% (137/270) ⚠️
- FAQPage: 9% (24/270) ⚠️

**Target State (3 months):**
- HowTo: 80%+ (216/270)
- FAQPage: 40%+ (108/270)

**Expected Benefits:**
- +20% CTR from rich snippets
- 100+ pages eligible for rich results
- Improved average position in SERPs
- Featured snippet eligibility

---

## Related Documentation

- [SEO Implementation Report](./seo-implementation-report.md) - Current status
- [SEO Strategy](./seo-strategy.md) - 6-month roadmap
- [SEO Validation Guide](./seo-validation-guide.md) - Testing procedures
- [Template Documentation](/source/templates/) - Template structure

---

*This document defines the data requirements for optimal schema markup generation. Focus on data quality over quantity - 6 excellent Q&As beat 10 mediocre ones.*
