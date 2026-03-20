import { Injectable, Logger } from '@nestjs/common';
import { ElevenlabsService } from '../elevenlabs/elevenlabs.service';
import { FfmpegService } from '../ffmpeg/ffmpeg.service';
import { OpenaiService } from '../openai/openai.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private ffmpeg: FfmpegService,
    private openai: OpenaiService,
    private elevenlabs: ElevenlabsService,
  ) {}

  async orchestratePipelineVideo(buffer: Buffer): Promise<Buffer> {
    this.logger.log('Iniciando pipeline de dublagem...');

    this.logger.log('1/5 Extraindo áudio do vídeo...');
    const audioBuffer = await this.ffmpeg.extrairAudio(buffer);

    this.logger.log('2/5 Transcrevendo áudio com Whisper (segmentos)...');
    const segmentos = await this.openai.transcreverAudio(audioBuffer);

    if (!segmentos.length) {
      throw new Error('Whisper não retornou segmentos');
    }
    this.logger.log(`${segmentos.length} segmentos encontrados`);

    this.logger.log('3/5 Traduzindo segmentos para PT-BR...');
    const segmentosTraduzidos = await this.openai.traduzirSegmentos(segmentos);

    this.logger.log('4/5 Gerando voz com ElevenLabs por segmento...');
    const segmentosComAudio = await this.elevenlabs.gerarAudioSegmentos(segmentosTraduzidos);

    this.logger.log('5/5 Montando trilha sincronizada no vídeo...');
    const videoFinal = await this.ffmpeg.montarTrilhaSincronizada(buffer, segmentosComAudio);

    this.logger.log('Pipeline concluído!');
    return videoFinal;
  }
}
