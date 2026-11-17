import { Injectable, Logger } from '@nestjs/common';
import ffmpeg = require('fluent-ffmpeg');
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

        passThrough.on('data', (chunk) => chunks.push(chunk));
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
  async montarVideo(video: Buffer, fundo: Buffer, falas: FalaPosicionada[]): Promise<Buffer> {
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
      if (e.acao === 'cortar') {
        const d = e.fimDublado - e.inicioDublado;
        etapas.push(`atrim=end=${d}`, `afade=t=out:st=${d - FADE_DO_CORTE}:d=${FADE_DO_CORTE}`);
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
