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

  it('trecho curto não corta em pausa: junta os pedaços da frase (caso real do D2)', () => {
    // "Okay," (0,32 s) … "you go" (0,27 s) … "to Jiu-Jitsu 101": pausas de 0,63 s e 0,85 s.
    const falas = cortarEmFalas([
      p('Okay,', 32830, 33150),
      p('you', 33780, 33900),
      p('go', 33900, 34050),
      p('to', 34900, 35000),
      p('Jiu-Jitsu', 35000, 35600),
      p('101.', 35600, 36200),
    ]);
    expect(falas.map((f) => [f.inicio, f.fim, f.textoEn])).toEqual([
      [32.83, 36.2, 'Okay, you go to Jiu-Jitsu 101.'],
    ]);
  });

  it('trecho de 1,5 s ou mais corta em pausa de 0,4 s, e não em pausa menor', () => {
    const falas = cortarEmFalas([
      p('keep', 0, 800),
      p('your', 1190, 1600), // pausa de 0,39 s: mesma fala
      p('elbows', 2000, 2300), // pausa de 0,4 s com 1,6 s acumulado: fala nova
    ]);
    expect(falas.map((f) => f.textoEn)).toEqual(['keep your', 'elbows']);
  });

  it('pausa de 1,5 s ou mais sempre corta, mesmo em trecho curto', () => {
    const falas = cortarEmFalas([p('Okay,', 0, 300), p('look', 1800, 2100)]);
    expect(falas.map((f) => f.textoEn)).toEqual(['Okay,', 'look']);
  });

  it('fim de frase (. ? !) corta só quando o trecho já tem 1,5 s', () => {
    const falas = cortarEmFalas([
      p('Okay.', 0, 300), // 0,3 s: junta com a seguinte
      p('Now', 350, 500),
      p('grab', 550, 900),
      p('the', 950, 1100),
      p('sleeve.', 1150, 1700), // 1,7 s acumulado: corta
      p('Sweep!', 1750, 2200),
    ]);
    expect(falas.map((f) => f.textoEn)).toEqual(['Okay. Now grab the sleeve.', 'Sweep!']);
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
