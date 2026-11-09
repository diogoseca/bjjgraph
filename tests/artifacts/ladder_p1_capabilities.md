# Practice corridor — P1 capability checklist (v1.248.0)

This delta inventory extends [all 145 sidebar capabilities](sidebar_capabilities.md). It was checked
against `app.src.jsx`, `challenge-ui.src.js`, `settings-ui.src.js`, `gameplan.src.js`, and the existing
study journeys. Rows below cover every P1 disposition in the ladder plan. Unlisted sidebar rows keep
their existing destination and evidence; their pre-existing UNGUARDED status is not upgraded here.

The owner's U76, U87 and U56 authorize section locks, hidden earlier belts, and unlimited deliberate
continuation. U86 keeps the original Path corridor temporarily as the UI reference while Practice
takes over. Path therefore still opens that corridor; its Start action enters the same Practice
implementation. A new planner, placement policy, ranking metric, or capstone verdict is outside P1.

A checked disposition means the capability has an implementation destination. It does **not** claim
a passed run. Executed gates and named mutation receipts are recorded separately in
[the mutation ledger](ladder_p1_mutants.md) and the delivery report.

| Done | Prior sidebar rows | Capability | P1 destination and acceptance | Claim / collected oracle |
|---|---|---|---|---|
| [x] | 9–12, 94, 111 | Practice entry, due pill, live today count, saved goal | Drawer Practice opens the screen-wide study page. Default 20; saved goal retained. Live debt and distinct daily grades use the existing shared readers. | A/C/F; practice-page, practice-mix, gameplan-learning-loop |
| [x] | 6, 70–72 | Path entry, belt summary and legacy callers | Original Path UI remains. Worn belt and stripes read retained earned progress, never track selection or current knowledge. | B/F; challenges-ui, path-visit-telemetry, belt-worn |
| [x] | 1–4, 8, 98 | Back, Close, Esc, origin and pause ownership | Shared pane close hierarchy; Back restores source view, scroll, selected node and URL. Card swipes navigate cards; they cannot dismiss Practice. | E; practice-page, pane-law, pane-chrome, pane-history, sidebar |
| [x] | 69 | Due band and Start | Path's band remains; Start calls the single Practice entry. Practice starts with owed reviews from every belt. | B/C/F; srs-due, practice-page |
| [x] | 70, 74 | Dyed belt rails, names, counts, completion stamps | Reused below the active card; current belt opens, earlier belts are revealed at the end. Future belt sections have no interactive descendants. | A/B; practice-page, challenges-ui |
| [x] | 70 | Five freely clickable tracks | Intentionally replaced by U76/U87. Only current/earlier earned sections can open. Global reference/game access stays open. | B; practice-page, gameplan-learning-loop, belt_worn.test |
| [x] | 71 | Independent folds and saved preferences | `challengeOpenSections` remains for eligible sections. Saved selection/folds never grant rank or bypass a lock. No synced key deleted. | B; challenges-ui, belt_worn.test |
| [x] | 72 | Arrival and next-lesson highlight | Practice lands on the first question without scroll. Path retains earned-belt arrival and frontier highlight. | A/B; practice-page, challenges-ui |
| [x] | 75–77, 83, 98, 112 | Lesson selection, inline cards, dots, arrows, reveal, grading and answer mode | Practice lessons select the map/URL and join its existing queue. Shared flashcards retain recall; Practice also honors MC mode. Hidden/detached decks cannot receive keys. | C/D/E; practice-page, keyboard, challenge-curriculum, mc-flashcards |
| [x] | 78 | Checkpoints, prerequisite evidence, quiz, retake and first-try proof | Existing checkpoint controls inside eligible units; action-level belt guard; proof writer unchanged. | B/F; challenge-curriculum, study-story, content-capstone |
| [x] | 73, 84 | Objectives, Start a roll here, missing curriculum fallback | Existing objective controls below eligible belt work. Missing curriculum still renders eligible action challenges and existing rewards. Stored future work is retained. | B/F; challenges-ui, challenge-curriculum |
| [x] | 80 | Optional capstones, patches and attempt history | Existing eligible capstone block and rewards shelf. No scoring/verdict change; P3 owns that. | B/F; content-capstone |
| [x] | 79, 113 | Black Recall Mode reward and Settings entitlement | Held/grandfathered belt and historical patch remain the sources. Hidden section cannot revoke Settings entitlement. | B/F; recall-badge, belt_worn.test |
| [x] | 58–68, 81 | Principles and related reference access | Existing principle group below belt work; reading and related-card study remain available outside progression. No video is embedded in the active question. | A/F; challenge-curriculum, systems-surface, concepts-surface |
| [x] | 82 | Rewards shelf, patches, coins, celebration links | Existing rewards shelf below Practice; earlier-belts disclosure comes after it. All historical rewards retained. | B/F; challenges-ui |
| [x] | 94 | Review/new labels, Reviewed x/y, pending, blocked debt and day change | Active Review/New label, compact progress and Practice details. Queue counts and missing-content/day notices remain distinct from daily-goal completion. | C/D/F; practice-mix, gameplan-learning-loop |
| [x] | 95 | Open/Refresh plan, Why these decks, coverage, Retry comparison | Practice details below the card. Refresh extends the same session and preserves an active answer. Pending/failure retry stays available. | D/F; gameplan-learning-loop, gameplan-study-live |
| [x] | 96 | Compare practice choices, start selector, technique/role search, Compare selected | Existing comparison panel within Practice details; standardized/custom context handling unchanged. | F; game_study_controls.test, gameplan-study-live |
| [x] | 94, 97 | End, Close, truthful debt, further practice | Completion celebrates actual obligation, directly under the card and in view, with Keep practising beside it. More new cards appends immediately, including after 20 and before due reviews finish; no optional-list completion gate. | C; practice-page, gameplan-learning-loop, gameplan_runtime.test |
| [x] | 98 | The graph follows the queue, and its rings | Kept: the open card flies the camera beside the page and the session's nodes wear rings, as `renderSession` did. On a phone the page covers the graph. | F; practice-page |
| [x] | 98 | The `←→ card ↑↓ technique space flip` legend | Kept in the page's one scroller, under the technique buttons, because the pinned foot covered an answer at 390×631. | F; practice-page |
| [x] | 56, 63, 85–98 | Shared lists, related/system study and Last rolls | Existing independent entries and scopes. Daily belt allocation is confined to Practice. Shared card fixes keep their own queues. | E/F; share-lists, systems-surface, pane-history |
| [x] | 13–68, 98 | Explore, saved lists, reference and advanced gameplay study | Unrestricted by belt sections. New allocation in Practice uses the worn belt; every due review remains eligible. No stored study evidence is cleared. | B/F; gameplan-learning-loop, practice-page, game-knowledge |
| [x] | 6, 94, 97 | Deliberate visits, continuation, grades and completion telemetry | Path's original visit identity retained; Practice emits one `neural_practice_opened` per visit. “Keep practising” retains `neural_find_more_weaknesses`. Same-session completion remains deduplicated. | C/F; path-visit-telemetry, gameplan-learning-loop, practice-page |

Account access is through Back to the drawer and its existing badge; Practice hides the badge footer
so it cannot cover an answer at 390×631. Settings and account functions are retained there.

Recognition uses the shared MC renderer. If its real pool cannot form options, the card falls back
to the same recall controls, including Space and Enter; it does not leave a disabled response.

Real-site visual capture is reproducible with [the owner-screen script](ladder_p1_screens.mjs).
It uses authored payloads without the DSL or dossier stubs, with explicitly labelled progress profiles.

## Verification limits

Existing test coverage is cited as an oracle to run, not as new proof of every historical capability.
The mutation ledger must name non-kills and unexercised cases. In particular, a DOM count alone does
not prove pointer reachability, a test harness screenshot does not prove the production wire, and a
fixture recommendation does not validate the ranking model. P1 changes neither ranking mathematics
nor earned-belt qualification.
