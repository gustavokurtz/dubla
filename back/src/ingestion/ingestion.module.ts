import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { FfmpegModule } from '../ffmpeg/ffmpeg.module';
import { SeparacaoModule } from '../separacao/separacao.module';
import { TranscricaoModule } from '../transcricao/transcricao.module';
import { TraducaoModule } from '../traducao/traducao.module';
import { VozModule } from '../voz/voz.module';

@Module({
  imports: [FfmpegModule, SeparacaoModule, TranscricaoModule, TraducaoModule, VozModule],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
