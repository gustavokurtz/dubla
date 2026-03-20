export interface Segmento {
  start: number; // em segundos
  end: number;
  texto: string;
}

export interface SegmentoComAudio extends Segmento {
  audio: Buffer;
}
