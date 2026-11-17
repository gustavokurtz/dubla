import { cortarEmFalas, PalavraComTempo } from './cortar-em-falas';

// Palavra no formato da AssemblyAI (tempos em ms).
const p = (text: string, start: number, end: number, speaker = 'A'): PalavraComTempo => ({
  text,
  start,
  end,
  speaker,
});

describe('cortarEmFalas', () => {
  it('frase única vira uma fala, com tempos em segundos', () => {
    const falas = cortarEmFalas([
      p('Grab', 1000, 1200),
      p('the', 1250, 1350),
      p('collar.', 1400, 1900),
    ]);
    expect(falas).toEqual([
      { id: 1, pessoa: 'A', inicio: 1, fim: 1.9, textoEn: 'Grab the collar.' },
    ]);
  });

  it('corta na troca de pessoa', () => {
    const falas = cortarEmFalas([
      p('Can', 0, 200, 'B'),
      p('I', 250, 300, 'B'),
      p('go', 350, 500, 'B'),
      p('Yes', 550, 800, 'A'),
    ]);
    expect(falas.map((f) => [f.pessoa, f.textoEn])).toEqual([
      ['B', 'Can I go'],
      ['A', 'Yes'],
    ]);
  });

  it('corta em pausa de 0,4 s ou mais, e não em pausa menor', () => {
    const falas = cortarEmFalas([
      p('keep', 0, 300),
      p('your', 690, 900), // pausa de 0,39 s: mesma fala
      p('elbows', 1300, 1600), // pausa de 0,4 s: fala nova
    ]);
    expect(falas.map((f) => f.textoEn)).toEqual(['keep your', 'elbows']);
  });

  it('corta em fim de frase (. ? !)', () => {
    const falas = cortarEmFalas([
      p('Okay.', 0, 300),
      p('Now', 350, 500),
      p('what?', 550, 800),
      p('Sweep!', 850, 1200),
      p('Go', 1250, 1400),
    ]);
    expect(falas.map((f) => f.textoEn)).toEqual(['Okay.', 'Now what?', 'Sweep!', 'Go']);
  });

  it('fala sem pausa nem ponto passa de 12 s: corta depois da última vírgula', () => {
    // 30 palavras de 0,5 s coladas = 15 s; vírgula na 10ª palavra (termina em 5 s)
    const palavras = Array.from({ length: 30 }, (_, i) =>
      p(i === 9 ? `w${i},` : `w${i}`, i * 500, i * 500 + 500),
    );
    const falas = cortarEmFalas(palavras);
    expect(falas[0].textoEn.split(' ').at(-1)).toBe('w9,');
    expect(falas[0].fim).toBe(5);
    expect(falas[1].inicio).toBe(5);
    for (const f of falas) expect(f.fim - f.inicio).toBeLessThanOrEqual(12);
  });

  it('sem vírgula, corta na palavra que passaria de 12 s', () => {
    const palavras = Array.from({ length: 30 }, (_, i) => p(`w${i}`, i * 500, i * 500 + 500));
    const falas = cortarEmFalas(palavras);
    expect(falas.map((f) => f.fim - f.inicio)).toEqual([12, 3]);
    expect(falas.map((f) => f.id)).toEqual([1, 2]);
  });

  it('sem palavras, sem falas', () => {
    expect(cortarEmFalas([])).toEqual([]);
  });

  it('palavra sem pessoa é erro explícito', () => {
    expect(() => cortarEmFalas([{ text: 'x', start: 0, end: 100, speaker: null }])).toThrow(
      'sem pessoa',
    );
  });
});
