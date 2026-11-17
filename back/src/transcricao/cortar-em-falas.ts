import { Fala } from '../shared/types';

export interface PalavraComTempo {
  text: string;
  start: number; // ms
  end: number; // ms
  speaker: string | null;
}

const PAUSA_MS = 400;
const MAXIMO_MS = 12_000;

// Corta as palavras da transcrição em falas: troca de pessoa, pausa >= 0,4 s
// ou fim de frase. Fala que passaria de 12 s é cortada depois da última
// vírgula (ou, sem vírgula, antes da palavra que estoura).
export function cortarEmFalas(palavras: PalavraComTempo[]): Fala[] {
  const falas: Fala[] = [];
  const fechar = (trecho: PalavraComTempo[]) => {
    if (trecho.length === 0) return;
    falas.push({
      id: falas.length + 1,
      pessoa: trecho[0].speaker as string,
      inicio: trecho[0].start / 1000,
      fim: trecho[trecho.length - 1].end / 1000,
      textoEn: trecho.map((p) => p.text).join(' '),
    });
  };

  let atual: PalavraComTempo[] = [];
  for (const palavra of palavras) {
    if (palavra.speaker === null) {
      throw new Error(
        `Palavra "${palavra.text}" em ${palavra.start} ms sem pessoa (speaker_labels desligado?)`,
      );
    }
    const anterior = atual[atual.length - 1];
    if (
      anterior &&
      (palavra.speaker !== anterior.speaker ||
        palavra.start - anterior.end >= PAUSA_MS ||
        /[.?!]$/.test(anterior.text))
    ) {
      fechar(atual);
      atual = [];
    } else if (anterior && palavra.end - atual[0].start > MAXIMO_MS) {
      const virgula = atual.findLastIndex((p) => p.text.endsWith(','));
      if (virgula >= 0 && virgula < atual.length - 1) {
        fechar(atual.slice(0, virgula + 1));
        atual = atual.slice(virgula + 1);
      }
      if (palavra.end - atual[0].start > MAXIMO_MS) {
        fechar(atual);
        atual = [];
      }
    }
    atual.push(palavra);
  }
  fechar(atual);
  return falas;
}
