import { defineConfig } from "@playwright/test"

// E2E user-journey suite for the Neural Graph app — the PERMANENT gameplay regression gate.
// Serves the BUILT site (source/public) statically; journeys play as the user against the
// real bundle with the deterministic test rails (rigged RNG + manual frame pump).
export default defineConfig({
  testDir: "./journeys",
  timeout: 120_000, // per-test ceiling; sim time is pumped, so real time only covers boots + evaluates
  retries: 0, // journeys are deterministic by design — a retry hides a rails bug
  workers: 1, // deterministic suite; parallel workers only contend for the 13MB payloads
  reporter: [["list"], ["html", { outputFolder: "report", open: "never" }]],
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
