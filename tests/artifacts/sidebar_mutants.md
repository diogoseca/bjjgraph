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
