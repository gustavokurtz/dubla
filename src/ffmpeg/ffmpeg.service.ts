import { Injectable } from '@nestjs/common';
import ffmpeg = require('fluent-ffmpeg');
import { PassThrough } from 'stream';
import { writeFile, readFile, rm, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

@Injectable()
export class FfmpegService {
  private async criarTemp(buffer: Buffer, extensao: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'dubla-'));
    const caminho = join(dir, `temp${extensao}`);
    await writeFile(caminho, buffer);
    return caminho;
  }

  private async limparTemp(caminho: string): Promise<void> {
    const dir = join(caminho, '..');
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  async extrairAudio(videoBuffer: Buffer): Promise<Buffer> {
    const tempVideo = await this.criarTemp(videoBuffer, '.mp4');

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
      await this.limparTemp(tempVideo);
    }
  }

  async substituirAudio(videoBuffer: Buffer, novoAudioBuffer: Buffer): Promise<Buffer> {
    const tempVideo = await this.criarTemp(videoBuffer, '.mp4');
    const tempAudio = await this.criarTemp(novoAudioBuffer, '.mp3');
    const tempSaida = await this.criarTemp(Buffer.alloc(0), '.mp4');

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideo)
          .addInput(tempAudio)
          .outputOptions(['-map 0:v', '-map 1:a', '-c:v copy', '-y'])
          .output(tempSaida)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      return await readFile(tempSaida);
    } finally {
      await Promise.all([
        this.limparTemp(tempVideo),
        this.limparTemp(tempAudio),
        this.limparTemp(tempSaida),
      ]);
    }
  }
}
