/**
 * Framework-free logic for the "Testar a API" console.
 * Kept pure (fetch and clock are injectable) so it can be unit-tested with Vitest.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ConsoleRequest {
  method: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface SampleResponse {
  status: number;
  latencyMs?: number;
  headers?: Record<string, string>;
  body: unknown;
}

export type FailureReason = 'timeout' | 'network' | 'unavailable' | 'offline';

export interface ConsoleResult {
  /** `live` = real response from the demo API; `recorded` = fallback sample from content. */
  source: 'live' | 'recorded';
  status: number;
  /** Time measured for the live attempt (even when it failed). */
  latencyMs: number;
  /** For recorded responses: the latency stored with the sample, if any. */
  recordedLatencyMs?: number;
  /** Pretty-printed body ready for display. */
  bodyText: string;
  /** Parsed JSON body, when the body is JSON (used e.g. to pick up an access token). */
  json?: unknown;
  /** Notable response headers (recorded ones, or Idempotent-Replayed / Location when live). */
  headers: Record<string, string>;
  contentType?: string;
  /** Why the live call was abandoned (only when source === 'recorded'). */
  failure?: FailureReason;
  url: string;
}

export interface SendOptions {
  baseUrl: string;
  request: ConsoleRequest;
  sample: SampleResponse;
  /** Body typed by the visitor; defaults to request.body. */
  bodyOverride?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Skip the network entirely (demo not deployed): return the recorded sample. */
  offline?: boolean;
  /** Values for {{name}} placeholders in header values, e.g. { token: 'eyJ…' }. */
  vars?: Record<string, string>;
}

/** Gateway statuses typical of a free-tier host that is still waking up. */
export const WAKING_STATUSES = new Set([502, 503, 504]);

export const DEFAULT_TIMEOUT_MS = 6000;

/** Response headers worth showing above the body when present. */
export const NOTABLE_HEADERS = ['Idempotent-Replayed', 'Location', 'Retry-After'];

/**
 * Replaces {{name}} placeholders in header values. Unknown names are left as-is
 * (the server then answers 401, which is the honest outcome).
 */
export function fillTemplate(headers: Record<string, string>, vars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = v.replace(/\{\{(\w+)\}\}/g, (m, name: string) => vars[name] ?? m);
  }
  return out;
}

/** Finds an access token in a JSON body (accessToken / access_token / token). */
export function extractToken(json: unknown): string | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const o = json as Record<string, unknown>;
  for (const k of ['accessToken', 'access_token', 'token']) {
    if (typeof o[k] === 'string' && o[k]) return o[k] as string;
  }
  return undefined;
}

export function buildUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

/** Pretty-prints JSON values or JSON text. Non-JSON text is returned unchanged. */
export function formatJson(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return '';
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return value;
    }
  }
  if (value === undefined) return '';
  return JSON.stringify(value, null, 2);
}

export function validateJson(text: string): { ok: true } | { ok: false; error: string } {
  if (text.trim() === '') return { ok: true };
  try {
    JSON.parse(text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const JSON_TOKEN =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

/** "[ANOS DE EXPERIÊNCIA]"-style values still to be filled in: styled like numbers so they stand out. */
const PLACEHOLDER = /^"\[[^\]]*[A-ZÀ-Ý]{2,}[^\]]*\]/;

/**
 * Wraps JSON tokens in <span class="json-*"> for syntax colouring
 * (key, string, number, boolean/null, punct, placeholder).
 * Every piece of the input is HTML-escaped, so the output is safe for innerHTML.
 */
export function highlightJson(text: string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(JSON_TOKEN)) {
    const index = m.index ?? 0;
    out += escapeHtml(text.slice(last, index));
    const [whole, str, colon, lit, num, punct] = m;
    if (str !== undefined) {
      if (colon) {
        out += `<span class="json-key">${escapeHtml(str)}</span><span class="json-punct">${colon}</span>`;
      } else {
        const cls = PLACEHOLDER.test(str) ? 'json-placeholder' : 'json-string';
        out += `<span class="${cls}">${escapeHtml(str)}</span>`;
      }
    } else if (lit) out += `<span class="json-${lit === 'null' ? 'null' : 'boolean'}">${lit}</span>`;
    else if (num) out += `<span class="json-number">${num}</span>`;
    else if (punct) out += `<span class="json-punct">${punct}</span>`;
    else out += escapeHtml(whole);
    last = index + whole.length;
  }
  return out + escapeHtml(text.slice(last));
}

function recorded(
  sample: SampleResponse,
  latencyMs: number,
  failure: FailureReason,
  url: string,
): ConsoleResult {
  return {
    source: 'recorded',
    status: sample.status,
    latencyMs,
    recordedLatencyMs: sample.latencyMs,
    bodyText: formatJson(sample.body),
    json: sample.body,
    headers: sample.headers ?? {},
    contentType: 'application/json',
    failure,
    url,
  };
}

/**
 * Calls the live demo API. Falls back to the recorded sample when the call
 * times out, fails at the network level (DNS, CORS, offline) or the host
 * answers with a "waking up" gateway status (502/503/504).
 * Never throws.
 */
export async function sendRequest(opts: SendOptions): Promise<ConsoleResult> {
  const {
    baseUrl,
    request,
    sample,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch?.bind(globalThis),
    now = () => (globalThis.performance ? performance.now() : Date.now()),
  } = opts;
  const url = buildUrl(baseUrl, request.path);
  const body = opts.bodyOverride ?? request.body;
  if (opts.offline) return recorded(sample, 0, 'offline', url);
  const headers = request.headers ? fillTemplate(request.headers, opts.vars ?? {}) : undefined;
  const hasBody = request.method !== 'GET' && body !== undefined && body.trim() !== '';

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const start = now();
  try {
    if (!fetchImpl) throw new TypeError('fetch is not available');
    const res = await fetchImpl(url, {
      method: request.method,
      headers,
      body: hasBody ? body : undefined,
      signal: controller.signal,
      mode: 'cors',
    });
    const text = await res.text();
    const latencyMs = Math.round(now() - start);
    if (timedOut) return recorded(sample, latencyMs, 'timeout', url);
    if (WAKING_STATUSES.has(res.status)) return recorded(sample, latencyMs, 'unavailable', url);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    const shown: Record<string, string> = {};
    for (const name of NOTABLE_HEADERS) {
      const v = res.headers.get(name);
      if (v !== null) shown[name] = v;
    }
    return {
      source: 'live',
      status: res.status,
      latencyMs,
      bodyText: formatJson(text),
      json,
      headers: shown,
      contentType: res.headers.get('content-type') ?? undefined,
      url,
    };
  } catch {
    const latencyMs = Math.round(now() - start);
    return recorded(sample, latencyMs, timedOut ? 'timeout' : 'network', url);
  } finally {
    clearTimeout(timer);
  }
}

/** Reason phrases for the status badge (subset; unknown codes show the number only). */
export const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export function statusKind(status: number): 'success' | 'redirect' | 'client-error' | 'server-error' {
  if (status >= 500) return 'server-error';
  if (status >= 400) return 'client-error';
  if (status >= 300) return 'redirect';
  return 'success';
}
