# Estado — Dublagem de jiu-jitsu que parece feita por brasileiro

**Atualizado em:** 2026-11-17
**Etapa:** execucao
**Último review:** nenhum

## Onde paramos

T0 feito (download do YouTube). Voz voltou para vozes prontas da AssemblyAI (sem clone); rodada 2 da sondagem gerada com 8 vozes de timbre médio, esperando o dev escolher 2.

## Tarefas

- T0 — feito (4 testes verdes; download real de um vídeo público de 19 s em ~3 s, H.264 + AAC em `videos/`)
- T1 — esperando o dev: ouvir `relatorios/sondagem/aai-{robson,joaquim,cassio,luiz,antonio,nilson,caio,iago}-*.mp3` (rodada 2 de 3) e escolher 2 vozes
- T2 — pendente
- T3 — pendente
- T4 — pendente
- T5 — pendente
- T6 — pendente
- T7 — pendente
- T8 — pendente
- T9 — pendente
- T10 — pendente
- T11 — pendente
- T12 — pendente
- T13 — pendente (novo: link do YouTube na tela)
- Entrega — pendente (verificação, push + PR para `master`)

## Próximo passo

Ler o resultado da T1 (2 vozes escolhidas pelo dev). Em paralelo, T2 (Demucs no `back/.venv-py`) precisa de 1 link do YouTube (3–5 min, uma pessoa) baixado com `cd back && npx ts-node scripts/baixar-video.ts <link>`.

## O que o usuário decidiu e não está na spec nem no plano

- decidido: AssemblyAI para transcrição E voz ("vai o assembly ai mesmo"), depois de ver Soniox/Azure/xAI; não quer ElevenLabs de jeito nenhum.
- decidido: a dessincronia é o problema número um ("foca nisso tb").
- decidido (2026-11-17): "Só vozes prontas" — sem clone, depois de saber que a AssemblyAI só clona pelo painel. Spec R7 e plano (I1, T1, T8) ajustados.

## Defeitos

- nenhum

## Aprendizados

- Suíte do back antes da tarefa: 6/9 specs vermelhas por falta de `ConfigService` nos módulos de teste (preexistente). Lint: 8 erros preexistentes.
- `pnpm --filter dubla run test` falha sem TTY; usar `cd back && CI=true npx jest`.
- `master` local tem `chore: add trilho` não enviado; branch criada do `master` local (criar de `origin/master` apaga a skill da árvore).
- 2026-11-17 (docs AssemblyAI TTS, /docs/tts/cloned-voices e /docs/tts/voices): **clone só se cria no painel** ("You create and manage clones in the voice catalog of the AssemblyAI dashboard"); a API só usa (`voice_id`) e apaga (`DELETE /v1/voices/{voice}`). Sem endpoint de listar vozes. Clone exige atestar consentimento + aceitar termos biométricos; vale 60 dias. Vozes prontas em PT: `aai-nelson` (homem mais velho, PT-BR, grave) e `aai-benicio` (jovem, PT). Síntese: `POST https://tts.us.assemblyai.com/v1/speech` (text ≤ 5000, `language: portuguese`, `encoding: mp3`, `stream: false`); `speed` só aceita 1. Isso quebra o "clone automático por pessoa a cada vídeo" do R7/T8.
- Pesquisa de preços (2026-11, fontes de terceiros): AssemblyAI TTS-1 US$15/1M chars, PT suportado, clone com 30 s, sem controle de velocidade/SSML no lançamento (por isso o atempo fica no ffmpeg).

- Sondagem T1 rodada 1 (2026-11-17, com o "pode"): 10 mp3 gerados, 838 caracteres (~US$0,013), 5,4–7,7 s por fala; Nelson ~5% mais lento que Benício nas mesmas falas.
- Usuário (2026-11-17), depois de escolher "só vozes prontas": "acho q clonar a voz vai ser melhor ... nao tem como mesmo o assembly ai fzr isso?". Decisão do R7 reaberta.
- decidido (2026-11-17): voz por clone via API de outro provedor ("Sondar clone de outro provedor"); download do YouTube no app e em script ("os dois"); teste real com 1 vídeo de uma pessoa, duas pessoas por testes automáticos. Spec R7, R9, R11 e R12 (nova) e plano (T0, T1, T2, T8, T12, T13) ajustados.

- Pesquisa T1 (docs oficiais, 2026-11-17), clone por API:
  - **Fish Audio**: criar `POST https://api.fish.audio/model` (multipart: `type=tts`, `title`, `train_mode=fast`, `voices`, `texts?`, `visibility=private`) → `_id`; apagar `DELETE /model/{id}`; ou clone inline sem salvar (`references` em msgpack no `/v1/tts`). TTS `POST https://api.fish.audio/v1/tts`, header `model: s2.1-pro`, `reference_id`, `format: mp3`, `prosody.speed` 0.5–2.0, `language: pt-BR`. PT no Tier 2. US$15/1M bytes UTF-8 (~US$16–17/1M chars PT), sem mensalidade. Auth Bearer.
  - **Inworld**: criar `POST https://api.inworld.ai/voices/v1/voices:clone` (JSON, `voiceSamples[{audioData base64, transcription?}]`, `languageCode`, `audioProcessingConfig.removeBackgroundNoise`; 10–30 s) → `voice.voiceId`; apagar `DELETE /voices/v1/voices/{voiceId}`. TTS `POST https://api.inworld.ai/tts/v1/voice` (`text` ≤ 2000, `modelId: inworld-tts-2`, `language: pt-BR`, `audioConfig.speakingRate` 0.5–1.5, resposta base64). PT-BR Tier 1. US$25/1M (On-Demand; Flash US$15/1M). Auth `Basic $INWORLD_API_KEY`. Limite 100 vozes custom.
  - **Cartesia** (reserva): `POST /voices/clone`, `sonic-3.6`, `speed` 0.6–1.5, clone EN mantém sotaque sem `PATCH /voices/{id}/accents brazilian-portuguese`; US$37–65/1M e IVC só em plano pago.
  - Os três têm controle de velocidade nativo (a AssemblyAI não tinha): pode substituir o `atempo` do ffmpeg em T9; decidir depois da escolha do provedor.

- Usuário (2026-11-17): "usa voz fixa msm mas a do nelson e mt paia ... tipo 2 vozes media nao uma nova ae um parecendo um velho ai pode seguir". Clone descartado de novo; spec R7/R9 e plano (I1, T1, T8) de volta às vozes prontas. Pesquisa de Fish/Inworld/Cartesia acima fica como reserva.
- Catálogo AssemblyAI: `GET https://tts.us.assemblyai.com/v1/voices?scope=public&limit=100` (paginar por `next_cursor`) lista 4073 vozes públicas com `language` e `tags` (`accent:`, `age:`, `gender:` etc.); 196 em português (190 sotaque brasileiro, 73 meia-idade). Sem `scope` lista só as da conta. Não documentado na página de vozes.
- Sondagem T1 rodada 2 (2026-11-17, "pode seguir" do usuário): 8 vozes × 5 falas, 3352 caracteres (~US$0,05).

## Hipóteses descartadas

- nenhuma

## Decisões da execução

- T0: `YoutubeService.baixar` devolve `{ video: Buffer, titulo }` (não caminho de arquivo, como dizia o plano), seguindo o padrão em memória da pipeline; o script grava em `videos/`. Formato preferido H.264 (`vcodec^=avc1`), porque o vídeo final copia o codec e AV1 não abre em todo player. `baixar-video.ts` roda com `ts-node` (o serviço tem decorators/parameter properties, que o strip-types do Node não aceita).
- Venv `back/.venv-py` criado com `uv` (`uv venv --python 3.12`; `uv pip install --python .venv-py/bin/python ...`): o sistema não tem `python3.12-venv`.
- Scripts em `back/scripts/*.mts`, rodados com TypeScript nativo do Node 22 (`--experimental-strip-types`) + `--env-file`, sem ts-node/dotenv; `scripts` excluído do `tsconfig.build.json` para o `nest build` não mudar o layout do `dist`. `relatorios/` no `.gitignore` da raiz.

## Resultado

Preencher na entrega.
