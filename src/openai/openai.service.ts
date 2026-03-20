import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY') });
  }

  async transcreverAudio(audioBuffer: Buffer): Promise<string> {
    this.logger.log(`Enviando ${audioBuffer.length} bytes pro Whisper`);

    const transcricao = await this.openai.audio.transcriptions.create({
      file: await toFile(audioBuffer, 'audio.mp3'),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    this.logger.log(`Whisper transcreveu: ${transcricao.text.length} chars`);
    return transcricao.text;
  }

  async traduzirTexto(textoOriginal: string): Promise<string> {
    this.logger.log(`Traduzindo ${textoOriginal.length} chars`);

    const resposta = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um tradutor profissional. Traduza o texto de inglês para português brasileiro.
Não traduza ao pé da letra — adapte expressões idiomáticas e mantenha o tom natural,
como se a pessoa estivesse falando em português. Preserve o significado mas soe fluido.
Retorne APENAS o texto traduzido, sem explicações.`,
        },
        {
          role: 'user',
          content: textoOriginal,
        },
      ],
    });

    const traducao = resposta.choices[0].message.content ?? '';
    this.logger.log(`GPT traduziu: ${traducao.length} chars — tokens: ${resposta.usage?.total_tokens}`);
    return traducao;
  }

  async gerarVoz(texto: string): Promise<Buffer> {
    this.logger.log(`TTS: gerando áudio para ${texto.length} chars`);

    const response = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: texto,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    this.logger.log(`TTS: OK — ${buffer.length} bytes`);
    return buffer;
  }
}
