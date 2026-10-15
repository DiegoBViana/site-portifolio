import { describe, it, expect, vi } from 'vitest';
import {
  buildWeb3FormsPayload,
  emailSubject,
  interpolate,
  isConfigured,
  isSpam,
  submitContact,
  validateContact,
  validateField,
  type ContactInput,
} from '../../src/lib/contact-form';

const valid: ContactInput = {
  name: '  Ana Souza ',
  email: 'ana@empresa.com.br',
  company: 'Empresa X',
  phone: '+55 (83) 99999-0000',
  subject: 'clt',
  message: 'Olá, amigo! Temos uma vaga de backend .NET.',
  botcheck: '',
};
const ENDPOINT = 'https://api.web3forms.com/submit';

describe('validateContact', () => {
  it('accepts a complete message', () => {
    expect(validateContact(valid)).toEqual({ ok: true, errors: {} });
  });

  it('requires name, e-mail, subject and message; company and phone are optional', () => {
    const { ok, errors } = validateContact({ name: ' ', email: '', subject: '', message: '' });
    expect(ok).toBe(false);
    expect(errors).toEqual({
      name: { code: 'required' },
      email: { code: 'required' },
      subject: { code: 'required' },
      message: { code: 'required' },
    });
  });

  it.each(['ana', 'ana@', 'ana@empresa', 'ana @empresa.com', '@empresa.com', 'ana@empresa.'])('rejects e-mail %j', (email) => {
    expect(validateField('email', { ...valid, email })).toEqual({ code: 'invalid' });
  });

  it('message needs at least 20 characters (trimmed) and reports how many are missing', () => {
    expect(validateField('message', { ...valid, message: '   Olá, amigo!   ' })).toEqual({
      code: 'tooShort',
      params: { min: 20, left: 9 },
    });
    expect(validateField('message', { ...valid, message: 'x'.repeat(20) })).toBeUndefined();
    expect(validateField('message', { ...valid, message: 'x'.repeat(5001) })?.code).toBe('tooLong');
  });

  it('phone, when given, must look like a phone number', () => {
    expect(validateField('phone', { ...valid, phone: '' })).toBeUndefined();
    expect(validateField('phone', { ...valid, phone: '83 99999-0000' })).toBeUndefined();
    expect(validateField('phone', { ...valid, phone: '1234' })).toEqual({ code: 'invalid' });
    expect(validateField('phone', { ...valid, phone: 'liga pra mim' })).toEqual({ code: 'invalid' });
  });

  it('subject must be one of the listed options', () => {
    expect(validateField('subject', { ...valid, subject: 'pj' })).toBeUndefined();
    expect(validateField('subject', { ...valid, subject: 'spam' })).toEqual({ code: 'required' });
  });
});

describe('payload', () => {
  it('builds the Web3Forms body with reply-to and a descriptive subject', () => {
    const body = buildWeb3FormsPayload(valid, { accessKey: 'KEY', lang: 'pt', page: 'https://x/' });
    expect(body).toMatchObject({
      access_key: 'KEY',
      subject: 'Contato pelo portfólio: Vaga CLT — Ana Souza',
      replyto: 'ana@empresa.com.br',
      email: 'ana@empresa.com.br',
      name: 'Ana Souza',
      assunto: 'Vaga CLT',
      empresa: 'Empresa X',
      telefone: '+55 (83) 99999-0000',
      message: 'Olá, amigo! Temos uma vaga de backend .NET.',
      idioma: 'pt',
      pagina: 'https://x/',
    });
    expect(body).not.toHaveProperty('botcheck');
  });

  it('marks empty optional fields and uses Portuguese subject labels for any page language', () => {
    const body = buildWeb3FormsPayload({ ...valid, company: '', phone: undefined, subject: 'pj' }, { accessKey: 'K', lang: 'en' });
    expect(body.empresa).toBe('—');
    expect(body.telefone).toBe('—');
    expect(emailSubject({ subject: 'pj', name: 'Bob' })).toBe('Contato pelo portfólio: Vaga PJ / contrato — Bob');
  });

  it('interpolates message templates', () => {
    expect(interpolate('faltam {left} de {min}', { left: 3, min: 20 })).toBe('faltam 3 de 20');
    expect(interpolate('{x} fica', {})).toBe('{x} fica');
  });

  it('treats empty and placeholder keys as not configured', () => {
    expect(isConfigured('')).toBe(false);
    expect(isConfigured(undefined)).toBe(false);
    expect(isConfigured('[SUA_CHAVE]')).toBe(false);
    expect(isConfigured('3f1c2b9a-0000-4000-8000-123456789abc')).toBe(true);
  });
});

describe('submitContact', () => {
  const ok = () => new Response(JSON.stringify({ success: true, message: 'Email sent' }), { status: 200 });

  it('POSTs JSON to the endpoint and reports success', async () => {
    const fetch = vi.fn(async () => ok());
    const result = await submitContact(valid, { endpoint: ENDPOINT, accessKey: 'KEY', fetch });
    expect(result).toEqual({ status: 'sent' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string).replyto).toBe('ana@empresa.com.br');
  });

  it('never sends when the honeypot is filled', async () => {
    const fetch = vi.fn(async () => ok());
    expect(isSpam({ ...valid, botcheck: 'http://spam' })).toBe(true);
    expect(await submitContact({ ...valid, botcheck: 'http://spam' }, { endpoint: ENDPOINT, accessKey: 'KEY', fetch })).toEqual({
      status: 'blocked',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never sends invalid input or without a key', async () => {
    const fetch = vi.fn(async () => ok());
    const invalid = await submitContact({ ...valid, email: 'x' }, { endpoint: ENDPOINT, accessKey: 'KEY', fetch });
    expect(invalid.status).toBe('invalid');
    expect(await submitContact(valid, { endpoint: ENDPOINT, accessKey: '', fetch })).toEqual({ status: 'failed', reason: 'config' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports provider rejections, network errors and timeouts as failures', async () => {
    const rejected = await submitContact(valid, {
      endpoint: ENDPOINT,
      accessKey: 'KEY',
      fetch: async () => new Response(JSON.stringify({ success: false, message: 'Invalid access key' }), { status: 400 }),
    });
    expect(rejected).toEqual({ status: 'failed', reason: 'rejected', detail: 'Invalid access key' });

    const network = await submitContact(valid, {
      endpoint: ENDPOINT,
      accessKey: 'KEY',
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(network).toEqual({ status: 'failed', reason: 'network' });

    const timeout = await submitContact(valid, {
      endpoint: ENDPOINT,
      accessKey: 'KEY',
      timeoutMs: 10,
      fetch: (_url, init) =>
        new Promise((_, reject) =>
          init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
        ),
    });
    expect(timeout).toEqual({ status: 'failed', reason: 'timeout' });
  });
});
