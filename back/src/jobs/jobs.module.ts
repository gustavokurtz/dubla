import { join } from 'path';
import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module';
import { JobsService, PASTA_DUBLADOS } from './jobs.service';

@Module({
  imports: [IngestionModule],
  providers: [
    JobsService,
    { provide: PASTA_DUBLADOS, useValue: join(process.cwd(), '..', 'dublados') },
  ],
  exports: [JobsService],
})
export class JobsModule {}
