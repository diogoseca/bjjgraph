import { defineConfig } from "@playwright/test"

// The /dev Forward catalog gate, on its OWN port :8131 with reuseExistingServer:false.
//
// Same reason every other config got a dedicated port in v1.81.2/v1.81.3: `npx serve` resolves
// `../source/public` from its own cwd, so a config that reuses a server started by ANOTHER
// worktree tests someone else's `source/public` and any result from it is unreportable.
//
// This one exists so the catalog can be gated WITHOUT a full site build: the four /dev routes
// are emitted by `npm run build:forward` alone (seconds), while e2e/playwright.config.ts serves
// the whole built site (~10 minutes of Quartz). Same spec file, same assertions.
export default defineConfig({
  testDir: "./journeys",
  testMatch: "forward-components.spec.ts",
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8131",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx serve ../source/public -l 8131 --no-clipboard",
    url: "http://localhost:8131/dev/",
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
