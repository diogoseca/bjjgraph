import { defineConfig } from "@playwright/test"

/**
 * THE HISTORY-REPLAY SUITE — its own port, its own server (v1.106.5).
 *
 * `npx serve ../source/public` resolves that path from THIS config's cwd, so a config that reuses
 * a server started by another worktree silently tests someone else's bundle (measured once at
 * :8123: a 343,153-byte neural.js served where the running tree's was 364,190). Every gate here is
 * `reuseExistingServer: false` on a port of its own for that reason — core :8133, gen :8127,
 * share :8129, and this one :8151.
 *
 * The cost of that rule is that a run killed mid-flight leaks the server and the next start dies
 * with "8151 is already used": kill the listener and re-run.
 */
export default defineConfig({
  testDir: "./journeys",
  testMatch: /history-replay\.spec\.ts/,
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8151",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx serve ../source/public -l 8151 --no-clipboard",
    url: "http://localhost:8151",
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
