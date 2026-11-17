# Estado — Ver quanto custa cada dublagem e acompanhar o processamento de verdade

**Atualizado em:** 2026-11-17
**Etapa:** execucao
**Último review:** a4842cd (fase 1) — sem achados ≥ 80

## Onde paramos

Fase 1 fechada (T1–T5, review feito): custo medido por chamada (`back/src/custos/`), trace por job (`back/src/trace/trace.ts`: `Trace`, `rodarNoTrace`, `traceAtual`), tradutor Sonnet 5.5 high + juiz Haiku 5.5 medium (`POR_PAPEL` em `back/src/traducao/claude.ts`), validado contra o Opus no arm bar: US$ 0,11 de Claude por vídeo. Nada roda ainda dentro de um `Trace` na pipeline real: quem abre o trace e as etapas é a fase 2 (T6/T7).

## Tarefas

- T1 — feito (`custo.spec.ts` verde, 8 testes)
- T2 — feito (`trace.spec.ts`, `claude.spec.ts` + specs de tradução/juiz/transcrição/voz; suíte 91 verde)
- T3 — feito (specs de tradução e juiz conferem modelo/esforço/fallback; suíte 93 verde)
- T4 — feito (`--simulado` no relatório do arm bar: 72 falas, refazer exercitado, tabela de custo gerada)
- T5 — feito (rodada 2: meta atingida; `relatorios/comparacao-2026-11-17-20-43.md`)
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

Fase 2, T6: `back/src/jobs/` (`JobsService`) — fila em memória, um job por vez, cada job roda `IngestionService.dublar/dublarLink` dentro de `rodarNoTrace(new Trace(), …)`; erro chama `trace.falhar(msg)` e segue a fila; MP4 em `dublados/<id>.mp4` na raiz (pôr no `.gitignore`). Teste primeiro (`jobs.service.spec.ts`, dublagem simulada).

## O que o usuário decidiu e não está na spec nem no plano

- Acha a Claude cara ("2 dólares em 2 vídeos"); não quer usar OpenAI.
- Autorizou as duas rodadas pagas da T5 nesta sessão (autorização não vale para rodadas futuras).
- Preços da AssemblyAI (T1) apresentados; ainda sem confirmação dele.

## Defeitos

- nenhum

## Aprendizados

- Nos 3 relatórios de 2026-11-17 o encurtar rodou 0 vezes e o juiz reprovou no máximo 1 fala por vídeo: o custo vem de 2 chamadas grandes por vídeo (tradução + juiz) em Opus 5.5 effort high.
- O `Trace` emite eventos `etapa` / `progresso` / `chamada` (`assinar` devolve a função de cancelar): é o que o SSE da T8 vai repassar. `iniciarEtapa(nome, total?)` fecha a anterior; `avancar()` soma 1 em `feito`.
- Script de comparação: `cd back && node --env-file=../.env -r ts-node/register scripts/comparar-modelos.ts <relatorio.json> [--simulado]`; os `.md` de `relatorios/` não vão para o git.
- `docker` não está disponível no WSL (precisa da integração do Docker Desktop) — T11.

## Rodadas da T5

- **Rodada 1** (2026-11-17, `relatorios/comparacao-2026-11-17-20-31.md`): Sonnet 5.5 medium + Haiku 5.5 medium. Custo medido US$ 0,088 (tradução 0,068; juiz 0,0035; 2 refazer 0,015). Termos e sentido: nenhum erro (o juiz reprovou 2, ambas corrigidas). Pior que o Opus: 16 falas passam de 115% do alvo de caracteres onde o Opus ficava dentro (ex.: #15 53/29, #35 35/24, #19 64/46), muito pela troca de "centro" por "linha central"; e #42 "Deixei o cotovelo dele bem claro" soa errado (Opus: "Coloquei o cotovelo dele claramente"). Meta (≤ 5 piores) não atingida.
- Hipótese para a rodada 2: o prompt já pede "nunca muito acima do alvo"; o Opus em effort high obedecia, o Sonnet em medium checa menos o tamanho. Teste: plano B 1, tradutor em effort high.
- **Rodada 2** (2026-11-17, `relatorios/comparacao-2026-11-17-20-43.md`): tradutor Sonnet 5.5 high + juiz Haiku 5.5 medium. Custo US$ 0,111 (tradução 9.108 entrada / 8.939 saída = 0,108; juiz 0,003; nenhuma refeita). 0 erros de termo ou sentido; 4 falas acima de 115% do alvo onde o Opus cabia (#15 35/29, #27 37/29, #41 29/25, #72 18/15, poucos caracteres); #42 "bem claramente" tão estranha quanto a do Opus. Meta atingida → adotado effort high no tradutor. Hipótese da rodada 1 confirmada.
- Referência de custo do Opus: com os mesmos tokens da rodada 2 daria ~US$ 0,34 (Opus high gera mais saída); a fatura do usuário dizia ~US$ 1 por vídeo.

## Hipóteses descartadas

- nenhuma

## Decisões da execução

- T1: preço da AssemblyAI (assemblyai.com/pricing, 2026-11-17): transcrição $0,28/h = STT-3.7 $0,21 + speaker labels $0,02 + keyterms $0,05; voz $15/milhão de caracteres. Assume o modelo padrão (STT-3.7), pois o código não fixa `speech_model`: conferir `speech_model` na resposta da rodada real. Usuário ainda não confirmou os preços.
- T1: tabela da Claude inclui `claude-sonnet-5` (alvo do fallback do Sonnet 5.5); leitura de cache dele estimada em 0,1× (não documentada na skill). Haiku 5.5 escolhe a tabela pelo prompt total (entrada + cache), > 100 mil = tabela longa. Escrita de cache cobrada como TTL 5 min (o dubla não usa cache hoje).
- T2: `chamarClaude` ganhou um objeto de opções `{ papel }` (a T3 acrescenta modelo e esforço nele). A chamada é registrada no trace antes de checar recusa/corte, porque foi cobrada. Transcrição concluída sem `audio_duration` é erro explícito (o SDK tipa como opcional). Vozes somadas numa linha por etapa (`Trace.somarVoz`); caracteres = `texto.length`.
- T2: custo usa `resposta.model` (o modelo que de fato respondeu). Se um fallback server-side cair em modelo sem preço, a chamada falha com erro explícito; o custo da parte recusada antes do fallback (`usage.iterations`) não é separado.
- T3: modelo/esforço/fallback ficam numa tabela por papel dentro de `claude.ts` (`POR_PAPEL`), e não passados por cada serviço como o plano dizia: um lugar só para trocar modelo, e os serviços continuam passando só o papel. Teste antigo que conferia Opus/high foi atualizado para a regra nova (R2).
- T4: a comparação vai para `relatorios/comparacao-<AAAA-MM-DD-HH-MM>[-simulado].md` (com hora, para a segunda rodada não sobrescrever a primeira).

## Resultado

Preencher na entrega.
