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

### Plan Format

**Plans must end with a TL;DR paragraph** — a single self-contained summary that captures the plan's intent, scope, and key decisions. It's the lazy-review path: if the user only reads the TL;DR, they should have enough to greenlight or redirect the plan without reading the rest.

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

**Two graph representations (do not conflate them):**
- **Data model — `graph.json` (role-based state machine):** each position emits **role-nodes** `Mount/Top` and `Mount/Bottom` that carry the edges, **plus** a bare `Mount` hub entry that only aggregates flashcards (no edges). The state machine runs on role-nodes — you are in `Mount/Top` *or* `Mount/Bottom`, which are distinct states. (Neutral positions like Standing/Clinch are a single node; `game-over` is the terminal node.)
- **Rendered graph — `globalGraphLayout.json` (visual projection):** **collapses positions to hub nodes** (Top/Bottom merged) to reduce on-screen redundancy. This is the only sense in which "graph nodes are hub pages only" — it describes the *visual* layer, not the data layer.

**File structure example:**
```
Positions/
├── Mount.md           # Hub page (visual graph node; data has Mount/Top + Mount/Bottom role-nodes)
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

**In `graph.json` each Transition/Submission splits into role-nodes (v1.48.0+), mirroring positions' Top/Bottom:** a bare `<slug>` **hub** (edgeless flashcard aggregator), `<slug>/attacker` (the player attempting it — `outcomes`/`successRate` as authored), and `<slug>/defender` (the opponent — the SAME exchange role-flipped: outcome targets' roles flipped, result labels re-perspectived, `successRate = 100 − attacker`). This makes the data layer a fully role-typed alternating game (position-role → technique/attacker → position-role …). The **visual layer stays hub-collapsed** — `globalGraphLayout.json` emits ONE node per technique carrying an `[attacker, defender]` strength pair (same as positions), so the background graph is unchanged. `kimura(from side control/top):attacker` is the node id; the origin is in the slug, the perspective is the suffix.

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

### Graph Topology — canonical model & invariants

The state machine is **bipartite**: position role-nodes point to technique nodes (attempt), technique nodes point back to position role-nodes (outcome).

**Node types (in `graph.json`):**
- **Position role-nodes** (`Mount/Top`, `Mount/Bottom`) — carry edges. Bare **hub** entries (`Mount`) and **`is_family: true` submission hubs** (e.g. `Armbar`) are flashcard/aggregator entries with **no edges** — they are *not* navigable data nodes. Neutral positions are a single node. `game-over` is the terminal.
- **Transition nodes** and **Submission nodes** — technique nodes, **role-split (v1.48.0+)** into an edgeless `<slug>` hub + `<slug>/attacker` (carries the edges) + `<slug>/defender` (the role-flipped mirror). The bare hub and `is_family: true` submission hubs are edgeless aggregators, not navigable data nodes.

**Edge types + direction:**
1. `Position/Role —attempt_probability→ Transition | Submission` (from each role's `transitions[]`; weights sum to 100/role).
2. `Transition —probability, result→ Position/Role | Submission | game-over` (from `outcomes[]`; sum to 100; `result ∈ success|failure|counter`).
3. `Submission —success→ game-over` (the sink).
- `from_position` (surfaced as `fromPosition`/`fromPositionId`/`fromRole`) is the single **origin metadata**, not a second edge. `endingPosition` is a derived copy of the first `success` outcome. `opponentTransitions` (the opposite position role's moves, consumed by the in-browser game's opponent turn) are **derived at render time** in `renderPage.tsx` (`resolveOpponentMoves`) from the canonical role-split nodes — they are **not persisted** in `graph.json` (the build-time mirror was removed in Stage 6, v1.48.2+).

**Invariants (checked by `validate_graph_integrity.py` + the topology audit):**
- A transition has **one canonical origin** and **3–5 outcomes**; a submission's success → `game-over`.
- **`game-over` is the only sink** (out-degree 0). Every `outcome.to` must resolve to a **role-node**, a **real (non-family) submission**, or **`game-over`** — never a bare position hub, a family hub, or a self-loop.
- **Only submissions reach `game-over`** — a transition pointing directly to `game-over` is a misfiled finish (it should advance to a control position).

### Training System (SRS) — embedded UX (v1.20.0+)

Client-side spaced repetition (SM-2) layered onto the always-on background graph. There is **no `/Training` page** — training lives as a persistent strip + two stacked modals + carousel chevrons on every page. All state stays in localStorage (Supabase sync optional).

**Surface (registered in `sharedPageComponents.afterBody`):**
1. **FlashcardsHeader strip** — fixed top, ~36px tall. Context-aware label + ▶ play button.
   - Idle, due > 0: `Flashcards (N due)`
   - Active session: `Session X/Y` (▶ swaps to ◾ stop)
   - Idle, 0 due, has SRS: `All caught up · train more`
   - No SRS cards yet: `Start training`
2. **DecksModal** — opens when user clicks the strip label. Lean: 5 deck rows (Due / Reviewing / Mastered / Suggested / Recently Explored) + sticky bottom CTA `Train Due (N) ▶` (label adapts) + ⚙ in modal header.
3. **SettingsModal** — opens from the ⚙ inside DecksModal, defaults to Flashcards tab. Two tabs: Flashcards (Daily Goal, Show Flashcards on pages) / Game (Game Mode pills, Hard/Ultra locked). Stacks above DecksModal.
4. **SessionChevrons** — fixed prev/next overlays on left/right viewport edges. Visible only when `body[data-training-active]`. Left hidden at index 0; right shows ✓ at last card (click finishes session). ArrowLeft/ArrowRight global keyboard, gated by `isTypingTarget`.
5. **FirstLoadHint** — one-time tooltip pointing at ▶ on first visit. Auto-dismisses after 5s / Esc / any click. `localStorage["bjj-onboarded"]=true` after dismiss.

**Carousel slide:** SPA navigation between cards in a session uses the CSS View Transitions API via `slideNavigate(url, 'forward'|'backward')` in `trainingSession.ts`. CSS keyframes drive a horizontal slide; non-supporting browsers fall back to instant swap. Graph's existing 400ms pan-to-current-node fires in parallel on every nav.

**Active-session focus mode:** While `body[data-training-active]`, non-flashcard article content dims to 0.55 opacity and the `#flashcard-container` gets a subtle pulsing highlight ring. Flashcard reads `session.autoExpand:true` and skips the minimized step, opening directly to the expanded UI with answer revealed.

**Terminology — Cards vs Techniques:**
- A **technique** = one transition or submission (e.g., "Armbar from Mount"). Each has a `flashcards` array of Q&A pairs.
- An **SRS card** = one technique. The SM-2 algorithm tracks the technique as a unit; individual flashcards within it have per-question mastery tracking.

**Field name:** Source JSON uses `flashcards` across all content types. Role-nested where roles exist (`top.flashcards`, `bottom.flashcards`, `attacker.flashcards`, `defender.flashcards`). Principles and Systems have a single top-level `flashcards` array.

**Daily Goal:** Single capacity number (default 30). The default `mixed` session source fills with due reviews first, then graph-derived suggestions to reach the goal.

**Per-flashcard mastery:** Each SRS card has a `flashcardsMastered: number[]` field tracking which flashcard indices were answered correctly. Mastery % = `flashcardsMastered.length / flashcards.length`.

**Session sources (`SessionSource` in `trainingSession.ts`):** `mixed` (default — due + suggestions to dailyGoal), `due`, `reviewing`, `mastered`, `suggested`, `explored` (ad-hoc, does NOT auto-add to SRS).

**Storage keys (unchanged across the v1.20 redesign):**
- localStorage: `bjj-srs-cards`, `bjj-settings`, `bjj-daily-progress`, `bjj-streak`, `bjj-explored`, `bjj-banned-flashcards`, `bjj-journey`, `bjj-onboarded`
- sessionStorage: `training-session` (now with optional `autoExpand` + `source` fields), `training-session-complete`, `snackbar`, `victory-data`

**Keyboard shortcuts (active during session unless typing in an input):**
- `Space` — Show Answer / Reveal Answer (in Flashcard component)
- `1` `2` `3` `4` — Again / Hard / Easy / Skip
- `←` `→` — prev / next flashcard (SessionChevrons)
- `Esc` — close any open modal

**Key files:**
- `source/quartz/components/scripts/trainingSession.ts` — shared session lifecycle (buildSessionQueue, startOrResumeSession, advanceSession, reverseSession, stopSession, completeSession, slideNavigate)
- `source/quartz/components/scripts/srs.ts` — SRS card storage, SM-2 algorithm, `bjj-srs-cards`
- `source/quartz/components/scripts/settings.ts` — `bjj-settings`, `bjj-daily-progress`, `bjj-streak`
- `source/quartz/components/FlashcardsHeader.tsx` + `scripts/flashcardsHeader.inline.ts` — strip UI + label state machine
- `source/quartz/components/DecksModal.tsx` + `scripts/decksModal.inline.ts` — deck overview modal + sticky CTA
- `source/quartz/components/SettingsModal.tsx` + `scripts/settingsModal.inline.ts` — two-tab settings modal
- `source/quartz/components/SessionChevrons.tsx` + `scripts/sessionChevrons.inline.ts` — carousel prev/next + keyboard nav
- `source/quartz/components/FirstLoadHint.tsx` + `scripts/firstLoadHint.inline.ts` — one-time onboarding tooltip
- `source/quartz/components/Flashcard.tsx` + `scripts/flashcard.inline.ts` — per-page Q&A UI (also drives session advancement on Hard/Easy)

**Cloudflare redirect:** `source/quartz/static/_redirects` has `/Training/* / 301` so old inbound links land on home.

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
| `npm run regenerate:graph` | Umbrella: graph-base (graph.json) → graph-layout → graph-strength |
| `npm run regenerate:graph-base` | Generate graph.json only (no layout/strength) |
| `npm run regenerate` | Full pipeline: issues → json → explode → **validate:graph** (gate) → md → hubs → votes → graph → explorer |
| `npm run build` | Build static site (~10 min, 4287 files) |
| `npm run regenerate:build` | Regenerate + build (full workflow) |
| `npm run dev` | Build then serve locally on port 8080 |
| `npm run proofread` | Recurring LLM audit of graph edges + probabilities via Claude CLI. Intermittent use only — one Claude call per file, ~25 hours for full corpus at default 60s interval. Not part of `regenerate`. Use `--file`, `--category`, `--max-files` to scope, or `--batch` to skip the delay. |
| `npm run calibrate:cases` | Build `calibration_cases.json` from the live graph. **Per ruleset (v1.50.0+): emits a `gi` AND a `nogi` case per position role** (`case_id` suffixed `::gi`/`::nogi`); candidates = that role's transitions with their existing outcome skeletons. Regenerable input, gitignored. |
| `npm run calibrate` | **Calibrated probability elicitation (dry-run), per gi/no-gi ruleset.** An expert panel (Danaher, Gordon Ryan, Craig Jones, Roger Gracie, a BJJ-Fanatics generalist), each elicited in a SEPARATE Claude call, estimates occurrence% / success% / outcome-distribution per technique **in BOTH gi and no-gi frames** (ruleset-framed prompts; `ruleset_weight` boosts native-frame experts — Roger↑gi, Danaher/Gordon/Craig↑no-gi). Mechanism-first (which principles attacker leverages vs defender fails to leverage), comparative ranking + anchored to known-% references **shown only for the matching frame**. Aggregates IN CODE (relevance × ruleset × inverse-variance, bootstrap bagging, spread→pseudo-count **hard-capped at 8** — the 5 personas are one correlated LLM (~1.25 effective estimators); submissions / extrapolated / wide-CI entries are forced to the floor (3)), then **de-biases the single-LLM central-tendency compression PER `success_type`** (submission/sweep/pass/takedown/… each get their own inverse fit `true=(elicited-b)/a`, high-side damped, clipped; types with <5 anchors fall back to a global fit, flagged). Anchors come from `calibration_external_anchors.json` (curated + cited tournament research; committed input) with a **held-out** subset that validates out-of-sample. Reports per-band + **per-type leave-one-anchor-out (LOAO) MAE + held-out MAE** (the non-circular gate). Per-ruleset proposals carry `frame_confidence` (gi/no-gi `mirrored` when they agree within noise, else `forked`). Writes `calibration_results.json` + `calibration_proposals.json`; changes nothing else (NB: per-edge ground truth doesn't exist — BJJ records completions, not attempts — so per-technique success% stays an expert prior; external data anchors the de-bias slope + validates aggregates). `--reaggregate` re-runs aggregation+de-bias on existing results with NO Claude calls; `--no-debias` disables the correction. **Launch runbook: `~/calibration-engine.md`.** |
| `npm run calibrate:apply` | **Apply the calibrated per-ruleset success-rate priors into `templates/votes.json` (calibration-v2 Phase 2.3, `scripts/apply_calibration.py`).** Forks every votes entry to `{community:{gi,nogi}, prior:{gi,nogi,provenance}}` (legacy scalar mirrors into both frames; community ≠ prior — the AI prior never masquerades as votes; pure-seed sentinel `vote_count==30` preserved per frame). Writes a `prior` block for each proposal technique that is **confident** (`not needs_human_review`) OR **reviewed** (`review_input.json`) OR **overridden** (`calibration_overrides.json`, which wins). The published rate is the Bayesian blend `folded_rate` = prior (weighted by pseudo_count) + real community votes (count above the seed) — so the prior drives the number while unvoted, and ~3-8 real votes overturn it. `scripts/_votes.py` is the shared schema/fold seam; `regenerate_graph.load_votes` folds per ruleset and reduces to the **no-gi default frame** (graph.json `successRate` stays scalar → zero consumer churn; `successRateByRuleset` carries the {gi,nogi} pair for the 2.4 toggle), then rescales each node's outcome distribution so `successRate == Σ success-cells` (headline⇄breakdown coherence, gated by validate:graph). `regenerate_md` renders the same folded value so page text == graph == game. occurrence% / outcomes stay in the human-gated `calibration_proposals.json`. |

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
