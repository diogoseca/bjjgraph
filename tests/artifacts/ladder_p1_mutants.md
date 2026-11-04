# P1 mutation receipts

17 baseline selections executed; 0 failed. 26/26 mutations executed; 26 verified named assertion kills. Sources restored: yes.

The [source runner](ladder_p1_mutants.mjs) rebuilds real source mutations and requires exactly one changed site, a positive test count, and failure at the named assertion. Syntax errors, browser crashes, zero cases, and missing sites are not kills. The [JSON receipt](ladder_p1_mutants.json) records baseline counts, source hashes, mutations and observed failures.

| Fault | Collected oracle | Ran | Intended assertion | Result |
|---|---|---:|---|---|
| A-intro-before-card | practice-page.spec.ts — P1-A: 390×631 warm new | 1 | P1-A: planning prose follows the question | Named assertion kill |
| A-covering-footer | practice-page.spec.ts — P1-A: 390×631 warm new | 1 | P1-A: primary response is hit-testable | Named assertion kill |
| A-no-first-opener | practice-page.spec.ts — P1-A: 390×631 warm new | 1 | P1-A: first question opens | Named assertion kill |
| B-selection-guard | tests/belt_worn.test.mjs | 14 | P1-B | Named assertion kill |
| B-enabled-locked-chevron | practice-page.spec.ts — P1-A: 390×631 warm new | 1 | [data-belt-locked] button | Named assertion kill |
| B-hidden-navigation | keyboard.spec.ts — a corridor repaint leaves no dead keys behind | 1 | → walks nothing once the deck is folded away | Named assertion kill |
| B-earlier-always-shown | practice-page.spec.ts — P1-B: | 1 | [data-belt="white"] | Named assertion kill |
| B-global-advanced-lock | gameplan-learning-loop.spec.ts — P1-B: White can study | 1 | P1-B: advanced gameplay study is open | Named assertion kill |
| C-completion-gate | practice-page.spec.ts — P1-C: explicit new | 1 | toBeEnabled | Named assertion kill |
| C-goal-cap | tests/gameplan_runtime.test.mjs | 14 | P1-C duplicate shared copy is not appended | Named assertion kill |
| C-split-session | tests/gameplan_runtime.test.mjs | 14 | P1-C one session at goal | Named assertion kill |
| C-shared-double-credit | tests/gameplan.test.mjs | 21 | Practice: reviewed questions count toward the goal | Named assertion kill |
| D-replace-on-arrival | practice-page.spec.ts — P1-A/D: recognition at 390×631 | 1 | P1-D: selected MC answer keeps focus | Named assertion kill |
| D-skip-engaged-append | tests/gameplan_runtime.test.mjs | 14 | P1-D new work eventually joins | Named assertion kill |
| D-repaint-during-press | practice-page.spec.ts — P1-D: a late planner | 1 | P1-D: the answer and pressed button survive arrival | Named assertion kill |
| D-index-focus-theft | challenges-ui.spec.ts — keyboard navigation reaches advanced tracks and restores focus on close$ | 1 | systems landing preserves the keyboard-selected Path | Named assertion kill |
| E-detached-registry | practice-page.spec.ts — P1-E: detached card | 1 | P1-E: detached registry guard | Named assertion kill |
| E-space-resumes-roll | practice-page.spec.ts — P1-E: card arrows.*false | 1 | P1-E: Space does not resume play during study | Named assertion kill |
| E-swipe-dismisses | practice-page.spec.ts — P1-E: card arrows.*false | 1 | P1-E: a card swipe cannot dismiss Practice | Named assertion kill |
| E-unowned-resume | practice-page.spec.ts — P1-E: card arrows.*true | 1 | P1-E: close restores only its own pause | Named assertion kill |
| F-checkpoint-removed | practice-page.spec.ts — P1-F: a Practice unit | 1 | P1-F: checkpoint action starts a real quiz | Named assertion kill |
| F-comparison-removed | practice-page.spec.ts — P1-F: Practice retains | 1 | P1-F: comparison controls survive | Named assertion kill |
| F-rewards-removed | practice-page.spec.ts — P1-F: Practice retains | 1 | P1-F: earned rewards have a destination | Named assertion kill |
| F-path-removed | practice-page.spec.ts — P1-F: Practice retains | 1 | P1-F: temporary Path destination remains | Named assertion kill |
| F-debt-filtered-by-belt | practice-page.spec.ts — P1-A: 390×631 cold review | 1 | P1-F: due reviews ignore belt locks | Named assertion kill |
| F-double-visit | practice-page.spec.ts — P1-F: Practice retains | 1 | P1-F: one event per deliberate surface visit | Named assertion kill |
