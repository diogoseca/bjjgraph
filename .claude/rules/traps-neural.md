---
paths:
  - "neural/**"
---

## 6. THOUGHT TRAPS — the app: 6.1 overlays · 6.2 canvas · 6.5 runtime · 6.6 app-side joins

Split out of `CLAUDE.md` at v1.224.3: it loads with the `paths:` above, and CLAUDE.md §6's index
names it. CLAUDE.md §0 and §9 decide what belongs here; `npm run validate:claudemd` gates its size
and references.

### 6.1 Before you add, move or hide a fixed overlay (or touch `attachInput`)

- **`attachInput` · `setPointerCapture` — a control inside a fixed overlay is dead to the MOUSE.** `attachInput`'s `pointerdown` captures on the wrap, which retargets the later `pointerup`, so the browser resolves the click from the down/up common ancestor and your listener never runs. It measures correctly, `elementFromPoint` returns it, keyboard works, and `locator.click()` passes because it dispatches on the element.
  **Do:** name the overlay in `attachInput`'s pointerdown early-return list (`app.src.jsx` — 8 surfaces: node card, dossier sheet, landing card, film strip, More reading card, option-detail sheet, layer dock, hand ✕); keep card siblings in `_landSurfaces()`, set `pointer-events:auto` INLINE on the control, and prove it with `j.clickByMouse(sel)` (`e2e/dsl.ts`).
  **Partially pinned:** `clickByMouse` only fires for overlays somebody wrote a mouse journey for, and the full list is still hand-maintained — that is how `.ng-seemore` stayed dead to the mouse for its entire existence.
  <br>_(8 surfaces today; 6 defect instances found by hand)_

- **`opacity:0` IS NOT HIDDEN — an invisible overlay still eats clicks.** Hit-testing ignores opacity, and `pointer-events` is inherited, so any descendant that re-enables it inline stays live across its whole box — `[data-land-more]` does that inside the floating row (`app.src.jsx`). Symptom: something UNDERNEATH is dead to the mouse; before the landing footer was retired, `elementFromPoint` measured its invisible `<div data-land-foot="1">` at the centre of a capture button after 120s of Playwright retries.
  **Do:** also write `visibility:hidden !important` — inherited, unescapable here, removes the subtree from hit-testing. `_suppressLand` (`app.src.jsx`) is the reference. Assert inertness with `elementFromPoint`, never a visual check.
  **UNGUARDED: no gate enumerates the hide-sites.** (The long-leaky `expandOption` site was
  DELETED outright in v1.136.0 — the sheet stacks OVER the landing card at z:6 vs z:5 instead of
  hiding it, owner's call.)
  <br>_(5 by v1.100.2; the last leaky site deleted in v1.136.0)_

- **`_dockLandCard` · `_dockLandFilm` · `_dockLandMore` · `_landDatum` · `_bandBot` — fixed chrome docks off a MEASURED rect, never a CSS constant.** The option tray is `bottom:84px` with no height and grows upward as names wrap; anything tuned against it collides at some viewport. Measured overlaps: landing card 63px, escape tray 7px, option hint 2px at EVERY width, pane/card 108px at 1024, phone challenge cue 6,700 px².
  **Two sub-rules:** keep the TIGHTEST measurement ever taken at this viewport (the band flickers because card and film mount on different frames, and a per-landing reset hands the loose answer straight back); and an element that has not laid out yet reads `rect.top == 0` — that is SKIP, not a constraint.
  (The fourth instance — the phone challenge cue over the focus label — was resolved by DELETING the cue in v1.133.0, owner's call; `_cue_collision_probe.mjs` stays as the archive's evidence.)
  <br>_(12 (self-counted as "the third"); 0 still open)_

- **The app wrap is `position:fixed` = its own stacking context, so a `z-index` inside it is trapped at plane 0.** A deliberate screen must PORTAL to the app root or ambient gameplay chrome paints over it (the pane at z:8 was buried by a root-plane landing card at z:5; the account menu needed z:46 on the root plane). Bands, documented in `neural/src/helmet.html`: **1-9 ambient state · 10-49 ambient fx · 50-79 coaching · 90-99 deliberate temporary screens.** Pick a band, never a loose number; Esc walks the ladder top-down, pane last.
  <br>_(4 (dossier under the transport pill; the pane under the landcard; the account menu; seat star))_

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


### 6.6 Before you change a join, an id, a slug, an order or a persisted key — the app side

The build side (a CHECK THAT NEVER RAN, `cal.avail` · `frame_reachable`, `_tech_keys`, index-keyed
joins, an ARRAY INDEX in a URL) is in `.claude/rules/traps-wire.md`, which loads on `neural/**` too.

- **A fallback that produces a plausible value and never says it fired is strictly worse than a crash — it buys months of silence.** A missing `cal` made `calSuccess()` return null and `moveChance` fall through to `0.36 + dom*0.1`, so **~289 of 1,204 dealt cards printed a fabricated ~45.6% where authored rates span 10–74%**; `posId`-vs-slug left 54 of 136 positions running entirely on the no-candidates fallback; `posIdx` fell back to the technique itself and staged 1,331 of 2,934 nodes ON a technique node. **Do:** every fallback emits a NAMED beat or a counter (`mc_pool_cold`, `land_warm_stalled` are the pattern), and it is CHOSEN before any rng draw so the draw count cannot depend on content.
  <br>_(8)_

- **`s` is TWO DIFFERENT PAIRS behind one shape: `[top, bottom]` on a POSITION, `[attacker, defender]` on a TECHNIQUE.** `roleIdx()` (side) indexed both, so every bottom-performed technique was read as its opponent's value: **a bottom player was shown ZERO of the 297 submission nodes**, and 144 of 596 bottom-authored techniques were silently discarded. **Use `valIdx(node)` — performer for a technique, side for a position — never `roleIdx()` on a technique.** Two nearly identical accessors sit side by side in `app.src.jsx` and the code cannot explain why both exist; this is why.
  <br>_(1, corpus-wide)_

- **Lists hold SITES: `siteIdOf` normalises in the LIST LAYER — the writer AND every membership reader.** Only a hub carries a share ordinal; the derived pair's partner mints `<hub>/Bottom` / `<hub>/Defender` with `o: null` (**0 of 1467**), so a `+` pressed while standing on the lower orb filed an id the encoder reports as `missing`: **the technique was dropped from the share code with no error, and a one-item list of it encoded to the empty string.** Not an edge case — 136 of 272 position landings and 172 of 400 technique seats stand on a partner, i.e. every time the coach is playing bottom. **Normalising only the WRITE is the tempting half-fix and is wrong**: it makes a captured technique show `+` instead of `✓` on the very orb you captured it from. Nine call sites today (`addToList`, `removeFromList`, `removeListItem`, `activeListHas`, `nodeInAnyList`, `listsWith`, `listItemName`, `openListPicker`, the id lookup); it is the layer's invariant, so a surface added later cannot bypass it.
  <br>_(1, reachable on half of all landings)_

- **DO NOT role-split `adj`.** `opponentDefend`, `_mcPool` and `_posIdx` walk `adj[currentPos]` with NO role filter, deliberately — they are asking about the EXCHANGE, not about your hand. A purely role-split adjacency handed the opponent YOUR hand, the belt-test opponent stopped finding submissions, and `content-capstone` went red. Each pair member therefore carries its SITE's technique set (link kind 2, one-way, never drawn). **Precise wording matters here:** the two members' `adj` are NOT byte-identical — measured 136 of 136 differ by exactly the pair tie, and order legitimately differs because a site link is pushed one-way. The design claim holds; a spec written against the retired "byte-for-byte, in the same order" phrasing goes red on a correct build.
  <br>_(1 (found by the suite, not by review) · _re-verify before quoting_)_

- **A settings key can NEVER be deleted — retire it by ceasing to READ it.** `_pullAndMerge`'s per-key settings merge is `if (!(sk in merged) || ct > lt)` with **no tombstone** (`app.src.jsx`), so a key deleted locally is unconditionally RE-ADDED by the first pull from any device that still carries it; pruning on load is theatre. Dormant today, read by nothing: `cardOrder`, `studyOrder`, `challengePinnedTrack`, `activeListId`, `lossAversion`. Same shape, chosen deliberately, elsewhere: list reconciliation is ADD-WINS, so a DELETE loses to a stale device (deleting again is trivial; losing the class a coach already posted is not), and `srs` merge is later-`last`-wins with a same-day tie going to the SMALLER interval. And a state-driven auto-flip is not a mint: driving a reward toggle off "belt is black" re-enables it on every device forever through LWW — flip it once, inside the mint.
  <br>_(8 across three storage layers)_

- **`startPosTraffic` · `_posSlugIndex` — position traffic is keyed to the TOP MEMBER ONLY, so anything weighted by it scores ZERO for the entire bottom side.** `_posSlugIndex` maps a bare posId to the top member (`app.src.jsx`), while `resolveOutcomeTo` lands you on a bottom member on **2,071 of 3,842 outcome cells**. Measured on a bottom player who had drilled 90 bottom decks: **0 of 90 changed score**, and their "15 weakest spots" came back as fifteen guard-passing techniques — real names, ranked, entirely wrong. The obvious repair does not work either: **136 of 136 hubs give top and bottom IDENTICAL traffic**, so a hub lookup carries no side information at all.
  **Do:** key anything role-sensitive on `posId + "/" + role` and read the hand from `_ev`, which is keyed that way already. `flow.src.js` does; nothing else may weight by `startPosTraffic`.
  **Pinned by `tests/flow.test.mjs`** ("both roles carry occupancy").
  <br>_(1, and it silently produced a complete, plausible, wrong ranking)_

- **`_ev` holds 544 entries for 272 hands — `_deriveDualPairs` files the SAME `cal.ev` block on BOTH pair members.** Iterating it directly doubles every state and still prints believable numbers. Dedupe on `posId + "/" + role`. Same family: **`sum(att · EDGE) == 0` at every state BY CONSTRUCTION** (`_evShift` subtracts an attempt-weighted hand mean), so any score built out of `moveEdge` has an identically-zero total everywhere and its ranking is rounding noise — build in **Q**, never in EDGE. And `c1` is `int(round(100 * (A - B)))`: scaled ×100, integer-rounded, one per λ. Never `Math.abs` it — the negative rows are the feature, not noise.
  <br>_(3, all found before shipping FLOW)_

- **A value identical across a whole category on screen is a CONSTANT until proven otherwise.** `movePotential` returned `1` for every submission, so the sort key was constant across all 297; the dominance fallback priced the entire submission corpus at **2 distinct values** where 37 are authored; "30+ weak spots" printed `get("dailyGoal",30) + "+"` and read the same for a player with 3 gaps and one with 700. **Detection, cheap and general: count the DISTINCT values a field actually produces, and where two printed values are bit-identical, assert the underlying source rows are identical too** (42 of 42 is the passing shape). An exact tie on screen must be a tie in the data, never a constant in the code.
  <br>_(4)_
