import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JuizService } from './juiz.service';
import { FalaTraduzida } from '../shared/types';

interface PedidoStream {
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
    finalMessage: () => Promise.resolve({ stop_reason: 'end_turn', parsed_output: parsed }),
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
});
