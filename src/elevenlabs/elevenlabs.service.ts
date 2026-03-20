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
      this.logger.log(`Gerando áudio segmento ${i + 1}/${segmentos.length}`);

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

      resultado.push({
        ...seg,
        audio: Buffer.concat(chunks),
      });
    }

    return resultado;
  }
}
