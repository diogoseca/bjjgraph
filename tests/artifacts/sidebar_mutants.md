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

