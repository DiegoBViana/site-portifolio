/**
 * Contact form UI: inline validation, busy state, success/failure without leaving the page.
 * Validation and delivery live in src/lib/contact-form.ts.
 */
import {
  FIELD_ORDER,
  interpolate,
  isSpam,
  submitContact,
  validateContact,
  validateField,
  type ContactField,
  type ContactInput,
  type FieldError,
} from '../lib/contact-form';

export function initContactForm() {
  document.querySelectorAll<HTMLFormElement>('form[data-contact-form]').forEach(setup);
}

function setup(form: HTMLFormElement) {
  const card = form.closest<HTMLElement>('[data-contact-form-card]')!;
  const i18n: Record<string, string> = JSON.parse(form.dataset.i18n ?? '{}');
  const status = form.querySelector<HTMLElement>('[data-form-status]')!;
  const failure = form.querySelector<HTMLElement>('[data-form-failure]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-form-submit]')!;
  const submitLabel = submit.querySelector<HTMLElement>('[data-submit-label]')!;
  const success = card.querySelector<HTMLElement>('[data-form-success]')!;
  const successText = success.querySelector<HTMLElement>('[data-success-text]')!;
  const again = success.querySelector<HTMLButtonElement>('[data-form-again]')!;
  const control = (field: ContactField) => form.elements.namedItem(field) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  let attempted = false;
  let busy = false;

  const read = (): ContactInput => ({
    name: control('name').value,
    email: control('email').value,
    company: control('company').value,
    phone: control('phone').value,
    subject: control('subject').value,
    message: control('message').value,
    botcheck: (form.elements.namedItem('botcheck') as HTMLInputElement).value,
  });

  const message = (field: ContactField, error: FieldError) =>
    interpolate(i18n[`form.err.${field}.${error.code}`] ?? i18n['form.err.name.required'], error.params);

  function show(field: ContactField, error: FieldError | undefined) {
    const el = control(field);
    const out = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`)!;
    if (error) {
      el.setAttribute('aria-invalid', 'true');
      out.textContent = message(field, error);
    } else {
      el.removeAttribute('aria-invalid');
      out.textContent = '';
    }
  }

  for (const field of FIELD_ORDER) {
    const el = control(field);
    // Validate when leaving a field the visitor has typed in (or after a first submit attempt)…
    el.addEventListener('blur', (event) => {
      // Moving to the submit button: let the submit validate, so a message appearing above the
      // button cannot shift it away between mousedown and mouseup (which would swallow the click).
      if ((event as FocusEvent).relatedTarget === submit) return;
      if (attempted || el.value.trim() !== '') show(field, validateField(field, read()));
    });
    // …and re-check live while a field is marked invalid, so the error clears as soon as it is fixed.
    el.addEventListener(field === 'subject' ? 'change' : 'input', () => {
      if (el.getAttribute('aria-invalid') === 'true') show(field, validateField(field, read()));
    });
  }

  function setBusy(on: boolean) {
    busy = on;
    submit.disabled = on;
    form.setAttribute('aria-busy', String(on));
    submitLabel.textContent = on ? i18n['form.sending'] : i18n['form.send'];
    if (on) status.textContent = i18n['form.sending'];
  }

  function showSuccess(input: ContactInput) {
    successText.textContent = interpolate(i18n['form.success.text'], {
      name: input.name.trim().split(/\s+/)[0] ?? '',
      email: input.email.trim(),
    });
    form.reset();
    attempted = false;
    FIELD_ORDER.forEach((f) => show(f, undefined));
    status.textContent = '';
    failure.hidden = true;
    form.hidden = true;
    success.hidden = false;
    success.focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    attempted = true;
    failure.hidden = true;
    const input = read();

    if (isSpam(input)) {
      // Pretend it worked; nothing is sent.
      showSuccess(input);
      return;
    }

    const { ok, errors } = validateContact(input);
    FIELD_ORDER.forEach((f) => show(f, errors[f]));
    if (!ok) {
      const invalid = FIELD_ORDER.filter((f) => errors[f]);
      status.textContent = interpolate(i18n['form.err.summary'], { n: invalid.length });
      control(invalid[0]).focus();
      return;
    }

    setBusy(true);
    const result = await submitContact(input, {
      endpoint: form.dataset.endpoint!,
      accessKey: form.dataset.accessKey,
      lang: form.dataset.lang,
      page: location.href,
    });
    setBusy(false);

    if (result.status === 'sent' || result.status === 'blocked') {
      showSuccess(input);
    } else {
      // The failure block is role="alert": showing it is announced, with the e-mail as a fallback.
      status.textContent = '';
      failure.hidden = false;
    }
  });

  again.addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    control('name').focus();
  });
}
