import { EncaixeDaFala, FalaRevisada } from '../shared/types';
import { FalaNoRelatorio } from '../relatorio/relatorio';
import { AudioDaFala } from '../voz/voz.service';
import { planejarEncaixe } from './planejar-encaixe';

export interface FalaEncaixada {
  fala: FalaNoRelatorio & { encaixe: EncaixeDaFala }; // com o português final
  audio: Buffer; // áudio final, já regerado se a fala foi encurtada
}

interface Dependencias {
  medir(audio: Buffer): Promise<number>; // duração em segundos
  encurtar(fala: FalaRevisada, alvoChars: number, motivo: string): Promise<string>;
  sintetizar(id: number, texto: string, voz: string): Promise<Buffer>;
}

// Laço do encaixe (R2): mede o áudio, e enquanto planejarEncaixe pedir, encurta a
// fala com o tradutor e regera a voz. Limite de cada fala = início da próxima;
// da última, o fim do vídeo.
export async function encaixarFalas(
  falas: FalaRevisada[],
  audios: AudioDaFala[],
  fimDoVideo: number,
  deps: Dependencias,
): Promise<FalaEncaixada[]> {
  const audioPorId = new Map(audios.map((a) => [a.id, a]));
  const resultado: FalaEncaixada[] = [];

  for (const [i, original] of falas.entries()) {
    const gerado = audioPorId.get(original.id);
    if (!gerado) throw new Error(`Fala ${original.id} sem áudio dublado`);
    const limite = falas[i + 1]?.inicio ?? fimDoVideo;
    const espaco = Math.min(original.fim, limite) - original.inicio;
    let fala = original;
    let audio = gerado.audio;
    let encurtamentos = 0;

    for (;;) {
      const duracaoAudio = await deps.medir(audio);
      const encaixe = planejarEncaixe({
        inicio: fala.inicio,
        fim: fala.fim,
        limite,
        duracaoAudio,
        encurtamentos,
      });
      if (encaixe.acao !== 'encurtar') {
        resultado.push({ fala: { ...fala, encaixe }, audio });
        break;
      }
      const alvo = Math.floor((fala.textoPt.length * espaco) / duracaoAudio);
      const motivo = `o áudio dublado tem ${duracaoAudio.toFixed(1)} s e o espaço é de ${espaco.toFixed(1)} s`;
      const textoPt = await deps.encurtar(fala, alvo, motivo);
      fala = { ...fala, textoPt };
      audio = await deps.sintetizar(fala.id, textoPt, gerado.voz);
      encurtamentos++;
    }
  }
  return resultado;
}
