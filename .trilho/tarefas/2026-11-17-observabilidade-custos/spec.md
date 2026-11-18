# Spec — Ver quanto custa cada dublagem e acompanhar o processamento de verdade

## O problema

Dois vídeos custaram uns 2 dólares de Claude, e você só soube pela fatura. A tradução e o juiz usam o modelo mais caro, com raciocínio alto, e nada no dubla mostra quanto cada vídeo gastou. Na tela, a barra de progresso é de mentira: as mensagens trocam a cada 4 segundos, sem relação com o que o servidor está fazendo. E se você fecha a aba, perde o vídeo.

## O que você quer

- **O1** — Gastar menos por vídeo trocando os modelos: tradutor no Sonnet, juiz no Haiku, sem piorar a dublagem.
- **O2** — Ver o trace de cada vídeo: as etapas, o gasto na AssemblyAI e o gasto no modelo.
- **O3** — Guardar num banco (Postgres no Docker) o histórico de traces e gastos, e ver isso no front.
- **O4** — Um progresso de verdade na tela, como num download: em que etapa está e quanto falta.

## O que vai mudar

### R1 — Cada chamada paga tem custo medido

Quando o dubla chama a Claude, guarda o modelo, os tokens de entrada e de saída e o custo em dólar. Quando chama a AssemblyAI, guarda a duração do áudio transcrito e os caracteres enviados para virar voz, também com o custo em dólar. Os preços ficam num lugar só, fácil de atualizar quando mudarem.

- **Exemplo:** a tradução do arm bar aparece como "Sonnet 5.5 — 9.800 tokens de entrada, 7.200 de saída — US$ 0,09"; a transcrição como "AssemblyAI — 4 min 50 s de áudio — US$ 0,0X".
- **Por quê:** sem medir, a gente não sabe se a troca de modelo economizou de verdade, nem onde o dinheiro vai (O1, O2).
- **Como a gente confere:** teste com respostas simuladas da Claude e da AssemblyAI, conferindo a conta do custo; e, na rodada real, comparar o total com o painel da Anthropic.

### R2 — Tradutor no Sonnet, juiz no Haiku

Quando o dubla traduz, refaz uma fala reprovada ou encurta uma fala que não cabe, usa o Sonnet 5.5 com raciocínio alto. Quando julga, usa o Haiku 5.5.

- **Exemplo:** no trace, as chamadas de tradução mostram "Sonnet 5.5" e as do juiz mostram "Haiku 5.5".
- **Por quê:** o Opus com raciocínio alto custa umas 40 vezes mais que o Haiku, e o juiz aprova quase tudo logo de primeira (71 de 72 falas no arm bar) (O1).
- **Como a gente confere:** teste conferindo o modelo pedido em cada papel; e o trace da rodada real.

### R3 — A troca só fica se a dublagem não piorar

Antes de adotar os modelos novos, eu traduzo e julgo de novo as mesmas 72 falas do arm bar que o Opus já dublou e comparo o português lado a lado. Uso o texto em inglês que já está salvo, sem transcrever de novo. Para cada fala, vejo se os termos do tatame estão certos, se o sentido e a instrução técnica continuam, se soa natural e se o tamanho cabe no tempo.

- **Exemplo:** fala 1, Opus: "Vamos ver armlock, juji gatame,"; Sonnet: "Hoje é armlock, o juji gatame,". As duas estão boas, então a fala passa.
- **Por quê:** economizar não vale se a dublagem fica pior (O1).
- **Como a gente confere:** você recebe a comparação e o custo medido. Meta: nenhuma fala com erro de termo ou de sentido, e no máximo 5 das 72 piores que a do Opus.

### R4 — Mandar o vídeo e acompanhar sem esperar a resposta

Quando você manda um vídeo ou um link, ele entra numa fila e o dubla responde na hora que recebeu. Se outro vídeo já estiver dublando, o novo aparece como "na fila" e começa quando o anterior terminar.

- **Exemplo:** você manda o triangle enquanto o arm bar dubla; o triangle mostra "na fila (1 antes)".
- **Por quê:** o progresso real precisa de um processamento que não trave a tela, e as vozes da AssemblyAI têm limite de 50 por minuto na conta inteira, então dois vídeos ao mesmo tempo só disputariam esse limite (O4).
- **Como a gente confere:** teste mandando dois vídeos com a dublagem simulada; o segundo só começa depois do primeiro.

### R5 — Progresso de verdade

Quando um vídeo está dublando, a tela mostra a etapa em que ele está, quantas falas já passaram nas etapas que vão fala por fala (vozes e encaixe), há quanto tempo está rodando e o gasto até agora, tudo vindo do servidor.

- **Exemplo:** "Etapa 5 de 7 — Gerando as vozes — 37 de 72 falas — 3 min 12 s — US$ 0,11 até agora", com a barra em 51% da etapa.
- **Por quê:** hoje as mensagens são inventadas (O4).
- **Como a gente confere:** você assiste uma dublagem e vê a barra e os números andarem junto com o log do servidor.

### R6 — Baixar o vídeo, agora ou depois

Quando a dublagem termina, a tela mostra o botão de baixar. O MP4 dublado fica guardado em disco, então dá para baixar de novo pelo histórico, mesmo dias depois ou com a aba fechada no meio.

- **Exemplo:** você fecha a aba durante as vozes, volta meia hora depois, abre o histórico e baixa o arm bar dublado.
- **Por quê:** você pediu para guardar o vídeo (O3, O4).
- **Como a gente confere:** dublar, fechar a aba, abrir o histórico e baixar.

### R7 — Trace de cada vídeo

Quando você abre um vídeo do histórico, vê as 7 etapas com quanto tempo cada uma levou e quanto custou. Cada chamada à Claude aparece com o papel (tradução, juiz, refazer, encurtar), o modelo, os tokens e o custo. Embaixo ficam o total da Claude, o total da AssemblyAI e o total geral.

- **Exemplo:** "Traduzindo e revisando — 1 min 40 s — US$ 0,12: tradução (Sonnet, US$ 0,09), juiz (Haiku, US$ 0,004), refazer 1 fala (Sonnet, US$ 0,01), juiz (Haiku, US$ 0,001)". Total: Claude US$ 0,13, AssemblyAI US$ 0,30, geral US$ 0,43.
- **Por quê:** é o que mostra onde o dinheiro vai (O2).
- **Como a gente confere:** teste montando o trace de uma dublagem simulada; e você abre o trace da rodada real.

### R8 — Histórico guardado no banco

Os vídeos, as etapas e as chamadas ficam num Postgres que roda no Docker da sua máquina. O histórico lista cada vídeo com data, nome, situação (na fila, dublando, pronto, falhou), quanto tempo levou e o custo total.

- **Exemplo:** "17/11 02:26 — Triangle choke (Danaher) — pronto — 14 min — US$ 0,61".
- **Por quê:** você pediu o histórico de traces e gastos no front (O3).
- **Como a gente confere:** reiniciar o servidor e ver o histórico continuar lá.

### R9 — Falha também fica registrada

Quando uma etapa falha, o vídeo fica como "falhou", o trace mostra em que etapa e com que mensagem, e o que já foi gasto até ali continua contado. A fila segue para o próximo vídeo.

- **Exemplo:** "falhou em Gerando as vozes: HTTP 401 na AssemblyAI — gasto até ali US$ 0,14".
- **Por quê:** a falha também custa dinheiro e precisa aparecer no gasto (O2).
- **Como a gente confere:** teste com uma etapa simulada que falha.

### R10 — Servidor reiniciado no meio

Quando o servidor reinicia com um vídeo dublando, ele volta marcado como "interrompido", com o gasto até ali. Os vídeos que estavam na fila também ficam como interrompidos, e você manda de novo se quiser.

- **Exemplo:** você salva um arquivo do back durante as vozes, o servidor reinicia em modo de desenvolvimento, e o histórico mostra "interrompido em Gerando as vozes — US$ 0,14".
- **Por quê:** sem isso, o vídeo ficaria "dublando" para sempre no histórico.
- ⚠️ **Vai além do pedido:** é um efeito colateral de ter processamento em segundo plano com histórico guardado.
- **Como a gente confere:** teste da inicialização com um vídeo "dublando" no banco.

## O que ficou decidido

- Tradutor (e encurtar) no Sonnet 5.5, juiz no Haiku 5.5, Postgres no Docker — você, no chat.
- Tradutor com raciocínio alto, e não médio: com o médio, 16 das 72 falas do arm bar passavam do tempo; com o alto, 4 (plano B combinado, rodada de 17/11).
- O MP4 dublado fica guardado em disco para baixar pelo histórico — você, no chat.
- Um vídeo de cada vez, os outros esperam na fila — você, no chat.
- A validação da troca de modelo é feita por mim, comparando com o arm bar que o Opus já dublou — você, no chat.
- Entrega: push e PR para o master — você, no chat.
- Custos em dólar, que é a moeda das duas faturas — decidido por mim.
- As vozes aparecem somadas por etapa (quantas falas, quantos caracteres, quanto custou), e não uma linha por fala: são umas 200 chamadas num vídeo grande e cada uma custa quase nada — decidido por mim.
- O relatório em JSON na pasta de relatórios continua sendo gravado como hoje — decidido por mim, porque é o que o ensaio sem custo usa.
- O banco roda só na sua máquina: nada de banco remoto — decidido por mim, seguindo a sua regra de nunca mexer em banco remoto sem perguntar.
