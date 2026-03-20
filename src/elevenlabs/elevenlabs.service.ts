import { Injectable, Logger } from '@nestjs/common';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { ConfigService } from '@nestjs/config';
import { Segmento, SegmentoComAudio } from '../shared/types';

@Injectable()
export class ElevenlabsService {
  private readonly logger = new Logger(ElevenlabsService.name);
  private elevenLabs: ElevenLabsClient;

  constructor(private config: ConfigService) {
    this.elevenLabs = new ElevenLabsClient({
      apiKey: this.config.get<string>('ELEVENLABS_API_KEY'),
    });
  }

  async gerarAudioSegmentos(segmentos: Segmento[]): Promise<SegmentoComAudio[]> {
    const resultado: SegmentoComAudio[] = [];

    for (let i = 0; i < segmentos.length; i++) {
      const seg = segmentos[i];
      this.logger.log(
        `[${i + 1}/${segmentos.length}] start=${seg.start}s end=${seg.end}s chars=${seg.texto.length} texto="${seg.texto.slice(0, 80)}..."`,
      );

      try {
        const audio = await this.elevenLabs.textToSpeech.convert(
          'JBFqnCBsd6RMkjVDRZzb', // George
          {
            text: seg.texto,
            modelId: 'eleven_multilingual_v2',
            outputFormat: 'mp3_44100_128',
          },
        );

        const chunks: Buffer[] = [];
        for await (const chunk of audio) {
          chunks.push(Buffer.from(chunk));
        }

        const buffer = Buffer.concat(chunks);
        this.logger.log(`[${i + 1}/${segmentos.length}] OK — ${buffer.length} bytes`);

        resultado.push({ ...seg, audio: buffer });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${i + 1}/${segmentos.length}] FALHOU — ${message}`);
        throw err;
      }
    }

    return resultado;
  }
}
