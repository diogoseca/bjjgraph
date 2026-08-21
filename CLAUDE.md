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
- `from_position` (surfaced as `fromPosition`/`fromPositionId`/`fromRole`) is the single **origin metadata**, not a second edge. `endingPosition` is a derived copy of the first `success` outcome. **`opponentTransitions` no longer exists anywhere** — the build-time mirror on `graph.json` went in Stage 6 (v1.48.2+), and the render-time replacement (`resolveOpponentMoves` in `renderPage.tsx`, injected into every position page's `#page-graph-data`) went in **v1.80.2**: its only consumer was the legacy in-browser game deleted in v1.80.0, so it was 661,594 dead bytes across 416 pages. The opponent's turn is now resolved solely by the Neural app from the role-split graph in its own bundle. Do not reintroduce a per-page mirror; derive in the consumer.

**Invariants (checked by `validate_graph_integrity.py` + the topology audit):**
- A transition has **one canonical origin** and **3–5 outcomes**; a submission's success → `game-over`.
- **`game-over` is the only sink** (out-degree 0). Every `outcome.to` must resolve to a **role-node**, a **real (non-family) submission**, or **`game-over`** — never a bare position hub, a family hub, or a self-loop.
- **Only submissions reach `game-over`** — a transition pointing directly to `game-over` is a misfiled finish (it should advance to a control position).

### ONE front-end: the legacy Quartz page UI was deleted (v1.80.0)
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
Share / ×; the per-item ▶ and ✕ live on the items — v1.103.7). Read order inside it is **arrival first**: a `[data-shared-list]` (or
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

**YOUR OWN LIST IS AS LEGIBLE AS A RECEIVED ONE (v1.99.4).** Until then the asymmetry was the
bug: `_sharedBlock` named every technique in a class a teammate sent you, while your own list
printed a name, a count and three buttons — a coach could not check their class before posting
it. Each `[data-list-row]` now carries an **inline disclosure** (the History / challenge-lesson
idiom): the **count line IS the toggle** (`[data-list-open]`, chevron `[data-list-chevron]`,
`aria-expanded` + `aria-controls`, a 44px band; it used to be a duplicate of the row's own
"light this list" click, which the row still does). Open reveals `[data-list-items]` →
`[data-list-item="<nodeId>"]` rows carrying the **FULL authored name** — `splitName().main` plus
the dimmer `from <position>` half, same rule and same shape as `[data-shared-item]`, because
"Kimura" is 35 techniques here — clicking one `openDossier`s it.
- **Removal is an explicit `×` (`[data-list-item-remove]` + `data-list-of`), never the
  `_listAddButton`.** That button's ✓/+ is defined against the ACTIVE list (`activeListHas` /
  `addToList` with no id): inside a list's own disclosure the technique is a member of THAT list
  by construction, so a toggle there would mislabel at best and, on any non-active list, would
  silently ADD it to a DIFFERENT list instead of removing it. `removeListItem(nodeId, listId)`
  is now **the** remove path — `toggleListItem`'s ✓ delegates to it — so the toast (which names
  the list and the qualified technique), the persist, the undo offer and the graph re-light can
  never diverge. A removal on the lit list re-lights the REDUCED set with `noFrame` (a removal
  is not a request to be flown somewhere).
- **Emptying a list still deletes it** (`removeFromList`'s long-standing rule) — but that
  deletion now arms the SAME `[data-list-undo]` row the two-step delete uses, via the shared
  `_armListUndo` seam. Before v1.99.4 it destroyed a named list silently, and the per-item × put
  that one click away from a list you are reading.
- **Auto-expand is the feature** ("see the listed techniques AFTER ADDING", owner): `newList`,
  `addToList` and `undoDeleteList` all expand their list, so a `+` pressed with the pane open
  lands somewhere the eye can follow.
- **Expansion is SESSION state — a `Set` (`_listExpand`), deliberately NOT a settings map.**
  `exploreOpenSections` persists because its keys are a fixed vocabulary of six section labels;
  list ids are minted per device from `Date.now()` and die with the list, so a persisted map
  would grow an unbounded tail of keys naming lists that no longer exist and sync that tail
  everywhere through per-key LWW. It is also derived, not chosen.
- `_toggleListExpand` **restores focus** to the rebuilt toggle (`_listOpenFocusPending`): a
  toggle re-renders the whole Explore body, so without it one Enter opens the list and the next
  goes to `<body>` — invisible by mouse, a dead end by keyboard.
- An empty list says so and says how (`[data-list-empty="<listId>"]`), naming only surfaces that
  really carry `[data-list-add]`: an option card, a technique's dossier, an Explore row.

**"HOW DOES IT KNOW WHAT LIST?" — THE CAPTURE PICKER (v1.99.5).** `addToList(nodeId)` defaults to
the single persisted `activeListId`, and `_listAddButton` toggled against `activeListHas()` — so
with two lists **every `+` filed into whichever was last created or touched**, destination
invisible and unchosen. Silent misfiling: nothing looks wrong until a coach shares the wrong
class. `captureNode(nodeId, surface, anchor)` is now the ONE seam every surface's `+` and both
dossier renderers route through, and the matrix is:

| state | behaviour |
|---|---|
| 0 lists, not captured | create `Class · <date>` + add. **One tap.** |
| 1 list, not captured | add to it. **One tap** — there is no second destination |
| ≥2 lists, not captured | **PICKER** (`openListPicker`) — the choice is real, so it is asked |
| already in any list | **PICKER**, at any count |

- **Why not always, when the owner named YouTube's "Save to playlist".** Canon: capture "never
  commits the move and never stops the clock" — the `+` is pressed mid-roll on an option card
  with the decision window draining, and taxing every capture with a chooser to fix a problem
  single-list users do not have is the wrong trade. The create-inline row stays reachable
  everywhere anyway, because pressing `+` on an **already-captured** technique opens the picker
  on ANY surface: "put this in a new list" is one tap from a ✓, at every list count. This also
  fixed a second misfiling — the old ✓ removed from the ACTIVE list, which with two lists could
  be a list the technique was never in.
- **THE CLOCK KEEPS RUNNING.** The picker is anchored chrome, not a screen: no pause latch, no
  pane interaction. It **closes on pick** rather than staying open YouTube-style — a menu left
  over the option tray is exactly what "never blocks the option hand" forbids — and
  `enterAttempt`, `openDossier` and `applyDeckVisibility` each close it so it can never outlive
  the surface it hangs off.
- **Placement is MEASURED, never CSS.** `_placeListPicker` reads the anchor rect, prefers above,
  flips below, and clamps both axes to an 8px inset: the anchor can be an option card at the
  bottom of a 390px phone, inside an 88vw drawer, above the thumb band. Portalled to the app
  root at **z:90** (the deliberate-screen band, beside the account menu) — inside the fixed wrap
  it would be underdrawn by the landing card at z:5. Esc closes it FIRST, before the account
  menu; a capture-phase outside `pointerdown` closes it too.
- Handles: `[data-list-picker="<nodeId>"]`, `[data-list-pick="<listId>"]` (`role=menuitemcheckbox`,
  `aria-checked` = real membership, `[data-picker-default]` on the destination, ordered
  default-first), `[data-list-pick-new]` → `[data-list-pick-newname]` + `[data-list-pick-create]`
  (Enter commits; `createListWith` names AND files in one action).
- **The destination is legible without opening anything:** `[data-lists-target]` — a permanent
  "Adding to **<name>**" line under the Lists head (owner: "be visible up top") — plus every
  capture control's own `aria-label`/`title` (`_captureCopy`), which names the target list, or
  the lists it is already in. The ✓ glyph now means **in ANY list** (`nodeInAnyList`), not "in
  the active one". `[data-lists-target]` is a STATUS, not a control: the way to change the
  destination is to pick one (or create one), and a second silent re-targeting control would
  recreate the ambiguity it exists to remove.

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
  on the standalone **`.ng-sharecue` band control** instead (v1.99.0 — the pill that hosted it is deleted): `[data-share-cue]` (`◉ N`, re-lights WITHOUT
  covering the graph, beat `list_relit`) + `[data-share-open]` (`Class ▸`, the deliberate "let me
  read it" → pane on Explore). This serves PANE LAW *better*, not worse: on the phone path nothing
  but the user ever opens the pane.
- **A LIST focus now SURVIVES a mobile pane close** (`applyDeckVisibility`): there, closing the
  drawer is how you look at the graph, not how you discard the class. Desktop keeps the original
  clear-on-close — the pane never covered anything there.
- Both cue buttons are `<button>`s inside the standalone `.ng-sharecue` host (v1.99.0) —
  `pointer-events:auto` is inline on them (it must be), which beats any inherited `none`,
  so the pill-era draft was fully
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
The site used to ship **two** front-ends to every visitor. The default was (and is) the Neural
app; the old Quartz page UI was opt-in via `?variant=legacy`. Nobody opted in, yet every page
downloaded ~1.46 MB of it — the single largest lever on a real-user LCP P75 of ~13.7 s. v1.80.0
deleted it.

**Gone, and not coming back** (do not restore any of it; do not write prose that implies it
exists): the embedded SRS/training UX (FlashcardsHeader strip, DecksModal, SettingsModal,
SessionChevrons, the per-page Flashcard) and the modules behind it (`trainingSession.ts`,
`srs.ts`, `settings.ts`, `explored.ts`, `known.ts`, `dateUtil.ts`, `gameAudio.ts`,
`explorerGraphExpand.ts`); the two in-page graphs (`Graph.tsx`/`graph.inline.ts` and
`BackgroundGraph.tsx`/`backgroundGraph.inline.ts`, the only importers of **pixi.js, d3 and
@tweenjs/tween.js**); MoveCards, OutcomeCards, VictoryDisplay, TreeExplorer, TreeDrawer,
ContentPanel, TopBar, Snackbar, RollSessionButton, SystemProgress, AffiliateTracking; the
`TrainingData` emitter (`questionBank.json` + `graphAdjacency.json`) and the
`window.loadQuestionBank`/`loadGraphAdjacency` injection; the `#graph-positions` per-page D3
layout blob (42.5% of all emitted HTML bytes) and `computePageGraphLayout`; `window.__contentStats`;
and ~4,100 lines of legacy sections in `custom.scss`.

The old localStorage keys (`bjj-srs-cards`, `bjj-settings`, `bjj-daily-progress`, `bjj-streak`,
`bjj-explored`, `bjj-banned-flashcards`, `bjj-journey`) have **no writer** any more. Neural uses
`bjj-neural-progress`, `bjj_view_mode`, `bjj_gi_mode`. The `user_training_data` columns the legacy
cloud sync wrote are still in Postgres — we stopped writing them, we did not drop them.

**`?variant=legacy` is now accepted-and-ignored.** Old links carry it; it selects a front-end that
no longer exists, so it has no effect. `/Training/* → / 301` stays in `_redirects`.

**What survives, and why it looks deletable:**
- **`AuthUI.tsx` + `scripts/authUI.inline.ts`** render NOTHING and must stay registered. That
  script is the only static importer of `supabase.ts`, which installs the **`window.__bjjAuth`**
  façade at module top-level — the seam the Neural app reaches auth and cloud sync through. It is
  also the ONLY code that completes a Google OAuth redirect-back (`hasAuthRedirectParams()` →
  `ensureClientInitialized()`); Neural's `_initAuth` only initializes when `isAuthenticated()` is
  already true, which is necessarily false right after a PKCE redirect. Deleting either breaks
  signed-in users while every headless test stays green — hence the MUTUAL-GUARD conjunction in
  `e2e/journeys/legacy-gone.spec.ts`.
- **`CategoryNav.tsx`** inside `#sidebar-overlay` — the six category links are the site's only
  persistent nav on the static surface, and the thing that replaced the Explorer's ~4,600
  per-page links. **No gate guards them.** `check_seo_parity.py` extracts its link set from the
  `<article>` only (see the `region` it derives), and `#sidebar-overlay` is a SIBLING of
  `#quartz-root`, i.e. outside the article — so the baseline's homepage links all come from
  authored prose in `content/index.md`, which merely happens to link the same six hubs. Delete
  CategoryNav and every gate stays green. Treat it as unguarded.
- **Quartz as the SSG.** The emitted HTML still carries the real `<article>`, `<head>` and JSON-LD
  for every indexed URL; Neural is an overlay on top of it (`scripts/variant.inline.ts`), and the
  static article is the fallback for crawlers, no-JS visitors and a failed bundle fetch. `/` now
  renders the same article shell as every other page (it used to emit a bare `#home-hero` with no
  `<article>` at all) — see `content/index.md`, which is authored, not generated.

**Gates that keep it deleted:**
- `scripts/check_payload_budget.py` — byte ratchet vs `tests/artifacts/budget_site.json`. Run by
  `npm run validate:payload`, chained onto `npm run build`, and a step of BOTH deploy workflows,
  placed after `Copy raw HTML folder` + `Build Forward development libraries` so it measures the
  tree we actually ship. Raising a ceiling means `--update` in its own justified commit. Since
  v1.80.4 it also gates the **neural eager set** — everything under `static/neural/` that is not
  an on-demand chunk and not in its short `DEFERRED` list — plus a chunk-size ceiling, so a
  "chunk" cannot become a monolith under a new name.
- `e2e/journeys/payload-first-hand.spec.ts` (`@curated`) — the same weight measured from a REAL
  browser: every byte the page REQUESTS before the first hand of option cards exists, against
  `tests/artifacts/budget_neural.json`. Requested, not finished: the app deals the hand without
  waiting for its deck payload, so a finished-only metric would score a background download as
  free. It also fails if a named monolith reappears on the boot path, and charges any request
  whose body Playwright cannot return at its on-disk size (that is not paranoia — the first
  version of the spec silently lost a 16MB file that way). The two gates cross-check each other:
  the Python one runs without a browser, the browser one cannot be fooled by a list.
- `scripts/check_seo_parity.py` — crawlable-surface ratchet (`npm run validate:seo`; both deploy
  workflows). Compares `<head>` + JSON-LD, crawlable text against a floor, and internal links —
  **`<article>`-scoped**, so nothing outside the article is covered.
- `e2e/journeys/legacy-gone.spec.ts` (absence ∧ the surviving auth seam),
  `e2e/journeys/crawlable-homepage.spec.ts` (the root carries real copy), and
  `e2e/journeys/static-article-layout.spec.ts` (the fallback LAYS OUT — it measures article
  geometry with JS disabled and with the bundle blocked, because "the prose is present" is
  satisfiable by a page rendering into a 450px gutter, which is exactly how v1.80.0 shipped).

**Known follow-up (revenue):** deleting `AffiliateTracking` removed the only emitter of the
`affiliate_clickout` / `related_system_card_click` / `system_page_view` PostHog events. The
affiliate links themselves are untouched and still earn; the *measurement* stopped. Re-instrument
the funnel on Neural's `data-system-cta` anchors (which today fire only
`neural_system_course_clicked`).

**Known follow-up (feature loss, disclosed v1.80.2):** deleting `SystemProgress` removed the
**"Unlock this part of the graph"** UX from all 48 `/Systems/*` pages — an honour-system progress
ring, a per-member mark-known checklist, and a "Mark whole system as known" button, backed by
`known.ts` (`bjj-known`, also deleted). Two consequences, neither of which any gate reports:
- **Analytics:** it was the only emitter of `system_node_marked_known`, `system_node_unmarked`
  and `system_marked_complete`. Those events stop. No Neural equivalent exists — Neural tracks
  mastery through SRS card stages, not an honour-system per-system "known" set — so this is a
  capability *lost*, not merely moved. Any per-system completion figure in PostHog dashboards
  goes flat from the deploy date; do not read that as a usage collapse.
- **Dead markup still ships:** the shell is emitted by `templates/Systems.md.jinja2`
  (`#unlock-graph`, `[data-system-progress]`, `[data-system-members]`), NOT by the component, so
  it survives the deletion — as does its `.system-progress*` CSS in `custom.scss`. It is inert
  rather than broken: the `<section>` is authored `hidden` and only the deleted script ever
  removed that attribute, so users see nothing. It is ~600 B × 48 pages of payload waiting for
  the chunking stream. Removing it means editing the template and REGENERATING `content/Systems/*.md`
  — content regeneration is owned outside this branch, so it was deliberately left in place.
  Do not hand-edit the generated `.md`.

### Neural data delivery: manifest boot + on-demand chunks (v1.80.4)

Field data (Cloudflare Observatory) put real-user LCP P75 at 13,764ms with 80% Poor while CLS was
0.017 / 100% Good — a delivery problem, not a rendering one. A first visit pulled **39.3MB raw /
10.1MB gzip** of Neural data before a single move was possible. v1.80.4 made it **2.4MB / 355KB**;
the graph-data wire compaction (v1.107.0, below) makes it **~1.3MB / 271KB** (browser-measured
bytes-to-first-hand: 1.57MB raw / 349KB gzip, `payload-first-hand`).

**What the app fetches, and when:**

| payload | when | notes |
|---|---|---|
| `graph-data.json` (547KB raw / 91KB gz) | boot | the graph IS the game. **COMPACT WIRE since v1.107.0** (was 1.55MB/144KB) — see the wire note below |
| `app/neural.js` + `.css` | boot | the bundle |
| `flashcards/_index.json` (155KB) | boot | the deck MANIFEST: `{deckKey: [cat, n]}` |
| `curriculum.json` (100KB) | boot | `curriculum.weights` is what `gameScore` sums — deferring it would show a zero belt |
| `flashcards/<hash>.json` (~6KB) | on demand | one deck's cards |
| `content/<hash>.json` (~13KB) | on demand | one node's dossier (`window.NG_CONTENT` is the cache) |
| `systems.json` (324KB) | first read | Explore tab + system buckets only. **No idle warm** — an idle callback fires before a hand exists, which put it straight back on the boot bill |

- **THE GRAPH-DATA WIRE IS COMPACT, AND `ingest()` EXPANDS IT (v1.107.0).** Measured per-field,
  `cal` was 45.8% of the old file (708KB) and `links`-as-id-objects another 30% (469KB) — but the
  roll-critical part of `cal` is small, so nothing gameplay-facing is deferred; the bytes
  themselves shrank (1,545,389 → 546,836 raw · 143,992 → 90,679 gzip -9). What changed on the wire,
  all expanded back to the legacy shapes at the top of `ingest()` so drawOutcome / resolve /
  calSuccess / giAllows / the edge-weight pass are untouched:
  · position `cal.moves` (336KB, the single biggest item) → **`cal.ew`**, precomputed
    `[nodeIdx, w*10000]` edge-lighting pairs. Its ONLY app consumer was ingest's `_edgeW`
    arithmetic (`attemptProbability × successRate`, max across roles, byName join) — the emitter
    now runs that exact join at build time; nothing else ever read the per-move tables.
  · technique `outcomes` → `[to, probability, s|f|c]` tuples; `successRateByRuleset` → only frames
    that differ from the scalar `successRate` (`calSuccess` already falls back per-frame);
    `endingPosition` → **dropped** (zero consumers anywhere — app, scripts, e2e).
  · `links` → `[sourceIdx, targetIdx]` pairs into the SAME file's nodes array (self-consistent,
    regenerated together; indices never leave the file — share links still ride the permanent `o`
    ordinals, which are unchanged and still on every node).
  · null keys omitted; a technique's `posId` is reconstructed as `posId || fromPositionId` (they
    were equal by construction); `fromPosition` is gone (ingest never copied it).
  Equivalence was PROVEN, not assumed: `tests/artifacts/_verify_wire_equiv.py` rebuilds the old
  emitter from git and asserts every app-visible read identical (1467 nodes, 5371 link pairs,
  3255 outcome tuples exact, 2490 ew edges within the 1e-4 quantum — which only scales edge
  lighting), and `replay-digest` produces the byte-identical beat digest on BOTH wires. Build-side
  readers of the old shapes were repointed: `draft_curriculum.py` takes move tables from
  `graph.json`, `audit_mc_viability.py` reads pair links (legacy object links still parse
  everywhere, so old spec fixtures keep working).
- **Chunks are addressed by `fnv1a32(key)`** — the app's own `qhash()`, ported byte-identically in
  `scripts/_neural_content.fnv1a32`. No filenames in the manifest (~110KB of redundancy: the key
  already names the deck) and no collision bookkeeping: a chunk holds a `{key: value}` **map**, so
  a hash collision shares a file instead of losing an entry.
- **`n` (the manifest card count) is load-bearing, not decoration.** `deckMastery` computes
  `Σ min(stage,3)/3 ÷ n` from the persisted grades when a deck's cards are absent — the SAME
  arithmetic as the resident branch, because an ungraded card contributes 0 either way. Without it
  a manifest boot reads every deck at 0, `gameScore` sums to ~0, the user is told they are a white
  belt again, and the memo on `_stageVer` makes that stick. Crowns, lesson goals, seen-glyphs,
  "mastered decks" and Challenge evidence all read the same number.
- **Hydration invalidates.** `_bumpStageVer()` is the ONE writer of `_stageVer` (grades and
  hydration share it, so the score memo can never go stale); `_qkDecks` is nulled on every
  hydration; `_onDeckHydrated` + `_restudy(key)` REBUILD an open study surface's entry, because
  `_entryForKey` takes a `.slice()` and filling `d.cards` in place is invisible to a snapshot.
- **`_cardsOf(d)` is still the only legal way to read cards.** A manifest stub is truthy.
- **MC distractors must not depend on residency.** Whether a deck's cards happened to arrive
  decides whether a draw yields a distractor and therefore how many further draws happen — network
  timing would pick the options and rigged journeys would drift. `_warmMcPool` makes residency a
  PRECONDITION: it dry-runs the pooler inside an RNG transaction (`_rngBegin`/`_rngRollback` put
  every drawn value back, `Math.random` ones included), hydrates what it asked for, and repeats
  until nothing is cold; then the real call draws from an untouched stream. A consult that was not
  warmed emits an **`mc_pool_cold`** beat — never silent. Surfaces defer their MC block by one
  fetch rather than dealing from a partial pool.
- **`buildDrillPanel` must not run over a live study surface** (`_paneStudyActive()`): it resets
  `deck`/`_drillView`, so an arriving chunk used to wipe the deck the user had just opened.
- **No `cache: "no-cache"`.** The edge serves these with Cache-Control tiers
  (`scripts/regenerate_headers.py`); forcing revalidation threw the one free win away.
- **One source of truth for cards.** No monolith is emitted anywhere. Tooling that needs the whole
  corpus (the exhaustive `validate:mc` audit, tests wanting full residency) assembles it from the
  chunks via `scripts/_neural_decks.py` / `e2e/decks.ts`.
- **Journeys exercise the real path.** `e2e/dsl.ts` serves the manifest and chunks from per-worker
  buffers; `j.hydrate(keys)` / `j.hydrateAll()` / `j.decksSettled()` let a test say when it wants
  residency instead of assuming it. `scripts/triple_replay.sh` proves three consecutive runs of
  golden-path, jit-loop, mc-flashcards and landing-card are identical, plus a full beat-stream
  digest of one scripted roll (`e2e/journeys/replay-digest.spec.ts`).

### Neural: pane law, landing questions, Challenges, Game Knowledge (v1.68.0+)

The runtime remains one imperative component in `neural/src/app.src.jsx`. Challenge definitions, pure progression, UI composition, feedback, and styling are split into `neural/src/challenge-*.src.js` and `neural/src/challenge-*.css`, then composed by `neural/build/build.mjs`. Core journeys include `pane-law`, `landing-card`, `roam-stage`, `white-challenges`, `challenge-curriculum`, `content-capstone`, `game-knowledge`, and `challenges-{engine,ui}`.

**ONE PANE (v1.76.0; LEFT since v1.94.0).** The left explorer rail is gone — **one pane, anchored LEFT** (`.ng-drill .ng-explorer`, 360px, `left:0`, z:8, display-based visibility, both classes on the one element for spec continuity; it opens from the top-left logo, so it lives on the logo's side) carries three tabs: **Explore | Challenges | Last rolls** (`.ng-learning-nav`, `data-view`; the third tab DISPLAYS "Last rolls" since v1.95.0 — "History reads as the history of BJJ", owner — while its view id, settings keys and every internal seam stay `history`). The `.ng-knowledge-header` section is GONE (v1.96.0 — with the tab subtitles it triple-stated the score): the woven knowledge belt + band road + "N% to blue" line live at the TOP OF EXPLORE'S BODY (`_knowledgeBlock`, `[data-knowledge]`), above the stats row; the nav is the pane's first child and carries the 64px logo/close clearance. Each tab is two-line (v1.95.0, `renderTabSubtitles`): a `<b>` title over a `<small data-tab-sub>` subtitle — Explore carries "Mastered N%" (the Game Knowledge score — word first, integer percent, v1.95.2), Challenges a miniature `.ng-tab-belt`, Last rolls a static "Your last rolls". The history tab hosts the roll history with inline decks (the old "Daily flashcards" hero bar is deleted; the score shows only as the Explore tab subtitle since v1.98.1). `explorerRef` is an alias of `drillRef`; `toggleExplorer`/`openExplorer` remain as names (logo, cue, keyboard all route to `openPane(view)`). Geometry consumers flipped with it (v1.94.0): the option tray pads LEFT (`updateUiShift`), the option-detail sheet centres on `sbW + (w−sbW)/2`, the follow-cam biases the focused node RIGHT of centre (`cx: f.x − offset`), and the study head carries a 64px top pad (`!important` over its inline style) so `‹ Back` clears the logo that now shares its corner.
- **Two body modes** via `_layoutPane()`: tabs mode vs **study takeover** (a live `deck`/`_session`/`_checkpoint` — `_paneStudyActive()` — hides the nav; `data-pane-study` on the pane; the study header's `‹ Back` (`data-pane-back`) returns to `_paneReturnTab`).
- **Pane bottom anchor (v1.93.0; final stack v1.98.1, styled v1.99.1):** the guest save nudge is a three-level unit — kicker caption `[data-anchor-caption]` "Save your progress", full-width primary `[data-anchor-auth]` "Create account" (44px, the block's one visual anchor), centered quiet escape line `[data-anchor-alt]` "Already have one? Log in" (44px link) — styled by the `.ng-anchor-*` classes in `helmet.html` (hover/active/focus-visible states; do not regress to inline styles) — ONE block (`.ng-pane-anchor`, `[data-anchor-auth]`/`[data-anchor-login]`) at the pane's foot, directly above the Settings/Terms/Privacy row — visible on all three tabs, hidden during study takeover and collapsed entirely when signed in (it is then contentless). The mastered/today/weak-spots stat row moved to the TOP of Explore's body (`_exploreStatsRow`, `[data-explore-stats]`, same `.ngStat` handles) — "the weak spots are the call to action" there (owner, v1.95.0). The History head is empty (the drill head is study-only now); signed-in users keep their session CTA + Log out in the Last rolls foot.
- **Two belts, two meanings (v1.95.0 — do not conflate):** the **score's** display rules (white is the FLOOR — never "0% to white", always "to blue") belong to `gameScore()` consumers; its woven belt VISUAL is retired (v1.98.1, owner — header died v1.96.0, the Explore mount followed; renderer in git history at v1.96.0 if a home is ever wanted). The score's one exposure is the Explore tab subtitle "Mastered N%". The old canon for reference: the knowledge belt rendered `gameScore()` — and WHITE IS THE FLOOR, never a target: the cold state wears the white belt whose displayed road spans the whole 0→blue stretch ("there is never 0% to white. It's always 0% to blue", owner; `gameScore()`/`BELT_SCORE` math untouched — display semantics only; white's tape stripes are quarter-marks of that displayed road, held belts wear `gameScore().stripes` exactly). The **Challenges-tab mini belt** (`.ng-tab-belt`, `data-tab-stripes`) wears the PINNED track's color with 0-4 stripes from that track's PROVEN-UNITS fraction (`unitComplete`: lessons done + checkpoint — v1.95.3; the objectives fraction was too generous, coach auto-ticks gave a guest unearned stripes) — LADDER progress, deliberately NOT `gameScore().stripes`.
- **Wiring seam (v1.93.0):** `_wirePaneControls()` runs at the choke point — `applyDeckVisibility()` on the open transition — so EVERY open path (openPane, openHomeToLatest, openMenu, openStudy, chip, pill, landing chip) gets live tabs. It used to live only in `openPane()`, which left the tab bar dead when a session's first open came through the account chip.
- **▶ BELONGS TO A TECHNIQUE, NOT TO A COLLECTION (v1.103.6, owner: "that play button should be reserved for techniques inside lists and outside of it, meaning positions, transitions, and submissions").** ▶ means *make this the current state and roll*, which you can do to a position or a technique and cannot do to a list — a list is a collection, like a System. So `_playButton(node)` now rides **every technique row**: Explore's Positions/Transitions/Submissions rows (via `_withListAdd`, which only `renderGraphGroup` and the search hits reach — Systems, Principles and Learning use different builders and stay play-less), a list's own items, and the shared-class preview's items. Family fold rows carry none: a family hub is an edgeless aggregator, not a state. `confirmPlayFrom` is the seam because it already handles every node type (a position seeds at itself, a technique at its origin position) **and it confirms first** — pressing ▶ in the pane mid-roll discards the roll you are in, so it must ask. Handle `[data-play-from="<nodeId>"]`, 24px (the pane figure), `aria-label` "Play from <name>" because a `title` is not an accessible name.
  - **A LIST ROW HAS NO DRILL CONTROL AT ALL (v1.103.7, owner).** `openListSession` opens a FLASHCARD session over the list's cards and never touched the roll, so its ▶ wore the wrong verb; v1.103.6 moved it to a stacked-cards glyph and the owner then deleted the button outright. A list row is now exactly **light it (the row) / read it (the count line) / share it / ×** — every verb that acts on ONE technique lives on the item that carries it (▶ and its own ✕). `openListSession` is **not dead**: `[data-shared-drill]` ("Drill these") still runs it on a RECEIVED class, which is the case that needs a one-press study path before the list has even been saved. That is the only caller left; deleting it would take the received-class study path with it.
- **THE CATEGORY SHAPE RIDES EVERY TECHNIQUE ROW (v1.103.6).** `nodeGlyph` and the canvas `draw()` (`:9516-9518`) share ONE vocabulary — **circle = position, triangle = submission, diamond = transition** — and two row types were not speaking it: Explore's **leaf rows inside a family fold** rendered no glyph at all (the one place in Explore that did not say what a technique was), and a **list's items** had none either. Both now call `nodeGlyph(n.ty, col, 7)` — 7px at pad 38 against the family row's 8px at pad 22, so the size tracks the ladder. NB when testing: the triangle is a CSS-border trick, so with `box-sizing:border-box` its computed `width` is **8px, not 0** — identify it by its transparent left/right borders, never by width.
- **LISTS ARE EXPLORE'S LADDER, NOT CARDS (v1.103.5, owner: "the style doesn't feel like the Positions category at all").** The Lists section is built from the SAME three-rung indent every other Explore group uses (`renderGraphGroup`'s `mk(html, pad, onClick)`, `padding:7px <pad>px`): head **pad 12** (14px/700 #dbe2f0 + a bare count), each list **pad 22** (13px/600 #c4cde0, count 10.5px, chevron 10px last) exactly where a family row sits, its techniques **pad 38** (12px #9aa6bd, the `from …` qualifier in #6b7691) exactly where a leaf sits. No card chrome, no glyph on the item rows — `Your lists (2)` now reads as a peer of `Systems (47)` and `Positions (136)` in the same scroller, which is the whole point.
  - **The pane's control figure is 24px, and 44 is for the surfaces a THUMB uses mid-roll.** `_listAddButton` already stated this rule and Explore's `+` has been 24×24 on all 136 Positions rows the whole time; the Lists section was the one part of the pane pinned to 44 (by its own v1.99.4 specs), which is what made its rows 58px among 38px neighbours. Row controls — ▶ play, share, ×, and the per-item × — are now **24×24** like Explore's, so a row with controls lands at `7 + 24 + 7 = 38px`, Explore's own height wherever a `+` rides. 24px is also WCAG 2.2 AA (2.5.8 Target Size Minimum); 44 is the AAA/HIG figure and stays where it belongs — the option hand, the escape hand, the landing card, hit one-handed on a moving screen.
  - **Glyphs stay small, hit areas grow** (`.ng-lists-new`'s pattern): the count-line toggle is 10.5px text + a 10px chevron, which is an **18×12** target if you let type size the button. `padding:6px 5px` with a matching negative margin buys 28×24 without touching the type or the row height. Do not size a pane control by its glyph.
- **Lists (v1.97.0; chrome pass v1.99.3):** the `+` beside "Your lists (N)" (`[data-lists-new]`, aria "New list", 44px hit area) is THE deliberate list-creation control (it replaced the static "share a class" caption; `newList()` stays the one creation function — default name "Class · <date>", newborn becomes the active add target and its row highlights; per-list Share untouched; no `?capture=today` deep link exists in source). Explore's `keepList` reset-survival accepts owned lists (even empty) AND the `__shared` preview. **The + is a house-styled chip (v1.99.3, owner: the bare glyph "looks ugly as fuck"):** `.ng-lists-new` is the transparent 44px hit target, `.ng-lists-new-chip` the compact 28px visual in the segBtn token family, states in helmet.html CSS per the `.ng-anchor-*` pass (hover brighten, 1px active press, focus-visible ring) — no JS hover painting, do not regress to a bare glyph.
- **Inline rename (v1.99.3, owner: "I can't seem to click to rename my lists"):** a row's NAME (`[data-list-name]`, a real button, cursor:text) opens the editor; the ROW body (and the `[data-list-open]` count line) lights the list via `focusList`. The editor (`[data-list-rename]`, maxlength 60) commits on **Enter/blur**, cancels on **Esc** (its keydown `stopPropagation`s so Esc never walks the pane's Esc ladder and letters never hit global shortcuts), and an empty/whitespace/unchanged commit is a no-op revert (`renameList`). A REAL commit bumps the list's `t` — the cloud merge's name-from-later-t rule is what carries renames across devices — and re-sorts the list to the top. **The newborn from + opens straight into its editor** (prefilled, selected — naming is offered, never demanded). Three hard-won guards, all pinned by `e2e/journeys/lists-rename.spec.ts` (10 journeys incl. 390px drawer): (1) **a blur from DETACH is not a decision** — unrelated re-renders (the deferred systems.json arrival ~1s into a fresh profile) wipe the Explore body, and Chrome dispatches that blur while `isConnected` still reads TRUE, so the commit decision is deferred one real tick; (2) the editor **survives re-renders**: `_listEditDraft` carries typed text through a rebuild and refocus restores select-all when untouched / caret-at-end mid-draft; (3) a click that lands while (or within 400ms after — blur precedes click) the editor is open must NOT light the list (`_listEditClosedAt` latch).
- **Explore sections default COLLAPSED (v1.99.3, owner: "showing all categories should be collapsed"):** every top-level Explore section — Systems, Principles, Positions, Transitions, Submissions, Learning — starts folded; headers carry `data-explore-section="<label>"` + `aria-expanded`. Expanding/folding persists per section in ONE settings map, `exploreOpenSections` (the `challengeOpenSections` pattern — per-key LWW, cross-device, reload-stable); collapse is presentation only, nothing locks. The old `_exp.g` session set (which pre-opened Systems + Submissions) is gone; family sub-folds (`_exp.f`) stay session-local. **Search is deliberately untouched:** a query renders FLAT ranked results before any section exists, so a match inside a folded group is never hidden. Gated by `e2e/journeys/explore-sections.spec.ts`; `systems-surface.spec.ts`'s `openExplore` helper now expands the Systems header first.
- **Corridor chrome (v1.98.1; v1.99.2):** belt headers wear their dye PRONOUNCED (`--ng-track-soft` at 0.34 across the whole card, `--ng-track-line` border) and a **completion stamp** — a gray boxed-check watermark (`.ng-belt-stamp`, z:-1 behind the header text, `data-belt-complete`) once every live lesson is done; the Tutorial head stamps the same way at 20/20 (`data-tutorial-complete`). The header pin (`[data-belt-pin]`, v1.98.1) lived one version and is gone. Also: the `.ng-challenge-detail` HEAD (the "CHALLENGES / <name> / N of M" double title) and `.ng-detail-up` are deleted for every belt — the detail is a headless objectives block (advanced belts only; White's objectives ARE the Tutorial section). Pinning lives ON the belt header row (`[data-belt-pin]`, 44px, aria-pressed; `.ng-pin-track` is gone). No border-top separators inside a section (corridor + spacing do the structure). The **Continue button is dead** — opening the tab AUTO-SCROLLS (instant, open-only, `_challengeScrollPending`) to the pinned belt's header with the frontier row kept fully in view (minimal extra motion when the section opens taller than a viewport); corridor re-renders preserve `scrollTop`. The **Tutorial** section (renamed from "Getting started", belt-header lettering) defaults FOLDED at any progress (the ≥14 threshold is dead); its still-to-see chips ride the head row right of the title (`.ng-tutorial-chips`, clipped with a fade).
- The GI/NO-GI choice lives in **Settings → Rolling only** (`[data-settings-gi]`, v1.95.3 — the per-tab `.ng-gi-toggle` pill is gone; `setGiMode` unchanged). Last rolls explains its empty case (`[data-hist-empty]`, "No rolls yet — press play…") — roll history (`rollLog`/`_pastRolls`) is in-memory and has never persisted across reloads — the replay (v1.106.5) reads only what is already there and adds no persistence.
- View state: `challengeView` ∈ `explore|challenges|history`; legacy `tree→explore`, `path`/`collection`→`challenges`. Roll-advance re-renders of the History body are gated on `_viewMode === "history"` so an open Explore search is never stomped.
- Mobile: ONE 88vw drawer (from the LEFT edge since v1.94.0; strip-tap dismiss on the exposed right strip unchanged). The `.ng-drilltab` pill is DELETED (v1.99.0, owner: it must not appear on any form factor) — the account chip holds the bottom-right band seat (`bottom:28/right:14` on the phone, exactly like desktop's corner ownership; the drawer-open fade stays) and the LOGO is the one pane opener. "Study this state" (openHomeToLatest) survives on the landing card's familiarity chip `[data-land-count]`.
- **Account chip (v1.93.0): BOTTOM-right** (desktop `bottom:24;right:24`; phone `bottom:86;right:14`, stacked above the thumb-band pill). Since the pane moved LEFT (v1.94.0) the chip fades ONLY on the phone drawer (which owns the screen; the fade keeps the dismiss strip tappable) — on desktop it stays put and clickable while the pane is open.
- **Account menu (v1.94.0)** — the "NO account menu" canon is retired. The chip opens a compact `.ng-account-menu` anchored above it: signed-out `Create account` + `Log in`, signed-in the account email (non-interactive) + `Log out`; ONE separator; then `Settings`, `Keyboard shortcuts` (Settings → Shortcuts tab), and `Terms · Privacy`. Nothing else. It is CHROME: opening it never touches the pane, the pause latch, or the roll clock. Esc closes it FIRST; any outside tap closes it (capture-phase pointerdown, so propagation-stopping surfaces still count). The open menu PORTALS to the app root at z:46 — the fixed wrap is its own stacking context, so root-level overlays (landcard z5, coach z70) would otherwise bury it. The pane opener is the LOGO only; the pane's bottom anchor + footer keep their auth CTAs for now (redundant with the menu — owner to decide). The Settings modal still carries Terms · Privacy (`[data-settings-legal]`).

**PANE LAW (v1.68.0).** The pane is **manual-only** — nothing in the roll loop opens or closes it. It no longer opens at roll start, no longer opens as a save nudge, no longer hides at round end, and desktop graph clicks leave it alone (mobile keeps the strip-tap dismiss, since the pane covers the screen there).
- **Open = the game stops. Close = the game resumes, but only if the pane is what stopped it.** Latched in `applyDeckVisibility()` via **`_paneAutoPaused`** — one latch for the whole merged pane (any tab, any study surface); `_dossierAutoPaused` stays separate for the node dossier. A hand-paused roll stays paused when you close the pane.
- Latched in `applyDeckVisibility`, not `setDeckOpen`, because several study entry points assign `deckOpen` directly. Beats: `pane_paused` / `pane_resumed`. Esc closes the pane last, once no overlay is up.

**QUESTION-FIRST LANDING (v1.68.0).** The flashcard is no longer a place you go — it is what the game asks on arrival. `renderLandCard(node, mode, hooks)` docks `.ng-landcard` above the options tray in fixed read order: **identity** (`[data-land-id]`: name · where you came from · Top/Bottom or Attacking, with ONE top-right familiarity chip `[data-land-count]` — the ○/◐/● seen-glyph fused with the deck's recall-proven count, e.g. `● 3/8`; glyph-only when no deck is authored; clicking it opens this state's flashcards, v1.76.0) → one-line definition → **film** → **ONE multiple-choice question** (`[data-land-q]`) → your options → **`More ▸`** (`[data-land-more]`, which since v1.101.0 UNFOLDS THIS CARD rather than opening a dossier — see ONE CONTAINER below, where the identity block's fate is also recorded: a landing card no longer prints the name or the side, because the graph does). The `.ng-drilltab` pill is fully DELETED (v1.99.0 — quieted in v1.93.0, gone now): the landing chip opens "study this state", the logo opens the pane, and the save hint is a toast + the in-pane CTA (no shake target).
- There is deliberately **no second question** at the technique node between commit and sweep. It was built and cut: gating the sweep on a 4s window added that delay to every move (and broke `golden-path` / `jit-loop` on tempo). The landing question already moves the odds of the very transition or submission you are about to attempt, and the sheet's JIT drill covers buying odds right before committing.
- **Economy, one rule on both surfaces:** right → the ordinary credit path (`noteCardDone`: mastery + sharpness already move the odds — no second bonus) plus `refundDecision(2500)`; wrong → `_qMod` −0.04 (plausible) / −0.08 (trap), folded into `moveChance` and **cleared on the next `enterLand`**. Timing out costs nothing.
- `questionFor(key)` picks the deck's first unproven card (`cardStage < 2`); a proven deck asks nothing.
- **The card BACKFILLS when a late payload lands (v1.82.1).** Decks and dossier content are deferred, and on a measured Fast-4G cold load they arrive ~18s AFTER the first hand — so a first-time visitor used to take their opening decision with no question, no definition and no film, and the ready hooks refreshed the drill panel/odds/tab but never the card, leaving that state silent for its whole turn. `_landBackfill()`, called from `onFlashcardsReady`/`onContentReady`, re-renders the LIVE card in place; `land_q_shown` carries `backfill:true`. It refills only a card that has **never shown a question** (`!_landQ`) on the **current** position with a live decision window — a question already on the table is frozen, because re-mounting an answered one would hand out a second attempt at credit already scored. Arrival TIME is journey 1's payload work; this is what makes it visible.
- **MC is the in-play format; the sidebar is the study surface.** `mcMode` default flipped `auto` → **`classic`** — nobody meets multiple choice in the sidebar unless they opt in. The checkpoint quiz stays MC always.
- `_mcBlock(card, key, onDone, surface)` — truth lives in the closure + `this._mc` (never a DOM attribute); `surface` (`land` | `deck`) lets two blocks coexist, and only `deck` auto-advances. **`surface` also scopes the RNG**: the landing card draws on `land-mc-pick` / `land-mc-shuffle` so it can never eat the rigged `mc-*` queues the sidebar journeys depend on (this is what kept `golden-path`'s frame-exact replay honest).
- **Keys: `A` `B` `C` `D` answer the live MC block; digits `1–9` stay the option-card openers.**

**A STALLED PAYLOAD LEFT THE LANDING QUESTION "STILL SETTLING" FOREVER (v1.104.8).** Fixing the harness glob (v1.104.6) exercised, for the first time, the case the cold-start journeys were written for — and the app failed it. `renderLandCard` stores the MC warm-up promise in **`_landWarmP`** as the "the question has stopped moving" signal, and `landSettled()` awaits it. `_warmMcPool` awaits deck fetches, so on a **stalled** connection (a socket that never completes, which is what `{ never: true }` models — not a 404) the promise never settled, the signal never cleared, and every reader waited forever: eleven journeys went from failing in ~1s to timing out at 120s. It survived for months only because the rule meant to reproduce that connection named a URL the app never fetches, so the case was never run.
- **The SIGNAL is bounded (`NG_LAND_WARM_CEILING_MS` = 8s, wall clock — a stalled socket stalls in real time); the WORK is not.** The fetch is never cancelled, `p` still re-renders the card if the payload eventually lands, and `_landBackfill` covers it independently — so a slow-but-working network behaves exactly as before. On timeout the app emits **`land_warm_stalled`**, so "no question here" always has a named cause rather than being a phantom.

**THE HARNESS WAS HOLDING A PAYLOAD THAT IS NEVER FETCHED (v1.104.6) — root cause of 15 red journeys.** Every cold-start spec armed `boot("/", { payloads: { "flashcards.json": {...} } })`. A bare pattern is a SUBSTRING match over the request URL (`globToRe`), and the app has fetched **`flashcards/_index.json`** since v1.80.4 (`app.src.jsx:442`, via `_dataBase()`) plus per-deck `flashcards/<hash>.json`. `"flashcards/_index.json"` does not contain `"flashcards.json"`, so the rule matched nothing: the payload was never held and every assertion about the 18s cold-start skew was measuring a fully-warm boot. 12 rules + 3 timeline predicates repointed.
- **The same dead name hid in `build.mjs`.** Two of its four `fetch()` rewrites (`flashcards.json`, `systems.json`) could not fire — both call sites build their URL through `_dataBase()` — and the guard only warned when **every** rule missed, so a rule going stale was invisible. The rewrite table is now iterated per rule and **throws** on any `from` string absent from the source, because a rewrite that cannot fire silently stops prefixing `__NEURAL_DATA_BASE`, which is exactly how the harness serves its fixtures.
- **CORRECTION to v1.103.0:** `check_position_type_vs_score` never ran. `scripts/validate_graph_integrity.py` used `os.path.dirname` without `import os`, the `NameError` hit a bare `except Exception: return issues`, and the check returned empty on every run — so "0 disagreements across all 272 position-roles" meant "the check never executed". With `os` imported the real figure was **95 `position_type_score_disagreement` warnings**: positions where the authored dominance word disagrees with the arithmetic. The word still wins (v1.103.0 canon); these are content questions, not code ones. The skip path now prints instead of returning silently. **Re-measured 2026-08-21 (v1.120.0): it is now 49, and classed `info`, not `warning`** — the calibration waves closed 46 of them. The gate's headline is `Errors: 0, Warnings: 7` (`counter_high` 2, `technique_range_low` 4, and one from the bidirectional `from_position` check), with 345 `info` of which 295 are `attempt_negligible`.

**CI THAT COULD NOT PASS, AND GATES WEAKER THAN THE THING THEY GUARD (v1.104.6).**
- **`e2e-full.yml` packaged an incomplete site — the PR gate for BOTH `main` and `dev` could not pass.** It tarred six allow-listed paths; the specs added since need `public/l.html`, `_redirects`, `l-manifest.json`, `/Positions/*`, `/Systems/*`, `/sitemap.xml`, `/llms.txt`. Now `tar -czf … -C source public`. **If size ever bites, use `--exclude`** — a new emitted path must be packaged by default, because an allow-list rots silently and this one predated every spec that broke on it.
- **`votes-refresh.yml` committed a `graph.json` with the strength pass skipped**, stripping `strength` from **4,464 of 4,465 nodes**. It ran bare `regenerate_graph.py`; it now runs the `npm run regenerate:graph` umbrella (graph-base → layout → ordinals → strength). CI must never run a subset of the chain a human runs.
- **The PR ratchet was weaker than the deploy gate it protects**: `graph_validation_baseline.json` allowed **76** errors while both deploys hard-fail on the first. Actual errors are 0, so the baseline is now **0**.
- `ci-validate.yml`'s `paths` filter omitted `globalGraphLayout.json` — the INPUT its own ordinal gate reads — and `neural/src/**`, which `test:units` pins. Both added.
- `keepalive.yml` has **never committed anything**: `git diff --quiet` reports no change for an UNTRACKED file, so the anti-auto-disable job always took the "nothing to do" branch. Now `git status --porcelain`.
- Node **20 (EOL) → 22** in the three build/test workflows (ci-validate was already 22); `seo-monitor.yml` runs Python with **no `setup-python`** step (added); **`serve`** — the web server every e2e gate depends on — was declared only in `package-lock.json` (now a real devDependency).

**ONE "START A ROLL HERE", AND THE URL FOLLOWS IT (v1.104.5).** Owner: "i clicked the play from this roll in one of my last rolls sidebar and it didnt open the MC nor position the graph … why wasnt this calling the same method as when navigation happens? i thought this had been streamlined". Three separate causes.
- **`playFrom` was a SECOND, STALE implementation of `rollFromPosition`.** It hard-coded `camTarget = { cx, cy, vw: this.graphW * 0.42 }` — the exact framing v1.103.2 replaced everywhere else with `rollCamTarget()` — so a roll started from the search modal or the "Roll from here" confirm landed on a different composition (≈5× zoomed out, no lift into the free band, not aimed at the node's label, no horizontal bias) than the identical action taken by clicking the node. It also never archived the roll it replaced into `_pastRolls`, never reset `rollLog`/`_lastActor`/`_currentDeckKey`/session state/`_played`/`prevPosVal`, never called `hideCenter()`, and landed via `enterLand(false)` so the new roll's opening state was not marked as a start. It is now a two-line wrapper; `rollFromPosition(nodeIdx, staged, roleOverride)` gained the ONE thing playFrom legitimately added — a caller-chosen role, which cannot be derived because every position title ends "… Top".
- **The pane hid what the button produced.** Pressing play in Last rolls DID roll and DID frame the camera — behind the pane, which pauses the roll (pane law) and since v1.101.7 stands the landing card down at every width. The button now `setDeckOpen(false)`: pane law forbids the ROLL LOOP touching the pane, and this is the USER pressing play, i.e. the "close = the game resumes" half of the same law.
- **THE URL NOW FOLLOWS DELIBERATE NAVIGATION.** Every graph node id IS a real page path — **1466 of 1467 ids resolve to a built page** (the miss is `Transitions/100%-Sweep`, whose `%` cannot survive a filename) — so `_syncUrl` needs no mapping table and cannot drift from the site. `pushState` fires ONLY from `rollFromPosition` (a node the user chose); a roll's own moves never touch the URL, because the site's PostHog snippet captures `$pageview` on history changes (Quartz's SPA router navigates by pushState too) and syncing every auto-advance would multiply pageviews by the length of a roll. `popstate` walks back through the nodes you chose, and arriving ON a node's page seeds a STAGED roll there (`_seedFromUrl`) — `/` is deliberately untouched, so the first-impression weighted draw still owns the front door. A `/l/<code>` path is never rewritten: the recipient path parses `location.pathname`.

**THE `cal` JOIN WAS SPELLING THE KEY WRONG, AND 294 OF 297 SUBMISSIONS SHIPPED NO ODDS (v1.115.0).**
`graph.json` keys a technique by `slugify(<display name>)` — ONE flat kebab token. A layout id keeps
the authored PATH, so `Submissions/Kimura/from-Front-Headlock` reaches `enrich()` as
`kimura/from-front-headlock`, and that `/` is the `-` the key was built with. The emitter only ever
tried the first spelling. **0 of 297** submission keys in `graph.json` contain an inner slash.
- **Nothing went red for months, by construction.** A missing `cal` does not crash — `calSuccess()`
  returns null and `moveChance` falls back to `0.36 + dom*0.1` (`app.src.jsx:10371`). Because every
  submission's dominance sits in a narrow band, all of them printed **~45.5-45.7%**. MEASURED: the
  "Success rate" on **~289 of 1,204 dealt option cards** was fabricated, standing in for authored
  rates that actually span **10-74%**. `graph.json` was right the whole time; only the wire was
  starved, so anything computed offline from `graph.json` was always trustworthy.
- **`_tech_keys(slug, title)` is the fix: three rungs, cheapest first, and the last is the key's OWN
  CONSTRUCTOR rather than one more guess about spelling.** `as-is` (3 submissions + 1031
  transitions) → `slash→hyphen` (291 submissions) → `slugify(title)` (3 + 3: punctuation an id
  cannot carry — `100%-Sweep` → `100-percent-sweep`, "Fireman's-Carry" loses its apostrophe).
  Together **1331 of 1331**. The SAME ladder feeds `tech_avail` (which `giAllows` reads), lifting it
  **1033 → 1327**; the 4 that stay unmatched are techniques no position offers, so there is no
  availability for them to carry. Positions keep `_pos_role` — a position's leaf IS a slug, a
  technique's leaf (`from-mount`) is not, which is exactly why they cannot share a ladder.
- **The emitter now refuses to write a wire that has lost its calibration** (<95% per type, printed
  every run). A silent join is invisible by definition; it gets counted at the one place that can
  see it. Measured after: submissions **297/297**, transitions **1034/1034**.
- Payload **+46,605 raw / +3,321 gzip** → 1,371,502 / 1,600,000 and 281,649 / 330,000. **No ceiling
  raise.** Replay digests are byte-identical: the extra `rng("outcome")` draw a repaired submission
  can consume only fires on a FAILED submission, which the scripted rolls do not hit.

**ARRIVING ON A NODE'S PAGE SETS THE BOARD; IT DOES NOT START A ROLL (v1.114.2).** Owner, on
`/Positions/Side-Control/Bottom?dual=iso`: *"it seems like immediately after I go into this ... it
restarts the roll. It says 'Restarting the roll', so it leaves no time for me to stay in this
position. In fact, we should stay at this position. The graph should navigate to it, meaning
visually we should be zoomed in at this position so that its node shows up above the ng-landcard,
and it should start paused ... only start a new roll in roll history if the player clicks the play
button explicitly."* Three defects, and PRODUCTION WAS WORSE THAN THE PROTOTYPE.
- **All 272 role pages resolved to NOTHING in production.** The visual layer collapses Top/Bottom
  into one hub (`Positions/Side-Control`) and only `?dual` emits role members, so `_nodeForPath`
  returned **-1** for a REAL built page and the visitor got a random weighted start on the wrong
  side. `_nodeAndRoleForPath` now falls back to hub + side and carries `/Bottom` as the **role**;
  a `?dual` member node still resolves directly and its own `role` is used. A **technique** page
  seeds at its ORIGIN position (the `confirmPlayFrom` rule) — `currentPos` must be a position or
  the roll begins inside a transition node with no hand to deal.
- **`_urlSeeded` was assigned at boot and read by nothing.** `updateCamera` called `startRoll()`
  unconditionally when the intro finished, 3.2s after the seed ran at ingest — which drew a fresh
  position and printed "Restarting the roll" over it. The seed is now only RECORDED at ingest
  (plus the deck prefetch, since the intro is still its runway) and applied at the one place a
  boot roll begins. Deliberately **not** via `stageRollAt`: that fires `roll_staged`, which is the
  White objective *"Start a roll here"* whose own copy is *click any node on the graph to roam
  there* — typing an address is not that, and crediting it would be the retired coach's false tick
  all over again.
- **A STAGED BOARD NOW KEEPS ITS FRAMING.** `rollCamTarget` measures the free band between the
  announce block and the landing card, and a fresh landing builds that card 0.6s AFTER the frame
  is computed — so the auto-retarget suppression that protects a hand-paused roll ("never yank the
  camera the user is reading with") froze an answer taken before there was anything to measure.
  Measured on this very URL: node bottom **371** against a card top of **370**. `stagedIdle`
  (`_staged != null && !_played && paused && !_replay`) keeps a never-played board tracking; a pan
  (`userActiveNow`), a camera lease, or pressing play each take it back through guards that were
  already there.
- **`/` is untouched** — no node named, nothing seeded, and the first-impression weighted draw
  (v1.82.3) still owns the front door, running.
- Gated by `e2e/journeys/url-arrival.spec.ts` (5 journeys, 1 `@curated`), four mutants, four kills.
  **Harness note worth keeping:** the landing card ANIMATES IN, and a camera read taken inside one
  `advance()` describes nothing — measured, the card's top was still 588 on the frame the camera
  last aimed against and reached 376 on the next. A second bare `advance` is NOT enough; an
  intervening `page.evaluate` is what forces layout and lets a frame render between pumps.

**A DUAL PAIR IS ONE STATE WITH TWO HALVES (v1.114.3, `?dual` prototype).** Owner: *"I like to
see both variants ... above the videos we should see the two circles ... the position should be
rather centered on the middle of the two icons, not the actual icon that's active, so that both
icons appear ... the main label stays positioned in the middle on the right, and the active role
appears above or below it ... it's not two labels, it's just one group of labels that's dynamic, in
which the subtitle's position seems to appear depending on where you are."*

**THE ROOT CAUSE OF ALL THREE DEFECTS WAS THE SAME: code reading `n.y` where the renderer draws at
`LY(n)`.** `LY` lifts each member off the pair's shared ground by `z * h * (1 - nodeK * kLOD)` —
~37px per member at roll zoom — so `n.y` is simply not where the orb is.
- **`pairMid(n)`** is the new seam: the DRAWN midpoint of the two members, or the node's own drawn
  point when it has no partner — so every production node (no `pairId`, no `z`) is unchanged *by
  construction*, not by a flag check. `camFocus` is now `pairMid`, so the camera holds the PAIR.
  Measured before, on `/Positions/Side-Control/Bottom?dual=iso`: the Top orb sat at screen **y=5**,
  effectively off the top edge, while the free band was 76..268. After: 99 and 173 around a
  midpoint of 136, both clear of the film strip at 268. `rollCamTarget`'s submission `labelOff`
  (which compensates for a triangle's low in-shape label) is skipped for a pair, since the name is
  drawn on the midline.
- **`this._LY = LY`** is published each frame so `pairMid` uses the exact lift the frame just drew
  with. ONE definition; the hot loop still calls the local.
- **THE TAP HANDLER WAS BROKEN, NOT JUST HOVER.** `_updateHover` compared against `n.y`, ~37px from
  the visible orb against a **28px** pick radius — and `attachInput`'s pointerup runs through that
  same function, so clicking a visible orb in `?dual` matched NOTHING and fell through to
  `_tapBackground()`. It now hit-tests `ly(n)`.
- **ONE LABEL GROUP, AND THE SUBTITLE'S SIDE IS THE SIGNAL.** The NAME never moves — it sits on the
  line equidistant between the orbs, which is what makes above/below mean anything — and the
  subtitle renders ABOVE for the top/attacker half, BELOW for the bottom/defender half. Hovering
  either orb moves the subtitle and nothing else; the per-node hover label is suppressed for a
  member of the focused pair, or the name would print twice (the v1.114.0 in-node problem, on
  hover). Copy is **TOP / BOTTOM** for positions and **ATTEMPTING / DEFENDING** for techniques —
  the owner's word, and deliberately not "ATTACKING", which is `activeMove.verb` naming YOUR
  POSTURE during travel (v1.104.1); those two must not start sharing vocabulary.
- Gated by `e2e/prototype/dual-pair-shoot.spec.ts` (three mutants, three kills), which lives there
  because it needs the **gitignored** dual payload — the core suite must not depend on it. Run it
  with the private-root chrome config documented at the top of that file.

**THE FRAMING BAND, AND WHY A PAIR SWAP MOVED THE CAMERA AT ALL (v1.114.4).** Owner: "when I'm in
Side Control bottom and click top, instead of the camera moving just a little, it moves a lot, even
hiding the current node behind the landcard dialog momentarily" — and, precisely: *"it seems to want
to center the node to the center of the screen initially instead of centering to the available
visible space (above the landcard)."* Two halves of a pair share a midpoint, so the correct amount
of camera movement is **none**. Three separate things moved it; the first is a PRODUCTION bug, not a
prototype one, because staging any state tears the card down the same way.
- **`rollFromPosition` still aimed at `{x: n.x, y: n.y}`** — the stored coordinates — on the line
  beside the `camFocus` assignment v1.114.3 fixed. Same defect, missed once. It aims at `camFocus`
  now, and a swap whose subject is unchanged **skips the retarget entirely** rather than recomputing
  the same answer from a layout that is mid-teardown.
- **`bot` fell back to `H - 240` while the card and film were gone** — the middle of the whole
  screen. Measured on a pair swap: wantY 136 → 338, and `rollFromPosition` writes camTarget inside
  exactly that window. `_bandBot` caches the last real measurement and covers the gap.
- **THE BAND FLICKERED FRAME TO FRAME.** The card and the film strip mount on DIFFERENT frames and a
  film box can measure zero mid-transition, so "first element with height wins" alternated: measured,
  the follow-cam flipped `camTarget.cy` between 4.44 (film seen, bot 256) and −0.36 (card only, bot
  363) repeatedly. The band now keeps the **tightest answer ever measured at this viewport height**,
  which is stable by construction and errs safely — too tight only ever puts the node HIGHER, never
  behind the card. Resetting it per landing was tried and is wrong: it hands the first post-reset
  frame (card without its film) straight back to the loose answer.
- **An UNDOCKED element is not a constraint.** `_dockLandFilm` positions the film strip after
  insertion, so for a frame its `rect.top` reads **0**; that made the band −12, tripped the "no room"
  fallback, and threw the camera. A surface leaving no band above it has not laid out yet — skip it.
- **`userActiveNow()` measures the GAME clock, and a staged board is paused**, so one click latched
  "the user is active" FOREVER and silently disabled v1.114.2's staged tracking. `_stagedCamFree` is
  the honest gate: a real pan, pinch or wheel clears it, so "never fight a user's camera" survives.
- Gated in the core suite (`url-arrival.spec.ts`, the torn-down band) and in
  `e2e/prototype/dual-pair-shoot.spec.ts` (the swap holds the camera; a pan releases it).

**THE STAT BAND MOVED TO THE PANE FOOT, AND ITS WEAK-SPOT NUMBER WAS A LIE (v1.104.5).**
- **Foot, not Explore's top** (owner: "I would prefer to be closer to the bottom"). It is its OWN element (`.ng-pane-stats`, `paneStatsRef`) ABOVE `.ng-pane-anchor`, never inside it — the anchor collapses entirely for a signed-in user and three progress numbers must not vanish with a save nudge. It rides every tab and hides during a study takeover.
- **Distributed, not clumped** (owner: it "still looks left aligned instead of neatly designed and distributed"). `display:flex;gap:14px` packed three stats against the left edge of a 360px pane and left the right third empty; it is now `grid-template-columns:repeat(3,1fr)` with the outer two hugging the edges.
- **"30+ weak spots" was the DAILY GOAL.** It printed `get("dailyGoal", 30) + "+"`, so it read "30+" for a player with 3 gaps and for one with 700 and never moved as they closed them. `weakSpots()` counts the real pool — `bucketTechniques("suggested")` BEFORE its `.slice(0, dailyGoal)` — and names the worst tier still in it, which the ranking already computes: rolled-through-but-never-drilled → **very weak**, never touched → **weak**, started-but-under-3-reps → **shaky**. Mastered also carries its percent now ("Mastered 3 (12%)").

**THE DEFENCE QUESTION IS ASKED ABOVE THE HAND, NOT INSIDE IT (v1.104.4).** Owner, on the panic drill: it "should show alike the ng-landcard, in fact it should be a ng-landcard i think. it should never be in the options row lol wtf". It was a **236px flex item inserted as the FIRST CHILD of the escape tray** — so the question you must read sat in the row of things you must choose between, shifted every escape card one slot right, and competed with them for the same glance under a 4-9s clock. Everywhere else in the app a question is asked ABOVE the hand; this was the one place it was asked inside it.
- **It is not merely styled like a landing card, it IS one.** The element goes in **`_landEl`** with `class="ng-landcard"` + `data-landcard="defense"`, so `_dockLandCard`, `_suppressLand` (pane and option sheet stand it down), `attachInput`'s pointer-capture early-return and `clearLandCard` all apply without a second copy of any of them. The danger skin is one CSS rule (`.ng-landcard[data-landcard="defense"]`); everything else is inherited. `clearLandCard()` is now called on BOTH defence exits (the tap and the escape), so it can never outlive its hand.
- **`_dockLandCard` now measures on DESKTOP too — but only moves the card if it would actually collide.** It was mobile-only because the desktop constant (`bottom:236px`) clears an ordinary tray; an ESCAPE tray is taller (its cards carry the extra "escape route" line) and measured at 1440x900 the card's bottom landed at **664 against a tray top of 657** — a 7px overlap on the one screen where you are under a 4-9s clock. With no overlap the CSS constant is left untouched, so nothing that looked right before can move.
- Grading still pumps every escape's odds (+6% `stateBonus`) and refunds 2s. Pinned by `e2e/journeys/panic-card.spec.ts` (3 journeys, 1 `@curated`) — placement, the odds/clock payoff driven by REAL mouse clicks, and teardown.

**THE OPTION CARD'S GLYPH AND ITS `+N` MEASURE DIFFERENT THINGS (v1.104.3).** Owner: "how come this transition says +13 in blue ... but the icon which has the 4 as the shortkey seems gray reddish? how come that's possible?" **It is not a colour bug**, and the audit says so — 0 of 1203 option cards (all 136 positions × both roles) differ from the role-correct value, because `optionsFor` only ever deals moves YOU perform (the `fromRole` filter, v1.103.0), so you are always the attacker of your own hand and `s[0]` is always your slot there. What the two marks actually say:
- **the glyph** = the TECHNIQUE's own strength (`domColor(myVal(n))` — is this a strong move?)
- **the `+N`** = `movePotential` — the value of WHERE IT LANDS YOU. **(HISTORY. Neither mark says
  this any more: the option card's face is EDGE on both channels since v1.118.0, and
  `movePotential` survives only as the ESCAPE tray's corner value. Read the next three blocks as
  one arc — this is the problem, the deletion is the answer, and the model is what replaced it.)**

`Open Guard to Double Unders` scores `-0.113` for its attacker and arrives somewhere good: a mediocre technique into a strong position, which is a real and common shape. They share one palette and say so nowhere — a LABELLING gap, not a maths one. `buildOptionCard`/`expandOption` now read `myColor(n)` so the correctness is DERIVED rather than coincidental.

**...AND THE GAP IS CLOSED BY DELETION — THE CARD SHOWS EDGE (v1.118.0, owner's decision).**

**EDGE = `100 × ( Q(s,a) − B(s) )`, `B(s) = Σ attempt%(a′)·Q(s,a′)`** — how much better or worse this
move is than the ORDINARY choice from where you are standing, where "ordinary" is the Q3 Delphi
occurrence distribution: what people actually do. `0` is not "no value", it is *the normal thing to
do here*. Q counts not just whether the move works but WHERE A MISS LEAVES YOU, out to the end of a
real roll — so a 78%-odds move that hands over initiative can score below a 55% one that finishes.
The build side (the 272-state MDP, `scripts/solve_edge_values.py`, and the `cal.ev` wire) shipped in
v1.116.0/v1.117.0; this is the app reading it. **The model itself — and the two honesty gaps that
come with it — is the block below, `EDGE — THE MODEL BEHIND THE NUMBER`. Read it before you change
anything that feeds EDGE.**
- **THREE MARKS, TWO CHANNELS.** SHAPE = category (v1.103.6). COLOUR — glyph + clock bar + corner
  number — = **EDGE**. Bottom-right = odds, which are an INPUT to EDGE, so one is inside the other
  and they cannot contradict either. The technique's own strength leaves the card FACE entirely.
  The middle slot's category word (redundant with the shape) becomes the caption **`Edge`**: an
  unlabelled signed integer is exactly what makes a legitimate ranking read as a bug, and in **98 of
  272 hands the best-EDGE card is not the best-odds card**.
- **`potColor` saturates at 15 for EDGE** (`NG_EDGE_SAT`), not its historical 45 — measured over all
  1246 emitted pairs, p5 −14 / median 0 / p95 +12, so on the 45 scale a whole hand renders one
  indistinguishable grey. It is an optional second parameter; every pre-EDGE caller is byte-identical.
- **THE WIRE SHIPS THE LINE, NOT THE POINT: `EDGE(p) = e0 + (p − p0)·c1 − Δ`.** `moveChance` is not a
  constant — it is the calibrated rate plus your drilling, momentum, a wrong landing question and the
  opponent's resistance — so a frozen integer would be EDGE at the authored odds and at no other
  moment, and "drilling moves it" would be a lie.
  · **`p0` is the SOLVE's frame (`evFrame`), NEVER `calSuccess`.** `calSuccess` selects by the ACTIVE
    ruleset and the app defaults to **gi**, while the table is solved no-gi; **140 wire entries carry
    a gi rate that differs**, so anchoring on `calSuccess` would put those cards off their published
    value at rest with nothing done. Anchored on the frame, that difference rides through `c1` like
    any other odds movement — which is what it is (median 1.9 EDGE points, max 27.6).
  · **Δ IS THE BASELINE, RE-EVALUATED LIVE, AND IT IS NOT OPTIONAL.** `moveChance` subtracts `aiMod`,
    a per-STATE handicap identical for every card in the hand — measured **0.2612 at
    side-control/bottom** on a fresh profile (0.131 from the top player's own strength + 0.130
    aiSkill; corpus median 0.132, max 0.432). Against a FROZEN baseline all seven cards there read
    NEGATIVE, i.e. "every option here is worse than the ordinary choice here" — arithmetically
    impossible for a weighted mean, and it would have shipped as the feature's headline hand. So the
    baseline is recomputed over the state's FULL authored action set (the wire carries all 25 at
    side-control/top where only 10 are dealt) at each move's live odds. Δ is 0 at rest, so a card
    with no modifiers shows EXACTLY the solver's published integer, and **Σ att·EDGE = 0 holds at
    every moment** (the emitted `e0` are attempt-weighted zero-mean to within 0.47 of a point).
    What survives is the honest part: a uniform shift re-ranks by SLOPE, `e0 + Δp·(c1 − c̄1)`.
- **MEMBERSHIP IS THE INDEX LIST.** `cal.ev[role] = [nodeIdxs, attemptPct, ...[e0,c1] per evLam]`,
  expanded at the top of `ingest` beside the other compact-wire expansions. A node absent from
  `nodeIdxs` has NO edge and renders **no number at all** — never a fabricated 0, because 0 is a real
  value here. Measured over the 272 hands BEFORE the 10-cap: **100 gathered cards carry no wire
  row** (gi-only moves zeroed in the no-gi solve, plus layout neighbours the role-node's
  `transitions[]` never offers) and **19 wire rows never reach the gather at all** — a pre-existing
  disagreement between `graph.json`'s `transitions[]` and `globalGraphLayout`'s adjacency, surfaced
  by this join, not introduced by it.
- **THE ORDER IS FROZEN AT DEAL TIME, AND THAT IS A HARD RULE.** `optionsFor` stamps `ord`
  (`orderScore` → EDGE) and `ordOdds` once; `_cmpDealt` compares only stamped values —
  **EDGE desc → odds desc → attempt% desc → name asc**, unvalued LAST and never as 0. A JIT grade
  taken mid-decision MUST move the numbers (`refreshOptionOdds` → `_paintEdge` repaints corner,
  glyph and bar from one `edgeMark`) and MUST NOT re-sort the tray a player is already reaching into.
  `_optList` — which the 1-9 keys index — is the same frozen array.
- **`movePotential`'s `if (n.ty === "submissions") return 1` IS DELETED.** It made every submission
  score the maximum, so the sort key was a constant across all of them and the 10-cap then dealt the
  first ten ALPHABETICALLY: at Mount Top, `Americana → Armbar → Cross Collar → Ezekiel → Kimura …`;
  at side-control/top it dealt the hand's WORST card (Kneebar, −17) and truncated its most-attempted
  move (Side Control to Mount, 23%). The function survives as the ESCAPE tray's corner value only —
  an escape's options are POSITIONS, which the EDGE table cannot value, so that tray is deliberately
  UNCHANGED (category word, own-strength glyph, landing-position potential).
- **`orderScore` IS `moveEdge`, full stop** — the `cardOrder` setting it used to fork on is RETIRED
  (v1.122.0; see the block below). The "What matters more" (`lossAversion`) control is NOT shipped
  yet — `_evLamIdx()` reads the key with `NG_EDGE_LAM = 2` and falls back to the first block rather
  than guessing, because a wrong λ block is a silently WRONG ranking, not a missing one.
- **Live vs published:** across all 272 role-hands the opponent handicap leaves the **top card
  unchanged in 241**, the **dealt ten unchanged in 267**, the full order in 181. The spec's §4.6
  tables are AT-REST values and are reproduced exactly there (Frame from Side Control −12, Side
  Control Escape +18); a live card differs because its odds differ, which is the feature.
  The consequence recorded here "while the 10-cap stands" is **resolved by v1.123.0**: `Mount
  Control` is dealt 8th at rest and slips to 11th live (it has mount's highest `c1`, 30 — the move
  that most depends on working), so the spec's "best odds 78%, EDGE −1" example used to fall off
  the screen. The cap is gone, Mount Top deals 16, and it is on screen at either rank.
- Pinned by **`e2e/journeys/option-edge.spec.ts`** (8 journeys, 4 `@curated`), mutation-tested by
  `tests/artifacts/_edge_mutants.sh`: seven mutants, seven kills.

**SHOW EVERY OPTION — THE HAND IS NO LONGER CAPPED (v1.123.0, owner's decision).** Owner: *"show
all, fold the overflow, we currently have a 'see more' suggestion already, but should be shown ABOVE
the options row, rather than on bottom of it cos in mobile that see more overlaps user icon and
text, and in mobile screens or small screens i mean dont show it. so after clicking that or
scrolling enough we can infinite scroll (horizontal infinite scroll) or something."* `NG_HAND_CAP`
and `_capHand` are **deleted**; `optionsFor` returns its whole sorted list.
- **"horizontal infinite scroll (or something)" resolves to "the tray reaches its end".** There is
  nothing to lazy-load: the hand is a finite list — 34 cards at its very largest — and all of it is
  dealt in one pass, so paging would add a loading state to data already in the DOM. What the ask
  needs is REACHABILITY, and that is what is gated: click "see more", wheel, or drag, and the far
  end arrives (`e2e/journeys/option-overflow.spec.ts` asserts `scrollLeft` lands within 4px of
  `scrollWidth − clientWidth`).
- **Blast radius, measured over all 272 role-hands** (`tests/artifacts/_hand_uncapped_probe.mjs`):
  **256 were already under 10**, so only **16 hands change**. The corpus deals **1205 → 1326** cards,
  the median hand stays **4**, and the largest goes **10 → 34** (`standing-position/top`;
  `closed-guard/bottom` 32, `side-control/top` 25).
- **The v1.119.0 category floor dissolves with the cap it repaired**, and so does the OPEN question
  it left the owner ("admit the missing category's best-EDGE card, or its most-ATTEMPTED one?").
  side-control/top now deals all 25, so `Side Control to Scarf Hold Position` (+3) and
  `Side Control to Mount` (−2 on **23%** attempt, the largest authored anywhere from that state)
  are BOTH on screen. There is nothing left to choose between.
- The `!out.length` fallback keeps its own `.slice(0, 6)` — that is not this cap, and measured
  **0 of 272 live hands reach it**, so leaving it alone means this change cannot alter a path
  nobody can observe.
- **`replay-digest` MOVED, `af3588835ad1c6b6` → `0390cc44ee7f40e5`, and that is correct.** Unlike
  v1.122.0 — where the digest was *structurally blind* to the change — `options_dealt {count}` is a
  beat and 16 hands genuinely deal a different number of cards, so a digest that did NOT move would
  mean the change had not reached the beat stream. It is not pinned as a fixture anywhere (the spec
  compares runs to each other); `triple_replay.sh` re-proves three consecutive runs identical.

**WHAT UNCAPPING HAD TO PAY FOR — TWO THINGS THAT DO NOT SCALE (v1.123.0).** The number 10 did not
die, it moved off the DISPLAY and onto the two costs that genuinely grow with the hand. Pinned by
`e2e/journeys/option-overflow.spec.ts` (6 journeys, 6 `@curated`), mutation-tested by
`tests/artifacts/_overflow_mutants.sh`: **seven mutants, seven kills**.
- **THE DECISION CLOCK (`NG_DECISION_KNEE` = 10, `NG_DECISION_K` = 2.2).** `dsec = decisionSec +
  0.8·(n−1)` was fine while n was capped and absurd the moment it was not: 34 cards bought a
  **35.4-second turn**. Time to choose does not grow linearly with the alternatives — Hick's law
  says it grows with their LOG — and this tray is ranked best-first, so cards past the fold are
  scanned rather than weighed. Below the knee **nothing changes at all** (measured: all **256**
  sub-knee hands keep their clock to the millisecond, and the median turn is still **11.4s**);
  beyond it each DOUBLING buys `NG_DECISION_K` seconds. The branches meet **exactly** at the knee
  (16.200s both ways), so there is no step. Worst turn **35.4s → 20.1s**. The knee is what makes
  this the minimal change rather than a global re-tune: a pure log curve with the same worst case
  moves every small hand too (mutant O2 proves the spec catches that).
- **THE DECK WARM-UP (`NG_PREFETCH_CAP` = 10) — AND THIS ONE IS THE HONEST COMPROMISE.** `enterLand`
  hydrates one deck per dealt card, and that IS on the first-hand payload bill: it is deferred by a
  single macrotask while `payload-first-hand.spec.ts` freezes its request set at a Playwright poll
  for `[data-tech]`, and its own report carries five `flashcards/*.json` rows to prove it. Warming
  every card of an uncapped hand costs **+15,819 B gzip on the AVERAGE first visit** against
  **7,050 B** of headroom, and **46.6% of real first draws** land on a hand whose delta alone
  exceeds it (`closed-guard/bottom` **+70,213 B**, `standing-position/top` **+86,911 B**) — weighted
  by the app's own `_weightedStart` probabilities, not uniformly
  (`tests/artifacts/_prefetch_traffic_probe.mjs`). So the warm-up takes the hand's first ten; the
  tray is ranked by EDGE, so those are the likeliest picks, and card 11+ hydrates on demand through
  the `deckStatus === "pending"` → *"Loading this state's cards…"* path that already serves every
  cold deck in the app. **Ten keeps today's payload byte-identical**, because ten is what the hand
  used to be.
  > **THE GATE IS STRUCTURALLY BLIND TO THIS, AND SAYING SO IS THE POINT.** `payload-first-hand`
  > pins `start-pos:[0]` → `Gogoplata Control Top`, a **7-card** hand that is under the cap either
  > way, so it reports the same bytes with the cap and without it. It did not clear this design;
  > the traffic-weighted walk did. Do not read a green payload gate as evidence about hand size.

**THE OVERFLOW HINT: ABOVE THE HAND, AND THE BREAKPOINT WAS MISSING A DEVICE (v1.123.0).**
- **The owner's diagnosis was off by a breakpoint; their observation was exact.** The element DOES
  carry `.ng-seemore` and `@media (max-width:640px)` DOES fire — measured, at 390x844 it is
  `display:none`. What was wrong is that a phone held **LANDSCAPE is 844x390 — 844px WIDE** — and
  sailed straight past a width-only rule. The rule is now `(max-width:767px), (max-height:500px)`;
  767 also clears the one band where the hint would have met the centred landing card
  (`min(520px,100vw-32px)` reaches its left edge below ~710px).
- **The collision was universal, not device-specific.** The hint was `bottom:68px` against the
  tray's own `bottom:84px` — i.e. UNDER the hand — and measured at **every** width where it renders
  (844x390 through 1440x900) its box sat exactly **2px** above the account chip's, sharing the same
  right edge (`[1345,819..1416,832]` vs `[1317,834..1416,876]` at 1440x900). It now docks off the
  tray's **MEASURED** top (`_dockOptionHint`) — never a constant, because the row has no fixed
  height (138px at 390x844, 144px at 1440x900, taller again for an escape hand) — which is the same
  lesson `_dockLandCard` learned. Clearance to the chip: **2px → 172px**.
- **SIXTH INSTANCE OF THE `setPointerCapture` BUG CLASS, and it was PRE-EXISTING.** `attachInput`'s
  pointerdown captures on the wrap, which retargets pointerup so the browser resolves the click to
  the common ancestor — and `.ng-seemore` has never been in the early-return list, though its whole
  purpose is an `onClick`. The option ROW beside it is immune only because `componentDidMount` gives
  it its own `pointerdown` stopPropagation, which the hint never had. So the affordance has been
  **dead to the mouse for as long as it has existed**; it surfaced now only because uncapping made
  it worth writing the first spec that clicks it with a REAL mouse instead of `locator.click()`.
  Any new fixed overlay with controls goes in that list.
- **A WHEEL OVER THE HAND NOW SCROLLS THE HAND.** A vertical wheel scrolls a horizontally-overflowing
  element in no browser, so with 34 cards (a **4,104px** overflow at 1440x900) a mouse user could
  reach card 34 only by dragging or by clicking "see more" repeatedly. The handler takes the larger
  of `deltaX`/`deltaY`, so a trackpad's real horizontal gesture is unchanged, and it no-ops when
  nothing is folded rather than swallowing the page's scroll.

**WHAT UNCAPPING DID *NOT* TOUCH, AND ONE THING IT MAKES WORSE (v1.123.0, disclosed).**
- **THE ESCAPE TRAY IS ENTIRELY UNAFFECTED.** `enterDefense` builds its own `escapes` array from
  `adj` — it never calls `optionsFor` — and its clock is already bounded:
  `Math.max(4, Math.min(9, 4 + escapes.length))`. Neither the cap, the knee nor the prefetch has
  ever applied there. `movePotential` likewise survives as that tray's corner value (v1.122.0),
  because an escape's options are POSITIONS and the EDGE table cannot value them.
- **MOBILE REACH IS AN OPEN QUESTION, AND A DRAG FIX WAS BUILT, MEASURED AND THEN REVERTED.**
  At 390x844 the tray shows **2 of 34** cards (it showed 2 of 10 before, so this is not new), and
  the "see more" hint is deliberately hidden there, so the tray itself is the only affordance.
  Chasing whether a thumb can drag it turned up a REAL and separate pre-existing defect, which is
  reproducible with `tests/artifacts/_onehand_reach_probe.mjs`: **~1s after a swipe ends, the whole
  roll restarts.** Traced — one `stakes` beat, no `click`, no `bg_dismissed`, `paused` true
  throughout, and the app lands on a fresh random position (Modified Mount, Back Control and
  Closed Guard on three consecutive runs). The 1s delay and the random landing match
  `enterLand`'s `if (!opts.length) after(1.0, () => startRoll())`, i.e. the gesture is resolving as
  a graph tap (`stageRollAt`) onto a node with no dealable hand.
  - **What was reverted, and WHY it had to be.** A JS `_attachTrayDrag` (touch events, because
    Chrome cancels the POINTER stream mid-swipe — instrumented: `pointerdown · touchstart ·
    pointermove · touchmove · POINTERCANCEL · touchmove ×11 · touchend`) did move the tray
    (`scrollLeft` 0 → 210 mid-gesture). But its premise — "the tray never scrolls by touch" —
    rested on a reading taken **450ms after touchend**, by which time the restart above had
    already cleared the tray and reset `scrollLeft` to 0. **The measurement was confounded, so the
    premise was never proven.** Two mutants confirmed it: deleting `_attachTrayDrag` entirely, and
    swapping it to pointer events, both left the mobile journey GREEN — the harness scrolls that
    tray natively (identical `touch-action`: wrap `none`, row `auto`). A change whose own mutant
    cannot kill its test is not evidence, so the drag, its journey and its two mutants are all out.
  - **What is therefore TRUE and what is NOT.** True: 2 of 34 cards are visible on a phone, and a
    swipe there restarts the roll. NOT established: whether the tray scrolls by touch on a real
    device. Settle the restart first — it corrupts any measurement taken after a gesture — then
    re-measure reach. Desktop is unaffected and fully gated (click + wheel, mutants O6/O7).
- **THE `1-9` KEYS NOW COVER LESS OF THE HAND, and nothing was done about it.** The digit handler is
  `/^[1-9]$/` and `catGlyphSvg` only draws a number for `num <= 9`, so cards 10+ have never had a
  shortcut or a numbered glyph. Under the cap that stranded at most 1 card (2 on side-control/top);
  now the largest hand strands **25 of 34**. It degrades rather than breaks — `_optList[8]` is the
  highest index reachable, so there is no out-of-range read, and the mouse/touch paths reach every
  card. Extending it is a DESIGN question, not a mechanical one: `0` buys only a tenth slot and
  `A`-`D` are already the live MC block's answer keys (v1.68.0). Owner's call.

**THE HAND'S FOUR OTHER INVARIANTS, WALKED OVER ALL 272 ROLE-HANDS (v1.119.0)** —
`e2e/journeys/option-hand.spec.ts` (5 journeys, all `@curated`), mutation-tested by
`tests/artifacts/_hand_mutants.sh`: five mutants, five kills.
- **The order is the app's own ranking, under a STRICT TOTAL ORDER that is never node index.**
  `optionsFor` builds its list by walking `adj` — i.e. in node-index order — and `Array#sort` is
  stable, so a comparator that can return 0 silently hands the decision to the node index. Measured:
  **0 zero-pairs and 0 non-descending steps across all 272 hands**, and reversing each hand's input
  and re-sorting reproduces the dealt order in **272 of 272**. The name tiebreak is load-bearing,
  not decoration: **21 pairs tie on EDGE, odds AND attempt%** and only the name separates them.
- **The printed integer is `Math.round` of the value the hand was ranked by** — one quantity, two
  renderings, so the corner number and the position of the card can never describe different things.
  It follows that printed integers are non-increasing down the hand (**0 violations**).
- **AN EXACT TIE ON SCREEN IS A TIE IN THE DATA, NEVER A CONSTANT IN THE CODE.** This is the shape of
  the bug the feature replaced (`+100` on every submission). Two cards may print the same integer as
  ROUNDING NEIGHBOURS — **129 such groups**, raw values distinct — but where the raw values are
  bit-identical (**42 groups**) the wire rows behind them are identical too, in **42 of 42**. (Why
  the exact ties exist at all: `moveChance − p0` is a per-STATE constant, so two moves sharing
  `(e0, c1)` land on the same raw EDGE regardless of their own rates.)
- **A submission's odds are its AUTHORED rate.** All **297 of 297** carry a calibrated rate; they run
  **10%–74% across 37 distinct values**, and **270 of 297 sit outside the 44–47% band** the old
  dominance fallback (`0.36 + dom·0.1`) collapsed every submission into — that fallback prices the
  whole corpus at **2 distinct values**. It reaches the card: Mount Top's dealt submissions span
  **24 points** of printed odds. Reproduce all of it with `tests/artifacts/_hand_measure.mjs`.
- **`option-hand`'s pool is a second copy of `optionsFor`'s filters, and it knows it** — every
  journey also asserts POOL ⊇ DEALT, which fails loudly the day the app's filter and the spec's copy
  disagree. Since v1.123.0 the first journey asserts **SET EQUALITY**, which is strictly stronger
  and only became available when the cap stopped withholding cards: it now catches a card WITHHELD
  as well as one invented, so the copy is a real gate rather than a one-way check. That journey was
  "the cap thins a category, it never erases one"; it is now "every legal move is dealt — the hand
  IS the pool", and H1's mutant is the cap itself.
- **The mutant for the authored-odds claim needs THREE edits, and that is the finding.** Reverting
  only the `_tech_keys` slug ladder in `regenerate_neural_data.py` leaves the test GREEN, because two
  build gates refuse the bad wire in turn — `cal join regressed: only 3/297 submissions carry a
  successRate`, then `EDGE join regressed: only 976/1246 moves (78.3%) reached a graph-data node`.
  The wire can no longer rot silently on the build side; the mutant has to disable both gates to
  reach the browser at all.

### EDGE — THE MODEL BEHIND THE NUMBER (solver v1.116.0 · wire v1.117.0 · landed v1.120.0)

**In plain English.** Every option card used to carry two marks that both claimed to say "how good
is this move", and one of them printed `+100` on every submission. EDGE is the one number that
replaced them: *how much better or worse this move is than the ORDINARY choice from where you are
standing, counting not just whether it works but where a miss leaves you.* `0` is the normal thing
to do here, `+18` is "this is the move", `−12` is "people do this and it costs them". It is not an
opinion and not a heuristic — it is computed by **playing every position out to the end of a real
roll** and asking how often you tap them versus tap.

**The solver is `scripts/solve_edge_values.py`** (`solve` + `solve_mixture` + `selfcheck` +
`mutants`). It reads **`graph.json`, never the wire** — the wire is derived and
was itself broken until v1.115.0, so an offline solve is the only correct place to do this.
Deterministic across `PYTHONHASHSEED`; the full report runs in ~2s.

**THE STATE MACHINE.** `V = p_win − λ·p_loss` (`R(WIN)=+1, R(LOSS)=−λ, R(DRAW)=0`), and
`Q(s,a) = p·A + (1−p)·B` where `p` is the calibrated success rate, `A` the success-branch value and
`B` the miss-branch value. Six rules, each of which is easy to get wrong and each of which was read
off `neural/src/app.src.jsx` rather than assumed:
- **272 states.** `graph.json.positions` has 409 keys; **272** end `/top` or `/bottom` and the other
  **137** (136 hubs + `game-over`) carry `transitions: []` — aggregators, not states. Neutral
  positions do not exist here: `standing-position`, `clinch` and `open-guard` all split. State is
  written from **your** side; the opponent occupies `opp(s)`.
- **INITIATIVE IS ASYMMETRIC, and it is the shipped rule.** A success returns to `enterLand(false)`
  — **you move again**. A miss that moves you costs 1 ply and hands over the turn; a miss that
  leaves you where you are costs **0 plies** (`enterFailCal` early-returns with no `startTravel`).
  `opponentDefend` always ends in `enterLand(false)`, so **the opponent never keeps initiative**.
  That is a large permanent player advantage. It is what ships, so it is what is modelled — and it
  is load-bearing: `--mutants` gives the opponent initiative and `V(side-control/bottom)` falls
  **+0.5055 → +0.2266**; charging the stay-put ply moves it to +0.4933.
- **YOU argmax; the OPPONENT samples the authored attempt distribution.** Owner's binding note:
  *"let's not assume yet that the opponent is the same level as we are."* **Not minimax** — this
  asymmetry is what makes drilling pay.
- **Actions are ORIGIN-FILTERED, exactly as `optionsFor` deals them**, and when origin empties a
  hand the model relaxes **ORIGIN, never ROLE** — same rule as the app. **3 role-nodes** hit that
  fallback in no-gi (`worm-guard/bottom`, `piranha-guard/bottom`, `inverted-lasso-guard/bottom`).
  Removing the origin filter moves `V(side-control/bottom)` to **+0.6261**, so this is a choice with
  teeth, not a detail.
- **THE 42 HUB-TARGET OUTCOME CELLS ARE CHAINED, NOT DROPPED.** 21 sit on `/attacker` nodes and
  **17 of those are a node's ENTIRE success branch** (`-finish`/`-setup`/`-variation` transitions
  whose success means "you secured the control"). Dropping and renormalising them — the obvious
  implementation — leaves **16 dealt actions with `successRate > 0` and no success branch at all**,
  which is where an earlier pass's *"19 broken content nodes, fail `validate:graph` on them"* claim
  came from. **It was a model artifact. Do not file those tickets.** Chained: **0**. There is no
  second-level chain and `selfcheck` asserts it.
- **Horizon = `maxMoves`, uniform on {9,10,11,12}.** The wire ships the **mixture**; every published
  table quotes **H=11**, and **80 of the 1246** emitted integers differ between the two by rounding.

**WHY THE OPPONENT MIRROR IS NOT OPTIONAL — the one thing that decides whether the number means
anything.** The opponent's action set is the **PAIRED role-node's** authored `transitions[]`, sampled
by `attemptProbability`; their outcomes are read off the technique's `/attacker` node and the landing
role suffix is flipped back into your frame. The `/defender` nodes are never needed. Three models,
λ=2, H=11, same-origin:

| model | mean V(top) | mean V(bottom) | bottoms above the mean top state |
|---|---|---|---|
| **A — mirrored (the correct one)** | **+0.8368** | **+0.5806** | **27 / 136** |
| D — no mirror (the opponent draws *your* list) | +0.7612 | +0.8181 | **119 / 136** |
| E — no opponent at all | +0.9999 | +0.9990 | 35 / 136 |

**Model D inverts the sport** — being underneath becomes better than being on top, in 119 of 136
positions. **Model E scores `back-control/bottom` — being strangled — at +0.9998**, where loss
aversion is literally meaningless. The reason is content, not arithmetic: **166 of 272 role-nodes
(61.0%) author zero submissions** (Side Control Bottom: 11 moves, 0 submissions; Mount Bottom: 7, 0)
while Side Control Top puts **49% of its no-gi attempt mass on 16 submissions**. **λ enters ONLY
through the mirror**: at `side-control/bottom`, `V = +0.5055` but `U = −0.1859` with `p_loss 0.3917`
— a **0.6914 swing** that exists only because the opponent's submission hand is in the model.

**THE FULLY-SYMMETRIC RESIDUAL IS NOT EVIDENCE ABOUT CONTENT — do not quote it as such.** The
report prints it (mean `2.26e-17`, exactly 0 at every horizon), and it is close to a **tautology**:
`--mutants` corrupts an `/attacker` outcome cell and it stays at 2.2e-16, replaces `flip()` with the
identity and it stays at ~0. It detects exactly ONE thing — the opponent sourced from the wrong node
(0.2508). **The mirror's zero-violation claim rests on the direct 6-invariant test over 1331 pairs**,
which DOES go red: one flipped `/defender` probability → `FAIL {'probability': 2}`, one retargeted
outcome → `FAIL {'to_flip': 1}`, both exit 1.

**Structural facts the self-check gates on every run** (all green today, so the gate ships green and
only fires on a content regression): attempt sums == 100 in **272/272**; outcome sums == 100 in
**2662/2662** technique role-nodes over **8320 cells** (`success 4160 / failure 2806 / counter 1354`);
**0 unresolved targets**; `game-over` reached by **594 cells, every one from a submission — 0 from a
transition**; the mirror **1331 pairs, zero violations**; branch form self-consistent to **2.22e-16**.

**THE HONESTY GAPS. There were two; ONE IS CLOSED (v1.121.0, below) and one is still live.**

1. **`opponentDefend` IS NOT THE OPPONENT THE MODEL ASSUMES, and this is the biggest one.** It
   iterates `this.adj[this.currentPos]` — **undirected, hub-collapsed adjacency** — with **no role
   filter and no origin filter**, picks a finish with `pFinish = clamp(0.34 + oppAdv*0.55, .18, .85)`
   and otherwise takes one of the top 3 by `oppVal`. **It never reads `attemptProbability`.**
   MEASURED over all 272 role-states, reproducing its own gather (adjacency, non-positions, deduped
   by title): the shipped opponent chooses from **39.2 candidate technique nodes per state**, the
   model's from **9.1**; **only 23.2% of what the shipped opponent may pick is a move the model's
   opponent would ever consider** (the modelled set is a strict subset — 2476 of 2476 survive into
   the shipped pool — so it is pure OVER-inclusion, taking in moves authored for *your* role and
   moves that originate somewhere else entirely). **EDGE therefore describes a
   better-behaved opponent than the one you actually face.** Making the game match the number is a
   large, separate, owner-gated change; until it happens this sentence belongs in any copy that
   explains EDGE.
2. ~~`resolve()` coerces the outcome branch instead of drawing inside it.~~ **CLOSED in v1.121.0 —
   see the section below.** The disclosure it replaced is kept there in full, because the numbers
   are the reason the fix exists.

### THE MISS DISTRIBUTION THE CARD PRICES IS NOW THE ONE THE ROLL ROLLS (v1.121.0)

EDGE's whole claim is that it counts **where a miss leaves you**. Honesty gap 2 was that the roll
did not roll the miss distribution EDGE prices, so every integer on every option card was a price
for a game nobody was playing.

**WHAT WAS WRONG.** `resolve()` decided success/miss on `moveChance` — correct, and unchanged: that
is the player-facing gate drilling moves. It then drew the ROW from the **whole** authored table and,
when the drawn row's branch disagreed with the gate, replaced it with `outcomes.find(...)` — the
**FIRST** matching cell, not a re-draw inside the branch. Authored lists run success → failure →
counter and **1327 of 1331** end in a `counter`, so every miss that happened to draw a success cell
was dumped onto the first `failure` and the counter cells starved.

**MEASURED, twice, by two methods that do not share code.** `tests/artifacts/_resolve_kernel_measure.py`
derives both kernels analytically from `graph-data.json`; `tests/artifacts/_resolve_kernel_probe.mjs`
sweeps a rigged `outcome` value through the app's OWN `resolve()` in a real browser (the four
entry points it calls after choosing are stubbed, so the function runs whole and moves nothing —
0 fx beats emitted during a full corpus sweep). They agree to grid resolution:

| | before | after |
|---|---|---|
| TV vs the authored within-branch kernel | mean **0.0902** · median 0.0825 · **max 0.2440** | mean 0.0001 · max 0.0004 (= 1/grid) |
| TV == 0 | **0 of 1331** | **1331 of 1331** |
| counter mass rolled (summed over 1331 nodes, authored **233.8164**) | **123.0071** — **47.39% never landed** | 233.7810 — 0.02%, which is the sweep grid |

Worst single node `Transitions/Escape-Scarf-Hold-Position` at TV 0.2440. **`> 0.10 on 276` is a
knife-edge count** — 88 nodes sit on 0.10 to float noise, so at-or-above reads **306**, which is
exactly what the sampled probe reports. Do not read the 276/306 gap as the two methods disagreeing.

**THE FIX IS A CONDITIONAL, NOT A SECOND DICE.** `drawOutcome(act, branch)` takes the branch the
gate already chose, restricts the table to that branch's rows and renormalises **inside** it —
which is precisely the conditional the authored weights state. **Exactly ONE `rng("outcome")` draw
per resolution, same tag, same order**, so a rigged journey consumes the same queue; what changed is
which row a mid-band value lands on. `branch` omitted (`opponentDefend`'s destination draw) = the
whole table, unchanged. An empty branch falls back to the whole table — what `.find(...) || out`
did — and the fallback is chosen BEFORE the draw so the rng call count never depends on content
(0 of 1331 lists have an empty or zero-weight branch, so this is defensive).

**MOMENTUM STILL SHEDS COUNTER WEIGHT, and now it is the only thing doing so.** `momentumSkew()`
scales counter rows by `(1-sk)` inside the miss branch, so "too fast to capitalize" reads exactly as
written. Its `outcome_skewed` beat also stopped lying: it used to fire on the row that was drawn
*before* coercion, so it could announce a skew applied to an outcome the player never saw.

**`replay-digest` DID NOT MOVE, AND THAT WAS EXPECTED TO BE THE OTHER WAY ROUND.** The task that
commissioned this fix said it would "deliberately re-baseline `replay-digest`". It did not: three
replays are byte-identical at **`af3588835ad1c6b6`**, the SAME digest v1.120.0 recorded, and the
artifact `diff`s clean against the pre-fix run. That is a property of the scripted roll, not a sign
the fix missed the roll, and the reason is measurable. **A rigged draw lands on a different cell on
18.19% of `u` under a MISS gate, but only 2.93% under a SUCCESS gate — and 0% on 1226 of the 1331
nodes**, because those author exactly ONE success cell, so every `u` maps to it under both kernels.
`replay-digest` rigs `resolve: 0.01` (success) and commits `Submissions/Kimura/from-Mount`, whose
table is `[game-over 72 success · mount/top 18 failure · closed-guard/bottom 10 counter]` — one
success row, and a submission finish that ends the round before the row's `to` is ever read. **So
that spec is structurally incapable of seeing this change**, which is exactly why the corpus gate
below exists rather than a digest bump standing in as evidence.

**Gated by `e2e/journeys/outcome-kernel.spec.ts`** (3 journeys, 2 `@curated`), which asserts the
corpus figures through the shipped `resolve()`. Red-proven with three mutants: **M1** restores the
coercion → `mean TV … Expected < 0.01, Received 0.09017653374680812` and `counter mass lost
(110.809 of 233.816) … Received 0.47391609835906745`; **M2** adds a second `rng("outcome")` draw →
`one rng('outcome') draw on the success branch … Expected 1, Received 2`; **M3** applies the filter
when NO branch was passed → `drawOutcome with no branch reaches the SUCCESS cell too: 0.01 landed on
a failure cell`. M3 is why that test asserts BOTH ends of the whole-table draw: `!!undefined` is
false, so a filter that forgot to check for "no branch at all" silently serves the miss branch — and
with 1327 of 1331 lists ending in a counter, the `0.99` end alone still looks right.

**REFUTED, and measured here rather than inherited.** The spec's "genuinely uncertain" note claims
`p_win` is compressed into **0.80–0.99** across all 272 states. It is not: the floor is **0.5538**
at `invisible-collar/bottom` and **39 of 272** states sit below 0.80. EDGE is a difference so it is
immune either way, but do not repeat the compressed-range claim.

**THREE MODELLING CHOICES THAT ARE CHOICES, NOT FACTS** — if you are about to defend a number, know
which of these it rests on. (a) **The zero point is the Q3 Delphi occurrence distribution.** `B(s)`
calls "ordinary" whatever `attempt_probability` says people do; if those are wrong, EDGE's zero is
wrong even when every `Q` is right. (b) **The chain performer is label-driven** (success → the actor
performs, failure/counter → the opponent does). Switching to "the actor always performs" moves
`V(mount/top)` and `V(side-control/bottom)` by **less than 1e-4**, so it is settled empirically, not
by argument. (c) **The wire is the horizon MIXTURE, the tables are H=11.**

**THE `cardOrder` SETTING IS RETIRED — THE SETTING GOES, NOT THE SECOND MODE (v1.122.0, owner's
decision).** Settings → Rolling → "Option ordering" offered `Potential` / `Popularity`.
`orderScore` forked on it; **`edgeMark` did not.** So `Popularity` ranked the tray by
`movePopularity` — a placeholder graph-derived pick rate, jittered by a `Math.sin` hash — while
every card went on printing its EDGE. Measured over all 270 live role-hands
(`tests/artifacts/_edge_cardorder_probe.mjs`, against the served bundle): under the default,
**0 hands** print an EDGE that runs out of descending order; under `Popularity`, **211 do**. Worst
case `back-control/bottom` printed `[−6, −20, +6, +8, −2, +14, +17, +19]` — the corner numbers climb
as you read down the tray and the `+19` card is dealt LAST. That is exactly the "a legitimate
ranking reads as a bug" failure the `Edge` caption exists to prevent, one settings click from the
default.
- **Why retire rather than repair.** Owner: the sort only changes the dealt set in a handful of
  hands, so control over it is control over almost nothing. Measured on the same walk: the choice
  changed the dealt **SET in 16** of the 270 hands, while re-ordering **223** and changing the top
  card in **190**. It re-ranked nearly every hand and widened the action space in almost none.
- **Deleted:** the Settings row and its explainer, `movePopularity` (its only caller was the fork)
  and `_hash01` (its only caller was `movePopularity`), plus the already-dead `mapFreq`/`_freqMap`.
  `orderScore(opt)` is now `return this.moveEdge(opt)`. **`movePotential` STAYS** — it is the ESCAPE
  tray's corner value, and an escape's options are POSITIONS, which the EDGE table cannot value.
- **The false explainer went with the row, and it was false BEFORE EDGE.** It described Potential as
  *"a Bayesian estimate blending how likely you are to land the move, how strong the resulting
  position is, and how many follow-ups it opens"* — but `movePotential` never read the odds at all
  (it reads the LANDING node's `myVal` and its `deg`), and by v1.118.0 the branch was `moveEdge`
  anyway. Nothing replaces it: the card's `Edge` caption is the app's only claim about the ranking,
  and inventing a fresh sentence for a control that no longer exists would be a third thing to keep
  true. (The spec's `.ng-seemore` legend line is still NOT BUILT — see ALSO NOT BUILT below.)
- **A SETTINGS KEY CANNOT BE DELETED, so `cardOrder` is DORMANT — not pruned.** A profile that saved
  `"popularity"` keeps the key forever and nothing reads it. Pruning on load would be theatre:
  `_pullAndMerge`'s per-key settings merge has **no tombstone** — `if (!(sk in merged) || ct > lt)`
  — so a key deleted locally is unconditionally RE-ADDED by the first pull from any device that
  still carries it, exactly like the add-wins list merge. Same shape as `studyOrder` (v1.105.0) and
  `challengePinnedTrack` (v1.99.2); this repo's answer is to stop READING the key and say so where
  the reader used to be.
- Pinned by **two journeys in `e2e/journeys/option-edge.spec.ts`** which boot a profile that really
  has `cardOrder:"popularity"` in its blob: one walks all 270 hands and asserts (a) `orderScore(o)`
  is bit-identical to `moveEdge(o)` on every dealt card, (b) 0 hands print out of descending order,
  (c) flipping the dormant key moves no hand; the other opens Settings → Rolling and asserts the row
  and both its choices are gone, the "Bayesian" sentence is nowhere in the modal, and the tab still
  renders its other rows. Three mutants, three kills — restoring the fork splits **270 of 270** hands
  and mis-orders **216**; restoring the row fails on the label; and `Math.round`-ing the sort key
  splits **265 of 270** while leaving the printed order *and* the inert-key check green, which is why
  assertion (a) exists and is not decoration. (216 vs the probe's 211: the journey pins
  `aiSkill = 0.13` and a bonus-free state key, the probe reads live browser defaults. Same
  contradiction, two conditions — both are stated rather than one being rounded to the other.)
- **`replay-digest` is UNCHANGED (`af3588835ad1c6b6`) and that is not the evidence.** The default was
  `"potential"`, so `orderScore` already returned `moveEdge` for every profile that never touched the
  setting, and no digest spec sets `cardOrder` — the digest is STRUCTURALLY unable to see this
  change. What it does confirm is the absence of an accidental side effect from the deletions. The
  corpus walk above is the evidence.
- The **Forward catalog's** settings mock (`forward/shared/components-panels.js`,
  `forward/shared/fixtures.js`) rendered the retired row too. It is a DESIGN mock with no parity gate
  against `renderSettings` — `check_forward_catalog.mjs` only checks that frames render — so retired
  rows survive there by default: "Study order" had been stale since v1.105.0. Both are removed and
  the reason is recorded in `fixtures.js`. **Treat the catalog as unguarded.**

The `lossAversion` dial that ought to live in that Rolling tab ("What matters more: Winning /
Balanced / Not getting caught", λ ∈ 1|2|4, the wire already carries all three blocks) is **not
built** — `_evLamIdx()` reads the key with `NG_EDGE_LAM = 2` and falls back to the first block rather
than guessing, because a wrong λ block is a silently WRONG ranking, not a missing one. It is now
unblocked: the sibling row that would have contradicted it is gone.

**ALSO NOT BUILT** from the spec, so nobody hunts for it: the primary/tail band (`EDGE ≤ −3` →
"rarely the right call"), the live-band decision clock, the sheet's `WHAT IT'S WORTH` block and the
legend line. Two entries LEFT this list in v1.123.0: the hand is **no longer capped** (see below),
and "un-hiding `.ng-seemore` on mobile" is now a DECISION rather than a gap — it stays hidden on
small screens, by the owner's instruction, under a rule that finally covers the device they were
looking at.

**Reproduce any of it** — `python3 scripts/solve_edge_values.py` (report), `--verify` (measured vs
the spec's published headlines, side by side), `--mutants` (the mirror invariant + the five
load-bearing model rules, each reverted so you can see which checks move and which — deliberately —
do not), `--hand side-control/bottom` (the seven-card table this feature is sold on),
`--lam/--horizon/--frame`.

**OPEN, MEASURED, OWNER'S CALL — the GRAPH's position colours are top-relative.** `ingest` bakes `dom = n.s[0]` once per node, and for a POSITION `s[0]` is the TOP player's value. **85 of 136 positions (62%) have opposite-sign slots**, so while you play bottom the canvas paints them from your opponent's point of view under a palette whose stated meaning is "blue = good for you, red = good for the opponent" (`domColor`, and that IS how `myColor` uses it). Examples: `Side Control Top` `[+0.328, −0.712]`, `Reverse Mount Top` `[+0.380, −0.420]`. `myColor(n)` is the role-correct read and already exists; making the canvas use it is a visible change to the app's centrepiece (and a per-frame read), so it is deliberately NOT done here.

**LANDING-CARD CHROME, FOUR OWNER REPORTS (v1.104.2).** Pinned by `e2e/journeys/landcard-chrome.spec.ts` (4 journeys, 2 `@curated`, `test.use` 390x844 — three of the four only bite on the phone).
- **`style.color = ""` DELETES, it does not restore.** After `More → Less` the toggle went black on a #131625 card. `expandLandCard` restored it with the empty string, which removes the inline declaration written by the button's own `cssText`; the collapsed button then inherited from a parent that sets no colour and fell back to the UA default. The resting colour is now the shared constant **`NG_LAND_MORE_COL`** so the two sites that write it cannot drift again. General rule: to return an element to a colour declared inline, WRITE it — clearing only works when the resting value comes from a stylesheet.
- **A 44px thumb target must not set a 24px row's geometry.** The corner (`[data-land-corner]`) holds a 44px `+` beside a 24px ✕; under `align-items:center` the row became 44 tall, so both glyphs sat 10px below the inset and 20px apart — the owner asked for them "a bit closer and a bit closer to the top (symmetric to how the x close button is close to the right edge)". A `-10px` margin shrinks the `+`'s LAYOUT box to 24×24 while it still renders and still takes a thumb at 44 (the `.ng-lists-new` pattern). Inset is 5px on both axes, gap 2px, and the spec asserts `xFromTop === xFromRight`, one shared glyph baseline, a 44px hit area, AND — because the `+`'s box now overhangs the ✕ by 8px — that `elementFromPoint` at each control's centre still returns that control.
- **The film strip takes its width from the card, MEASURED.** `.ng-landfilm` duplicated the card's DESKTOP rule as a constant, and the card has a mobile override (`width:calc(100vw - 20px)!important; padding:11px 12px`) it never knew about: at 390x844 the boxes measured `[16,374]` against `[10,380]`. `_dockLandFilm` now copies the card's measured width AND its horizontal padding (the padding is what lines the THUMBNAILS up with the text above them), so they agree at every viewport by construction. The cssText width is a first-frame guess only.
- **The clip hover is a hint, not a flash.** It zoomed the still 5% over 400ms and flipped the play glyph to **brand red** at 108% — the loudest signal a hover can make, on a strip sitting directly above the question being read. Now a 2% zoom over 180ms and a slightly more solid disc. The click-to-expand morph is untouched (signed off in v1.102.1).

**ONE SUBJECT PER LABEL: THE ANNOUNCER NAMES THE ACTOR, THE GRAPH NAMES YOUR POSTURE (v1.104.1).** The owner, mid-roll: the announce block read **"OPPONENT DEFENDS Crucifix Maintenance"** while the graph read **"DEFENDING Crucifix Maintenance"** — "wtf is this incoherence? also seems to me like opponent tried to go for crucifix and we're defending right?" Right on every count. Two labels described one event with two different subjects, and three things were wrong:
- `setEvent`'s opponent copy was chosen by **`performerRole(...) === "top"`** — a TOP/BOTTOM test standing in for an OFFENCE/DEFENCE one, the same defect class as roleIdx-vs-valIdx (v1.103.0). In BJJ the dominance axis is not top/bottom, so a bottom-authored attack (the reported crucifix) announced itself as the opponent *defending*. Naming the ACTOR needs no such guess, so the test is deleted rather than repaired.
- The two opponent branches used **opposite graph verbs** — a submission attempt set `activeMove.verb = "Attacking"` (whose subject is the opponent) while a positional move set `"Defending"` (whose subject is you). One actor, two subjects, in the same code path.
- The player's own copy was two strings (`"Going for the submission"` / `"Attempting the transition"`) that never matched the opponent's shape, so the two sides could not be read as one exchange.

The rule now, owner's words: **"announce opponent goes for X (graph shows defending X), or announce you go for Y (graph shows attacking Y)"** — the announcer names **who is initiating**, the graph verb names **your posture toward that move**. They can never contradict because they no longer answer the same question. Pinned by `e2e/journeys/announcer-coherence.spec.ts` (3 journeys, 2 `@curated`), including one that walks repeated opponent turns and fails if ANY branch claims you are attacking.

**THE FIRST-ROLL COACH IS DELETED (v1.104.0, owner).** A 3-panel card at top-centre (`.ng-coach`, z:70, `top:92px`) that opened over the first-ever landing and froze the decision clock. The owner, meeting it: it "shows on top and is really nasty, grabbing the attention", and panel 1 said "these cards are your options from this position" while being a FIXED overlay anchored to nothing — panel 2 ("Peek before you leap") read as being about the film-study Shorts. On a screen already carrying a graph, a landing card, a question and a hand, a floating explainer of that hand is one more thing to read, in the worst place, at the worst moment.
- **Its one factual claim was TRUE and was measured on the way out:** the clock really was frozen — `_decision.remaining` unchanged at 13,800ms across 12 simulated seconds, all seven `.ngbar` countdowns `paused`, no auto-pick, resuming on dismiss. `_tickDecision` still freezes for `_checkpoint` (same rule, same reason), pinned by `e2e/gen/mid-checkpoint-quiz-untimed.spec.ts`.
- **The three White objectives were RE-KEYED, not deleted** — White stays at 20. `white.coach1` "Read your hand" → **`options_dealt`**, `white.coach2` "Preview a move" → **`sheet_opened`**, `white.coach3` "Read a landing question" → **`land_q_shown`**. Each now measures the action it is NAMED for, and coach2 got strictly harder: it needs a move sheet actually opened, where the coach ticked it for pressing Next on a tooltip. The `legacyId`s (`coach1/2/3`) and the `bjj-neural-coached` → `tut.done` migration stay, so already-coached users keep their history.
- **Gone with it:** `maybeStartCoach`/`advanceCoach`/`dismissCoach`/`finishCoach`/`renderCoach`, the `.ng-coach` CSS, the `_coach` guards in `_tickDecision` and `renderTutorial`, the funnel's `coach_seen`/`coach_finished` side marks and its `coach_open` property, 11 `e2e/gen/onboard-coach-*` specs (+ their ledger rows), and `dsl.ts`'s auto-dismiss (`land()`'s `keepCoach` is now accepted-and-ignored). `bjj-neural-coached` has **no writer** any more — `_returningVisitor()` still reads it for pre-v1.104 users but the live marker is `bjj-neural-firstroll`.
- **DISCLOSED, not fixed:** `_setBarsPaused` went with the coach, and it was the ONLY thing that ever froze the CSS countdown bars. Those run on wall clock, so during a checkpoint quiz or a paused pane they keep draining while the clock is stopped — a pre-existing desync the coach happened to be immune to.

**FIRST IMPRESSION (v1.82.3).** Two rules about the opening screen, both gated by `e2e/journeys/first-impression.spec.ts`.
- **A fresh profile's first-ever roll is drawn from REAL TRAFFIC, not uniformly.** `startPosTraffic()` sums `curriculum.weights` (the stationary distribution Game Knowledge already uses) per position through each technique's single canonical origin (`fromPositionId` → `_posSlugIndex`), giving 136 entries summing to 1. `_weightedStart(pool, u)` inverse-CDF-samples `w^START_BIAS.gamma` (1.5) mixed with `START_BIAS.floor` (2%) uniform. Effect: the six hubs a beginner can name go from **4.4% → ~66%** of first impressions, ~17 states stay genuinely likely, and **all 136 keep a real chance — the draw is biased, never narrowed**. It replaced a `withDeck` filter that was a **no-op** (all 136 carry a deck). ONE draw off the SAME `rng("start-pos")` tag, so rigged replays are structurally untouched; a **returning** profile keeps the historical uniform mapping exactly (`_returningVisitor()` — one latched definition, shared with the cold-start funnel's `cold` flag, marker `bjj-neural-firstroll`).
- **The card names ONE side, and it is `playerRole`.** All 136 position hub titles in `graph-data.json` end in "… Top" (the visual layer collapses Top/Bottom into one node), so the raw title is not a role claim. `renderLandCard` shows `posFamily(node.t)` for positions; `roleTxt` is the only place a side is named. **Do not "derive the role from the node title"** the way `rollFromPosition()` does — that derivation is a constant (`top`) across the whole pool, which is why every staged/roamed roll deals a top hand and why `playFrom(idx, role)` has to set the role itself.

**ZOOM IS A CAMERA, AND THE ARRIVAL IS THE EVENT (v1.114.0).** Two owner reports, one surface.
*"When we go to a node there's this bigger, wider circle that appears, and it's blooming, beaming.
I don't like that very much. I'd rather have the pulse signal, the white node that goes from one
node to another — when it arrives at its final node its bloom should grow a little bit more, like
50% or even 100% more. A bigger, wider circle shouldn't appear on its back anymore. That used to be
the motivation for content to appear inside it. Now we don't want content to appear inside any
node… the label, which consists of the role and the technique name, should appear to the right of
it. That's the winner design for labelling these nodes, even when we zoom in or zoom out."* And:
*"When we're zooming in we want to see other nodes that are around it. We don't want more detail on
a node. To see details on a node we click on it. We don't zoom in anymore."*
- **THE WIDE CIRCLE WAS TWO PASSES, AND ONE OF THEM WAS A SCALING BUG.** v1.113.1 made every orb
  `n.r * nodeK` (nodeK = **0.4** at roll zoom) and the current-position marker was never told — so
  its "1.28x" fill was **3.2x** the node it marks and its "2.9x" ring **7.25x**, a circle seven
  times the node. The second was the **sustained halo**: a breathing radial gradient with a 46px
  screen floor reaching ~11x the drawn radius, lit for the whole roll. Both are deleted. The steady
  state is a MARK — the node's own silhouette in your perspective colour at the AUTHORED `1.28`
  ratio, now correctly scaled (`n.r * nodeK * 1.28`), with a 1.8px rim — and `_haloK`/`_haloT`
  are gone. The ratio was never the bug; `nodeK` missing from it was.
- **THE BLOOM MOVED TO THE ARRIVAL.** `flare(idx, amp)` stores `litK`; the flare pass scales its
  gradient radius and its white core by it, and inherits the deleted halo's screen-size floor so it
  still reads at roll zoom. `ARRIVE_BLOOM = 2` (the owner's "100% more") is spent where the roll
  **stops**: `enterLand` and a submission finish. Deliberately NOT at the end of a travel path — a
  move is two travels (`[here, technique]`, then `[technique, outcome]`), so "last node of the
  path" is the TECHNIQUE half the time (measured: "Sweep from Meathook" bloomed as hard as the
  position it swept you into). `enterLand`'s re-flare must carry the amplitude or it demotes the
  destination one frame after `updateTravel` set it.
- **NOTHING IS WRITTEN INSIDE A NODE.** The ~68-line in-node pass (dark plate, stroked outline,
  800-weight kicker, wrapped name at `rs * 0.24`) is deleted, and with it the last draw-loop
  consumer of `_nodeCardOn`. Zoom changes how many nodes you can see, never what a node says.
- **ONE LABELLING DESIGN, AT EVERY ZOOM.** `richLabel` — role over name, beside the node — was
  suppressed above 20px because the in-node pass took over there; the suppression is gone from all
  four label sites. The focus carries `<CATEGORY> · <ROLE>` over `posFamily`/`displayName`
  unconditionally, so v1.101.0's promise that "the graph names the state" (which is why the landing
  card has no header) still holds — it is now named BESIDE the node instead of inside it.
- **`halfW(n)` is how far right a node's silhouette actually reaches.** Every label anchored on
  `n.r * scale`, which stopped being the drawn radius twice over: `nodeK`, the mitosis LOD's
  interpolated representative radius, and `shapePath` widening a triangle to 1.242r / a diamond to
  1.18r. Now that the label IS the naming design it has to sit against the edge it names.
- The wheel's second zoom floor (`_dossierIdx != null ? 0.0075 : 0.006`) is gone — dead since
  v1.101.0, and reading a node by zooming into it is exactly what this retires.
- **Gated by `e2e/journeys/graph-naming.spec.ts` (3 journeys, 1 `@curated`), which reads the CANVAS
  BACK** — these are claims about what the renderer painted, and every state variable involved
  could be right while `draw()` still put a name or a ring on screen. **Five mutants had to die to
  get the statistic right**, and the two that survived early versions are the lesson: a sparse ring
  of sample points measured the empty space either side of the ring it was hunting, and a dense
  radial profile scored by *angular coverage* still passed, because the dealt hand's option nodes
  genuinely encircle the state you stand in (82% of wedges at r=7.7x) so coverage was already
  saturated where the ring lives. What works is a **control frame** (`focusIdx = -1`, same camera,
  same neighbours) plus a **per-sector luminance delta**: everything the graph would draw anyway
  subtracts to zero, a ring or halo raises every wedge's median, and the edges the focus
  legitimately lights are spokes the median ignores. It self-checks on the mark itself, so a
  sampler that has stopped seeing anything fails instead of passing.

**...AND THE ARRIVAL NEEDS SOMEWHERE TO LAND (v1.114.1).** v1.114.0 deleted the sustained halo
correctly and then put NOTHING in its place, which the owner met immediately: *"the highlights of
the current node don't seem to be happening anymore ... there seems to be no highlight at all now.
That pulse, that I appreciated so much, when it reaches the correct node, it disappears, and it
becomes stale."* Measured at roll zoom, per phase, light reach around the current node (orb radius
33px settled / 21px mid-flight):

| phase | before v1.114.1 |
|---|---|
| settled, before a move | core 131, reach **53px** — the orb and nothing else |
| travelling (4.2s) | core 113, reach **53px** — inert |
| arrival, 1.9s | core **255**, reach **~152px** — the bloom was working all along |
| after 1.9s, rest of the turn | core 133, reach **30px** vs a 21px orb — dead |

So the bloom was never the problem; the CLIFF at 1.9s was, and so was having no resting state.
- **`REST_GLOW = 0.42`** — the presence WITHOUT the beam. It hugs the orb at **2.6x** where the
  retired halo reached ~11x, carries about a third of its alpha, breathes slowly instead of
  beaming, and **drains into the pulse on departure** exactly as the halo did (which is what
  covers the marker's own cut at `!this.pulse`). It is additive with the arrival bloom, so the
  bloom now decays INTO it rather than to zero — no cliff, no stale state. Settled reach went
  53px → 84px; post-bloom 30px → 44px.
- **The rim was invisible** because it was stroked in the same colour as the fill it outlines. It
  is now lightened 55% toward white, which is what makes the orb read as *selected* at a glance.
- **The gate pins BOTH bounds** (`graph-naming.spec.ts`): a FLOOR — the resting glow must be
  there — and the CEILING from v1.114.0. Two traps found while building the floor, both worth
  keeping in mind for any future canvas assertion: (1) `parkOn` pauses, and **`this.now` IS the
  game clock**, so a paused roll freezes `age = now - lit` and leaves the node stuck mid-bloom —
  the first floor passed against a build with the glow deleted, on the frozen arrival flare. The
  test now ages `lit` out explicitly and asserts it did. (2) A floor band starting at 1.2x measured
  the **marker's own 2px rim's antialiasing** (19.6 luminance with the glow deleted), not any
  glow; it starts at 1.8x, clear of the mark.

**ONE CLOCK — the countdown bar cannot disagree with the number it draws (v1.114.1).** Owner, same
pass: *"for the current node, there's very little time for it to be answered."* The window is NOT
short — measured **16.2s** (`decisionSec` 9s base, settable in Settings → Rolling, plus 0.8s per
extra option) — and `setPaused` already froze the bars with the clock, so opening a card to read it
was never the divergence. **A REFUND was.** `refundDecision(2500)` (a correct landing answer, twice
at most) adds up to 5s to `d.remaining`, and the bar was a fixed-duration CSS animation
(`ngCount <dsec>s`) that could not know — so after answering correctly the bar under-reported by up
to **31%** and the hand looked about to expire with a third of its time left. `_tickDecision` now
writes `scaleX(remaining/total)` on the cached `.ngbar`s, so pauses freeze them by construction and
a refund visibly grows them BACK, which is the honest feedback for having bought time. The
`.ngbar` branch of `setPaused` is deleted (there is no animation left to pause) and `@keyframes
ngCount` has no consumer in the app.

**ONE CONTAINER: THE GAME'S OWN CARD (v1.101.0).** v1.100.0 made the node itself the dossier —
`openDossier` flew the camera into the node and mounted the whole reading surface inside its shape.
The owner retired it after living with it: *"the other fuller container should no longer show, and
instead the normal game container should be the default. upon clicking more all of the other
sections that were present in the fuller container would show there now."* The in-node renderer,
its shell/clip geometry and its own question are **deleted** (162 lines); `updateNodeCard()` remains
only as the one place that guarantees the element stays down, because `draw()` calls it every frame
and a stale `_nodeCardOn` would keep the tray faded and the canvas glyph crossfaded out.
- **The roll settles ON the node.** `ROLL_ZOOM = 0.085` of `graphW` — a tenth of the deepest read
  zoom (`graphW * 0.0085`), which is the owner's "zoomed in but like 1/10th of the max zoom". Travel
  (`pulse`) still pulls back so a move reads as a move. The old `graphR * 0.7` floor is gone from the
  settled case: it is a whole-graph measure that dominated the number beside it, so leaving it in
  would have made `ROLL_ZOOM` change nothing.
- **...and UP, into the only clear band on the screen.** Measured at 1440x900: the focus node sat at
  y=450 with the landing card occupying y=362..900 — the state you are playing was BEHIND the card
  that talks about it, at every zoom. `lift = 0.34 * H * vw / W` parks it at ~16% of viewport height.
  The desktop card's ceiling moved with it (`max-height: min(420px,50vh)`) so all four options
  clear the sticky footer. **The PHONE override stays at 34vh** — 40vh was tried and reverted: on a
  390x844 screen it pushed the card's top edge from y=351 to y=301 and swallowed the band the graph
  is panned in, which `share-camera`'s pan journey caught (measured: `elementFromPoint` at the pan
  origin returned `DIV.ng-landcard`, the drag never reached the canvas, and the focus lease it
  exists to release survived).
- **The graph names the state, so the card stopped repeating it.** Owner, on a landing at The Chill
  Dog: *«the "The Chill Dog" and "Bottom" is repeated info»*. The kicker carries the ROLE for the
  current node (`POSITION · TOP`) and the name uses `posFamily()` for positions (every hub is titled
  "… Top" in `graph-data.json` — a reading artifact that would contradict a "· BOTTOM" kicker).
  **SUPERSEDED IN PART BY v1.114.0:** the promise holds, but the graph names the state BESIDE the
  node, not inside it — the in-node text pass is deleted and the focus's rich label, which used to
  be suppressed above 20px to avoid printing the name twice, is now unconditional. See ZOOM IS A
  CAMERA above.
  **A LANDING CARD HAS NO HEADER AT ALL (v1.101.1)** — v1.101.0 left a thin "from <previous>" line
  with the counter opposite it, and the owner's read on that leftover was that the chip "should
  show bottom right same row as More instead of top right in its own row" and the block it sat in
  "shouldn't show". So the card opens on its content, and its three controls live where controls
  belong: `More ▸` at the foot-left, the familiarity chip and the capture `+` at the foot-right
  (the `+` keeps its 24/44px hit area and loses its box), and a 22px `[data-land-close]` **✕
  absolutely positioned top-right**, so the way out costs the card no vertical space. Dismissing
  clears the card for that landing only — the next one renders fresh, and `_landBackfill` returns
  early on a null `_landEl`, so no late payload can resurrect it. An ATTEMPT card keeps its
  headline, because it names the technique the question is about and the graph only labels that one
  while the sweep animates.
- **THE FILM STRIP IS ITS OWN SURFACE (v1.101.1).** Owner: "place the film study row aka the videos
  outside the ng-landcard ... immediately above it". `.ng-landfilm` / `[data-land-film]` is a fixed
  sibling on the root plane, docked by `_dockLandFilm()` to the card's measured top and anchored by
  its BOTTOM — so when a clip expands the strip grows UPWARD into empty screen instead of being
  clipped inside a `max-height` scrollport, which is also what lands a playing clip top-centre. It
  is cleared, suppressed and re-docked with the card (`clearLandCard`, `_suppressLand`,
  `_dockLandCard`), and `collapseClip` re-docks on the way back down.
- **A PLAYING CLIP HAS TWO WAYS OUT (v1.101.1).** A `.ngClipX` ✕ top-right of the player, and a
  capture-phase `pointerdown` outside it — registered during the click that expanded it, which has
  already dispatched, so it cannot close what it just opened. Both end in `collapseClip`.
- **THE CARD'S TWO CORNER CONTROLS (v1.101.1).** Owner: "the + should only show top right next of
  the x close icon". Capture and dismiss are the same kind of thing — chrome about the card as a
  whole — so `[data-land-corner]` holds both, absolutely positioned, costing the card no vertical
  space. The QUESTION LINE carries `padding-right:54px` to clear them — not the `[data-land-q]` block,
  which also holds the four answers: they start below the corner, have nothing to clear, and
  are `white-space:nowrap` + ellipsis, so insetting them spent 54px of answer text (v1.101.3).
  The block also has no top border or margin: with the header gone and film lifted out, it
  divided the card from nothing.
- **AN OPTION CARD IS A CHOICE, NOT A DOSSIER (v1.101.1).** The `from <origin>` line, the
  `→ <destination>` line and the per-card `+` are gone (owner: "it can be removed to make for
  smaller option cards ... the + on those small options cards can also be removed"). `from X` is the
  same word on every card in a hand — they all share the state you are standing in — and where a
  move LEADS is what the option-detail sheet is for. Capture stays on the surfaces you opened to
  read (the sheet, the landing card's corner), not eight times over a running clock. An ESCAPE hand
  keeps its "escape route" line, which is not a restatement.
- **HORIZONTALLY THE NODE IS CENTRE, BIASED LEFT (v1.101.1).** The follow-cam parked the focus 156px
  RIGHT of centre to clear the left pane — but the pane is manual-only and shut for almost the whole
  roll, so that cost was permanent and its reason was rare. Owner: "the selected node should also be
  center middle, or even center left (as text on it reads left to right) but usually it's just
  center right (which causes text to be mostly displayed on the right, sometimes cutoff)". Every
  name hanging off a node runs left-to-right FROM it, so the room a node needs is on its right:
  `offset = -0.06 * vw` parks it at ~44% of the width.
- **`More ▸` unfolds the card in place** (`expandLandCard`, `[data-land-more-body]`, aria-expanded +
  a rotating chevron, label flips to `Less`). It carries what the retired container carried —
  Essential principles, Where it leads, What beats it, Attacks from here — built lazily on first open,
  and never silently empty (`[data-land-more-empty]`). Unfolding **auto-pauses on its own latch**
  (`_landAutoPaused`), so folding can only give back a clock it took; a hand-paused roll stays paused.
  An unfolded card **survives a payload backfill** (`_landOpen`), and a NEW landing starts folded.
- **Film rides the game card, compactly and unlabelled.** `filmStudyHTML(clips, compact)` — the full
  strip is ~210px under a 20px-margined header, which pushed the question below the fold of a 420px
  card and under the sticky footer. Same row, same wiring, same expand-to-play, roughly half the
  height, and **no "FILM STUDY" caption** (owner: "unnecessary" — a row of thumbnails with play
  buttons on them does not need to be told what it is). The reading sheet keeps its heading, because
  there it sits among other headed sections.
- **The one-line definition moved behind `More`.** Owner, reading "Master Deep Half Guard Top with
  defensive counters, pressure maintenance, and systematic passing strategies" above their hand:
  "unnecessary — please remove those, or push the intro if SEO needs it to the content after
  clicking More". It is marketing prose written for the static page; the roll wants film and a
  question. `[data-land-def]` still exists, one fold lower, in `_landMore` — deleting it outright
  would lose copy the static article actually earns with.
- **A node you are NOT standing on opens the reading SHEET**, on every form factor (a top sheet on a
  phone, a right-docked column on desktop) — and it now renders `[data-node-q]` on desktop too, which
  was mobile-only while the desktop read happened inside the node. `dossierRef` is deliberately NOT
  used: it is a child of the explorer pane, which pane law says only the user may open. The camera
  flies TO the node at `ROLL_ZOOM`, not INTO it at `0.0085`.
- **THE READING SHEET IS RETIRED TOO — ONE SURFACE, BOTH FORM FACTORS (v1.101.5).** v1.101.0 sent
  the state you are STANDING IN to the game card but left every other node opening a right-docked
  sheet. Owner, looking at that sheet over their own position: *"when i click on a node in the
  graph, [it] shouldnt appear anymore, the node dialog we just practiced now should show instead"*.
  `openDossier` now has three branches and none of them is a second surface:
  a **technique** renders the game card in `"attempt"` mode (it names the technique and its `+`
  captures THAT technique — staging would hop to its origin position, since `rollFromPosition`
  does that on purpose, and the corner `+` would then capture a position the coach never tapped);
  **another position** stages the roll there (fly, land, deal, clock held); **your own node**
  rebuilds its card if it was dismissed. All three unfold — you opened it to read it — carried
  through the staged landing by the one-shot `_landOpenNext`, because that card is built later,
  when the flight lands. **The `_landEl` guard used to sit on the first branch, and that is how a
  sheet appeared over "Your current position" at all:** the ✕ (v1.101.1) nulls `_landEl`, so the
  next click on your own node fell straight through. A dismissed card is a card to REBUILD.
  DEAD NOW, disclosed rather than deleted at the end of a long pass: `renderDossier`, the
  `dossierSheetRef` element, `_renderNodeQuestion` / `nodeQuestionFor` / `askFormat` and the
  `data-list-surface="dossier"` capture are unreachable from the app (only `first-impression`
  calls `renderDossier` directly). Deleting them removes the **stage-3 recall** question that
  surface carried, which needs a home on the game card first.
- **THE OPTION-DETAIL SHEET GETS ITS DESIGN PASS (v1.102.1).** Owner, opening a technique from the
  hand: "it's very ugly! this should rather match the same design as in small, except with more
  detail but very properly well designed, right now it looks just like a prototype". Four things
  were wrong and all four were measurable:
  · **Prose collapsed into a wall.** Authored copy carries real paragraph breaks — **939 of the 997**
    entries that have both a summary and a context do (94%) — and dropping it into `innerHTML`
    collapsed every one, so three paragraphs arrived as one run-on with sentences colliding at the
    joins ("…over the shoulder.Strategically, the Triangle from Back is…"). `proseHTML()` splits on
    newlines and emits real `<p>`s. That single missing split was most of the "prototype" feel.
  · **The overview printed TWICE.** `rc.context` is a near-duplicate of the attacker summary —
    **205 of 997 (21%)** are >80% the same text, and for the reported node it was 92.2% similar with
    a 1,534-character identical run. `_echoesSummary()` suppresses the tail when it merely repeats
    what is already at the top. The static page keeps its copy either way; this is the app surface.
  · **The head is now the OPTION CARD, enlarged** — the card's exact three-part anatomy (glyph +
    CATEGORY with the potential opposite it, the name, then a bordered success row), so the card you
    pressed grows into this instead of becoming a different object. Owner: "improve visual continuity
    and coherence".
  · **Chrome moved to where the game card keeps it.** The labelled "+ Add to class" footer button is
    gone; capture is the compact glyph beside the ✕ in the corner (`[data-sheet-corner]`), with a
    44px hit area on mobile (`"sheet"` joins `_listAddButton`'s thumb list). The perspective toggle
    and "Play from here" left the header for the footer — "play from here (as attacker / as
    defender) should show not on top" — because a sheet whose first row is a pair of controls reads
    as a toolbar, and one whose first row is a name reads as a technique.
- **NO "ATTACKS FROM HERE" BEHIND `More` (v1.102.0).** The owner asked whether it was repeated
  content, "since we anyway show options for the user to select (which are attacks / transitions /
  edges out of this state)". It was worse than repetition. That block was RAW ADJACENCY — first
  six neighbours, deduped by short name, with **no role filter and no origin filter** — while
  `optionsFor()` builds the hand from the same adjacency and then keeps only what favours the side
  you are playing and what actually originates here. Measured across all 272 position-role hands
  (1,632 pills): **42.3%** originated at a DIFFERENT position, **35.4%** were the opponent's move
  *and* from elsewhere, **10.8%** were the opponent's move, and only **11.5%** were legitimately
  yours. It also overlapped the dealt hand by just 12.9%, so it did not even read as a summary of
  the tray below it. **All 188 of the legitimate pills were already in the choices — 100%** — so
  nothing was lost by deleting it. Zero SEO exposure: the string lived only in `neural.js` (and
  still does, in the dead `renderDossier`), never in emitted HTML; a generated position page's
  `<article>` never carried it.
- **`More ▸` IS ONLY RENDERED WHEN THERE IS MORE (v1.102.0).** Owner: "if there is nothing to show
  by clicking More then don't show the More". `_landMoreHTML(node)` returns the sections as a
  string, or `""` — and `""` is the point: the foot draws no button, the body is not created, and
  the old "Nothing more is authored for this state yet" placeholder is gone. ONE function serves
  as both the predicate and the content, so the button and the panel can never disagree. It is
  computed at render time (a few cache reads and a string), because the foot has to know before it
  draws. NB journeys about the fold must AUTHOR content — the DSL serves `{}` for dossier chunks,
  so most states legitimately have no `More` under test.
- **THE CAPTURE PICKER ALWAYS OPENS — NOTHING IS ASSUMED (v1.102.0).** v1.99.5 took a shortcut:
  zero or one list and not-yet-captured filed straight into `activeListId`. Owner: *"list of lists
  should show before adding anything, instead of showing it already green and saying 'added to list
  whatever was being added last' — rather let the user select which list to add to. dont assume."*
  Right on both counts: "one list" is only unambiguous the FIRST time, and from the second onward
  `activeListId` is whichever list was last created or touched — not a destination anyone chose —
  while the ✓ that followed announced a filing they never made. `captureNode` is now just
  `openListPicker`. The label lost its presumed destination too ("Add to a class list…", never
  "Add to class list *Class · Aug 12*"). The canon this overturns — "do not tax capture with a
  chooser, the option hand is on a clock" — was written when every option card carried its own
  `+`; those went in v1.101.1, and what is left are surfaces you are already reading. Zero lists
  opens straight into the name field, so a first capture is still one decision.
- **THE PANE PAINTS OVER THE GAME CARD, AT EVERY WIDTH (v1.101.7).** The card is
  `min(520px, 100vw - 32px)` and CENTRED; the pane is 360px on the left. They miss each other at
  1440 and overlap by **108px at 1024** — and the card won, because the pane's `z-index:8` is
  trapped inside the `position:fixed` app wrap (its own stacking context) while the card is a
  root-plane child at z:5. The phone rule ("hide the card while the drawer is up") was written as
  mobile-only on the reasoning that "desktop is untouched — there the card sits beside the left
  pane by design", which was true at one width and false below it. Owner: *"the left side pane
  should always appear in front of the current node's dialog, not hidden behind it — the game
  pauses when the left pane is open"*. That second clause is the argument: nothing is running, so
  standing the card down costs nothing, and it returns unchanged on close. `_suppressLand` is the
  seam (it takes the film strip too, and sets `visibility:hidden`, so no invisible child keeps
  eating clicks). Pinned at 1440 AND 1024 by `pane-chrome.spec.ts`.
- **`attachInput` MUST NAME EVERY FIXED OVERLAY THAT OWNS CONTROLS (v1.101.5).** Its pointerdown
  calls `setPointerCapture` on the wrap, which retargets pointerup, so the browser resolves the
  click to the down/up common ancestor and a listener inside an overlay never fires. Fourth
  instance: the game card's own corner `+`. It measured the button, hit-tested to the button,
  took a real mouse click on the button — and captured nothing; `locator.click()` (which
  dispatches on the element) masked it completely. `.ng-landcard` and `.ng-landfilm` join the
  node card and the sheet in the early-return. Any new fixed overlay with controls goes here too.
- **A SUPPRESSED LANDING CARD MUST BE INERT, NOT MERELY TRANSPARENT (v1.100.2).** `_suppressLand`
  set `opacity:0` + `pointer-events:none` on the root. Both are inherited — and `[data-land-foot]`
  re-enables pointer-events INLINE on purpose (it holds `More ▸` and the capture `+`). Hit-testing
  ignores opacity, so a "hidden" landing card kept a fully **INVISIBLE** sticky footer strip live
  across its box and whatever sat under it was dead to the mouse (measured: `elementFromPoint`
  returning `<div data-land-foot="1">` at the centre of a capture button, 120s of Playwright
  retries). It now also sets **`visibility:hidden !important`**, which is inherited, which nothing
  here escapes with `visible`, and which removes the subtree from hit-testing outright. Fifth
  instance of this repo's recurring bug class. The three sibling hide-sites that write
  opacity/pointer-events directly (the option-detail sheet pair, the mobile-pane pair) share the
  shape of the hole and were NOT changed — unverified.
- Tests: `e2e/journeys/roll-card.spec.ts` (5 journeys). `node-card.spec.ts` is deleted with its
  subject; the label/plate journeys it held describe a surface that no longer exists.


**LAST ROLLS: ▶ ROLL FROM HERE, ⟲ REPLAY (v1.106.5, owner: "History should have a play from here and a replay button indeed. dunno how to best design it visually, wear your design hat").** A past-roll row is now a first-class object with two quiet right-side controls; a REPLAY is a **film of a roll you already rolled** — the camera walks the archived exchanges, sweeping each edge to its technique and on to where it landed you, with the announcer line for every beat.
- **THE LOG LEARNED THE EDGE.** `rollLog` recorded the STATES you passed through and nothing about how; a film cannot be reconstructed from that. Each landing now carries **`via` = `{idx, name, ty, actor, kind}`** (the technique node the exchange travelled over) plus `from` (the previous node), written through the SAME `_pendingIntent` seam the "you aimed for" line already used — set in `enterAttempt`, `opponentDefend` and the escape branch of `enterDefense`. `endRound(kind, name, nodeIdx)` gained its third argument so the archived record carries **`finish`**: a submission finish produces no landing, so without it the film of a won roll stopped one beat short of the thing the roll was for. All of it is IN MEMORY — `rollLog`/`_pastRolls` have never persisted and this does not change that.
- **A FILM CREDITS NOTHING, and that is enforced by not being an `fx()` beat.** `_replayBeat()` pushes onto the same `this.beats` stream journeys read and stops there; `fx()` is the challenge-evidence (and sound-catalog) seam, and every beat through it is offered to `noteChallenges`. Beats: `roll_replay_start` / `roll_replay_end`. Analytics — allowed to know — is one `track("neural_roll_replayed")`. Pinned by a journey that compares `stage`/`srs`/`prep`/`rec`/`challenges`/`badges`/`coins`/`units`/`gameScore()`/the whole persisted blob before and after a complete replay, and asserts the film is silent.
- **THE CLOCK IS HELD THROUGHOUT**, on its own latch (`_replayAutoPaused`, the pane/dossier/`More` pattern), so stopping gives back only a pause the film took. **Travel steps on the REAL frame delta while a film runs** (`updateTravel(this._replay ? dt : gdt)`) — the sweep IS the feature, and travel is a display primitive exactly like the camera, which has always run on the real clock. The live roll's `pulse`/`activeMove`/`trail`/`focusIdx`/`camFocus`/`camTarget` and the one announcer slot are snapshotted at `startReplay` and handed back by `stopReplay`.
- **ANY REAL INPUT ENDS IT**: a pointerdown on the canvas (pan, pinch and tap in one place), a wheel, Esc (a rung ABOVE the pane — a film is ambient chrome, the pane still closes last), and `setPaused(false)` — pressing play stops the film rather than running a roll underneath it. `rollFromPosition`/`startRoll` stop it FIRST, before `clearTimers()` and before they write the camera, or the restore would land on the new roll.
- **IT NEVER TOUCHES THE PANE, and closing the pane HANDS THE CLOCK OVER.** On a phone the 88vw drawer IS the screen, so closing it is how you watch — resuming there would cancel the film with the very gesture that exists to see it. `applyDeckVisibility` therefore moves the pause latch from `_paneAutoPaused` to `_replayAutoPaused` instead of resuming, and the landing card's un-hide is gated on `_traySup` so the card cannot reappear over the film.
- **Design.** The film opens on an **establishing shot** (every node of the roll framed at once) and then walks it — film language, and measured: the camera starts wherever the paused roll left it at `ROLL_ZOOM`, so without a wide frame first the opening beat spends its whole second flying with its own state off screen. Each beat takes a **fresh camera lease** for exactly its duration (`_replayAim` → `holdCamera`), framing a landing with `rollCamTarget` and an exchange with all its nodes on BOTH axes, shifted for an open pane like `locateNode`. Announcer copy is past tense and obeys ONE SUBJECT PER LABEL (v1.104.1): "You went for" / "Opponent went for" / "You escaped", with the graph verb naming YOUR posture.
- **Chrome:** `.ng-replaybar` (`[data-replay-bar]`, `role=status`) at **z:8 — the ambient-state band**, deliberately not the 90-99 deliberate-screen band (a replay is a state you are in, not a screen you asked for), docked where the LANDING CARD docks via the same `_dockLandCard` tray measurement, because it stands in for exactly that surface. Its `[data-replay-stop]` ✕ is the 44px thumb figure.
- **Row controls** are `.ng-histctl` — 24px glyphs (the pane's control figure, WCAG 2.2 AA 2.5.8), hit areas grown with `padding:4px;margin:-4px`, states in `helmet.html` beside `.ng-anchor-*` (never JS hover painting, which cannot express `:focus-visible`), real `aria-label`s naming the roll. `gap:20px` buys the **12px miss-distance between HIT BOXES** (flex gap measures between margin boxes, so 12 there would leave 4). Handles: `[data-past-roll]`, `[data-roll-from="<ts>"]`, `[data-replay-roll="<ts>"]` (`aria-pressed`, `[data-replaying]` while it plays).
- **▶ STAGES, and it asks first.** `confirmPlayFrom(n, opts)` gained `opts.role` (the row knows the side you actually played — every position hub is titled "… Top", so a derived role is the constant `top`), `opts.staged` (its own copy: "Set the board here" / "Set it up") and `opts.go` (the caller's action: the SCREEN is shared, but Last rolls stages with the clock held per ROAM & STAGE and closes the pane, per v1.104.5's "this is the USER pressing play"). The per-state ▶ inside a roll also passes the recorded role now — it derived `top` for every Bottom row it has ever had.
- **Reduced motion** is read at replay start (`_reducedMotion()`): no travel pulse is created, the camera SNAPS, and the beats step on a fixed dwell. The spec proves it with `page.emulateMedia({reducedMotion:"reduce"})` — measured, `test.use({ reducedMotion })` leaves `matchMedia` FALSE in this harness, so a spec relying on the fixture option asserts nothing and passes forever.
- **Tests:** `npm run e2e:replay` → `e2e/playwright.replay.config.ts` (own port **:8151**, `reuseExistingServer:false`) runs `e2e/journeys/history-replay.spec.ts` (6 journeys, 3 `@curated`, incl. a 390x844 drawer journey); it also runs inside `npm test`. Camera claims PROJECT each beat's node through `draw()`'s transform into the viewport rect — never `camTarget` (share-camera canon).

**ROAM & STAGE (v1.68.0).** Clicking any graph node calls `stageRollAt(idx)`: fly there, land, deal the hand — **clock held**. Click elsewhere and you restage the same non-session. `_played` (set in `_tick` on the first unpaused frame with a live hand) is the seam: a roll that never played is never archived into `_pastRolls`. Tapping the node you are already on reads it (dossier) instead. `after(sec, fn, ignorePause)` exists so a staged landing still arrives while paused. Beat: `roll_staged`.

**CAMERA OWNERSHIP — a focus flight holds a LEASE (v1.81.4).** `frameNodes()` does not move the camera. It writes `camTarget`; the render loop eases toward it, and **`updateCamera()`'s follow-cam rewrites `camTarget` at the current roll node on every frame**. So every "here is your selection" flight (a shared class lighting up, a System lighting its members) used to be overwritten within one frame of a live roll — invisible on desktop only because the arrival opened the pane and an open pane pauses the roll. `frameNodes` therefore calls **`holdCamera()`**: `camHoldSec = 7`, checked by `camHeld()`, cleared by `releaseCamera()`.
- While the lease is live, **every automatic retarget yields** (`if (this.introDone && this.camHeld()) tgt = null` — follow, Overview and the end-of-round zoom alike). It **expires**, so the 400ms pan-to-current-node behaviour returns on its own.
- **A real pan, pinch or wheel releases it** (never fight a user's camera); so do the user's own "go somewhere else" paths — `locateNode`, `openDossier`, `playFrom`, `rollFromPosition`. A re-light (`relightShare`) takes a **fresh** lease.
- An intro still flying **hands the camera over** when it finishes: a share link is decoded at t=0, 3.2s before `introDone`, and its flight used to be eaten by the intro.
- `frameNodes` fits **both axes** (`vw` is a width; the visible height is `vw * H/W`), or a tall selection hangs off a 390x844 phone.
- **Never assert camera behaviour by reading `camTarget`** — that is exactly how this bug survived three reviews. Project the node through `draw()`'s transform and assert it is inside the viewport rect: `e2e/journeys/share-camera.spec.ts`.

**THE BOTTOM THUMB BAND (v1.81.4; re-tenanted v1.99.0).** Fixed tenants at `bottom:28px` on a phone: legend (left), `.ng-transport` (centred), the **account chip** (right — it took the deleted pill's seat). The **share cue** is a standalone conditional control (`.ng-sharecue`, ABOVE the chip: desktop `bottom:76/right:24`, phone `bottom:84/right:14`) rendered only while a cue exists (`[data-share-cue]` ◉ re-light + `[data-share-open]` Class ▸, 44px targets, pointer-events:auto inline), hidden while the pane is open. `_renderShareCue()` still stamps `body[data-share-band]` (diagnostic hook; the pill-era CSS that consumed it is gone). Measured band at 390: legend 14–118 · transport 150–240 · cue above-chip, all individually hit-testable.

> Two values were tried, rejected, and must not come back. **`body[data-share-cue]`** collides with the cue BUTTON's own attribute, so `document.querySelector("[data-share-cue]")` returns `<body>` — every "where is the cue" measurement silently becomes the whole 390x844 viewport and every tap aimed at its centre lands mid-screen (three share journeys went red on it). And a **66px** transport shift merely relocates the collision onto the band's third tenant, the legend. Deliberately **not** a `max-width` on the pill: a capped right-anchored flex row pushes its last button off the right edge instead of shrinking. Asserted geometrically (transport, cue, legend) at 390x844.

**ARRIVAL COPY IS HELD, NOT FIRED AT t=0 (v1.81.4).** `setEvent` is ONE slot. A share arrival is decoded at ingest, mid-intro, and the roll's first landing overwrites it seconds later, so `_announceArrival()` stores the sentence and `enterLand()` says it (`_sayArrivalIfPending`) once the graph has settled. A timer cannot do this: `startRoll()` calls `clearTimers()` at the end of the intro. `saveSharedList`/`dismissSharedList` drop a held sentence — the user already answered.

**A DAMAGED SHARE LINK: TWO SENTENCES, ONE SOURCE (v1.81.4).** `ngListClassifyFailure(code, error)` decides between **`clipped`** ("one of ours, cut short in transit") and **`unreadable`** ("not one of our codes"), because `not_base64url` — the majority of real clip positions — is *also* what a pasted random word looks like. The tell is the leading wire-version byte (`ngListWireVersionOf`, two base64url chars). `_brokenCopy()` is the single seam for the pill label, the panel (`[data-shared-broken-kind]`) and the toast, so they can no longer contradict each other.

**CHALLENGES (v1.74.0, laddered v1.76.0).** Challenges replace the one-time Tutorial and locked progression path. Five content tracks — White Foundations, Blue Connections, Purple Patterns, Brown Pressure, and Black Breadth — are open from day one. Track colors describe material difficulty, never real-world rank or access.
- **The tab renders as THE BELT CORRIDOR (v1.98.0)** (`.ng-challenge-ladder.ng-corridor`): one continuous vertical woven belt (`.ng-corridor-rail`, the knowledge belt's weave turned vertical) runs down the left, white through blue/purple/brown/black, a knot (`.ng-corridor-knot`) tied at each boundary; lesson rows hang off it. Belt-section headers (still class `ng-track-card`, `data-track`, `aria-pressed`) speak **plain belts** — "White belt", never "White Foundations · CONTENT TRACK" (display only; track ids/names unchanged) — and count LIVE lessons. Each `.ng-belt-section` **collapses via its `.ng-belt-toggle` chevron** (`data-collapsed`; body display only, every row stays in the DOM, nothing re-locks); open/closed persists per section in the `challengeOpenSections` settings map; defaults = pinned belt open, the rest folded; clicking a folded header selects AND opens. The **Getting started tutorial** — the 20 White evidence objectives — is its OWN section (`[data-tutorial]`, `.ng-tutorial-section`) ABOVE the corridor, separate from the curriculum; it defaults collapsed at ≥14/20 done and then shows the not-done remainder compactly (`[data-tutorial-remainder]` chips). The corridor explains itself ONCE (`.ng-ladder-note`) — the per-track prose block is display-retired. The selected track's objectives block (`.ng-challenge-detail`, unique) rides inside its section's body (White's detail carries no objective rows — they ARE the tutorial). Lesson rows carry a category tint (`data-cat` position/transition/submission, Explore's palette), a `✓` **edge check** when done (`.ng-lesson-check`), and an inline mini-deck disclosure (`[data-lesson-deck-toggle]` reveals `_miniDeck` in place, the History pattern — the row itself still opens the full study takeover). Each belt body renders a **Principles slot** (`[data-principles]`, `renderBeltPrinciples`) ONLY when curriculum data ships `belt.principles` — distributing actual Principles content across belts is owner-gated curriculum authoring, never invented in code. The corridor's one target is the **frontier belt** — `_frontierBeltId()`, the topmost belt whose live lessons aren't all done (v1.99.2: PINNING IS RETIRED — `challengePinnedTrack` stays dormant in blobs, read by nothing; `pinChallengeTrack` deleted). The frontier belt drives: the default-open section, the arrival scroll, the frontier-lesson glow (`challengeFrontier(beltId)` → `data-frontier`), the tab belt's dye+stripes, the challenge cue, and the selected-track fallback. Completing a belt advances all of them to the next belt (tab belt = fresh dye, 0 stripes). Not-done rows dim **visually only** (`data-lesson-done`, opacity on the text span — crowns keep full color; nothing re-locks, per canon).
- White Foundations preserves the original 20 evidence predicates; the first-roll coach completes the first three. Legacy `tut.done` is dual-read and compatibility-written, then migrated exactly once into `challenges`.
- Advanced tracks combine event evidence (`combo`, `escape`, `roll_end`) with snapshot evidence (lessons, checkpoints, recall, mastered decks, capstones). `fx()` is the single processing seam.
- The challenge cue (frontier belt's next objective since v1.99.2) stays available during rolls, can be hidden in Settings → Rolling (the toggle is also its restore path), and never takes focus or blocks the option hand. Opening the pane temporarily removes the cue.
- Challenge lessons are always open. A unit checkpoint requires its own live lesson evidence; an optional content capstone requires that track's unit checkpoints. Clearing a capstone records proof but never unlocks another track.
- **Rewards shelf (was the Collection tab):** patch-style badges (meaningful milestones) and mint-once Mat Coins (humorous acknowledgements) live in a `<details>` shelf (`[data-rewards-shelf]`, `renderRewardsShelf`) at the foot of Challenges; reward toasts' "View Collection" opens+scrolls it. **The shelf earns its place (v1.99.1, owner):** it does not render until something is earned, and it shows ONLY earned items — the "Available to earn" placeholder grid is dead (capstones already say "Earns a patch"; the joke coins spoil if listed upfront). Neither is spendable and neither changes odds, score, timers, content access, or opponent behavior.
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
- The score's UI exposure is the Explore tab subtitle "Mastered N%" (v1.98.1 — the woven `.ng-knowledge-meter` visual is retired everywhere: header v1.96.0, Explore mount v1.98.1; `gameScore()` and its math untouched). The Challenges tab's `.ng-tab-belt` (unit stripes) and the corridor rails are the only belt visuals. **Nothing is gated by the score** and the thresholds are provisional.
- **The meter IS a woven belt (v1.90.0)** — CSS-only strap + rank bar + tape stripes (`data-belt`, `.ng-belt-bar > b`; black wears the red bar and NO stripe ladder; stripes end at black). **Its quiet companion is the band line (v1.93.0)**: `.ng-belt-road`, the five bands white→blue→purple→brown→black laid on the score axis at the BELT_SCORE thresholds (20/40/60/70/80) with a `.ng-belt-you` dot at the score. **No pedagogical labels**: "Building foundations" and "Proven recall, not challenge completion" are deleted — pre-belt shows the bare score, a held belt shows its rank name, and the sub-line is the plain road ("50% to purple"). Belt-name aria labels are unchanged (belt-meter.spec pins them).
- **RECALL MODE IS A BLACK-BELT BADGE (v1.105.1, owner: "it's a badge he wins... a toggle that's disabled until he becomes black belt", "we can see it in the challenges").** The MC→recall flip IN PLAY is a reward, not a default: setting `recallInPlay` renders in Settings → Flashcards as a LOCKED teaser (`[data-recall-locked]`) until `gameScore().belt === "black"`. The badge `recall-in-play` is event-driven (`belt_reached`, fired post-grade from `noteCardAnswered` while black-and-unminted — NOT from `_bumpStageVer`, which hydration calls; a payload must never mint a badge) and **the auto-flip lives INSIDE the mint loop only**: flipping on the mint (once per account) means turning it off later STICKS — a flip driven by "belt is black" would re-enable it on every device forever through settings LWW. With the toggle on, a **stage-2+** landing card renders `_recallBlock` (`[data-land-recall]`) instead of MC — per-card, recognition first for stage-0/1; the warm gate is format-aware (a recall block never waits on a distractor pool). **A self-graded recall never refunds the clock or ticks the combo** (`_landAnswered`'s `format` arg) — "Show answer → Got it" is unverifiable and would be a free-time button; odds/mastery credit still flows. The Black corridor section advertises the reward up front (`[data-recall-reward]`, the capstone "Earns a patch" idiom). Pinned by `e2e/journeys/recall-badge.spec.ts`.
- **REAL SPACED REPETITION exists since v1.105.0 (owner directive, 2026-08-16 — this REVERSES the old "forgetting is tested, not timed / no idle decay" canon; "maintenance should come first before learning new techniques").** The resolution that makes both true at once: **due-ness decides what you are SHOWN; mastery stays stage-based and moves ONLY on answers.** A card a year overdue changes nothing about `gameScore()` — the belt cannot drop because time passed (pinned by `srs-due.spec.ts`). Review-again and trap answers still lower a card's stage; the calendar never does.
  - **`srs = {deckKey: {qhash: [due, ivl, last]}}`** in the v2 blob (no version bump), LOCAL epoch-day ints (`_epochDay()`, overridable via `window.__NG_EPOCH_DAY__`; LOCAL because `_dayKey()` is local and two cells on one band must share a midnight). ONE writer `_schedule(key,q,ok)` fed by BOTH grade chokes (`gradeRecall`, `_mcAnswer` — scheduling is memory, not format): success climbs `NG_SRS_IVLS = [1,3,7,14,30,60,120]`, any failure resets to 1. It mirrors `noteCardDone`'s cross-deck credit (one FACT, one schedule — `_sharedDecksFor` returns null-or-list-INCLUDING-self; skip self or every grade double-climbs), emits NO fx beat (replay-digest safety), and is deliberately NOT in `noteCardDone` (the harness drill rail writes prep directly and must keep an empty srs).
  - **The pool drains on failure**: `duePool()` = `due <= today && last < today` — a failed card returns TOMORROW instead of stalking every landing all day. `dueCount()` dedupes by qhash (facts, not deck copies).
  - **Merge** (beside `stage`'s MAX): later `last` wins; same-day tie → SMALLER ivl (a failure is never erased by an earlier same-day success); a winning SUCCESS keeps the larger ivl (heals grade-before-pull); ingested `last` clamps to today (a fast clock cannot win forever). `stage` MAX vs `srs` recency can disagree post-merge — deliberate: stage is proof, srs is freshness.
  - **Due first, everywhere**: `questionFor`/`nodeQuestionFor` ask due cards before new ones (any stage — which is why `_bumpStage`'s cap is now GROWTH-ONLY: `min(cap, cur+d)` used to write 2 over a proven 3 on a correct MC answer, dropping the belt and re-minting `rec`). The maintenance surfaces: the stats band's middle cell is the honest fact-deduped due count (amber when owed; one press opens the due SESSION), and Challenges opens with a `[data-maintenance]` band while anything is due. The `"due"` bucket is real (deck keys with due cards, most overdue first); due sessions narrow entries to due cards via `_entryForKey(key, "due")`, and the filter is stored ON the entry so hydration rebuilds (`_restudy`, the backfill) cannot silently widen a maintenance session to the whole deck. The dead `studyOrder` setting is deleted — due-first is behaviour, not a preference.
- `crownBadge(frac, tint, false)` gives each Challenge lesson a 0–4 crown from `deckMastery(deckKey)`. Crowns visualize the same evidence as Game Knowledge; they are not a second score.

**CHALLENGE PERSISTENCE + MERGE.** The existing v2 progress blob adds `challenges`, `badges`, and `coins` without changing the blob version. Challenge entries are `{progress, done, t}`; collectibles are `{t, context?}`. Cloud reconciliation uses MAX for progress, OR for completion, UNION for collectibles, and the existing per-key timestamp LWW rule for settings. A fresh device must pull before its first push. Corrupt local state falls back cleanly, and snapshot-derived historical rewards persist without replaying old toasts.
- Challenge settings: `challengeView`, `challengeSelectedTrack`, `challengePinnedTrack`, `challengeCueVisible`, `challengeMigrationSeen`, `challengeOpenSections` (per-section corridor fold map, v1.98.0).
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
- **There is ONE audio engine.** `source/quartz/components/scripts/gameAudio.ts` (the legacy variant's second engine, `GAME_SOUND_CATALOG`, gated on `BJJSettings.soundEnabled`) was **deleted in v1.80.0** with the rest of the legacy front-end — the file does not exist and `?variant=legacy` selects nothing. Neural's settings are `sound` and `soundVolume`. Do not reintroduce a second catalog of default-runtime sounds.

**`pointer-events:auto` is LOAD-BEARING on every fixed overlay** (`.ng-coach`, `.ng-landcard`, …): the property is *inherited*, the overlay root disables it, and the canvas hit-tests above anything that doesn't re-enable it — option cards set it inline for exactly this reason. Missing it = mouse clicks silently fall through to the graph (the coach's Next button and the landing card's MC options were unclickable by mouse until v1.69.1; keyboard paths masked it).

**THE Z LADDER (v1.95.1, documented in `neural/src/helmet.html`):** the root overlay plane (direct children of `#neural-root`) is banded — 1-9 ambient state chrome (landcard 5, momentum 6, tut/cue 7) · 10-49 ambient fx (toast 14, vignette 44) · 50-79 coaching (coach 70, combo pop 72) · **90-99 DELIBERATE temporary screens** (account menu 90, `.ng-modal` settings/legal/auth/search + roll-from confirm 95). The app wrap is `position:fixed` = its own stacking context, so any z inside it is trapped at plane level 0 — a deliberate screen must live on the root plane (the modal **portals out at boot**; the account menu portals on open). A screen the user asked for is never underdrawn by ambient gameplay overlays; the modal scrim takes the input; **Esc walks the ladder top-down** (modal → menu → sheet/dossier → pane last, per pane law). New overlay = pick a band, never a loose number. On a PHONE the 88vw drawer owns the screen: `applyDeckVisibility` hides the landing card (opacity/pointer-events, same treatment the option sheet gives it) while the drawer is open — the card is root-plane (z:5) and would otherwise paint over and out-click the in-wrap pane.

**Settings additions:** Rolling tab gains *Questions while you roll* (`landQuestions`, default on — gates the QUESTION only; identity+film render regardless) and *Challenge cue* (visibility; it tracks the frontier belt). Flashcards tab's *Answer mode* defaults to Classic recall. Shortcuts lists `A B C D`.

**A LESSON ROW READS AND LOCATES; IT NEVER TAKES THE PANE OVER (v1.105.2, owner: "we don't want content that opens in the sidebar and takes over the whole sidebar, nor do we want the sidebar to close").** A Challenge lesson's name click = the `▸`'s inline Q&A (shared `openMini`, hoisted from the toggle listener — same accordion law) + a **pane-aware `locateNode`**: the node centres in the VISIBLE region right of the 360px pane, computed from TARGET values on both axes (`deckShown ? 1 : 0`, never the eased `uiShift` — camTarget is written once and a click mid-open would bake a fractional offset in forever; and THIS flight's `vw`, never mid-flight `cam.vw`, which can be 10× larger). `sbOffset()` is 0 on phones. `openLessonStudy` survives for sessions/checkpoints only. **The inline mini-deck GRADES** (`[data-mini-got]`/`[data-mini-again]` → `gradeRecall`, so lesson evidence/prep/stage/srs all flow) behind a per-card session latch — `render()` rebuilds innerHTML wholesale, and an unlatched button is six interval rungs in six clicks; reveal stays SEEN-only. Pips wrap. Camera assertions PROJECT the node into the visible rect (share-camera canon) — `challenge-curriculum`'s old camTarget±60 takeover contract is retired, the four journeys whose subject is the study surface enter via `openLessonStudy`, and `test-story` keeps its real click as the proof the row does something.

**THE EXPLORE FOOT'S FEEDBACK ROW (v1.105.5, owner: PostHog, NOT GitHub issues).** `Request a technique · Report an issue · [★ GitHub]` between the pane anchor and the legal row. Both open ONE modal (`openFeedback(kind)`) → `track("neural_technique_requested" | "neural_issue_reported", {text ≤500, node, app_version})` — PostHog capture IS the collection, no backend; a "no personal info" hint keeps `track()`'s no-PII convention honest. The GitHub chip (`[data-gh-chip]`) is always a link; the star count paints only from a day-cached `gh-stars` localStorage value or a LAZY fetch (first pane open, never boot) whose `.catch` is load-bearing — the harness aborts non-localhost requests and specs collect `pageerror`. **CSP: `https://api.github.com` lives in `connect-src` in THREE places** — `source/quartz/static/_headers`, `functions/l/[[path]].js` (byte-identical, `check_headers_cache` check 8), and the re-emitted `source/public/_headers`.

**LISTS READ AS EXPLORE SECTIONS (v1.103.4).** Owner: "the listings of the lists design look very
ugly, instead ... the lists and items like categories / items in the explore tab, except they are
lists ... with a play + share icon + close icon on the right of it". A list row is now the SAME
object Explore gives "Systems" or "Positions" — full-width, 7px/12px padding, 14px/700 name,
`(n)` count, chevron, hover wash, no card and no border box — and its techniques are that section's
ITEMS at a 22px indent with the category glyph Explore puts in front of every technique. The three
controls are glyphs on the right: ▶ drill, share, ×. A LIT list keeps its wash, because "these are
on the graph right now" is state, not decoration. Every handle survives the restyle
(`data-list-row/-name/-open/-chevron/-count/-drill/-share/-delete/-items/-item/-item-remove`), as
does the two-step armed delete and its 12px miss-distance from Share; each glyph carries a real
`aria-label` naming its list, since a `title` is not an accessible name.

**`[data-lists-target]` IS RETIRED (v1.103.3).** it existed to make v1.99.5's silent default destination legible, and v1.102.0 removed the silent default, so it was naming a fact that had stopped being true (owner: it "shouldnt exist"). `targetList()` survives as the picker's `[data-picker-default]` ordering, which is an OFFER, not a decision.

**THE PICKER NO LONGER HIDES WHAT YOU WERE READING (v1.103.2).** `openListPicker` used to suppress
`.ng-landcard` while it was up, on the reasoning that on a phone the picker's band is exactly where
the card sits. Owner: the `+` "should show the list of lists to choose from without hiding
ng-landcard". The z ladder already settles it — the picker portals to the root plane at **90**, the
card is **5** — so it owns the INPUT without taking the view. Hiding the thing you are reading in
order to answer a question about it is the wrong trade. `lists-picker.spec.ts` asserts the card is
still readable behind it AND that `elementFromPoint` at the picker's centre is the picker.

**ONE CAMERA FRAMING, AIMED AT THE LABEL, IN THE MEASURED BAND (v1.103.2).** `rollFromPosition`
hard-coded its own `vw: graphW * 0.42` with no offset and no lift, so clicking a node to navigate
landed on a completely different composition from the one the roll settles into — the owner: "on
random / auto roll it works well... almost". `rollCamTarget(f, moving)` is now the single seam both
use.
- **Vertically it centres the node's LABEL in the band that is actually free** — below the announce
  block (`evRef`, when visible), above the film strip (or the card, when there is no film). MEASURED,
  not a constant: the `0.34 * H` it replaces was tuned at 1440x900 and wrong at every other height.
  And it aims at the LABEL, not the node's centre — `draw()` writes a submission's text `rs * 0.24`
  below centre, so a triangle's label sat low by exactly that much. A degenerate band (< 80px)
  falls back to the top band rather than producing nonsense.
- **Horizontally, ~44% of the width**, unchanged from v1.101.1 and for the same reason: every name
  hanging off a node runs left-to-right FROM it, so the room it needs is on its right.

**THE UNFOLDED CARD, TWO FIXES (v1.103.1).**
- **The definition was the SEO lead-in, not the definition.** 1144 of the 1598 authored `def`
  strings (72%) open with "Master <thing> in BJJ." — copy for the static page — and `mcClip` clips
  to the FIRST SENTENCE, so the reader got the marketing line and lost the definition behind it. In
  every one of those 1144 there IS content after it. Owner, on "Master the Estima Lock Bottom
  Position in BJJ.": "this is kinda pointless info". It was — but the fix is `definitionOf()`,
  which skips the lead-in and clips what follows, not dropping the field: the useful half was one
  sentence away. A def that is ONLY the lead-in renders nothing.
- **An unfolded card must fit the screen it is on.** `.ng-landcard` is anchored by its BOTTOM
  (236px desktop, 206px phone, `_dockLandCard` overriding again), so the constant
  `max-height:min(620px,74vh)` grew it UPWARD off the top of short viewports: measured at 1440x720
  the expanded top was **-28** with `scrollHeight == clientHeight`, so there was no internal scroll
  to recover it either — "I can't scroll up". `expandLandCard` now derives the ceiling from the
  card's own measured bottom less a 12px inset, so anything that does not fit becomes scrollable
  rather than unreachable (720px: top -28 → +12, scrollH 510 > clientH 470). Pinned at 900 and 720
  by `roll-card.spec.ts`.

**ROLE CORRECTNESS: WHO MAY PERFORM A MOVE (v1.103.0).** The owner, mid-roll: "I thought our last
position was Bottom Rear Triangle ... you're open to being finished from Triangle, not finishing
anybody, so they shouldn't be available to me right?" Right — and chasing it found three defects.

- **`s` IS TWO DIFFERENT PAIRS.** A POSITION carries `[top, bottom]`; a TECHNIQUE carries
  `[attacker, defender]` and is always antisymmetric (verified: 0 of 1328 asymmetric;
  `scripts/enrich_graph_strength.py:18` states it). `roleIdx()` indexed BOTH with a top/bottom
  index, so every bottom-performed technique was read as its opponent's value. Measured: **a bottom
  player was shown ZERO of the 297 submission nodes** (every submission scores ≈ +0.90 for its
  attacker), and 144 of the 596 bottom-authored techniques — the 60 submissions + 84 sweeps that are
  EV-positive — were exactly what got discarded. `valIdx(node)` now picks the slot by PERFORMER for
  techniques and by side for positions.
- **THE PERFORMER IS READ, NOT INFERRED.** `optionsFor` used `myVal < oppVal - 0.05` ("the
  beneficiary is the performer"). That is a heuristic over a score; the data states the performer
  outright in every technique's `fromRole`. It now reads it — and so does the no-candidates
  fallback, which relaxes ORIGIN but must never relax ROLE. A wrong role is now a content bug, and
  `validate_graph_integrity`'s `from_position_role_mismatch` names all 65.
- **40% OF POSITIONS SHIPPED THEIR PARENT'S STRENGTH.** `enrich_graph_strength.py` globbed
  `content/Positions/*.json` NON-recursively, so the 54 nested files never loaded and inherited
  their hub via the parent fallback — whose own comment said variations "carry only
  name/slug/description, no metrics of their own", **false for all 54 of 54**. Both globs are
  recursive now (`score_graph_nodes.py` too, or `--dump` disagrees with what ships), and a nested
  position resolves by its own leaf slug before the parent fallback is consulted.
  `Triangle Control/Rear Triangle` inherited the closed-guard triangle's opposite polarity:
  `[-0.366, +0.204]` → its own `[+0.645, -0.444]`. 475 nodes moved (95 positions, 380 techniques).
- **`posId` WAS A PATH WHERE `fromPositionId` IS A SLUG.** Nested positions emitted
  `"triangle-control/rear-triangle"` while their own techniques say `"rear-triangle"`, so
  `optionsFor`'s origin filter rejected EVERYTHING: **54 of 136 positions had an empty hand** and ran
  entirely on the fallback. Fixed in `regenerate_neural_data.py` (leaf for positions only — a
  submission id's leaf, `from-mount`, is not a slug). Now 0/136 empty, and 136/136 carry a
  calibrated payload (the same mismatch was starving that join).
- **THE AUTHORED WORD DECIDES DOMINANCE (`score_graph_nodes.position_role_strength`).**
  `state_properties.position_type` sets the SIGN, the weighted formula only the magnitude. In BJJ
  the dominance axis is not top/bottom — the IBJJF ladder scores positions achieved, a sweep FROM
  the bottom scores, and the player holding a triangle is usually underneath; the literature names
  the axis attacking/defending, which is the word already in this field. Positions authoring no
  `position_type` keep the old behaviour exactly. `check_position_type_vs_score` reports any
  disagreement as a warning (currently 0 across all 272 position-roles — the word and the
  arithmetic agree; Rear Triangle was never a conflict, its file simply never loaded).
- **QUALIFIED NAMES WHEN AMBIGUOUS (`displayName`).** "Triangle" is not a technique here, it is
  several — the owner was offered "Triangle", opened it, and read "Harness → rear-triangle". 648 of
  1467 nodes carry a `from <position>` qualifier and 89 short names are shared, so the short name is
  used only when it is unique. Applied at the OPTION CARD and the GRAPH's in-node label; the share
  surfaces, lists and dossier already render full authored names by canon.

### Graph rendering

There is ONE graph renderer: the Neural app's own canvas, drawn inside `#neural-root` from
`/static/neural/graph-data.json` (emitted by `scripts/regenerate_neural_data.py`).

The two Quartz graph components — the depth-1 sidebar graph plus its Ctrl+G global modal
(`Graph.tsx` / `graph.inline.ts` / `styles/graph.scss`) and the full-viewport background graph
(`BackgroundGraph.tsx` / `backgroundGraph.inline.ts`) — were **deleted in v1.80.0**. They were the
only importers of **pixi.js, d3 and @tweenjs/tween.js** anywhere in the tree, and the only
consumers of the per-page `#graph-positions` layout blob.

`source/quartz/static/globalGraphLayout.json` (node2vec + UMAP, via
`scripts/regenerate_graph_layout.py`) still exists and is still regenerated — it is an **input** to
`regenerate_neural_data.py`, no longer a payload fetched by a page script.

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
| `npm run build` | Build static site (~3-10 min, 4618 files) |
| `python3 scripts/check_payload_budget.py` | **Payload-byte ratchet** (v1.80.0, extended v1.80.4). Asserts the built site stays under the ceilings in `tests/artifacts/budget_site.json`: `postscript.js`/`prescript.js`/`index.css`, per-archetype page bytes, total emitted HTML, and the **neural eager set** (raw + gzip) with a per-chunk ceiling. Run after `npm run build`, next to `check_seo_parity.py`. Shrinking always passes; `--update` RAISES the ceilings, so it needs its own justified commit. This is what stops the deleted legacy front-end from creeping back in. |
| `npm run build:share-shell` | Emit the share-link static shell `source/public/l.html` + `l-manifest.json` from the BUILT `index.html`, and GATE that no `/l` URL leaked into `sitemap.xml` or `llms.txt`. Part of `build` and an explicit step in BOTH deploy workflows (deploy never runs root `build`). || `npm run regenerate:build` | Regenerate + build (full workflow) |
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
| `npm run e2e:replay` | **The Last-rolls replay suite** on its own port :8151 (`reuseExistingServer:false`): `e2e/journeys/history-replay.spec.ts` — the film walks its archived exchanges (nodes PROJECTED into the viewport, never `camTarget`), it credits nothing, real input cancels it, ▶ stages that roll's opening state on the side it was played from, reduced motion steps discretely, and closing the phone drawer hands the clock to the film. Also runs inside `npm test`. |
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
`scripts/check_affiliate_surface.py` (`npm run validate:affiliate` — the alias was documented for months but did not exist until v1.104.6; both deploy workflows call the script directly)
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
