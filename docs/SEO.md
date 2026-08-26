# BJJGraph SEO Implementation

## Schema Markup

Schema markup is generated automatically by Jinja2 templates during build.

### Schema Types

| Schema Type | Content Type | Purpose |
|-------------|--------------|---------|
| **HowTo** | Positions, Transitions, Submissions | Step-by-step technique instructions |
| **FAQ** | Common mistakes sections | Q&A format for featured snippets |
| **BreadcrumbList** | All pages | Navigation hierarchy |
| **WebPage** | All pages | Page metadata |
| **VideoObject** (in ItemList) | Pages with curated `clips` | Film-study YouTube clips; `uploadDate` emitted only when the optional `upload_date` provenance field is present (future enrichment pass) |

### How Schema Is Generated

1. JSON source files contain structured data
2. Jinja2 templates read JSON and output schema in `<script type="application/ld+json">`
3. Quartz builds static HTML with embedded schema
4. Google crawls and displays rich results

### Example HowTo Schema

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Hip Bump Sweep",
  "description": "Learn how to execute Hip Bump Sweep from Closed Guard Bottom to Mount.",
  "step": [
    {"@type": "HowToStep", "name": "Setup", "text": "Establish collar grip..."},
    {"@type": "HowToStep", "name": "Movement", "text": "Begin sit-up motion..."}
  ],
  "totalTime": "PT5M"
}
```

### Validation

Test schema at: https://search.google.com/test/rich-results

---

## Keyword Strategy

### Primary Targets

| Keyword | Search Volume | Current Position | Priority |
|---------|---------------|------------------|----------|
| bjj positions | 2,200/mo | Page 1 target | HIGH |
| bjj techniques | 1,600/mo | Page 1 target | HIGH |
| bjj submissions | 5,400/mo | Page 1 target | HIGH |
| bjj guards | 880/mo | Ranking | MEDIUM |
| bjj sweeps | 720/mo | Ranking | MEDIUM |

### Hub Pages

Dedicated aggregation pages for primary keywords:

| Hub Page | Target Keyword |
|----------|---------------|
| `/BJJ-Positions` | bjj positions |
| `/BJJ-Transitions` | bjj techniques |
| `/BJJ-Submissions` | bjj submissions |
| `/BJJ-Guard-Passing` | bjj guard passing |
| `/BJJ-Escapes` | bjj escapes |

---

## Meta Tags

### Title Format

```
[Content Name] | [Content Type] | BJJ Graph
```

Examples:
- "Mount | BJJ Position Guide | BJJ Graph"
- "Hip Bump Sweep | BJJ Technique | BJJ Graph"
- "Triangle Choke | BJJ Submission | BJJ Graph"

### Description Template

**Positions:**
```
Master [Position] in BJJ. Complete guide covering control, techniques, and transitions. Point value: [X]. Interactive visualization included.
```

**Transitions:**
```
Learn [Technique] in BJJ. Step-by-step from [Start] to [End]. Success rates: Beginner X%, Intermediate Y%, Advanced Z%.
```

**Submissions:**
```
Master [Submission] safely. Complete guide with safety protocols, execution steps, and training progressions.
```

### Description Length

- Target: 150-160 characters
- Never exceed 160 (truncated in search results)

---

## Internal Linking

### Rules

- Each page links to 3-5 related positions/techniques
- Use descriptive anchor text (not "click here")
- Link from high-authority pages to new content
- Create link clusters around topic hubs

### Example

```markdown
From [[Positions/Closed Guard/Bottom]], you can execute this sweep to reach [[Positions/Mount]].
If the sweep fails, you may end up in [[Positions/Half Guard/Bottom]].
```

---

## PostHog Analytics

| Dashboard | Purpose |
|-----------|---------|
| Content Performance | Page views, time on page, bounce rate |
| User Analytics | Traffic sources, user paths |

**Dashboard URL**: https://us.posthog.com/project/236155

### Event taxonomy

Neural-app events are `neural_<noun>_<verb>` in snake_case, captured through the single guarded
seam `app.track()` in `neural/src/app.src.jsx` (it injects `variant: "neural"` and is a no-op when
the PostHog token is absent, e.g. on localhost). Never call `posthog.capture` from the app directly.

**That no-op is a gate, not a hope.** `scripts/check_analytics_surface.py` (`npm run
validate:analytics`, wired into both deploy workflows after the Quartz build) reads the built
`postscript.js` and asserts the injection matches the environment the build ran in, both ways: with
`POSTHOG_API_KEY` set, exactly one `posthog.init()` carrying *that* key plus the stub loader; with
it unset, zero of either anywhere in the emitted JS, so `window.posthog` stays undefined and the
guarded reads above short-circuit. The second direction is the one that costs you data silently — a
build that stops injecting stops collecting, and nothing errors. `tests/analytics_surface_gate.test.mjs`
pins the gate's own discrimination on every PR.

### Cold-start funnel (v1.82.0)

The first-visit path is measured by an OBSERVER of the `fx()` beat stream (`_cs*` in
`app.src.jsx`) — no second event channel, no beacon, no blocking request.

| Event | When | Key properties |
|-------|------|----------------|
| `neural_coldstart_step` | Once per funnel mark, per session | `step`, `step_index`, `spine`, `cold`, `ms_since_nav`, `ms_since_prev` |
| `neural_coldstart_abandoned` | On `pagehide` / tab hidden, mid-funnel | `furthest_step`, `furthest_index`, `reason`, `cold`, `marks` |

**Spine** (build the funnel on the `step` property of `neural_coldstart_step`, in this order):
`app_ready` → `hand_dealt` → `question_shown` → `question_answered` → `move_committed` →
`outcome_seen` → `roll_ended`.

**Side marks** (measured, but off the spine — `spine: false`): `unseen_question` (the landing
question was about a node with NO study history — the suspected cold-start confusion),
`question_ignored` (committed past an unanswered question), `pane_opened`, `deck_card_graded`.

`cold: true` means the visitor arrived with no `bjj-neural-progress` and no `bjj-neural-coached`
in localStorage. A tab-switch also fires `neural_coldstart_abandoned`, and the report re-arms
whenever the spine advances — take the LAST abandoned event per session; the step events are the
authoritative funnel. Gated by `e2e/journeys/coldstart-funnel.spec.ts`.

---

## Technical SEO

### Implemented

| Item | Status |
|------|--------|
| XML Sitemap | Auto-generated by Quartz |
| Meta descriptions | All pages |
| Canonical URLs | Default enabled |
| Mobile responsive | Full support |
| HTTPS | Enforced |
| Fast load times | Static site (~50ms TTFB) |

### Core Web Vitals

| Metric | Target | Current |
|--------|--------|---------|
| LCP (Largest Contentful Paint) | <2.5s | ~1.2s |
| FID (First Input Delay) | <100ms | <50ms |
| CLS (Cumulative Layout Shift) | <0.1 | ~0.02 |

---

## Content Bot SEO Improvements

The daily content improvement bot (`content-improvement-bot.yml`) applies SEO enhancements:

- Converts statements to questions (featured snippets)
- Front-loads key facts in descriptions
- Fills missing success rates
- Fixes broken wikilinks

---

## Monitoring

### Google Search Console

- Monitor indexation status
- Track keyword rankings
- Check for crawl errors
- Review rich results performance

### PostHog

- Track user engagement
- Analyze content performance
- Identify high-converting pages

---

## Quick Checklist

### Before Publishing Content

- [ ] Title follows format: `[Name] | [Type] | BJJ Graph`
- [ ] Description is 150-160 characters
- [ ] 3+ internal wikilinks included
- [ ] Success rates in correct order (Beginner <= Intermediate <= Advanced)
- [ ] Schema markup will be auto-generated from template

### Monthly SEO Tasks

- [ ] Check Google Search Console for errors
- [ ] Review keyword rankings
- [ ] Update underperforming content
- [ ] Add internal links to new content
- [ ] Verify schema with Rich Results Test
