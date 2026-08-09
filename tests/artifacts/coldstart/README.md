# Cold-start observation (journey 3, Phase 1)

Evidence for "does a cold visitor actually understand this app?". Every file here is machine-written
by a spec — nothing in this directory is hand-authored except this README.

## How to regenerate

The gate (deterministic, hermetic, in the push suite):

```bash
npx playwright test -c e2e/playwright.config.ts coldstart-funnel
```

The probes (opt-in, NOT in any gate — one of them loads ~10MB over a throttled link):

```bash
COLDSTART_PROBE=1 npx playwright test -c e2e/playwright.coldstart.config.ts coldstart-probe
```

Use `playwright.coldstart.config.ts` for the probes: it binds a private port. The shared config
hardcodes `:8123` with `reuseExistingServer: true`, and on a box running several worktrees a probe
will happily measure a DIFFERENT worktree's `source/public`. That happened during this
investigation — the first probe runs reported `_cs: null` because they were loading a neighbouring
build with none of this branch's instrumentation.

## Files

| File | Written by | What it shows |
|------|-----------|---------------|
| `cold-start-observation.json` | `coldstart-funnel.spec.ts` | the first three states a fresh visitor sees: every visible overlay's text, which surfaces are mounted, the funnel marks so far |
| `cold-start-beats.json` | `coldstart-funnel.spec.ts` | the full `fx()` beat stream for that cold session |
| `probe-first-roll-pool.json` | `coldstart-probe.spec.ts` | the 136-entry pool `startRoll()` draws a first-ever position from, and what each decile of the uniform draw yields |
| `probe-chrome.json` | `coldstart-probe.spec.ts` | computed visibility + text of every chrome surface at the first landing |
| `probe-late-payload.json` | `coldstart-probe.spec.ts` | the landing card with the deck payload missing, and again after `onFlashcardsReady()` — the card does not gain its question. **PRE-v1.82.1 capture, kept as the proof of the bug**: re-running the probe now shows `after.hasQ: true`, because the fix landed. The fix's own gate is `e2e/journeys/coldstart-backfill.spec.ts` |
| `probe-role-mismatch.json` | `coldstart-probe.spec.ts` | the identity line ("X-Guard Top") against the side actually being played ("Bottom") |
| `probe-throttled-timeline.json` | `coldstart-probe.spec.ts` | an unrigged Fast-4G cold load: resource timings for the whole neural data layer against when each surface appears |

Screenshots of the three states go to `e2e/gallery/coldstart-*.png` (gitignored — each is ~1MB of
WebGL canvas).
