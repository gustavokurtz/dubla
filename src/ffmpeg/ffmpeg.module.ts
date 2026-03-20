import { Module } from '@nestjs/common';
import { FfmpegService } from './ffmpeg.service';
import { FfmpegController } from './ffmpeg.controller';

@Module({
  controllers: [FfmpegController],
  providers: [FfmpegService],
})
export class FfmpegModule {}
