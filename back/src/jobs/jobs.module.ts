import { join } from 'path';
import { Module } from '@nestjs/common';
import { PrismaService } from '../banco/prisma.service';
import { IngestionModule } from '../ingestion/ingestion.module';
import { JobsRepositorio } from './jobs.repositorio';
import { JobsService, PASTA_DUBLADOS } from './jobs.service';
import { JobsController } from './jobs.controller';

@Module({
  imports: [IngestionModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobsRepositorio,
    PrismaService,
    { provide: PASTA_DUBLADOS, useValue: join(process.cwd(), '..', 'dublados') },
  ],
  exports: [JobsService],
})
export class JobsModule {}
