# Estado — Ver quanto custa cada dublagem e acompanhar o processamento de verdade

**Atualizado em:** 2026-11-17 (handoff no meio da fase 3)
**Etapa:** execucao
**Último review:** 0711d0d (fase 2) — sem achados ≥ 80

## Onde paramos

Fases 1 e 2 fechadas (custo por chamada, Sonnet/Haiku, jobs em fila com progresso real na tela). Na fase 3, o back já está pronto: Postgres local no Docker (`docker compose up -d` na raiz, porta 5433), cada dublagem gravada no banco enquanto anda (job, etapas, chamadas pagas), o que estava rodando quando o back caiu vira `interrompido`, e as rotas `GET /jobs` (histórico), `GET /jobs/:id` e `GET /jobs/:id/video` leem do banco depois de reiniciar. Provado com o servidor de ensaio (custo 0). Falta a parte que o usuário vê: as telas de histórico e trace (T15), e a rodada paga (T16), que é quando aparece o primeiro trace com custo de verdade.

## Tarefas

- T1–T10 — feito (suíte 106 verde, lint, typecheck e `pnpm build` verdes em 0711d0d)
- T11 — feito (docker compose v5.1.4 respondeu no WSL em 2026-11-17; `docker ps` ok)
- T12 — feito (migration `inicio` aplicada em localhost:5433; `\dt` mostra Job, Etapa, Chamada)
- T13 — feito (suíte 112 verde; ensaio contra o Postgres local: dublagem pronta com 7 etapas e 72/72 falas gravadas; back derrubado no meio → `interrompido` com as 2 etapas feitas)
- T14 — feito (suíte 120 verde; ensaio reiniciado: `GET /jobs` lista os 2 do banco com duração e custo, `GET /jobs/<interrompido>` traz as etapas, vídeo do pronto 200 com 14,6 MB, id inexistente 404)
- T15 — pendente
- T16 — pendente
- Entrega — pendente (verificação, push + PR para master)

## Próximo passo

T15: telas de histórico e trace no front (skill `frontend-design`, manter o Crisp Glass). Lista: `GET /jobs`; detalhe: `GET /jobs/:id` (mesmo formato do SSE); baixar: `GET /jobs/:id/video`. Situação nova `interrompido`: a etapa aberta (sem `fim`) é onde parou. Para ter dados com custo na tela antes da T16, só o ensaio (custo 0); o primeiro trace com custo real aparece na T16.

## O que o usuário decidiu e não está na spec nem no plano

- Acha a Claude cara ("2 dólares em 2 vídeos"); não quer usar OpenAI.
- Decidido: os preços da AssemblyAI ficam os da página oficial (T1). Ele não vai conferir nada no painel da AssemblyAI; não pedir confirmação nem conferência deles.
- Rodada paga só com o "pode" dele na sessão. As autorizações da T5 não valem mais.
- Ele esperava ver dados no Docker e as telas de trace já na fase 2. Foi explicado que isso é da fase 3 (T12/T13 e T15). Na fase 3, deixar claro quando cada coisa passa a aparecer.

## Defeitos

- nenhum

## Aprendizados

- O servidor de ensaio sobe o `AppModule` inteiro, então agora também grava no histórico (com custo 0 e sem chamadas, porque os simulados não registram). Precisa do Postgres de pé (`docker compose up -d`).

- O `Trace` (`back/src/trace/trace.ts`) emite os eventos `etapa`, `progresso` e `chamada`, e o SSE repassa o estado inteiro do job a cada um. A T13 persiste a partir dessas mesmas assinaturas: `trace.assinar` e `jobs.assinar`. O segundo avisa cada mudança de situação de qualquer job.
- O estado que a tela e o SSE usam é montado em `JobsController.estado` (`back/src/jobs/jobs.controller.ts`). O `GET /jobs/:id` da T14 tem que manter esse formato, porque o front (`EstadoJob` em `front/src/App.tsx`) depende dele.
- Ensaio sem custo pela tela: `cd back && node --env-file=../.env -r ts-node/register scripts/servidor-ensaio.ts b9ead036-b0c7-4bb4-92a3-0d8795ee0381 ../relatorios/2026-11-17-bjj-moves-arm-bar-from-guard-by-john-danaher.json` + `pnpm dev:front`. Na tela, mandar `videos/BJJ-Moves-Arm-Bar-From-Guard-by-John-Danaher.mp4`; link não serve. A voz simulada é um tom de 300 Hz (o "chiado"), e o custo fica em 0.
- Script de comparação: `cd back && node --env-file=../.env -r ts-node/register scripts/comparar-modelos.ts <relatorio.json> [--simulado]`. Os `.md` de `relatorios/` não vão para o git.
- O `pgrep -f <padrão>` também casa com o shell do Bash quando o texto do comando contém o nome do processo (ex.: um heredoc que cita `servidor-ensaio`). Matar o processo num comando separado.
- T5: o Opus, com os mesmos tokens, custaria ~US$ 0,34 por vídeo; a fatura do usuário dizia ~US$ 1. O Sonnet medium estourava o alvo de caracteres em 16 falas, e em effort high só 4: por isso o tradutor ficou em high (`relatorios/comparacao-2026-11-17-20-43.md`).
- Ponto em aberto abaixo de 80 no review: se um ouvinte do `JobsService.avisar()` lançar erro, o `rodando` fica `true` e a fila para. Hoje nenhum lança; na T13, o ouvinte que grava no banco não pode lançar (tratar o erro dentro dele).

- T12: Prisma 7.10.1 (o `latest` do npm é RC da 8). Config em `back/prisma.config.ts` (lê `../.env` com `process.loadEnvFile`), fora do `nest build` (senão o dist vira `dist/src/main.js`). Cliente gerado em `back/src/generated/prisma` (fora do git e do lint), CJS, gerado no `postinstall`. `pnpm-workspace.yaml` libera os scripts de instalação do Prisma (`onlyBuiltDependencies`). Postgres: `docker compose up -d` na raiz, usuário/senha/banco `dubla`, `DATABASE_URL=postgresql://dubla:dubla@localhost:5433/dubla` no `.env`. Etapa e Chamada têm chave (jobId, ordem).

- T13: `JobsRepositorio` (`back/src/jobs/jobs.repositorio.ts`) grava o retrato inteiro do job (upsert do job + apaga e recria etapas e chamadas, numa transação) a cada aviso. Os avisos passam por uma cadeia de promessas única: enquanto um job já espera na cadeia, os avisos seguintes dele se juntam (ele lê o job na hora de gravar). Erro de gravação vira log e não lança, o que fecha o ponto em aberto do `avisar()`. `onModuleInit` marca `na fila`/`dublando` como `interrompido`. `PrismaService` em `back/src/banco/`. O `Job` em memória ganhou `origem` (`arquivo`/`link`).
- T13: o gerador do Prisma usa `importFileExtension = ""`: com `.js` nos imports, o Jest e o ts-node dos scripts não achavam os arquivos do cliente gerado.

- T14: o detalhe e o download procuram primeiro na memória (dublagem viva, com posição na fila) e depois no banco (`JobsRepositorio.carregar` remonta um `Job` com o `Trace`, então o formato é o mesmo do SSE). O SSE continua só para jobs da memória. `GET /jobs` devolve `duracaoMs` pronto. Vídeo com arquivo apagado: 404. No `interrompido` não há `etapaDoErro`; a etapa sem `fim` é onde parou.

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
