import { Test } from '@nestjs/testing';
import { IngestionService } from './ingestion.service';
import { FfmpegService } from '../ffmpeg/ffmpeg.service';
import { SeparacaoService } from '../separacao/separacao.service';
import { TranscricaoService } from '../transcricao/transcricao.service';
import { TraducaoService } from '../traducao/traducao.service';
import { JuizService } from '../traducao/juiz.service';
import { VozService } from '../voz/voz.service';
import { YoutubeService } from '../youtube/youtube.service';
import { gravarRelatorio, Relatorio } from '../relatorio/relatorio';
import { Fala, FalaTraduzida } from '../shared/types';

jest.mock('../relatorio/relatorio', () => ({
  ...jest.requireActual<object>('../relatorio/relatorio'),
  gravarRelatorio: jest.fn().mockResolvedValue('relatorios/x.json'),
}));
const gravarMock = gravarRelatorio as jest.Mock;

const falas: Fala[] = [
  { id: 1, pessoa: 'A', inicio: 1, fim: 3, textoEn: 'Grab the collar.' },
  { id: 2, pessoa: 'A', inicio: 4, fim: 6, textoEn: 'Break the posture.' },
];
const traduzidas: FalaTraduzida[] = falas.map((f) => ({
  ...f,
  textoEnCorrigido: f.textoEn,
  textoPt: `pt ${f.id}`,
}));

describe('IngestionService', () => {
  let service: IngestionService;
  const ordem: string[] = [];
  const registra =
    <T>(nome: string, valor: T) =>
    () => {
      ordem.push(nome);
      return Promise.resolve(valor);
    };

  const ffmpeg = {
    extrairAudio: jest.fn(registra('extrair', Buffer.from('audio'))),
    medirDuracao: jest.fn((m: Buffer) => Promise.resolve(m.toString() === 'video' ? 10 : 1)),
    montarVideo: jest.fn(registra('montar', Buffer.from('video-dublado'))),
  };
  const separacao = {
    separar: jest.fn(registra('separar', { voz: Buffer.from('v'), fundo: Buffer.from('fundo') })),
  };
  const transcricao = { transcrever: jest.fn(registra('transcrever', falas)) };
  const traducao = {
    traduzir: jest.fn(registra('traduzir', traduzidas)),
    refazer: jest.fn(),
    encurtar: jest.fn(),
  };
  const juiz = {
    avaliar: jest.fn(
      registra(
        'juiz',
        traduzidas.map((f) => ({ id: f.id, aprovado: true, motivo: '' })),
      ),
    ),
  };
  const voz = {
    gerarAudios: jest.fn(
      registra(
        'voz',
        falas.map((f) => ({ id: f.id, voz: 'aai-cassio', audio: Buffer.from(`fala ${f.id}`) })),
      ),
    ),
    sintetizar: jest.fn(),
  };

  const youtube = {
    baixar: jest.fn(registra('baixar', { video: Buffer.from('video'), titulo: 'Arm Bar' })),
  };

  beforeEach(async () => {
    ordem.length = 0;
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: FfmpegService, useValue: ffmpeg },
        { provide: SeparacaoService, useValue: separacao },
        { provide: TranscricaoService, useValue: transcricao },
        { provide: TraducaoService, useValue: traducao },
        { provide: JuizService, useValue: juiz },
        { provide: VozService, useValue: voz },
        { provide: YoutubeService, useValue: youtube },
      ],
    }).compile();
    service = modulo.get(IngestionService);
  });

  it('roda as etapas na ordem e devolve o vídeo montado', async () => {
    const resultado = await service.dublar(Buffer.from('video'), 'aula');

    expect(ordem).toEqual([
      'extrair',
      'separar',
      'transcrever',
      'traduzir',
      'juiz',
      'voz',
      'montar',
    ]);
    expect(resultado.toString()).toBe('video-dublado');
    const [video, fundo, posicionadas] = ffmpeg.montarVideo.mock.calls[0] as unknown as [
      Buffer,
      Buffer,
      { audio: Buffer; encaixe: { inicioDublado: number } }[],
    ];
    expect(video.toString()).toBe('video');
    expect(fundo.toString()).toBe('fundo');
    expect(posicionadas.map((p) => [p.audio.toString(), p.encaixe.inicioDublado])).toEqual([
      ['fala 1', 1],
      ['fala 2', 4],
    ]);
  });

  it('grava o relatório com todas as falas, o veredito do juiz e o encaixe', async () => {
    await service.dublar(Buffer.from('video'), 'aula');

    const [relatorio] = gravarMock.mock.calls[0] as [Relatorio];
    expect(relatorio.video).toBe('aula');
    expect(relatorio.falas.map((f) => [f.id, f.textoPt, f.juiz, f.encaixe?.acao])).toEqual([
      [1, 'pt 1', 'aprovada', 'ok'],
      [2, 'pt 2', 'aprovada', 'ok'],
    ]);
  });

  it('com link do YouTube, baixa antes e usa o título no relatório', async () => {
    const resultado = await service.dublarLink('https://www.youtube.com/watch?v=abc');

    expect(youtube.baixar).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc');
    expect(ordem[0]).toBe('baixar');
    expect(ordem[1]).toBe('extrair');
    expect(resultado.toString()).toBe('video-dublado');
    const [relatorio] = gravarMock.mock.calls[0] as [Relatorio];
    expect(relatorio.video).toBe('Arm Bar');
  });
});
