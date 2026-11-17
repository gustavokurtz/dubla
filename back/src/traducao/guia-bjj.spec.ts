import { TERMOS_RECONHECIMENTO } from './guia-bjj';

// Limites do keyterms_prompt da AssemblyAI: acima deles a transcrição volta 400.
describe('TERMOS_RECONHECIMENTO', () => {
  it('cabe no limite da AssemblyAI (100 termos, 8000 caracteres, 50 por termo)', () => {
    expect(TERMOS_RECONHECIMENTO.length).toBeLessThanOrEqual(100);
    expect(TERMOS_RECONHECIMENTO.join('').length).toBeLessThanOrEqual(8000);
    for (const termo of TERMOS_RECONHECIMENTO) expect(termo.length).toBeLessThanOrEqual(50);
  });

  it('não repete termo', () => {
    const minusculos = TERMOS_RECONHECIMENTO.map((t) => t.toLowerCase());
    expect(new Set(minusculos).size).toBe(minusculos.length);
  });
});
