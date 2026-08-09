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
`reason`, and any spine mark that arrives with an earlier one missing carries `out_of_order: true`
plus a `skipped` list. So the analysis never has to infer a drop-off from an absence.

**The marks are NOT in `window.__neural.beats`.** They live in `window.__neural.csBeats`. The funnel
is an observer, and an observer that mutates the gameplay beat stream is visible to the thing it
measures — it broke seven `e2e/gen` specs that use a fresh life's empty beat stream as their
"rebuilt, not resumed" proof.

## How to regenerate

The gates (deterministic, hermetic, in the push suite) — these write NOTHING:

```bash
npx playwright test -c e2e/playwright.coldstart.config.ts coldstart-funnel coldstart-backfill coldstart-spine
```

The JSON fixtures below are TRACKED, CITED evidence, so they are refreshed **deliberately**, never
as a side effect of a test run. v1.82.0 wrote them on every non-CI run, which left the tree dirty
after a green test and made any later diff of the evidence untrustworthy:

```bash
COLDSTART_CAPTURE=1 npx playwright test -c e2e/playwright.coldstart.config.ts coldstart-funnel
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
| `probe-first-roll-pool.json` | `coldstart-probe.spec.ts` | the 136-entry pool `startRoll()` draws a first-ever position from, and what each decile of the uniform draw yields |
| `probe-chrome.json` | `coldstart-probe.spec.ts` | computed visibility + text of every chrome surface at the first landing |
| `probe-late-payload.json` | `coldstart-probe.spec.ts` | the landing card with the deck payload missing, and again after `onFlashcardsReady()`. **PRE-v1.82.1 capture, kept as the proof of the bug** — re-running the probe now shows `after.hasQ: true`. Gate: `e2e/journeys/coldstart-backfill.spec.ts` |
| `probe-role-mismatch.json` | `coldstart-probe.spec.ts` | the identity line ("X-Guard Top") against the side actually being played ("Bottom") — still OPEN, this is WIN 2 |
| `probe-throttled-timeline.json` | `coldstart-probe.spec.ts` | an unrigged Fast-4G cold load: resource timings for the whole neural data layer against when each surface appears |

Screenshots of the three states go to `e2e/gallery/coldstart-*.png` (gitignored — each is ~1MB of
WebGL canvas), and only under `COLDSTART_CAPTURE=1`.
