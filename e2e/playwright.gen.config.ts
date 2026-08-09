import { defineConfig } from "@playwright/test"

// GENERATED journey suite (hyperspace test-gen waves) — kept SEPARATE from the core
// push gate (playwright.config.ts, e2e/journeys) so the gate stays ~35 min. Same rails:
// deterministic rigged RNG, manual frame pump, no retries. Specs live in e2e/gen/ and each
// carries a machine-readable /* @hyperspace {...} @invariant "..." */ header tracked in
// e2e/gen/ledger.json.
//
// DEDICATED PORT, reuseExistingServer:false (v1.81.2). This config used to serve on :8123
// with `reuseExistingServer: true` — the same port and policy as the core config. Several
// worktrees of this repo are worked on in parallel, and `npx serve source/public` resolves
// source/public from ITS OWN cwd. So whichever worktree started :8123 first owned it, and
// every later run silently tested THAT worktree's build: measured here, a run from
// bjjgraph-share was served a 343,153-byte neural.js from bjjgraph-legacy while this
// worktree's own bundle was 364,190 bytes. That is the whole mechanism behind a "flaky,
// order-dependent" spec — the build under test changed underneath the suite (a sibling
// worktree rebuilding source/public mid-run does the same thing).
//
// The cost of `false` is that a run killed mid-flight leaks the server and the next run dies
// with "8127 is already used" — a loud, specific error (`kill $(ss -ltnp | grep 8127 …)`).
// That is strictly better than a green suite that tested somebody else's bytes. Same
// reasoning, same trade, as e2e/playwright.share.config.ts.
export default defineConfig({
  testDir: "./gen",
  timeout: 240_000, // same ceiling as core: real time only covers boots + evaluates
  retries: 0, // deterministic by design — a retry hides a rails bug
  workers: 1, // CPU-bound frame pumps; validation runs are additionally flock-serialized
  reporter: [["list"], ["html", { outputFolder: "report-gen", open: "never" }]],
  use: {
    baseURL: "http://localhost:8127",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx serve ../source/public -l 8127 --no-clipboard",
    url: "http://localhost:8127",
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
