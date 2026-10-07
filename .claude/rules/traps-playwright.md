---
paths:
  - "e2e/**"
  - "tests/**"
---

## 6. THOUGHT TRAPS — Playwright and the harness: 6.3 assertions · 6.4 harness

Split out of `CLAUDE.md` at v1.224.3: it loads with the `paths:` above, and CLAUDE.md §6's index
names it. CLAUDE.md §0 and §9 decide what belongs here; `npm run validate:claudemd` gates its size
and references.

### 6.3 Before you write — or trust — a Playwright assertion

- **`locator.click()` is not a mouse.** It scrolls into view and dispatches ON the element, so it cannot prove reachability and it masks every overlay trap in group 1 (§6.1, `.claude/rules/traps-neural.md`) completely. **`j.clickByMouse(sel)` is the only claim:** it measures the centre, refuses to scroll, refuses an off-screen centre, and fails if `elementFromPoint` is anything but the target or a DESCENDANT of it — an intercepting ANCESTOR is a failure, not a pass. On mobile use `page.mouse.click` / `page.touchscreen.tap` at MEASURED coordinates plus an effective-opacity walk up the ancestor chain.
  <br>_(4+ (every instance in group 1 was masked by it))_

- **Never assert a render by re-implementing it.** A spec-side copy of a filter, of "what the node set is", or of a screen coordinate is written from the same reading of the code under test — usually with the fix already in it — so it agrees by construction and reports green on a build you have already broken. **The v1.126.0 audit BUILT to find this class committed it:** its probe measured `nodes.filter(n => n.rep && …)` and reported "identical" about Explore's search, which was doubling every hit and halving its own 120-row cap.
  **Do:** drive the real entry point (`renderExplorer()`, `optionsFor()`, `draw()`) and assert on what it EMITTED — DOM rows, duplicate row TEXT, read-back pixels. When the geometry lives in a draw-local closure (`halfW`, `ox`) you cannot recompute it at all: read what the frame PUBLISHED (`_lastPairLabel`, `_lastRichLabel`, `this._LY`), which is the render's output, not a second implementation. A second implementation is legitimate ONLY when it also asserts SET EQUALITY against the app's own result (`option-hand.spec.ts`).
  <br>_(10 (6 specs in v1.125.0, the audit itself, 3 specs pinned to a moved label in v1.129.4))_

- **A probe is evidence for a commit message; only a spec is a gate.** `tests/artifacts/_*_probe.mjs` measured the mobile framing (v1.128.1) and the focus kicker (v1.129.1), both shipped, and in both cases the mutant SURVIVED the red-proof pass because no journey covered them — the same lesson two versions running. **Do:** mutate every claim; a surviving mutant means the claim has no gate. And **record non-kills in the spec's own header** — `dual-pair.spec.ts` names its two, so nobody later reads that spec as covering them.
  <br>_(3 (v1.128.1, v1.129.1, plus the reverted tray drag whose own mutants could not kill its test))_

- **A journey that leaves a gameplay `rng()` tag unrigged has not chosen a branch — it has bought a lottery ticket, and the ticket only prints when it loses.** `graph-naming` left `rng("opp-finish")` live, so the opponent could submit you and END the round before the journey's second landing: **6 failures in 78 un-rigged runs (7.7%) vs 0 in 30 rigged**, and P(four consecutive green full suites) ≈ 0.73, so three earlier clean reports were never evidence of absence. The fix is DEDUCTIVE — rig the value so the branch is unreachable — and the counts are corroboration, not proof.
  **Do:** when a journey's subject is what happens AFTER an exchange, rig every draw that can end the exchange early. The 13 static tags: `start-pos role outcome resolve max-moves ai-skill opp-pick opp-sub-pick opp-finish mc-pick mc-shuffle escape checkpoint-pick`, plus surface-scoped variants (`land-mc-pick`, `land-mc-shuffle`) so a landing card can never eat the sidebar's rigged queue. `scripts/check_no_raw_random.sh` pins the seam: exactly 1 `Math.random()` in `app.src.jsx`, 0 in `sound.src.js`.
  <br>_(1 measured, on a journey that had been a coin toss in every version it existed)_

- **A green gate is evidence only about what that gate can SEE.** `payload-first-hand` pins `start-pos:[0]` — a 7-card hand — so it reports the same bytes with the hand cap and without it: **do not read a green payload gate as evidence about hand size.** `replay-digest` rigs one scripted roll on a single-success-cell submission, so the outcome-kernel fix, the `cardOrder` retirement and the loss-aversion dial were all structurally invisible to it — and **no fixture holds the expected digest anywhere in the repo** (`triple_replay.sh` compares runs to each other), so the hashes in prose describe nothing checkable.
  **Do:** cite a gate only for a claim a mutant of that claim makes red; otherwise write its blind spot in the same sentence as the green. **And if your change SHOULD have moved the digest and did not, that is the finding.**
  <br>_(12 (incl. 4 separate re-discoveries of the digest case))_

- **An assertion stricter than its own claim goes RED on a CORRECT build.** "Nothing is drawn above the name" fails on the name's own ascenders; "nothing is drawn at merge scale" is false because the ordinary hover label takes over; "the announcer is blank after staging" is false because a staged landing may legitimately say something else. **Do:** assert the DIFFERENTIAL the change is about, against a CONTROL FRAME — everything the graph would draw anyway subtracts to zero, and the constant contribution cancels. **After relaxing an assertion, re-run its mutant**, so "less strict" does not become "less able to fail".
  <br>_(3 named together in v1.129.0, plus 3 label-position specs in v1.129.4 and 5 mutants needed in v1.114.0)_

- **`nth()` · `all()[i]` — pair cards across a re-sort by IDENTITY (`data-tech` plus its occurrence), never by POSITION.** A grade or a Win-chance update re-sorts the hand (#267's outcome-on-cards), so index *i* after is another card than index *i* before. <br>_(1)_


### 6.4 Before you rely on the harness (DSL, ports, payloads, which build is under test)

- **A harness payload pattern is a SUBSTRING of the request URL, so a stale name matches nothing and holds nothing.** Twelve rules armed `"flashcards.json"`, which the app has not fetched since v1.80.4 (it fetches `flashcards/_index.json` via `_dataBase()`), so every cold-start assertion about the ~18s skew measured a fully-warm boot — root cause of 15 red journeys. The same dead name hid in `build.mjs`, whose guard only warned when EVERY rewrite missed. **Do:** a rewrite/substitution table must THROW when a rule's `from` string is absent from the source (`neural/build/build.mjs` does now); when a rule holds a payload, assert the timeline shows it held.
  <br>_(2 (12 harness rules + 2 of 4 build rewrites))_

- **Name what the harness does NOT serve, beside every assertion — if the absence alone satisfies it, the assertion is about the harness.** The DSL serves `{}` for dossier chunks, so there is no film strip and most states legitimately have no `More` fold; a journey about either must AUTHOR content. `test.use({ reducedMotion })` leaves `matchMedia` FALSE here, so a spec relying on the fixture option **asserts nothing and passes forever** — use `page.emulateMedia`. Non-localhost requests are aborted, which is why the GitHub-stars `.catch` is load-bearing. A screenshot taken under the harness photographs the harness (`tests/artifacts/_owner_shoot.mjs` drives the real dev server for exactly this reason).
  <br>_(7)_

- **A spec in a directory no config's `testDir` collects is a NOTE, not a gate.** the old prototype specs directory (since deleted) was collected by nothing — not `package.json`, not `.github/workflows/`, not any config (only `playwright.{private,chrome}.config.ts` take `PW_TESTDIR`, from a hand-typed invocation) — so its three journeys ran when somebody remembered, through thirteen versions that included making their subject the DEFAULT and deleting the flag they booted with. **Do:** before claiming coverage, check the spec is actually collected. A spec that needs a gitignored payload cannot be a gate at all.
  <br>_(1 (3 journeys, 13 versions))_

- **A result taken while another process could write the tree under test is not a result.** A config with `reuseExistingServer:true` on a shared port means whichever WORKTREE started it owns it, and every later run tests THAT worktree's `source/public` — measured, a run was served a 343,153-byte `neural.js` where its own was 364,190. Every gate suite now owns a dedicated port with `reuseExistingServer:false` (core :8133 · gen :8127 · share :8129 · replay :8151 · catalog :8131; only `observe`/`quarantine` reuse, deliberately).
  **And `npm run build` does NOT rebuild the neural bundle** — a stale served `neural.js` makes neural journeys silently 240s-timeout and looks exactly like contention or a regression. Refresh with `npm run dev:neural:app` (<1s). Cache keys must name the RESOLVED artifact version, never a file that changes on every commit (the Playwright cache was keyed on `package-lock` in a repo that bumps the version every commit: the key missed every run while still uploading 261 MiB).
  <br>_(3)_


- **A WebGL context left alive on the OLD page stalls the NEXT navigation, and it presents as "the page load hangs".** Headless Chromium (SwiftShader) defers a navigation's COMMIT while the previous page's GL contexts tear down, scaling with frames drawn — and every CDP signal (goto resolution, `frameNavigated`, evaluate against the new context) waits together, so nothing points at GL. It once put the curated gate over its 12-minute ceiling on **every** dev deploy for three days, which silently SKIPPED the deploy step and left the dev preview stale for ~6 days.
  **Do:** any new WebGL surface on a page the journeys boot must either early-return on `window.__NEURAL_TEST__` or be registered for the sweep in `e2e/dsl.ts` (contexts are recorded at creation into `__glCtxs` and lost before navigation). **Never probe with `getContext("webgl")` to DETECT a context — that CREATES one**, at ~11s to make and lose.
  **Diagnostic:** if the dev preview looks stale, read the gate step's DURATION before assuming a content problem.
  <br>_(the two Pixi surfaces that caused it are deleted, but the sweep and the guard are live and load-bearing)_

- **`ERR_INSUFFICIENT_RESOURCES` · `Target crashed` · a 240s timeout on a spec that takes 2s — read `df -h /` BEFORE reading the diff.** Chromium's user-data-dir and temp files go to `TMPDIR` (default `/tmp`), which on this host is the 25G ROOT volume, not the 98G `/home` one the repo sits on. A full root does not fail loudly: the browser dies on the 4th or 5th heavy navigation in one page, the failing route MOVES between runs, and every other test in the same file passes. Measured: `forward-components.spec.ts:716` red 3-of-3 at 6.2s with 111M free, green 2-of-2 at 2.0s with `TMPDIR=/home/user/tmp-pw`, same commit, same idle box. It also mimics contention exactly (`browserContext.close: Target … has been closed` under a full suite), so it is the first thing to rule out, not the last.
  **Do:** `TMPDIR=<dir on the roomy volume> npx playwright test …`, and never conclude a red is "load" or "content" until `df` is clean. Ruling out shm (`--disable-dev-shm-usage`) and the disk CACHE (`--disk-cache-dir`) does not rule out the profile — that is the mistake that cost a session here.
  <br>_(1 measured, and it had already been misread twice as contention)_
