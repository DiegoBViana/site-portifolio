import { test, expect, type Page, type Request } from '@playwright/test';

const WEB3FORMS = 'https://api.web3forms.com/submit';
const form = (page: Page) => page.locator('form[data-contact-form]');
const submit = (page: Page) => form(page).getByRole('button', { name: 'Enviar mensagem' });

/**
 * Open the contact section with a test access key (the build has none) and the provider mocked.
 * Returns the list of requests the page sent to Web3Forms.
 */
async function openContact(page: Page, response: { status: number; body: unknown } | 'abort', path = '/') {
  const sent: Request[] = [];
  await page.route(WEB3FORMS, async (route) => {
    sent.push(route.request());
    if (response === 'abort') return route.abort('connectionrefused');
    await new Promise((r) => setTimeout(r, 150)); // long enough to see the busy state
    await route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.body) });
  });
  await page.goto(path + '#contato');
  await form(page).evaluate((el: HTMLFormElement) => (el.dataset.accessKey = 'test-access-key'));
  return sent;
}

async function fillValid(page: Page) {
  const f = form(page);
  await f.getByLabel('Nome').fill('Ana Souza');
  await f.getByLabel('E-mail').fill('ana@empresa.com.br');
  await f.getByLabel('Empresa').fill('Empresa X');
  await f.getByLabel('Telefone / WhatsApp').fill('83 99999-0000');
  await f.getByLabel('Assunto').selectOption('pj');
  await f.getByLabel('Mensagem').fill('Olá, amigo! Temos uma vaga PJ de backend .NET.');
}

test.describe('contact form', () => {
  test('has accessible labels, required markers and no mailto submit', async ({ page }) => {
    await page.goto('/');
    const f = form(page);
    await expect(f).toHaveAttribute('novalidate', '');
    await expect(f).not.toHaveAttribute('action', /mailto/);
    for (const label of ['Nome', 'E-mail', 'Assunto', 'Mensagem']) await expect(f.getByLabel(label)).toHaveAttribute('required', '');
    await expect(f.getByLabel('Empresa')).not.toHaveAttribute('required', '');
    await expect(f.getByLabel('E-mail')).toHaveAttribute('aria-describedby', /cf-email-hint/);
    await expect(f.getByLabel('Assunto').locator('option')).toHaveText([
      'Escolha um assunto',
      'Vaga CLT',
      'Vaga PJ / contrato',
      'Freelance',
      'Outro',
    ]);
    // the honeypot is out of the tab order and hidden from assistive tech
    const hp = f.locator('input[name="botcheck"]');
    await expect(hp).toHaveAttribute('tabindex', '-1');
    await expect(f.locator('.field--hp')).toHaveAttribute('aria-hidden', 'true');
  });

  test('shows inline errors, focuses the first invalid field and does not send', async ({ page }) => {
    const sent = await openContact(page, { status: 200, body: { success: true } });
    const f = form(page);
    await f.getByLabel('Nome').fill('Ana');
    await f.getByLabel('E-mail').fill('ana@empresa');
    await f.getByLabel('Mensagem').fill('Olá, amigo!');
    await submit(page).click();

    await expect(f.getByLabel('E-mail')).toBeFocused();
    await expect(f.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cf-email-error')).toHaveText('E-mail inválido. Use o formato nome@empresa.com.');
    await expect(page.locator('#cf-subject-error')).toHaveText('Escolha um assunto.');
    await expect(page.locator('#cf-message-error')).toHaveText('Escreva pelo menos 20 caracteres (faltam 9).');
    await expect(f.getByLabel('Nome')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-form-status]')).toHaveText('Corrija 3 campo(s) destacado(s) antes de enviar.');
    expect(sent).toHaveLength(0);

    // errors clear as soon as the field is fixed
    await f.getByLabel('E-mail').fill('ana@empresa.com');
    await expect(page.locator('#cf-email-error')).toHaveText('');
    await expect(f.getByLabel('E-mail')).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('sends the message, shows a busy state, then success without leaving the page', async ({ page }) => {
    const sent = await openContact(page, { status: 200, body: { success: true, message: 'Email sent' } });
    await fillValid(page);
    await submit(page).click();

    const busy = form(page).locator('[data-form-submit]');
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveText('Enviando…');

    const success = page.locator('[data-form-success]');
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
    await expect(success).toContainText('Mensagem enviada.');
    await expect(success).toContainText('Obrigado, Ana! Respondo no e-mail ana@empresa.com.br.');
    expect(page.url()).toMatch(/#contato$/);

    expect(sent).toHaveLength(1);
    const body = sent[0].postDataJSON();
    expect(body).toMatchObject({
      access_key: 'test-access-key',
      subject: 'Contato pelo portfólio: Vaga PJ / contrato — Ana Souza',
      replyto: 'ana@empresa.com.br',
      email: 'ana@empresa.com.br',
      empresa: 'Empresa X',
      telefone: '83 99999-0000',
      idioma: 'pt',
    });
    expect(sent[0].headers()['content-type']).toBe('application/json');

    // "send another" brings back an empty form
    await page.getByRole('button', { name: 'Enviar outra mensagem' }).click();
    await expect(form(page).getByLabel('Nome')).toBeFocused();
    await expect(form(page).getByLabel('Nome')).toHaveValue('');
  });

  test('on failure keeps the form filled and shows the e-mail as fallback', async ({ page }) => {
    const sent = await openContact(page, { status: 400, body: { success: false, message: 'Invalid access key' } });
    await fillValid(page);
    await submit(page).click();
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Não foi possível enviar agora');
    await expect(alert).toContainText('ana@example.com');
    await expect(form(page).getByLabel('Nome')).toHaveValue('Ana Souza');
    await expect(submit(page)).toBeEnabled();
    expect(sent).toHaveLength(1);
    await expect(page.locator('[data-form-success]')).toBeHidden();
  });

  test('network errors also fall back to the e-mail address', async ({ page }) => {
    await openContact(page, 'abort');
    await fillValid(page);
    await submit(page).click();
    await expect(page.getByRole('alert')).toContainText('ana@example.com');
  });

  test('without an access key nothing is sent and the e-mail is shown', async ({ page }) => {
    const sent = await openContact(page, { status: 200, body: { success: true } });
    await form(page).evaluate((el: HTMLFormElement) => (el.dataset.accessKey = ''));
    await fillValid(page);
    await submit(page).click();
    await expect(page.getByRole('alert')).toContainText('ana@example.com');
    expect(sent).toHaveLength(0);
  });

  test('honeypot filled: nothing is sent', async ({ page }) => {
    const sent = await openContact(page, { status: 200, body: { success: true } });
    await fillValid(page);
    await form(page).locator('input[name="botcheck"]').fill('http://spam.example', { force: true });
    await submit(page).click();
    await expect(page.locator('[data-form-success]')).toBeVisible();
    await page.waitForTimeout(300);
    expect(sent).toHaveLength(0);
  });

  test('keyboard only: Tab through the fields and submit with Enter', async ({ page }) => {
    const sent = await openContact(page, { status: 200, body: { success: true } });
    await form(page).getByLabel('Nome').focus();
    await page.keyboard.type('Ana Souza');
    await page.keyboard.press('Tab');
    await expect(form(page).getByLabel('E-mail')).toBeFocused();
    await page.keyboard.type('ana@empresa.com.br');
    await page.keyboard.press('Tab'); // Empresa
    await page.keyboard.press('Tab'); // Telefone
    await page.keyboard.press('Tab'); // Assunto
    await expect(form(page).getByLabel('Assunto')).toBeFocused();
    await form(page).getByLabel('Assunto').press('ArrowDown');
    await page.keyboard.press('Tab');
    await expect(form(page).getByLabel('Mensagem')).toBeFocused();
    await page.keyboard.type('Olá, amigo! Vaga CLT de backend .NET em aberto.');
    await page.keyboard.press('Tab'); // skips the honeypot, lands on the button
    await expect(submit(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-form-success]')).toBeFocused();
    expect(sent).toHaveLength(1);
    expect(sent[0].postDataJSON().assunto).toBe('Vaga CLT');
  });

  test('English page: labels, errors and success in English', async ({ page }) => {
    await openContact(page, { status: 200, body: { success: true } }, '/en/');
    const f = form(page);
    await f.getByRole('button', { name: 'Send message' }).click();
    await expect(f.getByLabel('Name')).toBeFocused();
    await expect(page.locator('#cf-name-error')).toHaveText('Please enter your name.');
    await f.getByLabel('Name').fill('Bob Lee');
    await f.getByLabel('Email').fill('bob@company.com');
    await f.getByLabel('Subject').selectOption('freelance');
    await f.getByLabel('Message').fill('Hi Ana, we have a freelance project in .NET.');
    await f.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('[data-form-success]')).toContainText('Thank you, Bob! I will reply to bob@company.com.');
  });
});
