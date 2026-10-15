import type { PersonalCopy } from '../../src/i18n/ui';

/** Personal texts of the interface (title, hero, section intros). The rest of the copy is in src/i18n/ui.ts. Fictitious example. */
export const copy: PersonalCopy = {
  pt: {
    'meta.title': 'Ana Exemplo da Silva · Desenvolvedora Backend .NET',
    'meta.description':
      'Portfólio de exemplo de uma desenvolvedora backend .NET: APIs em C#/.NET, PostgreSQL, Redis e Docker. Teste as APIs dos projetos direto no site.',
    'hero.status': 'Disponível · CLT, PJ ou remoto',
    'hero.role': 'Desenvolvedora Backend .NET',
    'hero.pitch':
      'Construo APIs em C#/.NET com foco em confiabilidade e desempenho: idempotência, cache com Redis e testes de integração.',
    'hero.photoAlt': 'Foto de Ana',
    'skills.intro': 'Ferramentas e práticas que uso no dia a dia em projetos backend.',
    'experience.intro':
      'Desenvolvedora desde 2018, com experiência em APIs de pagamentos e integrações. Texto fictício de exemplo: troque pelo seu em data/personal/copy.ts.',
  },
  en: {
    'meta.title': 'Ana Exemplo da Silva · Backend .NET Developer',
    'meta.description':
      "Example portfolio of a backend .NET developer: C#/.NET APIs, PostgreSQL, Redis and Docker. Try each project's API right on the page.",
    'hero.status': 'Available · CLT, PJ or remote',
    'hero.role': 'Backend .NET Developer',
    'hero.pitch':
      'I build C#/.NET APIs focused on reliability and performance: idempotency, Redis caching and integration tests.',
    'hero.photoAlt': 'Photo of Ana',
    'skills.intro': 'Tools and practices I use every day on backend projects.',
    'experience.intro':
      'A developer since 2018, working on payment APIs and integrations. Fictitious example text: replace it with yours in data/personal/copy.ts.',
  },
};
