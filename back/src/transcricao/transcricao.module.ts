import { Module } from '@nestjs/common';
import { TranscricaoService } from './transcricao.service';

@Module({
  providers: [TranscricaoService],
  exports: [TranscricaoService],
})
export class TranscricaoModule {}
