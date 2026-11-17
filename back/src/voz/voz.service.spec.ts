import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Fala } from '../shared/types';
import { VozService, VOZES_PT } from './voz.service';
import { custoVoz } from '../custos/custo';
import { rodarNoTrace, Trace } from '../trace/trace';

const fetchMock = jest.fn();

interface CorpoFala {
  text: string;
  voice_id: string;
}

function respostaOk(conteudo: string) {
  return {
    ok: true,
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(conteudo).buffer),
  };
}

function fala(id: number, pessoa: string, inicio: number, fim: number, textoPt: string) {
  return { id, pessoa, inicio, fim, textoEn: 'x', textoPt } as Fala & { textoPt: string };
}

describe('VozService', () => {
  let service: VozService;

  beforeEach(async () => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    const modulo = await Test.createTestingModule({
      providers: [
        VozService,
        { provide: ConfigService, useValue: { getOrThrow: () => 'chave-teste' } },
      ],
    }).compile();
    service = modulo.get(VozService);
  });

  it('gera o áudio de cada fala com a voz da sua pessoa', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const corpo = JSON.parse(init.body as string) as CorpoFala;
      return Promise.resolve(respostaOk(`${corpo.voice_id}:${corpo.text}`));
    });
    // B fala mais tempo → voz 1; A → voz 2.
    const falas = [
      fala(1, 'A', 0, 2, 'Oi'),
      fala(2, 'B', 2, 10, 'Pega a gola'),
      fala(3, 'A', 10, 11, 'Tá'),
    ];

    const audios = await service.gerarAudios(falas);

    expect(audios.map((a) => ({ id: a.id, voz: a.voz, audio: a.audio.toString() }))).toEqual([
      { id: 1, voz: VOZES_PT[1], audio: `${VOZES_PT[1]}:Oi` },
      { id: 2, voz: VOZES_PT[0], audio: `${VOZES_PT[0]}:Pega a gola` },
      { id: 3, voz: VOZES_PT[1], audio: `${VOZES_PT[1]}:Tá` },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://tts.us.assemblyai.com/v1/speech');
    expect(init.headers).toEqual({
      Authorization: 'chave-teste',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      text: 'Oi',
      voice_id: VOZES_PT[1],
      language: 'portuguese',
      encoding: 'mp3',
      stream: false,
    });
  });

  it('erro HTTP vira erro explícito com a fala e a resposta', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('texto longo demais'),
    });

    await expect(service.gerarAudios([fala(7, 'A', 0, 1, 'Oi')])).rejects.toThrow(
      'Voz da fala 7 falhou: HTTP 422 texto longo demais',
    );
  });

  it('não passa de 50 pedidos por minuto (limite da conta na AssemblyAI)', async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementation(() => Promise.resolve(respostaOk('mp3')));
      const falas = Array.from({ length: 51 }, (_, i) => fala(i + 1, 'A', i, i + 1, 'Oi'));

      const pronto = service.gerarAudios(falas);
      await jest.advanceTimersByTimeAsync(60_000);
      expect(fetchMock).toHaveBeenCalledTimes(50);

      await jest.advanceTimersByTimeAsync(1_000);
      await pronto;
      expect(fetchMock).toHaveBeenCalledTimes(51);
    } finally {
      jest.useRealTimers();
    }
  });

  it('erro que a API marca como passageiro: espera o tempo pedido e tenta de novo', async () => {
    jest.useFakeTimers();
    try {
      const passageiro = JSON.stringify({ retryable: true, retry_after_seconds: 3 });
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve(passageiro) })
        .mockResolvedValueOnce(respostaOk('mp3'));

      const pronto = service.gerarAudios([fala(1, 'A', 0, 1, 'Oi')]);
      await jest.advanceTimersByTimeAsync(2_900);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(100);

      expect((await pronto)[0].audio.toString()).toBe('mp3');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('erro passageiro 3 vezes seguidas: desiste com o erro da API', async () => {
    jest.useFakeTimers();
    try {
      const passageiro = JSON.stringify({ retryable: true, retry_after_seconds: 1 });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve(passageiro),
      });

      const pronto = service.gerarAudios([fala(4, 'A', 0, 1, 'Oi')]);
      const falhou = expect(pronto).rejects.toThrow('Voz da fala 4 falhou: HTTP 503');
      await jest.advanceTimersByTimeAsync(5_000);
      await falhou;
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('soma no trace os caracteres enviados e o custo das vozes', async () => {
    fetchMock.mockResolvedValue(respostaOk('mp3'));
    const trace = new Trace();

    await rodarNoTrace(trace, async () => {
      await service.sintetizar(1, 'Pega a gola', VOZES_PT[0]);
      await service.sintetizar(2, 'Tá', VOZES_PT[0]);
    });

    expect(trace.chamadas).toEqual([
      expect.objectContaining({ servico: 'assemblyai-voz', quantidade: 2, caracteres: 13 }),
    ]);
    expect(trace.custoTotal()).toBeCloseTo(custoVoz(13), 12);
  });
});
