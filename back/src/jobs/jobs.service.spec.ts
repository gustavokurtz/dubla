import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { IngestionService } from '../ingestion/ingestion.service';
import { traceAtual } from '../trace/trace';
import { JobsService } from './jobs.service';

// Dublagem simulada: cada chamada fica pendente até o teste resolver ou rejeitar.
function ingestaoSimulada() {
  const pendentes: { resolver: (v: Buffer) => void; rejeitar: (e: Error) => void }[] = [];
  const dublar = jest.fn(
    () =>
      new Promise<Buffer>((resolver, rejeitar) => {
        const trace = traceAtual();
        trace?.iniciarEtapa('Extraindo o áudio');
        trace?.registrar({ servico: 'claude', custo: 0.05, duracaoMs: 1 });
        trace?.iniciarEtapa('Gerando as vozes', 2);
        pendentes.push({ resolver, rejeitar });
      }),
  );
  const dublarLink = jest.fn(dublar);
  return { ingestao: { dublar, dublarLink } as unknown as IngestionService, pendentes, dublar };
}

async function esperar(condicao: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !condicao(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(condicao()).toBe(true);
}

describe('JobsService', () => {
  let pasta: string;

  beforeEach(async () => {
    pasta = await mkdtemp(join(tmpdir(), 'dublados-'));
  });
  afterEach(() => rm(pasta, { recursive: true, force: true }));

  it('dubla um vídeo de cada vez, na ordem, com a posição na fila', async () => {
    const { ingestao, pendentes, dublar } = ingestaoSimulada();
    const jobs = new JobsService(ingestao, pasta);

    const a = jobs.criar({ video: Buffer.from('a'), nome: 'arm bar' });
    const b = jobs.criar({ video: Buffer.from('b'), nome: 'triangle' });

    await esperar(() => pendentes.length === 1);
    expect(jobs.obter(a)).toMatchObject({ situacao: 'dublando', nome: 'arm bar' });
    expect(jobs.obter(b)).toMatchObject({ situacao: 'na fila' });
    expect(jobs.posicao(a)).toBe(0);
    expect(jobs.posicao(b)).toBe(1);
    expect(dublar).toHaveBeenCalledTimes(1);

    pendentes[0].resolver(Buffer.from('mp4 a'));
    await esperar(() => pendentes.length === 2);
    const pronto = jobs.obter(a)!;
    expect(pronto.situacao).toBe('pronto');
    expect(await readFile(pronto.arquivo!, 'utf8')).toBe('mp4 a');
    expect(pronto.arquivo).toBe(join(pasta, `${a}.mp4`));
    expect(pronto.trace.custoTotal()).toBeCloseTo(0.05);
    expect(jobs.obter(b)).toMatchObject({ situacao: 'dublando' });
    expect(jobs.posicao(b)).toBe(0);
  });

  it('marca a falha com a etapa e a mensagem, guarda o gasto e segue a fila', async () => {
    const { ingestao, pendentes } = ingestaoSimulada();
    const jobs = new JobsService(ingestao, pasta);

    const a = jobs.criar({ url: 'https://youtu.be/x' });
    const b = jobs.criar({ video: Buffer.from('b'), nome: 'triangle' });

    await esperar(() => pendentes.length === 1);
    pendentes[0].rejeitar(new Error('HTTP 401 na AssemblyAI'));
    await esperar(() => pendentes.length === 2);

    const falho = jobs.obter(a)!;
    expect(falho).toMatchObject({
      situacao: 'falhou',
      erro: 'HTTP 401 na AssemblyAI',
      etapaDoErro: 'Gerando as vozes',
    });
    expect(falho.trace.etapas.at(-1)).toMatchObject({ erro: 'HTTP 401 na AssemblyAI' });
    expect(falho.trace.custoTotal()).toBeCloseTo(0.05);
    expect(falho.arquivo).toBeUndefined();
    expect(jobs.obter(b)).toMatchObject({ situacao: 'dublando' });
  });

  it('job inexistente não tem estado nem posição', () => {
    const jobs = new JobsService(ingestaoSimulada().ingestao, pasta);
    expect(jobs.obter('nao-existe')).toBeUndefined();
    expect(jobs.posicao('nao-existe')).toBeUndefined();
  });
});
