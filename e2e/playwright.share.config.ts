import { defineConfig } from "@playwright/test";

// Share-link journeys, on their OWN port.
//
// Why not the core config: it serves on :8123 with `reuseExistingServer: true`, and several
// worktrees of this repo are worked on in parallel. A fixture server started by ANOTHER
// worktree is happily reused, so the suite silently tests a different build's source/public —
// measured, not theorised: a share-link run reused a :8123 server whose cwd was
// /home/user/Documents/bjjgraph-legacy and failed on assertions about files that existed here
// all along. A dedicated port + `reuseExistingServer: false` makes that impossible.
//
// Everything else matches e2e/playwright.config.ts (same DSL, same rails, workers=1,
// retries=0 — a deterministic journey must not be retried into passing).
export default defineConfig({
  testDir: "./journeys",
  testMatch: /share-lists\.spec\.ts/,
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8129",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: {
    // reuseExistingServer stays FALSE on purpose. The cost is that a run killed mid-flight
    // leaks the server and the next run dies with "8129 is already used" — a loud, specific
    // error you fix with `kill $(ss -ltnp | grep 8129 …)`. That is strictly better than the
    // alternative failure, which is a green suite that tested somebody else's build.
    command: "npx serve ../source/public -l 8129 --no-clipboard",
    url: "http://localhost:8129",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
