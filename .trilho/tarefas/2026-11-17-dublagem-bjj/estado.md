# Estado — Dublagem de jiu-jitsu que parece feita por brasileiro

**Atualizado em:** 2026-11-17
**Etapa:** execucao
**Último review:** nenhum

## Onde paramos

Planejamento fechado: spec, plano e `.trilho/projeto.md` (trilho-init) commitados na `feat/dublagem-bjj`. Nada de código ainda.

## Tarefas

- T1 — pendente (sondagem da voz clonada; precisa de chaves no `.env` e dos 2 vídeos do dev)
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

T1: pedir ao dev `ASSEMBLYAI_API_KEY` e `ANTHROPIC_API_KEY` no `.env` da raiz e o caminho local dos 2 vídeos de teste (3–5 min, um com 2 pessoas). Enquanto isso, consultar a API de TTS/clone da AssemblyAI (Context7/docs) e escrever `back/scripts/sondagem-voz.ts`. Rodar só com o "pode".

## O que o usuário decidiu e não está na spec nem no plano

- decidido: AssemblyAI para transcrição E voz ("vai o assembly ai mesmo"), depois de ver Soniox/Azure/xAI; não quer ElevenLabs de jeito nenhum.
- decidido: a dessincronia é o problema número um ("foca nisso tb").

## Defeitos

- nenhum

## Aprendizados

- Suíte do back antes da tarefa: 6/9 specs vermelhas por falta de `ConfigService` nos módulos de teste (preexistente). Lint: 8 erros preexistentes.
- `pnpm --filter dubla run test` falha sem TTY; usar `cd back && CI=true npx jest`.
- `master` local tem `chore: add trilho` não enviado; branch criada do `master` local (criar de `origin/master` apaga a skill da árvore).
- Pesquisa de preços (2026-11, fontes de terceiros): AssemblyAI TTS-1 US$15/1M chars, PT suportado, clone com 30 s, sem controle de velocidade/SSML no lançamento (por isso o atempo fica no ffmpeg).

## Hipóteses descartadas

- nenhuma

## Decisões da execução

- nenhuma

## Resultado

Preencher na entrega.
