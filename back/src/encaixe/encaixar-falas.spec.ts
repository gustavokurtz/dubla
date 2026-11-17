import { FalaRevisada } from '../shared/types';
import { encaixarFalas } from './encaixar-falas';

function fala(id: number, inicio: number, fim: number, textoPt: string): FalaRevisada {
  return {
    id,
    pessoa: 'A',
    inicio,
    fim,
    textoEn: 'x',
    textoEnCorrigido: 'x',
    textoPt,
    juiz: 'aprovada',
    tentativas: 1,
  };
}

// O "áudio" é o próprio texto; a duração medida é 0,1 s por caractere.
const audioDe = (texto: string) => Buffer.from(texto);
const medir = (audio: Buffer) => Promise.resolve(audio.length / 10);

describe('encaixarFalas', () => {
  it('fala que cabe não chama o tradutor nem regera a voz', async () => {
    const encurtar = jest.fn();
    const sintetizar = jest.fn();
    const falas = [fala(1, 0, 2, '0123456789')]; // 1 s em 2 s

    const r = await encaixarFalas(falas, [{ id: 1, voz: 'v1', audio: audioDe('0123456789') }], 10, {
      medir,
      encurtar,
      sintetizar,
    });

    expect(encurtar).not.toHaveBeenCalled();
    expect(sintetizar).not.toHaveBeenCalled();
    expect(r[0].fala.encaixe).toMatchObject({ acao: 'ok', inicioDublado: 0, fimDublado: 1 });
    expect(r[0].audio.toString()).toBe('0123456789');
  });

  it('fala longa: encurta com alvo proporcional, regera com a mesma voz e guarda o texto novo', async () => {
    const curto = 'x'.repeat(19); // 1,9 s
    const encurtar = jest.fn().mockResolvedValue(curto);
    const sintetizar = jest.fn((_id: number, texto: string) => Promise.resolve(audioDe(texto)));
    const longo = 'x'.repeat(30); // 3 s num espaço de 2 s
    const falas = [fala(1, 0, 2, longo), fala(2, 5, 6, 'oi')];

    const r = await encaixarFalas(
      falas,
      [
        { id: 1, voz: 'v1', audio: audioDe(longo) },
        { id: 2, voz: 'v2', audio: audioDe('oi') },
      ],
      10,
      { medir, encurtar, sintetizar },
    );

    // alvo = 30 chars × 2 s / 3 s = 20
    expect(encurtar).toHaveBeenCalledWith(falas[0], 20, expect.stringContaining('3.0 s'));
    expect(sintetizar).toHaveBeenCalledWith(1, curto, 'v1');
    expect(r[0].fala.textoPt).toBe(curto);
    expect(r[0].fala.encaixe).toMatchObject({ acao: 'ok', encurtamentos: 1 });
    expect(r[0].audio.toString()).toBe(curto);
  });

  it('o limite de cada fala é o início da próxima; o da última é o fim do vídeo', async () => {
    const encurtar = jest.fn((f: FalaRevisada) => Promise.resolve(f.textoPt));
    const sintetizar = jest.fn((_id: number, texto: string) => Promise.resolve(audioDe(texto)));
    const longa = 'x'.repeat(40); // 4 s num espaço de 2 s, nunca encurta de verdade
    const falas = [fala(1, 0, 2, longa), fala(2, 3, 5, longa)];

    const r = await encaixarFalas(
      falas,
      [
        { id: 1, voz: 'v1', audio: audioDe(longa) },
        { id: 2, voz: 'v1', audio: audioDe(longa) },
      ],
      6,
      { medir, encurtar, sintetizar },
    );

    expect(encurtar).toHaveBeenCalledTimes(6); // 3 por fala
    expect(r[0].fala.encaixe).toMatchObject({ acao: 'cortar', fimDublado: 3, encurtamentos: 3 });
    expect(r[1].fala.encaixe).toMatchObject({ acao: 'cortar', fimDublado: 6, encurtamentos: 3 });
  });

  it('fala sem áudio é erro explícito', async () => {
    await expect(
      encaixarFalas([fala(1, 0, 2, 'oi')], [], 10, {
        medir,
        encurtar: jest.fn(),
        sintetizar: jest.fn(),
      }),
    ).rejects.toThrow('Fala 1 sem áudio dublado');
  });
});
