// Services pagos simulados para os ensaios sem custo (ensaio-sem-custo.ts e servidor-ensaio.ts).
// Transcrição: palavras de uma transcrição já salva na AssemblyAI (leitura sem custo).
// Tradução: português de um relatório anterior. Juiz: aprova tudo. Encurtar: corta o
// texto no alvo e conta as chamadas. Voz: tom com a duração da voz Cássio (13,2 chars/s
// + 0,2 s de silêncio antes e 0,5 s depois); só o `sintetizar` é trocado, então a
// atribuição de vozes e a contagem de falas no trace são as reais.
import { ConfigService } from '@nestjs/config';
import { AssemblyAI } from 'assemblyai';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { cortarEmFalas } from '../src/transcricao/cortar-em-falas';
import { Fala, FalaTraduzida } from '../src/shared/types';
import { Relatorio } from '../src/relatorio/relatorio';
import { TranscricaoService } from '../src/transcricao/transcricao.service';
import { TraducaoService } from '../src/traducao/traducao.service';
import { JuizService } from '../src/traducao/juiz.service';
import { VozService } from '../src/voz/voz.service';

const CHARS_POR_SEGUNDO_DA_VOZ = 13.2;

export async function servicosSimulados(
  config: ConfigService,
  idTranscricao: string,
  relatorioAnterior: string,
) {
  const tmp = mkdtempSync(join(tmpdir(), 'dubla-ensaio-'));

  const transcricao = await new AssemblyAI({
    apiKey: config.getOrThrow<string>('ASSEMBLYAI_API_KEY'),
  }).transcripts.get(idTranscricao);
  const anterior = JSON.parse(readFileSync(relatorioAnterior, 'utf8')) as Relatorio;

  // Português da fala nova = português das falas antigas que caem dentro dela.
  const traduzir = (falas: Fala[]): FalaTraduzida[] =>
    falas.map((f) => ({
      ...f,
      textoEnCorrigido: f.textoEn,
      textoPt:
        anterior.falas
          .filter((a) => a.inicio >= f.inicio - 0.05 && a.inicio < f.fim)
          .map((a) => a.textoPt)
          .join(' ') || f.textoEn,
    }));

  const vozSimulada = (texto: string) => {
    const segundos = (texto.length / CHARS_POR_SEGUNDO_DA_VOZ).toFixed(3);
    const arquivo = join(tmp, 'voz.mp3');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=300:duration=${segundos}`,
      '-af',
      'adelay=200:all=1,apad=pad_dur=0.5',
      arquivo,
    ]);
    return readFileSync(arquivo);
  };

  let encurtamentos = 0;
  const voz = new VozService(config);
  voz.sintetizar = (_id: number, texto: string) => Promise.resolve(vozSimulada(texto));

  return {
    transcricao: {
      transcrever: () => Promise.resolve(cortarEmFalas(transcricao.words ?? [])),
    } as unknown as TranscricaoService,
    traducao: {
      traduzir: (falas: Fala[]) => Promise.resolve(traduzir(falas)),
      refazer: () => Promise.reject(new Error('juiz simulado não reprova')),
      encurtar: (f: FalaTraduzida, alvo: number) => {
        encurtamentos++;
        return Promise.resolve(f.textoPt.slice(0, alvo));
      },
    } as unknown as TraducaoService,
    juiz: {
      avaliar: (falas: FalaTraduzida[]) =>
        Promise.resolve(falas.map((f) => ({ id: f.id, aprovado: true, motivo: '' }))),
    } as unknown as JuizService,
    voz,
    encurtamentos: () => encurtamentos,
    limpar: () => rmSync(tmp, { recursive: true, force: true }),
  };
}
