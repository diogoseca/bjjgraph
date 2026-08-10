# Cold-start observation (journey 3)

Evidence for "does a cold visitor actually understand this app?". Every file here is machine-written
by a spec — nothing in this directory is hand-authored except this README.

## The funnel spine

Build the ordered PostHog funnel on `neural_coldstart_step`'s `step` property, in this order:

| # | step | fired by |
|---|------|----------|
| 0 | `app_ready` | graph ingested, loader down |
| 1 | `hand_dealt` | `options_dealt` — the first actionable state |
| 2 | `question_shown` | `land_q_shown` — the landing question mounts |
| 3 | `move_committed` | `commit` |
| 4 | `outcome_seen` | `impact_success` / `impact_fail` |
| 5 | `roll_ended` | `roll_end` |

Side marks (`spine: false`, never funnel steps): `coach_seen`, `coach_finished`,
`question_answered`, `question_ignored`, `question_skipped` (+`reason`), `unseen_question`,
`pane_opened`, `deck_card_graded`.

**`question_answered` is deliberately NOT on the spine.** v1.82.0 put it between the question and
the commit, which made an ordered funnel report every visitor who chose to play on without answering
as a drop-off at a step they had sailed past. Answering is a branch; being asked is the gate.

**A gap in the funnel always has a named cause.** If a landing can ask nothing at all — proven deck,
no authored cards, decks still in flight, `landQuestions` off — `question_skipped` fires with a
`reason`. So the analysis never has to infer a drop-off from an absence.

**Out-of-order detection is BIDIRECTIONAL (v1.82.4).** A spine mark carries `out_of_order: true` with
`skipped` naming earlier steps still missing, OR `late_after` naming later steps already recorded. The
one-way version (earlier-only) called the cold path clean: with the decks 18s late, `question_shown`
(spine 2) is backfilled AFTER `move_committed` (3) and `outcome_seen` (4), every earlier step present,
and an ordered funnel then reads that arrival as a fresh visitor entering at step 2. Pinned by
`coldstart-late-payload.spec.ts`.

**The marks are NOT in `window.__neural.beats`.** They live in `window.__neural.csBeats`. The funnel
is an observer, and an observer that mutates the gameplay beat stream is visible to the thing it
measures — it broke seven `e2e/gen` specs that use a fresh life's empty beat stream as their
"rebuilt, not resumed" proof.

## The first impression (v1.82.3)

Two things about the very first screen a cold visitor plays, both fixed test-first in
`e2e/journeys/first-impression.spec.ts`.

**WHERE they open.** `startRoll()` drew the opening state uniformly from all 136 playable position
role-nodes. The `withDeck` filter that was supposed to bias it is a no-op — all 136 carry a deck —
so ~95% of first impressions opened somewhere a beginner has no name for (Gogoplata Control, Estima
Lock Control, Hindulotine, Shoulder of Justice). A fresh profile's ONE first roll is now drawn from
real roll traffic instead: `curriculum.weights` (the graph's stationary distribution, the same number
Game Knowledge is built on) summed per position via each technique's single canonical origin,
sharpened by `START_BIAS.gamma` and mixed with 2% uniform so all 136 keep a real chance. Measured:
the six nameable hubs go from 4.4% of first impressions to ~66%. **Returning players are untouched**
— same tag, same single draw, the historical uniform mapping, asserted `u`-by-`u`.

**What the card CALLS it.** Every one of those 136 hub titles ends in "Top" (the visual graph
collapses a position to one node and labels it with the top role), while the side you play is an
independent coin flip — so half of all cold starts read "X-Guard Top" over "Bottom", above the bottom
player's hand. The name line is now role-free and `roleTxt` is the only place a side is named.

The brief proposed deriving `playerRole` from the node title, the way `rollFromPosition()` does. That
is not available: a title-derived role is a CONSTANT ("top") across all 136, so it would delete
bottom play from the game — which is also why `rollFromPosition` and every staged/roamed roll can
only ever deal a top hand, and why `playFrom(idx, role)` has to set the role itself. Pinned by
`first-impression.spec.ts`.

**And the DECK behind the card had the same bug, one layer down (v1.82.4).** `deckRole()` read the
side off the node title first and only fell back to `playerRole` — and since all 136 titles end in
"Top", that fallback was dead code. So on every bottom landing the card's question and familiarity
chip, `_posKey` (and its odds bonus), the roll-log row, `_exploredKeys` and `_maybeLessonDone` all
described the TOP deck; 13 curriculum lessons are authored against a `|Bottom` deck key, so playing
bottom could never complete one. There is now ONE seam, `playedRole(node)`: for the node you are
standing on the answer is `playerRole` (the same value the hand is filtered by and the card prints);
for any other node there is no side in play and the constant title is all there is, so side-agnostic
lookups are unchanged. The dossier's role badge goes through it too. WIN 2 is now a PROPERTY over all
272 (136 positions x 2 sides) rather than the one hand-picked X-Guard case.

**WHAT IS STILL WRONG, AND IS NOT A COLD-START BUG — for the owner (v1.82.4).** The label and the deck
now agree about your side. The CONTENT of the hand does not, and WIN 1 made that matter more because it
sends newcomers to exactly the states where it is worst. `optionsFor` decides "is this move mine?" from
the strength pair `n.s` (`myVal >= oppVal - 0.05`) — whether the move's OUTCOME favours me — while the
authored truth about whose move it is lives in `fromRole`. Measured on the emitted `graph-data.json`:

| state, side you play | role-filtered candidates | authored for the OTHER side | submissions |
|---|---|---|---|
| Closed Guard, TOP | 22 | 19 (`fromRole: bottom`) | 14 |
| Half Guard, BOTTOM | 22 | 14 (`fromRole: top`) | 0 |
| Half Guard, TOP | 15 | 6 | 6 |
| Mount, BOTTOM | 7 | 2 | 0 |
| Side Control, TOP | 23 | 0 | 16 |

So the friendliest opening WIN 1 can give a newcomer — Closed Guard, playing top — deals a hand that
is mostly the guard player's finishes. Side Control/top is coherent, which is why the original probe,
which happened to look there, saw nothing. Related hole, same root: **54 of the 136 positions carry NO
adjacent technique whose canonical origin (`fromPositionId`) is that position**, so for **109 of the
272** position x side combos the contextual+role filter empties and `optionsFor` falls through to its
documented unfiltered escape ("safety: if role-filtering left nothing"). That escape count is asserted
as a non-growing ceiling in `first-impression.spec.ts`.

This is game-wide, pre-existing content/graph coherence (`project_graph_coherence_invariant`), NOT a
cold-start defect, and it is deliberately NOT fixed inside journey 3 — fixing it means deciding whether
the graph's origin roles are wrong or whether `optionsFor` should filter on `fromRole` (in which case
every position's authored `attempt_probability` map has to cover both sides). Reproduced and parked as
**Q008** — `e2e/quarantine/side-named-hand-authored-for-other-side.spec.ts` + `e2e/quarantine/ISSUES.md`.

## How to regenerate

The gates (deterministic, hermetic, in the push suite) — these write NOTHING:

```bash
npx playwright test -c e2e/playwright.coldstart.config.ts coldstart-funnel coldstart-backfill coldstart-spine coldstart-late-payload first-impression
```

## Making the skew visible to a test (v1.82.4)

Every spec above used to serve `flashcards.json` and `curriculum.json` from an in-memory buffer,
instantly — so the 18-second window between the first playable hand (7.0s) and the comprehension
payloads (25.3s / 27.0s) did not exist inside the harness, and no cold-start claim could be checked
against the case it was about. The DSL now takes a late-payload declaration:

```ts
await j.boot("/", { payloads: { "flashcards.json": { afterSim: 18 } } })  // N SIMULATED seconds
await j.boot("/", { payloads: { "curriculum.json": { never: true } } })   // a stalled connection
j.releasePayload("flashcards.json")   // land a held one early
j.payloadTimeline()                   // when each was asked for and served, in both clocks
```

`afterMs` is the wall-clock variant. `never` is deliberately NOT a 404: an aborted fetch takes the
app's `.catch()` branch, a stalled one leaves the promise pending, and only the second is what a
mobile radio does. Patterns are globs over the request URL, so per-deck chunks work without touching
the DSL. The rule is armed before the first navigation (the delay layer is registered LAST, above
every serving handler, and `fallback()`s to it), which is also what removed `coldstart-spine`'s
throwaway boot; declaring `flashcards.json` late relaxes `boot()`'s readiness gate, since the app's
own boot does not wait for the decks either.

The JSON fixtures below are TRACKED, CITED evidence, so they are refreshed **deliberately**, never
as a side effect of a test run. v1.82.0 wrote them on every non-CI run, which left the tree dirty
after a green test and made any later diff of the evidence untrustworthy:

```bash
COLDSTART_CAPTURE=1 npx playwright test -c e2e/playwright.coldstart.config.ts coldstart-funnel first-impression
```

The probes (opt-in, NOT in any gate — one of them loads ~10MB over a throttled link):

```bash
COLDSTART_PROBE=1 npx playwright test -c e2e/playwright.coldstart.config.ts coldstart-probe
```

Use a PRIVATE-PORT config (`playwright.coldstart.config.ts`, or `playwright.private.config.ts` with
`PW_TESTDIR`) for any local run. `playwright.config.ts` and `playwright.gen.config.ts` both hardcode
`:8123` with `reuseExistingServer: true`, and on a box running several worktrees a run will happily
grade a DIFFERENT worktree's `source/public`. That happened twice during this investigation.

## Files

| File | Written by | What it shows |
|------|-----------|---------------|
| `cold-start-observation.json` | `coldstart-funnel.spec.ts` | the first three states a fresh visitor sees: every visible overlay's text, which surfaces are mounted, the funnel marks so far |
| `cold-start-beats.json` | `coldstart-funnel.spec.ts` | `{beats, funnel}` — the gameplay `fx()` stream and the cold-start marks, for that cold session |
| `probe-first-roll-pool.json` | `coldstart-probe.spec.ts` | the 136-entry pool `startRoll()` draws a first-ever position from, and what each decile of the uniform draw yields. **PRE-v1.82.3 capture, kept as the proof of WIN 1** — the `withDeck` filter it shows as a no-op (136 of 136) is exactly the bug. After: `first-impression-draw.json` |
| `probe-chrome.json` | `coldstart-probe.spec.ts` | computed visibility + text of every chrome surface at the first landing |
| `probe-late-payload.json` | `coldstart-probe.spec.ts` | the landing card with the deck payload missing, and again after `onFlashcardsReady()`. **PRE-v1.82.1 capture, kept as the proof of the bug** — re-running the probe now shows `after.hasQ: true`. Gate: `e2e/journeys/coldstart-backfill.spec.ts` |
| `probe-role-mismatch.json` | `coldstart-probe.spec.ts` | the identity line ("X-Guard Top") against the side actually being played ("Bottom"). **PRE-v1.82.3 capture, kept as the proof of WIN 2.** After: `first-impression-role-*.json`. Gate: `e2e/journeys/first-impression.spec.ts` |
| `probe-throttled-timeline.json` | `coldstart-probe.spec.ts` | an unrigged Fast-4G cold load: resource timings for the whole neural data layer against when each surface appears |
| `first-impression-draw.json` | `first-impression.spec.ts` | WIN 1 after-state: the whole first-ever `start-pos` draw swept, and where the mass lands (uniform baseline 6/136 = .044) |
| `first-impression-role-top.json`, `first-impression-role-bottom.json` | `first-impression.spec.ts` | WIN 2 after-state: the identity card's two lines against the side actually played, and the hand dealt under it, for BOTH role outcomes |

Screenshots of the three states go to `e2e/gallery/coldstart-*.png` (gitignored — each is ~1MB of
WebGL canvas), and only under `COLDSTART_CAPTURE=1`.
