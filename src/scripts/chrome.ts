/**
 * Site chrome: theme toggle, phone menu, copy-e-mail button, and a language switch
 * that keeps the current deep link.
 *
 * Theme: the inline script in <head> applies a saved choice before first paint.
 * Without one, tokens follow the OS via `color-scheme` + light-dark().
 */

const media = () => matchMedia('(prefers-color-scheme: dark)');

export function currentTheme(): 'light' | 'dark' {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return media().matches ? 'dark' : 'light';
}

function initThemeToggle() {
  const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (!toggle) return;
  // The button is "Light theme", pressed while the light theme is active.
  const sync = () => toggle.setAttribute('aria-pressed', String(currentTheme() === 'light'));
  sync();
  media().addEventListener('change', sync);
  toggle.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* storage blocked: the theme still applies for this page view */
    }
    sync();
  });
}

function initMenu() {
  const button = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const nav = document.getElementById('site-nav');
  if (!button || !nav) return;
  const set = (open: boolean) => {
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  button.addEventListener('click', () => set(button.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      set(false);
      button.focus();
    }
  });
}

function initCopyButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    const label = btn.textContent;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy!);
        btn.textContent = btn.dataset.copiedLabel ?? label;
        setTimeout(() => (btn.textContent = label), 2000);
      } catch {
        /* clipboard unavailable: the address is visible next to the button */
      }
    });
  });
}

function initLangSwitch() {
  const links = document.querySelectorAll<HTMLAnchorElement>('[data-lang-switch]');
  links.forEach((link) => {
    const base = link.getAttribute('href')!.split('#')[0];
    const syncHash = () => {
      link.href = base + location.hash;
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('project-panel:change', syncHash);
  });
}

export function initChrome(): void {
  initThemeToggle();
  initMenu();
  initCopyButtons();
  initLangSwitch();
}
