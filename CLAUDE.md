# BJJGraph — AI development guide

BJJ knowledge graph and state machine as a static site, plus one canvas game app built on it.
**Site:** https://bjjgraph.org · **Repo:** https://github.com/diogoseca/bjjgraph

---

## 0. What this file is, and what it is not

This is the **canon**: the rules you can break something by not knowing, and the traps that have
already cost this project a long debugging loop at least once.

It is deliberately **not**:

| not | where that lives |
|---|---|
| a changelog or post-mortem archive | `docs/Changelog-Archive.md` — grep it, never read it whole |
| the app's behaviour spec | `docs/Neural.md` |
| the data pipeline in depth | `docs/Architecture.md` |
| the full content standards | `docs/Content.md` |
| schema markup, keywords, analytics | `docs/SEO.md` |
| an API reference for `neural/src/app.src.jsx` | the code, which carries ~400k chars of comments |

**The admission test.** A line belongs here if *a reader could break something by not knowing it,
and it will still be true after the next ten commits*. If it explains **why** the current state is
what it is, it belongs in the archive. Mechanically: a heading whose subject is a version number →
archive · a measured number about a past run → archive · an owner quote → archive, unless the quote
*is* the rule · a mutation-kill table → archive · a trap with no greppable trigger token → rewrite
it until it has one.

**Pointer direction.** This file points **out**. Nothing points in, with one exception: the
`CANONICAL-DISCLOSURE` block in §7 is parsed by two gates, so its markers and its wording are load
bearing (see §7).

**Before you touch app code or write a spec, read §6.** It is the reason this file is loaded at all.

---

## 1. Non-negotiables, and how work ships

### Never do these

| action | why | do instead |
|---|---|---|
| Edit generated `.md` in `content/` | Overwritten on the next regeneration. **These files carry no do-not-edit banner** — that is exactly why this rule is first | Edit the `.json` beside it (data) or `templates/` (structure), then regenerate |
| Commit a secret or API key | Public repo | `.env`; the affiliate ref is stamped at deploy time (§7) |
| Guess a wikilink target | Broken link, silently | Verify the file exists first |
| Skip validation before a content commit | Breaks the build | `npm run regenerate:build` |
| Add a doc without indexing it | Orphaned | Link it from §0's table |
| Put emojis in content files | Inconsistent styling | Docs only, sparingly |

**This repo is PUBLIC.** No secrets, no partner terms, no commercial strategy in any committed
file — `docs/` included. It is why there is no separate affiliate doc, why `affiliate_url` never
reaches `graph.json`, and why the vendor ref is a deploy-time secret.

**There is no maximum file size.** `neural/src/app.src.jsx` is deliberately ONE imperative
component of ~13,000 lines and must not be split; several tracked files exceed 1,000 lines by
design. Prefer small modules when the seam is real, never to satisfy a line count.

### Shipping

**Version** `1.MAJOR.MINOR` in `package.json`. Feature or structural change → MAJOR
(`1.5.4 → 1.6.0`). Fix, dependency bump, cleanup → MINOR (`1.5.4 → 1.5.5`). Bump on every commit.
Message: `v1.X.Y - Description`.

**Pre-commit depends on what you changed** — one ritual for both was ignored, and it fires a
paid Claude content rewrite for a one-line app fix:

```bash
# content / templates / schema
npm run regenerate:build

# neural app  (npm run build does NOT rebuild the bundle — a stale one makes
#              journeys time out at 240s and look like contention. See §6.4)
npm run dev:neural:app && npm run test:curated

# anything touching source/quartz
cd source && npm run check
```

**Push is the owner's call.** Commit locally as much as you like; `git push origin dev` waits for
their go-ahead — they test locally first, especially anything touching the app.

**End a delivery with the literal command to run it**, and say plainly what is blocked on them.

**Plans end with a TL;DR** — one self-contained paragraph carrying intent, scope and the key
decisions, so the plan can be approved or redirected without reading the rest.

---

## 2. Repo map

```
bjjgraph/
├── CLAUDE.md              # this file — canon + traps
├── docs/                  # Neural, Architecture, Content, SEO, Changelog-Archive, …
├── content/               # *.json = SOURCE (authored) · *.md = GENERATED (never edit)
│   ├── Positions/ Transitions/ Submissions/ Systems/ Learning/ Principles/
│   └── Game Over.md       # the terminal state; its alias is what makes [[game-over]] resolve
├── templates/             # JSON schemas + Jinja2 templates
├── scripts/               # validators, regenerators, calibration, gates
├── neural/                # THE front-end: src/ (app.src.jsx + challenge-*, sound, lists) → build/ → dist/
├── source/                # Quartz SSG (MIT). source/public/ is the BUILT site (gitignored)
├── e2e/                   # journeys/ (core) · gen/ (generated + ledger.json) · quarantine/ · dsl.ts
├── functions/             # Cloudflare Pages Functions (the /l/<code> share preview)
├── forward/               # the /dev component catalog and sound lab
├── workers/ · supabase/   # edge worker, DB schema + RLS
├── tests/artifacts/       # baselines, budgets, probes, mutant scripts
├── node_ordinals.json     # COMMITTED, append-only — share links encode these (§6.6)
└── graph.json             # generated graph data
```

**The one structural rule:** `content/*.json` is source, `content/*.md` is generated output,
`templates/` holds the schemas and the Jinja2 that turns one into the other.

No corpus counts are given here on purpose — the ones this file used to carry were wrong by up to
2.4x and disagreed with its own figures elsewhere. `find content/Positions -name '*.json' | wc -l`
is always right.

---

## 3. Data model and graph invariants

Only what you can violate. Depth in `docs/Architecture.md`.

### Two representations — do not conflate them

- **`graph.json` — the data model.** Role-based. Each position emits **role-nodes**
  (`Mount/Top`, `Mount/Bottom`) which carry the edges, plus a bare `Mount` **hub** that only
  aggregates flashcards and has **no edges**. The state machine runs on role-nodes: you are in
  `Mount/Top` *or* `Mount/Bottom`, and they are different states. Neutral positions
  (`standing-position`, `clinch`, `open-guard`) still split. `game-over` is the terminal.
- **`globalGraphLayout.json` — the visual projection.** Collapses each position to a single hub
  node. This is the *only* sense in which "graph nodes are hubs" is true. It is an **input** to
  `scripts/regenerate_neural_data.py`, not a payload any page fetches.

Techniques split the same way, with **Attacker/Defender** instead of Top/Bottom: an edgeless
`<slug>` hub, `<slug>/attacker` (carries the edges, `outcomes` as authored) and `<slug>/defender`
(the same exchange role-flipped, `successRate = 100 − attacker`).

### Node and edge types

- **Position role-nodes** carry edges. Bare hubs and `is_family: true` submission hubs are
  flashcard aggregators — **not navigable data nodes**.
- **Edges.** `Position/Role —attempt_probability→ Technique` (weights sum to 100 per role, per
  ruleset frame) · `Technique —probability, result→ Position/Role | Submission | game-over` (sum to
  100 per frame; `result ∈ success | failure | counter`) · `Submission —success→ game-over`.
- `from_position` is **origin metadata, not a second edge**.
- **`opponentTransitions` does not exist anywhere.** Do not reintroduce a per-page mirror; derive
  in the consumer.

### Invariants (checked by `scripts/validate_graph_integrity.py`)

- A technique has **one** canonical origin and **3–5** outcomes.
- **`game-over` is the only sink**, and **only submissions reach it.** A transition pointing
  straight at `game-over` is a misfiled finish.
- Every `outcome.to` resolves to a **role-node**, a **real (non-family) submission**, or
  **`game-over`** — never a bare hub, never a family hub, never a self-loop.
- A position lists only moves whose `fromRole` matches its own role. A wrong-role reference is a
  teleport bug.

### Schemas — the shapes, as actually authored

**Every probability is a per-ruleset `{gi, nogi}` map**, and each frame sums to 100 independently.
`graph.json` carries the folded no-gi scalar **plus** the `*ByRuleset` pair.

```jsonc
// content/Positions/Mount.json  → top.transitions[]
{ "transition": "Mount to Armbar",          // key is `transition`, NOT `name`
  "attempt_probability": { "gi": 6, "nogi": 7 } }

// content/Transitions/100% Sweep.json
{ "name": "100% Sweep",
  "from_position": "Closed Guard/Bottom",   // "Position/Role"
  "success_rate": { "gi": 50, "nogi": 50 },
  "outcomes": [
    { "to": "Mount/Top", "probability": { "gi": 50, "nogi": 50 }, "result": "success" }
  ],
  "attacker": { /* ~12 authored subkeys: overview, key_principles, execution_steps,
                   common_counters, common_errors, flashcards, clips, … */ },
  "defender": { /* the same, from the other side */ } }
```

**Attacker and Defender content IS authored in the source JSON.** The templates render its
*layout*, they do not generate its *content*. Fixing a defender's copy means editing that
technique's `.json` — editing the shared template instead would rewrite all ~1,000 transitions.

---

## 4. Pipeline and commands

```
content/*.json  →  templates/*.md.jinja2  →  content/*.md  →  Quartz build  →  static site
   (SOURCE)           (TEMPLATES)             (GENERATED)        (BUILD)         (OUTPUT)
```

The Neural app is an overlay on that output: `neural/src/*` is bundled by `neural/build/build.mjs`
into `source/quartz/static/neural/app/`, and its data comes from `scripts/regenerate_neural_data.py`.

### Every npm script

Long explanations belong in each script's own docstring, where they cannot drift from the code —
`scripts/check_affiliate_surface.py` is the model.

**Validate** — `validate:json` schemas (hard) · `validate:graph` integrity (ratchets on
`tests/artifacts/graph_validation_baseline.json`, `max_errors` 0) · `validate:ordinals` share-link
lockfile (hard) · `validate:payload` byte ratchet · `validate:seo` crawlable-surface ratchet ·
`validate:headers` cache/security headers · `validate:affiliate` disclosure parity (reads §7 of this
file) · `validate:analytics` the BUILT PostHog injection against the key its build ran with, plus
`validate:analytics:nokey`, which builds its own keyless one-file fixture because no deploy can
exercise that direction (they all carry a key, and the mutant that shipped `posthog.init("")`
changes nothing when one is present). Neither runs in `ci-validate.yml`, which never builds; the
keyless half runs on PRs via `e2e-full.yml` and both halves run on both deploys ·
`validate:mc` MC viability · `validate:curriculum` · `validate:forward` /dev catalog ·
`validate:flow` the FLOW selfcheck (adjoint vs finite differences) plus the content ratchet on
`tests/artifacts/flow_validation_baseline.json` ·
**`validate:claudemd`** this file's own char ratchet and reference integrity.

**Regenerate** — `regenerate` runs the full chain: `issues → json → explode → migrate:ruleset →
validate:graph (gate) → md → hubs → votes → graph → explorer`. Individually: `regenerate:issues`
lists files needing fixes · `regenerate:json` the costly Claude pass (600s interval; `:fast` for 0)
· `regenerate:explode` expands connections · `migrate:ruleset` folds content to `{gi,nogi}` ·
`regenerate:md` markdown from JSON · `regenerate:hubs` category hubs · `regenerate:votes` ·
`regenerate:explorer` · `regenerate:redirects` · `regenerate:headers` · `regenerate:llms`.

**`regenerate:graph` is an UMBRELLA, not a graph.json emitter** — it runs `graph-base` (graph.json)
→ `graph-layout` (node2vec + UMAP) → **`ordinals`** (mints the append-only share lockfile) →
`graph-strength`. Running only `graph-base` strips `strength` from every node; see §6.7.

**Build and serve** — `build` (Quartz, ~10 min, then share-shell + payload budget) ·
`build:share-shell` · `build:forward` · `serve` (`scripts/dev-serve.mjs` on :8080, with the
`<snapshot />` receiver) · `dev` = build + serve.

**Neural bundle** — `dev:neural:app` rebuilds the bundle and copies it into `source/public`
(**the one you want after editing `neural/src/*`**) · `dev:neural` also regenerates the payload ·
`regenerate:neural` the full payload emit.

**Test** — `test` full core suite (:8133) · `test:curated` the `@curated` deployment gate (12-min
ceiling) · `test:units` pure node --test · `e2e:share` (:8129) · `e2e:replay` (:8151) ·
`e2e:gen` generated suite (:8127) · `e2e:quarantine` known-red · `e2e:observe` watchable CDP ·
`e2e:headed`. `pree2e` and both `test*` scripts run `scripts/check_no_raw_random.sh` first.

**Content tooling** — `proofread` · `calibrate:cases` / `calibrate` / `calibrate:apply`
(per-ruleset success-rate priors) · `clips:source` / `clips:verify` / `clips:report` (YouTube film
study) · `audit:from-position` / `fix:from-position`.

**Inside `source/`** (the Quartz sub-package, its own `package.json`): `npm run check`
(tsc + prettier — `contentPage.tsx` and `path.ts` carry two long-standing prettier warnings that
are not yours), `npm run format`, `npm run test` (path and depgraph units).

Two runbooks live **outside** the repo and cannot be rediscovered from the tree:
`~/calibration-engine.md` (calibration launch) and the gitignored `occurrence_elicitation/
_orchestration/` (the Q3 occurrence Delphi resume procedure).

### Dev snapshots

`npm run serve` also runs a localhost-only snapshot receiver. A camera button captures the tab as
PNG plus a JSON dump of client state into `tests/artifacts/snapshots/` (gitignored) and copies a
one-liner:

```
<snapshot slug="Positions/Mount/Top" variant="neural" t="…" json="…json" png="…png" />
```

**When the owner pastes a `<snapshot />` line, read both files.** The PNG is exactly what they were
looking at and the JSON is the client state and console errors at that instant; both beat any
assumption about what the app "should" be showing. `?snapshot=canvas` forces the no-prompt path,
which is what automation needs — a headless browser leaves `getDisplayMedia` pending forever
rather than rejecting it.

---

## 5. The Neural app — current state, and the seam index

Behaviour in full: **`docs/Neural.md`**. This section is orientation plus the names to grep for.

**There is ONE front-end.** The legacy Quartz page UI was deleted; `?variant=legacy` is
accepted-and-ignored. Do not restore the deleted modules or write prose implying they exist.
Quartz survives as the SSG and SEO shell — the emitted `<article>`, `<head>` and JSON-LD are the
fallback for crawlers, no-JS visitors and a failed bundle fetch.

Two survivors look deletable and are not: **`AuthUI.tsx` + `authUI.inline.ts`** render nothing but
are the only static importer of `supabase.ts`, which installs the `window.__bjjAuth` façade and is
the only code that completes a Google OAuth redirect-back; **`CategoryNav.tsx`** is the site's only
persistent nav on the static surface and **no gate guards it** (`check_seo_parity.py` scopes to the
`<article>`, and the nav is outside it).

**Delivery.** Boot fetches `graph-data.json` (the compact wire — `ingest()` expands it),
`app/neural.js` + `.css`, the deck **manifest** `flashcards/_index.json`, and `curriculum.json`.
On demand: one deck's cards, one node's dossier, `systems.json`. **`_cardsOf(d)` is the only legal
way to read cards — a manifest stub is truthy.** The manifest's `n` is load-bearing: `deckMastery`
computes from it when cards are absent, so dropping it shows every user a white belt.

**Pane law.** The pane is **manual-only** — nothing in the roll loop opens or closes it. **Open =
the game stops; close = it resumes, but only if the pane is what stopped it** (latched in
`applyDeckVisibility`, not `setDeckOpen`). One pane, anchored left, three tabs: Explore ·
Challenges · Last rolls.

**The hand.** `optionsFor` deals every legal move (uncapped), ranked by **EDGE**, and the order is
**frozen at deal time** — a mid-decision grade moves the printed numbers but must never re-sort a
tray the player is reaching into. The clock times the QUESTION, never the hand (v1.133.0):
`decisionSec` arms when a question mounts and expiry reveals the answer as a miss
(`_expireLandQ`) while the hand stays live, untimed;
deck warm-up is capped at `NG_PREFETCH_CAP`.

**EDGE** = `100 × (Q(s,a) − B(s))`: how much better this move is than the *ordinary* choice from
where you stand, counting where a miss leaves you. `0` is normal, not "no value". **Two honesty
gaps, one still open:** the shipped `opponentDefend` picks from hub adjacency with no role or origin
filter, so only ~12% of what it may play is a move the model's opponent would consider — EDGE
describes a better-behaved opponent than the one you face. Say so in any copy explaining EDGE.

**The pair.** Every state draws as two orbs (merged → mitosis → split, gated by `kLOD`). It is
**derived at ingest** (`_deriveDualPairs`), costs zero wire bytes, and `?dual=legacy` is the only
escape hatch. The **rep member IS the hub** — same id, same share ordinal, same URL — so lists,
systems and curriculum joins all still land. `adj` is per-SITE and **must not be role-split**.

**Persistence.** One v2 blob: settings (per-key LWW), `challenges`, `badges`, `coins`, `srs`,
`lists`. Lists merge **add-wins**; a settings key can never be deleted (§6.6).

**The z ladder** (documented in `neural/src/helmet.html`): 1–9 ambient state · 10–49 ambient fx ·
50–79 coaching · **90–99 deliberate temporary screens**. The app wrap is `position:fixed`, so a
deliberate screen must portal to the app root. Esc walks the ladder top-down, pane last.

### Seam index — the names to grep

| what you are doing | seams |
|---|---|
| overlays, hit-testing | `attachInput` · `_suppressLand` · `_landHidden` · `_tapBackground` |
| docking fixed chrome | `_dockLandCard` · `_dockLandFilm` · `_dockOptionHint` · `_bandBot` |
| node coordinates, camera | `pairMid` · `_LY` · `headPos` · `rollCamTarget` · `holdCamera` · `frameNodes` |
| starting/staging a roll | `rollFromPosition` · `techniqueOrigin` · `confirmPlayFrom` · `seatRole` · `stageRollAt` |
| the hand and its numbers | `optionsFor` · `edgeMark` · `orderScore` · `moveChance` · `movePotential` (escape tray only) |
| outcomes | `drawOutcome` · `resolve` · `opponentDefend` · `momentumSkew` |
| roles and values | `valIdx` · `roleIdx` · `myColor` · `displayName` · `graphName` |
| decks, grading, score | `_cardsOf` · `deckMastery` · `gameScore` · `_bumpStageVer` · `_warmMcPool` · `_schedule` |
| lists and sharing | `siteIdOf` · `captureNode` · `ngListEncodeOrdinals` · `_openSharedListFromUrl` |
| persistence | `_pullAndMerge` · `ngMergeLists` · `_saveProgress` |
| randomness | `rng(tag)` — **never `Math.random`**; `scripts/check_no_raw_random.sh` gates it |
| the tray | `_trayStop` · `_trayGlideBy` · `_trayFling` |
| build-side joins | `_tech_keys` · `fnv1a32` (in `scripts/_neural_content.py`) |

---
## 6. THOUGHT TRAPS

Things that cost this project a long loop to find, and that will cost the next one the same
loop if they are not read first. Each entry is a **class**, not an incident: it opens with the
symbol or API you would `grep` for, then why it happens, then **what it looks like from inside**
the bug — which is the part that lets you recognise it — then the fix, then whether anything
actually guards it.

Instance counts were verified against the tree at **v1.129.8**. A count is a claim: re-derive it
before quoting it. Where an entry says UNGUARDED or PARTIALLY PINNED, believe it — those are the
ones that will bite again.

The full post-mortem for every entry is in `docs/Changelog-Archive.md`; Index B there maps each
symbol to every version that touched it.

### About to…

- …add, move or hide a fixed overlay, or touch `attachInput` → **§6.1**
- …change the canvas draw path, a node coordinate, or the camera → **§6.2**
- …write — or trust — a Playwright assertion → **§6.3**
- …rely on the harness: the DSL, a port, a payload, which build is under test → **§6.4**
- …write app runtime logic → **§6.5**
- …change a join, an id, a slug, an ordering or a persisted key → **§6.6**
- …edit CI, a build emitter, or rename/delete a symbol → **§6.7**
- …delete something that looks dead, or debug something that looks alive → **§6.8**
- …quote a number, cite a gate, or claim something is covered → **§6.9**

> **The single most repeated class in this repo, and it cuts across every group below:**
> **absence produces a plausible answer.** A check that never ran reads as a pass; a rule that
> matched nothing reads as clean; a join that silently fell back prints a believable number.
> 17 recorded instances in 5 vocabularies. The fix, independently reinvented here five separate
> times: **emit a positive coverage count and fail on zero.** Never let "found no problems" and
> "never looked" produce the same output.

### 6.1 Before you add, move or hide a fixed overlay (or touch `attachInput`)

- **`attachInput` · `setPointerCapture` — a control inside a fixed overlay is dead to the MOUSE.** `attachInput`'s `pointerdown` captures on the wrap, which retargets the later `pointerup`, so the browser resolves the click from the down/up common ancestor and your listener never runs. It measures correctly, `elementFromPoint` returns it, keyboard works, and `locator.click()` passes because it dispatches on the element.
  **Do:** name the overlay in `attachInput`'s pointerdown early-return list (`app.src.jsx` — 6 surfaces, numbered in code: node card, dossier sheet, landing card, film strip, option-detail sheet, see-more hint), set `pointer-events:auto` INLINE on the control, and prove it with `j.clickByMouse(sel)` (`e2e/dsl.ts`).
  **Partially pinned:** `clickByMouse` only fires for overlays somebody wrote a mouse journey for, and the list is hand-maintained with no gate deriving it — that is how `.ng-seemore` stayed dead to the mouse for its entire existence.
  <br>_(6 surfaces (v1.69.1 → v1.123.0), all found by hand)_

- **`opacity:0` IS NOT HIDDEN — an invisible overlay still eats clicks.** Hit-testing ignores opacity, and `pointer-events` is inherited, so any descendant that re-enables it inline stays live across its whole box — `[data-land-foot]` does exactly that on purpose (`app.src.jsx`), because it holds `More ▸` and the capture `+`. Symptom: something UNDERNEATH is dead to the mouse and `elementFromPoint` returns the thing you thought was gone (measured: `<div data-land-foot="1">` at the centre of a capture button, 120s of Playwright retries).
  **Do:** also write `visibility:hidden !important` — inherited, unescapable here, removes the subtree from hit-testing. `_suppressLand` (`app.src.jsx`) is the reference. Assert inertness with `elementFromPoint`, never a visual check.
  **UNGUARDED: no gate enumerates the hide-sites.** (The long-leaky `expandOption` site was
  DELETED outright in v1.136.0 — the sheet stacks OVER the landing card at z:6 vs z:5 instead of
  hiding it, owner's call.)
  <br>_(5 by v1.100.2; the last leaky site deleted in v1.136.0)_

- **`_dockLandCard` · `_dockLandFilm` · `_dockOptionHint` · `_bandBot` — fixed chrome docks off a MEASURED rect, never a CSS constant.** The option tray is `bottom:84px` with no height and grows upward as card names wrap; anything tuned against it collides at some viewport. Measured overlaps: landing card 63px, escape tray 7px, option hint 2px at EVERY width, pane/card 108px at 1024, phone challenge cue 6,700 px².
  **Two sub-rules:** keep the TIGHTEST measurement ever taken at this viewport (the band flickers because card and film mount on different frames, and a per-landing reset hands the loose answer straight back); and an element that has not laid out yet reads `rect.top == 0` — that is SKIP, not a constraint.
  (The fourth instance — the phone challenge cue over the focus label — was resolved by DELETING the cue in v1.133.0, owner's call; `_cue_collision_probe.mjs` stays as the archive's evidence.)
  <br>_(12 (self-counted as "the third"); 0 still open)_

- **The app wrap is `position:fixed` = its own stacking context, so a `z-index` inside it is trapped at plane 0.** A deliberate screen must PORTAL to the app root or ambient gameplay chrome paints over it (the pane at z:8 was buried by a root-plane landing card at z:5; the account menu needed z:46 on the root plane). Bands, documented in `neural/src/helmet.html`: **1-9 ambient state · 10-49 ambient fx · 50-79 coaching · 90-99 deliberate temporary screens.** Pick a band, never a loose number; Esc walks the ladder top-down, pane last.
  <br>_(3 (dossier under the transport pill; the pane under the landcard; the account menu))_

- **`style.color = ""` DELETES an inline declaration; it does not restore one.** After `More → Less` the toggle went black on a dark card, because clearing removed the value the button's own `cssText` had written and it inherited the UA default. To return an element to a colour declared inline, WRITE it — `NG_LAND_MORE_COL` exists so the two sites that set it cannot drift. Related sizing rule: a 44px thumb target must not set a 24px row's layout box — shrink the box with a negative margin and keep the hit area (`.ng-lists-new` pattern).
  <br>_(2)_


### 6.2 Before you touch the canvas draw path, a node coordinate, or the camera

- **`n.y` vs `LY(n)` / `pairMid(n)` — never convert a node to a screen position from its STORED coordinate.** Each pair member is lifted off a shared ground point (~37px at roll zoom, against a 28px pick radius), so `n.y` is not where the orb is. **FIVE recorded instances as of v1.129.7:** the hover label AND the tap handler (clicking a visible orb matched nothing and fell through to `_tapBackground`), `rollFromPosition`'s camera aim, four specs at once in v1.125.0, and `headPos()` (`app.src.jsx`), which also feeds `camFocus` through two callers — so the camera and the light were wrong TOGETHER and neither looked broken alone.
  **Do:** the frame publishes its own lift (`this._LY = LY`, `app.src.jsx`); every consumer AND every spec goes through `_LY` / `pairMid`. Both are the identity on an unpaired node, so applying the rule can never change production geometry. Companion quantity trap: `deg` is GEOMETRY (split per member), `siteDeg` is the STATE (whole) — reading `deg` where the state is meant halves the number the escape tray prints.
  <br>_(5 (v1.114.3 ×2, v1.114.4, v1.125.0, v1.129.7) · _re-verify before quoting_)_

- **Never assert camera behaviour by reading `camTarget`.** It has nine writers and `updateCamera()`'s follow-cam rewrites it every frame, so a selection flight is overwritten within one frame of a live roll — which is exactly how that bug survived three reviews. **Do:** project the node through `draw()`'s transform and assert it lands inside the viewport rect (`e2e/journeys/share-camera.spec.ts` is the reference). A deliberate flight takes a LEASE (`holdCamera()`, `camHoldSec = 7`, released by any real pan/pinch/wheel and by the user's own go-elsewhere paths), and `frameNodes` fits BOTH axes because `vw` is a width.
  <br>_(3 (the share-list flight; `challenge-curriculum`'s retired ±60 contract; `systems-surface` and `url-arrival` still read it directly))_

- **`this.now` IS the game clock, so a paused roll freezes every age-derived value into a FALSE PASS.** `parkOn` pauses; `age = now - lit` then stops advancing, and a canvas floor assertion passed against a build with the glow deleted, reading a frozen arrival flare. **Do:** age the value out explicitly and assert that it did, or drive the pumped clock. Same family: one `advance()` is not a frame (the landing card's top read 588 on the frame the camera aimed against and 376 on the next — a second bare `advance` is not enough; an intervening `page.evaluate` is what forces layout).
  <br>_(3)_

- **Anchor a label off `halfW(n)` — the DRAWN silhouette — never `n.r * scale`.** `shapePath` widens a triangle to 1.242r and a diamond to 1.18r, and `nodeK` scales everything again, so `n.r` stopped being the drawn radius twice over. Measure text on a SCRATCH context (`_labelWidthPx`): `this.ctx.font` is mid-frame state during a draw. And **the graph never bakes a role into a name** — all 136 position hub titles end "… Top" as an artifact of the visual collapse, and `splitName().main` only strips a `from <position>` tail, so `graphName(n)` is the single rule for all four canvas label paths.
  <br>_(2 (label anchoring; 136 of 136 roleless names))_


### 6.3 Before you write — or trust — a Playwright assertion

- **`locator.click()` is not a mouse.** It scrolls into view and dispatches ON the element, so it cannot prove reachability and it masks every overlay trap in group 1 completely. **`j.clickByMouse(sel)` is the only claim:** it measures the centre, refuses to scroll, refuses an off-screen centre, and fails if `elementFromPoint` is anything but the target or a DESCENDANT of it — an intercepting ANCESTOR is a failure, not a pass. On mobile use `page.mouse.click` / `page.touchscreen.tap` at MEASURED coordinates plus an effective-opacity walk up the ancestor chain.
  <br>_(4+ (every instance in group 1 was masked by it))_

- **Never assert a render by re-implementing it.** A spec-side copy of a filter, of "what the node set is", or of a screen coordinate is written from the same reading of the code under test — usually with the fix already in it — so it agrees by construction and reports green on a build you have already broken. **The v1.126.0 audit BUILT to find this class committed it:** its probe measured `nodes.filter(n => n.rep && …)` and reported "identical" about Explore's search, which was doubling every hit and halving its own 120-row cap.
  **Do:** drive the real entry point (`renderExplorer()`, `optionsFor()`, `draw()`) and assert on what it EMITTED — DOM rows, duplicate row TEXT, read-back pixels. When the geometry lives in a draw-local closure (`halfW`, `ox`) you cannot recompute it at all: read what the frame PUBLISHED (`_lastPairLabel`, `_lastRichLabel`, `this._LY`), which is the render's output, not a second implementation. A second implementation is legitimate ONLY when it also asserts SET EQUALITY against the app's own result (`option-hand.spec.ts`).
  <br>_(10 (6 specs in v1.125.0, the audit itself, 3 specs pinned to a moved label in v1.129.4))_

- **A probe is evidence for a commit message; only a spec is a gate.** `tests/artifacts/_*_probe.mjs` measured the mobile framing (v1.128.1) and the focus kicker (v1.129.1), both shipped, and in both cases the mutant SURVIVED the red-proof pass because no journey covered them — the same lesson two versions running. **Do:** mutate every claim; a surviving mutant means the claim has no gate. And **record non-kills in the spec's own header** — `dual-pair.spec.ts` names its two, so nobody later reads that spec as covering them.
  <br>_(3 (v1.128.1, v1.129.1, plus the reverted tray drag whose own mutants could not kill its test))_

- **A journey that leaves a gameplay `rng()` tag unrigged has not chosen a branch — it has bought a lottery ticket, and the ticket only prints when it loses.** `graph-naming` left `rng("opp-finish")` live, so the opponent could submit you and END the round before the journey's second landing: **6 failures in 78 un-rigged runs (7.7%) vs 0 in 30 rigged**, and P(four consecutive green full suites) ≈ 0.73, so three earlier clean reports were never evidence of absence. The fix is DEDUCTIVE — rig the value so the branch is unreachable — and the counts are corroboration, not proof.
  **Do:** when a journey's subject is what happens AFTER an exchange, rig every draw that can end the exchange early. The 13 static tags: `start-pos role outcome resolve max-moves ai-skill opp-pick opp-sub-pick opp-finish mc-pick mc-shuffle escape checkpoint-pick`, plus surface-scoped variants (`land-mc-pick`, `land-mc-shuffle`) so a landing card can never eat the sidebar's rigged queue. `scripts/check_no_raw_random.sh` pins the seam: exactly 1 `Math.random()` in `app.src.jsx`, 0 in `sound.src.js`.
  <br>_(1 measured, on a journey that had been a coin toss in every version it existed)_

- **A green gate is evidence only about what that gate can SEE.** `payload-first-hand` pins `start-pos:[0]` — a 7-card hand — so it reports the same bytes with the hand cap and without it: **do not read a green payload gate as evidence about hand size.** `replay-digest` rigs one scripted roll on a single-success-cell submission, so the outcome-kernel fix, the `cardOrder` retirement and the loss-aversion dial were all structurally invisible to it — and **no fixture holds the expected digest anywhere in the repo** (`triple_replay.sh` compares runs to each other), so the hashes in prose describe nothing checkable.
  **Do:** cite a gate only for a claim a mutant of that claim makes red; otherwise write its blind spot in the same sentence as the green. **And if your change SHOULD have moved the digest and did not, that is the finding.**
  <br>_(12 (incl. 4 separate re-discoveries of the digest case))_

- **An assertion stricter than its own claim goes RED on a CORRECT build.** "Nothing is drawn above the name" fails on the name's own ascenders; "nothing is drawn at merge scale" is false because the ordinary hover label takes over; "the announcer is blank after staging" is false because a staged landing may legitimately say something else. **Do:** assert the DIFFERENTIAL the change is about, against a CONTROL FRAME — everything the graph would draw anyway subtracts to zero, and the constant contribution cancels. **After relaxing an assertion, re-run its mutant**, so "less strict" does not become "less able to fail".
  <br>_(3 named together in v1.129.0, plus 3 label-position specs in v1.129.4 and 5 mutants needed in v1.114.0)_


### 6.4 Before you rely on the harness (DSL, ports, payloads, which build is under test)

- **A harness payload pattern is a SUBSTRING of the request URL, so a stale name matches nothing and holds nothing.** Twelve rules armed `"flashcards.json"`, which the app has not fetched since v1.80.4 (it fetches `flashcards/_index.json` via `_dataBase()`), so every cold-start assertion about the ~18s skew measured a fully-warm boot — root cause of 15 red journeys. The same dead name hid in `build.mjs`, whose guard only warned when EVERY rewrite missed. **Do:** a rewrite/substitution table must THROW when a rule's `from` string is absent from the source (`neural/build/build.mjs` does now); when a rule holds a payload, assert the timeline shows it held.
  <br>_(2 (12 harness rules + 2 of 4 build rewrites))_

- **Name what the harness does NOT serve, beside every assertion — if the absence alone satisfies it, the assertion is about the harness.** The DSL serves `{}` for dossier chunks, so there is no film strip and most states legitimately have no `More` fold; a journey about either must AUTHOR content. `test.use({ reducedMotion })` leaves `matchMedia` FALSE here, so a spec relying on the fixture option **asserts nothing and passes forever** — use `page.emulateMedia`. Non-localhost requests are aborted, which is why the GitHub-stars `.catch` is load-bearing. A screenshot taken under the harness photographs the harness (`tests/artifacts/_owner_shoot.mjs` drives the real dev server for exactly this reason).
  <br>_(7)_

- **A spec in a directory no config's `testDir` collects is a NOTE, not a gate.** the old prototype specs directory (since deleted) was collected by nothing — not `package.json`, not `.github/workflows/`, not any config (only `playwright.{private,chrome}.config.ts` take `PW_TESTDIR`, from a hand-typed invocation) — so its three journeys ran when somebody remembered, through thirteen versions that included making their subject the DEFAULT and deleting the flag they booted with. **Do:** before claiming coverage, check the spec is actually collected. A spec that needs a gitignored payload cannot be a gate at all.
  <br>_(1 (3 journeys, 13 versions))_

- **A result taken while another process could write the tree under test is not a result.** A config with `reuseExistingServer:true` on a shared port means whichever WORKTREE started it owns it, and every later run tests THAT worktree's `source/public` — measured, a run was served a 343,153-byte `neural.js` where its own was 364,190. Every gate suite now owns a dedicated port with `reuseExistingServer:false` (core :8133 · gen :8127 · share :8129 · replay :8151 · catalog :8131; only `observe`/`quarantine` reuse, deliberately).
  **And `npm run build` does NOT rebuild the neural bundle** — a stale served `neural.js` makes neural journeys silently 240s-timeout and looks exactly like contention or a regression. Refresh with `npm run dev:neural:app` (<1s). Cache keys must name the RESOLVED artifact version, never a file that changes on every commit (the Playwright cache was keyed on `package-lock` in a repo that bumps the version every commit: the key missed every run while still uploading 261 MiB).
  <br>_(3)_


- **A WebGL context left alive on the OLD page stalls the NEXT navigation, and it presents as "the page load hangs".** Headless Chromium (SwiftShader) defers a navigation's COMMIT while the previous page's GL contexts tear down, scaling with frames drawn — and every CDP signal (goto resolution, `frameNavigated`, evaluate against the new context) waits together, so nothing points at GL. It once put the curated gate over its 12-minute ceiling on **every** dev deploy for three days, which silently SKIPPED the deploy step and left the dev preview stale for ~6 days.
  **Do:** any new WebGL surface on a page the journeys boot must either early-return on `window.__NEURAL_TEST__` or be registered for the sweep in `e2e/dsl.ts` (contexts are recorded at creation into `__glCtxs` and lost before navigation). **Never probe with `getContext("webgl")` to DETECT a context — that CREATES one**, at ~11s to make and lose.
  **Diagnostic:** if the dev preview looks stale, read the gate step's DURATION before assuming a content problem.
  <br>_(the two Pixi surfaces that caused it are deleted, but the sweep and the guard are live and load-bearing)_

### 6.5 Before you write app runtime logic

- **A single-slot resource with many writers needs a stamped owner and an explicit lifetime.** The announcer (`setEvent`) has ONE slot: a share-arrival sentence was overwritten by the roll within seconds (hence `_announceArrival` HOLDS it for the next landing), "Decide 1…" outlived its hand (hence the `_evCountdown` stamp, which every other `setEvent` releases and `clearOptions` honours), and "Time's up" was overwritten SYNCHRONOUSLY on the next line (the surviving lessons: the countdown stamp, and `clearOptions()` before any sentence that replaces it — the hesitation branch itself retired with the hand clock in v1.133.0). Same shape: `camTarget` (nine writers, follow-cam rewrites it every frame → a 7s LEASE) and `scrollLeft` (ONE rAF owns it — `_trayStop()` is called by every competing animator). **Three remedies: a stamp released by every other writer, a lease with an expiry, or a single declared writer (`_bumpStageVer`).**
  <br>_(9)_

- **Every suppression flag declares its complete set of LIFTERS at its definition.** The canonical incident: the v1.129.5 stand-down latch had exactly ONE lifter (the play button), so a background tap left the app dealing hands and flying cameras underneath a suppression nobody lifted — "nothing happens when I click, but the node lights up". (v1.134.0 dissolved that latch pair entirely: a background tap now CLOSES rather than suppresses, so there is nothing to restore.)
  **Diagnostic worth memorising: `_landHidden()` (`app.src.jsx`) asks THREE holders — `_landPaneHid`, `_traySup`, `_detailCtx`. Any one stuck leaves a built, mounted, correctly populated card invisible while every other surface behaves. Read the holders before you read the render path.** Good pattern: one latch per pauser (`_landAutoPaused` / `_paneAutoPaused` / `_replayAutoPaused` / `_dossierAutoPaused`) so releasing gives back only the pause you took. Never gate on `userActiveNow()` — it measures the GAME clock, so one click on a paused board latches "the user is active" forever.
  <br>_(6)_

- **When one question is answered in two places, one of them is already wrong.** `playFrom` was a whole stale copy of `rollFromPosition` (hard-coded camera, no archive, no state reset); `rollFromPosition` then walked `adj[]` for a technique's origin while `confirmPlayFrom` had read `fromPositionId` all along — **wrong on 907 of 1,331 techniques, and the technique you just tapped was not in the hand you were dealt 68.4% of the time**; the same function kept a hard-coded `vw: graphW*0.42` after `rollCamTarget` existed, and still aimed at `{n.x, n.y}` one version after `camFocus` was fixed on the line beside it ("same defect, missed once"). A two-branch tap rule written before a third case existed is the same failure.
  **Do:** collapse to ONE named seam (`rollCamTarget`, `techniqueOrigin`, `captureNode`, `siteIdOf`) BEFORE adding a third caller, and DELETE the copy rather than syncing it. Where two names for one value must coexist in a shared bundle scope (`NG_LIST_ITEM_CAP` / `NG_LIST_MAX_ITEMS`), a test pins them equal.
  <br>_(9)_

- **If the data states it, READ it — and a derivation that returns the same answer for the whole corpus is a constant with a function around it.** `optionsFor` inferred the performer from `myVal < oppVal - 0.05` while every technique carries `fromRole`; `performerRole(...) === "top"` stood in for an offence/defence test on an axis that is not top/bottom. All 136 position hub titles end "… Top", so deriving a role from a title IS the constant `top` — which is why `seatRole` exists (596 techniques are bottom-authored) and why `playFrom`/`confirmPlayFrom` take an explicit `role`. A fallback may relax ORIGIN; it must **never** relax ROLE.
  <br>_(9)_


### 6.6 Before you change a join, an id, a slug, an order or a persisted key

- **A CHECK THAT NEVER RAN REPORTS CLEAN — absence produces a plausible answer.** A bare `except Exception: return issues`, a matcher that matches nothing, a zero-length comparison loop and `git diff --quiet` on an UNTRACKED file all emit exactly what success emits. `check_position_type_vs_score` reported "0 disagreements" for months because a missing `import os` raised `NameError` into a bare except (real figure 95); a headers gate passed a Function that had stopped setting `Cache-Control` because "the comparison loop had nothing to iterate"; `keepalive.yml` had never committed anything, ever.
  **Do: every matcher, join, gate and rewrite emits a POSITIVE coverage count and hard-fails below a floor, and a skip path PRINTS.** The repo invented this fix five separate times without naming it — `regenerate_neural_data.py` and `:575` (refuse a wire below 95% join coverage, printed every run), `build.mjs` (throw per dead rewrite rule), `check_headers_cache.py` check 6a (OMISSION, not only drift), and the `mc_pool_cold` / `land_warm_stalled` beats.
  <br>_(17)_

- **A fallback that produces a plausible value and never says it fired is strictly worse than a crash — it buys months of silence.** A missing `cal` made `calSuccess()` return null and `moveChance` fall through to `0.36 + dom*0.1`, so **~289 of 1,204 dealt cards printed a fabricated ~45.6% where authored rates span 10–74%**; `posId`-vs-slug left 54 of 136 positions running entirely on the no-candidates fallback; `posIdx` fell back to the technique itself and staged 1,331 of 2,934 nodes ON a technique node. **Do:** every fallback emits a NAMED beat or a counter (`mc_pool_cold`, `land_warm_stalled` are the pattern), and it is CHOSEN before any rng draw so the draw count cannot depend on content.
  <br>_(8)_

- **`_tech_keys` — a spelling-sensitive join must try every spelling and then COUNT itself.** `graph.json` keys a technique by `slugify(<display name>)`, one flat kebab token; a layout id keeps the authored PATH, so `Submissions/Kimura/from-Front-Headlock` arrives with a `/` where the key has a `-`. **0 of 297 submission keys contain an inner slash, so 294 of 297 submissions shipped no odds at all** and nothing went red, because the fallback above printed a plausible number. The ladder is three rungs, cheapest first, and the last is the key's OWN CONSTRUCTOR rather than another guess: `as-is` → `slash→hyphen` → `slugify(title)`. Together 1331 of 1331. The emitter now refuses to write a wire below 95% coverage per type and prints the figure every run.
  <br>_(1, hidden for months, across 2 joins (`cal` and `tech_avail`))_

- **`s` is TWO DIFFERENT PAIRS behind one shape: `[top, bottom]` on a POSITION, `[attacker, defender]` on a TECHNIQUE.** `roleIdx()` (side) indexed both, so every bottom-performed technique was read as its opponent's value: **a bottom player was shown ZERO of the 297 submission nodes**, and 144 of 596 bottom-authored techniques were silently discarded. **Use `valIdx(node)` — performer for a technique, side for a position — never `roleIdx()` on a technique.** Two nearly identical accessors sit side by side in `app.src.jsx` and the code cannot explain why both exist; this is why.
  <br>_(1, corpus-wide)_

- **An index-keyed or positional join fails by printing the WRONG right-looking answer.** `cal.ev` is keyed `<position node index>/<role>` with `blk[0]` a list of TECHNIQUE node indexes: nothing is self-describing, so a wrong remap still finds rows, still prints an integer on every card, and prints a different technique's number on each — no exception, no warning, no blank. **Do: gate it with a whole-structure DIFFERENTIAL against a known-good graph (one build, booted twice) PLUS a non-triviality floor** — `dual-consumers.spec.ts` asserts >1200 cards carry a real mark, so it cannot pass on a build where `_ev` came back empty on BOTH sides and every comparison was trivially equal. Never a non-null count: a wrong-but-complete remap satisfies it perfectly. An index is safe only when it never leaves the file that defines it.
  <br>_(6 (cal.ev, the `s` pair, `posId`-vs-`fromPositionId`, `deg`/`siteDeg`, the cal key, links-as-pairs))_

- **A node's ARRAY INDEX can never go in a URL, and any user-visible order needs a strict total order whose final tiebreak is stable CONTENT.** `regenerate_graph.py` walks an unsorted `rglob('*.json')` and the layout derives its node list from `adjacency` DICT INSERTION order seeded by that — so adding ONE content file renumbers pre-existing entries and an index-encoded share link would silently open a DIFFERENT set of techniques, with no error anywhere. Hence `node_ordinals.json`: permanent, append-only, never renumbered, never reused, retired-not-removed, minted in sorted-id order, hard-gated by `validate:ordinals`.
  **Corollaries:** `Array#sort` is STABLE, so a comparator that can return 0 hands the decision to the node index — 21 dealt option pairs tie on EDGE, odds AND attempt%, and only the name separates them. And **a cap applied over an unordered list is a random sample**: a constant sort key made the 10-cap deal submissions ALPHABETICALLY and truncate the state's most-attempted move.
  <br>_(5)_

- **Lists hold SITES: `siteIdOf` normalises in the LIST LAYER — the writer AND every membership reader.** Only a hub carries a share ordinal; the derived pair's partner mints `<hub>/Bottom` / `<hub>/Defender` with `o: null` (**0 of 1467**), so a `+` pressed while standing on the lower orb filed an id the encoder reports as `missing`: **the technique was dropped from the share code with no error, and a one-item list of it encoded to the empty string.** Not an edge case — 136 of 272 position landings and 172 of 400 technique seats stand on a partner, i.e. every time the coach is playing bottom. **Normalising only the WRITE is the tempting half-fix and is wrong**: it makes a captured technique show `+` instead of `✓` on the very orb you captured it from. Nine call sites today (`addToList`, `removeFromList`, `removeListItem`, `activeListHas`, `nodeInAnyList`, `listsWith`, `listItemName`, `openListPicker`, the id lookup); it is the layer's invariant, so a surface added later cannot bypass it.
  <br>_(1, reachable on half of all landings)_

- **DO NOT role-split `adj`.** `opponentDefend`, `_mcPool` and `_posIdx` walk `adj[currentPos]` with NO role filter, deliberately — they are asking about the EXCHANGE, not about your hand. A purely role-split adjacency handed the opponent YOUR hand, the belt-test opponent stopped finding submissions, and `content-capstone` went red. Each pair member therefore carries its SITE's technique set (link kind 2, one-way, never drawn). **Precise wording matters here:** the two members' `adj` are NOT byte-identical — measured 136 of 136 differ by exactly the pair tie, and order legitimately differs because a site link is pushed one-way. The design claim holds; a spec written against the retired "byte-for-byte, in the same order" phrasing goes red on a correct build.
  <br>_(1 (found by the suite, not by review) · _re-verify before quoting_)_

- **A settings key can NEVER be deleted — retire it by ceasing to READ it.** `_pullAndMerge`'s per-key settings merge is `if (!(sk in merged) || ct > lt)` with **no tombstone** (`app.src.jsx`), so a key deleted locally is unconditionally RE-ADDED by the first pull from any device that still carries it; pruning on load is theatre. Dormant today, read by nothing: `cardOrder`, `studyOrder`, `challengePinnedTrack`. Same shape, chosen deliberately, elsewhere: list reconciliation is ADD-WINS, so a DELETE loses to a stale device (deleting again is trivial; losing the class a coach already posted is not), and `srs` merge is later-`last`-wins with a same-day tie going to the SMALLER interval. And a state-driven auto-flip is not a mint: driving a reward toggle off "belt is black" re-enables it on every device forever through LWW — flip it once, inside the mint.
  <br>_(8 across three storage layers)_

- **`startPosTraffic` · `_posSlugIndex` — position traffic is keyed to the TOP MEMBER ONLY, so anything weighted by it scores ZERO for the entire bottom side.** `_posSlugIndex` maps a bare posId to the top member (`app.src.jsx`), while `resolveOutcomeTo` lands you on a bottom member on **2,071 of 3,842 outcome cells**. Measured on a bottom player who had drilled 90 bottom decks: **0 of 90 changed score**, and their "15 weakest spots" came back as fifteen guard-passing techniques — real names, ranked, entirely wrong. The obvious repair does not work either: **136 of 136 hubs give top and bottom IDENTICAL traffic**, so a hub lookup carries no side information at all.
  **Do:** key anything role-sensitive on `posId + "/" + role` and read the hand from `_ev`, which is keyed that way already. `flow.src.js` does; nothing else may weight by `startPosTraffic`.
  **Pinned by `tests/flow.test.mjs`** ("both roles carry occupancy").
  <br>_(1, and it silently produced a complete, plausible, wrong ranking)_

- **`_ev` holds 544 entries for 272 hands — `_deriveDualPairs` files the SAME `cal.ev` block on BOTH pair members.** Iterating it directly doubles every state and still prints believable numbers. Dedupe on `posId + "/" + role`. Same family: **`sum(att · EDGE) == 0` at every state BY CONSTRUCTION** (`_evShift` subtracts an attempt-weighted hand mean), so any score built out of `moveEdge` has an identically-zero total everywhere and its ranking is rounding noise — build in **Q**, never in EDGE. And `c1` is `int(round(100 * (A - B)))`: scaled ×100, integer-rounded, one per λ. Never `Math.abs` it — the negative rows are the feature, not noise.
  <br>_(3, all found before shipping FLOW)_

- **A value identical across a whole category on screen is a CONSTANT until proven otherwise.** `movePotential` returned `1` for every submission, so the sort key was constant across all 297; the dominance fallback priced the entire submission corpus at **2 distinct values** where 37 are authored; "30+ weak spots" printed `get("dailyGoal",30) + "+"` and read the same for a player with 3 gaps and one with 700. **Detection, cheap and general: count the DISTINCT values a field actually produces, and where two printed values are bit-identical, assert the underlying source rows are identical too** (42 of 42 is the passing shape). An exact tie on screen must be a tie in the data, never a constant in the code.
  <br>_(4)_


### 6.7 Before you edit CI, a build emitter, or rename/delete a symbol

- **CI must not silently run a subset of the chain a human runs, and no emitted path may be allow-listed.** `votes-refresh.yml` once ran bare `regenerate_graph.py` and committed a graph.json with `strength` **stripped from 4,464 of 4,465 nodes**. `e2e-full.yml` tarred six allow-listed paths, so the PR gate for BOTH protected branches could not pass — an allow-list rots silently and that one predated every spec that broke on it; package by default and `--exclude` explicitly. A `paths:` filter must include the INPUTS its own gates read.
  **Corrected rule, because the absolute version is contradicted by a deliberate fix:** `votes-refresh.yml` today runs `regenerate:graph-base` + `regenerate:graph-strength` and NOT the umbrella — the layout/ordinal steps need an ML stack that job does not install (the umbrella failed there every week) and would rewrite files the PR step never stages. So: **a partial chain must be justified AT THE CALL SITE and must include every step that mutates the artifact it commits.** Do not "fix" that workflow back to the umbrella.
  **Standing hazard: deploy does NOT run root `npm run build`** — both workflows re-list the steps inline, so any new build step is absent in production unless added there too, and no gate compares the two lists.
  <br>_(7, all found in one pass; 1 since deliberately reverted · _re-verify before quoting_)_

- **Never pipe the survey that decides a rename or a deletion through `head`.** The `auto_pick` retirement was scoped from a truncated grep showing the sound catalog, the app and ONE gen spec, so it looked cheap. The real list is **7 gen specs + 2 core journeys** (`announcer-coherence`, `jit-loop`), and the core one only surfaced when the full suite went red. **Do: `| wc -l` first, then read all of it.** Second form of the same trap: where the enumeration is HAND-MAINTAINED rather than derived, a new member is missing by default — `attachInput`'s overlay early-return list has no gate deriving it, and `.ng-seemore` was absent from it for its entire existence.
  <br>_(2)_

- **A tolerance baseline must be at least as strict as the gate downstream of it, and must ENUMERATE what it tolerates by name.** The PR ratchet allowed 76 graph errors while both deploys hard-fail on the first (now 0, with the reasoning in the baseline's own `note`). The `e2e:gen` red baseline is worse: it exists ONLY as prose — `e2e/gen/ledger.json` holds 179 rows and **every one is `"status": "accepted"`**, and no config, script or workflow carries a known-red list — so "the same 13 names" was unfalsifiable across four versions and has since drifted to 14. **An aggregate count is unfalsifiable and rots into permanent noise: put the baseline where the RUNNER reads it, not where the reader does.**
  <br>_(3)_

- **Deleting a component deletes its telemetry and its capability, and no gate reports it.** Removing `AffiliateTracking` removed the only emitter of three PostHog events — the links still earned, the MEASUREMENT stopped. Removing `SystemProgress` removed a whole UX from 48 pages and the only emitter of three more events, with no Neural equivalent: a capability LOST, not moved, and any per-system completion figure goes flat from the deploy date — do not read that as a usage collapse. Its dead markup still ships, because the shell is emitted by `templates/Systems.md.jinja2`, not by the component. **Do:** treat an emitter deletion as a data-loss event — in the same commit, enumerate every event, capability and dashboard it was the ONLY source of, and check for dead markup emitted by a template rather than by the component. Retiring a mapped `fx()` beat means deleting its sound cue, and breaking every spec that asserts it.
  <br>_(5)_

- **A new file under `neural/src/` is INVISIBLE to git unless its name matches the allow-list.** `.gitignore:87` ignores `neural/src/*` and re-admits only `*.src.js`, `*.src.jsx`, `*.css`, `xdc-template.html`, `helmet.html`, `props.json`, `technique-content.js` — deliberately, because that directory also holds untracked design dumps. Add a new `.js` file there and CI checks out without it, so `node neural/build/build.mjs` either throws or quietly ships a bundle missing the feature: **green locally, broken in production.** Any new build input carries the `.src.` infix or is `.css`; verify with `git check-ignore -v neural/src/<file>`.
  <br>_(1 documented in .gitignore, 0 caught by any gate)_

- **Scope every selector to a marker you OWN and assert it appears exactly once.** A query that resolves to the wrong object returns plausible data, not an error: `body[data-share-cue]` collided with the cue BUTTON's own attribute, so `querySelector` returned `<body>` and every "where is the cue" measurement silently became the whole 390x844 viewport (three journeys red); `HTMLRewriter.on("title", …)` matches by element NAME and the shell carries a second `<title>` inside an inline SVG (fixed with `title[data-share-title]`, written and asserted once by `build_share_shell.mjs`). Never query by a shape another object can have — element name, a bare attribute, or a computed dimension (a CSS-border triangle computes to `width: 8px`, not 0). Bundle corollary: `lists.src.js` and `lists-codec.src.js` share ONE scope in the IIFE, so no top-level name may collide, and `build.mjs`'s duplicate-name scan must cover `function|const|let|var|class` — it used to scan only `function|const`, so a colliding `let` walked past the guard into the SyntaxError it exists to prevent.
  <br>_(6)_


### 6.8 Before you delete something that looks dead (or debug something that looks alive)

- **LOOKS DELETABLE, IS NOT.** `AuthUI.tsx` + `source/quartz/components/scripts/authUI.inline.ts` render NOTHING but are the only static importer of `supabase.ts` (which installs the `window.__bjjAuth` façade at module top-level) and the only code that completes a Google OAuth redirect-back — delete either and signed-in users break while every headless test stays green. `CategoryNav.tsx` is the site's only persistent static nav and **NO gate guards it**: `check_seo_parity.py` extracts from the `<article>` only, and `#sidebar-overlay` is a sibling of `#quartz-root`. `openListSession` has exactly ONE caller left (`[data-shared-drill]`, `app.src.jsx`) and it is the received-class study path.
  <br>_(3)_

- **LOOKS ALIVE, IS DEAD — do not debug through it.** `renderDossier` and its subtree (`dossierSheetRef`, `_renderNodeQuestion`, `nodeQuestionFor`, `askFormat`, `jumpToState`) are unreachable from the app: `_dossierIdx` is assigned `null` at four sites and a node index at NONE, so the guarded call at `app.src.jsx` can never fire and only `first-impression.spec.ts` reaches `renderDossier` directly. `#unlock-graph` / `[data-system-progress]` still ships on all 48 Systems pages with no script to activate it. The Forward catalog (`forward/shared/*`) is a DESIGN MOCK with no parity gate — `check_forward_catalog.mjs` only checks frames render, so retired rows survive there by default.
  **And `neural/src/` contains untracked design dumps that grep exactly like the app:** `Neural Graph.dc.html` (288KB, touched as recently as HEAD) still defines `movePopularity`, `_hash01`, `_freqMap` and the retired `orderScore` fork, and `neural/src/graph-data.json` is a stale 1899-node copy of a 1467-node wire. **Scope every "is this gone?" grep to the build inputs, and read the shipped wire from `source/quartz/static/neural/`.**
  <br>_(4)_


### 6.9 Before you quote a number, cite a gate, or claim something is covered

- **A canon number nobody can reproduce is worse than no number — carry its SET DEFINITION and its recompute command in the same sentence.** The failure is rarely a bad measurement; it is a measurement of the wrong SET. Measured base rate in this repo: of the figures checkable from text alone, **four have already drifted** — "0 disagreements" (a check that never executed; real 95, later 49, and now filtered through `tests/artifacts/position_type_reviewed.json`), "85 of 136" opposite-sign positions (**115**, and it was 84 the day it was written — no magnitude threshold reproduces 85), the opponent gap "9.1 / 23.2%" (measured a set the model never holds, understating by half), and "89 ambiguous main names" (**110**). `tests/artifacts/_opponent_gap_measure.py` is the pattern: the number ships with the script that recomputes it.
  <br>_(8)_

- **Every coverage claim ends in one of three forms, and the third is the dangerous one: `Pinned by <spec>` / `Partially pinned: <spec> covers <case>, not <case>` / `UNGUARDED — <what you must check by hand>`.** A spec name attached to a CLASS-level rule invites the reader to infer coverage the spec does not have. Currently unguarded and still true: `CategoryNav.tsx`, the Forward catalog mock, and `attachInput`'s early-return list. A trap whose whole class reads `Pinned by` is a demotion candidate at the next review — that is what lets this section shrink as the suite grows.
  <br>_(3 currently unguarded)_

- **Comments are stripped by the build, so documentation above a constant is FREE — put the reasoning where the change will be made, not here.** Only the copy and the code are on the payload bill. Corollary for this section: a fact with a code site belongs in a comment at that site, and only its TRIGGER TOKEN belongs in CLAUDE.md. What stays here is what has no code site — how the work is measured, surveyed and claimed.
  <br>_(n/a — the admission rule for this section)_



## 7. Content standards, and the affiliate disclosure

Full rules in `docs/Content.md`. The parts you can break:

- **Wikilinks are path-prefixed**: `[[Positions/Mount]]`, `[[Transitions/Knee Slice Pass]]`,
  `[[Submissions/Rear Naked Choke]]`. Case-sensitive, must match the filename, no `.md`.
  **One exception:** `[[game-over]]`, which resolves via the frontmatter alias on
  `content/Game Over.md` (681 files use the bare form; none use `[[Game Over]]`).
- **Success rates are `{gi, nogi}` maps in source** and render as a single folded no-gi percent
  (`**Success Rate**: N%`). There is no Beginner/Intermediate/Advanced tri-level format — nothing
  authors it and no validator checks it.
- **Submissions must carry a safety section**: the notice first, injury risks with severity, tap
  signals, release protocol, and safety-critical questions in the assessment.
- **Attempt probabilities sum to 100 per role, per ruleset frame.**

### Systems: product links

Only the mechanics are in this public repo; commercial terms are the owner's, kept out of it
entirely. `scripts/check_affiliate_surface.py` and `e2e/journeys/systems-surface.spec.ts` gate all
of the below.

- Products live in `content/Systems/<System>.json` → `products[]`. **Never invent a product URL** —
  every `affiliate_url` is opened and confirmed before it is committed.
- **Only a verified link renders.** `link_status` (`live`/`dead`/`unverified`) and `link_checked`
  are schema-required; anything not `live` degrades the system to its free "study this system"
  surface. `price_usd` is deliberately **not** rendered — vendor prices drift, and a wrong price is
  the same broken promise as a dead link.
- **`graph.json` never carries `affiliate_url`** (public repo) — it emits `has_affiliate_url`.
- One funnel event on both surfaces: `affiliate_clickout`, delegated on `a[data-affiliate="true"]`,
  with `utm_source=bjjgraph&utm_medium=affiliate&utm_campaign=systems&utm_content=<system-slug>&utm_term=<product-id>`.
- **The ref is injected at deploy time, never committed.** Content carries the literal
  `?ref=REPLACE_ME`; `scripts/apply_affiliate_ref.py` substitutes `$AFFILIATE_REF` into emitted
  artifacts only. No secret set = warning, placeholder kept, exit 0.

**Proximate disclosure is mandatory** (FTC 16 CFR 255, UK ASA/CAP): it renders above the link, in
the same block, uncollapsed, from two places — the app's CTA shelf and
`templates/Systems.md.jinja2`. Both must reproduce this sentence **verbatim**.

> **The block below is machine-read.** `scripts/check_affiliate_surface.py` and
> `e2e/journeys/systems-surface.spec.ts` both extract it by these exact HTML comment markers and
> compare it byte-for-byte against both render sites. Editing the wording, the markers, or this
> section's number breaks a deploy gate — five error messages name "section 7".

<!-- CANONICAL-DISCLOSURE:START -->
BJJGraph earns a commission if you buy through this link, at no extra cost to you. It never changes what the graph teaches.
<!-- CANONICAL-DISCLOSURE:END -->

---

## 8. Gates, baselines, and what a gate is worth

Numbers live where they are enforced, never in prose here — prose copies drift, baselines do not.

| baseline | gate | rule |
|---|---|---|
| `tests/artifacts/budget_site.json` | `validate:payload` | byte ratchet; raising a ceiling needs `--update` in its own justified commit |
| `tests/artifacts/budget_neural.json` | `e2e/journeys/payload-first-hand.spec.ts` | the same weight measured from a real browser |
| `tests/artifacts/budget_docs.json` | `check_claudemd_budget.py` | this file's own char ceiling |
| `tests/artifacts/graph_validation_baseline.json` | `validate:graph` | `max_errors` is 0 |
| `node_ordinals.json` | `validate:ordinals` | append-only; never renumber, never reuse, retire don't delete |
| `e2e/gen/ledger.json` | `scripts/check_gen_specs.sh` | one row per generated spec |

**Suites own dedicated ports** (core :8133, gen :8127, share :8129, replay :8151), all with
`reuseExistingServer:false`. A config that reuses another worktree's server tests *that worktree's*
`source/public`, which makes any result from it unreportable.

**The suite is expected green.** `e2e:gen` carries a known-red set; anything red that the ledger
does not name is yours. Do not transcribe a red count from prose — re-derive it from a run.

**Mutation testing is the practice here.** A claim is not gated until a mutant of it turns a
**named** spec red. A surviving mutant is a missing spec, not a passing build — record the non-kill
in the spec's own header so nobody later mistakes it for coverage. See §6.9.

### Automation

Fifteen workflows. **Five of them load this file into a Claude action** — so its size and its
content are inputs to what the bots write, and a change here changes their output.

| workflow | trigger | what it does |
|---|---|---|
| `ci-validate.yml` | PR, push to dev | schemas, units, ordinals, MC viability, graph ratchet, **this file's budget + refs** |
| `e2e-full.yml` | PR, weekly, manual | the full core Playwright suite, four shards |
| `deploy.yaml` / `deploy-dev.yaml` | push | build, stamp the affiliate ref, all gates, Cloudflare Pages, Lighthouse, IndexNow |
| `content-improvement-bot.yml` † | Sat 18:00 UTC | improves 2 content files: select by git age → validate → Claude fills TODOs → revalidate (3 tries) → regenerate → PR |
| `analytics-content-improvement.yml` † | Sun 06:00 UTC | PostHog-driven content work |
| `proofread-bot.yml` | Sun 18:00 UTC | LLM audit of graph edges and probabilities |
| `validation-fixer.yml` | Sat 12:00 UTC | fixes validation failures |
| `votes-refresh.yml` | Sat 02:00 UTC | refreshes votes and regenerates the graph (see §6.7 — it runs a *partial* chain, deliberately) |
| `clips-verify.yml` | monthly | re-verifies YouTube clips against rot |
| `seo-monitor.yml` † | Sat 06:00 UTC | SEO monitoring |
| `claude.yml` † / `claude-code-review.yml` † | mention / PR | the assistant in issues and PR review |
| `keepalive.yml`, `supabase-keepalive.yml` | weekly / 5-daily | stop GitHub Actions and Supabase auto-disabling |

† loads `CLAUDE.md`.

**Hosting** is Cloudflare Pages. Deploys never run root `npm run build` — they re-list the build
steps inline, so a new emitted artifact or a new gate must be added to **both** deploy workflows
explicitly.

---

## 9. Where to write what

The instruction that produced a 350,000-char file was "update the docs with new learnings". This
replaces it.

**A shipped change writes its post-mortem AT THE CODE** — the constant, the function header, the
spec header, the config comment, the `.gitignore` line, a baseline's `note` field. That is where it
cannot drift from what it describes, and where the next reader is already looking. The repo already
carries ~1.1M chars of exactly this, and it costs a session nothing.

**Then append the narrative to `docs/Changelog-Archive.md`** — measurements, mutant tables, the
owner's words, the byte deltas.

**It earns a line in CLAUDE.md only when the fact has no code home.** Generated files that carry no
banner; a build step that does not do what its name says; a known-red baseline that lives in no
config; a rule about the repo rather than about a file.

**§6 grows only by adding a TRAP** — trigger token, mechanism, symptom, fix, guarded status — never
a story. At budget, admission requires eviction in the same commit; the default demotion criterion
is *the trap now has a gate that fails loudly and names it*.

`scripts/check_claudemd_budget.py` enforces the ceiling, the disclosure block, the absence of
`@`-imports and the presence of the catalogue. `scripts/check_claudemd_refs.py` checks every path,
`npm run` script and symbol citation resolves. Both run in `ci-validate.yml`.

---

## 10. Resources

| | |
|---|---|
| Live site | https://bjjgraph.org |
| Repo | https://github.com/diogoseca/bjjgraph |
| Quartz docs | https://quartz.jzhao.xyz/ |
| Rich Results Test | https://search.google.com/test/rich-results |
| Schema.org validator | https://validator.schema.org/ |

Analytics dashboards, schema markup and keyword strategy: `docs/SEO.md`.
Hosting is Cloudflare Pages; deploys run Lighthouse CI and IndexNow submission
(`.github/workflows/deploy.yaml`, `deploy-dev.yaml`).

---

*Validate → edit the JSON → regenerate → build. And read §6 before you touch the app.*
