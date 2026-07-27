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

## Q001 — SPA soft-nav teardown never flushes the debounced save: last ~400ms of progress silently lost   [bug] [status: Open]
- Spec: e2e/quarantine/spa-nav-inflight-progress-survives.spec.ts
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
