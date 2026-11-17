import { Module } from '@nestjs/common';
import { TraducaoService } from './traducao.service';
import { JuizService } from './juiz.service';

@Module({
  providers: [TraducaoService, JuizService],
  exports: [TraducaoService, JuizService],
})
export class TraducaoModule {}
