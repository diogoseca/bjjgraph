# PostHog + Template Integration: Complete Implementation Plan

**Created**: 2025-10-30
**Status**: Ready for implementation
**Goal**: Achieve flawless, beautiful sync between PostHog A/B testing and Jinja2 template generation

---

## Executive Summary

**Current State**:
- ✅ Edge generates Dirichlet priorities at Cloudflare Worker
- ✅ Client tracking script (`posthog-ab-tracking.inline.ts`) sends events
- ❌ Templates missing PostHog metadata (body data attributes)
- ❌ No flexbox wrapper (CSS `order` properties have no effect!)
- ❌ Section counts hardcoded in TypeScript (not template-aware)
- ❌ Hub pages not A/B testable (no sections)
- ✅ Jinja2 syntax errors FIXED (4 templates)

**Target State**:
- ✅ Templates output metadata on `<body>` tag
- ✅ Sections wrapped in flexbox container (CSS ordering works)
- ✅ Dynamic section detection from DOM
- ✅ Hub pages testable (variant comparison table as section)
- ✅ Debug mode with ?debug query param
- ✅ New feature flags (expert visibility, training drill inclusion)

---

## Template Structure Summary

### All Templates Follow Same Pattern

**YAML Frontmatter** (lines 5-8):
```yaml
---
title: "{{name}} | Category | BJJ Graph"
description: "{{description}}"
---
```

**Schema.org JSON-LD** (4 scripts, ~80 lines):
1. HowTo schema (execution steps)
2. FAQPage schema (from knowledge assessment or common errors)
3. WebPage schema (basic page metadata)
4. BreadcrumbList schema (navigation hierarchy)

**Content Structure**:
```html
# {{name}}
{% for tag in tags %}#{{tag}} {% endfor %}

> **Quick Answer**: [Concise 2-3 sentence overview]

<section id="section-name" class="content-section">
## Section Heading
[Content here]
</section>

[Repeat for all sections]
```

### Template Inventory

| Template | Sections | Syntax Errors | PostHog Ready |
|----------|----------|---------------|---------------|
| **Positions/TEMPLATE-SINGLE.md.jinja2** | 15 | ✅ None | ❌ No |
| **Positions/TEMPLATE-BOTTOM.md.jinja2** | 15 | ✅ None | ❌ No |
| **Positions/TEMPLATE-TOP.md.jinja2** | 15 | ✅ None | ❌ No |
| **Positions/TEMPLATE-HUB.md.jinja2** | 0 (hub) | ✅ None | ❌ No |
| **Submissions.md.jinja2** | 14 | ✅ **FIXED** | ❌ No |
| **Transitions.md.jinja2** | 13 | ✅ **FIXED** | ❌ No |
| **Principles.md.jinja2** | 11 | ✅ **FIXED** | ❌ No |
| **Systems.md.jinja2** | 9 | ✅ **FIXED** | ❌ No |

### Section IDs by Template Type

**Positions (15 sections)** - SINGLE/BOTTOM/TOP:
```
state-properties, overview, state-invariants, prerequisites, key-principles,
offensive-transitions, defensive-responses, counter-transitions, decision-tree,
common-errors, training-drills, optimal-submission-paths, position-metrics,
expert-insights, related-content
```

**Submissions (14 sections)**:
```
overview, safety-considerations, key-principles, setup-requirements, execution-steps,
opponent-defense-patterns, common-errors, variations-and-setups, knowledge-assessment,
training-progressions-and-safety-protocols, from-positions, related-submissions,
related-content, expert-insights
```

**Transitions (13 sections)**:
```
overview, key-principles, setup-requirements, execution-steps, common-counters,
common-errors, training-progressions, variants-and-adaptations, knowledge-assessment,
safety-considerations, position-integration, related-content, expert-insights
```

**Principles (11 sections)**:
```
overview, key-principles, component-skills, principle-relationships,
application-contexts, decision-framework, common-errors, training-approaches,
developmental-metrics, related-content, expert-insights
```

**Systems (9 sections)**:
```
overview, key-principles, key-components, implementation-sequence,
common-obstacles, assessment-metrics, training-methodology,
related-content, expert-insights
```

---

## Implementation Plan

### Phase 1: Template Modifications (Priority 1)

#### 1.1 Add Body Data Attributes

**All 8 templates** - Add after `---` frontmatter closing, before `#` title:

```jinja2
---
title: "{{name}} | Category | BJJ Graph"
description: "{{description}}"
---

{# PostHog A/B Testing Metadata #}
<body data-content-type="positions" data-sections='["state-properties","overview","key-principles","offensive-transitions","defensive-responses","counter-transitions","decision-tree","common-errors","training-drills","optimal-submission-paths","position-metrics","expert-insights","related-content"]'>

# {{name}}
```

**Benefits**:
- ✅ SEO neutral (data attributes ignored by crawlers)
- ✅ Single source of truth for section list
- ✅ PostHog script reads dynamically (no hardcoded lists)
- ✅ Easy to add/remove sections without touching JavaScript

**Template-Specific Section Lists**:

**Positions (SINGLE/BOTTOM/TOP)**:
```html
<body data-content-type="positions" data-sections='["state-properties","overview","state-invariants","prerequisites","key-principles","offensive-transitions","defensive-responses","counter-transitions","decision-tree","common-errors","training-drills","optimal-submission-paths","position-metrics","expert-insights","related-content"]'>
```

**Submissions**:
```html
<body data-content-type="submissions" data-sections='["overview","safety-considerations","key-principles","setup-requirements","execution-steps","opponent-defense-patterns","common-errors","variations-and-setups","knowledge-assessment","training-progressions-and-safety-protocols","from-positions","related-submissions","related-content","expert-insights"]'>
```

**Transitions**:
```html
<body data-content-type="transitions" data-sections='["overview","key-principles","setup-requirements","execution-steps","common-counters","common-errors","training-progressions","variants-and-adaptations","knowledge-assessment","safety-considerations","position-integration","related-content","expert-insights"]'>
```

**Principles**:
```html
<body data-content-type="principles" data-sections='["overview","key-principles","component-skills","principle-relationships","application-contexts","decision-framework","common-errors","training-approaches","developmental-metrics","related-content","expert-insights"]'>
```

**Systems**:
```html
<body data-content-type="systems" data-sections='["overview","key-principles","key-components","implementation-sequence","common-obstacles","assessment-metrics","training-methodology","related-content","expert-insights"]'>
```

#### 1.2 Add Flexbox Wrapper Around Sections

**All templates with sections** (7 templates, not HUB) - Wrap all `<section>` tags:

```jinja2
{# Flexbox wrapper for CSS order-based A/B testing #}
<main class="content-wrapper" style="display: flex; flex-direction: column;">

<section id="overview" class="content-section">
...
</section>

<section id="key-principles" class="content-section">
...
</section>

[... all other sections ...]

</main>
```

**Why**: Edge injects CSS like `#decision-tree { order: 23; }` but without `display: flex` parent, `order` property is ignored!

#### 1.3 Add Debug Mode Indicator

**All 8 templates** - Add after schema blocks, before title:

```jinja2
</script>

{# Debug mode indicator (only visible with ?debug query param) #}
{% if debug_mode %}
<!--
  🐛 BJJ Graph A/B Testing Debug Mode

  Week Seed: {{ week_seed }}
  Content Type: {{ content_type }}
  Section Count: {{ sections | length }}
  Visual Variant: {{ visual_elements }}

  Section Priorities:
  {% for section in sections -%}
  - {{ section }}: {{ priorities.get(section, 0.0) | round(3) }}
  {% endfor %}

  Generated: {{ generation_timestamp }}
-->
{% endif %}

# {{name}}
```

**Detection logic** (in json_to_md.py):
```python
import os
from datetime import datetime

context = {
    'data': json_data,
    'debug_mode': os.getenv('DEBUG') == 'true' or '?debug' in request_url,
    'week_seed': get_week_number(),
    'generation_timestamp': datetime.utcnow().isoformat()
}
```

### Phase 2: Hub Template Enhancement

#### 2.1 Make Variant Comparison Table Testable

**TEMPLATE-HUB.md.jinja2** - Wrap comparison table in `<section>`:

```jinja2
<section id="variant-comparison" class="content-section">

## Position Properties Comparison

{% if variations %}
{# FAMILY: Multi-variant table #}
| Variant | Bottom Risk | Top Risk | Bottom Energy | Top Energy | What Makes This Variant Unique |
...
{% else %}
{# DUAL: Simple table #}
| Property | Bottom Perspective | Top Perspective |
...
{% endif %}

</section>
```

**Benefits**:
- Hub pages become A/B testable
- Can reorder/hide variant table based on Dirichlet priority
- Consistent section structure across all page types

#### 2.2 Add Other Hub Sections

Currently hub has NO sections. Add these:

```html
<section id="overview" class="content-section">
## What is {{ name }}?
{{ overview }}
</section>

<section id="key-principles" class="content-section">
### Key Principles
{% for principle in key_principles %}
- {{ principle }}
{% endfor %}
</section>

<section id="variant-comparison" class="content-section">
## Position Properties Comparison
[Table here]
</section>

<section id="bottom-summary" class="content-section">
## {{ name }} Bottom Perspective
[Content here]
</section>

<section id="top-summary" class="content-section">
## {{ name }} Top Perspective
[Content here]
</section>

<section id="variations-list" class="content-section">
## Position Variations
[List here]
</section>

<section id="related-positions" class="content-section">
## Related Positions
[List here]
</section>
```

### Phase 3: Edge Middleware Updates

#### 3.1 Update Section Lists in _middleware.ts

**Add hub sections**:
```typescript
const CONTENT_SECTIONS: Record<string, string[]> = {
  positions: [
    // Existing 15 sections for SINGLE/BOTTOM/TOP pages
    'state-properties', 'overview', 'state-invariants', 'prerequisites',
    'key-principles', 'offensive-transitions', 'defensive-responses',
    'counter-transitions', 'decision-tree', 'common-errors',
    'training-drills', 'optimal-submission-paths', 'position-metrics',
    'expert-insights', 'related-content'
  ],
  'positions-hub': [
    // NEW: Hub page sections
    'overview', 'key-principles', 'variant-comparison', 'bottom-summary',
    'top-summary', 'variations-list', 'related-positions'
  ],
  // ... other categories unchanged
}
```

**Detection logic**:
```typescript
function getContentTypeAndSections(pathname: string): [string, string[]] {
  if (pathname.includes('/positions/') && !pathname.includes('/bottom') && !pathname.includes('/top')) {
    // Check if it's a hub page (ends with position name, no /bottom or /top)
    const isHub = !pathname.match(/\/positions\/[^\/]+\/(bottom|top)$/);
    return isHub
      ? ['positions-hub', CONTENT_SECTIONS['positions-hub']]
      : ['positions', CONTENT_SECTIONS['positions']];
  }
  // ... rest of detection
}
```

#### 3.2 Add New Feature Flags

```typescript
// Fetch multiple flags in single API call
async function getPostHogFlags(
  distinctId: string,
  env: Env
): Promise<Record<string, string>> {
  const response = await fetch(`${env.POSTHOG_API_HOST}/decide/?v=3`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.POSTHOG_API_KEY}`
    },
    body: JSON.stringify({
      api_key: env.POSTHOG_API_KEY,
      distinct_id: distinctId,
      groups: {}
    })
  });

  const data: PostHogDecideResponse = await response.json();

  return {
    visualElements: data.featureFlags['position-visual-elements'] as string || 'control',
    expertVisibility: data.featureFlags['expert-visibility-mode'] as string || 'all_three',
    trainingDrills: data.featureFlags['training-drill-inclusion'] as string || 'always'
  };
}
```

**Update assignment generation**:
```typescript
const assignment: ABAssignment = {
  weekSeed,
  sectionPriorities,
  visualElements: flags.visualElements,
  expertVisibility: flags.expertVisibility,    // NEW
  trainingDrills: flags.trainingDrills         // NEW
}
```

**Inject CSS for new flags**:
```typescript
// Hide training-drills section if flag says so
if (assignment.trainingDrills === 'never') {
  cssRules.push(`#training-drills { display: none !important; }`)
}

// Hide 2 of 3 experts if flag says rotate
if (assignment.expertVisibility === 'single_focus') {
  // Rotate which expert based on week seed
  const experts = ['danaher', 'gordon-ryan', 'eddie-bravo']
  const focusExpert = experts[assignment.weekSeed % 3]
  experts.forEach(expert => {
    if (expert !== focusExpert) {
      cssRules.push(`.expert-${expert} { display: none !important; }`)
    }
  })
}
```

### Phase 4: Frontend Tracking Script Updates

#### 4.1 Dynamic Section Reading

**Update `posthog-ab-tracking.inline.ts`**:

```typescript
/**
 * Get sections from body data attribute (template-provided)
 */
function getSectionsFromBody(): string[] {
  const sectionsAttr = document.body.dataset.sections

  if (sectionsAttr) {
    try {
      return JSON.parse(sectionsAttr)
    } catch (e) {
      console.error('[BJJ Graph AB] Failed to parse sections from body:', e)
    }
  }

  // Fallback: discover from DOM
  return Array.from(document.querySelectorAll('.content-section[id]'))
    .map(el => el.id)
    .filter(Boolean)
}

/**
 * Get content type from body data attribute
 */
function getContentType(): string {
  return document.body.dataset.contentType || 'unknown'
}
```

#### 4.2 Normalize Priorities to Actual Sections

```typescript
function trackABPageView(posthog: PostHogType) {
  const metadata = getPageMetadata()
  const contentType = getContentType()
  const pageSections = getSectionsFromBody()

  const assignment = getAssignmentFromCookie()
  if (!assignment) {
    console.warn('[BJJ Graph AB] No assignment cookie found')
    return
  }

  // Normalize priorities to actual sections on THIS page
  const normalizedPriorities: Record<string, number> = {}
  const normalizedVisibility: Record<string, boolean> = {}

  pageSections.forEach(sectionId => {
    const priorityKey = `section_${sectionId}_priority`
    const visibilityKey = `section_${sectionId}_visible`

    const priority = assignment.sectionPriorities[priorityKey] || 0
    normalizedPriorities[priorityKey] = priority
    normalizedVisibility[visibilityKey] = priority >= 0.01
  })

  // Flatten all data for PostHog
  const eventData = {
    ...metadata,
    content_type: contentType,
    section_count: pageSections.length,
    week_seed: assignment.weekSeed,
    visual_elements: assignment.visualElements,
    expert_visibility: assignment.expertVisibility || 'all_three',
    training_drills: assignment.trainingDrills || 'always',
    ...normalizedPriorities,
    ...normalizedVisibility
  }

  posthog.capture('ab_page_view', eventData)
}
```

**Benefits**:
- ✅ Works with ANY section list (15, 13, 11, 9 sections)
- ✅ Hub pages supported (7 sections)
- ✅ No hardcoded section lists
- ✅ Automatically adapts to template changes

#### 4.3 Remove Hardcoded CONTENT_SECTIONS

**DELETE** lines 55-126 in `posthog-ab-tracking.inline.ts`:
```typescript
// ❌ DELETE THIS - no longer needed
const CONTENT_SECTIONS: Record<string, string[]> = {
  positions: [...],
  transitions: [...],
  // ...
}
```

Now reads from body data attribute instead!

---

## Detailed Implementation Checklist

### ✅ Completed
- [x] Fix Jinja2 syntax errors (4 templates: Submissions, Transitions, Principles, Systems)
- [x] Document current template structure
- [x] Identify all section IDs per template
- [x] Analyze PostHog integration points

### 🔨 Phase 1: Template Updates (8 files)

**File 1: Positions/TEMPLATE-SINGLE.md.jinja2**
- [ ] Add `<body data-content-type="positions" data-sections='[...]'>` after line 8
- [ ] Add `<main class="content-wrapper" style="display: flex; flex-direction: column;">` before line 104
- [ ] Add `</main>` after last `</section>` (~line 292)
- [ ] Add debug mode indicator after line 92

**File 2: Positions/TEMPLATE-BOTTOM.md.jinja2**
- [ ] Add `<body>` tag with data attributes after line 8
- [ ] Add `<main>` wrapper before line 104
- [ ] Add `</main>` after line 292
- [ ] Add debug mode indicator after line 92

**File 3: Positions/TEMPLATE-TOP.md.jinja2**
- [ ] Add `<body>` tag with data attributes after line 8
- [ ] Add `<main>` wrapper before line 104
- [ ] Add `</main>` after line 292
- [ ] Add debug mode indicator after line 92

**File 4: Positions/TEMPLATE-HUB.md.jinja2**
- [ ] Add `<body>` tag with 7 hub sections after line 8
- [ ] Wrap content in `<main>` wrapper
- [ ] Convert comparison table to `<section id="variant-comparison">`
- [ ] Add sections for: overview, key-principles, bottom-summary, top-summary, variations-list, related-positions
- [ ] Add debug mode indicator

**File 5: Submissions.md.jinja2**
- [ ] Add `<body>` tag with 14 sections after line 8
- [ ] Add `<main>` wrapper before line 85
- [ ] Add `</main>` after last section
- [ ] Add debug mode indicator after line 77

**File 6: Transitions.md.jinja2**
- [ ] Add `<body>` tag with 13 sections after line 8
- [ ] Add `<main>` wrapper before first section
- [ ] Add `</main>` after last section
- [ ] Add debug mode indicator after schema blocks

**File 7: Principles.md.jinja2**
- [ ] Add `<body>` tag with 11 sections after line 8
- [ ] Add `<main>` wrapper
- [ ] Add `</main>` closing
- [ ] Add debug mode indicator

**File 8: Systems.md.jinja2**
- [ ] Add `<body>` tag with 9 sections after line 8
- [ ] Add `<main>` wrapper
- [ ] Add `</main>` closing
- [ ] Add debug mode indicator

### 🔨 Phase 2: Middleware Updates (1 file)

**File: source/functions/_middleware.ts**
- [ ] Add `positions-hub` to CONTENT_SECTIONS with 7 sections
- [ ] Update `getContentTypeAndSections()` to detect hub vs detail pages
- [ ] Add `expert-visibility-mode` feature flag fetch
- [ ] Add `training-drill-inclusion` feature flag fetch
- [ ] Update ABAssignment interface to include new flags
- [ ] Add CSS injection for expert visibility (hide 2 of 3 experts)
- [ ] Add CSS injection for training drills (hide if flag = 'never')

### 🔨 Phase 3: Tracking Script Updates (1 file)

**File: source/quartz/components/scripts/posthog-ab-tracking.inline.ts**
- [ ] Add `getSectionsFromBody()` function
- [ ] Add `getContentType()` function
- [ ] Update `trackABPageView()` to use dynamic sections
- [ ] Add normalization logic for priorities
- [ ] Add new flag properties to event data
- [ ] Remove hardcoded CONTENT_SECTIONS object (lines 55-126)

### 🔨 Phase 4: Testing & Validation

- [ ] Run `python3 scripts/json_to_md.py --all` to regenerate all markdown
- [ ] Test locally with `npx wrangler pages dev public`
- [ ] Verify flexbox ordering works (inspect element, check `order` CSS)
- [ ] Test ?debug mode (view HTML comments)
- [ ] Verify PostHog events in dashboard
- [ ] Check section priorities normalize correctly
- [ ] Test hub vs detail page detection
- [ ] Validate new feature flags apply correctly

---

## Benefits of This Architecture

### Developer Experience
- ✅ **Single source of truth**: Section lists in templates, not JS
- ✅ **Type safety**: Body data attributes ensure consistency
- ✅ **Debug mode**: Visual feedback with ?debug query param
- ✅ **Maintainability**: Add/remove sections in one place

### Performance
- ✅ **Zero runtime cost**: Data attributes parsed once on page load
- ✅ **Edge-side rendering**: Dirichlet generated at CDN, not client
- ✅ **Cookie persistence**: Weekly refresh (not per-page)
- ✅ **Cached PostHog calls**: 60s TTL, ~99% hit rate

### SEO & User Experience
- ✅ **SEO neutral**: Data attributes ignored by Google
- ✅ **Progressive enhancement**: Works without JavaScript
- ✅ **No FOUC**: Section ordering applied at edge before HTML loads
- ✅ **Accessible**: Flexbox preserves semantic HTML

### Analytics & Testing
- ✅ **Dynamic adaptation**: Works with any section count
- ✅ **Hub pages testable**: Comparison tables can be A/B tested
- ✅ **Content variations**: Expert visibility, drill inclusion flags ready
- ✅ **Granular tracking**: Per-section priority and visibility data

---

## Next Steps

1. **Implement Phase 1** - Update all 8 templates (body attributes, flexbox wrapper, debug mode)
2. **Implement Phase 2** - Enhance hub template with sections
3. **Implement Phase 3** - Update middleware (hub detection, new flags)
4. **Implement Phase 4** - Update tracking script (dynamic sections)
5. **Test end-to-end** - Regenerate content, test locally, verify PostHog events
6. **Deploy** - Push to production, monitor analytics

**Estimated Time**: 2-3 hours for full implementation + testing

**Estimated Impact**:
- 100% template-PostHog sync
- Hub pages become testable (7 new A/B variants)
- 2 new feature flags (expert visibility, training drills)
- Cleaner codebase (remove 70+ lines of hardcoded section lists)

---

## PostHog Feature Flags to Create

### 1. position-visual-elements (EXISTING)
- **Type**: Multivariate string
- **Variants**: `control` (50%), `enhanced` (50%)
- **Purpose**: Visual styling on expert insights, key principles, decision trees

### 2. expert-visibility-mode (NEW)
- **Type**: Multivariate string
- **Variants**:
  - `all_three` (40%) - Show Danaher, Gordon Ryan, Eddie Bravo
  - `rotate_weekly` (30%) - Rotate which expert is shown (based on week seed)
  - `single_focus` (30%) - Show only 1 expert per page view
- **Purpose**: Test whether showing all 3 experts vs focused single expert improves engagement

### 3. training-drill-inclusion (NEW)
- **Type**: Multivariate string
- **Variants**:
  - `always` (40%) - Always show training drills section
  - `intermediate_plus` (30%) - Hide for beginners, show for intermediate+ (requires skill level detection)
  - `never` (30%) - Hide training drills entirely
- **Purpose**: Test whether training drills improve engagement or cause drop-off

---

## File Change Summary

| File | Lines Added | Lines Changed | Purpose |
|------|-------------|---------------|---------|
| TEMPLATE-SINGLE.md.jinja2 | +15 | 0 | Body attrs, flexbox, debug |
| TEMPLATE-BOTTOM.md.jinja2 | +15 | 0 | Body attrs, flexbox, debug |
| TEMPLATE-TOP.md.jinja2 | +15 | 0 | Body attrs, flexbox, debug |
| TEMPLATE-HUB.md.jinja2 | +45 | +10 | Sections, body attrs, debug |
| Submissions.md.jinja2 | +15 | 1 (fixed) | Body attrs, flexbox, debug |
| Transitions.md.jinja2 | +15 | 1 (fixed) | Body attrs, flexbox, debug |
| Principles.md.jinja2 | +15 | 1 (fixed) | Body attrs, flexbox, debug |
| Systems.md.jinja2 | +15 | 1 (fixed) | Body attrs, flexbox, debug |
| _middleware.ts | +60 | +20 | Hub detection, new flags |
| posthog-ab-tracking.inline.ts | -70 | +30 | Dynamic sections, remove hardcoded |
| **TOTAL** | **+220** | **+64** | **10 files** |

**Net change**: ~284 lines added/modified across 10 files

---

**This plan ensures PostHog and template generation work in perfect sync with beautiful, maintainable code.**
