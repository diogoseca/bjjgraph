import { defineConfig } from "@playwright/test";

/**
 * COLD-START OBSERVATION config — a PRIVATE port, deliberately not :8123.
 *
 * `playwright.config.ts` hardcodes :8123 with `reuseExistingServer: true`. That is correct for
 * the shared gate, but this box runs several worktrees at once: during journey 3's Phase 1 the
 * probe runs silently measured ANOTHER worktree's `source/public` (a 338,437-byte neural.js with
 * none of this branch's instrumentation) because that worktree's `serve` already owned :8123.
 * Every conclusion drawn from those runs was about someone else's build.
 *
 * So: our own port, `reuseExistingServer: false`, and `serve` resolved from node_modules rather
 * than `npx` (which would silently fetch a different version).
 *
 *   COLDSTART_PROBE=1 npx playwright test -c e2e/playwright.coldstart.config.ts
 */
const PORT = process.env.COLDSTART_PORT || "8127";

export default defineConfig({
  testDir: "./journeys",
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
