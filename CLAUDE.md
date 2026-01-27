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
| Edit generated `.md` in `content/` | Overwrites on regeneration | Edit `.json` source in `templates/` |
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
├── PARTNERS.md                  # Partnership & sponsorship info
├── docs/
│   ├── Architecture.md          # JSON pipeline, Position model
│   ├── Content.md               # Standards, validation rules
│   └── SEO.md                   # Schema markup, keywords, analytics
├── scripts/
│   ├── validate_json.py         # JSON schema validation
│   ├── regenerate_md_from_json.py            # Regenerate markdown from JSON
│   ├── regenerate_content_json.py           # Auto-fill TODOs in JSON
│   └── select_oldest_files.sh   # File selection for bot
├── source/
│   ├── content/                 # Generated markdown (DO NOT EDIT DIRECTLY)
│   │   ├── Positions/           # 95 position pages
│   │   ├── Transitions/         # 71 transition pages
│   │   ├── Submissions/         # 49 submission pages
│   │   └── CONTRIBUTING-YAML-SCHEMA.md  # Complete schema reference
│   ├── templates/               # JSON source + Jinja2 templates
│   │   ├── Positions.json       # Position data (EDIT THIS)
│   │   ├── Transitions.json     # Transition data (EDIT THIS)
│   │   ├── Submissions.json     # Submission data (EDIT THIS)
│   │   └── *.md.jinja2          # Template files
│   └── quartz/                  # Static site generator components
├── tests/
│   └── artifacts/               # Validation reports, status files
└── .github/
    └── workflows/
        └── content-improvement-bot.yml  # Daily content automation
```

**Key Insight:** `source/content/` is OUTPUT. `source/templates/*.json` is SOURCE.

---

## 4. ARCHITECTURE

### JSON-First Pipeline

```
source/templates/*.json  →  *.md.jinja2  →  source/content/*.md  →  Quartz Build  →  Static Site
        (SOURCE)              (TEMPLATES)         (GENERATED)           (BUILD)        (OUTPUT)
```

1. **JSON Source** - Structured data in `Positions.json`, `Transitions.json`, etc.
2. **Jinja2 Templates** - Generate markdown + SEO schema markup
3. **Generated Markdown** - Content pages with frontmatter
4. **Quartz Build** - Static site with graph visualization, search, backlinks

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
      { "transition": "Armbar from Mount", "attempt_probability": 25 },
      { "transition": "Cross Collar Choke", "attempt_probability": 20 },
      { "transition": "Transition to Back Control", "attempt_probability": 30 },
      { "transition": "Maintain Mount", "attempt_probability": 25 }
    ]
  }
}
```

**Rules:**
- `attempt_probability` values MUST sum to 100% per role
- Each transition references a Transition by name
- Represents likelihood of attempting each technique from position

### Transition Schema

Transitions are technique nodes with `from_position` and `outcomes`:

```json
{
  "name": "Armbar from Mount",
  "from_position": "Mount/Top",
  "outcomes": [
    { "to": "Armbar Control", "probability": 55, "result": "success" },
    { "to": "Mount", "probability": 30, "result": "failure" },
    { "to": "Closed Guard", "probability": 15, "result": "counter" }
  ]
}
```

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

The `game-over` page (`source/content/game-over.md`) is a sink node - once reached, the match ends. This replaces the previous `Won by Submission` / `Lost by Submission` split.

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
| `npm run validate` | Validate JSON and list files needing fixes |
| `npm run regenerate:json` | Fix/enrich JSON content with Claude AI |
| `npm run regenerate:md` | Regenerate markdown from JSON |
| `npm run regenerate:hubs` | Generate category hub pages |
| `npm run regenerate:graph` | Generate BJJ graph data |
| `npm run regenerate` | Run all steps (json + validate + md + hubs + graph) |
| `npm run build` | Build static site |
| `npm run regenerate:build` | Regenerate + build (full workflow) |
| `npm run dev` | Development server with live reload |

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
vim source/templates/Positions.json

# 2. Validate and regenerate all content
npm run regenerate

# 3. Test build with dev server
npm run dev

# 4. Commit
git add . && git commit -m "Update position data"
```

### Pre-Commit Checklist

```bash
npm run regenerate:build      # Full validation, generation, and build
cd source && npm run check    # Type checking must pass
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
- AI SEO optimization (question headings, front-loaded facts)
- Safety sections for submissions
- Entity consistency (canonical names with bold emphasis)

## 7. CONTENT STANDARDS (Quick Reference)

### Success Rates

**Format:** `(Success Rate: Beginner X%, Intermediate Y%, Advanced Z%)`

**Rules:**
- Beginner <= Intermediate <= Advanced (strictly enforced)
- All three levels required
- 0-100 integers only
- Typical progression: 10-15% increase per level

### Wikilinks

**Format:** `[[Page Name]]`

**Rules:**
- Must match filename exactly (case-sensitive)
- No `.md` extension
- Verify target exists before adding
- Terminal state: `[[game-over]]` (NOT `Won by Submission` or `Lost by Submission`)

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
| `source/content/CONTRIBUTING-YAML-SCHEMA.md` | Complete YAML schema reference |

---

*This guide is for AI assistants. Focus on: validate → edit JSON → regenerate → build.*
