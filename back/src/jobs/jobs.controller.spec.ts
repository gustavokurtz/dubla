import { ConflictException, HttpException, MessageEvent, NotFoundException } from '@nestjs/common';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Trace } from '../trace/trace';
import { JobsController } from './jobs.controller';
import { JobsRepositorio } from './jobs.repositorio';
import { Job, JobsService } from './jobs.service';

function job(parcial: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    nome: 'aula',
    origem: 'arquivo',
    situacao: 'dublando',
    trace: new Trace(),
    criadoEm: new Date(),
    ...parcial,
  };
}

function servicoSimulado(jobs: Record<string, Job>) {
  const ouvintes = new Set<() => void>();
  return {
    criar: jest.fn().mockReturnValue('novo'),
    obter: jest.fn((id: string) => jobs[id]),
    posicao: jest.fn((id: string) => (jobs[id] ? 2 : undefined)),
    assinar: jest.fn((o: () => void) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    }),
    avisar: () => ouvintes.forEach((o) => o()),
    ouvintes,
  };
}

// Banco simulado: jobs antigos que já não estão na memória.
function repositorioSimulado(antigos: Record<string, Job> = {}) {
  return {
    listar: jest.fn().mockResolvedValue([{ id: 'velho', situacao: 'pronto', custo: 0.2 }]),
    carregar: jest.fn((id: string) => Promise.resolve(antigos[id])),
  };
}

const controllerCom = (
  s: ReturnType<typeof servicoSimulado>,
  r: ReturnType<typeof repositorioSimulado> = repositorioSimulado(),
) => new JobsController(s as unknown as JobsService, r as unknown as JobsRepositorio);

describe('JobsController', () => {
  it('link tem preferência sobre o arquivo e devolve o id na hora', () => {
    const s = servicoSimulado({});
    const arquivo = { buffer: Buffer.from('v'), originalname: 'aula.mp4' } as Express.Multer.File;

    expect(controllerCom(s).criar(arquivo, 'https://youtu.be/abc')).toEqual({ id: 'novo' });
    expect(s.criar).toHaveBeenCalledWith({ url: 'https://youtu.be/abc' });
  });

  it('arquivo entra com o nome sem extensão', () => {
    const s = servicoSimulado({});
    const arquivo = { buffer: Buffer.from('v'), originalname: 'aula.mp4' } as Express.Multer.File;

    controllerCom(s).criar(arquivo, undefined);

    expect(s.criar).toHaveBeenCalledWith({ video: arquivo.buffer, nome: 'aula' });
  });

  it('sem arquivo e sem link, recusa', () => {
    expect(() => controllerCom(servicoSimulado({})).criar(undefined, undefined)).toThrow(
      HttpException,
    );
  });

  it('estado do job: situação, posição na fila, etapas com custo e total gasto', async () => {
    const j = job();
    j.trace.iniciarEtapa('Transcrevendo');
    j.trace.registrar({
      servico: 'assemblyai-transcricao',
      segundos: 60,
      custo: 0.01,
      duracaoMs: 1,
    });

    const estado = await controllerCom(servicoSimulado({ j1: j })).obter('j1');

    expect(estado).toMatchObject({ id: 'j1', situacao: 'dublando', posicao: 2, custo: 0.01 });
    expect(estado.etapas).toEqual([
      expect.objectContaining({ nome: 'Transcrevendo', custo: 0.01 }),
    ]);
    expect(estado.chamadas).toHaveLength(1);
  });

  it('job inexistente: 404 no estado, nos eventos e no vídeo', async () => {
    const c = controllerCom(servicoSimulado({}));
    await expect(c.obter('x')).rejects.toThrow(NotFoundException);
    expect(() => c.eventos('x')).toThrow(NotFoundException);
    await expect(c.video('x')).rejects.toThrow(NotFoundException);
  });

  it('histórico: lista o que está no banco', async () => {
    const r = repositorioSimulado();
    expect(await controllerCom(servicoSimulado({}), r).listar()).toEqual([
      { id: 'velho', situacao: 'pronto', custo: 0.2 },
    ]);
  });

  it('job que não está na memória vem do banco, no mesmo formato', async () => {
    const antigo = job({ id: 'velho', situacao: 'interrompido' });
    antigo.trace.etapas.push({
      nome: 'Gerando as vozes',
      inicio: new Date(),
      feito: 10,
      total: 72,
    });
    antigo.trace.chamadas.push({ servico: 'claude', etapa: 0, custo: 0.3, duracaoMs: 1 });
    const s = servicoSimulado({});
    s.posicao.mockReturnValue(undefined);

    const estado = await controllerCom(s, repositorioSimulado({ velho: antigo })).obter('velho');

    expect(estado).toMatchObject({ id: 'velho', situacao: 'interrompido', custo: 0.3 });
    expect(estado.etapas).toEqual([expect.objectContaining({ feito: 10, total: 72, custo: 0.3 })]);
  });

  it('job da memória não consulta o banco', async () => {
    const r = repositorioSimulado();
    await controllerCom(servicoSimulado({ j1: job() }), r).obter('j1');
    expect(r.carregar).not.toHaveBeenCalled();
  });

  it('eventos: manda o estado ao conectar e a cada mudança, e fecha quando o job termina', () => {
    const j = job();
    const s = servicoSimulado({ j1: j });
    const recebidos: MessageEvent[] = [];
    let terminou = false;

    controllerCom(s)
      .eventos('j1')
      .subscribe({ next: (e) => recebidos.push(e), complete: () => (terminou = true) });
    j.trace.iniciarEtapa('Gerando as vozes', 2);
    j.trace.avancar();
    j.situacao = 'pronto';
    s.avisar();

    expect(recebidos.map((e) => (e.data as { situacao: string }).situacao)).toEqual([
      'dublando',
      'dublando',
      'dublando',
      'pronto',
    ]);
    expect((recebidos[2].data as { etapas: { feito: number }[] }).etapas[0].feito).toBe(1);
    expect(terminou).toBe(true);
    expect(s.ouvintes.size).toBe(0);
  });

  it('vídeo ainda não pronto: 409', async () => {
    await expect(controllerCom(servicoSimulado({ j1: job() })).video('j1')).rejects.toThrow(
      ConflictException,
    );
  });

  describe('vídeo pronto', () => {
    let pasta: string;
    beforeEach(async () => {
      pasta = await mkdtemp(join(tmpdir(), 'dublados-'));
    });
    afterEach(() => rm(pasta, { recursive: true, force: true }));

    it('devolve o MP4 com o nome do vídeo', async () => {
      const arquivo = join(pasta, 'j1.mp4');
      await writeFile(arquivo, 'mp4');
      const s = servicoSimulado({ j1: job({ situacao: 'pronto', arquivo, nome: 'Arm Bar' }) });

      const resposta = await controllerCom(s).video('j1');

      expect(resposta.getHeaders()).toMatchObject({
        type: 'video/mp4',
        disposition: 'attachment; filename="Arm Bar-dublado.mp4"',
      });
    });

    it('baixa pelo histórico o vídeo de um job que só está no banco', async () => {
      const arquivo = join(pasta, 'velho.mp4');
      await writeFile(arquivo, 'mp4');
      const r = repositorioSimulado({ velho: job({ id: 'velho', situacao: 'pronto', arquivo }) });

      const resposta = await controllerCom(servicoSimulado({}), r).video('velho');

      expect(resposta.getHeaders()).toMatchObject({ type: 'video/mp4' });
    });

    it('arquivo apagado do disco: 404', async () => {
      const arquivo = join(pasta, 'sumiu.mp4');
      const s = servicoSimulado({ j1: job({ situacao: 'pronto', arquivo }) });

      await expect(controllerCom(s).video('j1')).rejects.toThrow(NotFoundException);
    });
  });
});
