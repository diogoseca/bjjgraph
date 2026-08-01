# BJJGraph Architecture

## JSON-First Content Pipeline

BJJGraph transforms structured JSON into a static site:

```
content/*.json  →  templates/*.md.jinja2  →  content/*.md  →  Quartz Build  →  Cloudflare Pages
    (SOURCE)          (TEMPLATES)              (GENERATED)       (BUILD)         (DEPLOY)
```

### Pipeline Components

1. **JSON Source Files** (`content/`)
   - `content/Positions/*.json` - Individual position state data (85+ files)
   - `content/Transitions/*.json` - Individual transition technique data (1000+ files)
   - `content/Submissions/*.json` - Individual submission data (150+ files)

2. **JSON Schemas + Jinja2 Templates** (`templates/`)
   - `templates/Positions/TEMPLATE-*.json` - Position schema definitions
   - `templates/Transitions/TEMPLATE-DUAL.json` - Transition schema
   - `templates/Submissions/TEMPLATE-DUAL.json` - Submission variant schema
   - `templates/Submissions/TEMPLATE-FAMILY.json` - Submission family hub schema
   - `templates/**/*.md.jinja2` - Generate markdown + SEO schema markup
   - `templates/Principles.json`, `Systems.json` - Aggregate data files

3. **Generated Markdown** (`content/*.md`)
   - Content pages with YAML frontmatter
   - Path-prefixed wikilinks for internal navigation (e.g., `[[Positions/Mount]]`)
   - Schema.org JSON-LD for SEO

4. **Quartz Build** (`npx quartz build`)
   - Static HTML generation
   - Graph visualization (D3.js)
   - Full-text search (Flexsearch)
   - Component rendering (Preact)

5. **Deploy** - Cloudflare Pages with Lighthouse CI and IndexNow

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
├── Mount.md           # Hub page (visual graph node; data layer has Mount/Top + Mount/Bottom role-nodes)
└── Mount/
    ├── Top.md         # Playing as top (submissions, control)
    └── Bottom.md      # Playing as bottom (escapes, reversals)
```

### Graph Rules (two representations — don't conflate)

**Data model — `graph.json` (role-based state machine):**
- Each position emits **role-nodes** `Mount/Top` and `Mount/Bottom` that **carry the edges** — distinct states (you are in one *or* the other).
- The bare **hub** entry (`Mount`) only aggregates flashcards and has **no edges**. Neutral positions (Standing/Clinch) are a single node; `game-over` is the terminal sink.

**Rendered graph — `globalGraphLayout.json` (visual projection):**
- **Collapses positions to hub nodes** (Top/Bottom merged) to prevent on-screen redundancy — this is the only sense in which "hub pages are the graph nodes." The state machine itself runs on role-nodes.

See CLAUDE.md → "Graph Topology — canonical model & invariants" for the full edge/direction/sink contract.

---

## Transition & Submission "Playing As" Model

Transitions and Submissions follow the same hub-and-role pattern as Positions, using **Attacker/Defender** instead of Top/Bottom.

### Structure

```
Transition (Hub Page)         = Technique overview, outcomes, both perspectives
├── Attacker (Role Page)      = Executing the technique (setup, steps, counters)
└── Defender (Role Page)      = Defending against it (recognition, escapes, options)
```

### File Organization

```
Transitions/
├── Armbar from Mount.md           # Hub page (canonical graph node)
└── Armbar from Mount/
    ├── Attacker.md                # Execution perspective
    └── Defender.md                # Defense perspective

Submissions/
├── Rear Naked Choke.md            # Hub page with safety info
└── Rear Naked Choke/
    ├── Attacker.md                # Finishing mechanics
    └── Defender.md                # Escape paths, recognition
```

### Graph Rules (Transitions & Submissions)

- **Each Transition/Submission splits into role-nodes (v1.48.0+)**, mirroring positions' Top/Bottom: an edgeless `<slug>` **hub** (flashcard aggregator), `<slug>/attacker` (outcomes/successRate as authored), and `<slug>/defender` (the SAME exchange role-flipped: outcome roles flipped, results re-perspectived, `successRate = 100 − attacker`). The data layer is thus a fully role-typed alternating game; the **visual layer stays hub-collapsed** (`globalGraphLayout.json` = one node/technique with an `[attacker, defender]` strength pair). `validate_graph` asserts the pairing + edgeless hub + successRate complement.
- **`outcomes[]` are the outgoing edges (on the role-nodes)** — `success | failure | counter`, summing to 100; each `to` resolves to a position **role-node**, a real **submission**, or **`game-over`** (never a bare hub or family hub). The defender node's `to` targets are the attacker's, role-flipped.
- **Submission success → `game-over`** (the single sink); only submissions reach it. `is_family: true` hubs are aggregators with **no** edges (not graph nodes).
- **`targets_outcome`** links role-specific actions to specific entries in `outcomes[]`.

### Transition JSON Structure

Source JSON in `content/Transitions/*.json`:

```json
{
  "name": "Armbar from Mount",
  "from_position": "Mount/Top",
  "outcomes": [
    {"to": "Armbar Control/Top", "probability": 55, "result": "success"},
    {"to": "Mount/Top", "probability": 30, "result": "failure"},
    {"to": "Closed Guard/Bottom", "probability": 15, "result": "counter"}
  ]
}
```

Attacker/Defender content (execution steps, counters, defensive options) is **generated by Jinja2 templates**, not stored in the source JSON.

### Submission Differences

Submissions use the same attacker/defender pattern with additions:
- `outcomes[]` is **required on executable submission variants** (the graph nodes — e.g. `Armbar from Mount`), which must have probabilistic outcomes. **Family hubs** (`is_family: true`, e.g. `Armbar`) are aggregator pages, **not** graph nodes, and have **no** `outcomes` — their variants carry them. `validate_graph_integrity.py` therefore exempts `is_family` files from the outcomes check.
- `safety_considerations` stays at **hub level** (shared between roles)
- Defender has `escape_paths[]` (submission-specific escape routes)

---

## Quartz Configuration

### Core Files

| File | Purpose |
|------|---------|
| `source/quartz.config.ts` | Site configuration, theme, analytics |
| `source/quartz.layout.ts` | Component placement |
| `source/quartz/components/` | Preact UI components |
| `source/quartz/plugins/` | Content transformers and emitters |

### Forward Components development library

The Neural interface has a standalone, no-auth development catalog that does not boot the
production game runtime:

- `/dev/components/` inventories reusable primitives, HUD, graph, decision, study, explorer,
  dossier, overlay, and feedback components with state variants.
- `/dev/screens/` composes those building blocks into deterministic gameplay states from boot
  through roll end, plus study, explorer, settings, onboarding, and responsive stress cases.
- Both routes share source-controlled fixtures, renderers, and design tokens in `forward/`.
- Viewport controls cover fluid, 320px, phone, 400x875, tablet, desktop, and short-landscape
  containers. Selection, viewport, and variant are permalinked in the URL hash.
- The detail model is represented explicitly as collapsed landing detail, expanded dossier
  detail, and SEO/AI text projections rather than separate competing content sources.

`npm run build:forward` copies the artifact into `source/public/dev/`. The normal
`npm run build` command runs this after Quartz so the routes survive the output-directory reset.

### Key Configuration

```typescript
// quartz.config.ts
const config: QuartzConfig = {
  configuration: {
    pageTitle: "BJJ Graph",
    enableSPA: true,              // Single-page app navigation
    enablePopovers: true,         // Hover previews for links
    analytics: {
      provider: "posthog",        // PostHog analytics
    },
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
      { "name": "Armbar from Mount", "attempt_probability": 25 },
      { "name": "Cross Collar Choke", "attempt_probability": 20 },
      { "name": "Transition to Back Control", "attempt_probability": 30 },
      { "name": "Maintain Mount", "attempt_probability": 25 }
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
      { "name": "Elbow Escape", "attempt_probability": 35 },
      { "name": "Upa Escape", "attempt_probability": 25 },
      { "name": "Hip Escape", "attempt_probability": 30 },
      { "name": "Frame and Survive", "attempt_probability": 10 }
    ]
  }
}
```

**Validation rules:**
- `attempt_probability` values MUST sum to 100% per role
- Each `name` must reference an existing Transition by name

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

The `game-over` page (`content/game-over.md`) is a sink node representing match end via submission. This replaces the previous `Won by Submission` / `Lost by Submission` architecture.

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

**Submissions** (in `content/Submissions/`) are state machine nodes with educational content. They contain:
- Safety protocols (injury risks, tap signals, release protocol)
- Execution steps and training progressions
- Position-specific variations

**Transitions** (in `content/Transitions/`) are state machine edges. They carry:
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
