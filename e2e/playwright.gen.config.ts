import { defineConfig } from "@playwright/test"

// GENERATED journey suite (hyperspace test-gen waves) — kept SEPARATE from the core
// push gate (playwright.config.ts, e2e/journeys) so the gate stays ~35 min. Same rails:
// built site on :8123 (shared server, reuseExistingServer), deterministic rigged RNG,
// manual frame pump, no retries. Specs live in e2e/gen/ and each carries a machine-readable
// /* @hyperspace {...} @invariant "..." */ header tracked in e2e/gen/ledger.json.
export default defineConfig({
  testDir: "./gen",
  timeout: 240_000, // same ceiling as core: real time only covers boots + evaluates
  retries: 0, // deterministic by design — a retry hides a rails bug
  workers: 1, // CPU-bound frame pumps; validation runs are additionally flock-serialized
  reporter: [["list"], ["html", { outputFolder: "report-gen", open: "never" }]],
  use: {
    baseURL: "http://localhost:8123",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx serve ../source/public -l 8123 --no-clipboard",
    url: "http://localhost:8123",
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
