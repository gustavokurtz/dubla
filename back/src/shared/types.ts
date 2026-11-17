export interface Segmento {
  start: number; // em segundos
  end: number;
  texto: string;
}

export interface SegmentoComAudio extends Segmento {
  audio: Buffer;
}

// Trecho contínuo de uma pessoa, cortado a partir das palavras com tempo.
export interface Fala {
  id: number;
  pessoa: string; // rótulo da AssemblyAI: 'A', 'B', ...
  inicio: number; // em segundos
  fim: number;
  textoEn: string;
}

// Fala depois da tradução: inglês corrigido (R4) e português para a voz (R5).
export interface FalaTraduzida extends Fala {
  textoEnCorrigido: string;
  textoPt: string;
}
