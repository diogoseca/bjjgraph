# BJJGraph Architecture

## JSON-First Content Pipeline

BJJGraph transforms structured JSON into a static site:

```
source/templates/*.json  →  *.md.jinja2  →  source/content/*.md  →  Quartz Build  →  Static Site
        (SOURCE)              (TEMPLATES)         (GENERATED)           (BUILD)        (OUTPUT)
```

### Pipeline Components

1. **JSON Source Files** (`source/templates/`)
   - `Positions.json` - All position state data
   - `Transitions.json` - All transition technique data
   - `Submissions.json` - All submission data
   - `Principles.json` - Conceptual principles
   - `Systems.json` - Expert systems

2. **Jinja2 Templates** (`source/templates/*.md.jinja2`)
   - Generate markdown content from JSON
   - Inject SEO schema markup (HowTo, FAQ, BreadcrumbList)

3. **Generated Markdown** (`source/content/`)
   - Content pages with YAML frontmatter
   - Wikilinks for internal navigation
   - Schema.org JSON-LD for SEO

4. **Quartz Build** (`npx quartz build`)
   - Static HTML generation
   - Graph visualization (D3.js)
   - Full-text search (Flexsearch)
   - Component rendering (Preact)

---

## Position "Playing As" Model

Positions follow a chess-like architecture where position = board state and Top/Bottom = which side you play.

### Structure

```
Position (Hub Page)     = Board state (e.g., "Mount")
├── Top (Role Page)     = Playing as White (maintain, submit)
└── Bottom (Role Page)  = Playing as Black (escape, reverse)
```

### File Organization

```
Positions/
├── Mount.md           # Hub page (canonical graph node)
└── Mount/
    ├── Top.md         # Playing as top (submissions, control)
    └── Bottom.md      # Playing as bottom (escapes, reversals)
```

### Graph Rules

- **Hub pages are graph nodes** - Positions like "Mount", "Closed Guard"
- **Role pages excluded from graph** - Top/Bottom pages don't create separate nodes
- **Hub aggregates links** - Both Top and Bottom links appear on hub's graph connections
- **Prevents redundancy** - No "Mount Bottom", "Mount Top" as separate nodes

---

## Quartz Configuration

### Core Files

| File | Purpose |
|------|---------|
| `source/quartz.config.ts` | Site configuration, theme, analytics |
| `source/quartz.layout.ts` | Component placement |
| `source/quartz/components/` | Preact UI components |
| `source/quartz/plugins/` | Content transformers and emitters |

### Key Configuration

```typescript
// quartz.config.ts
const config: QuartzConfig = {
  configuration: {
    pageTitle: "BJJ Graph",
    enableSPA: true,              // Single-page app navigation
    enablePopovers: true,         // Hover previews for links
    analytics: {
      provider: "plausible",      // Privacy-focused analytics
    },
    ignorePatterns: [
      "CONTRIBUTING-*.md",        // Exclude contributor docs
    ],
  },
}
```

### Layout Zones

```typescript
// quartz.layout.ts
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.Search(),
    Component.Darkmode(),
    Component.Explorer(),
  ],
  right: [
    Component.Graph(),
    Component.TableOfContents(),
    Component.Backlinks(),
  ],
}
```

---

## State Machine Data Model

BJJ Graph content represents a probabilistic state machine:

- **Positions** = States (nodes)
- **Transitions** = State changes (edges)
- **Submissions** = Terminal states

### Position Data Structure

```json
{
  "title": "Mount",
  "point_value": 4,
  "position_type": "Offensive",
  "risk_level": "Low",
  "energy_cost": "Medium",
  "transitions": {
    "offensive": [
      {
        "name": "Armbar from Mount",
        "target": "Armbar Control",
        "success_rate": {
          "beginner": 50,
          "intermediate": 70,
          "advanced": 85
        }
      }
    ]
  }
}
```

### Transition Data Structure

```json
{
  "name": "Hip Bump Sweep",
  "starting_state": "Closed Guard Bottom",
  "ending_state": "Mount",
  "success_probability": {
    "beginner": 50,
    "intermediate": 70,
    "advanced": 85
  },
  "execution_complexity": "Low",
  "energy_cost": "Low",
  "physical_requirements": {
    "strength": "Low",
    "flexibility": "Low",
    "coordination": "Medium",
    "speed": "Medium"
  }
}
```

---

## Build Performance

| Metric | Value |
|--------|-------|
| Cold build | ~15 seconds |
| Incremental rebuild | ~500ms |
| Total pages | 267+ |
| SPA navigation | Instant |

---

## External Resources

- **Quartz Documentation**: https://quartz.jzhao.xyz/
- **PostHog Analytics**: https://us.posthog.com/project/236155
- **Live Site**: https://bjjgraph.org
