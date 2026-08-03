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

## Q003 — Momentum sounds are inaudible: the combo two-step and break snap are ALWAYS eaten by the 40ms voice-spacing gate   [bug] [status: Open]
- Spec: e2e/quarantine/endgame-combo-sound-ladder.spec.ts
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
