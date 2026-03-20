import { Injectable, Logger } from '@nestjs/common';
import { FfmpegService } from '../ffmpeg/ffmpeg.service';
import { OpenaiService } from '../openai/openai.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private ffmpeg: FfmpegService,
    private openai: OpenaiService,
  ) {}

  async orchestratePipelineVideo(buffer: Buffer): Promise<Buffer> {
    this.logger.log('Iniciando pipeline de dublagem...');

    this.logger.log('1/5 Extraindo áudio do vídeo...');
    const audioBuffer = await this.ffmpeg.extrairAudio(buffer);

    this.logger.log('2/5 Transcrevendo áudio com Whisper...');
    const transcricao = await this.openai.transcreverAudio(audioBuffer);

    if (!transcricao) {
      throw new Error('Whisper não retornou transcrição');
    }

    this.logger.log('3/5 Traduzindo texto para PT-BR...');
    const traducao = await this.openai.traduzirTexto(transcricao);

    if (!traducao) {
      throw new Error('GPT não retornou tradução');
    }

    this.logger.log('4/5 Gerando voz com OpenAI TTS...');
    const novaVoz = await this.openai.gerarVoz(traducao);

    this.logger.log('5/5 Substituindo áudio no vídeo...');
    const videoFinal = await this.ffmpeg.substituirAudio(buffer, novaVoz);

    this.logger.log('Pipeline concluído!');
    return videoFinal;
  }
}
