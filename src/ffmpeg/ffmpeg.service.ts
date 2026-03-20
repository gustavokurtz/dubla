import { Injectable, Logger } from '@nestjs/common';
import ffmpeg = require('fluent-ffmpeg');
import { PassThrough } from 'stream';
import { writeFile, readFile, rm, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

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

  async substituirAudio(videoBuffer: Buffer, novoAudioBuffer: Buffer): Promise<Buffer> {
    this.logger.log(`Substituindo áudio: vídeo=${videoBuffer.length} bytes, áudio=${novoAudioBuffer.length} bytes`);
    const dir = await this.criarTempDir();
    const tempVideo = join(dir, 'input.mp4');
    const tempAudio = join(dir, 'audio.mp3');
    const tempSaida = join(dir, 'output.mp4');
    await writeFile(tempVideo, videoBuffer);
    await writeFile(tempAudio, novoAudioBuffer);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideo)
          .addInput(tempAudio)
          .outputOptions(['-map 0:v', '-map 1:a', '-c:v copy', '-shortest', '-y'])
          .output(tempSaida)
          .on('error', (err: Error) => {
            this.logger.error(`FFmpeg erro: ${err.message}`);
            reject(err);
          })
          .on('end', () => {
            this.logger.log('FFmpeg merge concluído');
            resolve();
          })
          .run();
      });

      const resultado = await readFile(tempSaida);
      this.logger.log(`Vídeo final: ${resultado.length} bytes`);
      return resultado;
    } finally {
      await this.limparDir(dir);
    }
  }
}
