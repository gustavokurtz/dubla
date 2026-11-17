import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TraducaoService } from './traducao.service';
import { Fala } from '../shared/types';

interface PedidoStream {
  model: string;
  output_config: { effort: string };
  fallbacks: unknown;
  betas: string[];
  messages: unknown;
}
const streamMock = jest.fn<unknown, [PedidoStream]>();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    beta: { messages: { stream: streamMock } },
  })),
}));

// O SDK devolve um stream; o serviço só usa finalMessage().
function respostaDoClaude(parsed: unknown, stopReason = 'end_turn') {
  return {
    finalMessage: () => Promise.resolve({ stop_reason: stopReason, parsed_output: parsed }),
  };
}

const falas: Fala[] = [
  { id: 0, pessoa: 'A', inicio: 0.5, fim: 3.0, textoEn: 'Grab the colar and break his posture.' },
  { id: 1, pessoa: 'B', inicio: 3.4, fim: 5.4, textoEn: 'Then the armbar?' },
];

describe('TraducaoService', () => {
  let service: TraducaoService;

  beforeEach(async () => {
    streamMock.mockReset();
    const modulo = await Test.createTestingModule({
      providers: [
        TraducaoService,
        { provide: ConfigService, useValue: { getOrThrow: () => 'chave-teste' } },
      ],
    }).compile();
    service = modulo.get(TraducaoService);
  });

  describe('traduzir', () => {
    it('manda o vídeo inteiro numa chamada e devolve cada fala com inglês corrigido e português', async () => {
      streamMock.mockReturnValue(
        respostaDoClaude({
          falas: [
            { id: 1, textoEnCorrigido: 'Then the armbar?', textoPt: 'E aí o armlock?' },
            {
              id: 0,
              textoEnCorrigido: 'Grab the collar and break his posture.',
              textoPt: 'Pega a gola e quebra a postura dele.',
            },
          ],
        }),
      );

      const traduzidas = await service.traduzir(falas);

      expect(streamMock).toHaveBeenCalledTimes(1);
      const pedido = streamMock.mock.calls[0][0];
      expect(pedido.model).toBe('claude-opus-5-5');
      expect(pedido.output_config.effort).toBe('high');
      expect(pedido.fallbacks).toBe('default');
      expect(pedido.betas).toContain('server-side-fallback-2026-07-01');
      // Duração 2,5 s × 14 chars/s = 35 chars de alvo para a fala 0.
      const conteudo = JSON.stringify(pedido.messages);
      expect(conteudo).toContain('Grab the colar');
      expect(conteudo).toContain('35');

      expect(traduzidas).toEqual([
        {
          ...falas[0],
          textoEnCorrigido: 'Grab the collar and break his posture.',
          textoPt: 'Pega a gola e quebra a postura dele.',
        },
        { ...falas[1], textoEnCorrigido: 'Then the armbar?', textoPt: 'E aí o armlock?' },
      ]);
    });

    it('falha explicitamente quando uma fala não volta', async () => {
      streamMock.mockReturnValue(
        respostaDoClaude({
          falas: [{ id: 0, textoEnCorrigido: 'x', textoPt: 'Pega a gola.' }],
        }),
      );
      await expect(service.traduzir(falas)).rejects.toThrow(/fala 1/);
    });

    it('falha explicitamente quando uma fala volta sem português', async () => {
      streamMock.mockReturnValue(
        respostaDoClaude({
          falas: [
            { id: 0, textoEnCorrigido: 'x', textoPt: 'Pega a gola.' },
            { id: 1, textoEnCorrigido: 'y', textoPt: '  ' },
          ],
        }),
      );
      await expect(service.traduzir(falas)).rejects.toThrow(/fala 1/);
    });

    it('falha explicitamente quando o Claude recusa ou corta a resposta', async () => {
      streamMock.mockReturnValue(respostaDoClaude(null, 'refusal'));
      await expect(service.traduzir(falas)).rejects.toThrow(/refusal/);
      streamMock.mockReturnValue(respostaDoClaude(null, 'max_tokens'));
      await expect(service.traduzir(falas)).rejects.toThrow(/max_tokens/);
    });
  });

  describe('encurtar', () => {
    it('pede uma versão mais curta da fala com o alvo e o motivo, e devolve o texto', async () => {
      streamMock.mockReturnValue(respostaDoClaude({ textoPt: 'Pega a gola, quebra a postura.' }));
      const fala = {
        ...falas[0],
        textoEnCorrigido: 'Grab the collar and break his posture.',
        textoPt: 'Pega a gola e depois quebra bem a postura dele.',
      };

      const texto = await service.encurtar(fala, 30, 'áudio de 3,4 s para 2,5 s');

      const conteudo = JSON.stringify(streamMock.mock.calls[0][0].messages);
      expect(conteudo).toContain('Pega a gola e depois quebra bem a postura dele.');
      expect(conteudo).toContain('30');
      expect(conteudo).toContain('áudio de 3,4 s para 2,5 s');
      expect(texto).toBe('Pega a gola, quebra a postura.');
    });
  });

  describe('refazer', () => {
    it('manda as falas reprovadas com o motivo do juiz e devolve a nova versão', async () => {
      streamMock.mockReturnValue(
        respostaDoClaude({
          falas: [{ id: 1, textoEnCorrigido: 'Then the armbar?', textoPt: 'E aí, armlock?' }],
        }),
      );
      const reprovada = {
        ...falas[1],
        textoEnCorrigido: 'Then the armbar?',
        textoPt: 'Então a chave de braço?',
      };

      const refeitas = await service.refazer([reprovada], new Map([[1, 'armbar é armlock']]));

      const conteudo = JSON.stringify(streamMock.mock.calls[0][0].messages);
      expect(conteudo).toContain('Então a chave de braço?');
      expect(conteudo).toContain('armbar é armlock');
      expect(refeitas).toEqual([{ ...reprovada, textoPt: 'E aí, armlock?' }]);
    });

    it('falha explicitamente quando a fala refeita não volta', async () => {
      streamMock.mockReturnValue(respostaDoClaude({ falas: [] }));
      const reprovada = { ...falas[1], textoEnCorrigido: 'x', textoPt: 'y' };
      await expect(service.refazer([reprovada], new Map([[1, 'm']]))).rejects.toThrow(/fala 1/);
    });
  });
});
