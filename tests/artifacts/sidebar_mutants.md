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
