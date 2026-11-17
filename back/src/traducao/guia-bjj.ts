// Guia de jiu-jitsu: uma fonte só para o reconhecimento da AssemblyAI (termos)
// e para os prompts do tradutor e do juiz (guia do tatame brasileiro).

// Termos que o motor de transcrição costuma errar. Limite da AssemblyAI:
// 100 termos e 8000 caracteres no total (acima disso a API responde 400).
// Palavras comuns do inglês (guard, mount, pass) ficam de fora: o motor já
// reconhece e a doc recomenda não incluí-las.
export const TERMOS_RECONHECIMENTO: string[] = [
  // Guardas
  'De La Riva',
  'reverse De La Riva',
  'single leg X',
  'X-guard',
  'K-guard',
  'Z-guard',
  'worm guard',
  'lapel guard',
  'lasso guard',
  'spider guard',
  'butterfly guard',
  'half guard',
  'deep half guard',
  'knee shield',
  'rubber guard',
  'collar sleeve',
  // Passagens e posições
  'leg drag',
  'knee cut',
  'knee slice',
  'toreando',
  'over-under pass',
  'stack pass',
  'body lock pass',
  'smash pass',
  'headquarters',
  'knee on belly',
  'north-south',
  'side control',
  'kesa gatame',
  'turtle',
  'back take',
  'crucifix',
  'seatbelt',
  'technical stand-up',
  'hip escape',
  // Raspagens
  'berimbolo',
  'scissor sweep',
  'flower sweep',
  'pendulum sweep',
  'hip bump sweep',
  'tripod sweep',
  'sickle sweep',
  'waiter sweep',
  'balloon sweep',
  'kiss of the dragon',
  'wrestle up',
  // Finalizações
  'kimura',
  'omoplata',
  'americana',
  'armbar',
  'triangle choke',
  'guillotine',
  'arm-in guillotine',
  "D'Arce",
  'anaconda choke',
  'Ezekiel choke',
  'bow and arrow choke',
  'cross collar choke',
  'loop choke',
  'baseball bat choke',
  'clock choke',
  'paper cutter choke',
  'rear naked choke',
  'north-south choke',
  'wristlock',
  // Chaves de perna
  'heel hook',
  'inside heel hook',
  'outside heel hook',
  'toe hold',
  'kneebar',
  'calf slicer',
  'straight ankle lock',
  'ashi garami',
  'saddle',
  'inside sankaku',
  '50/50',
  'honey hole',
  // Pegadas e controle
  'underhook',
  'overhook',
  'whizzer',
  'two-on-one',
  'collar tie',
  'arm drag',
  'collar drag',
  'leg lasso',
  // Quedas
  'single leg',
  'double leg',
  'ankle pick',
  'osoto gari',
  'ouchi gari',
  'uchi mata',
  'seoi nage',
  'sumi gaeshi',
  'tomoe nage',
  // Geral
  'jiu-jitsu',
  'no-gi',
  'gi',
];

// Guia do tatame brasileiro, usado no system prompt do tradutor e do juiz.
export const GUIA_TATAME = `
# Como se fala jiu-jitsu no tatame brasileiro

O público é brasileiro que treina jiu-jitsu. A dublagem tem que soar como um professor brasileiro explicando no tatame: falado, direto, sem cara de tradução.

## Registro falado

- Use "tá", "pra", "pro", "né", "beleza", "olha só", "repara", "aí". Nunca "está", "para o", "obtém", "efetua", "realiza".
- Imperativo de tatame, na 3ª pessoa do jeito que se fala: "pega a gola", "joga a perna", "puxa", "trava", "encaixa", "segura", "cola o cotovelo", "abaixa o quadril".
- Frases curtas. Corte o que o inglês repete ("you know", "so", "basically", "okay", "right") quando não faz falta.
- "Você" ou nada; nunca "tu", nunca "o senhor". O oponente é "ele", "o cara" ou "o parceiro", nunca "o adversário" em tom formal.

## Fica em inglês (é assim que se fala aqui)

berimbolo, kimura, armlock (para "armbar"), heel hook, inside heel hook, outside heel hook, toe hold, kneebar, calf slicer, leg drag, knee cut, single leg, double leg, ankle pick, underhook, overhook, whizzer, two-on-one, collar tie, arm drag, collar drag, wrestle up, De La Riva, reverse De La Riva, single leg X, K-guard, Z-guard, worm guard, lapel guard, lasso, saddle, inside sankaku, ashi garami, 50/50, honey hole, headquarters, seatbelt, frame, grip (também "pegada"), drill, no-gi, D'Arce, anaconda, loop choke, baseball choke, crucifixo (o nome é igual), body lock, smash pass, stack, kiss of the dragon.

Nomes japoneses de judô ficam como estão: osoto gari, ouchi gari, uchi mata, seoi nage, sumi gaeshi, tomoe nage, kesa gatame.

## Se traduz (e como)

| Inglês | Tatame BR |
|---|---|
| closed guard | guarda fechada |
| open guard | guarda aberta |
| half guard | meia-guarda |
| deep half | meia-guarda profunda / deep half |
| butterfly guard | guarda borboleta |
| spider guard | guarda aranha |
| X-guard | guarda X |
| knee shield | joelho na frente / knee shield |
| mount | montada |
| side control | cem-quilos |
| north-south | norte-sul |
| knee on belly | joelho na barriga |
| back / back control | costas / pegar as costas |
| hooks | ganchos |
| turtle | tartaruga |
| sweep / to sweep | raspagem / raspar |
| scissor sweep | raspagem de tesoura |
| flower sweep / pendulum sweep | raspagem de pêndulo |
| hip bump sweep | raspagem de quadril |
| guard pass / to pass | passagem / passar a guarda |
| toreando | toreada / toureando |
| over-under | over-under / passagem por baixo e por cima |
| submission / to submit | finalização / finalizar |
| tap / tap out | bater / bater pra finalização |
| triangle | triângulo |
| rear naked choke | mata-leão |
| guillotine | guilhotina |
| omoplata | omoplata |
| americana / keylock | americana |
| Ezekiel | ezequiel |
| bow and arrow choke | arco e flecha |
| cross collar choke | estrangulamento com a gola cruzada |
| choke | estrangulamento (ou o nome: "mata-leão", "guilhotina") |
| wristlock | chave de pulso |
| straight ankle lock | chave de pé reta / botinha |
| leg lock | chave de perna / leg lock |
| takedown | queda |
| guard pull | puxar pra guarda |
| technical stand-up | levantada técnica |
| hip escape / shrimp | fuga de quadril |
| bridge | ponte |
| base / posture / pressure | base / postura / pressão |
| collar / lapel / sleeve / pants | gola / lapela / manga / calça |
| grip | pegada |
| roll / sparring | rola / rolar / treino |
| mat | tatame |
| gi | kimono |
| white/blue/purple/brown/black belt | faixa branca/azul/roxa/marrom/preta |
| coach / instructor | professor |
| partner | parceiro |

## Exemplos

- "He's playing De La Riva, gets the underhook and sweeps." → "Ele tá jogando de De La Riva, pega o underhook e raspa."
- "From closed guard, break his posture, grab the collar and go for the armbar." → "Da guarda fechada, quebra a postura dele, pega a gola e vai pro armlock."
- "You want to keep your elbows tight." → "Mantém o cotovelo colado."
- "Once you take the back, get your hooks in and secure the seatbelt." → "Pegou as costas, coloca os ganchos e trava o seatbelt."
- "If he defends, you can switch to the kimura." → "Se ele defender, troca pra kimura."
- "Now I'm gonna show you a really nice pass from the knee shield." → "Agora vou mostrar uma passagem muito boa contra o joelho na frente."
- "This is super important, guys." → "Isso aqui é muito importante, pessoal."

## Erros que entregam tradução automática

- "chave de calcanhar" para heel hook, "gancho por baixo" para underhook, "varrer" para sweep, "controle lateral" para side control, "submissão" para submission, "montar" no lugar de "montada" quando é a posição.
- Português de livro: "você deverá", "efetuar a passagem", "obter a pegada".
`.trim();
