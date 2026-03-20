import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import { Segmento } from '../shared/types';

@Injectable()
export class OpenaiService {
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY') });
  }

  async transcreverAudio(audioBuffer: Buffer): Promise<Segmento[]> {
    const transcricao = await this.openai.audio.transcriptions.create({
      file: await toFile(audioBuffer, 'audio.mp3'),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    const segments = (transcricao as any).segments ?? [];

    return segments.map((seg: any) => ({
      start: seg.start,
      end: seg.end,
      texto: seg.text.trim(),
    }));
  }

  async traduzirSegmentos(segmentos: Segmento[]): Promise<Segmento[]> {
    const textoCompleto = segmentos.map((s, i) => `[${i}] ${s.texto}`).join('\n');

    const resposta = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um tradutor profissional. Traduza cada linha de inglês para português brasileiro.
Não traduza ao pé da letra — adapte expressões idiomáticas e mantenha o tom natural.
Mantenha o formato [número] texto traduzido. Retorne APENAS as linhas traduzidas.`,
        },
        {
          role: 'user',
          content: textoCompleto,
        },
      ],
    });

    const linhas = (resposta.choices[0].message.content ?? '').split('\n').filter((l) => l.trim());

    return segmentos.map((seg, i) => {
      const linha = linhas[i] ?? '';
      const textoTraduzido = linha.replace(/^\[\d+\]\s*/, '').trim();
      return {
        start: seg.start,
        end: seg.end,
        texto: textoTraduzido || seg.texto,
      };
    });
  }
}
