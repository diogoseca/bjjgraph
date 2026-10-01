import { defineConfig } from '@playwright/test';
// Root supplies the freshly emitted local public tree. No build or SSG runs here.
// Dedicated port, never an already-running preview or inherited fixture server.
const port = 18873;
export default defineConfig({
  testDir: './journeys', testMatch: 'gameplan-study-live.spec.ts', workers: 1,
  timeout: 150_000, retries: 0, reporter: 'list',
  outputDir: '../tests/artifacts/gameplan-study-live',
  use: { baseURL: `http://127.0.0.1:${port}`, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: `node ../scripts/e2e-serve.mjs ../source/public -l ${port}`,
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 30_000 },
});
