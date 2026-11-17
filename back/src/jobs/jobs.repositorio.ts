import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../banco/prisma.service';
import { Job } from './jobs.service';

// Grava no banco o estado de cada dublagem, para o histórico sobreviver ao reinício do back (R8).
@Injectable()
export class JobsRepositorio implements OnModuleInit {
  private readonly logger = new Logger(JobsRepositorio.name);
  private cadeia: Promise<void> = Promise.resolve();
  private readonly pendentes = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  // O que estava rodando quando o back caiu não volta a rodar: vira interrompido, com o gasto já gravado (R10).
  async onModuleInit(): Promise<void> {
    const { count } = await this.prisma.job.updateMany({
      where: { situacao: { in: ['na fila', 'dublando'] } },
      data: { situacao: 'interrompido', terminadoEm: new Date() },
    });
    if (count) this.logger.warn(`${count} dublagem(ns) interrompida(s) pelo reinício`);
  }

  // Grava o estado atual do job. Os avisos chegam a cada fala; enquanto um já espera na
  // cadeia, os seguintes se juntam a ele, que lê o job na hora de gravar (o estado mais novo).
  // Nunca lança: o ouvinte que chama isto roda dentro da fila de dublagem.
  agendar(job: Job): void {
    if (this.pendentes.has(job.id)) return;
    this.pendentes.add(job.id);
    this.cadeia = this.cadeia.then(async () => {
      this.pendentes.delete(job.id);
      try {
        await this.gravar(job);
      } catch (err) {
        this.logger.error(
          `Não gravou a dublagem "${job.nome}" no banco: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
  }

  // Resolve quando tudo o que foi agendado até agora foi gravado.
  ocioso(): Promise<void> {
    return this.cadeia;
  }

  private async gravar(job: Job): Promise<void> {
    const { trace } = job;
    const dados = {
      nome: job.nome,
      origem: job.origem,
      situacao: job.situacao,
      criadoEm: job.criadoEm,
      iniciadoEm: job.iniciadoEm ?? null,
      terminadoEm: job.terminadoEm ?? null,
      erro: job.erro ?? null,
      etapaDoErro: job.etapaDoErro ?? null,
      arquivo: job.arquivo ?? null,
      custoTotal: trace.custoTotal(),
    };
    await this.prisma.$transaction([
      this.prisma.job.upsert({
        where: { id: job.id },
        create: { id: job.id, ...dados },
        update: dados,
      }),
      this.prisma.etapa.deleteMany({ where: { jobId: job.id } }),
      this.prisma.etapa.createMany({
        data: trace.etapas.map((e, ordem) => ({
          jobId: job.id,
          ordem,
          nome: e.nome,
          inicio: e.inicio,
          fim: e.fim ?? null,
          feito: e.feito ?? null,
          total: e.total ?? null,
          erro: e.erro ?? null,
          custo: trace.custoDaEtapa(ordem),
        })),
      }),
      this.prisma.chamada.deleteMany({ where: { jobId: job.id } }),
      this.prisma.chamada.createMany({
        data: trace.chamadas.map((c, ordem) => ({
          jobId: job.id,
          ordem,
          etapa: c.etapa ?? null,
          servico: c.servico,
          papel: c.papel ?? null,
          modelo: c.modelo ?? null,
          entrada: c.entrada ?? null,
          saida: c.saida ?? null,
          segundos: c.segundos ?? null,
          caracteres: c.caracteres ?? null,
          quantidade: c.quantidade ?? null,
          custo: c.custo,
          duracaoMs: c.duracaoMs,
        })),
      }),
    ]);
  }
}
