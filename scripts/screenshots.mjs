/**
 * Captures the home page, the open "Testar a API" panel and the contact form (validation
 * error + success, with the form provider mocked) at 1440px and 390px, in both themes.
 * Usage: npm run build && node scripts/screenshots.mjs [outDir] [baseUrl]
 * (starts `astro preview` itself unless baseUrl is given)
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { chromiumExecutable } from './chromium-path.mjs';

const outDir = process.argv[2] ?? 'screenshots';
let baseUrl = process.argv[3];
let server;
if (!baseUrl) {
  baseUrl = 'http://localhost:4323';
  server = spawn('npx', ['astro', 'preview', '--port', '4323', '--host', 'localhost', '--ignore-lock'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(baseUrl)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const settle = (page) => page.evaluate(() => document.fonts.ready.then(() => true));
for (const theme of ['dark', 'light']) {
  for (const [width, height, label] of [[1440, 900, '1440'], [390, 844, '390']]) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: width < 500 ? 2 : 1,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    // Demo APIs are placeholders: make them fail fast so the recorded fallback shows.
    await page.route(/\.example\.com\//, (r) => r.abort('connectionrefused'));
    await page.goto(baseUrl + '/');
    await settle(page);
    await page.screenshot({ path: `${outDir}/home-${theme}-${label}.png`, fullPage: true });

    await page.goto(baseUrl + '/#projeto/api-pedidos/testar');
    await page.waitForSelector('#project-panel[open]');
    const view = page.locator('.project-view:not([hidden])');
    await view.getByLabel('Pagar pedido').check({ force: true });
    await view.locator('[data-send]:visible').click();
    await page.waitForSelector('.project-view:not([hidden]) [data-source="recorded"]');
    await view.locator('.project-view__body').evaluate((el) => el.scrollTo(0, 0));
    await settle(page);
    await page.screenshot({ path: `${outDir}/panel-testar-${theme}-${label}.png` });

    // Contact form: a validation error, then a successful send (Web3Forms mocked).
    await page.route('https://api.web3forms.com/submit', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"message":"Email sent"}' }),
    );
    await page.goto(baseUrl + '/#contato');
    await page.evaluate(() => (document.querySelector('form[data-contact-form]').dataset.accessKey = 'screenshot-key'));
    const form = page.locator('form[data-contact-form]');
    await form.getByLabel('Nome').fill('Ana Souza');
    await form.getByLabel('E-mail').fill('ana@empresa');
    await form.getByLabel('Assunto').selectOption('clt');
    await form.getByLabel('Mensagem').fill('Olá, amigo!');
    await form.getByRole('button', { name: 'Enviar mensagem' }).click();
    await settle(page);
    await page.locator('#contato').screenshot({ path: `${outDir}/contact-error-${theme}-${label}.png` });
    await form.getByLabel('E-mail').fill('ana@empresa.com.br');
    await form.getByLabel('Mensagem').fill('Olá, amigo! Temos uma vaga de backend .NET e gostaria de conversar.');
    await form.getByRole('button', { name: 'Enviar mensagem' }).click();
    await page.waitForSelector('[data-form-success]:not([hidden])');
    await page.locator('#contato').screenshot({ path: `${outDir}/contact-success-${theme}-${label}.png` });
    await ctx.close();
  }
}
await browser.close();
server?.kill();
console.log(`Screenshots written to ${outDir}/`);
