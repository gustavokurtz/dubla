# Plano — Ver quanto custa cada dublagem e acompanhar o processamento de verdade

**Tarefa:** 2026-11-17-observabilidade-custos
**Branch:** `feat/observabilidade-custos` (sai de `master` local, em a5cabb8)
**Spec:** `spec.md`
**Entrega:** push + PR para `master`

## Contexto no código

- `back/src/traducao/claude.ts` — `chamarClaude` é o único ponto de chamada à Claude (tradutor, refazer, encurtar e juiz). Hoje: `MODELO = 'claude-opus-5-5'` fixo, `effort: 'high'`, `fallbacks: 'default'` com beta `server-side-fallback-2026-07-01`; só loga `usage`.
- `back/src/traducao/traducao.service.ts` (`traduzir`, `refazer`, `encurtar`) e `juiz.service.ts` (`avaliar`) — os quatro papéis.
- `back/src/transcricao/transcricao.service.ts` — `transcripts.transcribe`; a resposta tem `audio_duration` (segundos) para o custo.
- `back/src/voz/voz.service.ts` — TTS por `fetch`; `sintetizar` é chamado por `gerarAudios` e pelo encaixe (depois de encurtar). Custo por caracteres de `texto`.
- `back/src/ingestion/ingestion.service.ts` — `dublar` roda as 7 etapas em sequência, com logs `1/7…7/7`; `dublarLink` baixa do YouTube antes.
- `back/src/ingestion/ingestion.controller.ts` — `POST /ingestion/dublar` síncrono e devolve o MP4.
- `back/src/encaixe/encaixar-falas.ts` — laço fala por fala (onde entra a contagem do progresso do encaixe).
- `front/src/App.tsx` — um componente, progresso falso (`STEPS` + `setInterval` de 4 s), `fetch` → blob.
- `back/scripts/traduzir-video.ts` — padrão de script que instancia os services com `new ConfigService()`.
- `relatorios/2026-11-17-bjj-moves-arm-bar-from-guard-by-john-danaher.json` — referência do Opus: 72 falas com `id, pessoa, inicio, fim, textoEn, textoEnCorrigido, textoPt, juiz, tentativas`.
- Padrão de módulo: um módulo Nest por integração (`back/src/<servico>/`); funções puras em pastas próprias (`src/encaixe/`, `src/relatorio/`) com `*.spec.ts` ao lado.

## Decisões

| Questão | Decisão | Porquê |
|---|---|---|
| Modelos | tradutor/refazer/encurtar `claude-sonnet-5-5` effort `high` (era `medium`; mudou pelo plano B 1 da T5); juiz `claude-haiku-5-5` effort `medium` (usuário) | custo (spec O1) |
| Validação | eu comparo com o relatório do Opus do arm bar, reaproveitando o `textoEn` salvo (usuário) | sem custo de AssemblyAI; mesma entrada que o Opus teve |
| MP4 guardado | em disco, `dublados/<jobId>.mp4` na raiz, no `.gitignore` (usuário + pasta decidida por mim) | baixar pelo histórico (R6) |
| Simultâneo | fila, um vídeo de cada vez (usuário) | limite de 50 vozes/min da conta |
| Entrega | push + PR para master (usuário) | — |
| Fallback | Sonnet 5.5 mantém `fallbacks: 'default'`; Haiku 5.5 **sem** `betas`/`fallbacks` (não tem fallback server-side) (decidido por mim) | conferir na skill `claude-api` antes de codar |
| Como o trace chega às chamadas | `AsyncLocalStorage` (Node) com o trace do job corrente; `chamarClaude`, `TranscricaoService`, `VozService` registram nele se houver (decidido por mim) | evita mudar a assinatura de todos os services e dos scripts; fora de um job (scripts) só não registra |
| Preços | tabela num arquivo só (`back/src/custos/precos.ts`), US$ por milhão de tokens por modelo e US$ por hora de áudio / por mil caracteres da AssemblyAI (decidido por mim) | R1; preço da AssemblyAI vem da página oficial na T1 e você confirma |
| Progresso ao vivo | SSE (`@Sse` do Nest) em `GET /jobs/:id/eventos` (decidido por mim) | unidirecional, sem lib nova; `EventSource` no front |
| Fila | em memória no processo, com estado persistido no banco (decidido por mim) | um único usuário local; sem Redis/BullMQ |
| ORM | Prisma (decidido por mim) | migrations versionadas; consultar context7 antes (Prisma mudou config nas versões recentes) |
| Banco | `docker-compose.yml` na raiz, Postgres na porta 5433 do localhost; `DATABASE_URL` no `.env` raiz (decidido por mim) | 5433 evita conflito com Postgres local; migrations só rodam contra localhost |
| Ordem das fases | modelos e medição primeiro, sem banco (decidido por mim) | maior incerteza (qualidade do Sonnet/Haiku) primeiro, e mede o ganho antes de construir em volta |
| Descartado | Langfuse/OTel self-hosted | você quer o trace dentro do front do dubla; seria mais um serviço para subir e o trace dele não mostra custo da AssemblyAI |

## Incertezas

- **I1** — Sonnet 5.5 (medium) + Haiku 5.5 traduzem e julgam tão bem quanto o Opus? Sondagem: T4/T5, só Claude, 72 falas do arm bar.
- **I2** — Preço atual da AssemblyAI (transcrição com speaker labels + keyterms; TTS). Sondagem: T1, ler a página de preços e você confirma.

## Tarefas

### Fase 1 — Medir custo e trocar os modelos (sem banco)

- **T1** — Tabela de preços e cálculo de custo
  - Atende: R1
  - Como: `back/src/custos/precos.ts` (preços) + `custo.ts` com funções puras `custoClaude(modelo, usage)` (entrada, saída, cache write/read) e `custoTranscricao(segundos)`, `custoVoz(caracteres)`. Preços Claude da skill `claude-api` (Sonnet 5.5 $2/$10, Haiku 5.5 $0,10/$0,50 até 100k de entrada, Opus 5.5 $4/$20). AssemblyAI: buscar a página de preços (agente `web-fetch`) e registrar a fonte e a data num comentário; modelo desconhecido é erro explícito.
  - Teste: `custo.spec.ts` com usages fixos e totais esperados.
- **T2** — Trace do job e registro das chamadas
  - Atende: R1, R7
  - Como: `back/src/trace/` com um `AsyncLocalStorage<Trace>`; `Trace` guarda etapas (nome, início, fim, feito/total, erro) e chamadas (serviço, papel, modelo, tokens/segundos/caracteres, custo, duração) e emite eventos para quem assina. `chamarClaude` recebe o papel e registra; `TranscricaoService` registra `audio_duration`; `VozService.sintetizar` soma caracteres na etapa.
  - Teste: `trace.spec.ts` (etapas, soma de custos, eventos) + specs de `claude`/`transcricao`/`voz` com cliente simulado conferindo o registro.
- **T3** — Modelo e esforço por papel
  - Atende: R2
  - Como: `chamarClaude` recebe `{ modelo, esforco, papel }`; tradutor/refazer/encurtar → Sonnet medium com fallback; juiz → Haiku medium sem `betas`/`fallbacks`. Ler antes `shared/model-migration.md` → Migrating to Claude Haiku 5.5 e Sonnet 5.5 da skill `claude-api` (refusal sem fallback no Haiku; structured outputs no Haiku 5.5).
  - Teste: specs de `traducao` e `juiz` conferem o `model`/`output_config` enviado.
- **T4** — Script de comparação com o Opus
  - Atende: R3
  - Como: `back/scripts/comparar-modelos.ts <relatorio-opus.json>`: monta as `Fala[]` a partir do relatório (sem AssemblyAI), roda `traduzir` + `revisarComJuiz` dentro de um `Trace`, grava em `relatorios/comparacao-<data>.md` cada fala com EN, PT Opus, PT novo, veredito, tamanho × alvo, e no fim o custo por chamada e o total.
  - Verificar por: rodar com `TraducaoService`/`JuizService` simulados (flag `--simulado`, sem custo) e conferir o arquivo (sem teste porque é script manual, como os outros de `back/scripts/`).
- **T5** — Rodada real e comparação
  - Atende: R3, R1
  - Como: pedir o "pode" (custo esperado < US$ 0,20); rodar a T4 no relatório do arm bar; comparar fala a fala pelos 4 critérios do juiz (termo, naturalidade, sentido, tempo) e escrever o resumo no `estado.md` + mostrar ao usuário as falas piores e o custo medido × o do Opus.
  - Meta: 0 falas com erro de termo ou de sentido; ≤ 5 de 72 piores que o Opus. Orçamento: 2 rodadas. Se esgotar: plano B 1 = tradutor em effort `high`; plano B 2 = juiz em Sonnet; se ainda não, parar e trazer ao usuário.

**Fim da fase 1:** suíte, lint e typecheck verdes; comparação aprovada pela meta; custo medido por chamada aparece no log.

### Fase 2 — Processamento em segundo plano com progresso real (ainda sem banco)

- **T6** — Fila de jobs em memória
  - Atende: R4, R9
  - Como: `back/src/jobs/` (`JobsService`): `criar(entrada)` devolve id e enfileira; um worker roda um de cada vez `IngestionService.dublar/dublarLink` dentro do `Trace` do job; erro marca `falhou` com etapa e mensagem e segue a fila; MP4 gravado em `dublados/<id>.mp4` (raiz, `.gitignore`).
  - Teste: `jobs.service.spec.ts` com dublagem simulada: dois jobs em sequência, posição na fila, falha não trava o próximo.
- **T7** — Etapas e contagem no pipeline
  - Atende: R5
  - Como: `IngestionService.dublar` abre cada uma das 7 etapas no trace (troca os logs `n/7`); `gerarAudios` e `encaixarFalas` avançam `feito/total` por fala.
  - Teste: `ingestion.service.spec.ts` confere a sequência de etapas e as contagens no trace.
- **T8** — Endpoints dos jobs
  - Atende: R4, R5, R6
  - Como: `POST /jobs` (mesmo multipart/url e validações do `/ingestion/dublar`) → `{ id }`; `GET /jobs/:id` (estado + trace); `GET /jobs/:id/eventos` (SSE: etapa, feito/total, gasto, posição na fila, fim); `GET /jobs/:id/video` (stream do arquivo). Remover `POST /ingestion/dublar` e o `IngestionController` (o front é o único cliente).
  - Teste: specs do controller (validações, 404 de job inexistente, vídeo ainda não pronto → 409).
- **T9** — Front com progresso real
  - Atende: R4, R5, R6
  - Como: carregar a skill `frontend-design` antes; `App.tsx` passa a `POST /api/jobs`, abrir `EventSource('/api/jobs/:id/eventos')` e mostrar etapa n de 7, barra da etapa, contagem de falas, tempo decorrido, gasto até agora e "na fila (n antes)"; no fim, baixar por `/api/jobs/:id/video`. Remover `STEPS`/`setInterval`.
  - Verificar por: `pnpm build` + rodada da T10 (front não tem testes).
- **T10** — Ensaio sem custo pela tela
  - Atende: R5, R6
  - Como: adaptar `back/scripts/ensaio-sem-custo.ts` (ou um modo do back com services simulados) para rodar pelo job, e ver a tela andar.
  - Quem roda: dev (prova visual), com eu preparando o comando.
  - Verificar por: a barra e os números andam junto com o log do servidor e o download funciona.

**Fim da fase 2:** suíte, lint, typecheck e `pnpm build` verdes; ensaio sem custo visto na tela.

### Fase 3 — Postgres e histórico

- **T11** — Docker no WSL
  - Atende: R8
  - Como: ativar a integração do Docker Desktop com esta distro (Settings → Resources → WSL integration) e confirmar `docker compose version`.
  - Quem roda: dev (ambiente dele; hoje `docker` não existe no WSL).
- **T12** — Postgres e esquema
  - Atende: R8
  - Como: `docker-compose.yml` (postgres:17, porta 5433, volume nomeado); Prisma em `back/` com `Job` (id, nome, origem, situação, posição, criado/iniciado/terminado, erro, etapa do erro, caminho do MP4, custo total), `Etapa` (job, ordem, nome, início, fim, feito, total, custo) e `Chamada` (job, etapa, serviço, papel, modelo, entrada, saída, segundos, caracteres, custo, duração). Conferir que `DATABASE_URL` aponta para `localhost:5433` antes de rodar a migration (regra global).
  - Verificar por: `prisma migrate dev` no localhost e `psql`/`prisma studio` mostrando as tabelas (sem teste porque é infraestrutura).
- **T13** — Gravar o trace no banco
  - Atende: R8, R9, R10
  - Como: `JobsService` persiste job, etapas e chamadas conforme o trace emite; na inicialização, jobs `dublando` ou `na fila` viram `interrompido` (com o gasto já gravado).
  - Teste: `jobs.repositorio.spec.ts` com Prisma simulado: sequência de gravações de uma dublagem simulada, falha, e a marcação de interrompidos na inicialização.
- **T14** — Endpoints do histórico
  - Atende: R7, R8, R6
  - Como: `GET /jobs` (lista, mais recente primeiro, com custo total e duração); `GET /jobs/:id` passa a ler do banco (trace completo); `GET /jobs/:id/video` lê o caminho gravado (404 se o arquivo sumiu).
  - Teste: specs do controller/serviço com repositório simulado.
- **T15** — Telas de histórico e trace
  - Atende: R7, R8, R6
  - Como: skill `frontend-design`; lista do histórico (data, nome, situação, duração, custo, baixar) e detalhe do trace (7 etapas com tempo e custo; chamadas Claude com papel, modelo, tokens, custo; vozes somadas; totais Claude/AssemblyAI/geral; etapa e mensagem de falha). Sem roteador novo se um estado de tela bastar.
  - Verificar por: `pnpm build` + T16.
- **T16** — Rodada real de ponta a ponta
  - Atende: R1, R2, R5, R6, R7, R8, R10
  - Como: com o "pode", dublar o arm bar pela tela; conferir o total do trace com o painel da Anthropic; reiniciar o back e ver o histórico; baixar pelo histórico.
  - Quem roda: dev (custo pago e prova visual).

**Fim da fase 3:** suíte, lint, typecheck e build verdes; T16 feita.

## Pronto quando

Cada requisito da spec verificado pelo "Como a gente confere" dele.

Validação manual (o usuário roda no final):

1. `docker compose up -d` e `pnpm dev` → back e front sobem sem erro (R8)
2. Mandar o arm bar pela tela → etapa, falas, tempo e gasto andam junto com o log (R5)
3. Mandar o triangle enquanto o arm bar roda → aparece "na fila" e começa depois (R4)
4. Fechar a aba no meio, voltar, abrir o histórico e baixar o arm bar pronto (R6, R8)
5. Abrir o trace → 7 etapas com tempo e custo, tradução em Sonnet, juiz em Haiku, totais Claude/AssemblyAI (R1, R2, R7)
6. Conferir o total da Claude com o painel da Anthropic (R1)
7. Salvar um arquivo do back durante as vozes → histórico mostra "interrompido" com o gasto (R10)
