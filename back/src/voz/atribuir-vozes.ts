import { Fala } from '../shared/types';

export interface VozDaPessoa {
  voz: string;
  repetida: boolean; // true quando a pessoa divide a voz com outra (3ª pessoa em diante)
}

// Quem fala mais tempo no vídeo fica com a 1ª voz, o seguinte com a 2ª;
// da 3ª pessoa em diante as vozes se repetem em rodízio (R7).
export function atribuirVozes(falas: Fala[], vozes: string[]): Record<string, VozDaPessoa> {
  const tempoPorPessoa = new Map<string, number>();
  for (const f of falas) {
    tempoPorPessoa.set(f.pessoa, (tempoPorPessoa.get(f.pessoa) ?? 0) + (f.fim - f.inicio));
  }
  const pessoas = [...tempoPorPessoa.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  return Object.fromEntries(
    pessoas.map((pessoa, i) => [
      pessoa,
      { voz: vozes[i % vozes.length], repetida: i >= vozes.length },
    ]),
  );
}
