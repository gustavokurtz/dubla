# Plano — Dublagem de jiu-jitsu que parece feita por brasileiro

**Tarefa:** 2026-11-17-dublagem-bjj
**Branch:** `feat/dublagem-bjj` (sai do `master` local, que tem `chore: add trilho` ainda não enviado)
**Spec:** `spec.md`
**Entrega:** push + PR para `master`

## Contexto no código

- `back/src/ingestion/ingestion.service.ts:13-42` — orquestrador atual: extrai áudio → `transcreverAudio` (texto corrido) → `traduzirTexto` (texto inteiro) → `gerarVoz` (OpenAI TTS, um bloco) → `substituirAudio`. **Causa da dessincronia:** imediata, `ingestion.service.ts:34-38` + `ffmpeg.service.ts:61` (um áudio único colado do 0 s com `-shortest`); de desenho, o tempo de cada fala é descartado em `openai.service.ts:26` (retorna só `transcricao.text`), então nenhuma etapa seguinte tem como posicionar nada.
- `back/src/openai/*` — Whisper, GPT e TTS. Sai inteiro (R9).
- `back/src/elevenlabs/*` — TTS por segmento, não usado pelo orquestrador. Sai inteiro (R9).
- `back/src/ffmpeg/ffmpeg.service.ts` — padrão de temp dir (`mkdtemp` + `finally`) a seguir em tudo o que chama ffmpeg/demucs. ffmpeg do sistema: 6.1.1.
- `back/src/shared/types.ts` — `Segmento`/`SegmentoComAudio`: base para o novo tipo de fala (com pessoa).
- Padrão de módulo: um módulo Nest por integração (`back/src/ffmpeg/ffmpeg.module.ts`).
- Suíte hoje: 6/9 specs vermelhas (specs geradas pelo Nest sem `ConfigService` no módulo de teste). As de openai/elevenlabs somem com os módulos; as que ficarem precisam sair verdes ao fim da fase 3.
- Máquina: RTX 4050 6 GB (WSL), Python 3.12 com venv, sem torch instalado.

## Decisões

| Questão | Decisão | Porquê |
|---|---|---|
| Provedor de transcrição e voz | AssemblyAI para os dois (usuário) | Quer um só provedor, barato, com quem-fala |
| Voz | Vozes prontas PT-BR da AssemblyAI, sem clone (usuário, 2026-11-17): 2 vozes de timbre médio escolhidas pelo dev na sondagem T1 (slugs em `VOZES_PT`, ordem = pessoa que mais fala primeiro); da 3ª pessoa em diante alterna e o relatório marca (decidido por mim) | Clone descartado pelo usuário; Nelson soa velho |
| Síntese | REST `POST https://tts.us.assemblyai.com/v1/speech` com `fetch` (`language: portuguese`, `encoding: mp3`, `stream: false`, chave em `Authorization`); catálogo em `GET /v1/voices?scope=public` (filtrar por `language` e `tags`) (decidido por mim) | É um POST só; `speed` só aceita 1, então velocidade fica no ffmpeg |
| YouTube | `yt-dlp` (`python -m yt_dlp`) no mesmo venv Python do Demucs; `YoutubeService.baixar(url)` usado pelo endpoint (link na tela) e por `back/scripts/baixar-video.mts` → `videos/` na raiz, no `.gitignore` (usuário: "os dois"; ferramenta decidida por mim) | Padrão de fato para baixar do YouTube; um venv só para as ferramentas Python |
| Fundo | Separar voz e fundo; manter fundo (usuário) | Parecer nativo |
| Termos | Tatame BR (usuário) | — |
| Fala longa | atempo ≤ 1,15 → avançar sobre silêncio até o início da próxima fala → encurtar (Claude) até 3×; vídeo intocado (usuário; ordem trocada em 2026-11-17 depois do D2) | Sincronia; encurtar é caro e às vezes impossível, então é o último recurso |
| Caso extremo de encaixe | 3ª tentativa de encurtar; se ainda não couber, fade-out de 80 ms no início da próxima fala, relatório marca "cortada" (decidido por mim) | Única saída que respeita 15% e "nunca por cima da próxima" |
| Meta empírica | 1 vídeo do YouTube com uma pessoa, até 4 rodadas, < US$5; duas pessoas cobertas por testes automáticos (usuário, 2026-11-17) | Caso comum é uma pessoa; não caçar vídeos |
| Separação voz/fundo | Demucs (`htdemucs`, `--two-stems=vocals`) num venv Python em `back/.venv-py` (também com `yt-dlp`), chamado por `child_process`; caminho do python em `FERRAMENTAS_PYTHON` (decidido por mim) | Gratuito, roda na GPU local; AssemblyAI não separa |
| Unidade de tradução | "Fala": trecho de uma pessoa, cortado pelo código a partir das palavras com tempo da AssemblyAI: sempre em troca de pessoa, pausa ≥ 1,5 s ou ~12 s; em fim de frase ou pausa ≥ 0,4 s só se o trecho já tem ≥ 1,5 s (decidido por mim; mínimo de 1,5 s depois do D2, usuário escolheu "juntar os pedaços") | Fala longa demais não encaixa; cortar é regra fixa → código, não LLM |
| Modelo do Claude | `claude-opus-5-5`, `output_config.effort: "high"` para tradutor e juiz, saída estruturada (zod), streaming + `finalMessage()`, `fallbacks: "default"` com beta `server-side-fallback-2026-07-01` (decidido por mim) | Padrão atual da Anthropic; tradução de nuance é tarefa de inteligência; saída estruturada evita parse de texto livre |
| Contexto da tradução | Uma chamada com o vídeo inteiro (todas as falas, com id, pessoa, duração e orçamento de caracteres) que corrige o inglês (R4) e traduz (R5) (decidido por mim) | O contexto do vídeo inteiro resolve ambiguidades ("pass" = passagem); corrigir e traduzir juntos evita 2 chamadas |
| Juiz | Chamada separada, outro system prompt (rubrica: termo BJJ, naturalidade, sentido, cabe no tempo), devolve `{id, aprovado, motivo}`; reprovadas voltam ao tradutor com o motivo, máx. 2 voltas, controladas por código (decidido por mim) | O limite de voltas é regra fixa → código |
| Orçamento de caracteres | `duração × 14 chars/s` informado ao tradutor como alvo; a conferência real é a duração medida do áudio gerado (ffprobe), não o número de chars (decidido por mim) | Chars é estimativa; a medida que decide é a do áudio |
| Glossário/guia BJJ | Um arquivo em `back/src/traducao/guia-bjj.ts` com (a) lista de termos para o reconhecimento da AssemblyAI e (b) o guia do tatame BR usado nos prompts do tradutor e do juiz (decidido por mim) | Uma fonte só para os três usos |
| Relatório | JSON por vídeo em `relatorios/` na raiz (no `.gitignore`) + resumo no log (decidido por mim) | Medir R1 e afinar R5/R6; único arquivo persistido, é diagnóstico |
| `CLAUDE.md` | Atualizado para a pipeline nova no fim da fase 3 (decidido por mim) | Hoje descreve uma pipeline que não existe (armadilha no `projeto.md`) |
| Descartado | Whisper local / WhisperX (o usuário escolheu API); traduzir o texto inteiro de uma vez (é a causa da dessincronia); um juiz que reescreve sozinho (o juiz só julga, quem reescreve é o tradutor, para o critério de reprovação ficar separado da escrita) | — |

## Incertezas

- **I1** — Quais 2 vozes prontas PT-BR soam naturais e de timbre médio lendo jiu-jitsu? Sondagem em T1, antes de construir em volta dela.
- **I2** — Demucs roda na RTX 4050 6 GB em WSL com tempo aceitável (≤ 1× a duração do vídeo)? Sondagem em T2.
- **I3** — Tradução + juiz soam nativos e cabem no tempo? Só se mede nos vídeos reais (T12).
- **I4** — amix com centenas de entradas funciona no ffmpeg 6.1 (limite de entradas/descritores)? Verificado em T10 com 300 falas sintéticas.

## Tarefas

Antes de usar qualquer SDK (assemblyai, @anthropic-ai/sdk, zod), consultar Context7 (regra do CLAUDE.md global).

### Fase 1 — A voz é escolhida e a pipeline já sabe quem fala e quando

- **T0** — Baixar vídeo do YouTube
  - Atende: R12
  - Como: venv `back/.venv-py` (no `.gitignore`) com `yt-dlp`; `YoutubeService.baixar(url) → { arquivo, titulo }` em `back/src/youtube/`, mp4 até 720p, em temp dir; script `back/scripts/baixar-video.mts <url>` copia para `videos/` na raiz (no `.gitignore`).
  - Teste: spec com `child_process` mockado confere argumentos e erro explícito com link inválido.
  - Verificar por: dev passa um link; o mp4 aparece em `videos/`. Sem custo.
- **T1** — Sondagem das vozes prontas em PT-BR
  - Atende: R7, R9
  - Como: `back/scripts/sondagem-voz.mts [slug ...]` gera as mesmas 5 falas de jiu-jitsu com cada voz candidata em `relatorios/sondagem/`. Rodada 1: Nelson e Benício. Rodada 2: 8 de timbre médio do catálogo (Robson, Joaquim, Cássio, Luiz, Antônio, Nilson, Caio, Iago).
  - Quem roda: dev (ouve e escolhe; a rodada é paga e pede o "pode")
  - Meta: dev escolhe 2 vozes. Orçamento: 3 rodadas, < US$1. Se esgotar: parar e trazer ao usuário (outro provedor de voz).
- **T2** — Demucs instalado e serviço de separação
  - Atende: R8
  - Como: no venv `back/.venv-py` de T0, `pip install demucs` com torch CUDA; `SeparacaoService.separar(audio) → { voz, fundo }` em `back/src/separacao/`, padrão temp dir do `FfmpegService`.
  - Teste: spec com `child_process` mockado confere argumentos e leitura dos dois arquivos de saída.
  - Verificar por: rodar no áudio do vídeo 1 e ouvir `fundo.wav` sem voz; anotar tempo e VRAM no `estado.md` (I2). Sem custo.
- **T3** — Guia de jiu-jitsu
  - Atende: R3, R4, R5
  - Como: `back/src/traducao/guia-bjj.ts` com a lista de termos (posições, guardas, passagens, finalizações, pegadas, gírias: ~150 termos) e o guia do tatame BR: o que fica em inglês, o que se traduz e como, registro falado ("tá", "pega", "joga"), com exemplos inglês → português.
  - Verificar por: leitura do dev no code review da fase (sem teste: é conteúdo, e teste de texto de prompt não prova comportamento).
- **T4** — Transcrição na AssemblyAI com pessoa e falas
  - Atende: R3, R9
  - Como: `TranscricaoService` em `back/src/transcricao/` envia o áudio com identificação de quem fala, palavras com tempo e a lista de termos do guia. Função pura `cortarEmFalas(palavras)` → `Fala { id, pessoa, inicio, fim, textoEn }`, cortando em fim de frase, troca de pessoa ou pausa ≥ 0,4 s, máximo ~12 s. Novo tipo em `shared/types.ts`.
  - Teste: fixture JSON de resposta gravada (escrita à mão no formato da doc) → falas esperadas: troca de pessoa, pausa, limite de 12 s, frase única.

**Fim da fase 1:** vídeo baixando pelo link; 2 vozes escolhidas pelo dev (ou decisão dele registrada); `npx jest` das specs novas verde; Demucs separando o vídeo 1.

### Fase 2 — Correção, tradução e juiz

- **T5** — Tradutor com Claude
  - Atende: R4, R5, R2 (orçamento de chars)
  - Como: `TraducaoService.traduzir(falas)` em `back/src/traducao/`: uma chamada com o vídeo inteiro, system prompt = papel (dublador brasileiro de jiu-jitsu) + guia BJJ + regras de registro falado e orçamento de caracteres; saída estruturada `[{ id, textoEnCorrigido, textoPt }]`. Também `encurtar(fala, alvoChars, motivo)` para o encaixe (T9).
  - Teste: SDK mockado; confere que toda fala volta com texto e que um id faltando é erro explícito (não silencioso).
- **T6** — Juiz e vai-e-volta
  - Atende: R6
  - Como: `JuizService.avaliar(falas traduzidas)` → `[{ id, aprovado, motivo }]` com rubrica própria; laço em código: reprovadas → `traducao.refazer(falas, motivos)` → juiz de novo, máximo 2 voltas; sobra fica com a última versão e `juiz: "reprovada"`.
  - Teste: mocks com sequências (aprova de primeira; reprova 1× e aprova; reprova 3× → para em 2 voltas e marca).
- **T7** — Relatório
  - Atende: R10
  - Como: estrutura do relatório acumulada ao longo da pipeline e gravada em `relatorios/<data>-<nome>.json` + tabela resumida no log.
  - Teste: função pura que monta o relatório a partir de falas com dados de encaixe.

**Fim da fase 2:** specs verdes; uma rodada real só de tradução + juiz nas falas do vídeo 1 (com o "pode" do dev, < US$0,50) com o relatório em mãos para o dev dar uma olhada nos termos.

### Fase 3 — Voz, sincronia e vídeo final

- **T8** — Voz de cada pessoa e áudio de cada fala
  - Atende: R7
  - Como: função pura `atribuirVozes(falas, vozes)` → pessoa → voz (ordem por tempo total de fala; voz 1, voz 2, alterna da 3ª em diante, marcando repetição); `VozService` em `back/src/voz/` gera o áudio de cada fala com a voz da pessoa via `POST /v1/speech`.
  - Teste: `atribuirVozes` com 1, 2 e 3 pessoas; `fetch` mockado confere que cada fala usa a voz da sua pessoa e que erro HTTP vira erro explícito.
- **T9** — Encaixe no tempo
  - Atende: R1, R2
  - Como: função pura `planejarEncaixe(fala, duracaoAudio, inicioProximaFala)` → `{ acao: ok | encurtar | acelerar | avancar | cortar, atempo, fim }`, seguindo a ordem decidida; o laço (medir com ffprobe → encurtar até 3× → regerar voz) fica no orquestrador.
  - Teste: casos com durações: cabe; encurta; acelera 1,10; acelera 1,15 + avança sobre silêncio; não cabe → corta no início da próxima; última fala do vídeo (limite = fim do vídeo).
- **T10** — Mixagem
  - Atende: R1, R8
  - Como: `FfmpegService.montarVideo(video, fundo, falasPosicionadas)`: cada fala com `atempo` + `adelay` no início original (ms), `amix normalize=0` com o fundo, fade de 80 ms nas cortadas, vídeo `-c:v copy`, áudio AAC, duração = a do vídeo (sem `-shortest`). Se 300 entradas estourarem (I4), mixar em lotes.
  - Teste: monta um vídeo sintético (cor sólida + silêncio) com 3 falas de tom (sine) em 1 s, 3 s e 5 s e confere, por `silencedetect`, que cada tom começa no instante certo (±0,1 s). Verificar por: mesmo teste com 300 falas sintéticas (I4).
- **T11** — Orquestrador novo e limpeza
  - Atende: R1, R9
  - Como: `IngestionService` na ordem: extrair áudio → separar (Demucs) → transcrever → traduzir + juiz → voz → encaixe → montar → relatório. Remover `back/src/openai/`, `back/src/elevenlabs/` e as dependências `openai` e `@elevenlabs/elevenlabs-js`; consertar as specs vermelhas que ficarem (providers mockados). Atualizar `CLAUDE.md` (pipeline, variáveis de ambiente, venv do Demucs).
  - Teste: spec do orquestrador com todos os serviços mockados conferindo a ordem e que o relatório recebe todas as falas.

- **T13** — Link do YouTube na tela
  - Atende: R12
  - Como: `POST /ingestion/dublar` aceita, além do arquivo, um campo `url`; com `url`, o orquestrador chama `YoutubeService.baixar` antes de extrair o áudio. No front, um campo para colar o link ao lado do upload.
  - Teste: spec do controller/orquestrador: com `url` chama o download, com arquivo não. Front: verificação visual.

**Fim da fase 3:** suíte inteira, typecheck e lint verdes (`projeto.md`); o vídeo de T0 sai dublado de ponta a ponta pelo link numa rodada real com o "pode" do dev.

### Fase 4 — Aprovação nos vídeos reais

- **T12** — Rodadas de ajuste no vídeo do YouTube
  - Atende: R11, R1, R5, R6, R7, R8
  - Como: cada rodada = dublar o vídeo (link de T0), ler o relatório (sincronia: início dublado − original ≤ 0,1 s em todas as falas; quantas encurtadas/aceleradas/cortadas; reprovações do juiz) e o dev assiste. Antes de cada ajuste, hipótese em uma linha a partir do relatório; ajuste no guia/prompt e na régua em commits separados.
  - Quem roda: dev (assiste e julga; rodada paga pede o "pode")
  - Meta: dev aprova o vídeo ("parece nativo, termos certos, sincronizado"). Orçamento: 4 rodadas, < US$5 no total. Se esgotar: parar e trazer ao usuário o relatório e o que falta.
  - Defeito novo sem relação com o ajuste da rodada vira ponto em aberto no `estado.md`, não correção na hora.

**Fim da fase 4:** aprovação do dev registrada no `estado.md`.

## Pronto quando

Cada requisito da spec verificado pelo "Como a gente confere" dele, e suíte/typecheck/lint verdes.

Validação manual (o usuário roda no final):

1. `pnpm dev`, colar o link do vídeo do YouTube na tela → baixa o vídeo dublado (R12, R9, R11)
2. Pular para o meio e o fim do vídeo → a voz bate com o movimento na tela (R1, R2)
3. Ouvir o professor → fala português com a voz escolhida, sem trocar (R7)
4. Ouvir o fundo → música/ambiente presentes, sem inglês por baixo (R8)
5. Abrir o relatório em `relatorios/` → todas as falas com quem falou, português e veredito do juiz (R10, R3, R4, R5, R6)
