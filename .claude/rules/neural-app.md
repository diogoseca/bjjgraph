---
paths:
  - "neural/**"
---

## 5. The Neural app — current state, and the seam index

Split out of `CLAUDE.md` at v1.224.3: it loads with the `paths:` above, and CLAUDE.md §6's index
names it. CLAUDE.md §0 and §9 decide what belongs here; `npm run validate:claudemd` gates its size
and references. CLAUDE.md §5 keeps the two paragraphs the static site shares.

Behaviour in full: **`docs/Neural.md`**. This section is orientation plus the names to grep for.

**Delivery.** Boot fetches `graph-data.json` (the compact wire — `ingest()` expands it),
`app/neural.js` + `.css`, the deck **manifest** `flashcards/_index.json`, and `curriculum.json`.
On demand: one deck's cards, one node's dossier, `systems.json`, `concepts.json`
(the Principles + Learning index — each concept's readable body is a dossier in the SAME
`content/` chunk space, keyed `<Name>|Principle`). **`_cardsOf(d)` is the only legal
way to read cards — a manifest stub is truthy.** The manifest's `n` is load-bearing: `deckMastery`
computes from it when cards are absent, so dropping it zeroes every user's knowledge.

**Pane law.** The pane is **manual-only** — nothing in the roll loop opens or closes it. **Open =
the game stops; close = it resumes, but only if the pane is what stopped it** (latched in
`applyDeckVisibility`, not `setDeckOpen`). One pane, anchored left, three tabs: Explore ·
Challenges · Last rolls.

**Reference law** (owner). A **Principle, a Learning entry and a System are pages, not places.**
Opening one — its row, or its own URL — lights the techniques it references and shows its body,
and that is *all* it does: no seat, no hand, no stage, no roll. **A roll starts only when the
player clicks a position, transition or submission.** `_refPage`, set from the path alone in
`_seedPageFromUrl`, is what holds the intro handoff off `startRoll()`; deciding it from the path
rather than from the payload is deliberate, because the payload is deferred and used to lose the
race. Pinned by `e2e/journeys/concepts-surface.spec.ts` (both halves — an arrival that starts
nothing, and a member row that starts a roll).

**The hand.** `optionsFor` deals every legal move (uncapped) ranked by **EDGE**, sorted ONCE by
**Win chance** (Neural.md §4) if untouched, else **frozen**: a grade moves
the numbers but must never re-sort a tray the player is reaching into. The clock times the QUESTION, never the hand (v1.133.0):
`decisionSec` arms when a question mounts and expiry reveals the answer as a miss
(`_expireLandQ`) while the hand stays live, untimed;
deck warm-up is capped at `NG_PREFETCH_CAP`.

**EDGE** (not printed) = `100 × (Q(s,a) − B(s))`: how much better this move is than the *ordinary* choice from
where you stand, counting where a miss leaves you. `0` is normal, not "no value". **The honesty
gap is the opponent's POLICY:** since v1.176.0 `opponentDefend` draws from `optionsFor` (role- and
origin-filtered) but never reads attempt shares — it finishes w.p. clamp(0.34 + 0.55·adv), else
picks among the top 3 by landing value — and resists your odds (aiMod). From standing (no-gi,
shipped rule) P(I finish) is 0.34 against the corpus's 0.72 (`scripts/semantics/app_game.py`). EDGE
describes the corpus's opponent, not the one you face. Say so in any copy explaining EDGE.

**The pair.** Every state draws as two orbs (merged → mitosis → split, gated by `kLOD`). It is
**derived at ingest** (`_deriveDualPairs`), costs zero wire bytes, and is UNCONDITIONAL — the
`?dual=legacy` escape hatch was retired in v1.158.1 along with its query-param read, so no URL
parameter can change how the graph renders. The pre-split graph survives for ONE caller,
`j.boot("/", { noPairs: true })`, because `dual-consumers.spec.ts` needs it as a live control group. The **rep member IS the hub** — same id, same share ordinal, same URL — so lists,
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
| docking fixed chrome | `_dockLandCard` · `_dockLandFilm` · `_dockLandMore` · `_landDatum` · `_bandBot` |
| the three bottom layers (film · card · hand), sticky by setting | `setLayer` · `_layerOn` · `_handShown` · `_applyLayers` · `_renderLayerDock` — a collapsed card is NOT BUILT, a collapsed hand is dealt and hidden; More is a separate scroll surface subordinate to the card layer |
| node coordinates, camera | `pairMid` · `_LY` · `headPos` · `rollCamTarget` · `holdCamera` · `frameNodes` |
| starting/staging a roll | `rollFromPosition` · `techniqueOrigin` · `confirmPlayFrom` · `seatRole` · `_seatMember` · `stageRollAt` |
| the hand and its numbers | `optionsFor` · `edgeMark` · `orderScore` · `moveChance` · `movePotential` (escape tray only) |
| outcomes | `drawOutcome` · `resolve` · `opponentDefend` · `momentumSkew` |
| roles and values | `valIdx` · `roleIdx` · `myColor` · `displayName` · `graphName` |
| naming a node on ANY surface | `graphName` (the one name — a position's `"… Top"` title suffix is a rendering artifact and comes off everywhere, canvas and DOM) · `nodeQual` (the dim second line: `from <origin>`, or an own/family alias) · `nodeMatches` (all aliases; `_ensureAliases` defers the index) — a SEAT is named beside a name, never inside it: the node card's badge, the row's role chip, the canvas sub-line |
| decks, grading, score | `_cardsOf` · `deckMastery` · `gameScore` · `_bumpStageVer` · `_warmMcPool` · `_schedule` · `ngWireDecks` · `ngWireScoreWeights` (the ordinal-keyed manifest + score wire) |
| lists and sharing | `siteIdOf` · `captureNode` · `ngListEncodeOrdinals` · `_openSharedListFromUrl` |
| a page-shaped entry (Principle · Learning · System): its body, its panel, its URL | `_docBody` · `_bodyDocHTML` · `NG_DOC_LABELS` · `_seedPageFromUrl` — and **never `_ngc` here**: it caches a miss as an answer, which is right for a node and wrong for an entry whose index promises a body |
| persistence | `_pullAndMerge` · `ngMergeLists` · `_saveProgress` |
| randomness | `rng(tag)` — **never `Math.random`**; `scripts/check_no_raw_random.sh` gates it |
| the tray | `_trayStop` · `_trayGlideBy` · `_trayFling` |
| the pane's tabs (click AND swipe) | `NG_PANE_TABS` · `setViewMode` · `_paneTabPageTo` · `_paneGestureDir` |
| keys on an inline deck (history · session · corridor) | `_miniReg` · `_focusRow` · `_challengeInline` · `challengeLessonNav` · `_lessonRows` — one registry for all three; a deck that takes focus takes it on the deck BOX, never a button (Space/⏎ are activation keys, §6.1) |
| gi / no-gi exclusion | `giAllows` · `rsAllows` · `_rulesetMask` · `setGiMode` · `cal.avail` · `frame_reachable` |
| build-side joins | `_tech_keys` · `fnv1a32` (in `scripts/_neural_content.py`) |
