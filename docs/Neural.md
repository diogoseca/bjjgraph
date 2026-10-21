# The Neural app — behaviour spec

How the app behaves **today**, in the present tense. This is the only place that spec exists: the
code carries the mechanism, `CLAUDE.md` §6 carries the traps, and `docs/Changelog-Archive.md`
carries the story of how each rule was arrived at. When those disagree with this file, the code
wins and this file is the bug.

Scope: `neural/src/app.src.jsx` (one imperative component),
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
| `flashcards/_index.json` | boot | the deck **manifest**: card counts by node **ordinal** + seat |
| `curriculum.json` | boot | `scoreWeightsByOrd` is what `gameScore` sums |
| `flashcards/<hash>.json` | on demand | one deck's cards |
| `content/<hash>.json` | on demand | one node's dossier, **and one page's body** (`<Name>\|Principle`, `\|Learning`, `\|System`) |
| `systems-index.json` | first read | the Systems list, then a system's record (`content/system-records/<sha>.json`); `systems.json` is build-internal |
| `concepts.json` | first read | the Principles + Learning index. Same posture as the Systems list |
| `app/reference.css` | first reference read | shared Systems and concept reference-page styles; excluded from the game boot |
| `aliases.json` | Explore/search intent | exact site IDs, own aliases and attributed family aliases; versioned URL, shared request and bounded retries |

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

`renderLandCard(node, mode, hooks)` docks `.ng-landcard` above the options tray:
**film → one three-option question → your options → complete article**. The timed card has no header,
footer, name or side. Top-right: card-layer ✕, then noninteractive grey `done/total` text.

The star beside each graph seat label opens the list picker: outline if unsaved, gold if listed.
It remains after card dismissal. Lists save whole techniques across both seats.

Three modes share `renderLandCard`: `land` for a position, `attempt` for a technique or
staged exchange, and `defense` above the escape hand. Every defending half owns its deck,
stack, paging and films (v1.227.0). Only the drill question is timed: expiry reveals a miss
without a boost or tap-out, and escapes remain available. A live catch fogs the field to
threat + seat + escapes (`_dangerSet`), frames them (`frameNodes`), and yields the brand to
the vignette. The complete linked article appears below the game controls.

**Reading and minimizing.** Articles survive grading and card replacement, with native
scrolling and 16px prose. The node's other half changes role; no role switch (D-318).
Order (D-338): Videos, Moves, Questions (no headers), then the titled sections: Overview,
principles, setup/recognition, options, safety, mistakes, the rest, Related; 6px gaps. Learning/System Sources stays
last; missing groups are omitted. Hubs include the full Top/Attacker guide; role pages add only
shared hub safety. Failed loads offer Retry.

One close icon (D-338): the card's and hand's ghost ✕, on every section's corner too. A closed
part leaves a light label (glyph above name, no box) that reopens it. Contents floats at the right-control inset, taking no layout
space. It hides at width ≤640px, height ≤500px, or a gutter below 212px (below
1152px). Its rows only navigate and dim what is closed; its heading reads role
first ("Escaping Loop Choke from Half Guard"); the Moves tray ends short of it. Arrival centres the
node above sections; scrolled prose covers it.
`readerSection.*` defaults shown, merges per key, and is edited in Settings → Rolling.

With Book shown no control turns the article, Map or Feedback off (D-338: no View menu); the logo
opens the pane, as Browse did. Book off (a saved state) keeps the restore shelf. `landFilm/Card/Hand/Map/Feedback` store normal visibility; with the article shown
the film follows `readerSection.videos`. `readerBook` controls the article.
Hidden questions are not built; hidden hands stay dealt and untimed. Card and hand publish once
the landing's article renders (≤800ms, D-351); later content never moves them. Focus is retired (D-338):
`readingFocus` and `readingCard/Hand/Map/Feedback` are not read. Restores start no play. References offer Study tools.

Content URLs and links prepare dormant controls (`NG_READING_DEFAULT_ON_CONTENT_URL`).
A move or answer starts play, without a Practice gate, prior clock or miss.
Principle, Learning, System and content-only pages have no seat. Automatic articles never pause
a move; scrolling, selection or prose focus declines the live question and pauses without a
miss. Reading keys, links, minimizing and Escape never start play or discard the
article. See [Reading delivery](Architecture.md#reading-delivery) for source and media ownership.

**A revealed answer can be put back.** `_recallBlock` builds Show / Hide / Review again / Got it
once and `paint()`s the pair the state calls for, so revealing is not destructive: you can cover
the answer and try again before committing to a grade. **Space toggles** the live block — the app
publishes it as `this._recall`, the way `this._mc` carries A/B/C — and refuses one that has left
the screen or is inert behind the pane or option sheet (`_recallLive`). An open pane owns keyboard
shortcuts; exposed landing controls still accept pointers. Grading releases the key. Space goes to a study surface and a
focused mini-row first.

**Recall comes with rank** (v1.133.0): from BLUE belt up (`_recallInPlayNow`; the WORN belt since
v1.211.0, §8 — never a Game Knowledge band), a stage-2+ card
asks as timed recall Q/A in play; below blue, recognition-first MC holds. **That rank gate prices
a question asked against a running CLOCK, and only those.** The two paused study surfaces — the
node card and the option sheet's JIT micro-drill — take `askFormat` instead: recognition below
stage 2, recall at or above it, whatever the belt. `expandOption` pauses motion and declines the
landing question, so the JIT has no clock to price. The black-belt badge
still force-enables the toggle early. **The White Challenges cue card is retired** (owner) — the
challenge engine and the pane's Challenges tab are untouched; `renderChallengeCue` survives as a
remover. **Win chance explains itself** in its tooltip and in Inspect (§4).

**Technique navigation** keeps the chosen node's camera (`camFocus`), URL (`_syncUrl`),
focus, flare and card; the roll's seat remains its origin position. `_stagedTech = {idx, side}`
uses the seat role versus `fromRole`. `_runStagedTech` consumes the `_played` latch to commit
an attacking technique through the ordinary pick path. Another commit or `clearOptions`
consumes the latch. Family hubs resolve to their most-connected member. Telemetry remains
`roll_staged {technique}` and `staged_exchange {technique, side}`.

**Every navigation starts a calm journey** (owner 2026-10-15, v1.227.0, superseding v1.134.0):
URL/reload, Back/Forward, sidebar/Browse/search, article/perspective/list/shared links, orb
clicks and manual restaging. Submission defenders receive their escape hand and generic card;
transitions keep their staged landing. Answering or starting a dormant defense also stays calm.

**Only an opponent catch from another state in the same active journey enables danger.**
`_catchProvenance` captures source and journey before travel; `clearEngagement` invalidates it.
Submission-choice waits preserve it and reject stale callbacks, even after same-seat navigation.
Deferred alias defense cannot create a catch. Live MC mechanics and timing remain unchanged:
`_panicKey` freezes the existing residency-based odds bonus independently of the displayed deck.

The sticky ✕ persists `landCard`; a background dismissal lasts one landing. Counts open nothing;
Last rolls is the study route. The generic defending card uses `_landCardChrome`, reads the
Defender article, and hydrates its own deck. Hiding the question leaves catch and escapes live.

**Paging browses the current deck.** Horizontal swipes (40px / 700ms), accumulated trackpad
`deltaX` (one page per gesture), outside chevrons and `←`/`→` call `_landPageTo(dir)`. Keys yield to pane History and
drill arrows and refuse `_landHidden()`. The retired dots/reveal pager and undeployed
`landAnswers` setting have no reader. Paging replaces only `[data-land-q]`, clamped at the ends.
The per-landing cache restores spent time and re-parents the same shuffle without another RNG draw; answered cards
return graded and disabled. Cold distractors warm through `_landWarmP` (replace-not-clear).
A capture-phase suppressor swallows synthesized clicks after movement >6px. Live defense
uses the same paging controls. Paging resets the native game scroll; Home/End read the question, while focused
article content retains native document keys.

**Every card counts; momentum and evidence once per landing** (v1.221.0). The FIRST card resolved
(answered or timed out) is the landing question: combo and `land_q_answered` (evidence), once. The k-th resolved adds row k of `NG_LAND_ANSWER_STEPS` to `_qMod` (none
past the table) and takes the same hit; a later one emits `land_q_extra {k}`. A timeout takes its
card's wrong step. Skips are free; a card keeps one clock window per landing (`_landResolved`;
`_landAnswers` drives completion). Committing after any answer fires no `land_q_ignored`.

The card **backfills**: `_landBackfill()` re-renders a live card when a late payload lands, but
only one that has never shown a question, on the current position, with a live decision window —
re-mounting an answered question would hand out a second attempt at credit already scored.

The film has one `.ng-landfilm` host, moved between game and article slots (see Reading
delivery). Its ghost ✕ (`data-film-close`) hides while a clip expands. The row scrolls like the
hand: no scrollbar, earned fades (`_syncEdgeFade`), and `data-film-prev/next` chevrons toward
hidden clips. `_filmPage` glides about one view; end padding is 1x the side-padding token and
fade 3x. **Technique films** come from `perspectives.{attacker,defender}.clips`; the node's fixed half
selects them on reader/link arrivals and live catches. `renderLandCard` assigns `_landIdx`
before selection. Missing or unauthored defender clips show no reel and never borrow another
half's content. At v1.227.0, 285/290 concrete submissions have defender clips. Gaps: Americana,
Armbar and Kimura from Triangle Control; Achilles Lock from Inside Ashi-Garami; Suloev Stretch
from Half Guard. All five have authored defender blocks; no clips were added.
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

### Executing and inspecting an option

Clicking an own option or pressing its plain digit (1–9) commits it once. The focusable
**Inspect** button and **Shift+1–9** open its existing detail sheet without committing;
shifted keys use their physical Digit code so keyboard layouts do not lose inspection.
Enter/X still executes from that sheet. Escapes obey the same contract (v1.218.1, owner: "it's a
choice i just chose, not to inspect but to move"): the card and its digit play it; Inspect and
Shift+digit inspect it. Threats are the opponent's moves and stay inspect-only. Both inspect in the
one option sheet (v1.220.0, `_stateChoiceSheet`), with the submission's safety notice and guide.
Hidden hands, checkpoints, text entry and the visible quiz retain keyboard priority. Closing
Inspect restores the pause state it found.

After commit, the live hand is cleared and a non-actionable copy of the chosen card remains,
exactly where the card was (the row's padding, i.e. the open pane, comes off its offset), escapes
included (v1.218.1; they used to clear the hand and show nothing). Its face rises 1/12 of its
height and settles (`_placeOnTable`, 0.44 s, none under reduced motion); its holder never moves.
The execution handoff retains the measured row position and game height through its result;
the same dock supplies fixed-layout callers. Resizing or reading releases the reservation.
It keeps the displayed odds and shows Executing, then the actual Landed, Failed or Countered
result. Submission entry shows Entering and remains deterministic; it does not acquire a roll
or a new interpretation of its printed odds. The existing sweep lasts **1.08 seconds** and
uses the same probability and conditional outcome draws. Its band and needle use the drawn
orb coordinate, and its progress pauses with its verdict timer.

Execution owns the announcer and frames the whole painted pair/name in free 2-D space,
retaining above-card bounds where that band exists and the clicked rectangle within 2px.
Reduced motion snaps the camera; pan, pinch, wheel or a focus lease releases it. Arrival,
opponent handoff, round end, restaging and teardown clear card/announcer ownership; replay
borrows the announcer. `tests/roll_execution.test.mjs` pins source behavior;
`e2e/journeys/roll-execution.spec.ts` measures real input and painted clearance in a browser.

### The option sheet preserves the inspected card's anatomy

The sheet keeps the tray digit/category glyph and 10px category label, with the technique's
own 27px name and separate `from …` qualifier (`catGlyph`, `splitName`), and carries the Win
chance detail (§4); the accessible name remains the technique name. The "on success, advances to" line appears only when `titleParts` is null:
`opt.res` is a deal-time first-neighbor heuristic, not an authoritative destination.

The sheet is portalled to the root coaching plane at z:50. The landing card stays visible
behind it. Verify actual paint order with `elementFromPoint`; `option-edge.spec.ts` and
`coldstart-backfill.spec.ts` pin this behavior. Historical layout failures are in the archive.

### The commit hands the camera to the roll (v1.135.1)

`userActiveNow()` (4 game-seconds since `lastInteract`) is the ONE condition that suppresses the
follow-cam — and the pick's own click wrote it, so the camera stood still while the pulse left.
`enterAttempt` ages the latch out and releases any focus lease: committing is the ownership
doctrine's "asking to go somewhere else is a decision" case. Execution framing then owns the
technique and result until handoff or a deliberate camera gesture. The previous follow-cam
regression remains covered by `roll-card.spec.ts`; the execution cases live in
`roll-execution.spec.ts`.

### The panic drill is multiple choice (v1.135.0)

The shared defending card uses `_mcBlock` on surface `"panic"` (`data-panic-mc-opt`, RNG tags
`panic-mc-pick`/`panic-mc-shuffle`), preserving its knowledge/telemetry identity. The separate
renderer and red skin are retired. Defense always uses MC despite the in-play recall preference.
Correct answers pump escape odds and deal the next card; wrong answers reveal without a boost
and break momentum. Expiry reveals a miss. Reveal/Got-it is the cold-pool fallback, with one
warm-upgrade attempt per deck. Seeing the answer permanently prevents that upgrade, even
after Space hides it or paging brings it back. The "+7 Tilt toward winning" legend retired; the meter is 165×7px.

**Danger animation**, beside Answer time in Rolling, uses permanent boolean `dangerAnimation`
(default `true`). Off removes pulsing edges and card warnings, retaining static catch status,
countdown and mechanics. Reduced motion also suppresses frame-driven glow without changing
the saved key. Pressure, settings, progress receipts and a cached motion-query change listener
synchronize visuals only when the effective state changes; frame ticks still drive the clock. Sound/volume still govern caught and expiry cues; no heartbeat audio loops.

### The pair label (v1.135.0; compact qualified stack v1.173.2)

The pair label group anchors at the pair MIDLINE — "the name never moves". A role word adjacent to
the headline **rides its orb**: `subY = min(nameY − clearance, orbY + 4)` above (mirrored below), so
a wide split binds TOP to the blue orb it names instead of the red bottom orb. One exception keeps
a qualified lower label legible: `from …` and DEFENDING/ESCAPING are adjacent subtitle rows, one
`NG_LABEL_LEAD` apart, rather than letting the lower role chase its orb and open a large hole in the
stack. At merge scale `richLabel` preserves the same short headline plus qualifier row; zoom never
recomposes `from …` into the title. Geometry is published through `_lastPairLabel` and
`_lastRichLabel`; the pair behavior is pinned by `dual-pair.spec.ts` and `graph-naming.spec.ts`.

### The turn-based shell

A move needs an explicit commit. There is no transport or Space-to-pause control; live history
rows have no pause button. `setPaused` controls internal motion: staging pauses, committing
unpauses, and an open pane freezes travel.

Click empty sky once to decline the card freely while retaining the hand; click again to
archive a played roll, clear the tray and enter free roam centred on the current position
(`_enterRoam`, `roam_entered`). A node click stages fresh. This gesture affects only the current
landing (`clearLandCard`); the layer ✕ handles persist preferences through `setLayer`.

A staged technique's own option gets the action accent and commit verb ("Finish it" for a
submission, "Execute" otherwise), with its deal position preserved (`_highlightStagedCard`).
Commit executes in place with pulse path `[tech, tech]`; the pair label names the action.
Arriving on or clicking the defending orb opens the generic defending card and escape hand
calmly. Only an in-roll opponent catch enables the vignette and defensive question clock. The meter reads Win (blue) left and
Lose (red) right, mirroring `adv.cur`; category tracking is .05em so SUBMISSION fits.

### The hand

`optionsFor` deals **every legal move** — origin-filtered (or a `deal_here` listing, wire `alsoFrom`) and role-filtered, uncapped — ranked by
EDGE, then sorted ONCE by Win chance (§4). The order is otherwise **frozen at deal time**: `ord` and `ordOdds` are stamped once, and `_cmpDealt`
compares only stamped values (EDGE desc → odds desc → attempt% desc → name asc, unvalued last and
never as 0). A just-in-time grade must move the printed numbers and must never re-sort a tray the
player is already reaching into.

Marks: **shape** = category (circle position, triangle submission, diamond transition) · Win
chance · bottom-right = the immediate chance; a threat card's colour is your win chance.

The clock times the QUESTION, never the hand (v1.133.0, owner: "pressure should not be on the
choices … the choices are fun to click"). `decisionSec` (the "Answer time" slider, 5–15s, flat —
the v1.123.0 Hick's-law knee died with the hand clock) arms when a question mounts
(`_armLandClock`) and drains a 3px bar on the card's top edge (neutral, red at ≤3s, "Answer
3…2…1" in the announcer). Expiry (`_expireLandQ`) reveals the answer as a MISS — correct option
highlighted, a failed SRS review, −4% and momentum broken (a later card: its smaller step) — and
the hand stays
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
ledger (`explore` in `_mcBlock`). A landing that asks nothing has no clock at all. The option cards' bottom bars are static — nothing on the hand drains. Deck warm-up takes the hand's first `NG_PREFETCH_CAP` cards

The tray scrolls by wheel (larger of `deltaX`/`deltaY`) and by mouse drag (mouse only — touch is
the platform's job); the "see more" hint that also scrolled it was deleted in v1.173.0. A drag
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

**Hesitating costs nothing but the question.** The v1.129.0 hand-over on expiry (`hesitated`)
was retired in v1.133.0 with the hand clock: expiry is a missed answer, never a lost turn.

### The announcer

One slot, stamped owners. **The landing question's outcomes are not in it** (v1.218.0, owner: the
toast was distracting and "−4%" read as "wait, what?"). They land on the cards (`_outcome`): each
"Your options" card whose printed chance moves takes a hit — red flash and recoil for a cost, green
glint for a gain — and the REAL before/after delta pops off its number with the card's own word for
it, "−4% move" (`_cardHit`, hooked in
`paintChoiceValues`, so a card that does not move takes nothing; threat odds never move, so threats
never take one). The cause is named once, rising from the measured "Your options" label ("too
slow", "missed", "that one hurts", "correct"; a broken streak stacks "×N momentum lost"), with one
polite aria-live sentence. Wall-clock CSS, `pointer-events:none`, z 16; reduced motion keeps the
flash and the number change only. That retired v1.138.0's expiry lease (`_evExpiry`): nothing
outcome-shaped is left to pin. And **one subject per label**: the announcer names
**who is initiating** ("You go for" /
"Opponent goes for"), and the graph verb names **your posture** toward that move. They can never
contradict because they answer different questions. Whoever writes the slot owns its lifetime —
`_tickDecision` stamps `_evCountdown` when it writes the countdown, every other `setEvent` releases
the stamp, and `clearOptions` drops the line only if the stamp still stands.

---

## 4. Win chance — the number on every card (v1.207.0)

**Win chance** is the chance you win this roll if you take this move and then keep choosing the
best moves, against the game's own opponent, counting what you have studied: an MDP solved in a
deferred worker (`game-model.worker.js`; mechanics under `static/neural/mdp/`) over the LIVE rules —
seats, gi/no-gi, move counter, momentum, sharpness, question penalty, belt verdict, `opponentDefend`. Objective `max-win/min-loss/min-nontermination`. Practice moves odds and forward
value through ONE module (`knowledge-profile.src.js`), so a correct answer moves the numbers.

- **Card**: Win chance plus the immediate chance (Move / Finish / Escape), which leads: Win chance
  is 0.6 of its size (`NG_CARD_*`, v1.220.0), on the Inspect sheet too. A stale number (dimmed while
  the hand re-solves) also reads "52%…" and is announced "…, updating". A submission dealt on a
  position is an ENTRY: stepping in is certain, so its small line is **Works** and the chance of the
  finish it leads to, as the landed state will roll it (the adapter's `followUp`) — never the
  step's own 100% (v1.213.0, owner 2026-10-01). Inspect shows the same number and says the step
  in words. The best card is **Suggested** (certified) or **Recommended** (exact). Tooltip and
  Inspect decompose it exactly,
  `P(lands)·[win | lands] + P(misses)·[win | misses]` from the engine's own rows (`ngMdpSplit`),
  then submitted and no-tap; a split that does not reconcile is dropped.
- **Order**: dealt by EDGE, **sorted once** by Win chance when every card has one unless touched
  (`_handTouched`), never again; ties keep the dealt order.
- **Threat cards**: YOUR win chance if the opponent tries that move now (threat probes,
  `threatIds`; on your submission, their escapes), most dangerous first. Defending: V(s).
- **Legend thermometer** = V(s), the root of the same solve (`_paintWinThermometer`), painted only
  when every card has a value: there **best card = V(s)**. Between decisions it holds, dimmed.
- **"—"** keeps the move playable: pending, failed, or over admission (40k states, 400k branches,
  10 s build, 15 s solve). Values follow the first hand (5.6 s, measured desktop).

EDGE (`cal.ev`) is no longer printed: it is the dealt order, FLOW's feature and the opponent's
tie-break. The wire
ships one block (`evLam = [2]`); **"Winning vs not losing" is retired** (owner) and the stored
`lossAversion` key is never read (CLAUDE.md §6.6).

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

**Honesty.** EDGE describes the corpus's opponent: `opponentDefend` never reads
`attemptProbability` (from standing, no-gi, P(I finish) 0.35 vs the corpus's 0.72;
`scripts/semantics/app_game.py`). Win chance plays `opponentDefend` itself: a model probability
under authored rates, not validated on real rolls.

---

## 4b. FLOW — what a DECK is worth (v1.138.0)

**`GAIN(deck) = V₀(you, that deck mastered) − V₀(you, now)`** ranks weak spots, the daily
dose and study queue. EDGE prices a move; FLOW evaluates the played policy π, not EDGE's
argmax policy. Kernel: `neural/src/flow.src.js`; reference: `scripts/solve_flow.py`
(`npm run validate:flow`).

The kernel uses the ruleset's hands (`cal.ev` / `cal.evGi`), rates and outcomes, renormalised
per state. Start: uniform for Anywhere/My weak spots, both Standing seats otherwise.
An adjoint sweep estimates derivatives; the displayed shortlist is re-solved exactly.
Negative gain is a backfiring class. Tiers share current recoverable value; mastered decks
score zero. Personalisation shrinks to the prior (`pseudo_count = 8`); `resolve()` records
per-device G-Counters. Game Knowledge weights attackers, defenders and positions.

History: [archive](Changelog-Archive.md), v1.138.0, v1.145.13, v1.209.0.

## 5. The pair

Visual glossary; game states: GraphSemantics §12.

| Term | Meaning |
|---|---|
| **Site** | Named position/technique at one ground point; exchange, joint node or visual hub. |
| **Pair** | Its two perspectives; also dual pair, twins or sides. |
| **Half / member / role-node** | Runtime node with fixed role, base colour and deck; role-node is the model term. No half-circle implied. |
| **Seat** | Contextual position role (`playerRole`), resolved through `fromRole` for a technique choice. |
| **Performer / opponent** | Performer attempts; defender receives; either may be on top. Opponent is player-relative. |
| **Representative / partner** | `rep` is top/attacker; `pi` joins its bottom/defender partner. No strength ordering implied. |
| **Upper / lower** | Rep above, partner below with depth shade `colU`. `seatWord`'s “primary” means rep. |
| **Hub** | Qualify: edgeless `graph.json` content aggregator, collapsed layout input, or zoomed-out site orb. |
| **Orb / glyph** | Rendered half/site: circle = position, diamond = transition, triangle = submission. |
| **Pole / base strength** | `n.dom`: own `s[si]` when present, else title heuristic `dominance()`. Positive blue, negative red, zero grey; fixed strength, not live Win chance or knowledge. `n.col = domColor(n.dom)` remains the base. |
| **Mastery** | `deckMastery`: mean `min(stage,3)/3` over cards, not P3 bonus `mastery(key)`. Gold is knowledge. |
| **Site mix** | Equal pigment weights from both halves, regardless of deck size, degree or rep. |

| Category | Rep role / deck suffix | Partner role / deck suffix | Existing pair words |
|---|---|---|---|
| Position | top / Top | bottom / Bottom | TOP / BOTTOM |
| Transition | attacker / Attacker | defender / Defender | ATTEMPTING / DEFENDING |
| Submission | attacker / Attacker | defender / Defender | FINISHING / ESCAPING |

Role fixes perspective, not pole. `seatWord` owns pair copy; travel words name posture.
Chooser/article wording is unchanged.
Merged = one orb (`kLOD=0`); mitosis = separation (`0<kLOD<1`); split = two (`kLOD=1`).

`_deriveDualPairs` runs at ingest. Rep keeps hub id/ordinal/URL; partner adds `/Bottom` or
`/Defender`, no ordinal. Kind-1 edges re-key to members; `rSite` recovers radius. Kind-2
`adj` shares site techniques (ties/order may differ); never role-split it. `deg` is geometry,
`siteDeg` the site. Both halves retain `cal.ev`. `?dual=legacy` is retired; only test rail
`noPairs` keeps the control.

**Strength/coverage register.** Recompute:
`npm run regenerate:neural && node tests/artifacts/mastery_gold_survey.mjs`.
v1.225.2 exceptions: **empty**. All 2,896 halves / 1,448 sites have strength and decks;
no unresolved/duplicate keys. The survey names missing halves/keys.

| Category | With deck | Without | Cards |
|---|---:|---:|---:|
| Positions | 266 | 0 | 2,608 |
| Transitions | 2,050 | 0 | 14,547 |
| Submissions | 580 | 0 | 4,606 |
| Total | 2,896 | 0 | 21,761 |

The survey's visible position/transition/submission halves: gi 242/2,050/580, no-gi 220/1,872/510.
All have decks and shared knowledge. Resolved heuristic entries:

| Former attacker entry | Former defender entry |
|---|---|
| Fireman's Carry — Attacker | Fireman's Carry — Defender |
| Counter Entry to Opponent's Leg — Attacker | Counter Entry to Opponent's Leg — Defender |
| 100% Sweep — Attacker | 100% Sweep — Defender |

All now use strength; no application allowlist.

**Mastery gold.** Flashcards → **Turn what you know gold** (`masteryGold`, default false), helper:
“The map turns gold as you master each side's flashcards. Full gold needs recall.”
Persists/merges per key. Half key: `ngWireDeckName(node) + "|" + capitalized(node.role)`,
never played seat. Missing/empty deck = `null`, unstudied = `0`; manifest counts work unhydrated.

`mastery-gold.src.js` uses a quadratic Bernstein palette of the existing grey/blue/red
pigments and crown gold `#F0C05A`. Blue/gold and red/gold controls produce green/orange;
blue/red stays purple/grey. For clamped strength `d` and mastery `m`, weights are
`[(1−|d|)(1−m), max(d,0)(1−m), max(−d,0)(1−m), m]`. Sites average weights, never final RGB.
Zero/missing mastery returns runtime `n.col` directly, including fallbacks.

Overview mixes both halves (`NG_MIX_SITES_BY_DEFAULT = true`).
Off keeps base/depth-shaded halves and the historical player-perspective focus/rest
colour (`myColor`), including a previous-roll replay and late Off. On uses gold-adjusted
weights. `kLOD` blends the shared site mix to those endpoints. Opposite technique poles
share purple-grey.

Palette warms after the first playable hand paints (idle, 1s deadline), even in Settings; base paint holds.
Cache rebuilds at ingest, toggle and `_publishKnowledge` (manifest/hydration,
grades, progress load/merge). Imports use current settings/evidence; frames interpolate
cached endpoints. Canvas, edges and focus/resting glow use paint.
DOM glyphs, labels, advantage chrome and `n.col`/`n.colU`/`myColor` stay unchanged;
so do belt, Win-chance, Suggested, posture, success and tension meanings.

`tests/mastery_gold.test.mjs` pins OKLCH anchors at 1/3, 1/2, 2/3: blue/gold 125–170°,
chroma ≥0.10; red/gold 40–80°, ≥0.12. Journeys pin mouse/draw/reload and default boot bytes.

**Labels.** `pairGroup` pins name/qualifier at the midline; roles ride their halves except
qualified lower roles join the subtitle stack. `richLabel` retains name/qualifier at merge;
`graphName` never bakes in role.

---

## 6. Camera

`rollCamTarget(f, moving)` is the single seam for framing. Vertically it centres the node's **label**
in the visible graph rect (`_viewRect`: beside the pane, below the announcer, above the highest
showing row; `frameNodes` fits into the same rect) — measured, never a constant, and before a
landing's rows mount it frames into the band they will leave.

The camera has velocity (v1.219.0, `_camStep`): a new destination is an eased flight (zooming
out for a long pan), tracking is a damped spring, and a row that mounts unannounced is cleared
within 0.35 s, never in one frame.
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

The card, videos, article and camera shift beside the pane with the choices. The article fits
the free width; game-control overlap paints beneath the pane. Phones retain the overlay drawer, and short landscape
retains its two columns. Closing restores the layout without resetting the card or reading position.

**Pane law: the pane is manual-only.** Nothing in the roll loop opens or closes it. **Open = the
game stops. Close = the game resumes, but only if the pane is what stopped it** — one latch
(`_paneAutoPaused`) for the whole pane, taken in `applyDeckVisibility` rather than `setDeckOpen`,
because several study entry points assign `deckOpen` directly. A hand-paused roll stays paused.

Every pauser owns its own latch — `_paneAutoPaused`, `_replayAutoPaused`,
`_dossierAutoPaused` — so releasing gives back only the pause you took, transferring it to any
still-open pane or replay. Reading holds play until a move or landing-card answer.

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

**Explore** — sections start collapsed and persist their folds. Search ranks results before sections;
filter to `rep` to avoid duplicates. Lists sit first and use the
shared three-rung indent. Your lists folds like the other six (v1.196.1, key `Your lists` in
`exploreOpenSections`; an absent key is closed, so existing users need no migration). The one
difference is `_revealLists`: making, adding to or restoring a list, or a saved class lit by a
share arrival or the cue, opens the section for the session without writing the map — the older
rule that you SEE a technique land after adding it. Systems have counted topic branches and indented leaves, like position
families. Topic folds start collapsed, stay independent, and survive detail/back navigation and
section folds for the session.

**A page-shaped entry (Principle · Learning · System) opens as a READ.** The deferred index
(`concepts.json`, `systems-index.json`) carries the card and the ids it lights; the body rides the
on-demand chunk a node dossier already uses, keyed `<Name>|Principle|Learning|System`, drawn by ONE
renderer — `_bodyDocHTML`, with `NG_DOC_LABELS` naming each library's blocks (no label, not drawn).
A cached `null` is a MISS here, never an answer: `_docBody` forces one re-read per key per session
and `_hydrateContent` retries a transport failure (`NG_CHUNK_TRIES`) while still caching a 404.
Principles lead with a short definition and practical overview. Independent disclosures preview
3 key points, 2 examples, 2 mistakes, and 1 drill. Section headings separate groups; entry labels
stay close to their explanations. Related concepts precede the collapsed technique browser,
whose rows show names and position/role qualifiers without repeated applicability descriptions.
The principle sidebar has no coverage boilerplate or link back to its own page.
Principles with curated clips show Film study immediately below the title and summary. Clips
arrive with the deferred body, use the shared thumbnail row/player, and put Shorts first. They
play only on activation, award no study credit, and stop when the reading panel is rebuilt or
left. A principle without clips has no empty Film study section.
Learning pages carry their complete edited content in that deferred body: application outcomes,
optional self-assessment and sources included. Independent disclosures initially show 3 takeaways,
2 examples, 2 mistakes and 1 exercise. Related reading precedes the collapsed technique browser;
sources come last. There is no link back to the same page to obtain missing content. Disclosures
and scroll survive background hydration and ruleset changes; a new reading visit starts at the top.
Loading failures show an explicit retry. Optional `title` labels are editorial: canonical `name`,
route, dossier key and analytics identity remain unchanged. Self-assessment does not score a deck.
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
describe material difficulty, never rank or access. The frontier belt (first belt with lessons
left) drives navigation — the open section, the arrival scroll, the cue; the tab belt is the belt
you **wear** (§8), never the frontier, which painted a finished player white. Nothing re-locks.

**Every inline deck answers the same four keys** (v1.175.0). The roll history's rows, the session
queue and the corridor's lesson decks all register the same `_miniReg` handles, so `←/→` page
cards, `↑/↓` walk techniques (in the corridor: the ladder's lesson rows, in ladder order, skipping
folded belts), `Space` flips and `⏎` grades *Got it* and walks on. The corridor was
the one surface with none of it: `openMini` never claimed `_focusRow`, so there was nothing for the
keys to resolve — and because the ladder is built entirely out of buttons, `Space` after a click on
▸ went to the ▸ and shut the deck. **Opening an inline lesson deck therefore moves focus onto the
deck BOX** (`tabindex="-1"`), which owns neither activation key, leaving Tab-then-Space on a lesson
row exactly as it was. A corridor repaint — any evidence beat, and a grade fires one — rebuilds the
registry with the rows it indexes and re-opens the deck that was open, on the card it was on;
`_miniDeck` grades AFTER walking the deck on, so the rebuild paints the card the player is owed
rather than a dead one.

**Every ▶ asks, and the seat is the player's** (v1.197.0, owner: "it says we start on top, but what
if i wanted to start on bottom?"). `confirmPlayFrom` — behind an Explore or list row's ▶, the option
sheet's "Play from here" and a Last-rolls ▶ — offers both seats with the derived one preselected,
so an untouched Start plays what it always did: Attacker / Defender for a technique (Defender is the
other side of the same origin position, and the sheet says so), Top / Bottom for a position. The
title names only the place ("Roll from Half Guard?"); the seat is the "Play as" control plus the
body's side word. Start passes an explicit role and `_seatMember` seats you on the orb that plays
it, so the URL (`…/Bottom`) re-seats you on reload. Esc closes the sheet alone, and keys pressed
inside it stay there (⏎ used to reach the option sheet below and commit its move). A graph tap
needs no sheet: the pair's two orbs are the seat choice.

**Last rolls** — roll history with inline decks, plus per-row ▶ (stage a roll from that state, on
the side it was played unless you pick the other, clock held) and ⟲ (replay). History is in memory
and has never persisted.

**Every roll you played reaches the shelf, and the shelf repaints when it does (v1.174.0).**
`_closeRoll()` is the ONE seam the three roll-enders call — `startRoll`, `rollFromPosition`,
`_enterRoam` — and it archives, clears `rollLog`, emits `roll_archived` / `roll_discarded`, and
refreshes the tab through `_refreshHistoryRows()`. A roll counts if it ran (`_played`) and either
visited two states, reached a verdict, or had a move committed in it (`_rollActed`): so the
one-exchange roll — you finish from the state you opened in, or get caught there — is kept and
titled by its FINISH via `replayEnds`, while a board that was only staged and abandoned still
files nothing. The archive records the earlier missing-history and stale-tab defects.

**A replay is a film of a roll you already rolled.** It credits nothing — `_replayBeat()` pushes to
the beat stream and stops, deliberately not through `fx()`, which is the challenge-evidence seam.
Any real input ends it. It holds the clock on its own latch and never touches the pane.

---

## 8. Progress

**Progress is stored per owner** (v1.207.0): `bjj-neural-owner:<guest|account:id>:*`. A guest's
first load adopts the old unowned `bjj-neural-progress` and its markers once, keeping the bytes; an
account imports it only on request (`progress-owner.src.js`). **Local-only** (v1.207.8+): a signed-in
device whose SDK cannot load, or cannot check its session, plays that account's local copy under a
banner, never pulls or pushes, and on re-verify merges before a push (`_renderLocalOnly`).

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

**Nothing about the score decays.** `deckMastery` moves only on answers — the score cannot drop
because time passed (a failed card can lower it; it can never lower a belt, below). Retention-vs-pressure gets decided in `_schedule` (SRS intervals: *what you
are shown*), never in what a deck is *worth*.

**Wire.** `curriculum.scoreWeightsByOrd` is `{div, p:{o,r,gi,nogi}, t:{o,gi,nogi}}` — each seat
once by node **ordinal** (v1.204.3), one int array **per ruleset**, each `t` entry carrying **both
seats**. `ngWireScoreWeights` (`wire-keys.src.js`) is the one expander; the emitter
round-trips it per frame and refuses if the mirror stops holding. Per ruleset (v1.146.0): 52
techniques are attemptable only in gi — the default — and 16 only in no-gi, so a folded no-gi solve
scored them 0 in both seats (**104 decks, 739 cards**). `o` is the union, a **zero means "not
attemptable here"**, and `frame` is REQUIRED — a default is how that survived 77 versions. `gameScore` memoises on `(_stageVer, frame)` and the expander per frame, or the first read
pins one ruleset for the session. Gated by `validate:score-coverage -- --gate`; coverage is now **99.66%**.

**Game Knowledge is a percentage and decides no belt** (v1.211.0, owner). Its bands (white .20 ·
blue .40 · purple .60 · brown .70 · black .80; MC caps a card at 2/3, so recognition tops out at
0.667) were the knowledge belt and gated recall in play and the Recall Mode lock while this line
said "nothing is gated by the score". They now decide nothing; the grandfather reads them once.

**The belt you wear** (`wornBelt()`; rule and merge in `belt.src.js`). Everyone starts in white;
you wear the belt AFTER the last belt, in an unbroken run from white, whose units are all proven
(live lessons done + checkpoint); clearing black leaves you black, four stripes. Stripes are the
worn belt's proven units, 0–4; the capstone stays an optional patch. Readers, all of them: the tab
belt, recall in play from blue, the Recall Mode patch and Settings lock at black, and the email's
"Next belt" line (`dayLog[day].b`, read by `workers/digest`).

**It never falls.** `belts.held` (v2 blob) is a high-water mark that `_syncBelt` raises at every
evidence seam (`_publishKnowledge`, a checkpoint pass, curriculum and manifest arrival, both sides
of a ruleset flip), so a gi ↔ no-gi flip, a failed card, a curriculum edit or a stale device lower
nothing; a belt below the held one counts as proven. It merges as **MAX by rank**
(`ngMergeHeldBelt` in `_mergeProgressFields`, whose `belts` assign keeps only local keys), never as
a settings key. **The grandfather** (`belts.gf`, once): `held` = max(the old tab colour, its
all-done case read as black; the band; the rule), both rulesets, marked once the manifest is
resident; the mark survives a merge only when both sides carry it, so a pre-v1.211.0 device's
progress is grandfathered again. Gated by `tests/belt_worn.test.mjs`, `belt-worn.spec.ts`.

**Spaced repetition.** `srs = {deckKey: {qhash: [due, ivl, last]}}` in the v2 blob, local epoch-day
ints. One writer, `_schedule(key, q, ok)`, fed by both grade chokes. Success climbs the interval
ladder; any failure resets to 1 day. **Due-ness decides what you are SHOWN; mastery stays
stage-based and moves only on answers** — the score cannot drop because time passed.

**Challenges** persist as `{progress, done, t}`; collectibles as `{t, context?}`. `fx()` is the
single evidence seam. Rewards are patches and joke coins: neither is spendable and neither changes
odds, score, timers, content access or opponent behaviour. A notice waits while a move executes and
shows once it lands.

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

**Dock from measurements.** `_landDatum` measures the hand; fixed card/film writers yield to
the reader's shared native scrollport. Its measured shelf clears corner controls; the hand ✕
hugs the last choice and the film ✕ the last thumbnail. `_bandBot` keeps the tightest observed
play band. The [reading layout contract](Architecture.md#reading-delivery) defines the media
slots, outside arrows, coalesced layout and optional `readerChromeFrame` hook.

**Control sizes.** 24px is the pane's control figure (WCAG 2.2 AA 2.5.8 Target Size Minimum); 44px
is for surfaces a thumb uses mid-roll — the option hand, the escape hand, the landing card. Glyphs
stay small and hit areas grow via padding plus a matching negative margin, so a 44px target never
sets a 24px row's layout box. Flex `gap` measures between **margin** boxes, so control gaps must
account for negative margins. `title` is not an accessible name — use `aria-label`. Hover, active
and focus-visible states belong in CSS, never JS hover painting, which cannot express
`:focus-visible`.

**A row of tabs never decides its panel's width** (v1.196.1). Settings' tabs are one declared list
(`NG_SETTINGS_TABS`), rendered as a real tablist by `_settingsTabRow`. ←/→ wrap and Home/End jump,
each selecting on arrival, and none of these keys reaches `_onKey`. Opening Settings focuses the
active tab, and Esc still closes it. The tabs use one scrolling row: all five tabs
fit the 440px card, and a phone scrolls, centring the active tab. An edge fade (`data-fade`) dims
a side only while a tab is hidden past it. A new tab row copies this, not the pane's fixed
three-column grid, which cannot take a sixth tab.

**Voice.** Never the words *lambda*, *EV*, *MDP*, *utility* or *optimization* on a player-facing
surface — the axis a white belt has is sport ↔ self-defence. Never render a technique's short name
alone on a list or share surface: hundreds of nodes share a short name, and the `from <position>`
qualifier is the disambiguator.

---

*Traps that will cost you a day if you do not know them: `CLAUDE.md` §6.
Why any of this is the way it is: `docs/Changelog-Archive.md`.*
