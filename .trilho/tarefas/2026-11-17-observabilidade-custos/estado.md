# Estado — Ver quanto custa cada dublagem e acompanhar o processamento de verdade

**Atualizado em:** 2026-11-17
**Etapa:** execucao
**Último review:** nenhum

## Onde paramos

T1 feita: `back/src/custos/` (preços + funções puras de custo) com teste.

## Tarefas

- T1 — feito (`custo.spec.ts` verde, 8 testes)
- T2 — em andamento
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
- T13 — pendente
- T14 — pendente
- T15 — pendente
- T16 — pendente
- Entrega — pendente (verificação, push + PR para master)

## Próximo passo

T2: `back/src/trace/` com AsyncLocalStorage; `chamarClaude`, `TranscricaoService` e `VozService` registram no trace.

## O que o usuário decidiu e não está na spec nem no plano

- Acha a Claude cara ("2 dólares em 2 vídeos"); não quer usar OpenAI.

## Defeitos

- nenhum

## Aprendizados

- Nos 3 relatórios de 2026-11-17 o encurtar rodou 0 vezes e o juiz reprovou no máximo 1 fala por vídeo: o custo vem de 2 chamadas grandes por vídeo (tradução + juiz) em Opus 5.5 effort high.
- `docker` não está disponível no WSL (precisa da integração do Docker Desktop) — T11.

## Hipóteses descartadas

- nenhuma

## Decisões da execução

- T1: preço da AssemblyAI (assemblyai.com/pricing, 2026-11-17): transcrição $0,28/h = STT-3.7 $0,21 + speaker labels $0,02 + keyterms $0,05; voz $15/milhão de caracteres. Assume o modelo padrão (STT-3.7), pois o código não fixa `speech_model`: conferir `speech_model` na resposta da rodada real. Usuário ainda não confirmou os preços.
- T1: tabela da Claude inclui `claude-sonnet-5` (alvo do fallback do Sonnet 5.5); leitura de cache dele estimada em 0,1× (não documentada na skill). Haiku 5.5 escolhe a tabela pelo prompt total (entrada + cache), > 100 mil = tabela longa. Escrita de cache cobrada como TTL 5 min (o dubla não usa cache hoje).

## Resultado

Preencher na entrega.
