/**
 * Regenerates public/og.png (1200×630 share image, design A2 colours and fonts).
 * public/cv.pdf is Diego's real CV and is NOT generated: replace that file to update it.
 * Usage: npm run placeholders
 */
import { chromium } from '@playwright/test';
import { chromiumExecutable } from './chromium-path.mjs';

const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=IBM+Plex+Sans:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap"></head><body style="margin:0;width:1200px;height:630px;display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box;background:#0D0C11;color:#EEEBF5;font-family:'IBM Plex Sans',system-ui,sans-serif">
  <div style="font-size:28px;color:#A9E8C0;font-family:\'JetBrains Mono\',monospace"><span style="color:#B9A8FF">~/</span>diego · GET /diego → 200 OK</div>
  <div style="font-family:'Bricolage Grotesque',sans-serif;font-variation-settings:'opsz' 96;font-size:150px;font-weight:800;line-height:0.95;letter-spacing:-0.045em;margin-top:16px">Diego<span style="color:#B9A8FF">.</span></div>
  <div style="font-size:30px;color:#EEEBF5;margin-top:12px">Diego Braga Galiza Viana · Campina Grande, PB</div>
  <div style="font-size:40px;color:#B9A8FF;font-weight:500;margin-top:8px;font-family:\'JetBrains Mono\',monospace">Desenvolvedor Backend .NET</div>
  <div style="font-size:26px;color:#C9C3D8;margin-top:28px;font-family:\'JetBrains Mono\',monospace">C# · .NET · APIs REST · Kafka · Redis · Docker · Azure DevOps</div>
</body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og.png' });

await browser.close();
console.log('Wrote public/og.png');
