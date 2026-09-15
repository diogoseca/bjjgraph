import { defineConfig } from "@playwright/test";

/**
 * PRIVATE-PORT runner — same suites, a port nobody else can be holding.
 *
 * `playwright.config.ts` and `playwright.gen.config.ts` both hardcode :8123 with
 * `reuseExistingServer: true`. That is right for CI, where one build owns the box. It is actively
 * dangerous on a dev machine running several worktrees: whichever worktree's `serve` got to :8123
 * first is the build every later run tests, silently. This session confirmed it — :8123 was held by
 * a neighbouring worktree's server while these journeys were being verified, so a run through the
 * shared config would have graded another branch's bundle and reported it as ours.
 *
 * So: our own port, `reuseExistingServer: false`, and `serve` resolved out of node_modules rather
 * than `npx` (which can fetch a different version mid-run).
 *
 * ALSO: `TMPDIR`. Chromium's user-data-dir and temp files land there (default `/tmp`), which on
 * the dev box is the 25G ROOT volume — not the 98G `/home` one this repo sits on. With root full
 * the browser dies mid-suite as `ERR_INSUFFICIENT_RESOURCES` / `Target crashed` / a 240s timeout
 * on a 2s spec, the failing route MOVES between runs, and it is indistinguishable from
 * contention. Measured on one commit, idle box: `forward-components.spec.ts:716` red 3-of-3 with
 * 111M free on `/`, green 2-of-2 with TMPDIR on `/home`. Check `df -h /` before believing a red.
 *
 *   PW_TESTDIR=./journeys npx playwright test -c e2e/playwright.private.config.ts
 *   PW_TESTDIR=./gen      npx playwright test -c e2e/playwright.private.config.ts
 *   TMPDIR=/home/user/tmp-pw PW_TESTDIR=./journeys npx playwright test -c e2e/playwright.private.config.ts
 */
const PORT = process.env.PW_PORT || "8131";
const DIR = process.env.PW_TESTDIR || "./journeys";

export default defineConfig({
  testDir: DIR,
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node ../node_modules/serve/build/main.js ../source/public -l ${PORT} --no-clipboard`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
