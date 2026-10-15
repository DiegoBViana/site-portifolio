import { defineConfig, devices } from '@playwright/test';
import { chromiumExecutable } from './scripts/chromium-path.mjs';

const PORT = 4322;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: { executablePath: chromiumExecutable() },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Always tests the fictitious data in data/example (so the result does not depend on your personal data),
  // built into its own folder so it never overwrites the dist/ of your deploy.
  webServer: {
    // --ignore-lock keeps `astro preview` in the foreground (Astro 7 auto-backgrounds it when run by an AI agent).
    command: `npx astro build --outDir dist-e2e && npx astro preview --outDir dist-e2e --port ${PORT} --host localhost --ignore-lock`,
    env: { ...(process.env as Record<string, string>), PORTFOLIO_DATA: 'example' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
