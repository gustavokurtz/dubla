import { EncaixeDaFala } from '../shared/types';

export const ATEMPO_MAXIMO = 1.15;
export const MAXIMO_DE_ENCURTAMENTOS = 3;

export interface FalaParaEncaixar {
  inicio: number; // da fala original, em segundos
  fim: number;
  limite: number; // início da próxima fala, ou fim do vídeo na última
  duracaoAudio: number; // duração medida do áudio dublado
  encurtamentos: number; // quantas vezes o tradutor já encurtou esta fala
}

// Decide como a fala dublada cabe no tempo (R2): encurtar → acelerar até 15% →
// avançar sobre o silêncio até o limite. Só pede outro encurtamento quando nem
// acelerando e avançando cabe; depois do 3º, corta no limite.
// `acao: 'encurtar'` é o pedido para o orquestrador encurtar, regerar e chamar de novo.
export function planejarEncaixe(f: FalaParaEncaixar): EncaixeDaFala {
  const espaco = Math.min(f.fim, f.limite) - f.inicio;
  const folga = f.limite - f.inicio;
  const encaixe = (acao: EncaixeDaFala['acao'], atempo: number, fimDublado: number) => ({
    acao,
    atempo,
    inicioDublado: f.inicio,
    fimDublado,
    encurtamentos: f.encurtamentos,
  });

  if (f.duracaoAudio <= espaco) return encaixe('ok', 1, f.inicio + f.duracaoAudio);
  if (f.encurtamentos === 0) return encaixe('encurtar', 1, f.inicio + f.duracaoAudio);
  if (f.duracaoAudio / ATEMPO_MAXIMO <= espaco) {
    // Arredonda para cima: a fala acelerada nunca passa do espaço.
    const atempo = Math.ceil((f.duracaoAudio / espaco) * 1000 - 1e-9) / 1000;
    return encaixe('acelerar', atempo, f.inicio + espaco);
  }
  if (f.duracaoAudio / ATEMPO_MAXIMO <= folga) {
    return encaixe('avancar', ATEMPO_MAXIMO, f.inicio + f.duracaoAudio / ATEMPO_MAXIMO);
  }
  if (f.encurtamentos < MAXIMO_DE_ENCURTAMENTOS) {
    return encaixe('encurtar', 1, f.inicio + f.duracaoAudio);
  }
  return encaixe('cortar', ATEMPO_MAXIMO, f.limite);
}
