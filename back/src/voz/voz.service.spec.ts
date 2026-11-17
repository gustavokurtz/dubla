import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Fala } from '../shared/types';
import { VozService, VOZES_PT } from './voz.service';

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
});
