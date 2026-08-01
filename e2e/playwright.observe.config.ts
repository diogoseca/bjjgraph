import { defineConfig } from "@playwright/test"

// OBSERVED replay — run any gen/core spec so the OWNER CAN WATCH IT LIVE from another
// machine: the browser exposes CDP on :9222, the owner opens the DevTools screencast
// (see paired-debugging SKILL.md), and slowMo paces the journey to be followable.
//   npm run e2e:observe -- gen/<spec>.spec.ts            (or ../journeys/<spec>.spec.ts)
//   OBSERVE_SLOWMO=600 npm run e2e:observe -- ...        (default 300ms per action)
// Not a gate — single spec at a time, human pacing, screenshots off.
export default defineConfig({
  testDir: ".", // pass an explicit spec path relative to e2e/
  timeout: 900_000, // slowMo stretches everything; generous ceiling for watched runs
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8123",
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: ["--remote-debugging-port=9222"],
      slowMo: Number(process.env.OBSERVE_SLOWMO || 300),
    },
  },
  webServer: {
    command: "npx serve ../source/public -l 8123 --no-clipboard",
    url: "http://localhost:8123",
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
