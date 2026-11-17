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
