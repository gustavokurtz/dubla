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
    const chunks = this.splitText(texto, 4000);
    this.logger.log(`TTS: ${texto.length} chars → ${chunks.length} parte(s)`);

    const audioBuffers: Buffer[] = [];
    for (let i = 0; i < chunks.length; i++) {
      this.logger.log(`TTS [${i + 1}/${chunks.length}]: ${chunks[i].length} chars`);

      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input: chunks[i],
        response_format: 'mp3',
      });

      audioBuffers.push(Buffer.from(await response.arrayBuffer()));
    }

    const resultado = Buffer.concat(audioBuffers);
    this.logger.log(`TTS: OK — ${resultado.length} bytes total`);
    return resultado;
  }

  private splitText(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      let cutIndex = remaining.lastIndexOf('. ', maxLength);
      if (cutIndex === -1) cutIndex = remaining.lastIndexOf('? ', maxLength);
      if (cutIndex === -1) cutIndex = remaining.lastIndexOf('! ', maxLength);
      if (cutIndex === -1) cutIndex = maxLength;

      chunks.push(remaining.slice(0, cutIndex + 1).trim());
      remaining = remaining.slice(cutIndex + 1).trim();
    }

    return chunks;
  }
}
