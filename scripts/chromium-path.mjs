import { existsSync } from 'node:fs';

/**
 * Playwright normally downloads its own Chromium. In sandboxes where a Chromium is
 * pre-installed (PLAYWRIGHT_BROWSERS_PATH), point at it explicitly so a version
 * mismatch doesn't block the run. In CI this returns undefined and Playwright's own
 * browser (installed with `npx playwright install chromium`) is used.
 */
export function chromiumExecutable() {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  const preinstalled = '/opt/pw-browsers/chromium';
  return existsSync(preinstalled) ? preinstalled : undefined;
}
