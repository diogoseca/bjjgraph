import { defineConfig } from "@playwright/test";

// Explicit private port and our own fresh app build. This focused fixture is not
// a Quartz/full-site/curated-suite receipt. The journeys also run in core CI.
const port = Number(process.env.GAMEPLAN_PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || [8080, 8133, 8127, 8129, 8151, 8131].includes(port)) {
  throw new Error("Set GAMEPLAN_PORT to a verified-free private port");
}
export default defineConfig({
  testDir: "./journeys", testMatch: "gameplan-learning-loop.spec.ts", workers: 1,
  timeout: 90_000, retries: 0, reporter: "list",
  outputDir: "../tests/artifacts/gameplan-browser",
  use: { baseURL: `http://127.0.0.1:${port}`, screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: `node ../scripts/e2e-serve.mjs ../source/public -l ${port}`,
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 30_000 },
});
