import type { Lang } from '../../src/i18n/ui';

/**
 * Dados FICTÍCIOS de exemplo. Para o seu site, copie a pasta data/example para data/personal
 * (que fica fora do Git) e troque estes dados pelos seus. Veja o README.
 */
export const profile = {
  /** Shown big in the hero as "Ana." (design A2 · V1 Display). */
  shortName: 'Ana',
  /** Lower-case handle: "~/ana" in the header and "GET /ana" on the hero card. */
  handle: 'ana',
  /** Full name: meta tags, JSON-LD, footer, the hero card. */
  name: 'Ana Exemplo da Silva',
  location: 'Recife, PE, Brasil',
  email: 'ana@example.com',
  github: 'https://github.com/exemplo',
  githubLabel: 'github.com/exemplo',
  linkedin: 'https://www.linkedin.com/in/exemplo',
  linkedinLabel: 'in/exemplo',
  /** PDF in data/<pasta>/public/. */
  cv: '/cv.pdf',
  cvLabel: 'Curriculo_Ana_Exemplo.pdf',
  /** Source repository of this site (footer link). */
  siteRepo: 'https://github.com/DiegoBViana/site-portifolio',
  ogImage: '/og.png',
  /** JSON-LD (search engines). */
  address: { locality: 'Recife', region: 'PE', country: 'BR' },
  knowsAbout: ['C#', '.NET', 'REST APIs', 'PostgreSQL', 'Redis', 'Docker'],
};

/** Contract types shown as chips in the contact section. */
export const hiring: Record<Lang, string[]> = {
  pt: ['CLT', 'PJ', 'Remoto'],
  en: ['CLT', 'PJ', 'Remote'],
};

/**
 * The `GET /<handle> → 200 OK` card over the hero photo: one row per line, each a list of
 * `"key": value` pairs. `phone: true` rows are also shown on phones (where the card is shorter).
 */
export interface HeroCardRow {
  fields: [key: string, value: unknown][];
  phone?: boolean;
}
export const heroCard: Record<Lang, HeroCardRow[]> = {
  pt: [
    { fields: [['nome', 'Ana Exemplo da Silva']], phone: true },
    { fields: [['stack', ['C#', '.NET', 'PostgreSQL', 'Redis']]] },
    { fields: [['local', 'Recife, PE']] },
    { fields: [['disponivel', true], ['remoto', true]], phone: true },
  ],
  en: [
    { fields: [['name', 'Ana Exemplo da Silva']], phone: true },
    { fields: [['stack', ['C#', '.NET', 'PostgreSQL', 'Redis']]] },
    { fields: [['location', 'Recife, PE']] },
    { fields: [['available', true], ['remote', true]], phone: true },
  ],
};

/** Education and languages, shown under the experience timeline. */
export const education: { course: Record<Lang, string>; school: string; period: string }[] = [
  { course: { pt: 'Graduação em Ciência da Computação', en: 'BSc in Computer Science' }, school: 'Universidade Exemplo', period: '2014–2018' },
];
export const spokenLanguages: Record<Lang, string[]> = {
  pt: ['Português (nativo)', 'Inglês (avançado)'],
  en: ['Portuguese (native)', 'English (advanced)'],
};
