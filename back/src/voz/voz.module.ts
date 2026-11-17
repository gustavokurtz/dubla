import { Module } from '@nestjs/common';
import { VozService } from './voz.service';

@Module({
  providers: [VozService],
  exports: [VozService],
})
export class VozModule {}
