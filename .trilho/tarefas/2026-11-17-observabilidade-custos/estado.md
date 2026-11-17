# Estado — Ver quanto custa cada dublagem e acompanhar o processamento de verdade

**Atualizado em:** 2026-11-17
**Etapa:** execucao
**Último review:** 0711d0d (fase 2) — sem achados ≥ 80

## Onde paramos

Fases 1 e 2 fechadas. A fase 1 entregou o custo medido por chamada e a troca de modelo: tradutor Sonnet 5.5 high e juiz Haiku 5.5 medium, US$ 0,11 de Claude por vídeo. A fase 2 entregou os jobs em fila na memória (`back/src/jobs/`), as rotas `POST /jobs`, `GET /jobs/:id`, `GET /jobs/:id/eventos` (SSE) e `GET /jobs/:id/video`, e a tela com progresso real. O dev viu o ensaio sem custo andar na tela e baixou o vídeo. Ainda não há banco: reiniciar o back apaga os jobs (o MP4 continua em `dublados/`).

## Tarefas

- T1–T10 — feito (suíte 106 verde, lint, typecheck e `pnpm build` verdes em 0711d0d)
- T11 — feito (docker compose v5.1.4 respondeu no WSL em 2026-11-17; `docker ps` ok)
- T12 — feito (migration `inicio` aplicada em localhost:5433; `\dt` mostra Job, Etapa, Chamada)
- T13 — em andamento
- T14 — pendente
- T15 — pendente
- T16 — pendente
- Entrega — pendente (verificação, push + PR para master)

## Próximo passo

T13: gravar job, etapas e chamadas no banco a partir de `trace.assinar`/`jobs.assinar`; na subida, `dublando`/`na fila` viram `interrompido`. Teste `jobs.repositorio.spec.ts` com Prisma simulado. O ouvinte que grava não pode lançar (ver aprendizados).

## O que o usuário decidiu e não está na spec nem no plano

- Acha a Claude cara ("2 dólares em 2 vídeos"); não quer usar OpenAI.
- Decidido: os preços da AssemblyAI ficam os da página oficial (T1). Ele não vai conferir nada no painel da AssemblyAI; não pedir confirmação nem conferência deles.
- Rodada paga só com o "pode" dele na sessão. As autorizações da T5 não valem mais.
- Ele esperava ver dados no Docker e as telas de trace já na fase 2. Foi explicado que isso é da fase 3 (T12/T13 e T15). Na fase 3, deixar claro quando cada coisa passa a aparecer.

## Defeitos

- nenhum

## Aprendizados

- O `Trace` (`back/src/trace/trace.ts`) emite os eventos `etapa`, `progresso` e `chamada`, e o SSE repassa o estado inteiro do job a cada um. A T13 persiste a partir dessas mesmas assinaturas: `trace.assinar` e `jobs.assinar`. O segundo avisa cada mudança de situação de qualquer job.
- O estado que a tela e o SSE usam é montado em `JobsController.estado` (`back/src/jobs/jobs.controller.ts`). O `GET /jobs/:id` da T14 tem que manter esse formato, porque o front (`EstadoJob` em `front/src/App.tsx`) depende dele.
- Ensaio sem custo pela tela: `cd back && node --env-file=../.env -r ts-node/register scripts/servidor-ensaio.ts b9ead036-b0c7-4bb4-92a3-0d8795ee0381 ../relatorios/2026-11-17-bjj-moves-arm-bar-from-guard-by-john-danaher.json` + `pnpm dev:front`. Na tela, mandar `videos/BJJ-Moves-Arm-Bar-From-Guard-by-John-Danaher.mp4`; link não serve. A voz simulada é um tom de 300 Hz (o "chiado"), e o custo fica em 0.
- Script de comparação: `cd back && node --env-file=../.env -r ts-node/register scripts/comparar-modelos.ts <relatorio.json> [--simulado]`. Os `.md` de `relatorios/` não vão para o git.
- O `pgrep -f <padrão>` também casa com o shell do Bash quando o texto do comando contém o nome do processo (ex.: um heredoc que cita `servidor-ensaio`). Matar o processo num comando separado.
- T5: o Opus, com os mesmos tokens, custaria ~US$ 0,34 por vídeo; a fatura do usuário dizia ~US$ 1. O Sonnet medium estourava o alvo de caracteres em 16 falas, e em effort high só 4: por isso o tradutor ficou em high (`relatorios/comparacao-2026-11-17-20-43.md`).
- Ponto em aberto abaixo de 80 no review: se um ouvinte do `JobsService.avisar()` lançar erro, o `rodando` fica `true` e a fila para. Hoje nenhum lança; na T13, o ouvinte que grava no banco não pode lançar (tratar o erro dentro dele).

- T12: Prisma 7.10.1 (o `latest` do npm é RC da 8). Config em `back/prisma.config.ts` (lê `../.env` com `process.loadEnvFile`), fora do `nest build` (senão o dist vira `dist/src/main.js`). Cliente gerado em `back/src/generated/prisma` (fora do git e do lint), CJS, gerado no `postinstall`. `pnpm-workspace.yaml` libera os scripts de instalação do Prisma (`onlyBuiltDependencies`). Postgres: `docker compose up -d` na raiz, usuário/senha/banco `dubla`, `DATABASE_URL=postgresql://dubla:dubla@localhost:5433/dubla` no `.env`. Etapa e Chamada têm chave (jobId, ordem).

## Hipóteses descartadas

- nenhuma

## Decisões da execução

- T1: preço da AssemblyAI (assemblyai.com/pricing, 2026-11-17): transcrição $0,28/h e voz $15 por milhão de caracteres. Assume o STT-3.7 padrão; conferir `speech_model` na resposta da rodada real (T16).
- T2/T3: modelo, esforço e fallback por papel ficam em `POR_PAPEL` (`back/src/traducao/claude.ts`). O custo usa `resposta.model`. Um modelo sem preço gera erro explícito.
- T6: jobs num `Map` e a fila num array. `posicao` é quantos vídeos estão antes (0 = dublando agora ou o próximo). A pasta `dublados/` vem injetada por `PASTA_DUBLADOS`.
- T7: dublagem por link ganha uma etapa extra antes das 7, "Baixando o vídeo", que não conta no "n de 7".
- T8: a rota síncrona `POST /ingestion/dublar` e o `IngestionController` foram removidos. Job de link usa a URL como nome, então o arquivo baixado sai com nome feio. Ponto em aberto: guardar o título do YouTube no job (dá para fazer na T13, quando o job ganha nome no banco).
- T9: o card mantém o visual Crisp Glass. A barra é real nas vozes e no encaixe e animada nas outras etapas. Se o SSE fechar sem o job (back reiniciado), a tela mostra erro.
- T10: os simulados ficam em `back/scripts/servicos-simulados.ts`, usados por `ensaio-sem-custo.ts` e `servidor-ensaio.ts` (`Test.createTestingModule().overrideProvider`). Na voz, só o `sintetizar` é simulado.

## Resultado

Preencher na entrega.
