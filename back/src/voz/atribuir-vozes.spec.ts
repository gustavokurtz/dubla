import { Fala } from '../shared/types';
import { atribuirVozes } from './atribuir-vozes';

function fala(id: number, pessoa: string, inicio: number, fim: number): Fala {
  return { id, pessoa, inicio, fim, textoEn: 'x' };
}

describe('atribuirVozes', () => {
  const vozes = ['voz-1', 'voz-2'];

  it('uma pessoa fica com a voz 1', () => {
    expect(atribuirVozes([fala(1, 'A', 0, 3), fala(2, 'A', 4, 6)], vozes)).toEqual({
      A: { voz: 'voz-1', repetida: false },
    });
  });

  it('quem fala mais tempo fica com a voz 1, mesmo falando depois', () => {
    const falas = [fala(1, 'A', 0, 2), fala(2, 'B', 3, 10), fala(3, 'A', 11, 12)];
    expect(atribuirVozes(falas, vozes)).toEqual({
      B: { voz: 'voz-1', repetida: false },
      A: { voz: 'voz-2', repetida: false },
    });
  });

  it('da 3ª pessoa em diante alterna as vozes e marca a repetição', () => {
    const falas = [
      fala(1, 'A', 0, 10),
      fala(2, 'B', 10, 16),
      fala(3, 'C', 16, 20),
      fala(4, 'D', 20, 22),
    ];
    expect(atribuirVozes(falas, vozes)).toEqual({
      A: { voz: 'voz-1', repetida: false },
      B: { voz: 'voz-2', repetida: false },
      C: { voz: 'voz-1', repetida: true },
      D: { voz: 'voz-2', repetida: true },
    });
  });
});
