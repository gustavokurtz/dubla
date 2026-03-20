import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { FfmpegModule } from '../ffmpeg/ffmpeg.module';
import { OpenaiModule } from '../openai/openai.module';
import { ElevenlabsModule } from '../elevenlabs/elevenlabs.module';

@Module({
  imports: [FfmpegModule, OpenaiModule, ElevenlabsModule],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
