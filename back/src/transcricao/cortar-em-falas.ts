import { Fala } from '../shared/types';

export interface PalavraComTempo {
  text: string;
  start: number; // ms
  end: number; // ms
  speaker: string | null;
}

const PAUSA_MS = 400;
const PAUSA_LONGA_MS = 1_500;
const MINIMO_MS = 1_500;
const MAXIMO_MS = 12_000;

// Corta as palavras da transcrição em falas. Sempre: troca de pessoa ou pausa
// >= 1,5 s. Em pausa >= 0,4 s ou fim de frase, só se o trecho já tem >= 1,5 s:
// pedaço menor que isso nenhuma voz diz a tempo (D2). Fala que passaria de 12 s
// é cortada depois da última vírgula (ou, sem vírgula, antes da palavra que estoura).
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
    const pausa = anterior ? palavra.start - anterior.end : 0;
    const trechoLongo = anterior && anterior.end - atual[0].start >= MINIMO_MS;
    if (
      anterior &&
      (palavra.speaker !== anterior.speaker ||
        pausa >= PAUSA_LONGA_MS ||
        (trechoLongo && (pausa >= PAUSA_MS || /[.?!]$/.test(anterior.text))))
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
