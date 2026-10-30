# Sidebar build (v1.242.0) — mutant table

Every new claim of the sidebar build, the mutant that breaks it, and the named spec that went red. A row
whose verdict is SURVIVED is a missing gate, recorded so nobody reads the spec as covering it.

Runners (scratch, not gates): planner mutants swap one line of `neural/src/gameplan.src.js` and run
`node --test tests/gameplan.test.mjs`; app mutants swap one line, rebuild with `npm run dev:neural:app`,
run the named spec on a private port (ran-count printed, zero fails), restore and rebuild.

## Practice: one mixed session (owner U56 e)

Planner (`tests/gameplan.test.mjs`, 19 tests ran per mutant):

| mutant | verdict | red at |
|---|---|---|
| M1 the goal-fill term dropped (new cards only from the reviews' share) | KILLED | "Practice: a fresh player's session is the gaps, up to the 20-card default goal" (+9 older planner tests) |
| M2 the reviews' share dropped (a heavy day deals no new card) | KILLED | "Practice: a heavy day keeps the mix…", "Practice: reviewed questions count toward the goal…" |
| M3 the quota ignored (new cards after the goal is met) | KILLED | "Practice: a heavy day keeps the mix…; the goal stops new cards, never reviews" |
| M4 no interleave (reviews, then every new deck) | KILLED | "Practice: due reviews come first by urgency, and new decks are slipped in…", "…heavy day…" |
| M5 a new deck before the first review | KILLED | "Practice: due reviews come first by urgency…", "…heavy day…" |
| M6 ratio 2 instead of 4 | KILLED | "Practice: due reviews come first by urgency…", "…heavy day…" |
| M7 planner default goal 30 | KILLED | "Practice: a fresh player's session is the gaps, up to the 20-card default goal" |

App (`e2e/journeys/practice-mix.spec.ts`, 3 tests ran per mutant):

| mutant | verdict | red at |
|---|---|---|
| E1 the session dealt reviews-then-new (`plan.queue` ignored) | KILLED | "Practice: a player with due cards gets reviews and new decks, interleaved" |
| E2 the planner fills the goal from the reviews' share only | KILLED | "Practice: a fresh player's session is new gap cards from the weak-spots ranking" |
| E3 the goal line does not count today's answers | KILLED | "Practice: the daily goal shows progress and never blocks a review" |
| E4 the goal blocks: the queue stops walking once it is met | KILLED | "Practice: the daily goal shows progress and never blocks a review" |
| E5 app default goal 30 | KILLED | "…fresh player…", "…daily goal shows progress…" |

Practice row (`tests/gameplan_stats_repaint.test.mjs`, 4–5 tests ran per mutant):

| mutant | verdict | red at |
|---|---|---|
| U1 a late refresh skips the Practice row's in-place repaint | KILLED | "late loaded planner stats refresh…", "a late refresh repaints the mounted Practice row in place…" |
| U2 the row's tooltip drops the plan's new count / loading state | KILLED | "absent planner…", "late loaded planner…", "loaded empty plan…" |
| U3 a fresh Train block per list render (a payload would detach the row) | KILLED | "a list rebuild re-appends the same Practice row, listener and all" |

## The drawer (owner A5 · E1 · T-b)

App (`e2e/journeys/sidebar.spec.ts` unless named, the one named test ran per mutant):

| mutant | verdict | red at |
|---|---|---|
| D1 the opener labelled "Menu — open learning panel" again | KILLED | "one drawer icon opens the drawer, and nothing is labelled Menu" |
| D2 Your lists above Train | KILLED | "the drawer lists Search, Explore, Train, your lists and Last rolls, in that order" |
| D3 Explore's categories in the old order (Systems first) | KILLED | "…in that order" |
| D4 a third row under Train (a Gaps row) | KILLED | "…in that order" |
| D5 the word-spacing rule removed (the face's 0.143em gap) | KILLED | "…in that order" (the differential; it SURVIVED the first, absolute version of the assertion, because the harness never loads the Google face) |
| D6 the drawer pushes the legend | KILLED | "the drawer draws over the map and the legend, and the legend never moves" |
| D7 the badge's today line ignores today's answers | KILLED | "the badge shows today's cards and rolls before it is opened, and a real grade moves it" |
| D8 Practice's pill counts techniques, not cards | KILLED | "Practice, Path and Last rolls open their views, and the brand leads back" |
| D9 the brand never says where you are (no "‹ Path") | KILLED | "Practice, Path and Last rolls open their views, and the brand leads back" |
| D10 the fog lands at once | KILLED | "a principle lights its places and fades the rest of the map to ~20%, smoothly" |
| D11 the fog settles at the old 30% | KILLED | "…smoothly" |
| D12 the badge out of the tab order | KILLED | "keyboard: Tab reaches the badge, Enter opens its menu, and its small links work by key" |
| D13 the guest's Save offer never shown | KILLED | "a guest's badge offers to save; a signed-in player gets neither it nor the save toast" |
| D14 the save toast reaches a signed-in player | KILLED | "a guest's badge offers to save; …" |
| D15 a rightward swipe closes the drawer | KILLED | "on a phone, a left swipe closes the drawer" |
| P6 the session titled with the old Maintenance wording | KILLED | gameplan-learning-loop.spec.ts "capped due deck requires real reviews…" |
| P7 the goal head reads "Finish these to unlock more" again | KILLED | gameplan-learning-loop.spec.ts "D2: finishing the session ends on All done…" |

## SIDE-R2 (the independent review's HOLD)

Planner (`tests/gameplan.test.mjs`, 21 tests ran per mutant):

| mutant | verdict | red at |
|---|---|---|
| M8 the quota's old floor, `⌈due / 4⌉` (it climbs back to the whole goal at 77 owed) | KILLED | "Practice: the new-card quota is non-increasing in the reviews owed, for a fixed goal" |
| M9 the ratio counted in decks, not cards | KILLED | "Practice: due reviews come first by urgency…", "Practice: with real 8-card decks a new technique comes after every few reviews…" |

Unit (`tests/settings_presentation.test.mjs`, `tests/gameplan_study_host_app.test.mjs`):

| mutant | verdict | red at |
|---|---|---|
| U4 the Settings field's own literal default again (`get("dailyGoal", 30)`) | KILLED | "load failure has real Retry…" (the field's default is NG_PRACTICE_GOAL) |
| U5 the cold queue never upgraded (`!waiting.review.count && !this.dueCount()`) | KILLED | "active due queue survives deferred planner arrival… once graded; an untouched one becomes the plan" |

App (one named spec per mutant, rebuilt each time, the named test only; ran-count printed per run):

| mutant | verdict | red at |
|---|---|---|
| R1 B1: the cold queue is never upgraded (`!waiting.review.count && !this.dueCount()`) | KILLED | practice-mix.spec "Practice (2b): pressed cold…" |
| R2 B1: the drawer's opening never asks for the planner | KILLED | practice-mix.spec "Practice (2b)…" (the request count) |
| R3 S1: the swipe closes the drawer mid-study (`_paneStudyActive` guard dropped) | KILLED | sidebar.spec "a left swipe mid-Practice keeps the drawer and the session" |
| R4 the dominant-axis check goes | KILLED | sidebar.spec "the left swipe's guards…" |
| R5 the horizontal-scroller guard goes | KILLED | "the left swipe's guards…" |
| R6 the pinch guard goes | KILLED | "the left swipe's guards…" |
| R7 the swipe-is-not-a-tap suppressor goes | KILLED | "the left swipe's guards…" |
| R8 the suppressor's threshold drops to 6 px (a 10 px wobble eaten) | KILLED | "the left swipe's guards…" |
| R9 P1: the closing tap reaches the tap router | KILLED | sidebar.spec "the tap on the exposed strip that closes the drawer does only that" |
| R10 the amber dot never shows | KILLED | sidebar.spec "the closed drawer's icon wears an amber dot…" |
| R11 the badge menu takes no focus on open | KILLED | sidebar.spec "keyboard: Tab reaches the badge, Enter opens its menu with focus inside it…" |
| R12 the badge menu has no arrow keys | KILLED | "keyboard: …" |
| R13 Account preferences opens Settings' first tab | KILLED | account-menu.spec "signed in with legacy progress…" |
| R14 Explore's fold written to memory only (no `set`) | SURVIVED | — any later save carries the in-memory settings map, so the mutant changes nothing a reload can see: not a claim. R14b is. |
| R14b Explore's fold left out of the saved blob | KILLED | sidebar.spec "Explore's fold survives a reload" |
| R15 the day's rolls are not saved (`rollDays` out of the blob) | KILLED | sidebar.spec "the badge shows today's cards and rolls… survive a reload" |
| R16 M10: the Practice tail rewritten on every repaint | KILLED | sidebar.spec "a repaint between pressing Practice and releasing it does not swallow the press" |
| R17 P2: the study head's Back is a span again | KILLED | sidebar.spec "Practice, Path and Last rolls open their views…" |
| R18 M5: the star count re-fetched on every menu render | KILLED | account-menu.spec "rows open the real surfaces" (nine renders, one request) |
| R19 M6: the reader reserves no room for the share cue | KILLED | defending-landing.spec "D-433: at 390x631…" |
| R20 the phone share cue back in the chip's old seat (bottom 28), against land-layers | SURVIVED | — the dock clears the cue wherever it sits; the seat is dev's, restored, and not a claim |
| R20b the same, against layer-dock-centre's phone claim, ×6 | SURVIVED | — 6/6 green: with the same-task layout the seat cannot collide |
| R20c the cue's same-task dock layout goes (`_reader.layoutNow()` in `_setShareCue`) ×6 | KILLED | layer-dock-centre.spec phone, 3 of 6 red (4 of 8 before the fix): THIS is the CI red's cause |
| R21 a no-view open lands on Path again, read after the drawer had opened | SURVIVED | — the first open had already set the view; the claim needed a fresh boot. R21b is. |
| R21b a no-view open lands on Path again (the migration), read on a fresh boot | KILLED | sidebar.spec "an open that names no view lands on the drawer's list, never on Path" |


## SIDECX1 / SIDE-R3 and owner answers of 29 October

All controls below were measured against passing unmutated claims on the final source. Each app
control ran one selected test; expected assertion failures count as kills, not setup or test timeouts.
`sidebar_r3_mutants.json` records these eleven exact source patches (plus the four SIDECX2 patches below) and anchored spec/claim selectors.
The source and served bundle were restored after every control (bundle SHA-256
`26fb8ee2e2e01e819f5a25880caaa785cf604bd5d65644ebff983fc21d77ca40`).

| Control | Result | Named failing claim |
|---|---|---|
| n1-placeholders-lost | KILLED | sidebar: Practice did not move when concepts landed (60px > 1px) |
| n2-close-stops-replay | KILLED | sidebar: N2 closing the drawer keeps the replay |
| n3-touch-focus-ring | KILLED | sidebar: a touch never moves focus into the menu |
| n4-revealed-queue-replaced | KILLED | practice-mix 2c: the revealed queue is not replaced |
| u60-train-restored | KILLED | sidebar: U60 b no Train header |
| u60-duplicate-account | KILLED | account-menu: U60 b only Settings remains |
| u60-notifications-lost | KILLED | account-menu: Notifications tab remains reachable through Settings |
| u66-icon-hidden | KILLED | defending-landing: the icon stays visible during danger |
| u66-catch-unpaused | KILLED | defending-landing: the drawer owns the catch pause |
| fog-snaps | KILLED | sidebar: not at once, the first frame is still mostly clear |
| fog-never-eases | KILLED | sidebar: it passes through the values between |
| quota-gap-21: return 3 only at left=20, due=21 | KILLED (21 unit tests ran) | gameplan: left=20 due=22 increases 3 → 4; the old thirteen samples missed due=21 |
| quota-left-7: return 1 only at left=7, due=21 | KILLED (21 unit tests ran) | gameplan: left=7 due=22 increases 1 → 2 |
| n4-open-deck: remove the cold-upgrade `_sessionInline()` guard | KILLED (12 unit tests ran) | gameplan_study_host_app: open-deck unexpectedly reopens the plan |
| flight-lift-fixed-margin | KILLED (1 test ran, 1 stopped after failure) | camera-continuity: ZERO overlap URL arrival at 1440×720; band 74..218, label bottom 235.82, required <232 |
| concept-fit-reveal-lost | KILLED (1 test ran) | concepts-surface: the expanded portrait and its close button fit inside the reading pane at 1440×700 |

N7's historical non-kills at 1440×900 remain documented in the spec and runner headers. The new
viewports expose their geometry without changing the assertions; the camera baseline ran 2/2 and
the desktop film baseline 1/1. No new control survived.

The revised fog observation reads each pumped draw synchronously. The cancelled CI run sampled
0.20 on its first wall-timer observation, after the fade had already finished; both snapping and
never easing still fail the revised claim. This is separate from SIDE-R2's REAL app defect where
fog did not ease under pumped time (corrected classification N6).

## SIDECX2 / U61 c and U67 a

All 15 addendum positives passed (13 Feedback/account + 2 keyboard/touch). Each control below
ran one test and failed its named assertion, with no setup or test timeout. The shared build lock
protected each mutation build; each browser run had advisory GO, one worker on private port 8641.
Source and served bundle were restored; final bundle SHA-256 `c99136619a70f3f28fbc05b49d06a55ac85384fbfa5772a6b1e20c0528112b0d`.
Exact patches are in `sidebar_r3_mutants.json`; receipts and logs are in
`/home/user/bjj-orchestrator/scratch/sidebar/sidecx2/`.

| Control | Result | Named failing claim |
|---|---|---|
| u67-submit-silent | KILLED (1 ran) | merged submit emits exactly one feedback event: 0 received |
| u67-technique-kind-lost | KILLED (1 ran) | selected kind retains its event: expected neural_technique_requested, received neural_issue_reported |
| u67-request-row-restored | KILLED (1 ran) | no separate technique row: 1 received |
| u61-about-restored | KILLED (1 ran) | About stays absent: 1 received |

No new non-kills. The merged form retains both existing event names and their property schema;
no telemetry consumer migration is required. The new submit claim covers empty sends, trimmed
text, exact current-page context and both kinds from the same row on a 390×631 phone. Existing
mouse/column checks cover 390×844 and 1440×900, context opt-out and signed-in/guest properties.

The Feedback rebuild swapped minifier locals in six existing table entries. Re-aimed those exact
targets without changing the controls. All 63 edits across 61 controls match exactly once and
all resulting bundles parse. Six affected/N7 controls were executed again against five green
baseline tests: `d355-flight-lift-lost`, `flight-lift-fixed-margin`, `flight-lift-tracking-lost`,
`concept-fit-reveal-lost`, `u47-question-tap-dead`, `u47-desktop-offer-lost` — **6/6 killed**,
bundle restored (`sidecx2/reaim-mutants/receipt.json`). The historical
`d355-flight-lift-ungated` non-kill remains documented; it was re-aimed, not counted as a kill.

## SIDECX3 / Path visits and generated-suite triage

All seven unchanged generated tests passed on dev f63049013. CI job 123481122732 failed
their stale default-Path entry on 4829453c9; explicit Path selection and body selectors made
all seven pass against that same app, without changing their gameplay/evidence assertions.

The separate telemetry probe found a REAL, pre-existing defect on both builds: changing gi
mode with Path closed emitted both events and consumed the visit flag. The two new
`path-visit-telemetry.spec.ts` cases failed the closed-render assertions before the fix;
after guarding the emitter, both and all 14 existing Challenges UI cases passed.

Each control below ran the green fresh-preference case once and failed its named assertion,
with no setup or test timeout. Source and served bundle were restored after the controls.
Exact source edits: `sidebar_path_mutants.json`. Logs and JSON receipts:
`/home/user/bjj-orchestrator/scratch/sidebar/sidecx3/`.

| Control | Result | Named failing claim |
|---|---|---|
| path-hidden-render-counted | KILLED (1 ran) | a closed Path re-render cannot mint a second visit |
| path-drawer-counted | KILLED (1 ran) | opening and rendering the drawer list emits neither event |
| path-beat-silent | KILLED (1 ran) | the first real Path visit emits one of each event (beat absent) |
| path-analytics-silent | KILLED (1 ran) | the first real Path visit emits one of each event (capture absent) |
| path-repeat-render-counted | KILLED (1 ran) | re-rendering and revisiting within one open drawer never double-counts |
| path-next-visit-silent | KILLED (1 ran) | the next real Path visit emits a second pair |

No new non-kills. The harness observes the app's beat stream and the PostHog capture boundary;
it does not prove remote analytics delivery. No known-red ledger row was added.

## SIDECX4 / keyboard Path, advanced tracks and focus return

The curated CI red on 572dbb627 is REAL. Dev f63049013 passes both controlled Tab-to-Path
probes. The unchanged PR head fails both: its 80ms Search callback steals Path's focus, and
a held `systems-index.json` landing detaches Path and leaves focus on body. The final app
focuses Search synchronously and restores the cached Practice/Path control after a list
rebuild. Neither advanced-track selection nor close-focus restoration was removed.

The two curated cases now use native Tab/Enter after placing focus on the opener. They
hold and positively count both real index requests, advance the browser clock while Path
has focus, then land Systems and concepts separately. Both continue through Black belt
selection and the Close button to restored opener focus. One starts with the drawer icon,
the other with `/`. The Tab traversal bound counts rendered control candidates, allowing
the expanded curriculum's hundreds of stops; it does not emulate their order.

Exact source edits: `sidebar_keyboard_mutants.json`. Each control ran one green-baseline
case and failed its named assertion, with no setup or test timeout. Source and served
bundle were restored. Receipts: `/home/user/bjj-orchestrator/scratch/sidebar/sidecx4/`.

| Control | Result | Named failing claim |
|---|---|---|
| keyboard-drawer-delayed-search | KILLED (1 ran) | opening search cannot steal the next Path key |
| keyboard-shortcut-delayed-search | KILLED (1 ran) | opening search cannot steal the next Path key |
| keyboard-systems-focus-lost | KILLED (1 ran) | systems landing preserves the keyboard-selected Path |
| keyboard-concepts-focus-lost | KILLED (1 ran) | concepts landing preserves the keyboard-selected Path |
| keyboard-path-tab-skipped | KILLED (1 ran) | Path is reachable with Tab |
| keyboard-black-tab-skipped | KILLED (1 ran) | Black belt is reachable with Tab |
| keyboard-black-enter-dead | KILLED (1 ran) | Enter selects the advanced track |
| keyboard-close-tab-skipped | KILLED (1 ran) | Close is reachable with Tab |
| keyboard-close-restore-lost | KILLED (1 ran) | closing the pane returns focus to its keyboard opener |

No new non-kills. These cases cover the drawer-to-advanced-track route, not every lesson
or reference control. The dossier stubs do not satisfy any claim here; real curriculum
and index responses supply the controls. No known-red ledger row was added.

One minifier rebinding also moved `reading-intent-blocks-digit`'s local names. Re-aiming
those names preserves the original control. Its baseline passed and its mutation failed
`...and the chosen escape stays on the table`; the bundle was restored (receipt in
`sidecx4/reaim-mutants/receipt.json`). All 63 edits across the existing 61 controls match
once and all resulting JS bundles parse. This structural check is not 61 newly run kills;
the table's historical non-kills remain recorded.

## SIDECX5 / catch pause, closing replay gestures and icon wheel

The unchanged 1a1fd494d bundle fails all seven native-input regressions at their named
assertions: two Settings backdrop cases, mouse pan, touch pan, two-finger pinch, and
two catch-icon wheel cases. These are REAL input defects. The modal handler and icon
wheel propagation predate the drawer; U66 a exposed their catch path. The closing
gesture regression was introduced by the N2 tap exemption.

The repaired bundle passes 8/8 focused cases, including the existing closing tap that
keeps a replay. Each control below fails one named assertion, with no timeout or setup
failure. Exact source substitutions: `sidebar_delta_mutants.json`. Evidence:
`/home/user/bjj-orchestrator/scratch/sidebar/sidecx5/`; positive and original-head logs
are `scratch/sidebar/runs/sidecx5-{green,red}.log`.

| Control | Result | Named failing claim |
|---|---|---|
| d1-backdrop-resumes-390 | KILLED (1 ran) | D1: the backdrop leaves the catch paused behind the open drawer |
| d1-backdrop-resumes-1440 | KILLED (1 ran) | D1: the backdrop leaves the catch paused behind the open drawer |
| d2-replay-kept-mouse-pan | KILLED (1 ran) | D2: a continuous closing gesture stops replay on movement |
| d2-replay-kept-touch-pan | KILLED (1 ran) | D2: a continuous closing gesture stops replay on movement |
| d2-replay-kept-touch-pinch | KILLED (1 ran) | D2: a continuous closing gesture stops replay on movement |
| d3-icon-wheel-leaks-390 | KILLED (1 ran) | D3: wheel on the catch icon leaves the camera alone |
| d3-icon-wheel-leaks-1440 | KILLED (1 ran) | D3: wheel on the catch icon leaves the camera alone |

Source and served assets were restored after all seven controls. No new non-kills.
Backdrop input is touch at 390×844 and mouse at 1440×900, with positive hit tests and
a real pausable timer that remains held, then fires when the drawer closes. Replay
checks use one continuous native gesture and keep the initial closing-press exemption.
Wheel checks use native mouse wheel at both widths; they do not claim phone scrolling.
The icon leaves the camera untouched; the same wheel on exposed canvas zooms it.
