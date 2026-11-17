import { Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { writeFile, readFile, rm, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { EncaixeDaFala } from '../shared/types';

export interface FalaPosicionada {
  audio: Buffer; // mp3 da fala dublada
  encaixe: EncaixeDaFala;
}

const FADE_DO_CORTE = 0.08; // segundos

// Quanto da fala cortada toca (segundos, nunca negativo); null quando não é cortada.
function duracaoTocada(e: EncaixeDaFala): number | null {
  return e.acao === 'cortar' ? Math.max(0, e.fimDublado - e.inicioDublado) : null;
}

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  private async criarTempDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), 'dubla-'));
  }

  private async limparDir(dir: string): Promise<void> {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  async extrairAudio(videoBuffer: Buffer): Promise<Buffer> {
    this.logger.log(`Extraindo áudio de vídeo com ${videoBuffer.length} bytes`);
    const dir = await this.criarTempDir();
    const tempVideo = join(dir, 'input.mp4');
    await writeFile(tempVideo, videoBuffer);

    try {
      return await new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const passThrough = new PassThrough();

        passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
        passThrough.on('end', () => resolve(Buffer.concat(chunks)));

        ffmpeg(tempVideo)
          .noVideo()
          .audioCodec('libmp3lame')
          .format('mp3')
          .on('error', (err: Error) => reject(err))
          .pipe(passThrough);
      });
    } finally {
      await this.limparDir(dir);
    }
  }

  // Mixa o fundo com cada fala dublada no seu instante (R1, R8): atempo do encaixe,
  // corte com fade nas cortadas, adelay até o início. Vídeo copiado, duração = a do vídeo.
  async montarVideo(video: Buffer, fundo: Buffer, todas: FalaPosicionada[]): Promise<Buffer> {
    // Cortada sem tempo nenhum (a próxima fala começa junto) não tem o que tocar.
    const falas = todas.filter((f) => duracaoTocada(f.encaixe) !== 0);
    this.logger.log(`Montando vídeo com ${falas.length} falas`);
    const dir = await this.criarTempDir();
    const tempVideo = join(dir, 'input.mp4');
    const tempFundo = join(dir, 'fundo.wav');
    const tempSaida = join(dir, 'output.mp4');
    await writeFile(tempVideo, video);
    await writeFile(tempFundo, fundo);
    const arquivosDasFalas = await Promise.all(
      falas.map(async (f, i) => {
        const arquivo = join(dir, `fala-${i}.mp3`);
        await writeFile(arquivo, f.audio);
        return arquivo;
      }),
    );

    const filtros = falas.map(({ encaixe: e }, i) => {
      const etapas: string[] = [];
      if (e.atempo !== 1) etapas.push(`atempo=${e.atempo}`);
      const d = duracaoTocada(e);
      if (d !== null) {
        // Fade nunca maior que a própria fala: st negativo derruba o ffmpeg.
        const fade = Math.min(FADE_DO_CORTE, d);
        etapas.push(`atrim=end=${d}`, `afade=t=out:st=${d - fade}:d=${fade}`);
      }
      etapas.push(`adelay=${Math.round(e.inicioDublado * 1000)}:all=1`);
      return `[${i + 2}:a]${etapas.join(',')}[f${i}]`;
    });
    const entradasDoMix = ['[1:a]', ...falas.map((_, i) => `[f${i}]`)].join('');
    filtros.push(
      `${entradasDoMix}amix=inputs=${falas.length + 1}:normalize=0:duration=longest[mix]`,
    );

    try {
      const duracao = await this.duracao(tempVideo);
      await new Promise<void>((resolve, reject) => {
        const comando = ffmpeg(tempVideo).addInput(tempFundo);
        arquivosDasFalas.forEach((a) => comando.addInput(a));
        comando
          .complexFilter(filtros.join(';'))
          .outputOptions(['-map 0:v', '-map [mix]', '-c:v copy', '-c:a aac', `-t ${duracao}`, '-y'])
          .output(tempSaida)
          .on('error', (err: Error) => reject(err))
          .on('end', () => resolve())
          .run();
      });
      return await readFile(tempSaida);
    } finally {
      await this.limparDir(dir);
    }
  }

  // Tira o silêncio das pontas da voz gerada: a voz pronta devolve ~0,1–0,25 s antes
  // e ~0,5 s depois da fala, o que atrasa o início (R1) e infla a duração medida (R2).
  async apararSilencio(audio: Buffer): Promise<Buffer> {
    const dir = await this.criarTempDir();
    const entrada = join(dir, 'entrada.mp3');
    const saida = join(dir, 'saida.mp3');
    await writeFile(entrada, audio);
    const tirarDoComeco = 'silenceremove=start_periods=1:start_threshold=-40dB';
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(entrada)
          .audioFilters([tirarDoComeco, 'areverse', tirarDoComeco, 'areverse'])
          .audioCodec('libmp3lame')
          .output(saida)
          .on('error', (err: Error) => reject(err))
          .on('end', () => resolve())
          .run();
      });
      return await readFile(saida);
    } finally {
      await this.limparDir(dir);
    }
  }

  // Duração em segundos de um áudio ou vídeo em memória.
  async medirDuracao(midia: Buffer): Promise<number> {
    const dir = await this.criarTempDir();
    const arquivo = join(dir, 'midia');
    await writeFile(arquivo, midia);
    try {
      return await this.duracao(arquivo);
    } finally {
      await this.limparDir(dir);
    }
  }

  private duracao(arquivo: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(arquivo, (err, dados) => {
        if (err) return reject(err as Error);
        const segundos = dados.format.duration;
        if (!segundos) return reject(new Error(`ffprobe sem duração para ${arquivo}`));
        resolve(segundos);
      });
    });
  }
}
