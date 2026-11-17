import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { IngestionService } from '../ingestion/ingestion.service';
import { rodarNoTrace, Trace } from '../trace/trace';

export const PASTA_DUBLADOS = 'PASTA_DUBLADOS';

export type Entrada = { video: Buffer; nome: string } | { url: string };

export type Situacao = 'na fila' | 'dublando' | 'pronto' | 'falhou';

export interface Job {
  id: string;
  nome: string;
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

  constructor(
    private readonly ingestao: IngestionService,
    @Inject(PASTA_DUBLADOS) private readonly pasta: string,
  ) {}

  criar(entrada: Entrada): string {
    const id = randomUUID();
    const nome = 'url' in entrada ? entrada.url : entrada.nome;
    this.jobs.set(id, { id, nome, situacao: 'na fila', trace: new Trace(), criadoEm: new Date() });
    this.fila.push({ id, entrada });
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
    }
  }
}
