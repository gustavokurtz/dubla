# Estado — Dublagem de jiu-jitsu que parece feita por brasileiro

**Atualizado em:** 2026-11-17 (entrega)
**Etapa:** concluida
**Último review:** 326c26e (fase 3 + correções pós-fase, `8d52c38..HEAD`) — 1 achado (82), corrigido

## Onde paramos

Tarefa concluída: vídeo 1 aprovado pelo dev sem rodada de ajuste; README reescrito; merge na `master`.

## Tarefas

- T0–T11, T13 — feito
- T12 — feito (dev assistiu `videos/Arm-Bar-Danaher-dublado.mp4` e aprovou: "gostei sim parece ok, aprovo"; 0 rodadas de ajuste)
- Entrega — feito (verificação, README, push + PR, merge na `master` a pedido do dev)

## Próximo passo

Nenhum. Pontos em aberto abaixo ficam para uma tarefa futura, se o dev quiser.

## O que o usuário decidiu e não está na spec nem no plano

- decidido: não quer ElevenLabs nem OpenAI.
- decidido: a dessincronia é o problema número um.
- decidido: voz pronta, sem clone (depois de oscilar); `aai-cassio` (quem mais fala) e `aai-benicio`. Não reabrir sem ele pedir.
- decidido: Demucs local, "só local por enquanto". Se for pro ar: `SeparacaoService` → Replicate (mesma interface) e contar com bloqueio do YouTube em IP de nuvem.
- decidido: teste real só com o vídeo 1 (https://www.youtube.com/watch?v=pQ43Oy5k9yQ, Danaher, 4:45, em `videos/BJJ-Moves-Arm-Bar-From-Guard-by-John-Danaher.mp4`); duas pessoas só por testes.
- decidido (D2): "juntar os pedaços e só encurtar quando precisar" — spec R2 e plano já atualizados.
- decidido: antes de rodada paga, mapear e corrigir o que pode quebrar ("não tô rico"). Usar `back/scripts/ensaio-sem-custo.ts` antes de cada rodada real que mude a pipeline.
- Custo preocupa o dev ("1,50 é mt caro?"). Opções levadas, sem decisão: (1) cache de prompt no guia (`chamarClaude`), (2) encurtar em lote, (3) Sonnet no juiz/encurtar (muda qualidade, comparar antes). Com o D2, encurtar caiu para 1 chamada; o custo agora é ~US$0,35 por vídeo de 4:45 (tradução + juiz).
- O usuário escreve curto; "pode"/"s" vale para a rodada anunciada na mesma troca, não para as seguintes.

## Pontos em aberto (sem decisão do dev)

- Para a T12: "juji gatame" em japonês ou "armlock" (o tradutor alterna; 3ª rodada abriu com "Vamos ver armlock, juji gatame,"); "Okay," solto virando "Ó,".
- Falha no meio da pipeline perde tudo o que já foi pago (em memória, sem retomada).
- Tradutor/juiz devolvendo id faltando ou texto vazio derruba a rodada (erro explícito; não aconteceu em 4 rodadas).

## Defeitos

- D1 — dublagem parou na fala 51, HTTP 429 da AssemblyAI ("allowance 50 per minute") — causa: `VozService.sintetizar` pedia as vozes em sequência sem ritmo — mecanismo: limite de conta por minuto que nenhum serviço conhecia — feito: `respeitarLimite()` (50 pedidos / 61 s) + retry dos erros que a API marca `retryable` (`retry_after_seconds`, até 3).
- D2 — "Tradutor devolveu a fala 13 encurtada vazia" ("you go" → "vai", 0,27 s, com 0,85 s livres depois) — causa: alvo de encurtar ≈ 1 char — mecanismo: (a) `cortarEmFalas` gerava fragmentos < 1,5 s cortando em pausa curta; (b) encurtar era o 1º recurso — feito (dev escolheu): corte só separa em pausa ≥ 0,4 s / fim de frase com trecho ≥ 1,5 s (pausa ≥ 1,5 s sempre); encaixe = acelerar → avançar → encurtar (≤ 3) → cortar; alvo < 5 chars corta direto.
- Preventivos (achados antes da 3ª rodada): `afade` com `st` negativo em cortada < 80 ms derrubava o ffmpeg (fade ≤ duração; cortada de 0 s sai da mixagem); voz pronta traz ~0,1–0,25 s de silêncio antes e ~0,5 s depois, atrasando o início e inflando a duração (`FfmpegService.apararSilencio` em toda voz, no `IngestionService`).

## Aprendizados

- Review pós-fase 3: alvo do encurtar ainda usava o espaço da ordem antiga (`min(fim, limite) − inicio`); com a R2 nova o espaço útil é `(limite − inicio) × 1,15`. Corrigido em `encaixe/encaixar-falas.ts` com teste.
- Suíte: 19 suítes, 70 testes verdes; lint do back e do front limpo; typecheck limpo (depois de `a1c7de6`/`ae35477`).
- 3ª rodada real (2026-11-17): 224 s ponta a ponta; 72 falas; tradução 9.108/8.532 tokens, juiz 11.344/3.037, 1 refazer + reavaliação (~6k/~0,35k), 1 encurtar (2.787/305); esperas do limite de voz 36 s + 1 s. ≈ US$0,35. Total fase 3 (3 rodadas) ≈ US$1,45.
- Ensaio sem custo: `node --env-file=../.env -r ts-node/register scripts/ensaio-sem-custo.ts <video> <id-transcricao> <relatorio.json>` em `back/` (transcrição salva da AssemblyAI é GET grátis; ids recentes: `b9ead036-b0c7-4bb4-92a3-0d8795ee0381`). Simula voz com 13,2 chars/s da Cássio (medido na sondagem). Previu 0 encurtar; real deu 1.
- Rodar o back para rodada real: `(timeout 1500 npx ts-node src/main.ts > <scratch>/back.log 2>&1 &)` em `back/`, depois `curl -F 'url=<link>' --max-time 1400 http://localhost:3000/ingestion/dublar -o ../videos/<nome>.mp4`. Link sempre entre aspas (zsh expande `?`). Parar com `kill $(pgrep -f "ts-nod[e] src/main")` — `pkill -f` mata o próprio shell.
- AssemblyAI TTS: `POST https://tts.us.assemblyai.com/v1/speech` (`text` ≤ 5000, `voice_id`, `language: portuguese`, `encoding: mp3`, `stream: false`); `speed` só aceita 1 (velocidade no ffmpeg). Limite 50 pedidos/min por conta; erro JSON traz `retryable` e `retry_after_seconds`.
- AssemblyAI transcrição: `keyterms_prompt` máx. 100 termos / 8000 chars; nossa lista: 97 / 1070.
- Demucs: ~0,05× a duração do vídeo na RTX 4050. `amix` com 301 entradas funciona (I4).
- Reserva, se a voz voltar à mesa: Fish Audio, Inworld (clone por API, velocidade nativa).

## Hipóteses descartadas

- nenhuma

## Decisões da execução

- Arquitetura e APIs: ver `CLAUDE.md` (reescrito na T11) e o plano. `IngestionService.dublar(video, nome)` / `dublarLink(url)`; laço do encaixe em `encaixe/encaixar-falas.ts` (dependências injetadas, padrão do `revisarComJuiz`); alvo do encurtar = `chars × espaço / duração medida`.
- `@anthropic-ai/sdk` 1.9.0 via `client.beta.messages.stream` (`fallbacks: 'default'`), `effort: 'high'`, saída zod, `max_tokens` 64000; `chamarClaude` loga tokens.
- Transcrição usa o mp3 original, não a voz separada.
- `planejarEncaixe` devolve `acao: 'encurtar'` como pedido ao orquestrador; resultado final é `ok | acelerar | avancar | cortar`. Balde `encurtar` do resumo do relatório fica sempre 0 (encurtadas aparecem em "encurtada N×").
- Link tem preferência sobre arquivo no endpoint; sem nenhum, 400. Nome do relatório = título do YouTube.
- Venv `back/.venv-py` (torch cu128, demucs, yt-dlp) via `uv`; `pnpm` do projeto: `npx -y pnpm@10.32.1`.
- Scripts `.mts` com `--experimental-strip-types`; os que importam serviços Nest com `ts-node`. `relatorios/` e `videos/` no `.gitignore`.

## Resultado

- Pipeline nova por fala (Demucs → AssemblyAI → Claude tradutor + juiz → voz por pessoa → encaixe → mixagem) no `POST /ingestion/dublar`, por arquivo ou link do YouTube (tela também). OpenAI e ElevenLabs removidos.
- Testes: 19 suítes, 70 testes verdes; lint (back e front), typecheck e `pnpm build` verdes na entrega.
- Reviews: fase 1, 2 e 3 sem achados ≥ 80; review das correções pós-fase 3: 1 achado (alvo do encurtar), corrigido em `99d0e64`.
- Rodadas reais: fase 2 ≈ US$0,40; fase 3: 3 rodadas ≈ US$1,45 (2 falharam: D1, D2); fase 4: nenhuma (aprovado na rodada da fase 3).
- Fora do escopo / em aberto: "juji gatame" × "armlock" e "Ó," no guia; falha no meio perde o que foi pago; tradução numa chamada só limita ~35 min de vídeo; relatório não marca voz repetida (3+ pessoas, só no log); progresso da tela é cíclico; custo/resumo não aparecem na tela; opções de baratear (cache de prompt, encurtar em lote, Sonnet no juiz) sem decisão.
