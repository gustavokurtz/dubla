import { Logger } from '@nestjs/common';
import { PrismaService } from '../banco/prisma.service';
import { Trace } from '../trace/trace';
import { JobsRepositorio } from './jobs.repositorio';
import { Job } from './jobs.service';

type Linha = Record<string, unknown>;

// Prisma em memória: só o que o repositório usa.
function prismaSimulado() {
  const tabelas = { job: [] as Linha[], etapa: [] as Linha[], chamada: [] as Linha[] };
  let falharProxima = false;
  const doJob = (jobId: string) => (l: Linha) => l.jobId === jobId;
  const prisma = {
    job: {
      upsert: jest.fn(
        ({ where, create, update }: { where: { id: string }; create: Linha; update: Linha }) => {
          if (falharProxima) {
            falharProxima = false;
            return Promise.reject(new Error('conexão recusada'));
          }
          const linha = tabelas.job.find((j) => j.id === where.id);
          if (linha) Object.assign(linha, update);
          else tabelas.job.push({ ...create });
          return Promise.resolve();
        },
      ),
      updateMany: jest.fn(
        ({ where, data }: { where: { situacao: { in: string[] } }; data: Linha }) => {
          const alvo = tabelas.job.filter((j) => where.situacao.in.includes(j.situacao as string));
          alvo.forEach((j) => Object.assign(j, data));
          return Promise.resolve({ count: alvo.length });
        },
      ),
    },
    etapa: {
      deleteMany: jest.fn(({ where }: { where: { jobId: string } }) => {
        tabelas.etapa = tabelas.etapa.filter((l) => !doJob(where.jobId)(l));
        return Promise.resolve();
      }),
      createMany: jest.fn(({ data }: { data: Linha[] }) => {
        tabelas.etapa.push(...data);
        return Promise.resolve();
      }),
    },
    chamada: {
      deleteMany: jest.fn(({ where }: { where: { jobId: string } }) => {
        tabelas.chamada = tabelas.chamada.filter((l) => !doJob(where.jobId)(l));
        return Promise.resolve();
      }),
      createMany: jest.fn(({ data }: { data: Linha[] }) => {
        tabelas.chamada.push(...data);
        return Promise.resolve();
      }),
    },
    $transaction: jest.fn((operacoes: Promise<unknown>[]) => Promise.all(operacoes)),
  };
  return {
    prisma: prisma as unknown as PrismaService,
    tabelas,
    upsert: prisma.job.upsert,
    falharNaProxima: () => (falharProxima = true),
  };
}

function novoJob(): Job {
  return {
    id: 'job-1',
    nome: 'arm bar',
    origem: 'arquivo',
    situacao: 'na fila',
    trace: new Trace(),
    criadoEm: new Date('2026-11-17T10:00:00Z'),
  };
}

describe('JobsRepositorio', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('grava job, etapas e chamadas de uma dublagem conforme ela anda', async () => {
    const { prisma, tabelas } = prismaSimulado();
    const repo = new JobsRepositorio(prisma);
    const job = novoJob();

    repo.agendar(job);
    await repo.ocioso();
    expect(tabelas.job).toEqual([
      expect.objectContaining({
        id: 'job-1',
        nome: 'arm bar',
        origem: 'arquivo',
        situacao: 'na fila',
        custoTotal: 0,
      }),
    ]);

    job.situacao = 'dublando';
    job.iniciadoEm = new Date('2026-11-17T10:01:00Z');
    job.trace.iniciarEtapa('Extraindo o áudio');
    job.trace.iniciarEtapa('Traduzindo');
    job.trace.registrar({
      servico: 'claude',
      papel: 'traducao',
      modelo: 'claude-sonnet-5-5',
      entrada: 9800,
      saida: 7200,
      custo: 0.09,
      duracaoMs: 40000,
    });
    job.trace.iniciarEtapa('Gerando as vozes', 2);
    job.trace.somarVoz(100, 0.0015, 800);
    job.trace.avancar();
    repo.agendar(job);
    await repo.ocioso();

    expect(tabelas.job[0]).toMatchObject({ situacao: 'dublando', custoTotal: 0.0915 });
    expect(tabelas.etapa).toEqual([
      expect.objectContaining({ jobId: 'job-1', ordem: 0, nome: 'Extraindo o áudio', custo: 0 }),
      expect.objectContaining({ ordem: 1, nome: 'Traduzindo', custo: 0.09 }),
      expect.objectContaining({
        ordem: 2,
        nome: 'Gerando as vozes',
        feito: 1,
        total: 2,
        fim: null,
      }),
    ]);
    expect(tabelas.chamada).toEqual([
      expect.objectContaining({
        jobId: 'job-1',
        ordem: 0,
        etapa: 1,
        servico: 'claude',
        papel: 'traducao',
        modelo: 'claude-sonnet-5-5',
        entrada: 9800,
        saida: 7200,
        custo: 0.09,
      }),
      expect.objectContaining({
        ordem: 1,
        etapa: 2,
        servico: 'assemblyai-voz',
        quantidade: 1,
        caracteres: 100,
      }),
    ]);
  });

  it('grava a falha com a etapa e a mensagem', async () => {
    const { prisma, tabelas } = prismaSimulado();
    const repo = new JobsRepositorio(prisma);
    const job = novoJob();
    job.trace.iniciarEtapa('Gerando as vozes', 2);
    job.trace.falhar('HTTP 401 na AssemblyAI');
    Object.assign(job, {
      situacao: 'falhou',
      erro: 'HTTP 401 na AssemblyAI',
      etapaDoErro: 'Gerando as vozes',
      terminadoEm: new Date('2026-11-17T10:05:00Z'),
    });

    repo.agendar(job);
    await repo.ocioso();

    expect(tabelas.job[0]).toMatchObject({
      situacao: 'falhou',
      erro: 'HTTP 401 na AssemblyAI',
      etapaDoErro: 'Gerando as vozes',
      terminadoEm: new Date('2026-11-17T10:05:00Z'),
    });
    expect(tabelas.etapa[0]).toMatchObject({ erro: 'HTTP 401 na AssemblyAI' });
  });

  it('junta os avisos que chegam enquanto grava e termina com o estado mais novo', async () => {
    const { prisma, tabelas, upsert } = prismaSimulado();
    const repo = new JobsRepositorio(prisma);
    const job = novoJob();
    job.trace.iniciarEtapa('Gerando as vozes', 72);

    for (let i = 0; i < 72; i++) {
      job.trace.avancar();
      repo.agendar(job);
    }
    await repo.ocioso();

    expect(upsert.mock.calls.length).toBeLessThanOrEqual(2);
    expect(tabelas.etapa[0]).toMatchObject({ feito: 72 });
  });

  it('erro ao gravar não lança nem para as gravações seguintes', async () => {
    const { prisma, tabelas, falharNaProxima } = prismaSimulado();
    const repo = new JobsRepositorio(prisma);
    const job = novoJob();

    falharNaProxima();
    expect(() => repo.agendar(job)).not.toThrow();
    await repo.ocioso();
    expect(tabelas.job).toHaveLength(0);

    job.situacao = 'dublando';
    repo.agendar(job);
    await repo.ocioso();
    expect(tabelas.job[0]).toMatchObject({ situacao: 'dublando' });
  });

  it('na subida, o que estava na fila ou dublando vira interrompido e mantém o gasto', async () => {
    const { prisma, tabelas } = prismaSimulado();
    tabelas.job.push(
      { id: 'a', situacao: 'dublando', custoTotal: 0.12 },
      { id: 'b', situacao: 'na fila', custoTotal: 0 },
      { id: 'c', situacao: 'pronto', custoTotal: 0.3 },
    );
    const repo = new JobsRepositorio(prisma);

    await repo.onModuleInit();

    expect(tabelas.job).toEqual([
      expect.objectContaining({
        id: 'a',
        situacao: 'interrompido',
        custoTotal: 0.12,
        terminadoEm: expect.any(Date) as Date,
      }),
      expect.objectContaining({ id: 'b', situacao: 'interrompido', custoTotal: 0 }),
      { id: 'c', situacao: 'pronto', custoTotal: 0.3 },
    ]);
  });
});

describe('JobsRepositorio lê o histórico', () => {
  const linhaJob = {
    id: 'a',
    nome: 'arm bar',
    origem: 'arquivo',
    situacao: 'pronto',
    criadoEm: new Date('2026-11-17T10:00:00Z'),
    iniciadoEm: new Date('2026-11-17T10:01:00Z'),
    terminadoEm: new Date('2026-11-17T10:09:30Z'),
    erro: null,
    etapaDoErro: null,
    arquivo: '/dublados/a.mp4',
    custoTotal: 0.1,
  };

  function prismaDeLeitura() {
    const findMany = jest.fn().mockResolvedValue([linhaJob]);
    const findUnique = jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id !== 'a'
          ? null
          : {
              ...linhaJob,
              etapas: [
                {
                  jobId: 'a',
                  ordem: 0,
                  nome: 'Traduzindo e revisando',
                  inicio: new Date('2026-11-17T10:02:00Z'),
                  fim: new Date('2026-11-17T10:03:00Z'),
                  feito: null,
                  total: null,
                  erro: null,
                  custo: 0.1,
                },
              ],
              chamadas: [
                {
                  jobId: 'a',
                  ordem: 0,
                  etapa: 0,
                  servico: 'claude',
                  papel: 'juiz',
                  modelo: 'claude-haiku-5-5',
                  entrada: 2000,
                  saida: 300,
                  segundos: null,
                  caracteres: null,
                  quantidade: null,
                  custo: 0.1,
                  duracaoMs: 5000,
                },
              ],
            },
      ),
    );
    const prisma = { job: { findMany, findUnique } } as unknown as PrismaService;
    return { prisma, findMany, findUnique };
  }

  it('lista do mais recente para o mais antigo, com custo total e duração', async () => {
    const { prisma, findMany } = prismaDeLeitura();

    const lista = await new JobsRepositorio(prisma).listar();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { criadoEm: 'desc' } }),
    );
    expect(lista).toEqual([
      expect.objectContaining({
        id: 'a',
        nome: 'arm bar',
        situacao: 'pronto',
        custo: 0.1,
        duracaoMs: 510_000,
      }),
    ]);
  });

  it('carrega um job antigo com o trace inteiro, sem campos nulos', async () => {
    const { prisma } = prismaDeLeitura();

    const job = await new JobsRepositorio(prisma).carregar('a');

    expect(job).toMatchObject({ id: 'a', situacao: 'pronto', arquivo: '/dublados/a.mp4' });
    expect(job!.erro).toBeUndefined();
    expect(job!.trace.etapas).toEqual([
      {
        nome: 'Traduzindo e revisando',
        inicio: new Date('2026-11-17T10:02:00Z'),
        fim: new Date('2026-11-17T10:03:00Z'),
      },
    ]);
    expect(job!.trace.chamadas).toEqual([
      {
        servico: 'claude',
        etapa: 0,
        papel: 'juiz',
        modelo: 'claude-haiku-5-5',
        entrada: 2000,
        saida: 300,
        custo: 0.1,
        duracaoMs: 5000,
      },
    ]);
    expect(job!.trace.custoTotal()).toBeCloseTo(0.1);
  });

  it('job que não está no banco: undefined', async () => {
    expect(await new JobsRepositorio(prismaDeLeitura().prisma).carregar('x')).toBeUndefined();
  });
});
