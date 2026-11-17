import { FalaRevisada, FalaTraduzida } from '../shared/types';

export interface Veredito {
  id: number;
  aprovado: boolean;
  motivo: string;
}

export const MAX_VOLTAS = 2;

// Juiz avalia todas; as reprovadas voltam ao tradutor com o motivo e são
// reavaliadas, até MAX_VOLTAS voltas. O que sobrar fica com a última versão
// e marcado como reprovada.
export async function revisarComJuiz(
  falas: FalaTraduzida[],
  juiz: { avaliar(falas: FalaTraduzida[]): Promise<Veredito[]> },
  tradutor: {
    refazer(falas: FalaTraduzida[], motivos: Map<number, string>): Promise<FalaTraduzida[]>;
  },
): Promise<FalaRevisada[]> {
  const atuais = new Map<number, FalaRevisada>(
    falas.map((f) => [f.id, { ...f, juiz: 'reprovada', tentativas: 1 }]),
  );

  let emAvaliacao = falas;
  for (let volta = 0; ; volta++) {
    const vereditos = await juiz.avaliar(emAvaliacao);
    const porId = new Map(vereditos.map((v) => [v.id, v]));
    const motivos = new Map<number, string>();
    for (const fala of emAvaliacao) {
      const veredito = porId.get(fala.id);
      if (!veredito) throw new Error(`Juiz não devolveu veredito da fala ${fala.id}`);
      const atual = atuais.get(fala.id)!;
      if (veredito.aprovado) {
        atual.juiz = 'aprovada';
        delete atual.motivoJuiz;
      } else {
        atual.motivoJuiz = veredito.motivo;
        motivos.set(fala.id, veredito.motivo);
      }
    }

    if (motivos.size === 0 || volta === MAX_VOLTAS) break;

    const reprovadas = emAvaliacao.filter((f) => motivos.has(f.id));
    const refeitas = await tradutor.refazer(reprovadas, motivos);
    for (const refeita of refeitas) {
      const atual = atuais.get(refeita.id)!;
      atuais.set(refeita.id, { ...atual, ...refeita, tentativas: atual.tentativas + 1 });
    }
    emAvaliacao = refeitas;
  }

  return falas.map((f) => atuais.get(f.id)!);
}
