import { custoClaude, custoTranscricao, custoVoz } from './custo';

const usage = (u: Partial<Parameters<typeof custoClaude>[1]>) => ({
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: null,
  cache_read_input_tokens: null,
  ...u,
});

describe('custoClaude', () => {
  it('soma entrada e saída pelo preço do modelo', () => {
    expect(
      custoClaude('claude-sonnet-5-5', usage({ input_tokens: 9800, output_tokens: 7200 })),
    ).toBeCloseTo(0.0916, 10);
  });

  it('Haiku 5.5 com prompt de até 100 mil tokens usa a tabela curta', () => {
    expect(
      custoClaude('claude-haiku-5-5', usage({ input_tokens: 20000, output_tokens: 3000 })),
    ).toBeCloseTo(0.0035, 10);
  });

  it('Haiku 5.5 com prompt acima de 100 mil tokens usa a tabela longa', () => {
    expect(
      custoClaude('claude-haiku-5-5', usage({ input_tokens: 150000, output_tokens: 1000 })),
    ).toBeCloseTo(0.0775, 10);
  });

  it('o tamanho do prompt do Haiku conta também o que veio do cache', () => {
    expect(
      custoClaude(
        'claude-haiku-5-5',
        usage({ input_tokens: 60000, cache_read_input_tokens: 50000 }),
      ),
    ).toBeCloseTo(0.0325, 10);
  });

  it('cobra escrita e leitura de cache', () => {
    expect(
      custoClaude(
        'claude-opus-5-5',
        usage({
          input_tokens: 1000,
          cache_creation_input_tokens: 2000,
          cache_read_input_tokens: 10000,
          output_tokens: 500,
        }),
      ),
    ).toBeCloseTo(0.026, 10);
  });

  it('modelo sem preço é erro explícito', () => {
    expect(() => custoClaude('claude-inexistente', usage({ input_tokens: 1 }))).toThrow(
      'claude-inexistente',
    );
  });
});

describe('custos da AssemblyAI', () => {
  it('transcrição cobra por hora de áudio (modelo + speaker labels + keyterms)', () => {
    expect(custoTranscricao(290)).toBeCloseTo((290 / 3600) * 0.28, 10);
  });

  it('voz cobra por caractere enviado', () => {
    expect(custoVoz(1000)).toBeCloseTo(0.015, 10);
  });
});
