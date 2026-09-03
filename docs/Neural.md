# The Neural app — behaviour spec

How the app behaves **today**, in the present tense. This is the only place that spec exists: the
code carries the mechanism, `CLAUDE.md` §6 carries the traps, and `docs/Changelog-Archive.md`
carries the story of how each rule was arrived at. When those disagree with this file, the code
wins and this file is the bug.

Scope: `neural/src/app.src.jsx` (one imperative component, ~13,000 lines, deliberately not split),
plus `challenge-*.src.js`, `sound.src.js`, `lists.src.js`, `lists-codec.src.js` and `helmet.html`,
composed by `neural/build/build.mjs`.

---

## 1. What the app is

The site's static pages are the SEO and no-JS surface. The app is an overlay mounted into
`#neural-root` that turns the knowledge graph into a playable state machine: you stand in a
position, you are dealt a hand of the moves that are legal from there, you choose one under a
clock, the outcome is drawn from the authored distribution, and you land somewhere new.

It is the **only** front-end. `?variant=legacy` is accepted and ignored.

---

## 2. Data delivery

| payload | when | notes |
|---|---|---|
| `graph-data.json` | boot | the graph IS the game. A **compact wire**; `ingest()` expands it to the legacy shapes |
| `app/neural.js` + `.css` | boot | the bundle |
| `flashcards/_index.json` | boot | the deck **manifest**: `{deckKey: [category, n]}` |
| `curriculum.json` | boot | `curriculum.weights` is what `gameScore` sums |
| `flashcards/<hash>.json` | on demand | one deck's cards |
| `content/<hash>.json` | on demand | one node's dossier, **and one page's body** (`<Name>\|Principle`, `\|Learning`, `\|System`) |
| `systems.json` | first read | Explore tab only, and deliberately **not** warmed on idle |
| `concepts.json` | first read | the Principles + Learning index (82). Same posture as `systems.json` |

Chunks are addressed by `fnv1a32(key)` — the app's own `qhash`, ported byte-identically into
`scripts/_neural_content.py`. A chunk holds a `{key: value}` map, so a hash collision shares a file
rather than losing an entry.

**Residency rules.**
- `_cardsOf(d)` is the only legal way to read a deck's cards. A manifest stub is truthy.
- The manifest's `n` is load-bearing: `deckMastery` computes `Σ min(stage,3)/3 ÷ n` from the
  persisted grades when cards are absent, which is the same arithmetic as the resident branch.
- `_bumpStageVer()` is the single writer of `_stageVer`; hydration nulls `_qkDecks` and rebuilds any
  open study surface, because `_entryForKey` takes a `.slice()`.
- MC distractor pools must not depend on residency. `_warmMcPool` dry-runs the pooler inside an RNG
  transaction, hydrates what it asked for, repeats until nothing is cold, then the real call draws
  from an untouched stream. A consult that was not warmed emits `mc_pool_cold` — never silence.
- The warm-up **signal** is bounded (`NG_LAND_WARM_CEILING_MS`, wall clock); the **work** is not.
  On timeout the app emits `land_warm_stalled`, so "no question here" always has a named cause.

No `cache: "no-cache"` anywhere — the edge serves these with real Cache-Control tiers.

---

## 3. The roll

### Landing

`renderLandCard(node, mode, hooks)` docks `.ng-landcard` above the options tray. Fixed read order:
**one-line definition → film → one multiple-choice question (three options) → your options →
`More ▸`**. The card
prints no name and no side: the graph names the state, beside the node.

Three modes, **one anatomy** (v1.132.0, owner: "using the positions in roles top/bottom as good
guides"). `land` — you are standing here. `attempt` — a technique is the subject (a click, a URL
arrival, a staged exchange); only its border skin differs — **no header** (the graph names the
focused node, the same rule that removed the position card's header) and **no "Roll from here"**
(clicking already set the board; play is the one go control). `defense` — the panic drill, the landing card's own recall
anatomy under the danger skin (v1.133.0), asked **above** the escape hand. The DRILL carries the
question clock; the ESCAPES are untimed — expiry no longer taps you out, it reveals the drill's
answer with no pump and the player still chooses. While caught, the field fogs to the exchange
(`_dangerSet`), `frameNodes` frames threat + seat + escapes, and the brand yields to the
vignette. Nothing auto-expands: every card arrives folded, `More` one tap away.

**Three layers, one preference each** (v1.171.0, owner: "it should still be collapsed"). The
film row, the card and the hand each collapse from their own ghost ✕ and come back from a dock at
bottom-centre (the retired transport's seat) that shows one muted glyph per collapsed layer and
nothing when all are open. The choice is a setting — `landFilm` · `landCard` · `landHand`,
mirrored in Settings › Rolling — so it holds across landings, reloads and devices. A collapsed
card is **not built**: no question, no clock, no miss, `land_q_skipped {reason:"collapsed"}`
(the panic drill skips the same way, `panic_skipped`); expanding it mid-landing asks then. A
collapsed hand is **dealt and hidden** — the roll waits, digits are dead — escapes included
(v1.171.1, owner: "if I didn't ask to see outcomes don't show them to me"; the catch is announced
as "<name> locked in", nothing more). All three collapsed is a graph browser: click a node, the
ripple lights what it connects to, nothing docks. `setLayer` is the one writer (`_applyLayers`
follows a cloud pull too).

**A revealed answer can be put back.** `_recallBlock` builds Show / Hide / Review again / Got it
once and `paint()`s the pair the state calls for, so revealing is not destructive: you can cover
the answer and try again before committing to a grade. **Space toggles** the live block — the app
publishes it as `this._recall`, the way `this._mc` carries A/B/C — and refuses one that has left
the screen or is standing inert behind the pane or the option sheet (`_recallLive`, the same
predicate A-D uses). Grading releases the key. Space still goes to an open study surface and a
focused mini-row first.

**Recall comes with rank** (v1.133.0): from BLUE belt up (`_recallInPlayNow`), a stage-2+ card
asks as timed recall Q/A in play; below blue, recognition-first MC holds. **That rank gate prices
a question asked against a running CLOCK, and only those.** The two paused study surfaces — the
node card and the option sheet's JIT micro-drill — take `askFormat` instead: recognition below
stage 2, recall at or above it, whatever the belt. `expandOption` pauses motion and declines the
landing question, so the JIT has no clock to price. The black-belt badge
still force-enables the toggle early. **The White Challenges cue card is retired** (owner) — the
challenge engine and the pane's Challenges tab are untouched; `renderChallengeCue` survives as a
remover. **EDGE is taught in two quiet places**: a legend row ("+7 · Tilt toward winning", full
sentence on hover) and a one-line caption under the option-detail sheet's big number — both
carrying the by-the-book-opponent caveat canon requires.

**Clicking (or arriving on) a technique NAVIGATES to it** (v1.132.0, owner: "when you click on a
transition or on a submission, you navigate to it. The URL changes to it, and the landcard is
standard" — and "if I click Kimura, then the landing should land on Kimura, not Knee on Belly").
`rollFromPosition` keeps the CHOSEN node's camera (`camFocus`), URL (`_syncUrl` — a technique URL
is never rewritten to its origin), focus, flare and card, while the SEAT stays the technique's
origin position (the engine's states are positions); `_stagedTech = {idx, side}` arms the
exchange, where `side` falls out of the seat role vs the technique's `fromRole` — the escaping
orb, a `/Defender` page, seats you defending. **Play runs the exchange** (`_runStagedTech`,
consumed at the `_played` latch): the attacking side commits that very technique through the
ordinary pick path; the defending side gets `enterDefense` — the red rush, vignette burning,
escape hand, think fast. Any other commit or teardown (`clearOptions`) consumes the latch, so
picking a different card while staged simply wins. A family-hub URL (`/Submissions/Kimura`)
resolves to the family's most-connected member instead of falling through to a random weighted
start. `roll_staged` carries a `technique` prop when an exchange is staged; the exchange emits
`staged_exchange {technique, side}`.

Controls live in the corners so they cost the card no vertical space: `More ▸` foot-left, the
familiarity chip and capture star foot-right, a 22px `✕` top-right. Dismissing clears the card for
that landing only.

**Paging (v1.131.0; chrome-free since v1.132.0): the card browses its own deck.** Swipe
left/right (drill-panel thresholds: 40px / 700ms, horizontal-dominant only), trackpad `deltaX`
(accumulated, one page per gesture), and `←`/`→` (a branch **below** the pane-History and drill
arrow branches, refused whenever `_landHidden()`). Gestures only — the visible `‹ dots ›` pager
and the reveal/hide rung shipped in v1.131.0 and were retired the next day (owner: "I don't like
that hide answers part … left right scrolling should still work"); the `landAnswers` settings key
never deployed and has no reader. `_landPageTo(dir)` replaces the `[data-land-q]` block
only — never a re-render — clamped at the deck's ends; a previously-seen card **re-parents from
the per-landing page cache** (same shuffle, no second RNG draw; an answered card returns as its
graded, disabled record). A cold distractor pool warms through `_landWarmP` (replace-not-clear).
A swipe is not a pick: a capture-phase click suppressor on the card swallows the synthesized click
of any gesture that moved >6px. The panic card pages nothing (it never enters `renderLandCard`).

**The economy pays once per landing.** `land_q_answered` is challenge evidence and combo has no
cap, so the FIRST answered card — whichever one the player paged to — routes through
`_landAnswered` (refund/combo/`_qMod`, clears `_landPending`); every later answer grades as pure
study (stage/srs/prep/`noteCardDone` still run inside `_mcAnswer`/`gradeRecall`) and emits
`land_q_extra` instead. The latch is `_landAnswers` (a per-landing Set of qhashes), never
`_landPending`. Committing after answering any one card fires no `land_q_ignored`.

The card **backfills**: `_landBackfill()` re-renders a live card when a late payload lands, but
only one that has never shown a question, on the current position, with a live decision window —
re-mounting an answered question would hand out a second attempt at credit already scored.

The film strip is its own fixed sibling (`.ng-landfilm`), docked to the card's measured top and
anchored by its bottom, so an expanding clip grows upward into empty screen; it carries its own
ghost ✕ (`data-film-close`, the film layer's handle), hidden while a clip is expanded. **A technique's film
lives under its content entry's `perspectives.{attacker,defender}.clips`** (v1.132.1 — measured:
1 of 1,326 technique entries carry a top-level `clips`, while 2,716 perspective arrays were in the
chunks all along); the staged side picks the reel, so the escaping orb shows the defense films.
**Recognition comes first, everywhere** (v1.132.2, owner: "It should have shown me multiple
choice … then I finally start to show actual Anki flashcards"): the emitter's `_hard_clip` bridge
makes every display answer one-line-comparable (word-boundary ≤150 + ellipsis, full text in `d`),
so every deck in the corpus builds a real MC — `validate:mc` 96.3% → **100.0% viable, worklist
110 → 0**. The recall block survives only as a last-resort safety net (a deliberately-opened card
is never chrome-only) with no live trigger in this corpus; authored `answer_line` (Phase B)
remains the quality upgrade over truncation. The option-node label pass yields to the
focused pair (`_lastOptLabels` publishes what it drew) — a staged technique is a dealt option AND
the focus, and drawing both names is the "printed twice" defect.

**Three options, and the trap is always one of them** (v1.148.0). `MC_DISTRACTORS = 2`
(`app.src.jsx`, mirrored in `scripts/audit_mc_viability.py`) is the one seam, read by `_mcBlock`
AND `_warmMcPool`'s dry pass. The ask now equals the recall floor, so a block is exactly three
options or it is not an MC block. **Selection order is load-bearing:** the corpus is uniformly 2
`plausible` + 1 `trap`, so the pooler takes the TRAP FIRST — consulting `plausible` first leaves
the trap tier unreachable corpus-wide with every gate still green — then rotates which plausible
fills the last slot. Display order is still the `…-mc-shuffle` shuffle. Pinned by
`mc-oneline.spec.ts`; full story in the archive.

### The JIT drill follows the format ladder

The in-sheet micro-drill (`[data-jit]`) was the last surface that only ever asked one way. It now
asks through `askFormat`, like the node card: an unproven card deals MC (`[data-jit-mc-opt]`, tags
`jit-mc-pick`/`jit-mc-shuffle`, so it can never eat the bare `mc-*` queue journeys rig by name); a
card at its MC cap reads back as the reveal → "Got it" rung it always had; a cold distractor pool
falls back to recall with ONE warm attempt per deck (`_jitWarmTried`). Right pumps the odds and
deals the next card, wrong pumps nothing and offers `[data-jit-next]` — the sheet is paused, and a
read answer should not strand the drill. Credit is `_mcAnswer`'s alone (`banked()` carries the pump
and the beacon, never credit), so a graded card counts once; closing the sheet hands the A/B/C keys
back (`_handBackMc`, the dossier's idiom). Gated by `e2e/journeys/jit-format.spec.ts`; the economy
journeys grade format-agnostically through the DSL's `jitGrade()`.

### The option sheet is the card you pressed (v1.136.0)

The sheet head keeps the option card's EXACT anatomy — the numbered category glyph (the tray
digit rides along via `catGlyph`), the category word whispering at 10px/.05em, EDGE — and the
technique's OWN name as the 27px title (`splitName().main` + the `from …` qualifier line). The
from→to decomposition is deleted ("it should definitely not be decomposed into this made-up
title", owner). The EDGE explainer paragraph became a `title` tooltip on the number itself
(`cursor:help`; aria-label shrank to the NAME per the title-is-the-description convention; the
by-the-book-opponent caveat rides inside — canon for any EDGE copy). The "on success, advances
to" line stays gated on `titleParts` being null: `opt.res` is a deal-time first-neighbor
heuristic, measured wrong for 188 of 323 "X to Y"-named transitions when that gate was briefly
widened. **The sheet is PORTALLED to the root plane at z:50 (coaching band)** — it was
`absolute z:6` inside the wrap, trapped at plane 0 under the root-plane landing card (§6.1's
ladder trap, caught by an adversarial pass before shipping) — and **the landing card is no
longer hidden on expand**: it stays visible BEHIND the sheet (the old opacity hide-site, §6.1's
last leaky one, is deleted outright). Paint order is asserted with `elementFromPoint`, never
z-index arithmetic. Pinned by `option-edge.spec.ts` + `coldstart-backfill.spec.ts`.

### The commit hands the camera to the roll (v1.135.1)

`userActiveNow()` (4 game-seconds since `lastInteract`) is the ONE condition that suppresses the
follow-cam — and the pick's own click wrote it, so the camera stood still while the pulse left.
`enterAttempt` now ages the latch out and releases any focus lease: committing is the ownership
doctrine's "asking to go somewhere else is a decision" case, and the follow-cam tracks the
travel from its first frame. Pinned by `roll-card.spec.ts`.

### The panic drill is multiple choice (v1.135.0)

The defense drill asks its question as the landing does — an `_mcBlock` on surface `"panic"`
(`data-panic-mc-opt`, rng tags `panic-mc-pick`/`panic-mc-shuffle`, danger skin from the card).
A right answer pumps the escape odds and deals the next card; a wrong one reveals and pumps
nothing; expiry reveals-as-miss exactly like the landing. The reveal/Got-it recall idiom
survives only as the cold-pool fallback, with ONE warm-upgrade attempt per deck (a deck that
cannot build MC must not loop). The bottom-left legend lost the "+7 Tilt toward winning" row
(owner: "the bar already shows that nicely") and the Win–Lose bar dropped to 165×7px.

### The pair label (v1.135.0)

The pair label group anchors at the pair MIDLINE — "the name never moves" — but **the role word
rides its orb**: `subY = min(nameY − 18, orbY + 4)` above (mirrored below), clamped to the
block's clearances, so an ordinary ~35px pair keeps the old offsets (±1px) and a wide roll-zoom
split puts TOP beside the blue orb it names instead of floating equidistant from both members
(the owner's "why does top mount look red" — the eye bound the midline label to the red bottom
orb). Published as `_lastPairLabel.subY`; pinned by `dual-pair.spec.ts`.

### The turn-based shell (v1.134.0)

**The transport is retired.** With the hesitation branch gone nothing ever advances without a
commit, so play/pause/restart controlled nothing — the buttons are deleted, Space no longer
toggles anything (the Shortcuts tab row went with it), the Last-rolls CURRENT row lost its
pause/resume toggle (archived rows keep "roll from here"; the live row carries no button), and
`setPaused` survives only as internal MOTION state (staging pauses,
committing unpauses; the pane law still freezes travel). **The background ladder** (owner):
click empty sky once — the card closes (question declined, free) and the hand stays; click again
— **free roam**: the roll archives (if played), the tray clears, and the camera pulls back
centred on where you stood (`_enterRoam`, `roam_entered`); any node click stages fresh and ends
roam. The ladder is a gesture on THIS landing (`clearLandCard`), never a preference — only the
✕ handles are sticky (`setLayer`). **The staged technique's card is the go**: its option card in the hand takes the action
accent and the commit verb ("Finish it" for submissions, "Execute" otherwise —
`_highlightStagedCard`, glided into view; deal order untouched), and committing it executes IN
PLACE — the pulse path is `[tech, tech]`, no rewind to the origin, and the travel label yields
to the pair label that already names it. **The escaping orb rushes on click**: arriving on (or
clicking) the defending side enters the defense immediately — vignette, drill clock, escape
hand — with the stale landing card declined and cleared first. The Win–Lose meter reads
**Win (blue) left · Lose (red) right** (the writer mirrors `adv.cur`; the model is untouched),
and the option-card category tracking dropped to .05em so SUBMISSION never truncates.

### The hand

`optionsFor` deals **every legal move** — origin-filtered and role-filtered, uncapped — ranked by
EDGE. The order is **frozen at deal time**: `ord` and `ordOdds` are stamped once, and `_cmpDealt`
compares only stamped values (EDGE desc → odds desc → attempt% desc → name asc, unvalued last and
never as 0). A just-in-time grade must move the printed numbers and must never re-sort a tray the
player is already reaching into.

Three marks, two channels: **shape** = category (circle position, triangle submission, diamond
transition) · **colour** (glyph, clock bar, corner number) = EDGE · bottom-right = odds, which are
an input to EDGE.

The clock times the QUESTION, never the hand (v1.133.0, owner: "pressure should not be on the
choices … the choices are fun to click"). `decisionSec` (the "Answer time" slider, 5–15s, flat —
the v1.123.0 Hick's-law knee died with the hand clock) arms when a question mounts
(`_armLandClock`) and drains a 3px bar on the card's top edge (neutral, red at ≤3s, "Answer
3…2…1" in the announcer). Expiry (`_expireLandQ`) reveals the answer as a MISS — correct option
highlighted, a failed SRS review, −4% on this exchange, momentum broken — and the hand stays
live: the player still picks, untimed. Committing past an open question is a FREE SKIP, and so is
anything that puts the question away — the ✕, a background tap, the pane, an option sheet — all
DECLINE it (`land_q_declined`, mapped to the same funnel side-mark; momentum untouched). The
penalty exists only for letting it expire while it faces you. **The question clock never
pauses** (v1.134.0, owner: "that's our test to the user") — it drains on the real game frame,
staged boards and internal pauses included — **but it never STARTS before the player does**
(v1.137.0, owner: "a first-time Guest can land on TOO SLOW · −4% before ever interacting"): no
window arms until the first real interaction (click, keypress, graph hover — one document-level
once+capture latch, `_engage`) AND the question card is visible; an early arm parks in
`_clockWait` (a FLAG — the bar element resolves at arm time, because the card can re-render
between park and engagement) and fires the moment both hold. Brand-new visitors
(`_returningVisitor()` false) get a 1.5× grace window; returning players keep full pressure; the last three seconds pulse the card itself
(`ng-clock-hot` — a MARKER class since v1.135.1: the pulse is frame-driven border/box-shadow
writes in `_tickDecision`, because a CSS animation on the card replayed its entry animation and
flashed; the disarm eases both the glow and the clock bar off through one-shot transitions,
never a snap). **Expiry spends the block** (v1.135.0): the miss is taken once — −4%, combo
break, one failed SRS review, answer revealed — and the revealed buttons are inert
(`truth.spent`, the closure's own door); a late click grades nothing, charges nothing, emits
nothing. After ANY resolution — graded or
expired — the buttons still TALK: a clicked wrong answer takes the red mark (the previous
exploratory red lets go), the green never moves, and none of it emits a beat or touches a
ledger (`explore` in `_mcBlock`). A landing that asks nothing has no clock at all. The option cards' bottom bars are static EDGE colour now — nothing
on the hand drains. Deck warm-up takes the hand's first `NG_PREFETCH_CAP` cards

The tray scrolls by wheel (larger of `deltaX`/`deltaY`) and by mouse drag (mouse only — touch is
the platform's job); the "see more" hint that also scrolled it was deleted in v1.171.1. A drag
that moved more than a few pixels suppresses the click, or every drag ending over a card would
commit that move. One rAF owns `scrollLeft`: `_trayStop()` is called by a new grab, by `tweenScroll`
and by `clearOptions`.

### Resolution

`resolve()` decides success or miss on `moveChance`, then `drawOutcome(act, branch)` restricts the
authored table to that branch and renormalises **inside** it — exactly the conditional the authored
weights state. Exactly one `rng("outcome")` draw per resolution. Omitting `branch` (the opponent's
destination draw) uses the whole table.

`momentumSkew()` scales counter rows down inside the miss branch, so "too fast to capitalise" reads
as written.

**Initiative is asymmetric, and it is the shipped rule.** A success returns to `enterLand(false)` —
you move again. A miss that moves you costs a ply and hands over the turn; a miss that leaves you
in place costs nothing. `opponentDefend` always ends by handing the board back, so the opponent
never keeps initiative.

**Hesitation costs the turn.** When the decision clock expires, `opponentDefend()` takes one
exchange after a `HESITATE_HOLD` pause — the hold is what turns two announcer lines into a cause
and its effect, because the announcer has one slot. It cannot spiral: they take exactly one
exchange and the board comes back. Beat: `hesitated`.

### The announcer

One slot, stamped owners. The expiry sentence ("Answer revealed · −4%") is a LEASE since
v1.138.0 (`_evExpiry`): it drops the moment focus moves — staging, roam, the option sheet, the
dossier, deck paging, one seam (`_dropExpiryEvent`) — or ~5s after it was written; any newer
sentence releases the stamp on its way in. And **one subject per label**: the announcer names
**who is initiating** ("You go for" /
"Opponent goes for"), and the graph verb names **your posture** toward that move. They can never
contradict because they answer different questions. Whoever writes the slot owns its lifetime —
`_tickDecision` stamps `_evCountdown` when it writes the countdown, every other `setEvent` releases
the stamp, and `clearOptions` drops the line only if the stamp still stands.

---

## 4. EDGE

**`EDGE = 100 × ( Q(s,a) − B(s) )`**, where `B(s) = Σ attempt%(a′)·Q(s,a′)`.

How much better or worse this move is than the **ordinary** choice from where you are standing,
counting not just whether it works but where a miss leaves you, out to the end of a real roll.
`0` is not "no value" — it is *the normal thing to do here*.

Computed offline by `scripts/solve_edge_values.py` over a 272-state MDP read from `graph.json`
(never from the wire): `V = p_win − λ·p_loss`, `Q(s,a) = p·A + (1−p)·B`. You argmax; the opponent
samples the authored attempt distribution from the **paired role-node's** own hand. Actions are
origin-filtered exactly as the app deals them, and when origin empties a hand the model relaxes
origin, never role.

The wire ships **the line, not the point**: `EDGE(p) = e0 + (p − p0)·c1 − Δ`, because `moveChance`
moves with drilling, momentum, a wrong landing answer and the opponent's resistance. `p0` is the
solve's own frame, never `calSuccess`. `Δ` is the per-state opponent handicap, re-evaluated live
over the state's full authored action set — without it every card in a state can read negative,
which is arithmetically impossible for a weighted mean. Δ is 0 at rest, so a card with no modifiers
shows exactly the solver's published integer.

Membership is the index list: `cal.ev[role] = [nodeIdxs, attemptPct, ...[e0,c1] per λ]`. A node
absent from `nodeIdxs` renders **no number at all** — never a fabricated 0, because 0 is a real
value here.

**Loss aversion** is a user setting (Settings → Rolling): Sport (λ=1) · Slightly cautious (λ=2,
default) · Self-defence (λ=4). λ=1 is the balanced point, so λ=2 is already twice as afraid of
losing as it is keen to win. The rungs are built **from the wire** (`evLam`), so a wire with no
table renders no row. The dial re-orders hands; it cannot change which moves you are offered, and
it cannot move the clock. `_evLamIdx()` is read once per deal.

**Where the roll starts** is a user setting (Settings → Rolling, above Uniform; v1.165.0, third
pill unlocked v1.166.0): Standing · Anywhere (default — the historical draw: first-impression
bias, then uniform) · **My weak spots** — each roll opens on a spot FLOW says your game leaks
from, where a spot is a **position + seat pair, never a position alone** (owner, 2026-09-02).
`_weakStates` maps each `weakSpots().ranked` deck — the SAME list the pane's "N weak spots"
prints, never a second ranking — to `(posId, role)`: a position deck by its key's own suffix, a
technique deck by `fromPositionId` + `fromRole` with a `|Defender` deck flipping the seat. It
keeps the `leaking` tier (widened to the top 8 mapped rows when that tier maps fewer than 3),
dedupes on `posId + "/" + role` so two cracks in one state do not double its weight, and
publishes the window as `_lastWeakWindow` for the specs. `_weakStart` then takes ONE
`rng("start-pos")` draw, inverse-CDF weighted by FLOW gain — the biggest leak opens most often,
never every time — and `startRoll` overrides `playerRole` with the spot's own seat (the role draw
is still consumed, so draw counts are identical in every mode). `startFrom()` is the one reader;
`startRoll` consults it after the `rigStart` rail and before the first-impression branch, still
consuming ONE `start-pos` value per roll. An empty window (no ranking, or nothing maps into the
playable pool) and a wire with no playable standing-position both fall back to the ordinary draw
and emit `start_from_fallback {want, have}`. The Settings note under "My weak spots" names the
live spot — the crack, its seat, and where the roll opens — from the same window, and the opening
toast reads "Your weak spot: &lt;crack&gt;". Pinned by `e2e/journeys/start-from.spec.ts`
(10 journeys, 8 `@curated`).

**The honesty gap, still open.** The shipped `opponentDefend` iterates hub adjacency with **no role
filter and no origin filter** and never reads `attemptProbability`. Only ~12% of what it may play
is a move the model's opponent would consider; the modelled set is a strict subset in all 272
states. EDGE therefore describes a better-behaved opponent than the one you actually face. Any copy
explaining EDGE should say so. Reproduce with `tests/artifacts/_opponent_gap_measure.py`.

Three choices that are choices, not facts: the zero point is the authored occurrence distribution;
the chain performer is label-driven; the wire is the horizon mixture while published tables quote a
single horizon.

---

## 4b. FLOW — what a DECK is worth (v1.138.0)

**`GAIN(deck) = V₀(you, that deck mastered) − V₀(you, now)`**

EDGE prices *a move from where you stand*. FLOW prices *a deck across your whole game*, and it is
what ranks weak spots, the daily dose and the study queue. Kernel: `neural/src/flow.src.js`;
reference and gate: `scripts/solve_flow.py` (`npm run validate:flow`).

**It is a POLICY EVALUATION, not the argmax solve EDGE ships.** Same recursion, `argmax → π`.
The two value functions are measurably different objects — under argmax every dominant state
compresses to `p_win ≈ 0.98`, under the played policy `mount/bottom` is −0.281 and
`back-control/bottom` −0.479 — so `sol.v` cannot be reused for this and is not emitted.

**Zero new wire bytes.** The browser rebuilds the 272-state kernel from `cal.ev` (hands and
attempt shares, keyed `posIdx/role`) and `cal.outcomes` (1331 of 1331 summing to exactly 100).
Attempt shares are renormalised per state: `graph.json` is exact, the wire rounds to integers.

**All 1,500 deck derivatives come from one backward and one forward sweep** — the adjoint. The
forward occupancy `ρ` *is* "how often you are there", exactly rather than as a metaphor. ~50ms for
the whole corpus; verified against finite differences to 1.9e-09. The linearisation only recovers
93–107% of the true change, so the **shown shortlist is re-solved exactly and no sign is ever
taken from the tail**.

**The score is SIGNED, and that is the point.** 18 decks LOWER your game when you drill them,
because their success branch lands somewhere your own play leaks while their miss branch returns
you somewhere you are strong. The list is the rubber-guard ladder — `New York to Invisible
Collar` and its neighbours. Backfiring is a **class, never a tier**, and only ever from an exact
re-solve.

**Tiers are cumulative shares of the CURRENT recoverable total**, not a fixed one. Measured and
counter-intuitive: mastering decks makes every *remaining* deck worth MORE (a better game reaches
further and survives longer — V₀ 0.079 → 0.385 over the top 37), so a fixed denominator lets the
called-out count grow from 37 to 570. Against the current total the list stays stable, a mastered
deck scores exactly 0 and leaves it, and **recoverable value falls 0.862 → 0.425** as you close
gaps. That figure, not the tier count, is the honest "how much is left".

**Personalisation is a continuous deformation, never a second path.** At 5.23 decisions per roll,
0 of 1,246 (state, move) cells reach n≥8 at 50 rolls — but the 8 states that do carry 43% of all
traffic. So: a global execution offset, a conditional-logit tilt on the authored attempt
distribution, per-state Dirichlet refinement where counts allow, and per-technique rates pooled
across states — all shrinking to the prior at n=0, at the repo's own `pseudo_count = 8`. The
ledger feeding it is written at ONE hook, `resolve()`, and stored as a per-device G-Counter
(counters are the one thing the blob's per-key MAX merge cannot carry: two devices at 30 rolls
each are 60, and MAX reads 30).

**What it inherits, and the copy says so:** the solve is no-gi while gi is the default ruleset
(146 nodes differ); the opponent it prices is `opponentDefend`, which filters neither role nor
origin, compounded over 11 plies; the 1,326 Defender decks are unscored because your drilling does
not change the opponent's rates — that was about the ODDS model, and this is a KNOWLEDGE score, so
since v1.145.13 both seats and all 272 position decks are weighted.

> **RULED AND CLOSED (v1.145.13).** This file used to call the Defender and position zeros "on
> purpose"; no human had. The owner's ruling: score the whole corpus and let scores fall, while
> nobody yet holds a belt worth losing. `gameScore` now weights all three blocks — the FLOW
> disagreement above is resolved in FLOW's favour, and the sentence before this one describes
> what `gameScore` no longer does.

## 5. The pair

Every state draws as **two orbs** — the two sides of one exchange.

| phase | what you see | value |
|---|---|---|
| **merged** (a *site*) | one orb, no role distinction | `kLOD == 0` |
| **mitosis** | one orb shrinking, two growing out of it | `0 < kLOD < 1` |
| **split** (a *pair*) | two orbs | `kLOD == 1` |

It is **derived at ingest** (`_deriveDualPairs`) from data already in the model, so it costs zero
wire bytes. `?dual=legacy` is the only escape hatch; every other value falls through to the pair.

**The rep member IS the hub** — same id, same share ordinal, same URL — so every id-keyed consumer
(lists, systems, curriculum, ordinals) lands on it unchanged. The partner mints `<hub>/Bottom` or
`<hub>/Defender` and carries **no ordinal**.

**Two kinds of link.** Kind 1 is the real edge, re-keyed one-for-one to the member it belongs to —
one-for-one is load-bearing, because `rSite` recovers the hub radius from the two members' degrees.
Kind 2 is **site adjacency**: the other half gets the technique too, so `adj[<either member>]` is
byte-for-byte the hub's. **Do not role-split `adj`** — several readers walk it role-agnostically on
purpose, because they are asking about the exchange, not about your hand.

`deg` is geometry and stays split; `siteDeg` is the state and is the hub's. `cal.ev` goes on
**both** halves whole, because the side you are playing can differ from the half you stand on.

**Labels.** `pairGroup` renders one label group for the pair: the name pinned to the midline, the
qualifier beneath it, and the role subtitle on the outside of whichever half you point at. When a
qualifier renders, the two-row block straddles the midline. Role words are per category — positions
**TOP/BOTTOM**, submissions **FINISHING/ESCAPING**, transitions **ATTEMPTING/DEFENDING**. The graph
never bakes a role into a name (`graphName`).

---

## 6. Camera

`rollCamTarget(f, moving)` is the single seam for framing. Vertically it centres the node's **label**
in the band actually free between the announce block and the landing card — measured, never a
constant, with `_bandBot` keeping the tightest answer ever taken at this viewport height.
Horizontally it parks the node at ~44% of the width on desktop, because a name runs left-to-right
*from* its node; on a phone it centres the **orb + label block**, with `NG_LABEL_LEFT_MIN` as a floor
on the drawn silhouette.

A focus flight takes a **lease** (`holdCamera`, ~7s). While it is live every automatic retarget
yields; a real pan, pinch or wheel releases it, as do the user's own "go somewhere else" paths. The
lease expires on its own.

`camFocus` is `pairMid` — the drawn midpoint of the two members — so a swap between halves moves the
camera not at all.

The arrival is the event: `flare(idx, amp)` blooms where the roll **stops**, and `REST_GLOW` is the
resting presence that the bloom decays into, so there is no cliff and no stale state. Nothing is
drawn inside a node at any zoom; zoom changes how many nodes you can see, never what one says.

---

## 7. The pane

One pane, anchored left, 360px, opened by the logo. Three tabs: **Explore · Challenges · Last
rolls**.

**Pane law: the pane is manual-only.** Nothing in the roll loop opens or closes it. **Open = the
game stops. Close = the game resumes, but only if the pane is what stopped it** — one latch
(`_paneAutoPaused`) for the whole pane, taken in `applyDeckVisibility` rather than `setDeckOpen`,
because several study entry points assign `deckOpen` directly. A hand-paused roll stays paused.

Every pauser owns its own latch — `_landAutoPaused`, `_paneAutoPaused`, `_replayAutoPaused`,
`_dossierAutoPaused` — so releasing gives back only the pause you took.

On a phone the pane is an 88vw drawer and **is** the screen, so closing it is how you look at the
graph: a list focus survives a mobile close, and closing it during a replay hands the clock to the
film rather than resuming.

**The tab bar is a pager** (v1.147.0). A horizontal touch drag anywhere in the pane, or a
trackpad's horizontal wheel, walks the three tabs; the CONTENT FOLLOWS THE FINGER, so dragging
leftward pulls the tab on the right into view — `_landPageTo`'s convention, and every native
pager's. It clamps at both ends rather than wrapping, refuses a vertical-dominant drag (that axis
belongs to the pane's own scroller) and refuses one begun inside a horizontal scroller such as a
dossier's film strip. A study surface keeps the gesture for its own cards. No platform exposes a
swipe-direction preference to a web app; the one device signal that exists is writing direction,
so an RTL layout flips the mapping (`_paneGestureDir`). A swipe is never a tap: a capture-phase
suppressor eats the click the browser synthesises at the end of one.

**One gesture is one tab** (v1.151.1). The wheel path ends its gesture on the STREAM going idle
(a 300ms gap), not on a timer: a trackpad's inertia keeps deltas arriving for about a second after
the fingers lift, and v1.147.0's cooldown merely rate-limited that tail, so one flick off the
rightmost tab paged twice and landed two tabs away — "passing through the middle tab but never
landing on it". The clamp was never involved. The touch path was always one step, because a drag
has an explicit end.

**Explore** — sections default collapsed, persisted per section. A search query renders flat ranked
results before any section exists, so a match inside a folded group is never hidden; that query
branch walks the node list directly and must filter to `rep`, or every hit doubles. Lists live at
the top, built from the same three-rung indent as every other group.

**A page-shaped entry (Principle · Learning · System) opens as a READ.** The deferred index
(`concepts.json`, `systems.json`) carries the card and the ids it lights; the body rides the
on-demand chunk a node dossier already uses, keyed `<Name>|Principle|Learning|System`, drawn by ONE
renderer — `_bodyDocHTML`, with `NG_DOC_LABELS` naming each library's blocks (no label, not drawn).
A cached `null` is a MISS here, never an answer: `_docBody` forces one re-read per key per session
and `_hydrateContent` retries a transport failure (`NG_CHUNK_TRIES`) while still caching a 404.
Arriving on `/Principles/<slug>` (or `/Learning/`, `/Systems/`) opens that entry and lights its
techniques, and starts **nothing** — no seat, no hand, no roll (`_refPage`, set from the path in
`_seedPageFromUrl`). A roll begins only when the player clicks a position, transition or
submission. v1.155.3 seated the board on a member instead; that seat was itself a roll nobody
asked for, and the owner's reference law replaced it. A bare CATEGORY HUB — `/Positions`,
`/Transitions`, `/Submissions`, `/Systems`, `/Principles`, `/Learning` — is the same law one level
up (v1.169.0): the arrival opens the pane on Explore with that ONE section expanded, written
through the same persisted `exploreOpenSections` map a header click uses (neighbours keep their
folds), and starts nothing. The deferred sections render expanded when their payload lands,
because the map is written before their first render asks.

**Challenges** — the belt corridor. Five content tracks, all open from day one; track colours
describe material difficulty, never rank or access. The frontier belt drives the default-open
section, the arrival scroll, the tab belt's dye and stripes, and the cue. Nothing ever re-locks.

**Last rolls** — roll history with inline decks, plus per-row ▶ (stage a roll from that state, on
the side it was played, clock held) and ⟲ (replay). History is in memory and has never persisted.

**A replay is a film of a roll you already rolled.** It credits nothing — `_replayBeat()` pushes to
the beat stream and stops, deliberately not through `fx()`, which is the challenge-evidence seam.
Any real input ends it. It holds the clock on its own latch and never touches the pane.

---

## 8. Progress

**Game Knowledge is the one skill score:** `score = Σ (weight_i × mastery_i)`, weights summing to 1.
`weight_i` is how often a roll actually passes through technique *i* — the stationary distribution
of the graph as a Markov chain, computed at build time into `curriculum.weights`. `mastery_i` is
`deckMastery(key)`. No rare technique is cut: it counts proportionally to how rare it is.

**The score spans the WHOLE corpus (v1.145.13).** One roll step exercises three separable kinds of
knowledge, each happening once per step: **where you are**, **what you do from there**, and **what
is being done to you**. Three blocks — position occupancy `pi`, technique visit-rate `visits`, and
those visits mirrored to the defending seat — each summing to 1; the score is their mean. Not a
tuning knob: attempt probabilities sum to 100 on **272 of 272** role-nodes, so `sum(pi)` and
`sum(visits)` are both exactly 1 — three readings of one unit step.

Until v1.145.13 only the attacking third was weighted: 1,326 Defender and 272 position decks —
**9,071 cards, 41.4%** — scored zero. **Studying a position now counts, and counts heavily**: 272 decks share a third of the mass, so one is worth
~4.7× an average technique deck and 14 of the 20 heaviest decks are positions (`Side
Control|Top` leads).

**Nothing about the score decays.** `deckMastery` moves only on answers — the belt cannot drop
because time passed. Retention-vs-pressure gets decided in `_schedule` (SRS intervals: *what you
are shown*), never in what a deck is *worth*.

**Wire.** `curriculum.scoreWeightsByRuleset` is `{div, p:{k,gi,nogi}, t:{k,gi,nogi}}` — position
keys once, technique NAMES once, one int array **per ruleset**, each `t` name carrying **both
seats**. `scoreWeights(frame)` is the one expander; the emitter
round-trips it per frame and refuses if the mirror stops holding. Per ruleset (v1.146.0): 52
techniques are attemptable only in gi — the default — and 16 only in no-gi, so a folded no-gi solve
scored them 0 in both seats (**104 decks, 739 cards**). `k` is the union, a **zero means "not
attemptable here"**, and `frame` is REQUIRED — a default is how that survived 77 versions. `gameScore` memoises on `(_stageVer, frame)` and the expander per frame, or the first read
pins one ruleset for the session. Gated by `validate:score-coverage -- --gate`; coverage is now **99.66%**.

Bands: white .20 · blue .40 · purple .60 · brown .70 · black .80. An MC answer caps a card at stage
2 = 2/3 mastery, so pure recognition tops out at 0.667 — recall is the only route past 0.7 **by
construction**. Nothing is gated by the score, and the thresholds are provisional. Its one exposure
is the Explore tab subtitle.

**Spaced repetition.** `srs = {deckKey: {qhash: [due, ivl, last]}}` in the v2 blob, local epoch-day
ints. One writer, `_schedule(key, q, ok)`, fed by both grade chokes. Success climbs the interval
ladder; any failure resets to 1 day. **Due-ness decides what you are SHOWN; mastery stays
stage-based and moves only on answers** — the belt cannot drop because time passed.

**Challenges** persist as `{progress, done, t}`; collectibles as `{t, context?}`. `fx()` is the
single evidence seam. Rewards are patches and joke coins: neither is spendable and neither changes
odds, score, timers, content access or opponent behaviour.

**Momentum** is a per-roll combo on consecutive correct landing answers. Wrong or ignored breaks it;
a landing that asks nothing carries it. It adds a capped bonus to `moveChance` **and**
`escapeChance` — momentum is morale, so it defends too.

---

## 9. Lists and share links

A list is a set of techniques — "what we learned in class". **Lists are stored as node ids and
shared as ordinals.** `siteIdOf` normalises to the site in the **list layer**, not at the capture
button, so a surface added later cannot bypass it: only a hub carries an ordinal, and half of all
landings stand on the partner.

**`node_ordinals.json` is committed and append-only.** Ordinals are assigned once, never renumbered,
never reused; a deleted node's entry is **retired, not removed**. A node's array index can never go
in a URL — the node list is derived from filesystem iteration order, so adding one content file
would silently renumber a link. `validate:ordinals` is a hard gate.

**The wire codec** (`neural/src/lists-codec.src.js`, pure, three consumers: `node --test`, the
browser bundle, a Pages Function). Format v2 is a version byte, a varint count, then gap-varints of
the sorted unique ordinals. The `−1` in each gap makes duplicates and out-of-order sets
*unrepresentable*, so the encoding is **canonical**: one set has exactly one spelling on every
device, which is what lets `share_id` join creator and recipient with no server state. The count
byte exists so **truncation is detectable** — clients clip long URLs, and without it a clipped code
decoded cleanly into a strict prefix of the class. v1 still decodes forever; only v2 is minted.
Decode never throws.

**Four arrivals, four different sentences:** resolvable → the offer · valid but unknown to this
build → "your app is older" · damaged → "this link is incomplete" · not code-shaped → nothing at
all. A received list is **offered, never adopted**.

On a phone nothing opens on arrival: the class is lit, the camera framed, and the offer arrives on
a standalone band control — which serves pane law better, not worse.

`_redirects` carries `/l/* /l.html 200`, a **rewrite**, so the client-side decode is the whole
experience with no Function at all; `functions/l/[[path]].js` only adds the social preview, because
link unfurlers fetch server-side and never run JS. Headers for `/l/*` come from **one place at a
time** — the Function when deployed, `_headers` on the rewrite rung — and the two must agree.

---

## 10. Sound

`neural/src/sound.src.js` owns both `NGSound` and `NG_SOUND_CATALOG`. There is exactly one audio
engine and one catalog of default-runtime sounds; never maintain a second.

The catalog documents beats that **actually fire**. Adding a mapped `fx()` beat means adding a cue;
retiring one means deleting it. Test mode records `{beat, patch, volume}` without creating an
`AudioContext`, and every noise and pitch draw goes through `app.rng("sfx")`.

`/dev/sounds/` is built from `forward/sounds/` by `scripts/build_forward_components.mjs`.

---

## 11. Chrome and layout rules

**The z ladder** (in `neural/src/helmet.html`): 1–9 ambient state chrome · 10–49 ambient fx ·
50–79 coaching · **90–99 deliberate temporary screens**. The app wrap is `position:fixed` and
therefore its own stacking context, so anything that must sit above root-plane chrome **portals to
the app root**. Esc walks the ladder top-down, pane last. New overlay → pick a band, never a loose
number.

**Fixed chrome docks off a measurement**, never a CSS constant — the tray has no fixed height and
grows upward as names wrap. `_dockLandCard`, `_dockLandFilm`, `_landDatum` (the hand ✕ docks off it
too; the film ✕ off the last thumbnail), `_bandBot`.

**Control sizes.** 24px is the pane's control figure (WCAG 2.2 AA 2.5.8 Target Size Minimum); 44px
is for surfaces a thumb uses mid-roll — the option hand, the escape hand, the landing card. Glyphs
stay small and hit areas grow via padding plus a matching negative margin, so a 44px target never
sets a 24px row's layout box. Flex `gap` measures between **margin** boxes, so control gaps must
account for negative margins. `title` is not an accessible name — use `aria-label`. Hover, active
and focus-visible states belong in CSS, never JS hover painting, which cannot express
`:focus-visible`.

**Voice.** Never the words *lambda*, *EV*, *MDP*, *utility* or *optimization* on a player-facing
surface — the axis a white belt has is sport ↔ self-defence. Never render a technique's short name
alone on a list or share surface: hundreds of nodes share a short name, and the `from <position>`
qualifier is the disambiguator.

---

*Traps that will cost you a day if you do not know them: `CLAUDE.md` §6.
Why any of this is the way it is: `docs/Changelog-Archive.md`.*
