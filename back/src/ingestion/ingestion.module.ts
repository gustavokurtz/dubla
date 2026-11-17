import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { FfmpegModule } from '../ffmpeg/ffmpeg.module';
import { SeparacaoModule } from '../separacao/separacao.module';
import { TranscricaoModule } from '../transcricao/transcricao.module';
import { TraducaoModule } from '../traducao/traducao.module';
import { VozModule } from '../voz/voz.module';
import { YoutubeModule } from '../youtube/youtube.module';

@Module({
  imports: [
    FfmpegModule,
    SeparacaoModule,
    TranscricaoModule,
    TraducaoModule,
    VozModule,
    YoutubeModule,
  ],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
