# Guia: adicionar um projeto novo ao portfólio

Roteiro para colocar um projeto novo no site. A referência completa dos campos do YAML está no [README](../README.md#adicionar-um-projeto) e no schema em `src/content.config.ts`. Este guia diz **como** fazer, na ordem, e o que não pode faltar.

Exemplos: `data/example/content/projects/api-pedidos.yaml` (repositório público, API ao vivo) e `encurtador-url.yaml` (repositório privado, respostas gravadas).

Projetos reais ficam em `data/personal/content/projects/`, que não vai para o Git (veja "Seus dados" no README).

## 0. Regras que valem sempre

- **A pasta do projeto é só leitura.** Consulte o código, a documentação e os contratos, mas nunca edite, crie arquivos nem faça commit nela. O site é o único lugar que muda.
- **Nada inventado como se fosse real.** Números (testes, latência, cobertura) vêm do projeto: README, ADRs, CI, relatórios. Se um número não existe, ele fica de fora. Não use `[X]` nem placeholders: o e2e acusa placeholders fora das métricas, e o recrutador também.
- **Projeto que ainda não existe não aparece.** Use `draft: true` até ter repositório (ou demo) de verdade.
- **Repositório privado:** `privateRepo: true` e sem `repo`. O painel mostra "Repositório privado" e a aba Código vira contratos, schemas e regras de arquitetura. Nunca cole código-fonte de um projeto privado.
- **Nunca publique segredos:** API keys, senhas, IDs de hardware, URLs internas ou dados pessoais. Nas requisições, chave fica mascarada (`pc_demo_••••••••`).
- **Sempre PT e EN.** Todo texto visível é `{ pt, en }`. Português do Brasil, frases curtas, sem travessão.
- **Edições feitas à mão valem mais.** Antes de sobrescrever um arquivo, confira se ele mudou desde a última vez e preserve o que foi escrito.

## 1. Entender o projeto (leitura)

Leia, nesta ordem, só o que precisar:

1. `README.md`: o que é, stack, status, como rodar, endpoints.
2. `docs/adr/` (ou equivalente): 3 ou 4 decisões que valem mostrar, com o porquê.
3. Contratos: OpenAPI/Swagger, arquivos `.http`, schemas JSON, fixtures. Eles viram as requisições do console.
4. Roteiro de demo, se existir: dá a ordem das requisições.
5. Testes e CI: quantidade, tipos (unidade, integração, arquitetura, carga) e números medidos.

Responda antes de escrever: qual problema resolve, para quem, qual é o fluxo principal em 4 a 7 chamadas, qual número mais impressiona e o que é decisão técnica (não só tecnologia).

## 2. Criar o arquivo do projeto

1. Crie `data/personal/content/projects/<slug>.yaml`. O slug vira o link: `#projeto/<slug>/testar`. Use minúsculas e hífens.
   - Pode partir de um dos exemplos em `data/example/content/projects/`.
2. Preencha nesta ordem:

| Campo | O que colocar |
| --- | --- |
| `order` | Posição na grade (1 = primeiro). O primeiro projeto também é o alvo do link "Testar uma API agora" do topo. |
| `title`, `summary` | Nome e uma frase do que faz. |
| `stack` | 6 a 8 itens, os que o recrutador procura (ex.: `.NET 10`, `EF Core + PostgreSQL`, `Kafka`). |
| `repo` ou `privateRepo: true` | Link do GitHub, ou privado. |
| `card.problem` | Problema em uma frase, começando em minúscula (o cartão já mostra "Problema:"). |
| `card.metric` | O número mais forte e uma legenda curta. Só número real. |
| `card.thumbnail` | SVG do diagrama (passo 3). |
| `demo` | `baseUrl`, `mode: live` se a API está publicada, ou `recorded` se não está. |
| `overview.problem`, `overview.solution` | 2 a 4 frases cada. Inclua o status se o projeto estiver em andamento. |
| `overview.architecture.columns` | Camadas e componentes. `variant: primary` para a API, `dashed` para a Infrastructure. |
| `overview.metrics` | 3 ou 4 números reais. |
| `requests` | 4 a 7 requisições (passo 4). |
| `snippets` | 2 ou 3 trechos curtos. Público: o código que mostra a decisão principal. Privado: contratos e regras. |
| `screens` | Telas do sistema, se o projeto tiver front (passo 5). Sem telas, a aba Telas não aparece. |
| `media` | GIF ou vídeo da demo em `data/personal/public/projects/<slug>/`. Sem gravação, deixe de fora (o painel mostra "Demo em vídeo em breve"). |

## 3. Diagrama do cartão (thumbnail)

- Arquivo `data/personal/content/projects/thumbnails/<slug>.svg`, `viewBox="0 0 320 132"`.
- Só as classes do tema: `th-node`, `th-hero` (o componente principal), `th-flow`, `th-ok`, `th-optional`, `th-dashed`, `th-block`, `th-head`/`th-head-ok` (pontas de seta), textos `th-t`, `th-t2`, `th-t3`, `th-tok`. Nada de cores fixas: o diagrama acompanha o tema claro e escuro.
- Rótulos bilíngues: `{{texto|text}}` (duas chaves de cada lado).
- `id` dos `marker` prefixado com o slug (ex.: `th-<slug>-a`), porque todos os SVGs ficam na mesma página.
- Mostre o fluxo que o projeto resolve (quem chama quem e o resultado), não uma lista de tecnologias.
- `alt` em PT e EN descrevendo o fluxo.

## 4. Requisições do console

Cada requisição conta um passo da história: o fluxo principal, depois um caso que mostra robustez (idempotência, limite, erro 400 com ProblemDetails).

- `name` (lista), `shortName` (pílula no celular, uma palavra), `hint` (segunda linha: rota curta ou nome da operação).
- `method`, `path`, `headers`, `body` (JSON como texto, editável pelo visitante).
- `tip`: o que reparar na resposta, em uma ou duas frases.
- `sample`: `status`, `latencyMs`, `headers` notáveis e `body`. É o que aparece no modo `recorded` e quando a API ao vivo não responde.
- De onde vêm as respostas, em ordem de preferência:
  1. Respostas reais capturadas do ambiente de demo (rodando a demo do projeto, ou de fixtures do próprio projeto).
  2. Montadas a partir dos contratos e dados de seed do projeto, coerentes entre si (mesmos IDs, preços e nomes de uma chamada para a outra).
- Token encadeado: em `headers`, `{{token}}` recebe o `accessToken` de uma requisição anterior.
- Headers repetidos: use âncora YAML (`&tool-headers` / `*tool-headers`).
- YAML: textos com vírgula dentro de `[ ]` ou `{ }` precisam de aspas.

## 5. Telas (projetos com front)

Quando o projeto tem interface, mostre de 4 a 6 telas na aba **Telas**: uma galeria com anterior/próxima, miniaturas, setas do teclado e zoom.

- Capture as telas rodando o projeto localmente com os dados de exemplo dele (ex.: Playwright em 1440×900, tema claro). Rode a partir de uma cópia: a pasta do projeto continua intocada.
- Salve os PNGs em `data/personal/content/projects/screens/<slug>/`, numerados na ordem da história (`01-login.png`, `02-matriz.png`...). O build converte para WebP em vários tamanhos.
- No YAML, cada item tem `image` (caminho relativo ao YAML: `./screens/<slug>/02-matriz.png`), `title`, `caption` (opcional) e `alt`, todos `{ pt, en }` menos `image`.
- Comece pela tela que mostra o valor do sistema, não pelo login.
- Confira nomes de pessoas reais nos dados de exemplo: troque por nomes fictícios antes de capturar.

## 6. Ajustes no site

- Mais de um projeto: a grade passa sozinha de um cartão largo para colunas. Nada a mudar no CSS.
- Se o projeto novo passar a ser o primeiro (`order: 1`), o link do topo passa a abrir ele.

## 7. Testes

1. `npm run build` com os seus dados: o build falha com mensagem clara se faltar campo obrigatório.
2. `npm run dev` e confira nos dois temas e no celular (390 px): cartão, as abas do painel e o diagrama.
3. `npm test` e `npm run test:e2e`. Os testes e2e usam só `data/example/`, então só precisam mudar se o projeto exigir um recurso novo no site (um campo novo, um comportamento novo do painel). Nesse caso, adicione o recurso também a um projeto de exemplo e cubra com teste.

## 8. Publicar

1. `npm run deploy` (build com `data/personal/` e envio para o Cloudflare Pages).
2. Faça backup de `data/personal/`: ela não está no Git.

## Checklist final

- [ ] Pasta do projeto só lida, nada alterado lá
- [ ] Textos em PT e EN, sem placeholders
- [ ] Números conferidos na fonte
- [ ] Nenhum segredo, chave ou URL interna
- [ ] `repo` real ou `privateRepo: true`
- [ ] Diagrama só com classes `th-*` e markers com o slug
- [ ] Telas (se houver) sem nomes ou dados de pessoas reais, com `alt` em PT e EN
- [ ] Respostas do console coerentes entre si
- [ ] Build, testes unitários e e2e passando
- [ ] Nada pessoal fora de `data/personal/`
