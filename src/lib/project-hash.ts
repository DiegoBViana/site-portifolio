/**
 * Deep links into the project panel:
 *   #projeto/<slug>/<aba>   (PT)   e.g. #projeto/api-pedidos/testar
 *   #project/<slug>/<tab>   (EN)   e.g. #project/api-pedidos/try
 * Both forms are accepted on both language versions, so links survive a language switch.
 */
export const TABS = ['overview', 'try', 'code', 'demo'] as const;
export type TabId = (typeof TABS)[number];

const TAB_SLUGS: Record<'pt' | 'en', Record<TabId, string>> = {
  pt: { overview: 'visao-geral', try: 'testar', code: 'codigo', demo: 'demo' },
  en: { overview: 'overview', try: 'try', code: 'code', demo: 'demo' },
};

const PREFIX = { pt: 'projeto', en: 'project' } as const;

export interface ProjectRoute {
  slug: string;
  tab: TabId;
}

export function parseProjectHash(hash: string): ProjectRoute | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return null;
  }
  const parts = decoded.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const [prefix, slug, tabSlug] = parts;
  if (prefix !== PREFIX.pt && prefix !== PREFIX.en) return null;
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  let tab: TabId = 'overview';
  if (tabSlug) {
    const found = TABS.find((t) => TAB_SLUGS.pt[t] === tabSlug || TAB_SLUGS.en[t] === tabSlug);
    if (found) tab = found;
  }
  return { slug, tab };
}

export function buildProjectHash(route: ProjectRoute, lang: 'pt' | 'en'): string {
  return `#${PREFIX[lang]}/${route.slug}/${TAB_SLUGS[lang][route.tab]}`;
}
