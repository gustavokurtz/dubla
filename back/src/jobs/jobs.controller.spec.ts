import { ConflictException, HttpException, MessageEvent, NotFoundException } from '@nestjs/common';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Trace } from '../trace/trace';
import { JobsController } from './jobs.controller';
import { Job, JobsService } from './jobs.service';

function job(parcial: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    nome: 'aula',
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

const controllerCom = (s: ReturnType<typeof servicoSimulado>) =>
  new JobsController(s as unknown as JobsService);

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

  it('estado do job: situação, posição na fila, etapas com custo e total gasto', () => {
    const j = job();
    j.trace.iniciarEtapa('Transcrevendo');
    j.trace.registrar({
      servico: 'assemblyai-transcricao',
      segundos: 60,
      custo: 0.01,
      duracaoMs: 1,
    });

    const estado = controllerCom(servicoSimulado({ j1: j })).obter('j1');

    expect(estado).toMatchObject({ id: 'j1', situacao: 'dublando', posicao: 2, custo: 0.01 });
    expect(estado.etapas).toEqual([
      expect.objectContaining({ nome: 'Transcrevendo', custo: 0.01 }),
    ]);
    expect(estado.chamadas).toHaveLength(1);
  });

  it('job inexistente: 404 no estado, nos eventos e no vídeo', () => {
    const c = controllerCom(servicoSimulado({}));
    expect(() => c.obter('x')).toThrow(NotFoundException);
    expect(() => c.eventos('x')).toThrow(NotFoundException);
    expect(() => c.video('x')).toThrow(NotFoundException);
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

  it('vídeo ainda não pronto: 409', () => {
    expect(() => controllerCom(servicoSimulado({ j1: job() })).video('j1')).toThrow(
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

      const resposta = controllerCom(s).video('j1');

      expect(resposta.getHeaders()).toMatchObject({
        type: 'video/mp4',
        disposition: 'attachment; filename="Arm Bar-dublado.mp4"',
      });
    });
  });
});
