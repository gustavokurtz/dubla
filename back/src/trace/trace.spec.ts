import { EventoTrace, rodarNoTrace, Trace, traceAtual } from './trace';

describe('Trace', () => {
  it('abre uma etapa por vez, fechando a anterior, e conta o progresso dela', () => {
    const trace = new Trace();
    trace.iniciarEtapa('Extraindo o áudio');
    trace.iniciarEtapa('Gerando as vozes', 3);
    trace.avancar();
    trace.avancar();
    trace.encerrarEtapa();

    const [primeira, segunda] = trace.etapas;
    expect(primeira.nome).toBe('Extraindo o áudio');
    expect(primeira.fim).toBeDefined();
    expect(segunda).toMatchObject({ nome: 'Gerando as vozes', feito: 2, total: 3 });
    expect(segunda.fim).toBeDefined();
  });

  it('registra chamadas na etapa corrente e soma o custo por etapa e no total', () => {
    const trace = new Trace();
    trace.iniciarEtapa('Transcrevendo');
    trace.registrar({
      servico: 'assemblyai-transcricao',
      segundos: 290,
      custo: 0.02,
      duracaoMs: 1,
    });
    trace.iniciarEtapa('Traduzindo e revisando');
    trace.registrar({
      servico: 'claude',
      papel: 'traducao',
      modelo: 'claude-sonnet-5-5',
      entrada: 9800,
      saida: 7200,
      custo: 0.09,
      duracaoMs: 1,
    });
    trace.registrar({ servico: 'claude', papel: 'juiz', custo: 0.004, duracaoMs: 1 });

    expect(trace.chamadas.map((c) => c.etapa)).toEqual([0, 1, 1]);
    expect(trace.custoDaEtapa(1)).toBeCloseTo(0.094, 10);
    expect(trace.custoTotal()).toBeCloseTo(0.114, 10);
  });

  it('soma as vozes de uma etapa numa linha só (falas, caracteres e custo)', () => {
    const trace = new Trace();
    trace.iniciarEtapa('Gerando as vozes', 2);
    trace.somarVoz(10, 0.00015, 5);
    trace.somarVoz(20, 0.0003, 7);
    trace.iniciarEtapa('Encaixando as falas');
    trace.somarVoz(5, 0.000075, 3);

    expect(trace.chamadas).toMatchObject([
      { servico: 'assemblyai-voz', etapa: 0, quantidade: 2, caracteres: 30, duracaoMs: 12 },
      { servico: 'assemblyai-voz', etapa: 1, quantidade: 1, caracteres: 5, duracaoMs: 3 },
    ]);
    expect(trace.custoDaEtapa(0)).toBeCloseTo(0.00045, 10);
    expect(trace.custoDaEtapa(1)).toBeCloseTo(0.000075, 10);
  });

  it('falha marca a etapa corrente com o erro e mantém o gasto', () => {
    const trace = new Trace();
    trace.iniciarEtapa('Gerando as vozes');
    trace.somarVoz(10, 0.14, 1);
    trace.falhar('HTTP 401 na AssemblyAI');

    expect(trace.etapas[0]).toMatchObject({ erro: 'HTTP 401 na AssemblyAI' });
    expect(trace.etapas[0].fim).toBeDefined();
    expect(trace.custoTotal()).toBeCloseTo(0.14, 10);
  });

  it('avisa quem assina a cada mudança, até cancelar', () => {
    const trace = new Trace();
    const eventos: EventoTrace[] = [];
    const cancelar = trace.assinar((e) => eventos.push(e));
    trace.iniciarEtapa('Transcrevendo');
    trace.registrar({ servico: 'claude', custo: 0.01, duracaoMs: 1 });
    trace.avancar();
    cancelar();
    trace.encerrarEtapa();

    expect(eventos.map((e) => e.tipo)).toEqual(['etapa', 'chamada', 'progresso']);
  });

  it('o trace corrente só existe dentro de rodarNoTrace, inclusive depois de await', async () => {
    const trace = new Trace();
    expect(traceAtual()).toBeUndefined();
    await rodarNoTrace(trace, async () => {
      await Promise.resolve();
      expect(traceAtual()).toBe(trace);
    });
    expect(traceAtual()).toBeUndefined();
  });
});
