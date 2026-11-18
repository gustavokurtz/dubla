import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JuizService } from './juiz.service';
import { FalaTraduzida } from '../shared/types';
import { rodarNoTrace, Trace } from '../trace/trace';

interface PedidoStream {
  model: string;
  output_config: { effort: string };
  fallbacks?: unknown;
  betas?: string[];
  system: string;
  messages: unknown;
}
const streamMock = jest.fn<unknown, [PedidoStream]>();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    beta: { messages: { stream: streamMock } },
  })),
}));

function respostaDoClaude(parsed: unknown) {
  return {
    finalMessage: () =>
      Promise.resolve({
        model: 'claude-opus-5-5',
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
        parsed_output: parsed,
      }),
  };
}

const falas: FalaTraduzida[] = [
  {
    id: 3,
    pessoa: 'A',
    inicio: 1,
    fim: 3,
    textoEn: 'He applies a heel hook.',
    textoEnCorrigido: 'He applies a heel hook.',
    textoPt: 'Ele aplica uma chave de calcanhar.',
  },
];

describe('JuizService', () => {
  let service: JuizService;

  beforeEach(async () => {
    streamMock.mockReset();
    const modulo = await Test.createTestingModule({
      providers: [
        JuizService,
        { provide: ConfigService, useValue: { getOrThrow: () => 'chave-teste' } },
      ],
    }).compile();
    service = modulo.get(JuizService);
  });

  it('julga cada fala com o inglês, o português e o tempo, e devolve os vereditos', async () => {
    streamMock.mockReturnValue(
      respostaDoClaude({
        vereditos: [{ id: 3, aprovado: false, motivo: 'heel hook se fala em inglês' }],
      }),
    );

    const vereditos = await service.avaliar(falas);

    const pedido = streamMock.mock.calls[0][0];
    expect(pedido.system).toMatch(/juiz/i);
    const conteudo = JSON.stringify(pedido.messages);
    expect(conteudo).toContain('He applies a heel hook.');
    expect(conteudo).toContain('Ele aplica uma chave de calcanhar.');
    expect(conteudo).toContain('28'); // 2 s × 14 chars/s
    expect(vereditos).toEqual([{ id: 3, aprovado: false, motivo: 'heel hook se fala em inglês' }]);
  });

  it('registra a chamada no trace com o papel de juiz', async () => {
    streamMock.mockReturnValue(respostaDoClaude({ vereditos: [{ id: 3, aprovado: true }] }));
    const trace = new Trace();

    await rodarNoTrace(trace, () => service.avaliar(falas));

    expect(trace.chamadas.map((c) => c.papel)).toEqual(['juiz']);
  });

  it('julga com o Haiku 5.5, esforço médio e sem fallback (o Haiku não tem)', async () => {
    streamMock.mockReturnValue(respostaDoClaude({ vereditos: [{ id: 3, aprovado: true }] }));

    await service.avaliar(falas);

    const pedido = streamMock.mock.calls[0][0];
    expect(pedido.model).toBe('claude-haiku-5-5');
    expect(pedido.output_config.effort).toBe('medium');
    expect(pedido.fallbacks).toBeUndefined();
    expect(pedido.betas).toBeUndefined();
  });
});
