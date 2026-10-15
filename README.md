# Portfólio para desenvolvedor backend .NET

Modelo de site pessoal para **desenvolvedor backend .NET**, em português (`/`) e inglês (`/en/`). O repositório traz só dados fictícios de exemplo; os dados reais de quem publica ficam fora do Git (veja [Seus dados](#seus-dados)).

Cada projeto abre um painel na própria página, sem trocar de aba. O recrutador vê o problema, a arquitetura e os números, envia requisições num console de API (ao vivo quando a API está publicada, ou com respostas gravadas) e lê o código ou os contratos.

**Stack:** Astro 7 · TypeScript · CSS com design tokens (tema claro e escuro) · Vitest · Playwright · GitHub Actions · Cloudflare Pages.

## Destaques técnicos

- Site estático, sem framework de UI no cliente: o HTML (inclusive o código destacado pelo Shiki) é gerado no build, e o JavaScript só controla o painel, o console e o formulário.
- Conteúdo tipado: projetos, experiência e habilidades são arquivos YAML validados por schema (`src/content.config.ts`). O build falha se faltar um campo.
- Acessibilidade: painel em `<dialog>` modal, abas no padrão WAI-ARIA, foco gerenciado, respeito a `prefers-reduced-motion` e teste automático de contraste WCAG AA nos dois temas.
- Desempenho: foto em WebP/JPEG responsivos, fontes com `display=swap`, tema aplicado antes da primeira pintura (sem flash).
- Testes: unitários (console de API, formulário, deep links) e e2e (painel, console, temas, celular, SEO, contraste) rodando no CI a cada push.

## Rodar localmente

Requer Node 22.12+.

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # gera dist/
npm run preview      # serve dist/
npm test             # testes unitários (Vitest)
npm run test:e2e     # testes E2E (Playwright), sempre com os dados de exemplo
```

Primeira vez com Playwright fora do CI: `npx playwright install chromium`.

## Seus dados

O código não contém dados pessoais. Tudo o que é seu fica numa pasta de dados:

| Pasta | O que é | Vai para o Git? |
| --- | --- | --- |
| `data/example/` | Dados fictícios ("Ana Exemplo"), usados no CI e por quem clonar o repositório | Sim |
| `data/personal/` | Seus dados reais, usados no build do seu deploy | **Não** (`.gitignore`) |

O site usa `data/personal/` quando ela existe e `data/example/` quando não existe. Para forçar uma delas: `PORTFOLIO_DATA=example npm run dev`.

Para começar o seu: copie `data/example/` para `data/personal/` e troque o conteúdo.

| Arquivo em `data/<pasta>/` | Conteúdo |
| --- | --- |
| `site.config.ts` | Nome, apelido (`handle`), e-mail, GitHub, LinkedIn, CV, cartão `GET /<handle>` sobre a foto, modelos de contratação, formação, idiomas |
| `copy.ts` | Textos pessoais da interface: título da página, descrição, cargo, chamada do topo, introduções de habilidades e experiência |
| `assets/foto.png` | Foto do topo (otimizada no build: WebP 480/800 + JPEG) |
| `public/` | `cv.pdf`, `og.png` (1200×630, imagem de compartilhamento), `favicon.svg`, `robots.txt`. São copiados para `public/` no build |
| `content/projects/*.yaml` | Projetos, um arquivo por projeto, e os diagramas em `content/projects/thumbnails/` |
| `content/experience/*.yaml` | Experiência |
| `content/skills/*.yaml` | Habilidades |
| `content/articles/*.yaml` | Artigos (a seção some se não houver nenhum publicado) |

Faça backup de `data/personal/` fora do Git (ex.: um repositório privado ou uma pasta na nuvem).

## Onde fica cada coisa (código)

| O quê | Onde |
| --- | --- |
| Textos gerais da interface (PT/EN) | `src/i18n/ui.ts` |
| Qual pasta de dados usar | `data-dir.mjs` |
| Formulário de contato | `src/components/ContactForm.astro`, `src/scripts/contact-form.ts`, lógica testada em `src/lib/contact-form.ts`, envio em `src/contact.config.ts` |
| Schema tipado do conteúdo | `src/content.config.ts` |
| **Design tokens** (cores claro/escuro, fontes, espaços, raios) | `src/styles/tokens.css` |
| Estilos | `src/styles/base.css` (global, header, botões), `home.css` (seções), `panel.css` (painel/folha) |
| Destaque de código (Shiki → tokens) | `src/lib/shiki-theme.ts` + variáveis `--shiki-*` em `tokens.css` |
| Lógica do console de API (testada) | `src/lib/api-console.ts` |
| Painel, abas, deep link | `src/scripts/project-panel.ts`, `src/lib/project-hash.ts` |

## Adicionar um projeto

Roteiro passo a passo (o que ler no projeto, regras, testes e entrega): [docs/novo-projeto.md](docs/novo-projeto.md). Abaixo, a referência dos campos.

1. Copie `data/example/content/projects/api-pedidos.yaml` (público, com API ao vivo) ou `encurtador-url.yaml` (repositório privado, respostas gravadas) para `data/personal/content/projects/<slug>.yaml`. O nome do arquivo vira o slug do link (`#projeto/<slug>/testar`).
2. Preencha os campos. O build falha com uma mensagem clara se faltar algo obrigatório. Os principais:
   - `title`, `summary`, `overview.problem`: textos `{ pt, en }`
   - `stack`, `repo` ou `privateRepo: true`, `order` (posição na grade)
   - `card.problem` (frase curta do cartão) e `card.metric` (`value` + `caption`, o número em destaque)
   - `card.thumbnail`: `svg` (arquivo em `data/<pasta>/content/projects/thumbnails/`, viewBox `0 0 320 132`) e `alt` `{ pt, en }`. Desenhe com as classes `th-node`, `th-hero`, `th-flow`, `th-ok`, `th-optional`, `th-dashed`, `th-block`, `th-head`/`th-head-ok` (pontas de seta) e textos `th-t`/`th-t2`/`th-t3`/`th-tok`: as cores vêm dos tokens, então o diagrama acompanha o tema. Rótulos `{{texto|text}}` viram PT ou EN. Use ids de `marker` únicos (prefixe com o slug).
   - `demo.baseUrl`: URL base da API ao vivo; `demo.timeoutMs`: tempo até cair na resposta gravada;
     `demo.mode`: `live` (chama a API) ou `recorded` (ainda sem deploy: mostra só respostas gravadas); `demo.note`: texto ao lado de "API ao vivo"
   - `overview.architecture.columns`: diagrama em camadas (cada coluna é uma pilha ligada por setas; `variant: primary | dashed`). Alternativa: `overview.diagram.src` com SVG/PNG em `data/<pasta>/public/`
   - `overview.metrics`: `{ label: {pt,en}, value: "[X ms]" }`
   - `requests[]`: `name`, `shortName` (pílula no celular), `hint` (2ª linha da lista), `method`, `path`, `headers`, `body` (texto JSON, editável), `tip` (dica abaixo da resposta) e `sample` (`status`, `latencyMs`, `headers`, `body`), que é a resposta gravada mostrada quando a API não responde
   - Em `headers`, `{{token}}` é trocado automaticamente pelo `accessToken` devolvido por uma requisição anterior (ex.: "Gerar token")
   - `snippets[]`: `title`, `file`, `lang` (qualquer linguagem do Shiki), `code`
   - `media`: `type: video|image`, `src` (mp4/webm/gif em `data/<pasta>/public/`, que vai para a raiz do site), `alt`, `caption`
3. `npm run dev` e confira. Use `draft: true` para esconder o projeto.

### Requisitos da API de demo

O console chama a API direto do navegador, então a API precisa liberar **CORS** para o domínio do site (ex.: `app.UseCors(p => p.WithOrigins("https://seu-site.pages.dev").AllowAnyHeader().AllowAnyMethod())`). Se a chamada falhar (DNS, CORS, offline), estourar `timeoutMs` ou devolver 502/503/504 (host gratuito acordando), o painel mostra a resposta gravada com o selo **"resposta gravada"** e um botão para tentar de novo. Respostas 4xx/500 reais da API aparecem normalmente.

## Formulário de contato (Web3Forms)

O formulário envia a mensagem direto do site, sem `mailto:` e sem sair da página, usando o [Web3Forms](https://web3forms.com), grátis e sem backend. O e-mail chega no endereço da sua chave com o assunto `Contato pelo portfólio: <assunto> — <nome>`, e "Responder" vai para o e-mail de quem escreveu (`replyto`). Tem honeypot anti-spam, validação inline em PT/EN, estado de envio e, se algo falhar, mostra o e-mail como alternativa.

Para ativar:

1. Em https://web3forms.com, clique em **Create Access Key** e informe o seu e-mail. A chave chega por e-mail (é pública por design: só permite enviar para esse endereço).
2. Coloque a chave no `.env` (copie de `.env.example`): `PUBLIC_WEB3FORMS_KEY=sua-chave`. Ela é lida no build.

Sem chave, o formulário valida normalmente mas, ao enviar, mostra o e-mail como alternativa e não chama a rede.

**Trocar de provedor:** só `buildWeb3FormsPayload` e `submitContact` em `src/lib/contact-form.ts` conhecem o Web3Forms. Alternativa sem terceiros no navegador: uma **Cloudflare Pages Function** + **Resend**:

```ts
// functions/api/contato.ts  (Cloudflare Pages Function; segredo RESEND_API_KEY em Settings → Variables and Secrets)
export const onRequestPost: PagesFunction<{ RESEND_API_KEY: string }> = async ({ request, env }) => {
  const data = await request.json<Record<string, string>>();
  if (data.botcheck) return Response.json({ success: true }); // honeypot
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Portfólio <contato@seu-dominio.com>', // domínio verificado no Resend
      to: 'voce@seu-dominio.com',
      reply_to: data.email,
      subject: data.subject,
      text: `${data.message}\n\n${data.name} · ${data.email} · ${data.empresa} · ${data.telefone}`,
    }),
  });
  return Response.json({ success: res.ok }, { status: res.ok ? 200 : 502 });
};
```

Depois, aponte `contactForm.endpoint` para `/api/contato` e ajuste `submitContact` para não exigir `accessKey`. Valide os campos também na Function (o navegador não é confiável).

## Deep links

`/#projeto/api-pedidos/testar` abre o projeto direto na aba "Testar a API". Abas: `visao-geral`, `testar`, `codigo`, `demo` (em inglês `#project/<slug>/overview|try|code|demo`; os dois formatos funcionam nas duas línguas). O botão de idioma mantém o link.

## Deploy no Cloudflare Pages (grátis)

Como os seus dados não estão no GitHub, o build é feito na sua máquina e o resultado (`dist/`) é enviado direto para o Cloudflare Pages. Não conecte o repositório pelo "Connect to Git": o build de lá usaria os dados de exemplo.

1. Crie uma conta grátis em https://dash.cloudflare.com.
2. Preencha o `.env` com `SITE_URL` (seu domínio ou `https://<projeto>.pages.dev`) e `PUBLIC_WEB3FORMS_KEY`. Ajuste a linha `Sitemap:` em `data/personal/public/robots.txt`.
3. Rode `npm run deploy`. Na primeira vez, o Wrangler abre o navegador para você entrar na conta e pergunta o nome do projeto (ex.: `portfolio`).
4. Para atualizar o site, rode `npm run deploy` de novo.

Domínio próprio: Cloudflare → Workers & Pages → seu projeto → **Custom domains**.

## Design e tema

- Direção **A · API Docs**, variante **A2 · V1 Display**: nome em Bricolage Grotesque 800 (opsz 96, `clamp()` de 84 px no celular a 156 px no desktop), títulos de seção na mesma fonte, cargo em JetBrains Mono, texto em IBM Plex Sans (Google Fonts, `display=swap`).
- Foto: `<Picture>` do `astro:assets` gera WebP e JPEG em 480 e 800 px com `srcset`/`sizes`, `width`/`height` (sem layout shift), `loading="eager"` e `fetchpriority="high"` (é o LCP). Recorte 4:5 (1:1 no celular) via CSS `object-position: 42% 30%`.
- Imagens temáticas: textura de pontos no hero, diagramas SVG dos projetos, ícones das habilidades e nós da linha do tempo usam só tokens de cor.
- Tema escuro/claro: segue o sistema na primeira visita; o botão sol/lua no header grava a escolha em `localStorage`, aplicada por um script inline no `<head>` antes da pintura (sem flash).
- Contraste: `tests/e2e/contrast.spec.ts` mede todo texto visível (e bordas de controles) nos dois temas, em 1440 e 390 px, e falha abaixo de WCAG AA.
- `node scripts/screenshots.mjs <pasta>` (após o build) gera capturas da home, do painel e do formulário (erro de validação e sucesso) nos dois temas.

## CI

`.github/workflows/ci.yml` roda em todo push/PR: `npm ci` → build → Vitest → Playwright (Chromium) contra `astro preview`. No GitHub não existe `data/personal/`, então o CI testa os dados de exemplo.

## O que fica fora do repositório

O `.gitignore` deixa de fora `data/personal/` (seus dados), `node_modules/`, `dist/`, `dist-e2e/`, `.astro/`, relatórios de teste, arquivos `.env` (use `.env.example` como modelo), configurações locais de editor e os arquivos que o build copia para `public/` (`cv.pdf`, `og.png`, `favicon.svg`, `robots.txt`).

## Licença

O código pode ser consultado e reutilizado como modelo. Os dados de `data/example/` são fictícios.
