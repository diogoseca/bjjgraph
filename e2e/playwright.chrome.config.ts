import { defineConfig } from "@playwright/test";

/**
 * PRIVATE PORT **AND** PRIVATE SERVE ROOT.
 *
 * `playwright.private.config.ts` already fixed the port-sharing hazard between worktrees. It
 * does not fix the one this session hit: TWO agents working inside the SAME worktree, both
 * running `node neural/build/build.mjs` and copying the result over `source/public/static/
 * neural/app/`. A run that starts against your bundle can be served somebody else's three
 * seconds later — measured here as tests hanging to the 240s ceiling, mid-suite, with no
 * failure that pointed at the cause.
 *
 * So this config serves `.privserve/public` — a hardlink farm of `source/public` whose ONLY
 * real (non-linked) files are the neural bundle you built. Rebuild it with:
 *
 *   rm -rf .privserve && mkdir .privserve && cp -al source/public .privserve/public
 *   rm .privserve/public/static/neural/app/neural.{js,css}   # break the links
 *   cp neural/dist/neural.{js,css} .privserve/public/static/neural/app/
 *
 *   PW_PORT=8141 npx playwright test -c e2e/playwright.chrome.config.ts <spec>
 *
 * `.privserve` sits under the repo's `public/` gitignore rule, so it is never committed.
 */
const PORT = process.env.PW_PORT || "8141";
const DIR = process.env.PW_TESTDIR || "./journeys";
const ROOT = process.env.PW_SERVE_ROOT || "../.privserve/public";

export default defineConfig({
  testDir: DIR,
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node ../node_modules/serve/build/main.js ${ROOT} -l ${PORT} --no-clipboard`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
