import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Sse,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream, existsSync } from 'fs';
import { Observable } from 'rxjs';
import { JobsRepositorio } from './jobs.repositorio';
import { Job, JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly repositorio: JobsRepositorio,
  ) {}

  // Põe o vídeo na fila e responde na hora com o id (R4).
  @Post()
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('video/')) {
          cb(
            new HttpException('Apenas arquivos de vídeo são aceitos', HttpStatus.BAD_REQUEST),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  criar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('url') url: string | undefined,
  ): { id: string } {
    // Link do YouTube tem preferência; sem link, o arquivo enviado.
    if (url) return { id: this.jobs.criar({ url }) };
    if (file) {
      const nome = file.originalname.replace(/\.[^.]+$/, '');
      return { id: this.jobs.criar({ video: file.buffer, nome }) };
    }
    throw new HttpException('Envie um vídeo ou um link do YouTube', HttpStatus.BAD_REQUEST);
  }

  // Histórico gravado no banco, do mais recente para o mais antigo (R7).
  @Get()
  listar() {
    return this.repositorio.listar();
  }

  @Get(':id')
  async obter(@Param('id') id: string) {
    return this.estado(await this.existente(id));
  }

  // O estado inteiro a cada mudança; fecha quando a dublagem termina (R5).
  @Sse(':id/eventos')
  // Só para a dublagem viva, que está na memória deste processo.
  eventos(@Param('id') id: string): Observable<MessageEvent> {
    const job = this.jobs.obter(id);
    if (!job) throw new NotFoundException(`Dublagem ${id} não existe`);
    return new Observable<MessageEvent>((assinante) => {
      const enviar = () => {
        assinante.next({ data: this.estado(job) });
        if (job.situacao === 'pronto' || job.situacao === 'falhou') assinante.complete();
      };
      const cancelarTrace = job.trace.assinar(enviar);
      const cancelarJobs = this.jobs.assinar(enviar);
      enviar();
      return () => {
        cancelarTrace();
        cancelarJobs();
      };
    });
  }

  @Get(':id/video')
  async video(@Param('id') id: string): Promise<StreamableFile> {
    const job = await this.existente(id);
    if (job.situacao !== 'pronto' || !job.arquivo) {
      throw new ConflictException('O vídeo ainda não está pronto');
    }
    if (!existsSync(job.arquivo)) {
      throw new NotFoundException('O vídeo dublado não está mais na pasta dublados/');
    }
    return new StreamableFile(createReadStream(job.arquivo), {
      type: 'video/mp4',
      disposition: `attachment; filename="${job.nome.replace(/[^\w .-]+/g, '-')}-dublado.mp4"`,
    });
  }

  // A dublagem viva vem da memória; a antiga, do banco (R8).
  private async existente(id: string): Promise<Job> {
    const job = this.jobs.obter(id) ?? (await this.repositorio.carregar(id));
    if (!job) throw new NotFoundException(`Dublagem ${id} não existe`);
    return job;
  }

  private estado(job: Job) {
    const { trace } = job;
    return {
      id: job.id,
      nome: job.nome,
      situacao: job.situacao,
      posicao: this.jobs.posicao(job.id),
      criadoEm: job.criadoEm,
      iniciadoEm: job.iniciadoEm,
      terminadoEm: job.terminadoEm,
      erro: job.erro,
      etapaDoErro: job.etapaDoErro,
      custo: trace.custoTotal(),
      etapas: trace.etapas.map((e, i) => ({ ...e, custo: trace.custoDaEtapa(i) })),
      chamadas: trace.chamadas,
    };
  }
}
