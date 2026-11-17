// Sondagem T1: as vozes prontas PT da AssemblyAI lendo falas de jiu-jitsu.
// Uso (em back/): node --env-file=../.env --experimental-strip-types scripts/sondagem-voz.mts
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VOZES = ['aai-nelson', 'aai-benicio'];
const FALAS = [
  'Beleza, agora da guarda fechada você quebra a postura dele, puxa a gola e já monta o armlock.',
  'Olha só: na meia-guarda, o segredo é pegar o underhook e ficar de lado, nunca de costas pro chão.',
  'Ele tentou passar a guarda, eu joguei a perna por cima e encaixei o triângulo.',
  'Tá vendo? Mantém a pegada na manga, quadril pra trás, e aí sim você raspa.',
  'Pegou as costas, coloca os ganchos, controla o braço e finaliza no mata-leão.',
];

const chave = process.env.ASSEMBLYAI_API_KEY;
if (!chave) throw new Error('ASSEMBLYAI_API_KEY ausente no .env da raiz');

const saida = path.join(process.cwd(), '..', 'relatorios', 'sondagem');
await mkdir(saida, { recursive: true });

let caracteres = 0;
for (const voz of VOZES) {
  for (const [i, texto] of FALAS.entries()) {
    const resposta = await fetch('https://tts.us.assemblyai.com/v1/speech', {
      method: 'POST',
      headers: { Authorization: chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: texto,
        voice_id: voz,
        language: 'portuguese',
        encoding: 'mp3',
        stream: false,
      }),
    });
    if (!resposta.ok) {
      throw new Error(`${voz} fala ${i + 1}: HTTP ${resposta.status} ${await resposta.text()}`);
    }
    const arquivo = path.join(saida, `${voz}-${i + 1}.mp3`);
    await writeFile(arquivo, Buffer.from(await resposta.arrayBuffer()));
    caracteres += texto.length;
    console.log(`ok ${arquivo}`);
  }
}
console.log(`${caracteres} caracteres sintetizados`);
