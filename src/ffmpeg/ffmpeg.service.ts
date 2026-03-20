import { Injectable, Logger } from '@nestjs/common';
import ffmpeg = require('fluent-ffmpeg');
import { PassThrough } from 'stream';
import { writeFile, readFile, rm, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { SegmentoComAudio } from '../shared/types';

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

  async montarTrilhaSincronizada(
    videoBuffer: Buffer,
    segmentos: SegmentoComAudio[],
  ): Promise<Buffer> {
    const dir = await this.criarTempDir();
    const tempVideo = join(dir, 'input.mp4');
    const tempSaida = join(dir, 'output.mp4');
    await writeFile(tempVideo, videoBuffer);

    // Salva cada segmento de áudio como arquivo
    const segPaths: string[] = [];
    for (let i = 0; i < segmentos.length; i++) {
      const path = join(dir, `seg_${i}.mp3`);
      await writeFile(path, segmentos[i].audio);
      segPaths.push(path);
    }

    try {
      // Monta o filtro complexo:
      // Cada segmento é atrasado (adelay) pro timestamp correto
      // Depois todos são mixados numa trilha só
      const inputs: string[] = [];
      const filterParts: string[] = [];

      segPaths.forEach((_, i) => {
        const delayMs = Math.round(segmentos[i].start * 1000);
        inputs.push('-i', segPaths[i]);
        filterParts.push(`[${i + 1}:a]adelay=${delayMs}|${delayMs}[a${i}]`);
      });

      const mixInputs = segmentos.map((_, i) => `[a${i}]`).join('');
      const filterComplex = [
        ...filterParts,
        `${mixInputs}amix=inputs=${segmentos.length}:normalize=0[aout]`,
      ].join(';');

      await new Promise<void>((resolve, reject) => {
        const cmd = ffmpeg(tempVideo);

        segPaths.forEach((p) => cmd.addInput(p));

        cmd
          .complexFilter(filterComplex, 'aout')
          .outputOptions(['-map', '0:v', '-c:v', 'copy', '-y'])
          .output(tempSaida)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      return await readFile(tempSaida);
    } finally {
      await this.limparDir(dir);
    }
  }
}
