/**
 * Project panel: modal <dialog> + WAI-ARIA tabs + hash deep links + API console.
 *
 * - <dialog>.showModal() gives real modal semantics: the rest of the page is inert
 *   (focus is trapped) and Esc fires `cancel`, which closes it.
 * - Focus returns to the card that opened the panel (or the matching card for deep links).
 * - URL hash mirrors state: #projeto/<slug>/<aba>. Back button closes the panel.
 */
import { parseProjectHash, buildProjectHash, TABS, type TabId } from '../lib/project-hash';
import {
  sendRequest,
  highlightJson,
  validateJson,
  STATUS_TEXT,
  statusKind,
  extractToken,
  type ConsoleRequest,
  type SampleResponse,
} from '../lib/api-console';

type Lang = 'pt' | 'en';
interface ClientI18n {
  send: string;
  sendMobile: string;
  sending: string;
  live: string;
  recorded: string;
  recordedLatency: string;
  invalidJson: string;
  tokenPending: string;
  tokenFilled: string;
}

export function initProjectPanel(): void {
  const dialog = document.getElementById('project-panel') as HTMLDialogElement | null;
  if (!dialog) return;
  const lang = (dialog.dataset.lang as Lang) ?? 'pt';
  const i18n = JSON.parse(dialog.dataset.i18n ?? '{}') as ClientI18n;

  let currentSlug: string | null = null;
  let trigger: HTMLElement | null = null;

  const viewFor = (slug: string) =>
    dialog.querySelector<HTMLElement>(`.project-view[data-project="${CSS.escape(slug)}"]`);
  /** The tabs this project has (the "Telas" tab only exists for projects with screenshots). */
  const tabsOf = (view: HTMLElement) =>
    Array.from(view.querySelectorAll<HTMLButtonElement>('[role="tab"]')).map((b) => b.dataset.tab as TabId);

  let skipReturnFocus = false;

  const setHash = (hash: string | null) => {
    const url = location.pathname + location.search + (hash ?? '');
    if (url !== location.pathname + location.search + location.hash) {
      history.replaceState(history.state, '', url);
      window.dispatchEvent(new CustomEvent('project-panel:change'));
    }
  };

  function selectTab(view: HTMLElement, tab: TabId, opts: { focus?: boolean; updateHash?: boolean } = {}) {
    const tabs = view.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs.forEach((btn) => {
      const selected = btn.dataset.tab === tab;
      btn.setAttribute('aria-selected', String(selected));
      btn.tabIndex = selected ? 0 : -1;
      const panel = view.querySelector<HTMLElement>(`#${CSS.escape(btn.getAttribute('aria-controls')!)}`);
      if (panel) panel.hidden = !selected;
      if (selected && opts.focus) btn.focus();
    });
    if (opts.updateHash && currentSlug) setHash(buildProjectHash({ slug: currentSlug, tab }, lang));
  }

  function open(slug: string, tab: TabId): boolean {
    const view = viewFor(slug);
    if (!view) return false;
    dialog!.querySelectorAll<HTMLElement>('.project-view').forEach((v) => (v.hidden = v !== view));
    dialog!.setAttribute('aria-labelledby', `pv-title-${slug}`);
    currentSlug = slug;
    selectTab(view, tabsOf(view).includes(tab) ? tab : 'overview');
    if (!dialog!.open) {
      dialog!.showModal();
      document.body.classList.add('has-modal');
    }
    view.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    return true;
  }

  function close() {
    if (dialog!.open) dialog!.close();
  }

  dialog.addEventListener('close', () => {
    document.body.classList.remove('has-modal');
    const slug = currentSlug;
    currentSlug = null;
    if (parseProjectHash(location.hash)) setHash(null);
    const target =
      (trigger && trigger.isConnected ? trigger : null) ??
      (slug
        ? document.querySelector<HTMLElement>(`.project-card [data-open-project="${CSS.escape(slug)}"]`) ??
          document.querySelector<HTMLElement>(`[data-open-project="${CSS.escape(slug)}"]`)
        : null);
    trigger = null;
    if (skipReturnFocus) {
      skipReturnFocus = false;
      return;
    }
    target?.focus();
  });

  // Click on the backdrop (outside the sheet) closes.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
    const closer = (e.target as Element).closest('[data-panel-close]');
    if (!closer) return;
    // A link that closes the panel (e.g. "#contato") takes the user somewhere else: don't pull focus back to the card.
    if (closer instanceof HTMLAnchorElement && closer.hash) skipReturnFocus = true;
    close();
  });

  // Tabs: click + arrow-key navigation (automatic activation).
  dialog.addEventListener('click', (e) => {
    const tabBtn = (e.target as Element).closest<HTMLButtonElement>('[role="tab"]');
    if (!tabBtn) return;
    const view = tabBtn.closest<HTMLElement>('.project-view')!;
    selectTab(view, tabBtn.dataset.tab as TabId, { focus: true, updateHash: true });
  });
  // Focus trap. showModal() already makes the page inert; this also keeps Tab from
  // escaping to the browser chrome, cycling first <-> last focusable element instead.
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select, video[controls], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (el) =>
        el.tabIndex >= 0 &&
        !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked) &&
        el.getClientRects().length > 0 &&
        !el.closest('[hidden]'),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  dialog.addEventListener('keydown', (e) => {
    const tabBtn = (e.target as Element).closest<HTMLButtonElement>('[role="tab"]');
    if (!tabBtn) return;
    const view = tabBtn.closest<HTMLElement>('.project-view')!;
    const tabs = tabsOf(view);
    const idx = tabs.indexOf(tabBtn.dataset.tab as TabId);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    selectTab(view, tabs[next], { focus: true, updateHash: true });
  });

  // Cards: remember which one opened the panel; the hash change does the opening.
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLAnchorElement>('[data-open-project]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // allow "open in new tab"
    e.preventDefault();
    trigger = link;
    const slug = link.dataset.openProject!;
    const tab = (TABS as readonly string[]).includes(link.dataset.openTab ?? '') ? (link.dataset.openTab as TabId) : 'overview';
    history.pushState(history.state, '', buildProjectHash({ slug, tab }, lang));
    window.dispatchEvent(new CustomEvent('project-panel:change'));
    open(slug, tab);
  });

  const syncFromHash = () => {
    const route = parseProjectHash(location.hash);
    if (route && open(route.slug, route.tab)) return;
    close();
  };
  window.addEventListener('hashchange', syncFromHash);
  window.addEventListener('popstate', syncFromHash);
  if (parseProjectHash(location.hash)) syncFromHash();

  dialog.querySelectorAll<HTMLElement>('[data-console]').forEach((root) => initConsole(root, i18n, lang));
  dialog.querySelectorAll<HTMLElement>('[data-gallery]').forEach(initGallery);
}

/**
 * "Telas" tab: one screenshot at a time, with previous/next buttons, the arrow keys and a
 * strip of thumbnails. Clicking the screenshot toggles its full size (the stage then scrolls).
 */
function initGallery(root: HTMLElement) {
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-slide]'));
  const thumbs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-thumb]'));
  const counter = root.querySelector<HTMLElement>('[data-gallery-counter]')!;
  const template = root.dataset.counter ?? '{n} / {total}';
  let index = 0;

  const setZoom = (zoomed: boolean) => {
    root.classList.toggle('gallery--zoomed', zoomed);
    for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
      btn.setAttribute('aria-pressed', String(zoomed));
      btn.querySelector('[data-zoom-text]')!.textContent = (zoomed ? root.dataset.unzoomLabel : root.dataset.zoomLabel) ?? '';
    }
  };

  const show = (i: number) => {
    index = (i + slides.length) % slides.length;
    slides.forEach((slide, n) => (slide.hidden = n !== index));
    thumbs.forEach((thumb, n) => {
      if (n === index) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });
    counter.textContent = template.replace('{n}', String(index + 1)).replace('{total}', String(slides.length));
    setZoom(false);
  };

  root.querySelector('[data-gallery-prev]')?.addEventListener('click', () => show(index - 1));
  root.querySelector('[data-gallery-next]')?.addEventListener('click', () => show(index + 1));
  thumbs.forEach((thumb, n) => thumb.addEventListener('click', () => show(n)));
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
    btn.addEventListener('click', () => setZoom(!root.classList.contains('gallery--zoomed')));
  }
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    show(index + (e.key === 'ArrowRight' ? 1 : -1));
  });
}

interface ConsoleRequestData extends ConsoleRequest {
  id: string;
  tip: string;
  sample: SampleResponse;
}

function initConsole(root: HTMLElement, i18n: ClientI18n, lang: Lang) {
  const requests = JSON.parse(
    root.querySelector('script[data-requests]')?.textContent ?? '[]',
  ) as ConsoleRequestData[];
  const baseUrl = root.dataset.baseUrl!;
  const timeoutMs = Number(root.dataset.timeout) || undefined;
  const offline = root.dataset.mode === 'recorded';

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const selMethod = q<HTMLElement>('[data-sel-method]');
  const selPath = q<HTMLElement>('[data-sel-path]');
  const selHeaders = q<HTMLElement>('[data-sel-headers]');
  const bodyWrap = q<HTMLElement>('[data-body-wrap]');
  const textarea = q<HTMLTextAreaElement>('[data-body]');
  const bodyError = q<HTMLElement>('[data-body-error]');
  const sendBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-send]'));
  const resetBtn = q<HTMLButtonElement>('[data-reset-body]');
  const retryBtn = q<HTMLButtonElement>('[data-retry]');
  const response = q<HTMLElement>('[data-response]');
  const placeholder = q<HTMLElement>('[data-placeholder]');
  const meta = q<HTMLElement>('[data-meta]');
  const sourceEl = q<HTMLElement>('[data-source]');
  const statusEl = q<HTMLElement>('[data-status]');
  const latencyEl = q<HTMLElement>('[data-latency]');
  const resHeaders = q<HTMLElement>('[data-res-headers]');
  const hint = q<HTMLElement>('[data-recorded-hint]');
  const liveLine = root.querySelector<HTMLElement>('[data-live-line]');
  const tipEl = q<HTMLElement>('[data-tip]');
  const announce = q<HTMLElement>('[data-announce]');
  const output = q<HTMLElement>('[data-output]');
  const outputCode = q<HTMLElement>('[data-output-code]');

  const edited = new Map<string, string>();
  const vars: Record<string, string> = {};
  let current = requests[0];

  /** Header value as shown: {{token}} becomes a shortened token or a hint to fetch one. */
  const displayHeader = (value: string) =>
    value.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
      vars[name] ? `${vars[name].slice(0, 10)}… ${i18n.tokenFilled}` : `… ${i18n.tokenPending}`,
    );

  const renderHeaders = () => {
    selHeaders.replaceChildren();
    for (const [k, v] of Object.entries(current.headers ?? {})) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = displayHeader(v);
      selHeaders.append(dt, dd);
    }
    selHeaders.hidden = selHeaders.childElementCount === 0;
  };

  const select = (id: string) => {
    current = requests.find((r) => r.id === id) ?? requests[0];
    selMethod.textContent = current.method;
    selMethod.dataset.method = current.method;
    selPath.textContent = current.path;
    renderHeaders();
    const hasBody = current.body !== undefined;
    bodyWrap.hidden = !hasBody;
    textarea.value = edited.get(current.id) ?? current.body ?? '';
    textarea.rows = Math.min(10, Math.max(3, textarea.value.split('\n').length));
    resetBtn.hidden = !edited.has(current.id);
    tipEl.textContent = current.tip;
    tipEl.hidden = !current.tip;
    validate();
  };

  const validate = (): boolean => {
    if (bodyWrap.hidden) return true;
    const result = validateJson(textarea.value);
    textarea.setAttribute('aria-invalid', String(!result.ok));
    bodyError.textContent = result.ok ? '' : `${i18n.invalidJson}: ${result.error}`;
    return result.ok;
  };

  root.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.type === 'radio') select(input.value);
  });
  textarea.addEventListener('input', () => {
    edited.set(current.id, textarea.value);
    resetBtn.hidden = false;
    validate();
  });
  resetBtn.addEventListener('click', () => {
    edited.delete(current.id);
    textarea.value = current.body ?? '';
    resetBtn.hidden = true;
    validate();
    textarea.focus();
  });

  const setBusy = (busy: boolean) => {
    response.setAttribute('aria-busy', String(busy));
    retryBtn.disabled = busy;
    for (const b of sendBtns) {
      b.disabled = busy;
      const label = b.querySelector('[data-send-label]')!;
      const mobile = b.closest('.console-sticky') !== null;
      label.textContent = busy ? i18n.sending : mobile ? i18n.sendMobile : i18n.send;
    }
  };

  const run = async () => {
    if (!validate()) {
      textarea.focus();
      return;
    }
    setBusy(true);

    const result = await sendRequest({
      baseUrl,
      request: current,
      sample: current.sample,
      bodyOverride: bodyWrap.hidden ? undefined : textarea.value,
      timeoutMs,
      offline,
      vars,
    });

    const token = extractToken(result.json);
    if (token) vars.token = token;
    renderHeaders();

    const recorded = result.source === 'recorded';
    placeholder.hidden = true;
    meta.hidden = false;
    sourceEl.textContent = recorded ? i18n.recorded : i18n.live;
    sourceEl.dataset.source = result.source;
    const reason = STATUS_TEXT[result.status];
    statusEl.textContent = reason ? `${result.status} ${reason}` : String(result.status);
    statusEl.dataset.kind = statusKind(result.status);
    const fmt = new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en');
    // Live: measured round trip. Recorded: the latency stored with the recording
    // (the failed attempt's time is not a meaningful number for the visitor).
    const ms = recorded ? result.recordedLatencyMs : result.latencyMs;
    latencyEl.textContent = ms !== undefined ? `${fmt.format(ms)} ms` : '';
    latencyEl.title = recorded ? i18n.recordedLatency : '';
    // The "asleep" notice only applies when a live call was attempted and failed.
    const asleep = recorded && !offline;
    hint.hidden = !asleep;
    if (liveLine) liveLine.hidden = asleep;

    const headerLines = Object.entries(result.headers).map(([k, v]) => `${k}: ${v}`);
    resHeaders.textContent = headerLines.join('\n');
    resHeaders.hidden = headerLines.length === 0;
    output.hidden = false;
    outputCode.innerHTML = highlightJson(result.bodyText);
    announce.textContent = `${statusEl.textContent} · ${latencyEl.textContent}${recorded ? ' · ' + i18n.recorded : ''}`;

    setBusy(false);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    response.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  };

  for (const b of sendBtns) b.addEventListener('click', run);
  retryBtn.addEventListener('click', run);
  select(current.id);
}
