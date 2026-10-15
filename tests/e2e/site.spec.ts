import { test, expect, type Page } from '@playwright/test';

const DEMO_HOSTS = /\.example\.com\//;

/** Make every live demo call fail fast, as if the free-tier API were asleep. */
async function demoApisOffline(page: Page) {
  await page.route(DEMO_HOSTS, (route) => route.abort('connectionrefused'));
}

// E2E runs against the fictitious data in data/example (see playwright.config.ts).
const panel = (page: Page) => page.locator('#project-panel');
const view = (page: Page, slug: string) => panel(page).locator(`.project-view[data-project="${slug}"]`);
const activeTab = (page: Page) => panel(page).locator('.project-view:not([hidden]) [role="tab"][aria-selected="true"]');
const cardLink = (page: Page, slug: string, tab: 'try' | 'overview') =>
  page.locator(`.project-card [data-open-project="${slug}"][data-open-tab="${tab}"]`);
/** Pick a ready-made request by its visible name. */
const pickRequest = (page: Page, slug: string, name: string) =>
  view(page, slug).locator('label.request-option', { hasText: name }).click();

test.describe('project panel', () => {
  test.beforeEach(async ({ page }) => {
    await demoApisOffline(page);
  });

  test('"Ver detalhes" opens the panel as a modal dialog with focus inside', async ({ page }) => {
    await page.goto('/');
    await cardLink(page, 'api-pedidos', 'overview').click();

    const dialog = panel(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveJSProperty('open', true);
    await expect(page.getByRole('dialog', { name: 'API de pedidos e pagamentos' })).toBeVisible();
    await expect(activeTab(page)).toBeFocused();
    await expect(activeTab(page)).toHaveText('Visão geral');
    await expect(page).toHaveURL(/#projeto\/api-pedidos\/visao-geral$/);
    // the page behind is inert: tabbing never leaves the dialog
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => !!document.activeElement?.closest('#project-panel'));
      expect(inside).toBe(true);
    }
  });

  test('"Testar a API" on a card opens straight on the console tab', async ({ page }) => {
    await page.goto('/');
    await cardLink(page, 'encurtador-url', 'try').click();
    await expect(activeTab(page)).toHaveText('Testar a API');
    await expect(page).toHaveURL(/#projeto\/encurtador-url\/testar$/);
    await expect(view(page, 'encurtador-url').locator('[data-tabpanel="try"]')).toBeVisible();
  });

  test('arrow keys, Home and End switch tabs (WAI-ARIA tabs pattern)', async ({ page }) => {
    await page.goto('/');
    await cardLink(page, 'api-pedidos', 'overview').click();
    const v = view(page, 'api-pedidos');

    await page.keyboard.press('ArrowRight');
    await expect(activeTab(page)).toHaveText('Testar a API');
    await expect(activeTab(page)).toBeFocused();
    await expect(v.locator('[data-tabpanel="try"]')).toBeVisible();
    await expect(v.locator('[data-tabpanel="overview"]')).toBeHidden();
    await expect(page).toHaveURL(/#projeto\/api-pedidos\/testar$/);

    await page.keyboard.press('ArrowRight');
    await expect(activeTab(page)).toHaveText('Código');
    await expect(v.locator('[data-tabpanel="code"] pre.astro-code').first()).toBeVisible();

    await page.keyboard.press('End');
    await expect(activeTab(page)).toHaveText('Demo');
    await page.keyboard.press('ArrowRight'); // wraps around
    await expect(activeTab(page)).toHaveText('Visão geral');
    await page.keyboard.press('ArrowLeft'); // wraps backwards
    await expect(activeTab(page)).toHaveText('Demo');
    await page.keyboard.press('Home');
    await expect(activeTab(page)).toHaveText('Visão geral');
    await expect(v.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  });

  test('overview shows the layered architecture and the numbers', async ({ page }) => {
    await page.goto('/#projeto/api-pedidos/visao-geral');
    const v = view(page, 'api-pedidos');
    await expect(v.getByRole('heading', { name: 'O problema' })).toBeVisible();
    await expect(v.getByRole('img', { name: /Clean Architecture/ })).toBeVisible();
    await expect(v.locator('.arch__node')).toHaveCount(5);
    await expect(v.locator('.arch__node--primary')).toContainText('API');
    await expect(v.locator('.arch__node--dashed')).toContainText('Infrastructure');
    await expect(v.locator('.metric')).toHaveCount(3);
    await expect(v.locator('.metric').first()).toContainText('[X ms]');
  });

  test('"Enviar" shows the recorded response when the demo API is unreachable', async ({ page }) => {
    await page.goto('/#projeto/api-pedidos/testar');
    const v = view(page, 'api-pedidos');
    await expect(v.locator('[data-live-line]')).toContainText('API ao vivo · api-pedidos-demo.example.com');
    await pickRequest(page, 'api-pedidos', 'Criar pedido');
    await expect(v.locator('[data-sel-path]')).toHaveText('/api/pedidos');
    await expect(v.getByLabel('Corpo da requisição (editável)')).toHaveValue(/"clienteId": "cli_demo_01"/);

    await v.getByRole('button', { name: 'Enviar' }).click();

    await expect(v.locator('[data-source]')).toHaveText('resposta gravada');
    await expect(v.locator('[data-status]')).toHaveText('201 Created');
    await expect(v.locator('[data-latency]')).toHaveText('87 ms');
    await expect(v.locator('[data-recorded-hint]')).toBeVisible();
    await expect(v.locator('[data-recorded-hint]')).toContainText('plano gratuito');
    await expect(v.locator('[data-live-line]')).toBeHidden();
    await expect(v.locator('[data-output-code] .json-key').first()).toHaveText('"id"');
    await expect(v.locator('[data-output-code]')).toContainText('"total": 69.8');
    await expect(v.locator('[data-tip]')).toContainText('calculado no domínio');

    await v.getByRole('button', { name: 'Tentar ao vivo de novo' }).click();
    await expect(v.locator('[data-source]')).toHaveText('resposta gravada');
  });

  test('token from "Gerar token" is filled into later requests; replay shows Idempotent-Replayed', async ({ page }) => {
    await page.goto('/#projeto/api-pedidos/testar');
    const v = view(page, 'api-pedidos');
    await pickRequest(page, 'api-pedidos', 'Pagar pedido');
    await expect(v.locator('[data-sel-headers]')).toContainText('Gerar token');

    await pickRequest(page, 'api-pedidos', 'Gerar token');
    await v.getByRole('button', { name: 'Enviar' }).click();
    await expect(v.locator('[data-status]')).toHaveText('200 OK');

    await pickRequest(page, 'api-pedidos', 'Repetir pagamento');
    await expect(v.locator('[data-sel-headers]')).toContainText('Bearer eyJhbGciOi… (preenchido)');
    await v.getByRole('button', { name: 'Enviar' }).click();
    await expect(v.locator('[data-res-headers]')).toHaveText('Idempotent-Replayed: true');
    await expect(v.locator('[data-output-code]')).toContainText('"pag_51b7e0"');
  });

  test('"Enviar" shows a live response with status and latency when the API answers', async ({ page }) => {
    await page.unroute(DEMO_HOSTS);
    let authHeader: string | null = null;
    await page.route(DEMO_HOSTS, (route) => {
      authHeader = route.request().headers()['authorization'] ?? null;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ accessToken: 'live-token-123', tipo: 'Bearer' }),
      });
    });
    await page.goto('/#projeto/api-pedidos/testar');
    const v = view(page, 'api-pedidos');
    await v.getByRole('button', { name: 'Enviar' }).click();
    await expect(v.locator('[data-source]')).toHaveText('ao vivo');
    await expect(v.locator('[data-status]')).toHaveText('200 OK');
    await expect(v.locator('[data-latency]')).toHaveText(/^\d+ ms$/);
    await expect(v.locator('[data-recorded-hint]')).toBeHidden();
    await expect(v.locator('[data-output-code]')).toContainText('"live-token-123"');

    // the live token is sent with the next request
    await pickRequest(page, 'api-pedidos', 'Consultar pedido');
    await v.getByRole('button', { name: 'Enviar' }).click();
    await expect.poll(() => authHeader).toBe('Bearer live-token-123');
  });

  test('a project without a live deployment answers from recordings without calling the network', async ({ page }) => {
    let calls = 0;
    await page.unroute(DEMO_HOSTS);
    await page.route(DEMO_HOSTS, (route) => {
      calls++;
      return route.abort();
    });
    await page.goto('/#projeto/encurtador-url/testar');
    const v = view(page, 'encurtador-url');
    await expect(v.locator('[data-mode-notice]')).toContainText('respostas gravadas');
    await v.getByRole('button', { name: 'Enviar' }).click();
    await expect(v.locator('[data-source]')).toHaveText('resposta gravada');
    await expect(v.locator('[data-status]')).toHaveText('201 Created');
    await expect(v.locator('[data-recorded-hint]')).toBeHidden();
    expect(calls).toBe(0);
  });

  test('invalid JSON in the edited body blocks sending', async ({ page }) => {
    await page.goto('/#projeto/api-pedidos/testar');
    const v = view(page, 'api-pedidos');
    await pickRequest(page, 'api-pedidos', 'Criar pedido');
    const body = v.getByLabel('Corpo da requisição (editável)');
    await expect(v.getByRole('button', { name: 'Restaurar corpo' })).toBeHidden();
    await body.fill('{ "clienteId": ');
    await expect(body).toHaveAttribute('aria-invalid', 'true');
    await v.getByRole('button', { name: 'Enviar' }).click();
    await expect(v.locator('[data-output]')).toBeHidden();
    await v.getByRole('button', { name: 'Restaurar corpo' }).click();
    await expect(body).toHaveAttribute('aria-invalid', 'false');
  });

  test('Esc closes the panel and returns focus to the card button', async ({ page }) => {
    await page.goto('/');
    const card = cardLink(page, 'encurtador-url', 'try');
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(card).toBeFocused();
    await expect(page).not.toHaveURL(/#projeto/);
  });

  test('close button and browser Back also close the panel', async ({ page }) => {
    await page.goto('/');
    const card = cardLink(page, 'encurtador-url', 'overview');
    await card.click();
    await panel(page).locator('.project-view:not([hidden]) .project-view__close').click();
    await expect(panel(page)).toBeHidden();
    await expect(card).toBeFocused();

    await card.click();
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(panel(page)).toBeHidden();
  });

  test('hash deep link opens the right project and tab', async ({ page }) => {
    await page.goto('/#projeto/encurtador-url/codigo');
    await expect(page.getByRole('dialog', { name: 'Encurtador de URL de alto volume' })).toBeVisible();
    await expect(activeTab(page)).toHaveText('Código');
    await expect(activeTab(page)).toBeFocused();

    await page.goto('/en/#project/api-pedidos/try');
    await expect(page.getByRole('dialog', { name: 'Orders & payments API' })).toBeVisible();
    await expect(activeTab(page)).toHaveText('Try the API');

    // closing a deep-linked panel focuses that project's card
    await page.keyboard.press('Escape');
    await expect(cardLink(page, 'api-pedidos', 'try')).toBeFocused();
  });
});

test.describe('private repositories and drafts', () => {
  test('a private project shows no repository link, a note on the Código tab and a way to ask for the code', async ({ page }) => {
    await page.goto('/#projeto/encurtador-url/codigo');
    const v = view(page, 'encurtador-url');
    await expect(v.locator('.private-badge')).toHaveText('Repositório privado');
    await expect(v.locator('a[href*="github.com"]')).toHaveCount(0);
    await expect(v.locator('[data-private-note]')).toContainText('O código deste projeto é privado');
    // a public project keeps its repository link and has no note
    await expect(view(page, 'api-pedidos').locator('a.project-view__repo')).toHaveAttribute('href', /github\.com/);
    await expect(view(page, 'api-pedidos').locator('[data-private-note]')).toHaveCount(0);

    await v.getByRole('link', { name: 'Pedir para ver o código' }).click();
    await expect(panel(page)).toBeHidden();
    await expect(page).toHaveURL(/#contato$/);
    await expect(page.locator('#contato')).toBeInViewport();
  });

  test('draft projects stay off the site', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-project-card="microsservicos-eventos"]')).toHaveCount(0);
    await expect(view(page, 'microsservicos-eventos')).toHaveCount(0);
    await page.goto('/#projeto/microsservicos-eventos/testar');
    await expect(panel(page)).toBeHidden();
  });
});

test.describe('home layout (design A)', () => {
  test('hero photo shows the GET /<handle> card and the "try a live API" link opens the console', async ({ page }) => {
    await demoApisOffline(page);
    await page.goto('/');
    const card = page.getByRole('figure', { name: 'Resumo do perfil no formato de resposta de API' });
    await expect(card).toContainText('GET');
    await expect(card).toContainText('/ana');
    await expect(card.locator('.status-badge')).toHaveText('200 OK');
    await expect(card.locator('.hero-photo__line .json-key').first()).toHaveText('"nome"');
    await expect(card).toContainText('"Ana Exemplo da Silva"');
    await expect(card).toContainText('"Recife, PE"');
    await expect(card.locator('.json-placeholder')).toHaveCount(0);

    await page.getByRole('link', { name: 'Testar uma API agora, sem sair da página' }).click();
    await expect(page.getByRole('dialog', { name: 'API de pedidos e pagamentos' })).toBeVisible();
    await expect(activeTab(page)).toHaveText('Testar a API');
  });

  test('sections render from content in order with numbered eyebrows', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.eyebrow')).toHaveText([
      '01 · projetos',
      '02 · habilidades',
      '03 · experiência',
      'formação',
      'idiomas',
      '05 · contato',
    ]);
    await expect(page.locator('.project-card')).toHaveCount(2);
    await expect(page.locator('.project-card').first()).toContainText('API · 01');
    await expect(page.locator('.project-card').first()).toContainText('demo online');
    await expect(page.locator('.project-card').nth(1)).toContainText('respostas gravadas');
    await expect(page.locator('.skill-group')).toHaveCount(3);
    await expect(page.locator('.timeline__item')).toHaveCount(2);
    await expect(page.locator('.timeline__item').first()).toContainText('Empresa Exemplo');
    // current roles get a filled node
    await expect(page.locator('.timeline__item--current')).toHaveCount(1);
    await expect(page.locator('.background')).toContainText('Universidade Exemplo');
    // every skill tile has an icon, every project card its themed diagram
    await expect(page.locator('.skill-group .skill-icon svg')).toHaveCount(3);
    await expect(page.locator('.project-card .thumb svg[role="img"]')).toHaveCount(2);
    await expect(page.getByRole('img', { name: /Idempotency-Key/ })).toBeVisible();
    // no leftover [PLACEHOLDER] outside the project metrics (those projects are not built yet)
    const text = await page.evaluate(() => {
      const clone = document.querySelector('main')!.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.project-card__metric, #project-panel').forEach((el) => el.remove());
      return clone.textContent ?? '';
    });
    expect(text).not.toMatch(/\[[A-ZÀ-Ý ]{3,}\]/);
  });

  test('photo: responsive WebP with JPEG fallback, alt text, fixed dimensions, LCP hints', async ({ page }) => {
    for (const [url, alt] of [['/', 'Foto de Ana'], ['/en/', 'Photo of Ana']]) {
      await page.goto(url);
      const img = page.getByRole('img', { name: alt });
      await expect(img).toBeVisible();
      // width/height attributes reserve the space (no layout shift)
      await expect(img).toHaveAttribute('width', '800');
      await expect(img).toHaveAttribute('height', '800');
      await expect(img).toHaveAttribute('loading', 'eager');
      await expect(img).toHaveAttribute('fetchpriority', 'high');
      await expect(img).toHaveAttribute('src', /\.jpg$/);
      await expect(img).toHaveAttribute('srcset', /480w.*800w/);
      const source = page.locator('.hero-photo picture source[type="image/webp"]');
      await expect(source).toHaveAttribute('srcset', /\.webp 480w, .*\.webp 800w/);
      await expect(source).toHaveAttribute('sizes', /430px/);
      expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      // 4:5 crop on desktop
      const box = (await page.locator('.hero-photo__frame').boundingBox())!;
      expect(Math.abs(box.height / box.width - 1.25)).toBeLessThan(0.02);
    }
  });

  test('name renders in the display font (Bricolage Grotesque 800)', async ({ page }) => {
    await page.goto('/');
    const name = page.locator('.hero__name');
    // visible text is "Ana." (the rest of the full name is visually hidden, for screen readers)
    expect(await name.evaluate((el) => el.firstChild?.textContent)).toBe('Ana');
    await expect(page.locator('.hero__dot')).toHaveText('.');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ana Exemplo da Silva');
    const style = await name.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { family: cs.fontFamily, weight: cs.fontWeight, size: parseFloat(cs.fontSize) };
    });
    expect(style.family).toMatch(/^"?Bricolage Grotesque/);
    expect(style.weight).toBe('800');
    expect(style.size).toBeGreaterThan(140); // ~156px at 1280+ wide
    const loaded = await page.evaluate(async () => {
      await document.fonts.load('800 96px "Bricolage Grotesque"');
      await document.fonts.ready;
      return document.fonts.check('800 96px "Bricolage Grotesque"');
    });
    expect(loaded).toBe(true);
  });

  test('copy button copies the e-mail', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.getByRole('button', { name: 'Copiar' }).click();
    await expect(page.getByRole('button', { name: 'Copiado' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ana@example.com');
  });
});

test.describe('site', () => {
  test('language toggle switches PT ↔ EN and keeps the deep link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 2, name: 'Projetos que você pode testar agora' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Idioma' }).locator('[aria-current="true"]')).toContainText('PT');

    await page.getByRole('link', { name: /Read in English/ }).click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 2, name: 'Projects you can test right now' })).toBeVisible();
    await expect(page.locator('.hero__role')).toHaveText('Backend .NET Developer');

    await page.getByRole('link', { name: /Ler em português/ }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');

    await page.goto('/#projeto/api-pedidos/testar');
    const href = await page.locator('[data-lang-switch]').getAttribute('href');
    expect(href).toBe('/en/#projeto/api-pedidos/testar');
  });

  test('SEO basics: meta, Open Graph, hreflang, sitemap, robots, cv.pdf', async ({ page, request }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Ana Exemplo da Silva · Desenvolvedora Backend .NET');
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld.name).toBe('Ana Exemplo da Silva');
    expect(ld.sameAs).toEqual(['https://github.com/exemplo', 'https://www.linkedin.com/in/exemplo']);
    await expect(page.locator('.site-footer')).toContainText('Ana Exemplo da Silva');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.NET/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\.png$/);
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', /\/en\/$/);
    for (const path of ['/sitemap-index.xml', '/robots.txt', '/cv.pdf', '/og.png']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
    }
    // the CV is served as a PDF
    const cv = await request.get('/cv.pdf');
    expect(cv.headers()['content-type']).toContain('pdf');
    expect((await cv.body()).length).toBeGreaterThan(1_000);
  });
});

test.describe('theme toggle', () => {
  const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const toggle = (page: Page) => page.getByRole('button', { name: 'Tema claro' });

  test.describe('OS in dark mode', () => {
    test.use({ colorScheme: 'dark' });

    test('follows the OS by default, switches to light, remembers it with no flash', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
      expect(await bg(page)).toBe('rgb(13, 12, 17)');
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('.theme-toggle__sun')).toBeVisible();
      const box = await toggle(page).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);

      await toggle(page).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.theme-toggle__moon')).toBeVisible();
      expect(await bg(page)).toBe('rgb(246, 245, 249)');

      // Reload with all bundled JS blocked: the saved theme must still apply,
      // which proves it is set by the inline <head> script before first paint.
      await page.route('**/_astro/*.js', (r) => r.abort());
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      expect(await bg(page)).toBe('rgb(246, 245, 249)');
    });

    test('code highlighting uses theme tokens in both themes', async ({ page }) => {
      await page.goto('/#projeto/api-pedidos/codigo');
      const keyword = panel(page).locator('.project-view:not([hidden]) .astro-code span[style*="--shiki-token-keyword"]').first();
      await expect(keyword).toBeVisible();
      expect(await keyword.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(240, 196, 138)');
      await page.keyboard.press('Escape');
      await toggle(page).click();
      await page.goto('/#projeto/api-pedidos/codigo');
      expect(await keyword.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(138, 75, 0)');
    });
  });

  test.describe('OS in light mode', () => {
    test.use({ colorScheme: 'light' });

    test('starts light and switches to dark', async ({ page }) => {
      await page.goto('/');
      expect(await bg(page)).toBe('rgb(246, 245, 249)');
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.theme-toggle__moon')).toBeVisible();
      await toggle(page).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      expect(await bg(page)).toBe('rgb(13, 12, 17)');
    });
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('panel opens without animation when the user prefers reduced motion', async ({ page }) => {
    await page.goto('/#projeto/api-pedidos/visao-geral');
    await expect(panel(page)).toBeVisible();
    const animation = await panel(page).evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('none');
    const smooth = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    expect(smooth).toBe('auto');
  });
});

test.describe('mobile 390px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('menu button opens the navigation', async ({ page }) => {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden();
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Contato' }).click();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  test('no horizontal scroll on the page or inside the full-screen sheet', async ({ page }) => {
    await demoApisOffline(page);
    const noOverflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

    for (const url of ['/', '/en/']) {
      await page.goto(url);
      expect(await noOverflow(), url).toBe(true);
    }

    await page.goto('/#projeto/api-pedidos/testar');
    const dialog = panel(page);
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(390);
    expect(box?.x).toBe(0); // full-screen sheet on phones
    const v = view(page, 'api-pedidos');
    // requests are numbered pills on phones
    const firstPill = v.locator('label.request-option').first();
    await expect(firstPill.locator('.request-option__num')).toBeVisible();
    await expect(firstPill.locator('.request-option__short')).toHaveText('Token');
    expect(await firstPill.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('999px');
    const send = v.getByRole('button', { name: 'Enviar requisição' });
    await expect(send).toBeVisible();
    await send.click();
    await expect(v.locator('[data-source]')).toHaveText('resposta gravada');
    for (const tab of ['overview', 'try', 'code', 'demo']) {
      await v.locator(`[data-tab="${tab}"]`).click();
      const body = v.locator('.project-view__body');
      const overflow = await body.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, tab).toBeLessThanOrEqual(0);
    }
    expect(await noOverflow()).toBe(true);
  });
});

test.describe('narrow phones', () => {
  for (const width of [360, 390]) {
    test.describe(`${width}px`, () => {
      test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true });

      test('no horizontal scroll; name, photo and card fit', async ({ page }) => {
        for (const url of ['/', '/en/']) {
          await page.goto(url);
          await page.evaluate(() => document.fonts.ready);
          const sizes = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
          }));
          expect(sizes.scroll, url).toBeLessThanOrEqual(sizes.client);
          const name = (await page.locator('.hero__name').boundingBox())!;
          expect(name.x + name.width, url).toBeLessThanOrEqual(width);
          const frame = (await page.locator('.hero-photo__frame').boundingBox())!;
          expect(Math.abs(frame.width - frame.height), 'square crop on phones').toBeLessThan(2);
          expect(frame.x + frame.width).toBeLessThanOrEqual(width);
        }
      });
    });
  }
});
