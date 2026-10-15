import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  sendRequest,
  formatJson,
  highlightJson,
  validateJson,
  buildUrl,
  fillTemplate,
  extractToken,
  statusKind,
  type ConsoleRequest,
  type SampleResponse,
} from '../../src/lib/api-console';

const request: ConsoleRequest = {
  method: 'POST',
  path: '/api/orders',
  headers: { 'Content-Type': 'application/json' },
  body: '{"items":[1]}',
};
const sample: SampleResponse = { status: 201, latencyMs: 87, body: { id: 'abc', total: 10.5 } };
const base = 'https://demo.example.com/';

/** A fake clock returning the given timestamps in order (last one repeats). */
function clock(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

afterEach(() => {
  vi.useRealTimers();
});

describe('sendRequest — live responses', () => {
  it('returns the live response, status and measured latency', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"ok":true,"n":1}', { status: 201, headers: { 'content-type': 'application/json' } }));
    const result = await sendRequest({ baseUrl: base, request, sample, fetchImpl, now: clock(1000, 1042.4) });

    expect(result.source).toBe('live');
    expect(result.status).toBe(201);
    expect(result.latencyMs).toBe(42);
    expect(result.bodyText).toBe('{\n  "ok": true,\n  "n": 1\n}');
    expect(result.contentType).toBe('application/json');
    expect(result.url).toBe('https://demo.example.com/api/orders');
  });

  it('sends method, headers and the edited body', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 }));
    await sendRequest({ baseUrl: base, request, sample, fetchImpl, bodyOverride: '{"edited":true}' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://demo.example.com/api/orders');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe('{"edited":true}');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('never sends a body with GET', async () => {
    const fetchImpl = vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => new Response('[]'));
    await sendRequest({ baseUrl: base, request: { method: 'GET', path: '/x', body: '{"a":1}' }, sample, fetchImpl });
    expect(fetchImpl.mock.calls[0][1]?.body).toBeUndefined();
  });

  it('keeps 4xx responses live (they are real API answers, e.g. validation errors)', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"title":"Bad Request"}', { status: 400 }));
    const result = await sendRequest({ baseUrl: base, request, sample, fetchImpl });
    expect(result.source).toBe('live');
    expect(result.status).toBe(400);
  });

  it('shows non-JSON live bodies as plain text', async () => {
    const fetchImpl = vi.fn(async () => new Response('pong', { status: 200 }));
    const result = await sendRequest({ baseUrl: base, request, sample, fetchImpl });
    expect(result.bodyText).toBe('pong');
  });
});

describe('sendRequest — fallback to the recorded response', () => {
  it('falls back on a network error (DNS, CORS, offline)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await sendRequest({ baseUrl: base, request, sample, fetchImpl, now: clock(0, 15) });
    expect(result.source).toBe('recorded');
    expect(result.failure).toBe('network');
    expect(result.status).toBe(201);
    expect(result.recordedLatencyMs).toBe(87);
    expect(result.latencyMs).toBe(15);
    expect(JSON.parse(result.bodyText)).toEqual(sample.body);
  });

  it('aborts and falls back after the timeout', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );
    const pending = sendRequest({ baseUrl: base, request, sample, fetchImpl, timeoutMs: 3000, now: clock(0, 3001) });
    await vi.advanceTimersByTimeAsync(2999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(aborted).toBe(true);
    expect(result.source).toBe('recorded');
    expect(result.failure).toBe('timeout');
    expect(result.latencyMs).toBe(3001);
  });

  it.each([502, 503, 504])('falls back when the free-tier host answers %i while waking up', async (status) => {
    const fetchImpl = vi.fn(async () => new Response('<html>Service waking up</html>', { status }));
    const result = await sendRequest({ baseUrl: base, request, sample, fetchImpl });
    expect(result.source).toBe('recorded');
    expect(result.failure).toBe('unavailable');
    expect(result.status).toBe(201);
  });

  it('does not fall back on a 500 from the application itself', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"title":"boom"}', { status: 500 }));
    const result = await sendRequest({ baseUrl: base, request, sample, fetchImpl });
    expect(result.source).toBe('live');
    expect(result.status).toBe(500);
  });

  it('falls back when fetch is not available at all', async () => {
    vi.stubGlobal('fetch', undefined);
    try {
      const result = await sendRequest({ baseUrl: base, request, sample });
      expect(result.source).toBe('recorded');
      expect(result.failure).toBe('network');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('never throws, even if reading the body fails', async () => {
    const broken = { status: 200, headers: new Headers(), text: () => Promise.reject(new Error('stream')) } as unknown as Response;
    const result = await sendRequest({ baseUrl: base, request, sample, fetchImpl: async () => broken });
    expect(result.source).toBe('recorded');
  });
});

describe('sendRequest — offline mode, templates and headers', () => {
  it('offline mode returns the recorded sample without touching the network', async () => {
    const fetchImpl = vi.fn();
    const result = await sendRequest({ baseUrl: base, request, sample, fetchImpl, offline: true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.source).toBe('recorded');
    expect(result.failure).toBe('offline');
    expect(result.recordedLatencyMs).toBe(87);
  });

  it('fills {{token}} in header values before sending', async () => {
    const fetchImpl = vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => new Response('{}'));
    await sendRequest({
      baseUrl: base,
      request: { method: 'GET', path: '/x', headers: { Authorization: 'Bearer {{token}}' } },
      sample,
      fetchImpl,
      vars: { token: 'abc' },
    });
    expect(fetchImpl.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer abc' });
  });

  it('exposes notable live response headers and the parsed JSON body', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{"accessToken":"t0k"}', { status: 200, headers: { 'Idempotent-Replayed': 'true', 'X-Other': '1' } }),
    );
    const result = await sendRequest({ baseUrl: base, request, sample, fetchImpl });
    expect(result.headers).toEqual({ 'Idempotent-Replayed': 'true' });
    expect(extractToken(result.json)).toBe('t0k');
  });

  it('recorded responses carry the recorded headers', async () => {
    const result = await sendRequest({
      baseUrl: base,
      request,
      sample: { ...sample, headers: { 'Idempotent-Replayed': 'true' } },
      offline: true,
    });
    expect(result.headers).toEqual({ 'Idempotent-Replayed': 'true' });
  });
});

describe('fillTemplate / extractToken', () => {
  it('replaces known placeholders and leaves unknown ones', () => {
    expect(fillTemplate({ A: 'x {{a}} {{b}}' }, { a: '1' })).toEqual({ A: 'x 1 {{b}}' });
  });
  it('finds common token field names', () => {
    expect(extractToken({ access_token: 'a' })).toBe('a');
    expect(extractToken({ token: 'b' })).toBe('b');
    expect(extractToken({ nope: 1 })).toBeUndefined();
    expect(extractToken('text')).toBeUndefined();
  });
});

describe('formatJson', () => {
  it('pretty-prints objects with 2-space indentation', () => {
    expect(formatJson({ a: 1, b: [true, null] })).toBe('{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}');
  });
  it('re-formats compact JSON text', () => {
    expect(formatJson('{"a":{"b":"c"}}')).toBe('{\n  "a": {\n    "b": "c"\n  }\n}');
  });
  it('returns non-JSON text unchanged and empty for empty input', () => {
    expect(formatJson('not json')).toBe('not json');
    expect(formatJson('   ')).toBe('');
    expect(formatJson(undefined)).toBe('');
  });
});

describe('highlightJson', () => {
  it('wraps keys, strings, numbers, booleans and null', () => {
    const html = highlightJson('{"id": "x", "n": -1.5e3, "ok": true, "v": null}');
    expect(html).toContain('<span class="json-key">&quot;id&quot;</span><span class="json-punct">:</span>');
    expect(html).toContain('<span class="json-string">&quot;x&quot;</span>');
    expect(html).toContain('<span class="json-number">-1.5e3</span>');
    expect(html).toContain('<span class="json-boolean">true</span>');
    expect(html).toContain('<span class="json-null">null</span>');
  });
  it('escapes HTML so API responses cannot inject markup', () => {
    const html = highlightJson('{"x": "<img src=x onerror=alert(1)>"}');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
  it('marks punctuation and [PLACEHOLDER] values', () => {
    const html = highlightJson('{"a": ["[ANOS DE EXPERIÊNCIA]", "x"]}');
    expect(html).toContain('<span class="json-punct">{</span>');
    expect(html).toContain('<span class="json-punct">[</span>');
    expect(html).toContain('<span class="json-placeholder">&quot;[ANOS DE EXPERIÊNCIA]&quot;</span>');
    expect(html).toContain('<span class="json-string">&quot;x&quot;</span>');
  });
  it('escapes plain text outside tokens', () => {
    expect(highlightJson('<b>hi</b>')).toBe('&lt;b&gt;hi&lt;/b&gt;');
  });
  it('handles escaped quotes inside strings', () => {
    const html = highlightJson('{"q": "say \\"hi\\""}');
    expect(html).toContain('<span class="json-string">&quot;say \\&quot;hi\\&quot;&quot;</span>');
  });
});

describe('helpers', () => {
  it('validateJson reports errors and accepts empty bodies', () => {
    expect(validateJson('{"a":1}')).toEqual({ ok: true });
    expect(validateJson('')).toEqual({ ok: true });
    expect(validateJson('{a:1}').ok).toBe(false);
  });
  it('buildUrl joins base and path with exactly one slash', () => {
    expect(buildUrl('https://x.dev/', '/a')).toBe('https://x.dev/a');
    expect(buildUrl('https://x.dev', 'a?b=1')).toBe('https://x.dev/a?b=1');
  });
  it('statusKind groups status codes', () => {
    expect(statusKind(204)).toBe('success');
    expect(statusKind(302)).toBe('redirect');
    expect(statusKind(404)).toBe('client-error');
    expect(statusKind(503)).toBe('server-error');
  });
});
