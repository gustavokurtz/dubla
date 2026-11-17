import { Module } from '@nestjs/common';
import { TraducaoService } from './traducao.service';

@Module({
  providers: [TraducaoService],
  exports: [TraducaoService],
})
export class TraducaoModule {}
