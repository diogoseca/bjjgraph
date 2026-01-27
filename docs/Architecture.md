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

BJJ Graph content represents a probabilistic state machine with **transitions as first-class nodes**:

```
Position ──[attempt %]──> Transition ──[outcome %]──> Position/Transition/Submission
```

- **Positions** = States (nodes) with Top/Bottom roles
- **Transitions** = Technique nodes with probabilistic outcomes
- **Terminal State** = `game-over` (single sink node for all submissions)

### Graph Architecture

The graph uses a **Position-Transition-Position** model:

1. From a Position (with role), you can **attempt** various Transitions
2. Each Transition has multiple possible **outcomes** based on success/failure/counter
3. Outcomes lead to other Positions, Transitions, or terminal state

This models the reality of BJJ: attempting a technique doesn't guarantee a specific result.

### Position Data Structure

Positions define available transitions per role with attempt probabilities:

```json
{
  "name": "Mount",
  "top": {
    "state_properties": {
      "point_value": 4,
      "position_type": "Offensive/Controlling",
      "risk_level": "Low",
      "energy_cost": "Low"
    },
    "transitions": [
      { "transition": "Armbar from Mount", "attempt_probability": 25 },
      { "transition": "Cross Collar Choke", "attempt_probability": 20 },
      { "transition": "Transition to Back Control", "attempt_probability": 30 },
      { "transition": "Maintain Mount", "attempt_probability": 25 }
    ]
  },
  "bottom": {
    "state_properties": {
      "point_value": -4,
      "position_type": "Defensive",
      "risk_level": "High",
      "energy_cost": "High"
    },
    "transitions": [
      { "transition": "Elbow Escape", "attempt_probability": 35 },
      { "transition": "Upa Escape", "attempt_probability": 25 },
      { "transition": "Hip Escape", "attempt_probability": 30 },
      { "transition": "Frame and Survive", "attempt_probability": 10 }
    ]
  }
}
```

**Validation rules:**
- `attempt_probability` values MUST sum to 100% per role
- Each `transition` must reference an existing Transition by name

### Transition Data Structure

Transitions are technique nodes with probabilistic outcomes:

```json
{
  "name": "Armbar from Mount",
  "from_position": "Mount/Top",
  "execution_complexity": "Medium",
  "energy_cost": "Medium",
  "physical_requirements": {
    "strength": "Low",
    "flexibility": "Medium",
    "coordination": "High",
    "speed": "Medium"
  },
  "outcomes": [
    { "to": "Armbar Control", "probability": 55, "result": "success" },
    { "to": "Mount", "probability": 30, "result": "failure" },
    { "to": "Closed Guard", "probability": 15, "result": "counter" }
  ]
}
```

**Validation rules:**
- `from_position` format: `"Position/Role"` (e.g., `"Mount/Top"`, `"Closed Guard/Bottom"`)
- `outcomes` probability values MUST sum to 100%
- `result` must be one of: `success`, `failure`, `counter`
- `to` can be: Position name, Transition name, or `"game-over"`

### Outcome Result Types

| Result | Description | Example |
|--------|-------------|---------|
| `success` | Technique achieves intended goal | Armbar from Mount -> Armbar Control |
| `failure` | Technique fails, position maintained or regressed | Armbar from Mount -> Mount (stay) |
| `counter` | Opponent successfully counters | Armbar from Mount -> Closed Guard (escaped) |

### Terminal State

All submission finishes connect to `game-over`, the single terminal state:

```json
{
  "name": "Armbar Finish",
  "from_position": "Armbar Control/Top",
  "outcomes": [
    { "to": "game-over", "probability": 70, "result": "success" },
    { "to": "Armbar Control", "probability": 20, "result": "failure" },
    { "to": "Closed Guard", "probability": 10, "result": "counter" }
  ]
}
```

The `game-over` page (`source/content/game-over.md`) is a sink node representing match end via submission. This replaces the previous `Won by Submission` / `Lost by Submission` architecture.

### Transition Types (Submission Modeling)

Transitions model three distinct types of technique attempts. The type determines the outcome structure:

#### Type A: Direct Submissions

No intermediate control position. The technique either finishes or fails immediately.

```
Position/Top → [Direct Submission] → game-over (success) / Position (failure) / Position (counter)
```

**Examples:** Americana from Mount, Ezekiel from Mount, Cross Collar Choke, Wristlock

```json
{
  "name": "Americana from Mount",
  "from_position": "Mount/Top",
  "outcomes": [
    { "to": "game-over", "probability": 55, "result": "success" },
    { "to": "Mount", "probability": 30, "result": "failure" },
    { "to": "Half Guard", "probability": 15, "result": "counter" }
  ]
}
```

#### Type B: Submission Setups (Two-Step)

A distinct control position exists between the setup and the finish. Two transitions are needed:

```
Position/Top → [Setup] → Control Position → [Finish] → game-over
```

**Examples:** Armbar (→ Armbar Control → Armbar Finish), Triangle (→ Triangle Control → Triangle Finish), Omoplata, RNC, Bow and Arrow

```json
// Step 1: Setup transition
{
  "name": "Armbar from Mount",
  "from_position": "Mount/Top",
  "outcomes": [
    { "to": "Armbar Control", "probability": 55, "result": "success" },
    { "to": "Mount", "probability": 30, "result": "failure" },
    { "to": "Closed Guard", "probability": 15, "result": "counter" }
  ]
}

// Step 2: Finish transition (separate file)
{
  "name": "Armbar Finish",
  "from_position": "Armbar Control/Top",
  "outcomes": [
    { "to": "game-over", "probability": 70, "result": "success" },
    { "to": "Armbar Control", "probability": 20, "result": "failure" },
    { "to": "Closed Guard", "probability": 10, "result": "counter" }
  ]
}
```

#### Type C: Positional Control Tools

Grip-based or entanglement techniques that force transitions but don't directly threaten submission. These **never** have `game-over` in their outcomes.

```
Inferior Position → [Control Tool] → Better Position (success) / Same Position (failure)
```

**Examples:** Kimura Trap from Bottom, Lockdown from Half Guard, Overhook from Closed Guard

```json
{
  "name": "Kimura Trap from Bottom",
  "from_position": "Mount/Bottom",
  "outcomes": [
    { "to": "Kimura Trap", "probability": 60, "result": "success" },
    { "to": "Mount", "probability": 25, "result": "failure" },
    { "to": "Half Guard", "probability": 15, "result": "counter" }
  ]
}
```

### Submissions vs Transitions

**Submissions** (in `source/content/Submissions/`) are educational reference pages, NOT state machine nodes. They contain:
- Safety protocols (injury risks, tap signals, release protocol)
- Execution steps and training progressions
- Position-specific variations

**Transitions** (in `source/content/Transitions/`) are state machine edges. They carry:
- `from_position` (where the technique starts)
- `outcomes[]` (probabilistic results)
- `success_rates` (beginner/intermediate/advanced)

The same technique can exist as both a Transition and a Submission. The Transition carries the game engine data; the Submission carries the educational content. When they overlap, the **Transition's `success_rates` are authoritative** for the state machine.

### Naming Rules

- Position-dependent techniques MUST include the starting position: `"Americana from Mount"`, `"Armbar from Guard"`, NOT just `"Americana"`
- `from_position` MUST use `"Position/Role"` format: `"Mount/Top"`, `"Closed Guard/Bottom"`
- `outcomes[].to` references existing Position names or `"game-over"`
- Only Type A (direct submissions) may have `"game-over"` in outcomes

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
