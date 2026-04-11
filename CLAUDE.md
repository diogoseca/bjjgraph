# BJJGraph - AI Development Guide

BJJ knowledge graph and state machine as a static site. **Site:** https://bjjgraph.org | **Repo:** https://github.com/diogoseca/bjjgraph

---

## 1. AI WORKFLOW (MANDATORY)

### Step 1: Read Documentation (In Order)

```
1. CLAUDE.md          ← You are here
2. docs/Architecture.md   ← JSON pipeline, Position model
3. docs/Content.md        ← Standards, validation rules
4. docs/SEO.md            ← Schema markup, keywords, analytics
```

### Step 2: Ask Critical Questions

Before starting any task, clarify:

| Question | Why It Matters |
|----------|----------------|
| **Scope** | What files/systems does this touch? |
| **Context** | What existing patterns should I follow? |
| **Constraints** | What must NOT change? |
| **Success** | How will we verify this worked? |

### Step 3: Deploy Subagents

Match task to engineering personality, then deploy parallel or sequential:

| Personality | Best For | Example Tasks |
|-------------|----------|---------------|
| **Systematic Migrator** | Repetitive, pattern-following | Bulk content updates, format changes |
| **Complexity Handler** | Multi-step logic, debugging | Validation errors, template fixes |
| **Infrastructure Specialist** | CI/CD, deployment, performance | GitHub Actions, build optimization |
| **Ruthless Editor** | Documentation, DRY, deletion | Consolidate docs, remove dead code |
| **Paranoid Tester** | Edge cases, validation | Schema validation, error handling |
| **Architect** | System design, refactoring | New features, structural changes |

**Parallel:** Independent tasks (audit multiple files, run multiple checks)
**Sequential:** Dependent tasks (validate → fix → regenerate → build)

### Step 4: Update Documentation

Follow **C-UD pattern** after completing work:
- **Create** new docs only if essential (prefer updating existing)
- **Update** existing docs with new learnings
- **Delete** outdated information immediately

---

## 2. FORBIDDEN ACTIONS

### Never Do These

| Action | Why | Do Instead |
|--------|-----|------------|
| Edit generated `.md` in `content/` | Overwrites on regeneration | Edit `.json` source in `content/` (data) or templates in `templates/` (schemas/Jinja2) |
| Skip validation before commits | Breaks build, bad data | Run `npm run regenerate:build` |
| Create files >1000 lines | Unmaintainable | Split into focused modules |
| Add docs without updating index | Orphaned content | Update relevant README/index |
| Commit secrets or API keys | Security breach | Use `.env` files, check `.gitignore` |
| Guess at wikilink targets | Broken links | Verify file exists first |
| Add emojis to content files | Inconsistent styling | Only use in docs if necessary |

### File Size Limits

- **Code files:** <500 lines preferred, <1000 max
- **Documentation:** <300 lines preferred
- **JSON source files:** No limit (data files)

---

## 3. PROJECT STRUCTURE

```
bjjgraph/
├── CLAUDE.md                    # AI workflow (this file)
├── README.md                    # Quick start for contributors
├── graph.json                   # Generated graph data for visualization
├── content/                     # JSON source + generated markdown
│   ├── Positions/               # 85+ positions (*.json = SOURCE, *.md = GENERATED)
│   ├── Transitions/             # 1000+ transitions (*.json = SOURCE, *.md = GENERATED)
│   ├── Submissions/             # 150+ submissions (*.json = SOURCE, *.md = GENERATED)
│   ├── Systems/                 # Expert systems
│   ├── Learning/                # Strategy, training, competition articles
│   └── Principles/              # Fundamental principles
├── templates/                   # JSON schemas + Jinja2 templates
│   ├── Positions/               # TEMPLATE-*.json schemas + *.md.jinja2 templates
│   ├── Transitions/             # TEMPLATE-*.json schemas + *.md.jinja2 templates
│   ├── Submissions/             # TEMPLATE-*.json schemas + *.md.jinja2 templates
│   ├── Principles.json          # Principles data
│   ├── Systems.json             # Systems data
│   ├── Learning.json            # Learning article schema
│   ├── Learning.md.jinja2       # Learning article template
│   ├── Transitions.json         # Hub page transition data
│   ├── Submissions.json         # Hub page submission data
│   └── votes.json               # Community voting data
├── docs/
│   ├── Architecture.md          # JSON pipeline, Position model
│   ├── Content.md               # Standards, validation rules
│   └── SEO.md                   # Schema markup, keywords, analytics
├── scripts/
│   ├── validate_json.py         # JSON schema validation
│   ├── validate_graph_integrity.py  # Graph consistency checks
│   ├── regenerate_content_json.py   # Auto-fill TODOs in JSON
│   ├── regenerate_md_from_json.py   # Regenerate markdown from JSON
│   ├── regenerate_category_hub_pages.py  # Generate category hub pages
│   ├── regenerate_graph.py      # Generate graph.json
│   ├── regenerate_votes.py      # Generate voting data
│   ├── explode_graph_connections.py  # Expand graph connections
│   ├── regenerate_list_of_content_files_to_fix.sh  # List files needing fixes
│   └── select_oldest_files.sh   # File selection for bot
├── branding/                    # Brand assets and icons
├── source/                      # Quartz code only (MIT)
│   ├── quartz/                  # Static site generator components
│   ├── quartz.config.ts
│   └── ...
├── tests/
│   └── artifacts/               # Validation reports, status files
└── .github/
    └── workflows/
        └── content-improvement-bot.yml  # Daily content automation
```

**Key Insight:** `content/*.json` is SOURCE data. `content/*.md` is GENERATED output. `templates/` has schemas + Jinja2 templates.

---

## 4. ARCHITECTURE

### JSON-First Pipeline

```
content/*.json  →  templates/*.md.jinja2  →  content/*.md  →  Quartz Build  →  Static Site
    (SOURCE)          (TEMPLATES)              (GENERATED)       (BUILD)        (OUTPUT)
```

1. **JSON Source** - Structured data in `content/Positions/*.json`, `content/Transitions/*.json`, etc.
2. **Jinja2 Templates** - In `templates/`, generate markdown + SEO schema markup
3. **Generated Markdown** - Content pages with frontmatter in `content/*.md`
4. **Quartz Build** - Static site with graph visualization, search, backlinks
5. **Deploy** - Cloudflare Pages with Lighthouse CI and IndexNow

### Graph Data Model

The BJJ knowledge graph uses a **Position-Transition-Position** architecture where both positions and transitions are nodes:

```
Position ──[attempt %]──> Transition ──[outcome %]──> Position/Submission
```

**Key concepts:**

- **Positions** are states (nodes) with roles (Top/Bottom)
- **Transitions** are technique nodes with probabilistic outcomes
- **Outcomes** lead to other positions, transitions, or terminal states
- **Terminal state**: `game-over` (single page for all submission finishes)

### Position "Playing As" Model

Positions follow a chess-like architecture:

```
Position (Hub Page)     = Board state (e.g., "Mount")
├── Top (Role Page)     = Playing as White (maintain, submit)
└── Bottom (Role Page)  = Playing as Black (escape, reverse)
```

**Graph nodes are hub pages only** - Top/Bottom excluded to prevent redundancy.

**File structure example:**
```
Positions/
├── Mount.md           # Hub page (canonical graph node)
└── Mount/
    ├── Top.md         # Playing as top (submissions, control)
    └── Bottom.md      # Playing as bottom (escapes, reversals)
```

### Position Schema

Each position role (Top/Bottom) has a `transitions` array specifying what techniques can be attempted:

```json
{
  "top": {
    "transitions": [
      { "name": "Armbar from Mount", "attempt_probability": 25 },
      { "name": "Cross Collar Choke", "attempt_probability": 20 },
      { "name": "Transition to Back Control", "attempt_probability": 30 },
      { "name": "Maintain Mount", "attempt_probability": 25 }
    ]
  }
}
```

**Rules:**
- `attempt_probability` values MUST sum to 100% per role
- Each `name` references a Transition by name
- Represents likelihood of attempting each technique from position

### Transition & Submission "Playing As" Model

Transitions and Submissions follow the same hub + role architecture as Positions, using **Attacker/Defender** roles:

```
Transition (Hub Page)    = Technique state (e.g., "Armbar from Mount")
├── Attacker (Role Page) = Executing the technique (setup, steps, counters)
└── Defender (Role Page)  = Resisting/escaping (recognition, defense, escapes)
```

**Graph nodes are hub pages only** - Attacker/Defender excluded from graph.

**File structure example:**
```
content/Transitions/
├── Armbar from Mount.json   # Source JSON (outcomes, from_position)
├── Armbar from Mount.md     # Generated hub page
└── Armbar from Mount/
    ├── Attacker.md          # Generated attacker perspective
    └── Defender.md          # Generated defender perspective
```

Attacker/Defender sections are **generated by templates**, not stored in the source JSON.

**Templates:**
- `templates/Transitions/TEMPLATE-DUAL.json` — JSON schema
- `templates/Transitions/TEMPLATE-DUAL.md.jinja2` — Hub page template
- `templates/Transitions/TEMPLATE-ATTACKER.md.jinja2` — Attacker template
- `templates/Transitions/TEMPLATE-DEFENDER.md.jinja2` — Defender template
- Same structure in `templates/Submissions/` + `TEMPLATE-FAMILY.json` / `TEMPLATE-FAMILY.md.jinja2` for family hubs

### Transition Schema

Transitions are technique nodes with `from_position` and `outcomes`:

```json
{
  "name": "Armbar from Mount",
  "from_position": "Mount/Top",
  "outcomes": [
    { "to": "Armbar Control/Top", "probability": 55, "result": "success" },
    { "to": "Mount/Top", "probability": 30, "result": "failure" },
    { "to": "Closed Guard/Top", "probability": 15, "result": "counter" }
  ]
}
```

Attacker/Defender content (execution steps, counters, defensive options) is **generated by Jinja2 templates**, not stored in the source JSON.

**Rules:**
- `from_position` format: "Position/Role" (e.g., "Mount/Top", "Closed Guard/Bottom")
- `outcomes` probability values MUST sum to 100%
- `result` types: `success` (technique works), `failure` (technique fails, stay/regress), `counter` (opponent counters)
- `to` can be a Position, another Transition, or `game-over`

### Terminal State

All submissions implicitly connect to `game-over`, the single terminal state page:

```
Submission Control Position → Submission Finish Transition → game-over
```

The `game-over` page (`content/game-over.md`) is a sink node - once reached, the match ends. This replaces the previous `Won by Submission` / `Lost by Submission` split.

### Training System (SRS)

Client-side spaced repetition system using SM-2 algorithm. All data stored in localStorage (no backend).

**Terminology — Cards vs Techniques:**
- A **technique** = one transition or submission (e.g., "Armbar from Mount"). Each technique has multiple flashcards (Q&A pairs) in its `flashcards` array.
- An **SRS card** = one technique. There is exactly one card per technique name. The SM-2 algorithm tracks the technique as a unit, not individual flashcards.
- When reviewing a technique, the user sees random flashcards from its pool. After rating (Again/Hard/Easy), the entire technique's SRS metrics update.

**Field name:** Source JSON uses `flashcards` across all content types. Role-nested where roles exist (`top.flashcards`, `bottom.flashcards`, `attacker.flashcards`, `defender.flashcards`). Principles and Systems have a single top-level `flashcards` array.

**Daily Goal:** Single capacity number (default 30). Due reviews fill first, remaining slots are new technique suggestions selected by graph connectivity scoring.

**"Memorized"** = techniques NOT due today (`allCards.length - dueCards.length`). Includes both upcoming and mastered cards.

**Per-flashcard mastery:** Each SRS card has a `flashcardsMastered: number[]` field tracking which flashcard indices were answered correctly (Hard/Easy). Mastery % = `flashcardsMastered.length / flashcards.length`. One correct answer = mastered for that flashcard.

**Dashboard layout (4 sections):**
1. **Hero** — Completion banner + Start/Continue session button + progress bar + streak
2. **Known Techniques** — Unified grouped list (Due Today / Reviewing / Mastered) with per-question mastery %, replaces old Coverage + Due + Upcoming + Mastered + Journey sections
3. **Discover** — Smart suggestions + search to add new techniques
4. **Settings** — Collapsible (opponent attacks, daily goal)

**Key files:**
- `source/quartz/components/scripts/srs.ts` — SRS card storage, SM-2 algorithm, localStorage `bjj-srs-cards`
- `source/quartz/components/scripts/settings.ts` — Settings (`bjj-settings`), daily progress (`bjj-daily-progress`), streaks (`bjj-streak`)
- `source/quartz/components/scripts/trainingDashboard.inline.ts` — Dashboard UI, session queue, graph-based suggestions
- `source/quartz/components/TrainingDashboard.tsx` — Dashboard HTML structure
- `source/quartz/components/scripts/topBar.inline.ts` — Homepage summary bar + desktop TopBar due count

### Graph Component

Interactive knowledge graph visualization using PixiJS (WebGL) + D3.js force simulation.

**Key behaviors:**
- **Views**: Local (sidebar, depth-1) and global (Ctrl+G modal, all nodes) are mutually exclusive
- **Touch**: Pinch-zoom and drag work via D3's built-in gesture handling
- **Performance**: Default is fast settling; use `?graph=legacy` for old slow animation
- **Cleanup**: Properly destroys WebGL context, stops simulation, and clears tweens on navigation

**Key files:**
- `source/quartz/components/scripts/graph.inline.ts`
- `source/quartz/components/styles/graph.scss`

---

## 5. COMMANDS

### npm Scripts (Root package.json)

All commands run from the repo root (`bjjgraph/`):

| Command | Description |
|---------|-------------|
| `npm run validate:json` | Validate JSON schemas |
| `npm run validate:graph` | Validate graph integrity |
| `npm run regenerate:issues` | List content files needing fixes |
| `npm run regenerate:json` | Fix/enrich JSON content with Claude AI |
| `npm run regenerate:explode` | Expand graph connections |
| `npm run regenerate:md` | Regenerate markdown from JSON |
| `npm run regenerate:hubs` | Generate category hub pages |
| `npm run regenerate:votes` | Generate community voting data |
| `npm run regenerate:graph` | Generate graph.json |
| `npm run regenerate` | Run all 7 steps: issues → json → explode → md → hubs → votes → graph |
| `npm run build` | Build static site (~10 min, 4287 files) |
| `npm run regenerate:build` | Regenerate + build (full workflow) |
| `npm run dev` | Build then serve locally on port 8080 |
| `npm run proofread` | Recurring LLM audit of graph edges + probabilities via Claude CLI. Intermittent use only — one Claude call per file, ~25 hours for full corpus at default 60s interval. Not part of `regenerate`. Use `--file`, `--category`, `--max-files` to scope, or `--batch` to skip the delay. |

### Quartz Scripts (source/package.json)

Run from `source/` directory:

```bash
cd source && npm run check   # Type checking (tsc + prettier)
cd source && npm run format  # Format code with prettier
cd source && npm run test    # Run path and depgraph tests
```

### Content Workflow

```bash
# 1. Edit JSON source
vim content/Positions/Mount.json

# 2. Validate and regenerate all content
npm run regenerate

# 3. Test build with dev server
npm run dev

# 4. Commit
git add . && git commit -m "Update position data"
```

### Versioning (root package.json)

Format: `1.MAJOR.MINOR`

- **MAJOR bump** (1.X.0): New features (e.g., 1.3.0 → 1.4.0)
- **MINOR bump** (1.X.Y): Fixes (e.g., 1.4.0 → 1.4.1)
- Always bump version when committing work
- **MANDATORY:** At the end of every workload, bump the version before committing:
  - Bug fix / dependency update / cleanup → MINOR bump (1.5.4 → 1.5.5)
  - New feature / structural change → MAJOR bump (1.5.4 → 1.6.0)
- **Commit message format:** `v1.X.Y - Description of changes`

### Pre-Commit Checklist

```bash
npm run regenerate:build      # Full validation, generation, and build
cd source && npm run check    # Type checking must pass
# Bump version in package.json (MINOR for fixes, MAJOR for features)
```

---

## 6. CONTENT BOT

**Location:** `.github/workflows/content-improvement-bot.yml`

### What It Does

- Runs daily at 8:00 AM UTC
- Improves 2 files per run (JSON-first priority)
- Uses Claude API with full context pre-loaded
- Creates PRs with validation reports

### Bot Workflow

```
SELECT (git age, JSON-first)
  → VALIDATE (schema check)
  → IMPROVE (Claude API fills TODOs, fixes errors)
  → VALIDATE + RETRY (max 3 attempts)
  → REGENERATE (regenerate_md_from_json.py)
  → CREATE PR
```

### What Bot Handles

- Fills TODOs in JSON source files
- Fixes validation errors (success rates, wikilinks, missing sections)
- AI SEO optimization (question headings, front-loaded facts, PAA via DataForSEO)
- Safety sections for submissions
- Entity consistency (canonical names with bold emphasis)

See `.github/workflows/content-improvement-bot.yml` for full details.

## 7. CONTENT STANDARDS (Quick Reference)

### Success Rates

**Format:** `(Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)`

**Rules:**
- Beginner <= Intermediate <= Advanced (strictly enforced)
- All three levels required
- 0-100 integers only
- Typical progression: 10-15% increase per level

### Wikilinks

**Format:** `[[Category/Page Name]]` (path-prefixed)

**Examples:** `[[Positions/Mount]]`, `[[Transitions/Armbar from Mount]]`, `[[Submissions/Rear Naked Choke]]`

**Rules:**
- Must include category path prefix (e.g., `Positions/`, `Transitions/`, `Submissions/`)
- Must match filename exactly (case-sensitive)
- No `.md` extension
- Verify target exists before adding
- **Exception:** `[[game-over]]` uses bare format (no prefix)

### Safety (Submissions Only)

Every submission MUST include:
- Safety Notice section first (with warning)
- Injury risks with severity
- Tap signals documented
- Release protocol
- Safety-critical questions in assessment

---

## 8. RESOURCES

### Project Links

| Resource | URL |
|----------|-----|
| **Live Site** | https://bjjgraph.org |
| **Repository** | https://github.com/diogoseca/bjjgraph |
| **Quartz Docs** | https://quartz.jzhao.xyz/ |

### Schema Validation

| Tool | URL |
|------|-----|
| Google Rich Results Test | https://search.google.com/test/rich-results |
| Schema.org Validator | https://validator.schema.org/ |

### PostHog Analytics

| Dashboard | URL |
|-----------|-----|
| Project Home | https://us.posthog.com/project/236155 |
| Content Performance | https://us.posthog.com/project/236155/dashboard/611436 |
| Navigation Patterns | https://us.posthog.com/project/236155/dashboard/611437 |
| Traffic Sources | https://us.posthog.com/project/236155/dashboard/611439 |
| User Analytics | https://us.posthog.com/project/236155/dashboard/610768 |
| Feature Flags | https://us.posthog.com/project/236155/feature_flags |

### Documentation References

| Doc | Purpose |
|-----|---------|
| `docs/Architecture.md` | JSON pipeline, Position model |
| `docs/Content.md` | Full content standards, validation rules |
| `docs/SEO.md` | Schema markup, keywords, analytics setup |

### Deployment

- **Hosting**: Cloudflare Pages
- **CI**: Lighthouse CI + IndexNow search submission
- **Workflow**: `.github/workflows/deploy.yaml`

---

*This guide is for AI assistants. Focus on: validate → edit JSON → regenerate → build.*
