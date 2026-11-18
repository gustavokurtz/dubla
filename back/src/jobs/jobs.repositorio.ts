import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../banco/prisma.service';
import { Chamada, Etapa, Trace } from '../trace/trace';
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

  // Histórico: do mais recente para o mais antigo (R7).
  async listar() {
    const jobs = await this.prisma.job.findMany({ orderBy: { criadoEm: 'desc' } });
    return jobs.map((j) => ({
      id: j.id,
      nome: j.nome,
      origem: j.origem,
      situacao: j.situacao,
      criadoEm: j.criadoEm,
      iniciadoEm: j.iniciadoEm ?? undefined,
      terminadoEm: j.terminadoEm ?? undefined,
      duracaoMs:
        j.iniciadoEm && j.terminadoEm
          ? j.terminadoEm.getTime() - j.iniciadoEm.getTime()
          : undefined,
      custo: j.custoTotal,
      erro: j.erro ?? undefined,
      etapaDoErro: j.etapaDoErro ?? undefined,
    }));
  }

  // Remonta um job antigo, com o trace, no mesmo formato do job em memória.
  async carregar(id: string): Promise<Job | undefined> {
    const j = await this.prisma.job.findUnique({
      where: { id },
      include: { etapas: { orderBy: { ordem: 'asc' } }, chamadas: { orderBy: { ordem: 'asc' } } },
    });
    if (!j) return undefined;
    const trace = new Trace();
    for (const e of j.etapas) trace.etapas.push(semNulos<Etapa>(e, ['jobId', 'ordem', 'custo']));
    for (const c of j.chamadas) trace.chamadas.push(semNulos<Chamada>(c, ['jobId', 'ordem']));
    return {
      ...semNulos<Omit<Job, 'trace'>>(j, ['custoTotal', 'etapas', 'chamadas']),
      trace,
    };
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

// Linha do banco → objeto do trace: tira as colunas que só existem no banco e os nulos
// (no trace, campo ausente é undefined).
function semNulos<T>(linha: object, fora: string[]): T {
  return Object.fromEntries(
    Object.entries(linha).filter(([chave, valor]) => valor !== null && !fora.includes(chave)),
  ) as T;
}
