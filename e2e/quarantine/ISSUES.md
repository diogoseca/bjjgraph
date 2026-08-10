# Gameplay issues found by the test-generation waves

Real bugs / UX mismatches discovered while agents played the app. Each entry pairs with a
**quarantined red spec** in this directory — a failing test that becomes the ready-made
regression proof the moment the bug is fixed (run `npm run e2e:quarantine`; a spec going
GREEN means its bug is fixed → move the spec to `e2e/gen/`, flip its ledger entry to
`accepted`, and mark the entry below Fixed).

Tags: `bug` (broken behavior) · `ux-copy` (stale/wrong copy vs actual mechanics) ·
`design-question` (behavior unclear — owner call needed).

Format per entry:

```
## QNNN — <one-line title>   [tag] [status: Open|Fixed|Wontfix]
- Spec: e2e/quarantine/<file>.spec.ts (absent for ux-copy/design-question entries)
- Found: wave N, <persona> at <feature>
- Expected: ...
- Actual: ...
- Notes: repro details, suspected cause
```

---

## Q001 — SPA soft-nav teardown never flushes the debounced save: last ~400ms of progress silently lost   [bug] [status: Fixed v1.67.4]
- Spec: e2e/gen/spa-nav-inflight-progress-survives.spec.ts (promoted; green since the fix)
- Found: wave 1, whiteBeltHolder at spa-nav
- Expected: a card graded moments before a Quartz soft navigation survives into the remounted
  instance — teardown flushes the pending debounced write (mirroring the pagehide/visibility
  flush), so life 2 boots from storage that already carries the grade.
- Actual: `destroy()`/`componentWillUnmount` (neural/build/build.mjs:116-122, app.src.jsx:74-86)
  neither calls `_flushSave()` nor clears `_saveT`. On the PROD save branch (400ms debounce,
  app.src.jsx:1117) the remounted instance loads STALE storage — the grade is missing from its
  prep map; the orphaned life-1 timer lands the write ~400ms later, and life 2's FIRST save
  clobbers it back to the stale value. The grade is permanently lost. Probe evidence
  (wave 1): `{key:"Mount|Top", prep0:3, storedAtNav:3, life2mem:3, timerLanded:true,
  final:{stored:3, mem:3}}` — expected 4 end-to-end.
- Notes: invisible under the harness default because `isTest()` short-circuits `_saveProgress`
  to a synchronous write (app.src.jsx:1116); the red spec forces the prod branch by overriding
  `_saveProgress` with a faithful copy minus that one line. SPA navs never fire `pagehide`, so
  the boot-time flush listeners (app.src.jsx:341-344) don't cover this path — browser Back
  (popstate → navigate) and any internal SPA link hit it. Belt wins / checkpoint passes are
  safe only because those milestones call `_flushSave()` directly (app.src.jsx:3503/3788/3794);
  at risk are ALL debounce-only writes: prep bumps, rec (recall/mastery) grades, daily counter,
  settings. Suggested fix: call `this._flushSave()` at the top of `componentWillUnmount()` —
  flush also clears `_saveT`, so the orphaned-timer late write disappears too.

## Q002 — Checkpoint quiz doesn't stop the roll's decision clock: the roll auto-plays underneath and clobbers the live quiz UI   [bug] [status: Fixed v1.67.7]
- Spec: e2e/gen/mid-checkpoint-quiz-untimed.spec.ts (promoted; green since the fix)
- Found: wave 4, curriculumMid at decision-timer
- Expected: the checkpoint quiz is untimed — with a quiz open, pumping sim time far past the
  decision window fires zero expiry_warning / zero auto_pick, `_checkpoint.i` only moves on
  answers, and the quiz card stays answerable. Time pressure is a roll-only economy; every
  other reading surface honors this (expand sheet pauses :1497, explorer auto-pauses :2610,
  dossier pauses :2807, coach freezes the clock :4317).
- Actual: `startCheckpoint` closes the explorer to show the quiz (app.src.jsx:3480) →
  `toggleExplorer` releases the explorer's auto-pause (:2597) → `paused=false` with the
  pre-quiz hand's decision window still live and `_tickDecision` (:4315) having no
  `_checkpoint`/`deckShown` guard. Probe (2 runs, identical through baseline): quiz open at
  `remaining≈15.8s`, and a 45s pump fired expiry_warning ×6-7 + auto_pick ×2 — the roll
  auto-played moves UNDER the quiz (commit → sweep → impact; run 2 cascaded into
  opponent_attack → defend_start → caught → panic_drill_opened, i.e. the PANIC DRILL opened
  over the checkpoint). Each background land calls `buildDrillPanel` (:4281) which, with the
  deck shown, `renderDrillHome()`s over the live quiz card: `[data-mc-opt]` count drops to 0
  and `_drillView` flips to "home" while `_checkpoint` stays truthy at i=1 — the quiz becomes
  an unanswerable zombie. Closing the deck then cancels it as "abandoned" (:942). The narrow
  half of the law DOES hold: `_checkpoint.i` never moved (auto_pick picks a roll move, never a
  quiz answer) — the breakage is the clock running at all, plus the UI clobber.
- Notes: repro = boot curriculumMid → land Mount Top (coach dismissed → clock live ~16.2s) →
  drill unit-2's remaining lessons → toggleExplorer → click `[data-checkpoint="white/side-control-escapes"]`
  → answer 1 card correct (i=1) → advance ~12s → first expiry_warning (red assert), ~16s →
  auto_pick. Zombie risk beyond the clobber: with `_checkpoint` still truthy, ANY MC card
  rendered later wires `onDone → _checkpointAnswer` (:3632) — cards from an unrelated deck
  could advance the checkpoint. Suggested fix (any one restores the invariant): have
  `startCheckpoint` keep the pause (transfer the explorer's auto-pause to the quiz instead of
  releasing it), or clear/park `_decision` + `_optPick` for the quiz's duration, or guard
  `_tickDecision` on `this._checkpoint`. The red spec is fix-shape-agnostic.

## Q003 — Momentum sounds are inaudible: the combo two-step and break snap are ALWAYS eaten by the 40ms voice-spacing gate   [bug] [status: Fixed v1.75.3]
- Spec: e2e/gen/endgame-combo-sound-ladder.spec.ts
- Found: wave 5, multiBeltEndgame at sound
- Expected: the sound bus mirrors the combo arc — climbing ×2→×5 voices the combo patch
  ("combo-up", the bright two-step sound.src.js:26 documents as "for every combo") at each
  tier, ×5 adds the distinct combo_big stab, and a wrong answer voices combo_break (the
  "string-snap slide when the streak dies", :28). Beats and voices agree on the arc.
- Actual: beats mirror the arc perfectly (probe: combo n=2,3,4,5 · combo_big n=5 · combo_break
  at=5) but the voice log carries ZERO combo voices and ZERO combo_break — only combo_big
  ("combo-stab") survives. Cause: on a landing answer, fx("mc_correct") (app.src.jsx:3646;
  often preceded by bonus_pumped via noteCardDone :862) → onDone → `_landAnswered` (:4302) →
  `_comboUp` → fx("combo") (:4338) all run in ONE synchronous key/click handler, so
  performance.now() deltas are ~0ms; NGSound.beat's voice spacing (sound.src.js:94:
  `now - _lastVoice < 40 && !patch.major → return`) drops every non-major patch after the
  first accepted voice. mc_correct/bonus_pumped always claims the window → combo (non-major)
  is dropped at EVERY tier. Same on the break: fx("mc_wrong") (:3663) voices buzz-muted, then
  fx("combo_break") (:4350) lands <40ms later → dropped. combo_big is `major:1` → always
  lands. Not a test artifact — real play has the same synchronous ordering, so the audible
  ladder is ding … ding … STAB: the ×2/×3/×4 announcer slams and the chip-shatter break are
  silent, and the "louder patch at ×5" contrast (:4339) never exists because the quiet patch
  is never heard.
- Notes: repro = boot multiBeltEndgame (decks unproven → every landing asks) → land Mount Top
  → loop [answer landing MC right via `_mc.correct` + rig resolve/outcome 0.01 + nextHand]
  to _combo=5 → read `sound.soundLog` → answer next question wrong. Suggested fixes (spec is
  shape-agnostic): mark combo/combo_break `major: 1` (they are rare, tier-gated moments, not
  spam — mirrors how combo_big already punches through); or exempt them from spacing; or emit
  the mc ding only when no combo event fired in the same answer (the announcer replaces the
  "Correct" toast at ×2+ visually — app.src.jsx:4308 — so the ding could defer to the combo
  voice the same way). Beware: fixing via reorder alone (combo before mc_correct) just flips
  which voice gets eaten.

## Q004 — "Clean Checkpoint" patch mints on ANY checkpoint pass: its first-try predicate is vacuously true   [bug] [status: Fixed v1.75.3]
- Spec: e2e/gen/mid-clean-checkpoint-patch-first-try-only.spec.ts
- Found: wave 6, curriculumMid at checkpoint-quiz
- Expected: the patch is authored "Pass a checkpoint on the first try"
  (challenge-definitions.src.js:337) — a failed sitting mints nothing, and a later pass
  that is neither a first attempt nor a perfect run (a post-fail retake that scrapes by
  at exactly the pass bar) mints nothing either. Under EITHER faithful reading —
  attempt-level ("your first sitting of this unit's quiz") or per-card ("clean" = every
  card right first time) — the fail-then-5/6-retake arc earns no patch.
- Actual: the when-predicate `(p) => !!p.firstTry` can never be false on a pass. The
  checkpoint_passed beat's `firstTry` is the COUNT of cards answered correctly on first
  presentation (app.src.jsx:3706 `if (ok) cp.firstTry++`), and passing requires
  `cp.firstTry >= cp.pass` (app.src.jsx:3710, pass=5 per curriculum, schema floor 1) — so
  every pass beat carries firstTry >= 1 and the predicate is always truthy. The badge is
  effectively "pass any checkpoint, ever". Probe (curriculumMid, unit
  white/side-control-escapes {cards:6, pass:5}): bomb all 6 → checkpoint_failed
  {firstTry:0}, zero mints (the fail side IS honored — ngRewardChanges only matches
  event==="checkpoint_passed", challenge-engine.src.js:96-98); retake at exactly the bar
  (5 right, 1 wrong) → checkpoint_passed {firstTry:5, of:6} and patch_earned
  {id:"clean-checkpoint"} fires ONE beat later. Dedupe half is sound: `if
  (nextBadges[patch.id]) continue` (challenge-engine.src.js:90) caps it at one mint ever
  (probe: two extra synthetic passes → still 1).
- Notes: repro = boot curriculumMid (settings.landQuestions=false) → land Mount Top →
  drill unit-2's back half ×3 → toggleExplorer → open unit-2 group → click
  `[data-checkpoint="white/side-control-escapes"]` → answer all 6 wrong via `_mc.correct`
  → sit again → answer exactly 5 right → patch_earned fires (red assert: zero mints).
  Naming trap: the beat field reads like a boolean and challenges-engine.spec.ts:92-93
  even fires it synthetically as `firstTry: true` — it is a count. Suggested fixes (the
  red spec is fix-shape-agnostic; its retake is deliberately non-perfect so both go
  green): attempt-level — mint only when the unit had no prior checkpoint_failed/
  checkpoint_abandoned sitting (needs a per-unit attempt flag; note units[uk] only exists
  after a pass, so today's beats can't tell first sitting from retake), or perfect-run —
  flip the predicate to `p.firstTry === p.of` and reword the detail to match ("every
  card right, first time"). Owner call on which meaning "Clean Checkpoint" intends.

## Q005 — Challenge objectives are silent in live play: objective-tick is the one Rewards voice without the major flag, so any completion triggered by a voiced beat is eaten by the 40ms gate   [bug] [status: Fixed v1.75.3]
- Spec: e2e/gen/holder-reward-beats-carry-reward-voices.spec.ts
- Found: wave 6, whiteBeltHolder at sound
- Expected: the sound bus mirrors the rewards vocabulary — every live challenge_completed
  beat voices its objective-tick ("Objective logged", catalog sound.src.js:41) exactly once,
  the way the group's other acknowledgements already punch through: patch-weave and
  coin-mint both carry `major: 1` (sound.src.js:91-92) precisely so a reward is heard even
  when it lands adjacent to the gameplay voice that caused it.
- Actual: `objective-tick` alone lacks the flag (sound.src.js:90), and a challenge is
  ALWAYS completed in the same synchronous task as its trigger beat: fx(<trigger>) voices
  the trigger, then noteChallenges fires fx("challenge_completed") (app.src.jsx:4570)
  ~0ms later — NGSound.beat's wall-clock spacing gate (sound.src.js:267:
  `now - _lastVoice < 40 && !patch.major → return`) drops the tick every time the trigger
  had a voice. Probe (whiteBeltHolder, keepTutorial, Mount Top): white.sheet — trigger
  sheet_opened, UNVOICED — ticks fine (control); white.commit — trigger commit →
  capacitor-latch — beats `[commit, challenge_completed, tut_step]` but voices only
  `[commit:capacitor-latch]`; brown.combo-seven off fx("combo",{n:7}) — voices
  `[combo:momentum-rise, coin_earned:coin-mint]`, tick gone. Since commit,
  impact_success, escape, combo and checkpoint_passed are all voiced, MOST live
  completions are silent; only sheet_opened/land_q_answered-triggered ones ever tick.
  The coin half of the vocabulary is fully intact: godlike mints once
  (mint-once upstream — a back-to-back fx("combo",{n:7}) emits no second coin_earned
  beat), coin-mint voices exactly once (major:1), and the second combo beat is deduped
  downstream (100ms same-beat window). Same root gate as Q003, distinct promise broken
  (Rewards-group parity, not the momentum ladder).
- Notes: repro = boot whiteBeltHolder + keepTutorial → land Mount Top → open a sheet
  clear of the challenge cue (the .ng-challenge-cue aside at left:16px w:270px is
  pointer-events:auto and covers the LEFTMOST tray card — pick a card with box.x > 300) →
  wait 200ms wall (both windows are performance.now()-based; sim pumping can't clear
  them) → click [data-go] → soundLog delta has capacitor-latch but zero objective-tick.
  Green-proof: an instance-level override exempting only challenge_completed from
  _lastVoice (dedupe untouched) turns the full quarantine spec green, coin half included.
  Suggested fixes (spec is fix-shape-agnostic): mark objective-tick `major: 1` like its
  two Rewards siblings (completions are rare, tier-gated moments, not spam); or exempt
  the Rewards group from spacing; or defer the tick emission past the gate window.
  Beware the Q003 trap: reordering (tick before trigger) just flips which voice is
  eaten — the spec pins capacitor-latch to stay red under that shape.

## Q006 — Challenge cue steals mouse clicks from the leftmost option cards: the whole cue panel is pointer-events:auto over the tray's load-bearing pass-through corner   [bug] [status: Fixed v1.75.3]
- Spec: e2e/gen/casual-challenge-cue-steals-tray-clicks.spec.ts
- Found: wave 6, casualWeek1 at challenges
- Expected: the pass-through corner is a documented contract — helmet.html:96-97 keeps the
  base `.ng-tut` at `pointer-events:none` with the comment "the options tray can scroll
  under this corner and must stay clickable", and CLAUDE.md's tutorial-drip section
  restates it ("pointer-events:none so the options tray stays clickable"). A
  tutorial-active player (exactly the drip's audience) can mouse-click every dealt option
  card; clicking a card opens its move sheet.
- Actual: the challenge-cue redesign reuses the node (`aside.ng-tut.ng-challenge-cue`,
  challenge-feedback.src.js:45) but overrides the WHOLE panel to `pointer-events:auto`
  (challenge-feedback.css:16) and fills it with a full-surface
  `[data-challenge-cue-open]` button. At the standard 1440x900 viewport a 10-card hand
  from Mount Top runs the tray (cards y 680-818, w 150, pitch 162 from x 0) under the cue
  (measured box x:16 y:722 w:270 h:74): the first TWO cards' centers land inside the cue,
  so their center hit-test resolves to `.ng-challenge-cue` and a mouse click there fires
  `openLearningView("challenges")` — the player trying to execute a move (the drip step
  literally says "Execute a move") is yanked into the Challenges explorer instead.
  Playwright evidence: clicking `[data-tech="Americana from Mount"]` retried 380+ times
  over the full 240s budget with "`<small>WHITE CHALLENGES</small>` from `<aside ...
  class="ng-tut ng-challenge-cue">` subtree intercepts pointer events". The cue is
  opaque (rgba(15,19,30,.97)), so the two cards show only ~40px top and ~20px bottom
  strips around the panel — clickable slivers, captured center.
- Notes: repro = boot casualWeek1 (or any blob) with keepTutorial:true → land Mount Top
  (coach dismissed → drip cue takes the corner) → elementFromPoint at the first two card
  centers → `.ng-challenge-cue`. Masked everywhere else: digits 1-9 still open cards
  (keyboard path), and the DSL's default boot marks the tutorial done (tutHidden → no
  cue), so every non-keepTutorial journey sails past it; the curated suite asserts
  cue/tray non-overlap ONLY on mobile (challenges-ui.spec.ts:300-353, 400x875, where
  `.ng-cue-detail` collapses). Wave-6's Q005 probe independently hit it and worked
  around it ("pick a card with box.x > 300" in its Notes) without filing it. Same class
  of bug as the v1.69.1 pointer-events fixes (CLAUDE.md: "mouse clicks silently fall
  through" — here it is the inverse: the overlay swallows them). Suggested fixes (red
  spec is fix-shape-agnostic — hit-test all on-viewport card centers, then click the
  leftmost card and expect its sheet): dock the cue clear of the tray band (its old
  bottom:104 predates the cue growing interactive); or hide it while a hand's tray is
  live (it re-renders on every challenge event anyway); or keep the panel
  pointer-events:none and re-enable auto only on hit surfaces that don't overlap the
  tray. Cue visibility is logged, not asserted, so all three shapes go green.

## Q007 — Digits 5-9 during an open checkpoint quiz open the roll's expand sheet, and Enter then commits the roll under the live quiz   [bug] [status: Fixed v1.75.3]
- Spec: e2e/gen/holder-checkpoint-letters-answer-digits-stay-roll.spec.ts
- Found: wave 6, whiteBeltHolder at checkpoint-quiz
- Expected: an open checkpoint quiz owns the keyboard's answer surface — A-D answer the live
  MC (advancing `_checkpoint.i`), and no digit reaches the ROLL beneath: no option expand
  sheet opens, `_detailCtx` stays falsy, and Enter fires no commit. The quiz stopping the
  game is established law (pane law: open = the game stops; Q002 fixed the decision-clock
  half of exactly this promise in v1.67.7).
- Actual: the keyboard's option-card opener branch (app.src.jsx:318-320, `/^[1-9]$/ …
  this._optPick && this._optList && cardNumbers`) has no `_checkpoint` guard, and neither
  does `expandOption` (:1583); `startCheckpoint` never parks the pre-quiz hand. Digits 1-4
  are captured upstream by the deck-MC branch (:314) and ANSWER the quiz (core-035's digit
  aliasing on the deck surface — intended, the quiz IS a deck-surface MC block). But digits
  above the MC option count fall through to the roll: probe (whiteBeltHolder, blue-u1 quiz
  open at card 4/6 over a live 10-option Mount Top hand) pressed '5' and '9' →
  sheet_opened ×2, `_detailCtx` truthy, then Enter → `ctx.onPick(ctx.opt)` (:292) →
  commit → sweep_start → sweep_land → detonation → impact_success → land → options_dealt:
  the roll PLAYED OUT under the open quiz, unpaused the game (paused:false), advanced to a
  new position, and the landing clobbered the quiz surface — `_posKey` flipped to the new
  position's deck ("3-4 Mount|Top") and the drill header lost "Checkpoint 4 of 6" while
  `_checkpoint` stayed armed at i=3 — the Q002 zombie (any later MC card wires
  onDone → _checkpointAnswer) through the manual keyboard door Q002's clock fix doesn't
  cover.
- Notes: repro = boot whiteBeltHolder + blue-u1 decks at prep=3/rec=3
  (settings.landQuestions=false) → land Mount Top (10-option hand) → toggleExplorer →
  select blue track → click `[data-checkpoint="blue/takedowns-and-standing"]` → answer one
  card via its correct letter (i=1, clean) → press '5' → sheet_opened + `_detailCtx` set →
  press Enter → commit under the quiz. Mouse path is the same hole (tray cards clickable
  under the pane on desktop; :4120 calls the same expandOption) — the red spec pins the
  keyboard door since it needs no hit-testing. Letters (A-D) and digits 1-4 are NOT part of
  the bug: both route to the quiz MC and advance i; the red spec deliberately leaves 1-4
  unasserted so a fix needn't touch them. Suggested fixes (red spec is fix-shape-agnostic;
  green-proof: an instance-level `expandOption` guard on `_checkpoint` turned the full spec
  green, letter-half included): guard the [1-9] opener branch on `!this._checkpoint`, or
  park/clear `_optPick`/`_optList` for the quiz's duration (Q002's notes already suggested
  this shape), or guard `expandOption` itself.

## Q008 — The card names your side; most of the hand under it is AUTHORED for the other side   [bug] [status: Open]
- Spec: e2e/quarantine/side-named-hand-authored-for-other-side.spec.ts
- Found: journey 3 pass 3 (cold-start review), on the WIN 1 first-impression path
- Expected: the identity card says which side you are playing, and every option dealt beneath it is a
  move that side actually performs.
- Actual: the LABEL half is fixed (v1.82.4: `playedRole` makes the card, the deck key, `_posKey`, the
  roll-log row and the dossier badge agree on the played side). The hand's CONTENT still does not.
  `optionsFor` decides "is this move mine?" from the strength pair `n.s` (`myVal >= oppVal - 0.05`) —
  i.e. whether the move's OUTCOME favours me — while the authored truth about whose move it is lives
  in `fromRole`. Measured on the emitted graph-data.json:
    * Half Guard, playing BOTTOM  — 22 role-filtered candidates, 14 authored `fromRole: "top"`
    * Closed Guard, playing TOP   — 22 role-filtered candidates, 19 authored `fromRole: "bottom"`,
      14 of those submissions (so the friendliest opening deals a hand of the other side's finishes)
    * Side Control, playing TOP   — 23 candidates, 23 authored top: coherent, which is why this node
      is the one the original probe happened to look at
- Notes: game-wide and pre-existing (`project_graph_coherence_invariant`), NOT a cold-start defect —
  parked here on purpose so journey 3 does not silently redefine what "the hand for a side" means.
  It matters more now only because WIN 1 sends newcomers to Closed Guard / Half Guard / Side Control
  most often. Related hole, same root: 54 of the 136 positions carry NO adjacent technique whose
  canonical origin (`fromPositionId`) is that position, so for 109 of the 272 position x side combos
  the contextual+role filter empties and `optionsFor` deals from its documented unfiltered escape
  ("safety: if role-filtering left nothing"). That escape count is asserted as a non-growing ceiling
  in e2e/journeys/first-impression.spec.ts. Fixing this is a content/`fromRole` question for the
  owner: either the graph's origin roles are wrong, or `optionsFor` should filter on `fromRole` and
  the authored `attempt_probability` maps must then cover both sides of every position.
