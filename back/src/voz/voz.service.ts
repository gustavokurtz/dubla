import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Fala } from '../shared/types';
import { atribuirVozes } from './atribuir-vozes';

// Vozes prontas PT da AssemblyAI escolhidas pelo dev (T1): quem mais fala primeiro.
export const VOZES_PT = ['aai-cassio', 'aai-benicio'];

const URL_FALA = 'https://tts.us.assemblyai.com/v1/speech';

export interface AudioDaFala {
  id: number;
  voz: string;
  audio: Buffer; // mp3
}

@Injectable()
export class VozService {
  private readonly logger = new Logger(VozService.name);
  private readonly chave: string;

  constructor(config: ConfigService) {
    this.chave = config.getOrThrow<string>('ASSEMBLYAI_API_KEY');
  }

  // Gera o áudio de cada fala com a voz fixa da pessoa que a disse.
  async gerarAudios(falas: (Fala & { textoPt: string })[]): Promise<AudioDaFala[]> {
    const vozes = atribuirVozes(falas, VOZES_PT);
    this.logger.log(`Gerando voz de ${falas.length} falas: ${JSON.stringify(vozes)}`);
    const audios: AudioDaFala[] = [];
    for (const f of falas) {
      const voz = vozes[f.pessoa].voz;
      audios.push({ id: f.id, voz, audio: await this.sintetizar(f.id, f.textoPt, voz) });
    }
    return audios;
  }

  // Uma fala em mp3. Pública porque o encaixe regera a fala depois de encurtar.
  async sintetizar(id: number, texto: string, voz: string): Promise<Buffer> {
    const resposta = await fetch(URL_FALA, {
      method: 'POST',
      headers: { Authorization: this.chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: texto,
        voice_id: voz,
        language: 'portuguese',
        encoding: 'mp3',
        stream: false,
      }),
    });
    if (!resposta.ok) {
      throw new Error(`Voz da fala ${id} falhou: HTTP ${resposta.status} ${await resposta.text()}`);
    }
    return Buffer.from(await resposta.arrayBuffer());
  }
}
