import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { FalaNoRelatorio, gravarRelatorio, linhaDaFala, montarRelatorio } from './relatorio';

const base = {
  pessoa: 'A',
  textoEn: 'grab the colar',
  textoEnCorrigido: 'grab the collar',
  textoPt: 'pega a gola',
};

const falas: FalaNoRelatorio[] = [
  { ...base, id: 0, inicio: 1.0, fim: 3.0, juiz: 'aprovada', tentativas: 1 },
  {
    ...base,
    id: 12,
    inicio: 135.3,
    fim: 137.0,
    juiz: 'aprovada',
    tentativas: 2,
    encaixe: {
      acao: 'acelerar',
      atempo: 1.08,
      inicioDublado: 135.3,
      fimDublado: 137.0,
      encurtamentos: 0,
    },
  },
  {
    ...base,
    id: 13,
    pessoa: 'B',
    inicio: 137.5,
    fim: 139.0,
    juiz: 'reprovada',
    tentativas: 3,
    motivoJuiz: 'soa traduzido',
    encaixe: {
      acao: 'cortar',
      atempo: 1.15,
      inicioDublado: 137.56,
      fimDublado: 139.0,
      encurtamentos: 3,
    },
  },
];

describe('montarRelatorio', () => {
  it('resume o vídeo: pessoas, vereditos do juiz, encaixes e o maior desvio de início', () => {
    const relatorio = montarRelatorio('Arm Bar From Guard', falas);

    expect(relatorio.video).toBe('Arm Bar From Guard');
    expect(relatorio.resumo).toEqual({
      falas: 3,
      pessoas: 2,
      juiz: { aprovadasDePrimeira: 1, aprovadasDepois: 1, reprovadas: 1 },
      encaixe: { ok: 0, encurtar: 0, acelerar: 1, avancar: 0, cortar: 1, semDados: 1 },
      maiorDesvioInicio: 0.06,
    });
    expect(relatorio.falas).toBe(falas);
  });
});

describe('linhaDaFala', () => {
  it('escreve a fala do jeito que o dev lê', () => {
    expect(linhaDaFala(falas[1])).toBe(
      'fala 12, pessoa A, 2:15,30 → 2:15,30, acelerada 8%, juiz: aprovada na 2ª tentativa',
    );
    expect(linhaDaFala(falas[2])).toBe(
      'fala 13, pessoa B, 2:17,50 → 2:17,56, cortada, encurtada 3×, acelerada 15%, juiz: reprovada (soa traduzido)',
    );
    expect(linhaDaFala(falas[0])).toBe('fala 0, pessoa A, 0:01,00, juiz: aprovada');
  });
});

describe('gravarRelatorio', () => {
  it('grava o JSON com a data e o nome do vídeo no nome do arquivo', async () => {
    const pasta = await mkdtemp(path.join(tmpdir(), 'relatorio-'));
    try {
      const relatorio = montarRelatorio('Arm Bar: From Guard!', falas);
      const arquivo = await gravarRelatorio(relatorio, pasta, new Date('2026-11-17T12:00:00'));

      expect(path.basename(arquivo)).toBe('2026-11-17-arm-bar-from-guard.json');
      expect(JSON.parse(await readFile(arquivo, 'utf8'))).toEqual(relatorio);
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  });
});
