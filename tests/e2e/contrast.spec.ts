/**
 * WCAG contrast audit of the rendered pages in both themes.
 * Every visible text element is measured against its effective background
 * (ancestor backgrounds composited). AA: 4.5:1 for normal text, 3:1 for large text.
 * Control borders (outlined buttons, toggles) must reach 3:1 against their background.
 * A summary is printed and attached to the test report.
 */
import { test, expect, type Page } from '@playwright/test';

interface Finding {
  text: string;
  ratio: number;
  required: number;
  fg: string;
  bg: string;
  selector: string;
}
interface Audit {
  checked: number;
  min: number;
  minAt: string;
  failures: Finding[];
}

async function audit(page: Page, scope: string): Promise<Audit> {
  return page.evaluate((scopeSel) => {
    type RGBA = [number, number, number, number];
    const parse = (c: string): RGBA => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p[3] ?? 1];
      }
      const s = c.match(/color\(srgb ([^)]+)\)/);
      if (s) {
        const p = s[1].split(/[\s/]+/).filter(Boolean).map(Number);
        return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1];
      }
      return [0, 0, 0, 0];
    };
    const over = (top: RGBA, under: RGBA): RGBA => {
      const a = top[3] + under[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      const ch = (i: number) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
      return [ch(0), ch(1), ch(2), a];
    };
    const lum = ([r, g, b]: RGBA) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: RGBA, b: RGBA) => {
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const bgOf = (el: Element | null): RGBA => {
      const layers: RGBA[] = [];
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      let acc: RGBA = parse(getComputedStyle(document.body).backgroundColor);
      for (const layer of layers.reverse()) acc = over(layer, acc);
      return acc;
    };
    const describe = (el: Element) =>
      el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    const hiddenByClip = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || (cs.position === 'absolute' && n.getBoundingClientRect().width <= 1)) return true;
        if (Number(cs.opacity) < 1) return true;
      }
      return false;
    };

    const root = document.querySelector(scopeSel)!;
    const result = { checked: 0, min: 99, minAt: '', failures: [] as Finding[] };
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.textContent?.trim()) continue;
      seen.add(el);
      if (el.closest('script, style, [hidden], [disabled]')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || hiddenByClip(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || cs.display === 'none') continue;
      const bg = bgOf(el);
      const fg = over(parse(cs.color), bg);
      const r = ratio(fg, bg);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const required = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      result.checked++;
      if (r < result.min) {
        result.min = r;
        result.minAt = `${describe(el)} "${node.textContent.trim().slice(0, 30)}"`;
      }
      if (r < required - 0.01) {
        result.failures.push({
          text: node.textContent.trim().slice(0, 40),
          ratio: Math.round(r * 100) / 100,
          required,
          fg: cs.color,
          bg: `rgb(${bg.slice(0, 3).map(Math.round).join(', ')})`,
          selector: describe(el),
        });
      }
    }
    // Non-text contrast: edges of outlined controls.
    root.querySelectorAll('.btn--outline, .icon-btn, .lang-toggle, .request-option, .field input, .field select, .field textarea').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || hiddenByClip(el)) return;
      const cs = getComputedStyle(el);
      if (cs.borderTopStyle === 'none' || parse(cs.borderTopColor)[3] === 0) return;
      const bg = bgOf(el.parentElement);
      const r = ratio(over(parse(cs.borderTopColor), bg), bg);
      result.checked++;
      if (r < 3 - 0.01)
        result.failures.push({ text: '(border)', ratio: Math.round(r * 100) / 100, required: 3, fg: cs.borderTopColor, bg: '', selector: describe(el) });
    });
    result.min = Math.round(result.min * 100) / 100;
    return result;
  }, scope);
}

for (const theme of ['dark', 'light'] as const) {
  for (const width of [1440, 390]) {
    test.describe(`contrast · ${theme} · ${width}px`, () => {
      test.use({ colorScheme: theme, viewport: { width, height: 900 } });

      test('home page and project panel meet WCAG AA', async ({ page }, info) => {
        await page.route(/\.example\.com\//, (r) => r.abort('connectionrefused'));
        const report: Record<string, Audit> = {};

        await page.goto('/');
        report.home = await audit(page, 'body');

        // Contact form: validation errors, provider failure (fallback e-mail), success
        let ok = false;
        await page.route('https://api.web3forms.com/submit', (r) =>
          r.fulfill({ status: ok ? 200 : 500, contentType: 'application/json', body: JSON.stringify({ success: ok }) }),
        );
        await page.goto('/#contato');
        const form = page.locator('form[data-contact-form]');
        await form.evaluate((el: HTMLFormElement) => (el.dataset.accessKey = 'contrast-key'));
        await form.getByLabel('E-mail').fill('x@');
        await form.getByRole('button', { name: 'Enviar mensagem' }).click();
        report['contact: validation errors'] = await audit(page, '#contato');
        await form.getByLabel('Nome').fill('Ana');
        await form.getByLabel('E-mail').fill('ana@empresa.com');
        await form.getByLabel('Assunto').selectOption('outro');
        await form.getByLabel('Mensagem').fill('Mensagem de teste com mais de vinte caracteres.');
        await form.getByRole('button', { name: 'Enviar mensagem' }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        report['contact: failure + fallback'] = await audit(page, '#contato');
        ok = true;
        await form.getByRole('button', { name: 'Enviar mensagem' }).click();
        await expect(page.locator('[data-form-success]')).toBeVisible();
        report['contact: success'] = await audit(page, '#contato');

        await page.goto('/#projeto/api-pedidos/testar');
        const v = page.locator('.project-view[data-project="api-pedidos"]');
        await v.locator('label.request-option', { hasText: 'Repetir pagamento' }).click();
        await v.locator('[data-send]:visible').click();
        await expect(v.locator('[data-source]')).toHaveText('resposta gravada');
        await v.getByLabel('Corpo da requisição (editável)').fill('{');
        report['panel: testar (recorded + invalid body)'] = await audit(page, '#project-panel');

        for (const tab of ['overview', 'code', 'demo']) {
          await v.locator(`[data-tab="${tab}"]`).click();
          report[`panel: ${tab}`] = await audit(page, '#project-panel');
        }

        await page.goto('/#projeto/encurtador-url/testar');
        report['panel: recorded-mode notice'] = await audit(page, '#project-panel');

        await page.goto('/#projeto/encurtador-url/telas');
        report['panel: screens'] = await audit(page, '#project-panel');

        const lines = Object.entries(report).map(
          ([k, a]) => `${theme} ${width}px · ${k}: ${a.checked} checked, min ${a.min}:1 (${a.minAt}), ${a.failures.length} failing`,
        );
        console.log(lines.join('\n'));
        await info.attach(`contrast-${theme}-${width}.json`, { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
        const failures = Object.entries(report).flatMap(([k, a]) => a.failures.map((f) => ({ where: k, ...f })));
        expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
      });
    });
  }
}
