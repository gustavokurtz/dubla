import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssemblyAI } from 'assemblyai';
import { Fala } from '../shared/types';
import { TERMOS_RECONHECIMENTO } from '../traducao/guia-bjj';
import { cortarEmFalas } from './cortar-em-falas';

@Injectable()
export class TranscricaoService {
  private readonly logger = new Logger(TranscricaoService.name);
  private readonly cliente: AssemblyAI;

  constructor(config: ConfigService) {
    this.cliente = new AssemblyAI({ apiKey: config.getOrThrow<string>('ASSEMBLYAI_API_KEY') });
  }

  // Transcreve o áudio em inglês sabendo quem fala e corta em falas com tempo.
  async transcrever(audio: Buffer): Promise<Fala[]> {
    this.logger.log(`Transcrevendo ${audio.length} bytes`);
    const transcricao = await this.cliente.transcripts.transcribe({
      audio,
      speaker_labels: true,
      language_code: 'en',
      keyterms_prompt: TERMOS_RECONHECIMENTO,
    });
    if (transcricao.status === 'error') {
      throw new Error(`Transcrição falhou na AssemblyAI: ${transcricao.error}`);
    }
    const falas = cortarEmFalas(transcricao.words ?? []);
    this.logger.log(
      `${falas.length} falas de ${new Set(falas.map((f) => f.pessoa)).size} pessoa(s)`,
    );
    return falas;
  }
}
