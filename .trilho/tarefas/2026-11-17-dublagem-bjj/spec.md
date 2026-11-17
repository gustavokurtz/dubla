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

Quando a fala em português sai mais longa que o espaço da original, o áudio é acelerado em até 15%. Se ainda sobrar, a fala avança sobre o silêncio que vem depois, mas nunca sobre a próxima fala. Só se mesmo assim não couber, o Claude reescreve a frase mais enxuta, sem perder o sentido. O vídeo nunca é cortado nem desacelerado.

- **Mudou em 2026-11-17 (você, no chat):** antes o Claude encurtava primeiro. Na rodada real isso pediu o impossível ("vai" em 0,27 s, com 0,85 s de silêncio livre logo depois) e custou uma chamada ao Claude por fala.

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

Quando o vídeo tem uma ou mais pessoas falando, cada uma recebe uma voz pronta brasileira da AssemblyAI e fala sempre com ela. São 2 vozes de timbre médio, nem de velho nem de criança, escolhidas por você ouvindo a sondagem. A pessoa que mais fala no vídeo fica com a primeira voz, a segunda com a outra. Com uma terceira pessoa ou mais, as vozes se repetem e o relatório avisa. Não tem clone: você preferiu voz pronta (2026-11-17).

- **Exemplo:** o professor, que fala mais, sai com a voz 1 e o aluno com a voz 2. As duas vozes nunca se trocam no meio do vídeo.
- **Por quê:** voz natural e uma voz para cada pessoa é o que tira a cara de robô (O4, O1).
- **Como a gente confere:** na sondagem do começo, você ouve as candidatas lendo falas de jiu-jitsu e escolhe as 2. O caso de duas pessoas é conferido por testes automáticos (cada fala usa a voz da sua pessoa).

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

### R11 — Aprovado num vídeo real do YouTube

Quando a pipeline estiver pronta, você passa o link de 1 vídeo do YouTube (3 a 5 minutos, uma pessoa falando, que é o caso comum) e diz se o resultado parece feito por um nativo, com os termos certos e sincronizado. O caso de duas pessoas não precisa de vídeo real: é coberto por testes automáticos com dados montados à mão (R3, R7).

- **Exemplo:** um instrucional de passagem de guarda com um professor explicando.
- **Por quê:** "parece nativo" só se confere assistindo (O1). Você não quer ficar caçando vídeos com duas pessoas só para testar.
- **Como a gente confere:** até 4 rodadas de ajuste, com menos de US$5 no total. Se acabar sem aprovação, paramos e você decide.

### R12 — Dublar a partir de um link do YouTube

Quando você tem um link do YouTube, não precisa baixar o vídeo na mão: na tela você cola o link (além de poder subir um arquivo), e também há um comando que baixa o vídeo pelo link para a gente testar.

- **Exemplo:** você cola `https://www.youtube.com/watch?v=...` na tela e recebe o vídeo dublado; ou me passa o link e eu rodo o comando para baixar e testar.
- **Por quê:** você não quer ficar procurando e baixando vídeos na mão para testar (O1).
- **Como a gente confere:** um teste confere o comando de download montado; na rodada real, o vídeo do R11 entra pelo link.
- ⚠️ **Atenção:** os termos do YouTube não permitem baixar vídeos. Para uso pessoal e teste tudo bem; se o projeto virar público, a gente revê.

## O que ficou decidido

- Transcrição e voz pela AssemblyAI. Soniox, Azure, xAI, Deepgram e ElevenLabs foram descartados — você, no chat.
- Voz pronta, sem clone: 2 vozes brasileiras de timbre médio do catálogo da AssemblyAI (196 vozes em português), escolhidas por você na sondagem. O Nelson ficou de fora, porque soa velho demais — você, no chat (2026-11-17).
- Voz e fundo separados, com o ambiente mantido — você, no chat.
- Termos como se fala no tatame brasileiro — você, no chat.
- Fala longa: encurtar a frase, depois acelerar até 15%, e o vídeo nunca muda — você, no chat.
- Meta: 1 vídeo do YouTube com uma pessoa, até 4 rodadas, menos de US$5; duas pessoas cobertas por testes automáticos — você, no chat (2026-11-17).
- Link do YouTube na tela e num comando de teste — você, no chat (2026-11-17).
- Entrega: push e PR para `master` — você, no chat.
- A separação de voz e fundo roda de graça na sua placa de vídeo (Demucs), já que o ElevenLabs saiu — decidido por mim, porque a AssemblyAI não faz essa separação e o Demucs é gratuito.
- Antes de construir o resto, um teste curto com vozes candidatas, para você ouvir e escolher — decidido por mim, porque a voz da AssemblyAI é nova e ninguém a ouviu em português ainda.
- Caso extremo do encaixe: se a fala não couber nem depois de encurtar 3 vezes, acelerar 15% e usar o silêncio seguinte, ela termina com um fade-out curto quando a próxima fala começa, e o relatório marca "cortada". Assim a sincronia nunca se perde — decidido por mim, porque é a única saída que respeita o limite de 15% e "nunca por cima da próxima fala". Se aparecer nos vídeos de teste, a gente revê juntos.
