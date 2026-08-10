import { defineConfig } from "@playwright/test"

// E2E user-journey suite for the Neural Graph app — the PERMANENT gameplay regression gate.
// Serves the BUILT site (source/public) statically; journeys play as the user against the
// real bundle with the deterministic test rails (rigged RNG + manual frame pump).
//
// DEDICATED PORT :8133, reuseExistingServer:false (v1.81.3). This config used to serve :8123
// with server reuse ENABLED, which the gen (:8127) and share (:8129) configs both moved
// off in v1.81.2 for a measured reason: several worktrees of this repo are worked on in
// parallel, and `npx serve` resolves `../source/public` from ITS OWN cwd. Whichever worktree
// started :8123 first owned it, and every later run silently tested THAT worktree's build —
// measured, a run from `bjjgraph-share` was served a 343,153-byte `neural.js` from
// `bjjgraph-legacy` (ours was 364,190). The gate that most needs to be trustworthy was the last
// one still exposed to it, which also made "the suite ran green" unverifiable from the tree.
// The cost is that a run killed mid-flight leaks the server and the next run dies with
// "8133 is already used" — a loud, specific error, strictly better than a green suite that
// tested somebody else's bytes. CI is unaffected: each shard is its own container.
export default defineConfig({
  testDir: "./journeys",
  timeout: 240_000, // per-test ceiling; sim time is pumped, so real time only covers boots + evaluates (CI runners run ~4x slower than the dev box)
  retries: 0, // journeys are deterministic by design — a retry hides a rails bug
  workers: 1, // measured: workers=2 is only ~20% faster locally (CPU-bound frame pumps) and risks re-introducing boot timeouts on 2-core CI runners
  reporter: [["list"], ["html", { outputFolder: "report", open: "never" }]],
  use: {
    baseURL: "http://localhost:8133",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx serve ../source/public -l 8133 --no-clipboard",
    url: "http://localhost:8133",
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
