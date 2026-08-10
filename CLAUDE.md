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
4. **Quartz Build** - Static site with graph visualization, search, wikilink-derived graph edges
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

### Share links — node ordinals + wire codec (v1.81.0, foundation)

A share link carries a LIST OF GRAPH NODES in its URL (the gym-WhatsApp acquisition path:
"these are the techniques we learned in today's class"). Two artifacts underpin it.

**`node_ordinals.json` (repo root, COMMITTED, APPEND-ONLY).** `{id -> ordinal}` for every
`globalGraphLayout.json` node, plus a `retired` map.
- **A node's array index can NEVER go in a URL.** `regenerate_graph.py` builds graph.json from
  an unsorted `rglob('*.json')` and `regenerate_graph_layout.py` derives its node list from
  `adjacency` DICT INSERTION order seeded by that iteration — so adding one content file
  renumbers pre-existing entries (measured: +1 file in a 7-file dir moved 2 of the 7). An
  index-encoded link would silently open a DIFFERENT set of techniques, with no error anywhere.
  Live proof: `graph-data.json` node[0] is `Positions/Gogoplata-Control`, ordinal **42**.
- Ordinals are assigned once and are **permanent**: never renumbered, never reused, and a
  deleted node's entry is **retired, not removed** (so its ordinal can never be handed to
  another node). New nodes append at `next_ordinal` in **sorted-id order**, so the minting
  itself does not inherit filesystem order either.
- `npm run regenerate:ordinals` mints/appends (wired into the `regenerate:graph` umbrella,
  after graph-layout). `npm run validate:ordinals` is a HARD gate (`ci-validate.yml` + both
  deploy workflows). The generator self-gates: it refuses to write a lockfile that would fail
  `--check`.
- The browser gets it via **`o` on every `graph-data.json` node**, stamped by
  `regenerate_neural_data.py` — a step deploy actually runs. (`npm run build` and
  `regenerate:graph` do NOT run in deploy; the workflows re-list steps inline.) Cost: **+4.6 KB
  gzip**, deliberately paid inline so the `/l/<code>` recipient path resolves ordinals from a
  payload it already needs (node coordinates) instead of adding a request to the acquisition
  path's critical fetch chain.

**`neural/src/lists-codec.src.js` — the wire codec, PURE.** Format **v2** (current) = `[0x02]
varint(n-1) varint(d0) … varint(d(n-1))` base64url-unpadded, where ordinals are sorted-unique and
`di = oi - o(i-1) - 1`.
- That `-1` makes duplicates and out-of-order sets **unrepresentable**, so the encoding is
  **canonical**: one set of nodes has exactly one spelling on every device. That is what makes
  `share_id` (first 12 chars) join creator and recipient events into a viral funnel with no
  server state. Non-canonical spellings (base64 padding, non-zero trailing bits, non-minimal
  varints) are REJECTED for that reason, not pedantry.
- **`n` is the ITEM COUNT and it exists so TRUNCATION IS DETECTABLE (v1.81.2).** WhatsApp and
  mail clients clip and re-wrap long URLs. v1 had no length and no checksum, so a clipped code
  decoded perfectly cleanly into a strict PREFIX of the class — **measured: 198 of 955 prefixes
  of real 2-13 item codes decoded silently**, one turning a 12-technique class into a
  1-technique one, with nobody able to tell. With the count, the payload must hold EXACTLY `n`
  deltas and end there, so a clipped link fails as `count_mismatch` / `truncated_varint` /
  `trailing_bytes` and the recipient is TOLD ("This link is incomplete"). Cost: 1 byte.
- **v1 still decodes, forever** (`NG_LIST_WIRE_VERSIONS_READ = [1,2]`) — a code is a permanent
  promise like an ordinal — but is never minted. Canonicality is therefore per-version, and only
  v2 is ever emitted, so every code the app produces is still the one spelling of its set.
- **Measured URL length** (1467 nodes, `https://bjjgraph.org/l/` + code): 5 items → **37.0
  chars mean / 39 worst**; 12 items → **47.3 / 51** (v1 was 35.5/38 and 46/50 — the count byte
  costs ~1.5 chars).
- Decode NEVER throws — it returns `{ok:false, error}` — and caps input at 512 chars / 60 items.
  Unknown ordinals (a link from a newer build, or a retired node) are REPORTED, not fatal: the
  list still opens with what resolved.
- **One source, three consumers.** It is a real ES module so `node --test` and a Cloudflare
  Pages Function import the identical file; `neural/build/build.mjs` strips the `export `
  keywords when concatenating it into the IIFE and **throws if that strip stops matching** (a
  surviving `export` is a parse error that would delete the whole app). Exposed as
  `globalThis.NGLists`. Pinned by `tests/share_lists_codec.test.mjs` (19 tests, mutation-tested:
  every guard has a test that fails when the guard is deleted — the v2 count guards were checked
  against 8 mutants, 8 killed). `build.mjs`'s duplicate-top-level-name guard scans
  `function|const|let|var|class` (it used to scan only `function|const`, so a colliding `let`
  walked past it into the same SyntaxError it exists to prevent).
- Lists are **STORED as node ids** (in the existing v2 progress blob, add-wins merge); only the
  WIRE uses ordinals.

### Share links — the feature on top (v1.81.1)

`neural/src/lists.src.js` is the DOMAIN module beside the codec: storage shape, the merge rule,
`/l/<code>` parsing and the link-preview text. Same three-consumers contract (node --test, the
browser IIFE via `build.mjs`, the Pages Function), same no-`import` rule — and note the two files
share ONE scope in the bundle, so no top-level name may collide. That is why the item cap is
`NG_LIST_ITEM_CAP` here and `NG_LIST_MAX_ITEMS` in the codec; a test pins them equal and
`build.mjs` throws on any duplicated top-level name.

**Storage.** `lists: {"<id>": {name, items:[nodeId], t}}` inside the **existing v2 blob** — no
version bump, no migration. Cloud reconciliation is **ADD-WINS** (`ngMergeLists`, beside
`ngMergeCollectibles`' UNION): union of lists, union of their items, name from the later `t`.
A DELETE therefore loses to a stale device — deliberate: deleting again is trivial, losing the
list a class was built from (already posted in a group chat) is not. The item cap is enforced at
**add** time because `ngListEncodeOrdinals` THROWS above it rather than truncating a coach's class.

**UI.** A **Lists** section at the TOP of Explore (`[data-lists-section]`, `[data-list-row]` with
Drill / Share / ×). Read order inside it is **arrival first**: a `[data-shared-list]` (or
`[data-shared-stale]`) block, then any undo row, then `[data-lists-head]` — a first-time recipient
must never read "Lists (0)" above "Shared with you · 5 techniques", and the head prints no count
at all when there are no lists. **Delete is two-step and undoable**: the first click arms it
(`[data-list-delete-armed]`, label "Delete?", 8s window), the second deletes and leaves a
`[data-list-undo]` row holding the whole list; it also sits 12px clear of Share, which is the
button a coach presses in front of the class. The `+` add affordance (`[data-list-add="<nodeId>"]` +
`data-list-surface=explore|dossier|land|lesson|shared`) rides Explore rows, BOTH dossier
renderers, the in-roll landing card and challenge lesson rows (as a SIBLING of the lesson
`<button>` in `.ng-challenge-lessonrow` — a nested `<button>` would close the outer one in the
parser). Lighting a list reuses `setFocusIdxSet` exactly like a System; `_listFocusId` survives
each `renderExplorer` reset (which otherwise `clearFocus()`es on every keystroke) and is dropped
by `clearFocus`, i.e. on any tab change or pane close.

**Recipient path (`_openSharedListFromUrl`, called right after `ingest`).** Decodes
`location.pathname` client-side, sets `_sharedIncoming`, opens the pane on Explore and lights the
nodes. A received link is **offered, never adopted**: Save is one deliberate click. Unknown
ordinals surface as `[data-shared-unresolved]` and the rest still opens. Beats: `list_item_added`,
`list_shared`, `list_opened` (the last two have sound cues in the `Sharing` group), plus
`list_stale` / `list_failed`.

**Four outcomes for a `/l/<code>` arrival, and they are FOUR DIFFERENT SENTENCES** (v1.81.2):
resolvable → the offer; **valid but nothing this build knows** → `[data-shared-stale]` ("this link
is valid, your app is older — reload in a bit"), which is actionable and must not be answered with
the silence garbage gets; **damaged** → `[data-shared-broken]` ("this link is incomplete");
**not code-shaped** (`/l/not!a!code` — fails `ngListParseSharePath`) → nothing at all, the app is
just an app.

**THE PHONE IS THE PRODUCT SURFACE, AND IT DECIDES THE TERMINAL STATE** (v1.81.3). A gym WhatsApp
link is opened one-handed in a changing room, and on a 390x844 phone `.ng-drill` is an **88vw
drawer** — it IS the screen. So `_offerShare()` forks on `isMobile()`:
- **wide** → `openPane("explore")` as before (the pane sits beside the graph; nothing is hidden).
- **phone** → **nothing opens.** The class is lit, the camera framed on it, and the offer arrives
  on the collapsed **`.ng-drilltab` pill** instead: `[data-share-cue]` (`◉ N`, re-lights WITHOUT
  covering the graph, beat `list_relit`) + `[data-share-open]` (`Class ▸`, the deliberate "let me
  read it" → pane on Explore). This serves PANE LAW *better*, not worse: on the phone path nothing
  but the user ever opens the pane.
- **A LIST focus now SURVIVES a mobile pane close** (`applyDeckVisibility`): there, closing the
  drawer is how you look at the graph, not how you discard the class. Desktop keeps the original
  clear-on-close — the pane never covered anything there.
- Both cue buttons are `<button>`s **appended LAST** to the pill: the mobile rules hide
  `.ng-drilltab > span:first-child` and `> div`, and inserting first would unhide the pill's own
  icon. `_renderShareCue()` also **shows the pill itself** — `pointer-events:auto` is inline on
  those buttons (it must be), which beats the tab's inherited `none`, so the first draft was fully
  CLICKABLE at `opacity:0` (the pill only appears on the first landing, and a share arrival is
  decoded before the first roll starts). A control you can hit but cannot see is worse than a late
  one. `reach()` in the mobile spec asserts effective opacity up the ancestor chain for this reason.

**THE LANDING CARD DOCKS OFF THE TRAY'S MEASURED TOP ON MOBILE** (`_dockLandCard`, v1.81.3). The
options tray is `position:absolute; bottom:84px` with NO height, so it grows UPWARD as its cards
grow, while `.ng-landcard`'s mobile `bottom` was a CSS constant tuned against a shorter tray.
Measured at 390x844: tray top **583**, landing-card bottom **646** — a 63px overlap, card at z-index
5 over the tray's 4, so it covered the top of every option card: the category, the potential and the
technique NAME you are choosing between. The overlap PRE-DATES the capture `+` (which widened it by
~9px), and no constant can track a tray whose height depends on how many lines a name wraps to.
`el.style.setProperty("bottom", …, "important")` is required, not cargo cult — the mobile rule is
`!important`, and a plain inline style moved the card 2px and looked like a bad measurement.

**CAPTURE THE TECHNIQUE, NOT JUST THE POSITION** (v1.81.3). "The techniques we learned in today's
class" means TRANSITIONS AND SUBMISSIONS. The landing card's `+` adds the *position you are
standing in* — legitimate ("we worked from half guard"), but not what the feature is for. The hand
IS the techniques, so `+` now rides **every option card** (`data-list-surface="option"`, in the
`.ngbotrow` beside the odds — the 150px header row is already glyph + category + potential) and the
**technique sheet's footer** (`data-list-surface="sheet"`, a 44px labelled target, which is the
mobile path since a card tap opens the sheet). Capturing never commits the move and never stops the
clock. Proven by `page.mouse.click` / `page.touchscreen.tap` at MEASURED coordinates on 390x844 —
never `locator.click()`, which scrolls into view and hid the landing-card clipping bug for a pass.

**Named the way a coach named it.** Every list surface renders the FULL authored name
(`listItemName()`, and `splitName().main` + the dimmer `from …` in the shared block) — never
`splitName().main` alone. 648 of 1467 nodes carry a `from <position>` qualifier and 89 main names
are ambiguous: "Kimura" is **35** different techniques here, "Americana" **16**. The qualifier IS
the disambiguator; dropping it destroys the point of the share. The same rule holds for the
add/remove toasts and for `l-manifest.json` → the og preview text.

**Offered once — but THE RECORD LOSES TO THE LIST SET** (reconciled v1.81.3). `shareSeen` (a
settings key, so LWW per key and cross-device) records each `share_id` as `saved` (with its list id)
or `dismissed`. A **saved** code lights THEIR list instead of re-offering a duplicate; a
**dismissed** code is not re-offered within the same visit (`performance` navigation type
`reload`/`back_forward`) — reloading is not a second ask. `saved` is a *claim about a list that may
no longer exist* (deleted, merged away, blob rewritten), and when it doesn't the old code answered
with perfect silence — nothing lit, no offer, no message, on a URL whose only job is to show a
class. `_openSharedListFromUrl` now checks the list is still there **and non-empty**, and falls
through to offering it again (`neural_share_list_reoffered`) when it is not.

**Re-lightable, from inside AND outside the pane.** `[data-shared-relight]` ("Show on graph") in the
shared block and `[data-share-cue]` (`◉ N`) on the pill both re-run the same `setFocusIdxSet` path.
It exists because closing the pane `clearFocus()`es by design (on desktop), and the received set was
the ONE focus source with no way back. The cue is the mobile answer: the in-pane control is
unreachable in exactly the state you want it, since the pane is the screen there.

**A DAMAGED LINK IS TOLD DURABLY, NOT IN A TOAST** (v1.81.3). Two separate defects were behind
"detected but silent": (1) `setEvent` has ONE slot and the roll overwrites it within a couple of
seconds, so the toast alone never reached a real recipient — hence `[data-shared-broken]`, plus the
pill cue that survives; (2) the clip classifier only listened for the count-byte errors. Measured
over every prefix of real codes (908 prefixes): **`not_base64url` 478 · `truncated_varint` 191 ·
`count_mismatch` 179 · `truncated` 60** — the base64 layer refuses FIRST whenever a cut lands
mid-quantum (`len % 4 == 1`) or on non-zero trailing bits, so **the majority of real cuts are
`not_base64url`** and were answered with silence. `NG_LIST_CLIP_ERRORS` (in the codec, beside the
wire that defines them) is now the single classifier; errors a cut cannot produce (`bad_version`,
`too_many_items`, `non_canonical_varint`, `too_long`) stay out, because "cut short in transit" is
the wrong sentence for a mistyped code. Anything code-shaped that will not decode says *something*.

**The analytics join across a wire-version bump** is documented once, on `ngListShareId`:
canonicality is per-version, so one set has a v1 and a v2 spelling and two ids. v1 is never minted,
so a v1 id can only appear on the RECIPIENT side (a link pasted before the bump) and is counted as
an unattributed legacy open — never re-keyed to a synthetic v2 id. The ids diverge inside their
first two characters, so the two spellings can never be conflated.

**Four rungs, and the one that matters.** `_redirects` carries **`/l/* /l.html 200`** — a REWRITE,
so `/l/<code>` keeps its URL and gets the built shell. That plus client-side decode is the WHOLE
experience with **no Function at all**; `functions/l/[[path]].js` only adds the social preview
(og:title naming the techniques), because WhatsApp/Telegram/X fetch server-side and never run JS.
**HEADERS FOR `/l/*` COME FROM ONE PLACE AT A TIME, AND THE TWO PLACES MUST AGREE** (v1.81.2).
Cloudflare: *"Custom headers defined in the `_headers` file are not applied to responses generated
by Pages Functions, even if the request URL matches a rule defined in `_headers`."* So unlike the
comma-join trap that `check_headers_cache.py` was built for, `/l/*` has **two mutually exclusive**
header sources — the Function when deployed, `_headers` on the rewrite rung — and the failure
available here is them DISAGREEING, so the TTL and security posture change the day the Function
lands. `SHARE_CACHE_CONTROL` + `SHARE_STATIC_HEADERS` in the Function are byte-identical to
`_headers`, gated (checks 6-8 of `check_headers_cache.py`, which also derives each Function's route
from its filename). The Function must also `delete` `content-length`/`etag`/`last-modified`/
`content-encoding` before reusing the asset's headers: it returns an **HTMLRewriter-transformed**
body, so the asset's length is wrong, its ETag/Last-Modified would make two different documents
share one cache validator, and a surviving `content-encoding` describes bytes `ASSETS.fetch` already
decoded.

**The gate checks OMISSION, not only drift** (v1.81.3) — omission is the likelier regression and
reproduces the very hazard: a Function that stops setting `Cache-Control` altogether used to pass
(the comparison loop had nothing to iterate), and a `SHARE_STATIC_HEADERS` block that is declared but
never written into the response passed every value comparison while shipping none of the headers.
`main()` now also runs the Function checks against the **emitted** `source/public/_headers` — the file
Cloudflare actually reads — not only the canonical `source/quartz/static/_headers`, which is merely
its input (`regenerate_headers.py` sits between them). All three new checks are red-proven by
deleting the line and watching the gate fail.

**`HTMLRewriter` selectors must be SCOPED** (v1.81.3): `.on("title", …)` matches by element NAME, and
the shell carries a second `<title>` — `<title>Search</title>` inside the search button's inline SVG.
The Function targets `title[data-share-title]`, a marker `build_share_shell.mjs` writes and asserts
exactly once, same contract shape as `meta[data-share-og]`. The pair (served bytes + Function source)
is asserted in the SEO journey.

`scripts/build_share_shell.mjs` derives `l.html` from the BUILT `index.html` (one source of truth;
`<base href="/">` so a trailing slash can't 404 the assets; `noindex,nofollow`; `data-share-og`
markers the Function's HTMLRewriter targets), emits `l-manifest.json` (ordinal→name, for the
Function only) and **GATES that no `/l` URL reached sitemap.xml or llms.txt**. It is wired into
root `build` AND explicitly into BOTH deploy workflows — deploy does not run root `npm run build`.

**Two mouse-only bugs this work uncovered and fixed** (both invisible to keyboard paths, the same
class as the coach button before v1.69.1):
- The in-node dossier card's z-index was **3**, under the bottom-centre transport pill (4), which
  intercepted clicks on its action row. Now **5**.
- `attachInput`'s `pointerdown` called `el.setPointerCapture()`, which RETARGETS later pointer
  events to the wrap — so pointerup's `inCard` guard saw the wrap, dismissed the dossier
  mid-gesture, and the browser computed the click target from the down/up common ancestor. Every
  button inside the desktop in-node dossier ("Roll from here", the attack pills) was dead to the
  mouse. A gesture starting inside the card now returns early.

**Tests.** `npm run e2e:share` → `e2e/playwright.share.config.ts` (own port :8129,
`reuseExistingServer:false`) runs BOTH halves: `e2e/journeys/share-lists.spec.ts` (11 journeys, the
desktop/logic half) and `e2e/journeys/share-mobile.spec.ts` (7 journeys, `test.use` **390x844 +
hasTouch** — the device this feature ships to). They are two files because only a spec file can set
its own viewport. The no-Function rung is tested by fulfilling `/l/*` with the bytes of
`source/public/l.html`, with the real `_redirects` rule asserted in the same file so the emulation
cannot drift from production. **Every port is dedicated now** (core :8133, gen :8127, share :8129,
all `reuseExistingServer:false`; observe/quarantine keep :8123 deliberately) — a config that reuses
a server started by ANOTHER worktree tests someone else's `source/public`, which makes any result
from it unreportable.

### Training System (SRS) — embedded UX (v1.20.0+)

Client-side spaced repetition (SM-2) layered onto the always-on background graph. There is **no `/Training` page** — training lives as a persistent strip + two stacked modals + carousel chevrons on every page. All state stays in localStorage (Supabase sync optional).

**Surface (registered in `sharedPageComponents.afterBody`):**
1. **FlashcardsHeader strip** — fixed top, ~36px tall. Context-aware label + ▶ play button.
   - Idle, due > 0: `Flashcards (N due)`
   - Active session: `Session X/Y` (▶ swaps to ◾ stop)
   - Idle, 0 due, has SRS: `All caught up · train more`
   - No SRS cards yet: `Start training`
2. **DecksModal** — opens when user clicks the strip label. Lean: 5 deck rows (Due / Reviewing / Mastered / Suggested / Recently Explored) + sticky bottom CTA `Train Due (N) ▶` (label adapts) + ⚙ in modal header.
3. **SettingsModal** — opens from the ⚙ inside DecksModal, defaults to Flashcards tab. Two tabs: Flashcards (Daily Goal, Show Flashcards on pages) / Game (Game Mode pills, Hard/Ultra locked, Sound Effects toggle). Stacks above DecksModal.
4. **SessionChevrons** — fixed prev/next overlays on left/right viewport edges. Visible only when `body[data-training-active]`. Left hidden at index 0; right shows ✓ at last card (click finishes session). ArrowLeft/ArrowRight global keyboard, gated by `isTypingTarget`.

> **NB — legacy variant only.** Everything in this section describes the Quartz page UI served at `?variant=legacy`. The default experience is the **Neural app** (see *Neural: pane law, landing questions, Challenges, Game Knowledge* below). `FirstLoadHint` and `bjj-onboarded` were **deleted in v1.26.2** (`0c492f0f6`) and no longer exist anywhere in source.

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
- localStorage: `bjj-srs-cards`, `bjj-settings`, `bjj-daily-progress`, `bjj-streak`, `bjj-explored`, `bjj-banned-flashcards`, `bjj-journey`
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
- `source/quartz/components/scripts/gameAudio.ts` — legacy-variant neural/space cues, lazy Web Audio singleton, cue cooldowns
- `neural/src/sound.src.js` — default Neural runtime engine plus canonical contextual cue catalog
- `forward/sounds/` — `/dev/sounds/` production-engine catalog and previews; `build:forward` copies the Neural engine into this route
- `source/quartz/components/FlashcardsHeader.tsx` + `scripts/flashcardsHeader.inline.ts` — strip UI + label state machine
- `source/quartz/components/DecksModal.tsx` + `scripts/decksModal.inline.ts` — deck overview modal + sticky CTA
- `source/quartz/components/SettingsModal.tsx` + `scripts/settingsModal.inline.ts` — two-tab settings modal
- `source/quartz/components/SessionChevrons.tsx` + `scripts/sessionChevrons.inline.ts` — carousel prev/next + keyboard nav
- `source/quartz/components/Flashcard.tsx` + `scripts/flashcard.inline.ts` — per-page Q&A UI (also drives session advancement on Hard/Easy)

**Cloudflare redirect:** `source/quartz/static/_redirects` has `/Training/* / 301` so old inbound links land on home.

### Neural: pane law, landing questions, Challenges, Game Knowledge (v1.68.0+)

The runtime remains one imperative component in `neural/src/app.src.jsx`. Challenge definitions, pure progression, UI composition, feedback, and styling are split into `neural/src/challenge-*.src.js` and `neural/src/challenge-*.css`, then composed by `neural/build/build.mjs`. Core journeys include `pane-law`, `landing-card`, `roam-stage`, `white-challenges`, `challenge-curriculum`, `content-capstone`, `game-knowledge`, and `challenges-{engine,ui}`.

**ONE PANE (v1.76.0).** The left explorer rail is gone — **one right pane** (`.ng-drill .ng-explorer`, 360px, z:8, display-based visibility, both classes on the one element for spec continuity) carries three tabs: **Explore | Challenges | History** (`.ng-learning-nav`, `data-view`), under the single `.ng-knowledge-header` meter. History replaced the retired Collection tab: it hosts the roll history with inline decks plus the mastered/today/weak-spots stat row (the old "Daily flashcards" hero bar is deleted — the knowledge header is the ONLY progress meter). `explorerRef` is an alias of `drillRef`; `toggleExplorer`/`openExplorer` remain as names (logo, cue, keyboard all route to `openPane(view)`).
- **Two body modes** via `_layoutPane()`: tabs mode vs **study takeover** (a live `deck`/`_session`/`_checkpoint` — `_paneStudyActive()` — hides the nav; `data-pane-study` on the pane; the study header's `‹ Back` (`data-pane-back`) returns to `_paneReturnTab`).
- View state: `challengeView` ∈ `explore|challenges|history`; legacy `tree→explore`, `path`/`collection`→`challenges`. Roll-advance re-renders of the History body are gated on `_viewMode === "history"` so an open Explore search is never stomped.
- Mobile: ONE 88vw drawer (the two competing drawers are gone); the `.ng-drilltab` pill is unchanged. The account chip fades out while the pane is open (the pane's ✕ owns that corner).

**PANE LAW (v1.68.0).** The pane is **manual-only** — nothing in the roll loop opens or closes it. It no longer opens at roll start, no longer opens as a save nudge, no longer hides at round end, and desktop graph clicks leave it alone (mobile keeps the strip-tap dismiss, since the pane covers the screen there).
- **Open = the game stops. Close = the game resumes, but only if the pane is what stopped it.** Latched in `applyDeckVisibility()` via **`_paneAutoPaused`** — one latch for the whole merged pane (any tab, any study surface); `_dossierAutoPaused` stays separate for the node dossier. A hand-paused roll stays paused when you close the pane.
- Latched in `applyDeckVisibility`, not `setDeckOpen`, because several study entry points assign `deckOpen` directly. Beats: `pane_paused` / `pane_resumed`. Esc closes the pane last, once no overlay is up.

**QUESTION-FIRST LANDING (v1.68.0).** The flashcard is no longer a place you go — it is what the game asks on arrival. `renderLandCard(node, mode, hooks)` docks `.ng-landcard` above the options tray in fixed read order: **identity** (`[data-land-id]`: name · where you came from · Top/Bottom or Attacking, with ONE top-right familiarity chip `[data-land-count]` — the ○/◐/● seen-glyph fused with the deck's recall-proven count, e.g. `● 3/8`; glyph-only when no deck is authored; clicking it opens this state's flashcards, v1.76.0) → one-line definition → **film** → **ONE multiple-choice question** (`[data-land-q]`) → your options → **`More ▸`** (`[data-land-more]`, opens the dossier — everything else lives there). The collapsed `.ng-drilltab` no longer carries the "X/Y Mastered" count (the chip does); its medal icon still tiers with progress.
- There is deliberately **no second question** at the technique node between commit and sweep. It was built and cut: gating the sweep on a 4s window added that delay to every move (and broke `golden-path` / `jit-loop` on tempo). The landing question already moves the odds of the very transition or submission you are about to attempt, and the sheet's JIT drill covers buying odds right before committing.
- **Economy, one rule on both surfaces:** right → the ordinary credit path (`noteCardDone`: mastery + sharpness already move the odds — no second bonus) plus `refundDecision(2500)`; wrong → `_qMod` −0.04 (plausible) / −0.08 (trap), folded into `moveChance` and **cleared on the next `enterLand`**. Timing out costs nothing.
- `questionFor(key)` picks the deck's first unproven card (`cardStage < 2`); a proven deck asks nothing.
- **The card BACKFILLS when a late payload lands (v1.82.1).** Decks and dossier content are deferred, and on a measured Fast-4G cold load they arrive ~18s AFTER the first hand — so a first-time visitor used to take their opening decision with no question, no definition and no film, and the ready hooks refreshed the drill panel/odds/tab but never the card, leaving that state silent for its whole turn. `_landBackfill()`, called from `onFlashcardsReady`/`onContentReady`, re-renders the LIVE card in place; `land_q_shown` carries `backfill:true`. It refills only a card that has **never shown a question** (`!_landQ`) on the **current** position with a live decision window — a question already on the table is frozen, because re-mounting an answered one would hand out a second attempt at credit already scored. Arrival TIME is journey 1's payload work; this is what makes it visible.
- **MC is the in-play format; the sidebar is the study surface.** `mcMode` default flipped `auto` → **`classic`** — nobody meets multiple choice in the sidebar unless they opt in. The checkpoint quiz stays MC always.
- `_mcBlock(card, key, onDone, surface)` — truth lives in the closure + `this._mc` (never a DOM attribute); `surface` (`land` | `deck`) lets two blocks coexist, and only `deck` auto-advances. **`surface` also scopes the RNG**: the landing card draws on `land-mc-pick` / `land-mc-shuffle` so it can never eat the rigged `mc-*` queues the sidebar journeys depend on (this is what kept `golden-path`'s frame-exact replay honest).
- **Keys: `A` `B` `C` `D` answer the live MC block; digits `1–9` stay the option-card openers.**

**FIRST IMPRESSION (v1.82.3).** Two rules about the opening screen, both gated by `e2e/journeys/first-impression.spec.ts`.
- **A fresh profile's first-ever roll is drawn from REAL TRAFFIC, not uniformly.** `startPosTraffic()` sums `curriculum.weights` (the stationary distribution Game Knowledge already uses) per position through each technique's single canonical origin (`fromPositionId` → `_posSlugIndex`), giving 136 entries summing to 1. `_weightedStart(pool, u)` inverse-CDF-samples `w^START_BIAS.gamma` (1.5) mixed with `START_BIAS.floor` (2%) uniform. Effect: the six hubs a beginner can name go from **4.4% → ~66%** of first impressions, ~17 states stay genuinely likely, and **all 136 keep a real chance — the draw is biased, never narrowed**. It replaced a `withDeck` filter that was a **no-op** (all 136 carry a deck). ONE draw off the SAME `rng("start-pos")` tag, so rigged replays are structurally untouched; a **returning** profile keeps the historical uniform mapping exactly (`_returningVisitor()` — one latched definition, shared with the cold-start funnel's `cold` flag, marker `bjj-neural-firstroll`).
- **The card names ONE side, and it is `playerRole`.** All 136 position hub titles in `graph-data.json` end in "… Top" (the visual layer collapses Top/Bottom into one node), so the raw title is not a role claim. `renderLandCard` shows `posFamily(node.t)` for positions; `roleTxt` is the only place a side is named. **Do not "derive the role from the node title"** the way `rollFromPosition()` does — that derivation is a constant (`top`) across the whole pool, which is why every staged/roamed roll deals a top hand and why `playFrom(idx, role)` has to set the role itself.

**ROAM & STAGE (v1.68.0).** Clicking any graph node calls `stageRollAt(idx)`: fly there, land, deal the hand — **clock held**. Click elsewhere and you restage the same non-session. `_played` (set in `_tick` on the first unpaused frame with a live hand) is the seam: a roll that never played is never archived into `_pastRolls`. Tapping the node you are already on reads it (dossier) instead. `after(sec, fn, ignorePause)` exists so a staged landing still arrives while paused. Beat: `roll_staged`.

**CAMERA OWNERSHIP — a focus flight holds a LEASE (v1.81.4).** `frameNodes()` does not move the camera. It writes `camTarget`; the render loop eases toward it, and **`updateCamera()`'s follow-cam rewrites `camTarget` at the current roll node on every frame**. So every "here is your selection" flight (a shared class lighting up, a System lighting its members) used to be overwritten within one frame of a live roll — invisible on desktop only because the arrival opened the pane and an open pane pauses the roll. `frameNodes` therefore calls **`holdCamera()`**: `camHoldSec = 7`, checked by `camHeld()`, cleared by `releaseCamera()`.
- While the lease is live, **every automatic retarget yields** (`if (this.introDone && this.camHeld()) tgt = null` — follow, Overview and the end-of-round zoom alike). It **expires**, so the 400ms pan-to-current-node behaviour returns on its own.
- **A real pan, pinch or wheel releases it** (never fight a user's camera); so do the user's own "go somewhere else" paths — `locateNode`, `openDossier`, `playFrom`, `rollFromPosition`. A re-light (`relightShare`) takes a **fresh** lease.
- An intro still flying **hands the camera over** when it finishes: a share link is decoded at t=0, 3.2s before `introDone`, and its flight used to be eaten by the intro.
- `frameNodes` fits **both axes** (`vw` is a width; the visible height is `vw * H/W`), or a tall selection hangs off a 390x844 phone.
- **Never assert camera behaviour by reading `camTarget`** — that is exactly how this bug survived three reviews. Project the node through `draw()`'s transform and assert it is inside the viewport rect: `e2e/journeys/share-camera.spec.ts`.

**THE BOTTOM THUMB BAND (v1.81.4).** Three fixed tenants at `bottom:28px` on a phone: legend (left), `.ng-transport` (centred), `.ng-drilltab` (right, z-index 6 — *above* the transport's 4). The share cue's buttons widen the pill leftward until it covers play/pause + restart, so `_renderShareCue()` stamps **`body[data-share-band]`** and the mobile CSS steps the transport aside and tightens the pill (padding + button margins), dropping the pill's own short label. Final measured band at 390px: legend 14–118 · transport 134–224 · cue 234–376, with `elementFromPoint` naming play, restart and the cue individually.

> Two values were tried, rejected, and must not come back. **`body[data-share-cue]`** collides with the cue BUTTON's own attribute, so `document.querySelector("[data-share-cue]")` returns `<body>` — every "where is the cue" measurement silently becomes the whole 390x844 viewport and every tap aimed at its centre lands mid-screen (three share journeys went red on it). And a **66px** transport shift merely relocates the collision onto the band's third tenant, the legend. Deliberately **not** a `max-width` on the pill: a capped right-anchored flex row pushes its last button off the right edge instead of shrinking. Asserted geometrically (transport, cue, legend) at 390x844.

**ARRIVAL COPY IS HELD, NOT FIRED AT t=0 (v1.81.4).** `setEvent` is ONE slot. A share arrival is decoded at ingest, mid-intro, and the roll's first landing overwrites it seconds later, so `_announceArrival()` stores the sentence and `enterLand()` says it (`_sayArrivalIfPending`) once the graph has settled. A timer cannot do this: `startRoll()` calls `clearTimers()` at the end of the intro. `saveSharedList`/`dismissSharedList` drop a held sentence — the user already answered.

**A DAMAGED SHARE LINK: TWO SENTENCES, ONE SOURCE (v1.81.4).** `ngListClassifyFailure(code, error)` decides between **`clipped`** ("one of ours, cut short in transit") and **`unreadable`** ("not one of our codes"), because `not_base64url` — the majority of real clip positions — is *also* what a pasted random word looks like. The tell is the leading wire-version byte (`ngListWireVersionOf`, two base64url chars). `_brokenCopy()` is the single seam for the pill label, the panel (`[data-shared-broken-kind]`) and the toast, so they can no longer contradict each other.

**CHALLENGES (v1.74.0, laddered v1.76.0).** Challenges replace the one-time Tutorial and locked progression path. Five content tracks — White Foundations, Blue Connections, Purple Patterns, Brown Pressure, and Black Breadth — are open from day one. Track colors describe material difficulty, never real-world rank or access.
- **The tab renders as ONE scrollable ladder** (`.ng-challenge-ladder`, old-Belt-Path feel): belt-header rows (still class `ng-track-card`, `data-track`, `aria-pressed`) over an **always-visible curriculum for every track**; the selected track's objectives block (`.ng-challenge-detail`, unique) rides under its header. A pinned **`Continue`** button (`[data-challenge-continue]`) at the top jumps to the **frontier** — `challengeFrontier(trackId)`, the pinned track's first unproven live lesson, which also glows (`data-frontier`). Not-done rows dim **visually only** (`data-lesson-done`, opacity on the text span — crowns keep full color; nothing re-locks, per canon).
- White Foundations preserves the original 20 evidence predicates; the first-roll coach completes the first three. Legacy `tut.done` is dual-read and compatibility-written, then migrated exactly once into `challenges`.
- Advanced tracks combine event evidence (`combo`, `escape`, `roll_end`) with snapshot evidence (lessons, checkpoints, recall, mastered decks, capstones). `fx()` is the single processing seam.
- A pinned challenge cue stays available during rolls, can be hidden in Settings → Rolling, and never takes focus or blocks the option hand. Opening the pane temporarily removes the cue.
- Challenge lessons are always open. A unit checkpoint requires its own live lesson evidence; an optional content capstone requires that track's unit checkpoints. Clearing a capstone records proof but never unlocks another track.
- **Rewards shelf (was the Collection tab):** patch-style badges (meaningful milestones) and mint-once Mat Coins (humorous acknowledgements) live in a `<details>` shelf (`[data-rewards-shelf]`, `renderRewardsShelf`) at the foot of Challenges; reward toasts' "View Collection" opens+scrolls it. Neither is spendable and neither changes odds, score, timers, content access, or opponent behavior.
- Reward feedback is queued, polite (`role=status`, `aria-live=polite`), focus-safe, sound-aware, and remains visible without animation under reduced motion.

**GAME KNOWLEDGE = ONE SKILL SCORE (v1.68.0), display-only.** Challenge progress and skill are deliberately separate. Game Knowledge is the only mastery metric:

```
score = Σ (weight_i × mastery_i),   Σ weight_i = 1
```

- **`weight_i`** — how often a roll *actually* passes through technique *i*. Computed at build time by `build_technique_weights()` in `scripts/regenerate_neural_data.py`: the state machine is a Markov chain (position-role --`attemptProbability`--> technique --`outcome.probability`--> position-role), power-iterated with PageRank-style damping to a **stationary distribution**; each technique's expected visit rate is its weight. Emitted as `curriculum.weights` (`{"<name>|Attacker": w}`, 1269 entries summing to 1). Sanity check: the heaviest come out as *Side Control to Mount* (2.4%), *Knee Slice Pass*, *Underhook Sweep from Half* — a believable frequency ranking.
- **`mastery_i`** — `deckMastery(key)` = mean of `min(cardStage,3)/3` over the deck's cards.
- **Nothing is cut.** A rare technique still counts, proportionally to how rare it is. This replaced an earlier "drop the rare 20% tail" canon, which was arbitrary — `attempt_probability` is normalised *per position* across 10–20 options, so the distribution is flat and any mass cutoff is meaningless (80% of the mass kept 724 of 1270 techniques).
- **Knowledge bands are thresholds on that number** (`BELT_SCORE`): white .20 · blue .40 · purple .60 · brown .70 · black .80. `gameScore()` → `{score, belt, next, stripes}`, memoised against `_stageVer` (bumped in `_bumpStage`) because a full pass is ~21k card reads.
- **Emergent property worth keeping:** an MC answer caps a card at stage 2 = 2/3 mastery, so pure recognition tops out at **0.667** — enough for purple, never enough for brown or black. Recall is the only route past 0.7 *by construction*, which is exactly the "white belts recognise, black belts recall" rule, with no special-casing.
- **Effectiveness is already in there** — the chain propagates through `outcome.probability`, so a technique that works routes more traffic to its destination and lifts the weights downstream. An explicit effectiveness multiplier would double-count it.
- Rendered as the persistent `.ng-knowledge-header` and accessible `.ng-knowledge-meter` above the pane's three tabs — the app's ONLY progress meter (v1.76.0 deleted the drill pane's duplicate hero bar). **Nothing is gated by the score** and the thresholds are provisional.
- Forgetting is *tested, not timed*: Review-again and trap answers can lower a card's stage and therefore the score. Do not add idle decay.
- `crownBadge(frac, tint, false)` gives each Challenge lesson a 0–4 crown from `deckMastery(deckKey)`. Crowns visualize the same evidence as Game Knowledge; they are not a second score.

**CHALLENGE PERSISTENCE + MERGE.** The existing v2 progress blob adds `challenges`, `badges`, and `coins` without changing the blob version. Challenge entries are `{progress, done, t}`; collectibles are `{t, context?}`. Cloud reconciliation uses MAX for progress, OR for completion, UNION for collectibles, and the existing per-key timestamp LWW rule for settings. A fresh device must pull before its first push. Corrupt local state falls back cleanly, and snapshot-derived historical rewards persist without replaying old toasts.
- Challenge settings: `challengeView`, `challengeSelectedTrack`, `challengePinnedTrack`, `challengeCueVisible`, `challengeMigrationSeen`.
- Legacy `path` and retired `collection` views migrate to `challenges`; legacy `tree` migrates to `explore`; `history` is first-class (v1.76.0).
- Compatibility identifiers such as `belt_test_*`, `TUTORIAL`, and `tut.done` remain internal migration rails only. Do not restore their retired UI or lock semantics.

**MOMENTUM — the combo meter (v1.70.0).** Consecutive correct landing answers build an arcade combo: ×2 `DOUBLE COMBO!` · ×3 `TRIPLE` · ×4 `MEGA` · ×5 `ULTRA` · ×6 `RAMPAGE!` · ×7+ `GODLIKE` (re-stamps ×N). Owner's rules: **per roll** (fresh match starts cold — reset in `startRoll`/`rollFromPosition`); **wrong OR ignored breaks it** (`_landPending` is set when a question mounts; `enterAttempt` breaks with `reason:"ignored"` if it's still set — auto-pick counts as ignoring); a landing that asks nothing **carries** it (silence ≠ neglect).
- **Bonus:** `momentumMod()` = +2.5%/tier, **cap +10%** at ×5 — added in `moveChance` AND `escapeChance` (momentum is morale, it defends too). `momentumSkew()` = 10%/tier, **cap 40%**: in `drawOutcome`, counter-outcome weights shrink by the skew ("too fast to counter") — favorable outcomes gain implicitly via relative weights, authored numbers untouched. Beat `outcome_skewed {skew, result}` when a non-success lands under skew.
- **Surfaces:** `.ng-combo-pop` (`[data-combo-pop][data-heat 1-5]`, announcer slam, auto-removes) and the `.ng-momentum` heat chip (`[data-momentum]`, top-right, shatter animation on break). Beats: `combo {n, name, mod}`, `combo_big {n≥5}` (louder patch), `combo_break {at, reason}`. Sound patches `combo`/`combo_big`/`combo_break` in `sound.src.js`.
- The ×2+ announcer replaces the "Correct" toast; a break folds "×N momentum gone" into the wrong-answer toast.

**NEURAL AUDIO — one contextual signal catalog (v1.75.0).** `neural/src/sound.src.js` owns both `NGSound` and `NG_SOUND_CATALOG`; never maintain a second list of default-runtime sounds. Mapped `fx()` beats use filtered deterministic noise, sine/triangle foundations, spatial travel, smooth envelopes, delay, and compression. Routine events stay restrained; recall proof, checkpoints, belt tests, victory, and defeat earn progressively longer starflight signals. Test mode records `{beat, patch, volume}` without creating an `AudioContext`, and every noise/pitch draw goes through `app.rng("sfx")`.
- **The catalog documents beats that actually fire.** Challenge rewards own the `Rewards` group (`challenge_completed`/`objective-tick`, `patch_earned`/`patch-weave`, `coin_earned`/`coin-mint`), and the retired Belt Path cues (`path_opened`, `belt_unlocked`, `stripe_earned`) are gone with their voices. Adding a mapped `fx()` beat means adding a cue; retiring one means deleting it.
- `/dev/sounds/` lives in `forward/sounds/`, not a Quartz emitter. `build_forward_components.mjs` deletes/rebuilds `source/public/dev`, validates the catalog, then copies the production engine and emits `sound-catalog.json`.
- The sound lab previews `NGSound` directly, documents each real trigger, is `noindex,nofollow`, and appears in every Forward route nav. Sounds is a development tool, not a fifth composition layer.
- Keep `source/quartz/components/scripts/gameAudio.ts` for `?variant=legacy`; its setting is `BJJSettings.soundEnabled`. Neural uses its own `sound` and `soundVolume` settings.

**`pointer-events:auto` is LOAD-BEARING on every fixed overlay** (`.ng-coach`, `.ng-landcard`, …): the property is *inherited*, the overlay root disables it, and the canvas hit-tests above anything that doesn't re-enable it — option cards set it inline for exactly this reason. Missing it = mouse clicks silently fall through to the graph (the coach's Next button and the landing card's MC options were unclickable by mouse until v1.69.1; keyboard paths masked it).

**Settings additions:** Rolling tab gains *Questions while you roll* (`landQuestions`, default on — gates the QUESTION only; identity+film render regardless) and *Challenge cue* (visibility for the pinned track). Flashcards tab's *Answer mode* defaults to Classic recall. Shortcuts lists `A B C D`.

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
| `npm run regenerate:graph` | Umbrella: graph-base (graph.json) → graph-layout → **ordinals** → graph-strength |
| `npm run regenerate:graph-base` | Generate graph.json only (no layout/strength) |
| `npm run regenerate:ordinals` | **Mint/append the share-link ordinal lockfile** (`node_ordinals.json`, committed). Assigns each layout node id a PERMANENT ordinal — append-only, never renumbered, never reused, retired-not-deleted. Must run after `regenerate:graph-layout` (the layout defines the live node set). See §Share links. |
| `npm run validate:ordinals` | **Hard gate** on that lockfile: every live node minted, no duplicate/renumbered/deleted ordinal, `next_ordinal == max+1`, keys sorted, plus an append-only diff against a git baseline (`--baseline-ref HEAD^1` in CI — against `HEAD` it would compare the commit under test to itself). Wired into `ci-validate.yml` and BOTH deploy workflows' validate step. |
| `npm run regenerate` | Full pipeline: issues → json → explode → **validate:graph** (gate) → md → hubs → votes → graph → explorer |
| `npm run build` | Build static site (~10 min, 4287 files) |
| `npm run build:share-shell` | Emit the share-link static shell `source/public/l.html` + `l-manifest.json` from the BUILT `index.html`, and GATE that no `/l` URL leaked into `sitemap.xml` or `llms.txt`. Part of `build` and an explicit step in BOTH deploy workflows (deploy never runs root `build`). |
| `npm run regenerate:build` | Regenerate + build (full workflow) |
| `npm run dev` | Build then serve locally on port 8080 |
| `npm run proofread` | Recurring LLM audit of graph edges + probabilities via Claude CLI. Intermittent use only — one Claude call per file, ~25 hours for full corpus at default 60s interval. Not part of `regenerate`. Use `--file`, `--category`, `--max-files` to scope, or `--batch` to skip the delay. |
| `npm run calibrate:cases` | Build `calibration_cases.json` from the live graph. **Per ruleset (v1.50.0+): emits a `gi` AND a `nogi` case per position role** (`case_id` suffixed `::gi`/`::nogi`); candidates = that role's transitions with their existing outcome skeletons. Regenerable input, gitignored. |
| `npm run calibrate` | **Calibrated probability elicitation (dry-run), per gi/no-gi ruleset.** An expert panel (Danaher, Gordon Ryan, Craig Jones, Roger Gracie, a BJJ-Fanatics generalist), each elicited in a SEPARATE Claude call, estimates occurrence% / success% / outcome-distribution per technique **in BOTH gi and no-gi frames** (ruleset-framed prompts; `ruleset_weight` boosts native-frame experts — Roger↑gi, Danaher/Gordon/Craig↑no-gi). Mechanism-first (which principles attacker leverages vs defender fails to leverage), comparative ranking + anchored to known-% references **shown only for the matching frame**. Aggregates IN CODE (relevance × ruleset × inverse-variance, bootstrap bagging, spread→pseudo-count **hard-capped at 8** — the 5 personas are one correlated LLM (~1.25 effective estimators); submissions / extrapolated / wide-CI entries are forced to the floor (3)), then **de-biases the single-LLM central-tendency compression PER `success_type`** (submission/sweep/pass/takedown/… each get their own inverse fit `true=(elicited-b)/a`, high-side damped, clipped; types with <5 anchors fall back to a global fit, flagged). Anchors come from `calibration_external_anchors.json` (curated + cited tournament research; committed input) with a **held-out** subset that validates out-of-sample. Reports per-band + **per-type leave-one-anchor-out (LOAO) MAE + held-out MAE** (the non-circular gate). Per-ruleset proposals carry `frame_confidence` (gi/no-gi `mirrored` when they agree within noise, else `forked`). Writes `calibration_results.json` + `calibration_proposals.json`; changes nothing else (NB: per-edge ground truth doesn't exist — BJJ records completions, not attempts — so per-technique success% stays an expert prior; external data anchors the de-bias slope + validates aggregates). `--reaggregate` re-runs aggregation+de-bias on existing results with NO Claude calls; `--no-debias` disables the correction. **Launch runbook: `~/calibration-engine.md`.** |
| `npm run calibrate:apply` | **Apply the calibrated per-ruleset success-rate priors into `templates/votes.json` (calibration-v2 Phase 2.3, `scripts/apply_calibration.py`).** Forks every votes entry to `{community:{gi,nogi}, prior:{gi,nogi,provenance}}` (legacy scalar mirrors into both frames; community ≠ prior — the AI prior never masquerades as votes; pure-seed sentinel `vote_count==30` preserved per frame). Writes a `prior` block for each proposal technique that is **confident** (`not needs_human_review`) OR **reviewed** (`review_input.json`) OR **overridden** (`calibration_overrides.json`, which wins). The published rate is the Bayesian blend `folded_rate` = prior (weighted by pseudo_count) + real community votes (count above the seed) — so the prior drives the number while unvoted, and ~3-8 real votes overturn it. `scripts/_votes.py` is the shared schema/fold seam; `regenerate_graph.load_votes` folds per ruleset and reduces to the **no-gi default frame** (graph.json `successRate` stays scalar → zero consumer churn; `successRateByRuleset` carries the {gi,nogi} pair for the 2.4 toggle), then rescales each node's outcome distribution so `successRate == Σ success-cells` (headline⇄breakdown coherence, gated by validate:graph). `regenerate_md` renders the same folded value so page text == graph == game. occurrence% / outcomes stay in the human-gated `calibration_proposals.json`. |
| `npm run clips:source` | **Curated YouTube film-study clips pipeline (v1.54.4, `scripts/source_clips.py`).** Fills role-nested `clips` arrays in content JSON for every slot (position top/bottom + hub overview, technique attacker/defender, principle; submission family hubs derive the union of child clips). Staged + resumable (state in gitignored `clips_sourcing/`): LLM plans the legend instructor + search queries per slot → yt-dlp runs REAL YouTube searches (IDs can't be hallucinated; per-video metadata fetches are bot-checked from datacenter IPs, so provenance comes from search results) → LLM curates 1-3 picks from real results only (Shorts ≤75s preferred) → machine verification (oEmbed 200/401/404 for embeddability; `i.ytimg.com/vi/<id>/oardefault.jpg` exists ONLY for Shorts = verticality; the `/shorts/` redirect trick does NOT work) → apply → `clips_sourcing/review.html` thumbnail grid for in-place pruning. Scope with `--stage/--category/--file/--max-slots`. Clips are curation-safe: stripped from the `regenerate:json` AI contract and re-merged verbatim (like Systems `products`). Neural app already renders them (film-study strip); `_neural_content.py` strips provenance fields from the bundle. |
| `npm run clips:verify` | Re-verify every applied clip against YouTube (rot check: deleted/private/embed-disabled). Refreshes `verified` dates; `--prune` removes dead clips; `--max-age-days N` limits to stale ones. Exit 1 on failures without `--prune` (CI-friendly). |
| Q3 occurrence calibration (no npm script — orchestrated) | **Per-ruleset attempt-probability (`occurrence`) calibration of every position role-node, v1.53.0.** Distinct from success-rate calibration: this rebuilds each position's `transitions[].attempt_probability` `{gi,nogi}` maps from a two-chamber expert panel — 10 BJJ legends vote frequencies, 4 advisors (statistician/ML/game/UX) challenge but don't vote — run as a **Hybrid Delphi**: independent per-legend ballots (Stage 1) → one 12–20-round deliberation agent per position (Stage 2) → deterministic MoE aggregation in `scripts/occurrence_moe.py` (specialty×ruleset weighted mean, modest anchor blend, **per-frame-0 only for genuine ruleset-unavailability decided from BALLOTS not the panel's `availability_rulings` field**, floor 1%, largest-remainder to 100/frame) → adversarial verify wave → `scripts/apply_occurrence_calibration.py` writes the maps into `content/Positions/*.json`. graph.json gets scalar `attemptProbability` (no-gi default frame) + `attemptProbabilityByRuleset:{gi,nogi}` — parity with successRate. Committed provenance: `occurrence_calibration.json`. Orchestration + credit-outage-resilient resume runbook live in the gitignored `occurrence_elicitation/_orchestration/`. This is the first REAL gi≠nogi divergence in **content** (v1.51.0's divergence was votes-only), so the Q3.0 pre-flight (v1.52.1) first made ~10 readers divergence-tolerant. |
| `npm run test:units` | **Pure-unit suites** — `node --test tests/*.test.mjs`: the share-link wire codec (`tests/share_lists_codec.test.mjs`) and the neural deck-hydration contract. No browser, no build, ~1s. Runs in `ci-validate.yml`. Note the shell-glob form: `node --test tests` is broken and `"tests/*.test.mjs"` needs Node ≥ 21's internal globbing. |
| `npm run test:curated` | **Fast deployment gate**: representative core gameplay, pane, progression, persistence, and Forward catalog journeys tagged `@curated`. Runs on every dev/prod deployment with a 12-minute hard ceiling and a sub-10-minute target. **One `@curated` test = one representative case.** An exhaustive walk belongs in the full suite: the every-clip-offset share test boots the app 22 times in a single test and was tagged `@curated` for one release (v1.81.3) — a 240s worst case inside a 12-minute gate. Package-manager neutral: `pnpm test:curated` invokes the same script. |
| `npm test` | **Complete core Playwright suite** (`e2e/journeys/`, config `e2e/playwright.config.ts`) against the built site on **:8133 with `reuseExistingServer: false`** (v1.81.3 — the last gate still exposed to cross-worktree server reuse; see the config header). GitHub Actions builds the site once and runs four shards for PRs targeting `main` **or `dev`** (v1.76.3), weekly, and on demand — with the Playwright browser download cached per **resolved `@playwright/test` version** (NOT per package-lock hash — this repo bumps the version every commit, so a lockfile key missed every run while still uploading 261 MiB); each shard has a **25-minute** hard ceiling and the wall-time target is 10-15 minutes. Rigged RNG + simulated-time pump via `journey()`; workers=1/shard, retries=0. **`j.clickByMouse(sel)`** is the only way to claim a surface is reachable by mouse: it measures the centre, refuses to scroll, refuses an off-screen centre, and fails if `elementFromPoint` is anything but the target or a DESCENDANT of it — an intercepting ANCESTOR (the `pointer-events:none`-inside-`auto` shape) is a failure, not a pass. **Late payloads (v1.82.4, corrected v1.82.5):** `boot(path, { payloads: { "flashcards.json": { afterSim: 25 } } })` makes a named payload land N SIMULATED seconds **after BOOT** (`afterSim` — so the 18s skew between the hand @7.0s and the decks @25.3s is `25`, not `18`), N real ms (`afterMs`) or never (`never`, a stalled connection — not a 404). `j.releasePayload(pattern)` lands **only the held payloads its pattern names** (bare = everything); rules belong to the boot that declared them (boot() clears the table); `j.payloadTimeline()` is the evidence. Anything asserting the SKEW measures `releasedAtSim` minus the sim clock at the hand and pumps in small steps, or it measures the pump size. Patterns are globs over the request URL, so per-deck chunks work too. The rule is armed BEFORE the first navigation (a delay layer registered LAST above every serving handler, `fallback()`ing to it), and declaring flashcards.json late relaxes boot()'s readiness gate — otherwise no cold-start spec can see the 18s skew between the first playable hand and the comprehension payloads, which is what made two rounds of green cold-start tests meaningless. `pnpm test` invokes the same script. **`j.boot()` contract (v1.81.2): it returns with NO in-flight progress write.** It waits for the deferred `curriculum.json` payload BEFORE completing the 20 White compatibility objectives, because `_onCurriculum() -> _refreshChallengeEvidence()` calls `_saveProgress()` when it finds durable change — so if that payload landed after the tutorial step it would silently overwrite whatever a spec seeded into localStorage, on nothing but machine speed. That was the whole "order-dependent flake" in `corrupt-blob-settings-persist-cleanly-after-heal` (green alone, red at #7 of 112). Guarded permanently by `e2e/journeys/harness-boot-inflight-write.spec.ts`, which delays the payload 2s on purpose. |
| `npm run e2e` | Backward-compatible local alias for the complete core Playwright suite. `pree2e` checks the RNG seam. |
| `npm run e2e:gen` | **Generated hyperspace suite** (v1.67.0): agent-authored journeys in `e2e/gen/`, tracked in `e2e/gen/ledger.json` (theme × lifecycle × feature × behavior + one-line invariant per test; persona seed builders in `e2e/gen/personas.ts`). Lints via `scripts/check_gen_specs.sh` (Math.random ban, `@hyperspace` headers, ledger↔spec sync) then runs `e2e/playwright.gen.config.ts` — **its own port :8127 with `reuseExistingServer: false`** (v1.81.2). It used to share `:8123` + `reuseExistingServer: true` with the core config, which means whichever WORKTREE started :8123 first owns it and every later run tests THAT worktree's `source/public`: measured, a run from `bjjgraph-share` was served a 343,153-byte `neural.js` from `bjjgraph-legacy` (ours was 364,190), and a sibling rebuilding `source/public` mid-run changes the bytes under a live suite. SEPARATE from the push gate. Grown by the `testgen-wave` workflow (`.claude/workflows/testgen-wave.js`): scout → probe/play → author → validate (2× green + red-proof; all Playwright serialized via `flock /tmp/bjj-pw.lock`) → adversarial meta-validation vs the full ledger. |
| `npm run e2e:share` | **The gym-WhatsApp share-link suite**, on its own port :8129 (`reuseExistingServer:false`): `e2e/journeys/share-lists.spec.ts` (desktop/logic) + `e2e/journeys/share-mobile.spec.ts` (`test.use` 390x844 + hasTouch — the device this feature actually ships to). Both files also run inside `npm test`. Mobile assertions use `page.mouse.click`/`touchscreen.tap` at MEASURED coordinates plus `elementFromPoint` and an effective-opacity walk, never `locator.click()`. |
| `npm run e2e:quarantine` | Known-RED specs capturing real gameplay bugs found by test-gen waves; each pairs with an entry in `e2e/quarantine/ISSUES.md`. Excluded from all gates; a spec going green here means its bug got fixed → promote to `e2e/gen/` + flip its ledger status. |
| `npm run e2e:observe` | Watch any spec live from another machine: the browser exposes CDP :9222 + slowMo (`OBSERVE_SLOWMO=600`). Part of the **paired-debugging skill** (`.claude/skills/paired-debugging/SKILL.md`): Mode 1 drives the owner's own tab at bjjgraph:8080 through the dev-serve bridge (`node scripts/paired_session.mjs bridge start`, then `cmd`/`results`); Mode 2 shares a watchable CDP browser (`paired_session.mjs start` + `scripts/paired/driver.mjs`). Sessions journal to `e2e/paired/journals/` and are TRANSLATED (never replayed) into gen specs with owner think-time clamped. |

### Quartz Scripts (source/package.json)

Run from `source/` directory:

```bash
cd source && npm run check   # Type checking (tsc + prettier)
cd source && npm run format  # Format code with prettier
cd source && npm run test    # Run path and depgraph tests
```

### Dev Snapshots (`<snapshot />`)

`npm run serve` / `npm run dev` runs `scripts/dev-serve.mjs` — the built site on :8080 (same
serve-handler engine `npx serve` used) plus a **localhost-only** snapshot receiver. A camera
button (bottom-left, dev only) captures the tab as PNG + a JSON dump of client state (page
identity, curated `window.__neural` gameplay/training fields, both web storages with `sb-*` auth
keys redacted, auth summary, recent console errors, build info) into `tests/artifacts/snapshots/`
(gitignored) and copies a one-liner to the clipboard:

```
<snapshot slug="Positions/Mount/Top" variant="neural" t="2026-07-17T14:23:05Z" json="tests/artifacts/snapshots/20260717-142305-positions-mount-top.json" png="tests/artifacts/snapshots/20260717-142305-positions-mount-top.png" />
```

**When the user pastes a `<snapshot />` line, Read both referenced files** (paths are
repo-relative). The PNG is exactly what the user was looking at; the JSON is the client state and
console errors at that instant. Treat them as ground truth for the report that follows — they
beat any assumption about what the app "should" be showing. The `png` attribute is absent when
capture degraded to JSON-only.

Capture degrades rather than fails: tab capture (`getDisplayMedia`, one "Share this tab" confirm)
→ neural-canvas `toDataURL` (no prompt, but misses DOM overlays) → JSON-only. Add `?snapshot=canvas`
(or set `window.__snapshotCanvasOnly = true`) to skip the prompt and force the canvas path — needed
for automation, since a headless browser leaves `getDisplayMedia` pending forever instead of
rejecting it.

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

### Systems: product links (mechanics only)

A System may recommend an instructional. Only the MECHANICS live in this public repo — commercial
terms, partner strategy and the ref itself are deliberately kept out of it.

**This section is the canonical spec** — disclosure wording, link-verification rule, funnel and UTM
contract. There is deliberately no separate affiliate doc: this repo is public, so partner strategy
and commercial terms are kept out of it entirely and the owner maintains those privately.
`scripts/check_affiliate_surface.py` (`npm run validate:affiliate`, wired into both deploy workflows)
+ `e2e/journeys/systems-surface.spec.ts` gate all of it.

- **Products live in content JSON** — `content/Systems/<System>.json` → `products[]`
  (`id`, `title`, `instructor`, `vendor`, `affiliate_url`, `link_status`, `link_checked`, `image`,
  `blurb`, `price_usd`). Rendered by `templates/Systems.md.jinja2` and served to the Neural app via
  `source/quartz/static/neural/systems.json` (emitted by `scripts/regenerate_neural_data.py`).
- **Never invent a product URL.** Every `affiliate_url` is opened and confirmed to resolve to that
  instructional before being committed. A fabricated vendor link is a broken promise and earns nothing.
- **Only a verified link renders** (v1.83.0): `link_status` (`live`/`dead`/`unverified`) +
  `link_checked` (ISO date) are schema-REQUIRED, and only `live` survives into the page
  (`live_products`) or the app payload (`_products`). Anything else degrades the system to
  `#study-this-system` — a finished, free "how do you drill this" surface, which is the case for 44
  of 47 systems. Verified 2026-08-09: 2 of the 3 authored URLs were already 404.
- **`price_usd` is NOT rendered.** Vendor prices drift (all three on file were wrong, one by 3.6x),
  and "Get it · $97" landing on a $349 checkout is the same broken promise as a dead link.
- **`graph.json` never carries `affiliate_url`.** It is the one COMMITTED artifact, in a public repo,
  and the stamp deliberately does not target it — so `regenerate_graph.py` emits products minus the
  URL plus `has_affiliate_url`. Nothing read it (`renderPage.tsx` counts renderable products only).
- **The funnel is one event on both surfaces:** `affiliate_clickout`, delegated on
  `a[data-affiliate="true"]`, with the UTM convention
  `utm_source=bjjgraph&utm_medium=affiliate&utm_campaign=systems&utm_content=<system-slug>&utm_term=<product-id>`.
  The app carried neither until v1.83.0, so the default variant was invisible to the documented funnel.
- **The ref is injected at deploy time, never committed.** Content carries the literal
  `?ref=REPLACE_ME`; `scripts/apply_affiliate_ref.py` substitutes `$AFFILIATE_REF` (a repo secret)
  into EMITTED artifacts only — `source/public/**` and the Neural `systems.json` — never into
  `content/`. This repo is public. No secret set = WARNING, placeholder kept, exit 0, so local builds
  and previews still work. `scripts/check_systems_payload.py` runs AFTER the stamp in both deploy
  workflows and fails if a placeholder survives once the secret IS set.
- **The canonical disclosure wording** lives in the block below and NOWHERE else. Both render
  sites must reproduce it verbatim; `scripts/check_affiliate_surface.py` reads this exact block as
  its source of truth and fails on any drift. Edit it here, then regenerate.

<!-- CANONICAL-DISCLOSURE:START -->
BJJGraph earns a commission if you buy through this link, at no extra cost to you. It never changes what the graph teaches.
<!-- CANONICAL-DISCLOSURE:END -->

- **Proximate disclosure is mandatory and is rendered from two places** — the app CTA shelf
  (`[data-affiliate-disclosure]` in `neural/src/app.src.jsx`) and `templates/Systems.md.jinja2`,
  above the product cards. FTC 16 CFR 255 and UK ASA/CAP require it close to the link; a site-wide
  statement in `content/terms.md` is the backstop, not the disclosure. Both copies must equal the
  wording below verbatim and render above the link, same block, uncollapsed — asserted
  offline by `check_affiliate_surface.py` and in a real browser by `systems-surface.spec.ts`.
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
