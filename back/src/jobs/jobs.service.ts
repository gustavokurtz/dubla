import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { IngestionService } from '../ingestion/ingestion.service';
import { rodarNoTrace, Trace } from '../trace/trace';
import { JobsRepositorio } from './jobs.repositorio';

export const PASTA_DUBLADOS = 'PASTA_DUBLADOS';

export type Entrada = { video: Buffer; nome: string } | { url: string };

export type Situacao = 'na fila' | 'dublando' | 'pronto' | 'falhou';

export interface Job {
  id: string;
  nome: string;
  origem: 'arquivo' | 'link';
  situacao: Situacao;
  trace: Trace;
  criadoEm: Date;
  iniciadoEm?: Date;
  terminadoEm?: Date;
  erro?: string;
  etapaDoErro?: string;
  arquivo?: string; // MP4 dublado
}

// Fila em memória: um vídeo dublando por vez, por causa do limite de vozes por minuto da conta (R4).
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly jobs = new Map<string, Job>();
  private readonly fila: { id: string; entrada: Entrada }[] = [];
  private rodando = false;
  private readonly ouvintes = new Set<() => void>();

  constructor(
    private readonly ingestao: IngestionService,
    private readonly repositorio: JobsRepositorio,
    @Inject(PASTA_DUBLADOS) private readonly pasta: string,
  ) {}

  criar(entrada: Entrada): string {
    const id = randomUUID();
    const link = 'url' in entrada;
    const job: Job = {
      id,
      nome: link ? entrada.url : entrada.nome,
      origem: link ? 'link' : 'arquivo',
      situacao: 'na fila',
      trace: new Trace(),
      criadoEm: new Date(),
    };
    this.jobs.set(id, job);
    // Cada etapa, fala e chamada do trace vai para o banco (R8).
    job.trace.assinar(() => this.repositorio.agendar(job));
    this.fila.push({ id, entrada });
    this.mudou(job);
    void this.processar();
    return id;
  }

  obter(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  // Quantos vídeos estão antes deste; 0 = dublando agora ou o próximo a começar.
  posicao(id: string): number | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    if (job.situacao !== 'na fila') return 0;
    return this.fila.findIndex((f) => f.id === id) + (this.rodando ? 1 : 0);
  }

  // Avisa a cada mudança de situação de qualquer job (ela muda a posição dos outros na fila).
  assinar(ouvinte: () => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  private mudou(job: Job): void {
    this.repositorio.agendar(job);
    for (const ouvinte of this.ouvintes) ouvinte();
  }

  private async processar(): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    let proximo: { id: string; entrada: Entrada } | undefined;
    while ((proximo = this.fila.shift()))
      await this.dublar(this.jobs.get(proximo.id)!, proximo.entrada);
    this.rodando = false;
  }

  private async dublar(job: Job, entrada: Entrada): Promise<void> {
    job.situacao = 'dublando';
    job.iniciadoEm = new Date();
    this.mudou(job);
    try {
      const video = await rodarNoTrace(job.trace, () =>
        'url' in entrada
          ? this.ingestao.dublarLink(entrada.url)
          : this.ingestao.dublar(entrada.video, entrada.nome),
      );
      await mkdir(this.pasta, { recursive: true });
      const arquivo = join(this.pasta, `${job.id}.mp4`);
      await writeFile(arquivo, video);
      job.trace.encerrarEtapa();
      job.arquivo = arquivo;
      job.situacao = 'pronto';
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      const aberta = job.trace.etapas.at(-1);
      job.etapaDoErro = aberta && !aberta.fim ? aberta.nome : undefined;
      job.trace.falhar(mensagem);
      job.erro = mensagem;
      job.situacao = 'falhou';
      this.logger.error(
        `Dublagem "${job.nome}" falhou: ${mensagem}`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      job.terminadoEm = new Date();
      this.mudou(job);
    }
  }
}
