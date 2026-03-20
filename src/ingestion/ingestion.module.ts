import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { FfmpegModule } from '../ffmpeg/ffmpeg.module';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  imports: [FfmpegModule, OpenaiModule],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
