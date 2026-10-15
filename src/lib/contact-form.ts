/**
 * Contact form logic: validation, payload building and submission. No DOM access, so it is unit
 * tested in isolation (tests/unit/contact-form.test.ts) and the delivery provider can be swapped:
 * `buildWeb3FormsPayload` + `submitContact` are the only provider-specific parts.
 */

export const SUBJECTS = ['clt', 'pj', 'freelance', 'outro'] as const;
export type Subject = (typeof SUBJECTS)[number];

/** Subject labels used in the e-mail the site owner receives (always Portuguese, whatever the page language). */
export const SUBJECT_LABELS: Record<Subject, string> = {
  clt: 'Vaga CLT',
  pj: 'Vaga PJ / contrato',
  freelance: 'Freelance',
  outro: 'Outro',
};

export const LIMITS = {
  nameMax: 100,
  emailMax: 254,
  companyMax: 120,
  messageMin: 20,
  messageMax: 5000,
  phoneDigitsMin: 8,
  phoneDigitsMax: 15,
} as const;

export interface ContactInput {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  subject: string;
  message: string;
  /** Honeypot: hidden from people, bots fill it in. */
  botcheck?: string;
}

export type ContactField = 'name' | 'email' | 'company' | 'phone' | 'subject' | 'message';
export type ErrorCode = 'required' | 'invalid' | 'tooShort' | 'tooLong';
export interface FieldError {
  code: ErrorCode;
  /** Extra values for the message, e.g. { min: 20, left: 7 }. */
  params?: Record<string, number>;
}
export type ContactErrors = Partial<Record<ContactField, FieldError>>;

/** Field order, used to focus the first invalid field. */
export const FIELD_ORDER: ContactField[] = ['name', 'email', 'company', 'phone', 'subject', 'message'];

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE_CHARS_RE = /^[0-9+().\-\s]+$/;

/** Validate one field. Returns undefined when it is valid. */
export function validateField(field: ContactField, input: ContactInput): FieldError | undefined {
  const value = (input[field] ?? '').trim();
  switch (field) {
    case 'name':
      if (!value) return { code: 'required' };
      if (value.length > LIMITS.nameMax) return { code: 'tooLong', params: { max: LIMITS.nameMax } };
      return;
    case 'email':
      if (!value) return { code: 'required' };
      if (value.length > LIMITS.emailMax || !EMAIL_RE.test(value)) return { code: 'invalid' };
      return;
    case 'company':
      if (value.length > LIMITS.companyMax) return { code: 'tooLong', params: { max: LIMITS.companyMax } };
      return;
    case 'phone': {
      if (!value) return;
      const digits = value.replace(/\D/g, '').length;
      if (!PHONE_CHARS_RE.test(value) || digits < LIMITS.phoneDigitsMin || digits > LIMITS.phoneDigitsMax)
        return { code: 'invalid' };
      return;
    }
    case 'subject':
      if (!(SUBJECTS as readonly string[]).includes(value)) return { code: 'required' };
      return;
    case 'message':
      if (!value) return { code: 'required' };
      if (value.length < LIMITS.messageMin)
        return { code: 'tooShort', params: { min: LIMITS.messageMin, left: LIMITS.messageMin - value.length } };
      if (value.length > LIMITS.messageMax) return { code: 'tooLong', params: { max: LIMITS.messageMax } };
      return;
  }
}

export function validateContact(input: ContactInput): { ok: boolean; errors: ContactErrors } {
  const errors: ContactErrors = {};
  for (const field of FIELD_ORDER) {
    const error = validateField(field, input);
    if (error) errors[field] = error;
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** True when the visitor filled the hidden honeypot field (almost certainly a bot). */
export function isSpam(input: ContactInput): boolean {
  return Boolean(input.botcheck && input.botcheck.trim());
}

/** "{name}"-style placeholders, used for the localised messages. */
export function interpolate(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in params ? String(params[key]) : m));
}

export function emailSubject(input: Pick<ContactInput, 'subject' | 'name'>): string {
  const label = SUBJECT_LABELS[input.subject as Subject] ?? input.subject;
  return `Contato pelo portfólio: ${label} — ${input.name.trim()}`;
}

/** Web3Forms JSON body (https://docs.web3forms.com). `replyto` makes "Reply" go to the sender. */
export function buildWeb3FormsPayload(
  input: ContactInput,
  opts: { accessKey: string; lang?: string; page?: string },
): Record<string, string> {
  const name = input.name.trim();
  const email = input.email.trim();
  const payload: Record<string, string> = {
    access_key: opts.accessKey,
    subject: emailSubject(input),
    from_name: `Portfólio · ${name}`,
    replyto: email,
    name,
    email,
    assunto: SUBJECT_LABELS[input.subject as Subject] ?? input.subject,
    empresa: input.company?.trim() || '—',
    telefone: input.phone?.trim() || '—',
    message: input.message.trim(),
  };
  if (opts.lang) payload.idioma = opts.lang;
  if (opts.page) payload.pagina = opts.page;
  return payload;
}

/** A key that was never filled in (empty or still a placeholder) is treated as "not configured". */
export function isConfigured(accessKey: string | undefined): accessKey is string {
  return Boolean(accessKey && accessKey.trim() && !/^\[|SUA_CHAVE|YOUR_KEY/i.test(accessKey.trim()));
}

export type SubmitResult =
  | { status: 'sent' }
  /** Honeypot filled: nothing was sent (the UI still shows success, so bots learn nothing). */
  | { status: 'blocked' }
  | { status: 'invalid'; errors: ContactErrors }
  | { status: 'failed'; reason: 'config' | 'network' | 'timeout' | 'rejected'; detail?: string };

export interface SubmitOptions {
  endpoint: string;
  accessKey: string | undefined;
  lang?: string;
  page?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export async function submitContact(input: ContactInput, opts: SubmitOptions): Promise<SubmitResult> {
  if (isSpam(input)) return { status: 'blocked' };
  const { ok, errors } = validateContact(input);
  if (!ok) return { status: 'invalid', errors };
  if (!isConfigured(opts.accessKey)) return { status: 'failed', reason: 'config' };

  const doFetch = opts.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await doFetch(opts.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildWeb3FormsPayload(input, { accessKey: opts.accessKey, lang: opts.lang, page: opts.page })),
      signal: controller.signal,
    });
    let body: { success?: boolean; message?: string } | undefined;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    if (res.ok && body?.success !== false) return { status: 'sent' };
    return { status: 'failed', reason: 'rejected', detail: body?.message ?? `HTTP ${res.status}` };
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    return { status: 'failed', reason: aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
