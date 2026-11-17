import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EncaixeDaFala } from '../shared/types';
import { FfmpegService } from './ffmpeg.service';

// Gera mídia sintética com o ffmpeg do sistema e devolve o arquivo em Buffer.
function gerar(dir: string, nome: string, args: string[]): Buffer {
  const arquivo = join(dir, nome);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, arquivo]);
  return readFileSync(arquivo);
}

const tom = (dir: string, nome: string, segundos: number) =>
  gerar(dir, nome, ['-f', 'lavfi', '-i', `sine=frequency=440:duration=${segundos}`]);

// Trechos com som no áudio do vídeo: [início, fim] em segundos, pelo silencedetect.
function trechosComSom(dir: string, video: Buffer): [number, number][] {
  const arquivo = join(dir, 'saida.mp4');
  writeFileSync(arquivo, video);
  // O silencedetect escreve no stderr.
  const saida = spawnSync(
    'ffmpeg',
    ['-i', arquivo, '-af', 'silencedetect=noise=-40dB:d=0.2', '-f', 'null', '-'],
    { encoding: 'utf8' },
  ).stderr;
  const fins = [...saida.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const inicios = [...saida.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  // O áudio começa em silêncio: cada silence_end abre um som, o silence_start seguinte o fecha.
  // No fim do arquivo o filtro fecha o silêncio final com um silence_end sem som depois: ignorado.
  return fins
    .map((inicio): [number, number] => [inicio, inicios.find((s) => s > inicio) ?? Infinity])
    .filter(([, fim]) => fim !== Infinity);
}

function duracao(dir: string, video: Buffer): { video: number; audio: number } {
  const arquivo = join(dir, 'duracao.mp4');
  writeFileSync(arquivo, video);
  const ler = (stream: string) =>
    Number(
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        stream,
        '-show_entries',
        'stream=duration',
        '-of',
        'csv=p=0',
        arquivo,
      ]).toString(),
    );
  return { video: ler('v:0'), audio: ler('a:0') };
}

function encaixe(parcial: Partial<EncaixeDaFala>): EncaixeDaFala {
  return { acao: 'ok', atempo: 1, inicioDublado: 0, fimDublado: 0, encurtamentos: 0, ...parcial };
}

describe('FfmpegService.montarVideo', () => {
  const service = new FfmpegService();
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'dubla-teste-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('coloca cada fala no instante certo, acelera e corta, sem mudar a duração do vídeo', async () => {
    const video = gerar(dir, 'video.mp4', [
      '-f',
      'lavfi',
      '-i',
      'color=c=black:s=320x240:d=8',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=44100',
      '-t',
      '8',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
    ]);
    const fundo = gerar(dir, 'fundo.wav', ['-f', 'lavfi', '-i', 'anullsrc=r=44100', '-t', '8']);
    const falas = [
      // 0,5 s, cabe: 1,0 → 1,5
      { audio: tom(dir, 'f1.mp3', 0.5), encaixe: encaixe({ inicioDublado: 1, fimDublado: 1.5 }) },
      // 1,15 s acelerado 15%: 3,0 → 4,0
      {
        audio: tom(dir, 'f2.mp3', 1.15),
        encaixe: encaixe({ acao: 'acelerar', atempo: 1.15, inicioDublado: 3, fimDublado: 4 }),
      },
      // 1,0 s cortado no limite: 5,0 → 5,5
      {
        audio: tom(dir, 'f3.mp3', 1),
        encaixe: encaixe({ acao: 'cortar', inicioDublado: 5, fimDublado: 5.5 }),
      },
    ];

    const saida = await service.montarVideo(video, fundo, falas);

    const trechos = trechosComSom(dir, saida);
    expect(trechos).toHaveLength(3);
    const esperado = [
      [1, 1.5],
      [3, 4],
      [5, 5.5],
    ];
    trechos.forEach(([inicio, fim], i) => {
      expect(Math.abs(inicio - esperado[i][0])).toBeLessThanOrEqual(0.1);
      expect(Math.abs(fim - esperado[i][1])).toBeLessThanOrEqual(0.1);
    });
    const d = duracao(dir, saida);
    expect(d.video).toBeCloseTo(8, 1);
    expect(Math.abs(d.audio - 8)).toBeLessThanOrEqual(0.1);
  }, 60000);
});
