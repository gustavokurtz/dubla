import { Module } from '@nestjs/common';
import { SeparacaoService } from './separacao.service';

@Module({
  providers: [SeparacaoService],
  exports: [SeparacaoService],
})
export class SeparacaoModule {}
