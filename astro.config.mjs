// @ts-check
import { cpSync, existsSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';
import { dataDir, dataName } from './data-dir.mjs';

// Domínio final (canonical, Open Graph, sitemap): SITE_URL no .env ou no ambiente.
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const SITE_URL = process.env.SITE_URL ?? env.SITE_URL ?? 'https://example.com';

// Arquivos públicos da pasta de dados (cv.pdf, og.png, favicon.svg, robots.txt) vão para public/ antes do build.
// Esses arquivos em public/ são gerados: estão no .gitignore.
if (existsSync(`${dataDir}/public`)) cpSync(`${dataDir}/public`, 'public', { recursive: true });
console.log(`[portfolio] dados: data/${dataName}`);

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'pt',
        locales: { pt: 'pt-BR', en: 'en' },
      },
    }),
  ],
  vite: {
    resolve: { alias: { '@data': dataDir } },
  },
});
