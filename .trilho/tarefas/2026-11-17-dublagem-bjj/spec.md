# Spec — Dublagem de jiu-jitsu que parece feita por brasileiro

## O problema

A dublagem sai dessincronizada e com cara de tradutor automático. A pipeline joga fora o momento em que cada frase foi dita: transcreve tudo como um texto corrido, gera um áudio só em português e cola esse áudio a partir do início do vídeo. A diferença de ritmo entre inglês e português vai se acumulando, e a voz passa a narrar uma posição que já saiu da tela. Além disso, ninguém na pipeline conhece jiu-jitsu, ela não sabe quem está falando e usa uma voz robótica.

## O que você quer

- **O1** — Trazer vídeos de jiu-jitsu da gringa e ter um vídeo final de EXCELENTE qualidade, que pareça feito por um nativo, para você entender perfeitamente.
- **O2** — A voz em português acompanhar o que está acontecendo na tela, sem ficar desincronizada.
- **O3** — Os termos de jiu-jitsu saírem como se fala no tatame, nunca traduzidos ao pé da letra.
- **O4** — Saber quem está falando, com uma voz natural para cada pessoa, sem cara de robô.
- **O5** — Transcrição sem OpenAI, com um provedor bom e barato.
- **O6** — Um juiz que garanta que a tradução soe real, e não como Google Tradutor.

## O que vai mudar

### R1 — Cada fala começa na hora certa

Quando o vídeo é dublado, cada fala em português começa no mesmo instante em que a original começou, com no máximo 0,1 segundo de diferença, e termina antes de a próxima fala começar.

- **Exemplo:** o professor diz "Now I grab the collar" aos 2:15. Em português, "Agora eu pego a gola" começa aos 2:15, e não aos 2:40 como acontece hoje no meio de um vídeo longo. Isso vale tanto no minuto 1 quanto no minuto 20.
- **Por quê:** é a dessincronia que mais atrapalha você a entender o que está vendo (O2, O1).
- **Como a gente confere:** um teste monta uma linha do tempo com falas de durações conhecidas e confere onde cada uma ficou. Nos vídeos reais, o relatório mostra, fala por fala, o início original e o dublado.

### R2 — A fala em português cabe no tempo da original

Quando a fala em português sai mais longa que o espaço da original, o Claude reescreve a frase mais enxuta, sem perder o sentido. Se ainda sobrar, o áudio é acelerado em até 15%. Se mesmo assim não couber, a fala pode avançar sobre o silêncio que vem depois, mas nunca sobre a próxima fala. O vídeo nunca é cortado nem desacelerado.

- **Exemplo:** "You want to keep your elbows tight" leva 1,8 s. "Você quer manter os cotovelos bem fechados e colados no corpo" sairia com 2,6 s, então vira "Mantém o cotovelo colado", que cabe em 1,7 s.
- **Por quê:** português costuma ser 20 a 30% mais longo que inglês, e é isso que empurra a voz para trás da imagem (O2).
- **Como a gente confere:** testes com durações simuladas cobrem os três casos (encurtar, acelerar, avançar sobre o silêncio). No relatório, nenhuma fala passa por cima da próxima.

### R3 — A transcrição sabe quem fala e reconhece os termos de jiu-jitsu

Quando o vídeo é transcrito, cada fala vem com quem falou (pessoa A, pessoa B) e o momento exato. Os termos de jiu-jitsu do glossário são passados ao motor de transcrição para ele reconhecer melhor.

- **Exemplo:** num vídeo com professor e aluno, "Can I go for the kimura here?" fica marcada como pessoa B, e "Yes, but control the wrist first" como pessoa A. "Berimbolo" sai escrito certo, e não "barrymbolo".
- **Por quê:** sem saber quem fala, não dá para dar uma voz para cada pessoa. Termo errado na transcrição vira tradução errada (O4, O3, O5).
- **Como a gente confere:** testes com uma resposta de transcrição gravada conferem a separação por pessoa e por fala. No vídeo real com duas pessoas, você confere ouvindo.

### R4 — O Claude conhece jiu-jitsu e corrige a transcrição antes de traduzir

Quando a transcrição chega, o Claude revisa termos de jiu-jitsu que o motor errou. Para isso ele usa um guia detalhado de jiu-jitsu (posições, pegadas, finalizações, gírias de tatame) e o vídeo inteiro como contexto.

- **Exemplo:** "then he hits the kimora from half card" vira "then he hits the kimura from half guard" antes da tradução.
- **Por quê:** é o "agente que conhece as expressões do jiu-jitsu" que você pediu. Um motor de transcrição não recebe instruções, só uma lista de palavras, então esse conhecimento fica no Claude (O3).
- **Como a gente confere:** nos vídeos de teste, você confere no relatório que nenhum termo saiu errado.

### R5 — A tradução fala como no tatame brasileiro

Quando uma fala é traduzida, ela soa como um professor brasileiro falando. Usa "guarda", "raspagem", "passagem", "pegada" e "montada" em português, e mantém em inglês o que os brasileiros falam em inglês: "berimbolo", "kimura", "leg drag", "heel hook", "underhook". O tom é falado, não escrito.

- **Exemplo:** "He's playing De La Riva, gets the underhook and sweeps" vira "Ele tá jogando de De La Riva, pega o underhook e raspa", e não "Ele está jogando De La Riva, obtém o gancho por baixo e varre".
- **Por quê:** é a diferença entre parecer nativo e parecer Google Tradutor (O1, O3).
- **Como a gente confere:** você assiste aos vídeos de teste (R11).

### R6 — Um juiz revisa cada tradução

Quando a tradução fica pronta, um juiz (outra chamada do Claude, com critérios próprios) avalia cada fala: o termo de jiu-jitsu está certo, a frase soa natural, o sentido é o mesmo e ela cabe no tempo. A fala reprovada volta para o tradutor com o motivo, no máximo 2 vezes. Se ainda for reprovada, ela fica com a melhor versão e o relatório aponta.

- **Exemplo:** o tradutor escreve "Ele aplica uma chave de calcanhar". O juiz reprova com o motivo "heel hook se fala em inglês no tatame", e a nova versão vira "Ele entra no heel hook".
- **Por quê:** é o judge que você pediu, para a tradução não sair com cara de máquina (O6, O3).
- **Como a gente confere:** testes com respostas simuladas do Claude conferem o vai-e-volta e o limite de 2 tentativas. Nos vídeos reais, o relatório mostra os vereditos.

### R7 — Cada pessoa fala com uma voz pronta própria, em português

Quando o vídeo tem uma ou mais pessoas falando, cada uma recebe uma das vozes prontas em português da AssemblyAI e fala sempre com ela. Hoje existem duas: Nelson (homem mais velho, voz grave) e Benício (jovem). A pessoa que mais fala no vídeo fica com o Nelson, a segunda com o Benício. Com uma terceira pessoa ou mais, as vozes se repetem e o relatório avisa. Não tem clone: a AssemblyAI só cria clone pelo painel do site, e você escolheu ficar só com as vozes prontas (2026-11-17).

- **Exemplo:** o professor, que fala mais, sai com o Nelson e o aluno com o Benício. As duas vozes nunca se trocam no meio do vídeo.
- **Por quê:** voz natural e uma voz para cada pessoa é o que tira a cara de robô (O4, O1).
- **Como a gente confere:** na sondagem do começo, você ouve se as duas vozes prontas soam naturais lendo falas de jiu-jitsu. Nos vídeos reais, confere que as vozes não se trocam.

### R8 — O som ambiente do vídeo continua

Quando o vídeo é dublado, a voz em inglês sai e o resto do áudio original continua por baixo do português: música, barulho do tatame, batida de mão.

- **Exemplo:** num vídeo com música de fundo, a música continua no mesmo volume, e só a voz em inglês some.
- **Por quê:** vídeo sem ambiente soa artificial. Com ele, parece gravado em português (O1).
- **Como a gente confere:** você ouve os vídeos de teste.

### R9 — Transcrição e voz pela AssemblyAI, tradução e juiz pelo Claude

Quando o vídeo é processado, nada passa pela OpenAI nem pelo ElevenLabs. A AssemblyAI transcreve e gera a voz. O Claude corrige, traduz e julga.

- **Exemplo:** o `.env` precisa só das chaves da AssemblyAI e da Anthropic para o vídeo sair dublado.
- **Por quê:** você não quer OpenAI na transcrição nem ElevenLabs. A AssemblyAI faz as duas coisas, e a sua chave da Anthropic cobre o juiz (O5, O6).
- **Como a gente confere:** a pipeline roda com o `.env` sem as chaves da OpenAI e do ElevenLabs.
- ⚠️ **Vai além do pedido:** a tradução também sai da OpenAI e passa para o Claude, para tradutor e juiz ficarem no mesmo modelo que conhece jiu-jitsu.

### R10 — Um relatório de cada vídeo dublado

Quando um vídeo termina, fica registrado, fala por fala: quem falou, o inglês, o português final, o veredito do juiz, o início original e o dublado, e se a fala precisou ser encurtada ou acelerada.

- **Exemplo:** "fala 12, pessoa A, 2:15,30 → 2:15,30, acelerada 8%, juiz: aprovada na 2ª tentativa".
- **Por quê:** sem isso, cada rodada de ajuste vira achismo, e é com ele que a gente mede a sincronia de R1 (O2, O6).
- **Como a gente confere:** o relatório aparece ao fim de cada vídeo de teste.
- ⚠️ **Vai além do pedido:** você não pediu relatório. Ele existe para medir a sincronia e afinar tradução e juiz.

### R11 — Aprovado em dois vídeos reais

Quando a pipeline estiver pronta, você assiste a 2 vídeos curtos escolhidos por você (3 a 5 minutos, um com duas pessoas falando) e diz se parecem feitos por um nativo, com os termos certos e sincronizados.

- **Exemplo:** vídeo 1 é um instrutional de passagem de guarda. Vídeo 2 é um professor explicando com um aluno respondendo.
- **Por quê:** "parece nativo" só se confere assistindo (O1).
- **Como a gente confere:** até 4 rodadas de ajuste, com menos de US$5 no total. Se acabar sem aprovação, paramos e você decide.

## O que ficou decidido

- Transcrição e voz pela AssemblyAI. Soniox, Azure, xAI, Deepgram e ElevenLabs foram descartados — você, no chat.
- Vozes prontas da AssemblyAI (Nelson e Benício), sem clone — você, no chat (2026-11-17), porque a AssemblyAI só cria clone pelo painel do site.
- Voz e fundo separados, com o ambiente mantido — você, no chat.
- Termos como se fala no tatame brasileiro — você, no chat.
- Fala longa: encurtar a frase, depois acelerar até 15%, e o vídeo nunca muda — você, no chat.
- Meta: 2 vídeos, até 4 rodadas, menos de US$5 — você, no chat.
- Entrega: push e PR para `master` — você, no chat.
- A separação de voz e fundo roda de graça na sua placa de vídeo (Demucs), já que o ElevenLabs saiu — decidido por mim, porque a AssemblyAI não faz essa separação e o Demucs é gratuito.
- Antes de construir o resto, um teste curto das vozes prontas em português, para você ouvir — decidido por mim, porque a voz da AssemblyAI é nova (outubro de 2026) e ninguém a ouviu em português ainda. Se não soar natural, você decide a troca antes de investirmos no resto.
- Caso extremo do encaixe: se a fala não couber nem depois de encurtar 3 vezes, acelerar 15% e usar o silêncio seguinte, ela termina com um fade-out curto quando a próxima fala começa, e o relatório marca "cortada". Assim a sincronia nunca se perde — decidido por mim, porque é a única saída que respeita o limite de 15% e "nunca por cima da próxima fala". Se aparecer nos vídeos de teste, a gente revê juntos.
