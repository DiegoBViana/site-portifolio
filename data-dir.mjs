// Qual pasta de dados o site usa:
//   data/personal  seus dados reais (fora do Git; usada no deploy)
//   data/example   dados fictícios versionados (usada no CI e por quem clonar o repositório)
// PORTFOLIO_DATA=example|personal força uma delas.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export const dataName =
  process.env.PORTFOLIO_DATA ?? (existsSync(`${root}data/personal/site.config.ts`) ? 'personal' : 'example');

// Caminho absoluto do sistema (no Windows: F:\...\data\personal). Para o Vite e o fs.
// Loaders do Astro recebem um caminho relativo (./data/<pasta>), porque um caminho do Windows vira URL inválida.
export const dataDir = fileURLToPath(new URL(`./data/${dataName}`, import.meta.url));
