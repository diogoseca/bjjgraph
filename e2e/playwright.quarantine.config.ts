import { defineConfig } from "@playwright/test"

// QUARANTINE suite — known-red specs capturing REAL gameplay bugs found by the test-gen
// waves (each links an entry in e2e/quarantine/ISSUES.md). Excluded from every gate; run
// on demand (`npm run e2e:quarantine`) — a spec here going GREEN means its bug got fixed:
// move it to e2e/gen/, flip its ledger status to accepted, and close the ISSUES entry.
export default defineConfig({
  testDir: "./quarantine",
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
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
