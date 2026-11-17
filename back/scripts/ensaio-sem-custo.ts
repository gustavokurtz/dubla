// Ensaio da pipeline inteira sem nada pago, antes de uma rodada real.
// Reais: ffmpeg, Demucs, corte em falas, encaixe, montagem, relatório.
// Simulados: transcrição (palavras de uma transcrição já salva na AssemblyAI,
// leitura sem custo), tradução (português de um relatório anterior), juiz
// (aprova tudo), voz (tom com a duração da voz Cássio: 13,2 chars/s + 0,2 s de
// silêncio antes e 0,5 s depois) e encurtar (corta o texto no alvo; conta as chamadas).
// Uso (em back/): node --env-file=../.env -r ts-node/register scripts/ensaio-sem-custo.ts \
//   <video.mp4> <id-da-transcricao> <relatorio-anterior.json>
import { ConfigService } from '@nestjs/config';
import { AssemblyAI } from 'assemblyai';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { FfmpegService } from '../src/ffmpeg/ffmpeg.service';
import { SeparacaoService } from '../src/separacao/separacao.service';
import { IngestionService } from '../src/ingestion/ingestion.service';
import { cortarEmFalas } from '../src/transcricao/cortar-em-falas';
import { Fala, FalaTraduzida } from '../src/shared/types';
import { Relatorio } from '../src/relatorio/relatorio';
import { TranscricaoService } from '../src/transcricao/transcricao.service';
import { TraducaoService } from '../src/traducao/traducao.service';
import { JuizService } from '../src/traducao/juiz.service';
import { VozService } from '../src/voz/voz.service';
import { YoutubeService } from '../src/youtube/youtube.service';

const CHARS_POR_SEGUNDO_DA_VOZ = 13.2;

async function main() {
  const [caminho, idTranscricao, relatorioAnterior] = process.argv.slice(2);
  if (!relatorioAnterior) {
    throw new Error('Uso: ensaio-sem-custo.ts <video.mp4> <id-da-transcricao> <relatorio.json>');
  }
  const config = new ConfigService();
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
  const service = new IngestionService(
    new FfmpegService(),
    new SeparacaoService(config),
    {
      transcrever: () => Promise.resolve(cortarEmFalas(transcricao.words ?? [])),
    } as unknown as TranscricaoService,
    {
      traduzir: (falas: Fala[]) => Promise.resolve(traduzir(falas)),
      refazer: () => Promise.reject(new Error('juiz simulado não reprova')),
      encurtar: (f: FalaTraduzida, alvo: number) => {
        encurtamentos++;
        return Promise.resolve(f.textoPt.slice(0, alvo));
      },
    } as unknown as TraducaoService,
    {
      avaliar: (falas: FalaTraduzida[]) =>
        Promise.resolve(falas.map((f) => ({ id: f.id, aprovado: true, motivo: '' }))),
    } as unknown as JuizService,
    {
      gerarAudios: (falas: FalaTraduzida[]) =>
        Promise.resolve(
          falas.map((f) => ({ id: f.id, voz: 'simulada', audio: vozSimulada(f.textoPt) })),
        ),
      sintetizar: (_id: number, texto: string) => Promise.resolve(vozSimulada(texto)),
    } as unknown as VozService,
    {} as YoutubeService,
  );

  const nome = `ensaio-${basename(caminho, extname(caminho))}`;
  const inicio = Date.now();
  const video = await service.dublar(readFileSync(caminho), nome);
  const saida = join(process.cwd(), '..', 'videos', `${nome}.mp4`);
  writeFileSync(saida, video);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`Vídeo do ensaio: ${saida}`);
  console.log(`Chamadas de encurtar que a rodada real faria: ${encurtamentos}`);
  console.log(`Tempo: ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.stack : erro);
  process.exit(1);
});
