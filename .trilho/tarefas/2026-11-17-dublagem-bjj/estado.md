# Estado — Dublagem de jiu-jitsu que parece feita por brasileiro

**Atualizado em:** 2026-11-17 (T8)
**Etapa:** execucao
**Último review:** 8bccc56 (fase 3, T8–T11, T13) — sem achados ≥ 80

## Onde paramos

Fases 1 e 2 fechadas. Fase 3 em curso: Todas as tarefas da fase 3 feitas (T8–T11, T13). Fim de fase em curso: falta a rodada real paga pelo link (critério da fase) e o code review.

## Tarefas

- T0 — feito (`back/src/youtube/`, `back/scripts/baixar-video.ts`)
- T1 — feito (dev escolheu `aai-cassio` = voz 1, pessoa que mais fala; `aai-benicio` = voz 2)
- T2 — feito (`back/src/separacao/`; dev ouviu e aprovou; 14,7 s para 4:45 de vídeo, VRAM máx 2,5 GB)
- T3 — feito (`back/src/traducao/guia-bjj.ts`, 97 termos + guia do tatame; dev aprovou o guia)
- T4 — feito (`back/src/transcricao/`; 10 testes; rodada real fica para a fase 3)
- T5 — feito (`back/src/traducao/traducao.service.ts`; 5 testes)
- T6 — feito (`juiz.service.ts`, `revisar-com-juiz.ts`, `TraducaoService.refazer`; 7 testes novos)
- T7 — feito (`back/src/relatorio/relatorio.ts`; 3 testes)
- T8 — feito (`back/src/voz/`; 5 testes)
- T9 — feito (`back/src/encaixe/planejar-encaixe.ts`; 8 testes)
- T10 — feito (`FfmpegService.montarVideo`; teste real com ffmpeg; I4 verificada)
- T11 — feito (`IngestionService.dublar`, `encaixe/encaixar-falas.ts`; openai/elevenlabs removidos; suíte 19/19 verde)
- T12 — pendente
- T13 — feito (campo `url` no endpoint, `IngestionService.dublarLink`, campo de link no front; 3 testes novos)
- Entrega — pendente (verificação, push + PR para `master`)

## Próximo passo

Fim da fase 3: code review feito; falta (2) rodada real paga do vídeo 1 pelo link (pedir o "pode"; estimativa US$0,50–1,50); (3) handoff.

## O que o usuário decidiu e não está na spec nem no plano

- decidido: não quer ElevenLabs de jeito nenhum; nada de OpenAI.
- decidido: a dessincronia é o problema número um.
- decidido: voz pronta, sem clone, depois de oscilar (vozes prontas → clone por outro provedor → vozes prontas). Motivo final: preferiu voz fixa; Nelson "soa velho". Não reabrir sem ele pedir.
- decidido: vozes `aai-cassio` (quem mais fala) e `aai-benicio`.
- decidido: Demucs local e "só local por enquanto" (sem deploy no escopo). Se um dia for pro ar: trocar `SeparacaoService` pelo Replicate (mesma interface `separar(audio)`) e contar com bloqueio do YouTube em IP de nuvem.
- decidido: teste real com 1 vídeo (https://www.youtube.com/watch?v=pQ43Oy5k9yQ, "BJJ Moves: Arm Bar From Guard by John Danaher", 4:45, já em `videos/BJJ-Moves-Arm-Bar-From-Guard-by-John-Danaher.mp4`); duas pessoas só por testes automáticos.
- decidido: fase 2 fechada sem ajuste no guia ("feche"). Pontos levantados para a T12, sem decisão dele: (1) "juji gatame" fica em japonês (como o Danaher fala) ou vira "armlock" — hoje o tradutor alterna; (2) "Okay," solto virou "Ó," — soa estranho, melhor cortar ou "Tá".
- O usuário escreve curto e informal; "pode seguir" vale como "pode" para a rodada paga que foi anunciada na mesma mensagem, não para as seguintes.

## Defeitos

- D1 (rodada real fase 3, 2026-11-17): a dublagem pelo link parou na fala 51 com HTTP 429 da AssemblyAI ("allowance 50 per minute"). Causa imediata: `VozService.sintetizar` (`voz/voz.service.ts`) pedia as 95 vozes em sequência sem ritmo. Desenho: uma chamada de TTS por fala bate no limite por conta/minuto, que nenhum serviço conhecia. Corrigido na causa: `respeitarLimite()` no `VozService` (janela de 61 s, 50 pedidos), compartilhado entre `gerarAudios` e o `sintetizar` do encaixe; teste com timers falsos.
- D2 (rodada real fase 3, 2ª tentativa, 2026-11-17): parou em "Tradutor devolveu a fala 13 encurtada vazia" (`traducao.service.ts`, `encurtar`). Fala 13 = "you go" → "vai", 0,27 s (33,78–34,05), com 0,85 s de silêncio depois. Causa imediata: a voz não diz nem "vai" em 0,27 s; o encaixe pede encurtar primeiro (ordem da R2) com alvo = 3 chars × 0,27 / duração ≈ 1 char, e o modelo devolve vazio. Desenho: (a) `cortarEmFalas` corta a frase no meio em pausa ≥ 0,4 s e gera falas-fragmento ("Okay," 0,32 s / "you go" 0,27 s / "to Jiu-Jitsu 101…"), menores que qualquer voz; (b) encurtar é sempre o 1º recurso, mesmo quando acelerar + silêncio bastariam — pede ao Claude o impossível e gasta 1 chamada por fala (11 chamadas até a fala 13). Dev escolheu "juntar os pedaços e só encurtar quando precisar" (spec R2 e plano atualizados): corte só separa em pausa ≥ 0,4 s ou fim de frase com trecho ≥ 1,5 s (pausa ≥ 1,5 s sempre corta); encaixe = acelerar → avançar → encurtar → cortar; alvo < 5 chars corta direto sem chamar o Claude.

## Prevenção antes da 3ª rodada (pedido do dev: "mapear possíveis bugs, não tô rico")

- Fade do corte com fala < 80 ms: `afade st` negativo derrubava o ffmpeg (reproduzido). Corrigido: fade ≤ duração; cortada de 0 s sai da mixagem.
- Erro passageiro da voz (`retryable` na resposta da API): tenta de novo após `retry_after_seconds`, até 3 vezes.
- Voz pronta põe ~0,1–0,25 s de silêncio antes e ~0,5 s depois (medido nos mp3 da sondagem): atrasava o início (R1) e inflava a duração medida (mais acelerar/encurtar à toa). Corrigido: `FfmpegService.apararSilencio` em toda voz gerada.
- Ensaio sem custo (`back/scripts/ensaio-sem-custo.ts`): Demucs e ffmpeg reais, palavras da transcrição salva `b9ead036-…` (GET grátis), tradução do relatório da fase 2, voz = tom com 13,2 chars/s + silêncio nas pontas. Resultado: 72 falas (eram 96), 35 ok / 35 aceleradas / 2 avançaram / 0 encurtar / 0 cortadas; todas as 72 começam a ≤ 0,002 s do original (bandpass + silencedetect); duração igual à do vídeo; 38 s.
- Riscos que o ensaio não cobre: duração real da voz (pode exigir mais aceleração/encurtar), tradutor/juiz devolvendo id faltando ou texto vazio (erro explícito, derruba a rodada).

## Aprendizados

- Suíte do back (T11): 19/19 verde, 58 testes. Lint: 4 problemas preexistentes (ver `projeto.md`); arquivos novos limpos. App sobe (`ts-node src/main.ts`) e mapeia `POST /ingestion/dublar`.
- AssemblyAI TTS: `POST https://tts.us.assemblyai.com/v1/speech` (`text` ≤ 5000, `voice_id`, `language: portuguese`, `encoding: mp3`, `stream: false`, chave crua em `Authorization`); `speed` só aceita 1, então velocidade fica no ffmpeg (`atempo`). Catálogo: `GET /v1/voices?scope=public&limit=100` paginado por `next_cursor` — 4073 vozes com `language` e `tags` (`accent:`, `age:`, `gender:`); 196 em português. Clone só pelo painel (por isso descartado).
- AssemblyAI transcrição: `keyterms_prompt` máx. 100 termos / 8000 chars (sync: 2048 chars); nossa lista tem 97 termos / 1070 chars. Modelo padrão aceita keyterms.
- Rodada real fase 2 (vídeo 1, 2026-11-17): AssemblyAI achou 96 falas de 1 pessoa (correto: o parceiro não fala). Claude: tradução 10.708 in / 9.235 out; juiz 13.121 / 3.519; 1 refazer + 1 reavaliação ~3k / ~100. Total ≈ US$0,38 Claude + ~US$0,02 AssemblyAI. Tempo: ~2 min. Juiz: 95 aprovadas de primeira, 1 na 2ª (fala 43), 0 reprovadas. Correção do inglês (R4) funcionou: "jiu-jitsu gatame"/"judo gatame" → "juji gatame", "arm bars" → "armbars", "keynote themes" → "key themes". Tradução sai bem enxuta (perto do alvo de chars).
- Sondagens pagas feitas: vozes rodada 1 (838 chars) e rodada 2 (3352 chars), total < US$0,07. Áudios em `relatorios/sondagem/`.
- Demucs: ~0,05× a duração do vídeo na RTX 4050 (inclui carregar o modelo).
- `pkill -f <padrão>` dentro do Bash mata o próprio shell (o padrão está na linha de comando dele): usar `timeout N <cmd> &` para processos auxiliares.
- Reserva, se a voz voltar à mesa: Fish Audio (US$15/1M bytes, clone por API ou inline), Inworld (PT-BR Tier 1, US$25/1M, clone por API), Cartesia (cara). Todos com velocidade nativa.

- I4 (2026-11-17): `amix` com 301 entradas (fundo + 300 falas, metade com atempo 1,1) num vídeo de 610 s: 25 s de montagem, todas as 300 falas no lugar, desvio máx. 0,0001 s. Sem lotes.
- T10: no teste, as posições saíram com ±0,01 s (mp3 incluído, o atraso do encoder não pesa).

- Rodada real fase 3, 1ª tentativa (2026-11-17, falhou no D1): YouTube 16 s, Demucs 14,6 s, AssemblyAI 95 falas/1 pessoa em 10 s, tradução 10.640/9.071 tokens, juiz 13.044/5.034, 1 refazer + 1 reavaliação (~6k/~0,5k). Gasto ≈ US$0,45 (Claude) + ~US$0,03 (AssemblyAI). 2ª tentativa (D2): tradução 10.709/8.957, juiz 13.131/5.110, 2 voltas de refazer+juiz (~13k/~2,3k), 11 encurtar (~30,6k/~2,4k); limite de vozes funcionou (esperas de 39 s e 19 s). Gasto ≈ US$0,60. Total fase 3 ≈ US$1,10. Falha no meio perde tudo o que já foi pago (pipeline em memória, sem retomada): ponto em aberto, sem decisão do dev.

## Hipóteses descartadas

- nenhuma

## Decisões da execução

- T0: `YoutubeService.baixar` devolve `{ video: Buffer, titulo }` (padrão em memória da pipeline), não caminho; formato H.264 (`vcodec^=avc1`) porque o vídeo final copia o codec e AV1 não abre em todo player.
- `executar()` e `pythonDasFerramentas()` em `back/src/shared/ferramentas-python.ts`, usados por YouTube e separação. Python em `FERRAMENTAS_PYTHON` ou `back/.venv-py/bin/python`.
- Venv `back/.venv-py` (6,7 GB: torch 2.11 cu128, demucs, soundfile, yt-dlp) criado com `uv` (o sistema não tem `python3.12-venv`).
- Scripts: `.mts` rodam com `node --env-file=../.env --experimental-strip-types` (sem decorators); os que importam serviços Nest rodam com ts-node — `scripts/traduzir-video.ts` (transcreve + traduz + juiz + relatório, pago) com `node --env-file=../.env -r ts-node/register scripts/traduzir-video.ts <video.mp4>` em `back/`. `chamarClaude` loga tokens de entrada/saída de cada chamada (medir orçamento). `scripts/` fora do `tsconfig.build.json`. `relatorios/` e `videos/` no `.gitignore`.
- T3: 97 termos, não ~150 (limite da AssemblyAI); só termos raros, sem palavras comuns do inglês. Teste trava o limite.
- T4: SDK `assemblyai` 4.43.3, `client.transcripts.transcribe({ audio, speaker_labels: true, language_code: 'en', keyterms_prompt })`. Palavra sem `speaker` é erro explícito. Corte em 12 s prefere a última vírgula. Tipo `Fala` em `back/src/shared/types.ts`.
- Módulos novos (`YoutubeModule`, `SeparacaoModule`, `TranscricaoModule`) ainda não importados no `AppModule`/`IngestionModule`: entram na T11/T13.
- `pnpm` global é 11.9 e o projeto usa 10.32.1: `npx -y pnpm@10.32.1 ...`.
- T5: `@anthropic-ai/sdk` 1.9.0 + `zod` 4.6.7. Chamada via `client.beta.messages.stream` (o beta é exigido por `fallbacks: 'default'`) com `output_config: { effort: 'high', format: betaZodOutputFormat(schema) }`, `max_tokens` 64000; `stop_reason` diferente de `end_turn` ou `parsed_output` nulo é erro explícito. Entrada ao modelo: JSON com `id`, `pessoa`, `duracaoSegundos`, `alvoCaracteres` (duração × 14), `textoEn`. Tipo `FalaTraduzida` em `shared/types.ts`. `TraducaoModule` ainda não importado (entra na T11).
- T6: chamada ao Claude extraída para `traducao/claude.ts` (`chamarClaude`), usada por tradutor e juiz. `refazer` manda só as reprovadas (com `textoPtReprovado` e `motivoDoJuiz`), sem o resto do vídeo. Juiz reavalia só as refeitas. "Melhor versão" da spec = última versão (o juiz é binário, não ranqueia). Tipo `FalaRevisada` (`juiz`, `tentativas`, `motivoJuiz`) em `shared/types.ts`; `JuizService` no `TraducaoModule`.
- T7: `montarRelatorio` (puro), `linhaDaFala` (linha do log no formato do exemplo da spec R10) e `gravarRelatorio(relatorio, pasta, data)` em `back/src/relatorio/relatorio.ts`. Tipo `EncaixeDaFala` criado em `shared/types.ts` antes da T9 (campos opcionais no relatório; a T9 produz). Fala sem encaixe conta em `semDados`; `maiorDesvioInicio` é `null` sem dados.

- T8: `atribuirVozes(falas, vozes)` em `voz/atribuir-vozes.ts` devolve `{ [pessoa]: { voz, repetida } }` (ordem por tempo total de fala). `VozService.gerarAudios(falas)` gera em sequência e devolve `{ id, voz, audio }`; `sintetizar(id, texto, voz)` é pública para o encaixe regerar a fala depois de encurtar. `VOZES_PT` em `voz/voz.service.ts`. `VozModule` ainda não importado (T11).

- T9: `planejarEncaixe({ inicio, fim, limite, duracaoAudio, encurtamentos })` devolve `EncaixeDaFala`. `acao: 'encurtar'` é o pedido ao orquestrador (encurtar → regerar → chamar de novo); o resultado final é sempre `ok | acelerar | avancar | cortar`, e o encurtamento aparece em `encurtamentos`. Depois do 1º encurtamento, só encurta de novo se nem 15% + silêncio bastam (até 3). Espaço = até `min(fim, limite)` (falas sobrepostas de duas pessoas). `atempo` arredondado para cima em 3 casas. Para a T11: o balde `encurtar` do resumo do relatório fica sempre 0 — contar encurtadas por `encurtamentos > 0` ao ligar o relatório.

- T10: `montarVideo(video, fundo, falas: FalaPosicionada[])` com `FalaPosicionada = { audio, encaixe: EncaixeDaFala }` (exportada de `ffmpeg.service.ts`). Duração final por `ffprobe` do vídeo + `-t` (sem `-shortest`). Cortada = `atrim` até `fimDublado − inicioDublado` + `afade` de 80 ms. Teste em `ffmpeg/montar-video.spec.ts` roda o ffmpeg real (~1 s). Lint do `ffmpeg.service.ts`: os 3 erros que restam são preexistentes (prettier reverteu só no meu trecho).

- T11: laço do encaixe em `encaixe/encaixar-falas.ts` (função com dependências injetadas, padrão do `revisarComJuiz`), não dentro do `IngestionService`. Alvo do encurtar = `chars × espaço / duração medida`. Encurtar é por fala (1 chamada Claude cada); se a rodada real mostrar muitas, agrupar é otimização futura. Transcrição usa o áudio original (mp3), não a voz separada (wav grande; a original já funcionou na fase 2). `FfmpegService.medirDuracao(buffer)` novo; `substituirAudio` removido (sem uso). `orchestratePipelineVideo` virou `dublar(video, nome)`; o nome vem do `originalname` sem extensão. Balde `encurtar` do resumo do relatório continua sempre 0 (as encurtadas aparecem por fala em "encurtada N×"); não mexi para não mudar a T7 sem motivo.
- `CLAUDE.md` reescrito para a pipeline nova (inglês, como estava); armadilha removida do `projeto.md`.

- T13: link tem preferência sobre arquivo quando os dois vêm; sem nenhum, 400. O relatório usa o título do YouTube como nome. Textos de progresso do front trocados (falavam em Whisper). Front: só typecheck e `vite build`; a verificação visual fica com o dev na rodada real.

## Resultado

Preencher na entrega.
