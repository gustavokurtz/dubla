import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { executar, pythonDasFerramentas } from '../shared/ferramentas-python';

const HOSTS_YOUTUBE = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  constructor(private readonly config: ConfigService) {}

  async baixar(url: string): Promise<{ video: Buffer; titulo: string }> {
    this.validarLink(url);
    const python = pythonDasFerramentas(this.config);
    const dir = await mkdtemp(join(tmpdir(), 'dubla-yt-'));

    try {
      this.logger.log(`Baixando do YouTube: ${url}`);
      const stdout = await executar('yt-dlp', python, [
        '-m',
        'yt_dlp',
        '-f',
        'bv*[height<=720][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=720]+ba/b',
        '--merge-output-format',
        'mp4',
        '--no-playlist',
        '--print',
        'after_move:title',
        '-o',
        join(dir, 'video.%(ext)s'),
        url,
      ]);
      const video = await readFile(join(dir, 'video.mp4'));
      const titulo = stdout.trim();
      this.logger.log(`Baixado "${titulo}": ${video.length} bytes`);
      return { video, titulo };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private validarLink(url: string): void {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      throw new BadRequestException(`Link do YouTube inválido: ${url}`);
    }
    if (!HOSTS_YOUTUBE.includes(host)) {
      throw new BadRequestException(`Link do YouTube inválido: ${url}`);
    }
  }
}
