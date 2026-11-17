import { planejarEncaixe } from './planejar-encaixe';

// Fala original de 10 s a 12 s (2 s); próxima fala aos 13 s.
const base = { inicio: 10, fim: 12, limite: 13 };

describe('planejarEncaixe', () => {
  it('cabe no tempo da original: fica como está', () => {
    expect(planejarEncaixe({ ...base, duracaoAudio: 1.8, encurtamentos: 0 })).toEqual({
      acao: 'ok',
      atempo: 1,
      inicioDublado: 10,
      fimDublado: 11.8,
      encurtamentos: 0,
    });
  });

  it('sobra até 15%: acelera só o necessário, sem encurtar', () => {
    expect(planejarEncaixe({ ...base, duracaoAudio: 2.2, encurtamentos: 0 })).toEqual({
      acao: 'acelerar',
      atempo: 1.1,
      inicioDublado: 10,
      fimDublado: 12,
      encurtamentos: 0,
    });
  });

  it('acelerar 15% não basta: acelera 15% e avança sobre o silêncio, sem encurtar', () => {
    const e = planejarEncaixe({ ...base, duracaoAudio: 2.875, encurtamentos: 0 });
    expect(e).toMatchObject({ acao: 'avancar', atempo: 1.15, inicioDublado: 10 });
    expect(e.fimDublado).toBeCloseTo(12.5);
  });

  it('caso do D2: fala de 0,27 s com silêncio depois avança, não encurta', () => {
    const e = planejarEncaixe({
      inicio: 33.78,
      fim: 34.05,
      limite: 34.9,
      duracaoAudio: 0.6,
      encurtamentos: 0,
    });
    expect(e.acao).toBe('avancar');
  });

  it('nem acelerando e avançando cabe: pede para encurtar, até 3 vezes', () => {
    const longa = { ...base, duracaoAudio: 4 };
    expect(planejarEncaixe({ ...longa, encurtamentos: 0 }).acao).toBe('encurtar');
    expect(planejarEncaixe({ ...longa, encurtamentos: 2 }).acao).toBe('encurtar');
  });

  it('depois de 3 encurtamentos sem caber: corta no início da próxima fala', () => {
    expect(planejarEncaixe({ ...base, duracaoAudio: 4, encurtamentos: 3 })).toEqual({
      acao: 'cortar',
      atempo: 1.15,
      inicioDublado: 10,
      fimDublado: 13,
      encurtamentos: 3,
    });
  });

  it('última fala: o limite é o fim do vídeo', () => {
    const e = planejarEncaixe({
      inicio: 10,
      fim: 12,
      limite: 15,
      duracaoAudio: 3.45,
      encurtamentos: 0,
    });
    expect(e).toMatchObject({ acao: 'avancar', atempo: 1.15 });
    expect(e.fimDublado).toBeCloseTo(13);
  });

  it('próxima fala começa antes de esta terminar: o espaço vai só até ela', () => {
    // Original vai até 12 s, mas a outra pessoa começa aos 11,5 s.
    const e = planejarEncaixe({
      inicio: 10,
      fim: 12,
      limite: 11.5,
      duracaoAudio: 1.6,
      encurtamentos: 0,
    });
    expect(e).toMatchObject({ acao: 'acelerar', fimDublado: 11.5 });
    expect(e.atempo).toBeCloseTo(1.067, 3);
  });
});
