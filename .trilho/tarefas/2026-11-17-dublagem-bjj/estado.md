# Estado — Dublagem de jiu-jitsu que parece feita por brasileiro

**Atualizado em:** 2026-11-17
**Etapa:** execucao
**Último review:** nenhum

## Onde paramos

Planejamento fechado: spec, plano e `.trilho/projeto.md` (trilho-init) commitados na `feat/dublagem-bjj`. Nada de código ainda.

## Tarefas

- T1 — em andamento (script das vozes prontas; precisa de `ASSEMBLYAI_API_KEY` no `.env`)
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
- Entrega — pendente (verificação, push + PR para `master`)

## Próximo passo

T1: escrever `back/scripts/sondagem-voz.ts` (Nelson × Benício, 5 falas cada); pedir `ASSEMBLYAI_API_KEY` e `ANTHROPIC_API_KEY` no `.env`; rodar só com o "pode"; dev ouve e julga. Vídeos de teste (3–5 min, um com 2 pessoas) pedidos para T2.

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

## Hipóteses descartadas

- nenhuma

## Decisões da execução

- nenhuma

## Resultado

Preencher na entrega.
