import { revisarComJuiz, Veredito } from './revisar-com-juiz';
import { FalaTraduzida } from '../shared/types';

const falas: FalaTraduzida[] = [
  {
    id: 0,
    pessoa: 'A',
    inicio: 0,
    fim: 2,
    textoEn: 'a',
    textoEnCorrigido: 'a',
    textoPt: 'Pega a gola.',
  },
  {
    id: 1,
    pessoa: 'A',
    inicio: 2,
    fim: 4,
    textoEn: 'b',
    textoEnCorrigido: 'b',
    textoPt: 'Aplica a chave de calcanhar.',
  },
];

// O tradutor devolve cada fala reprovada com um texto novo numerado pela volta.
function tradutorFalso() {
  let volta = 0;
  return {
    refazer: jest.fn((reprovadas: FalaTraduzida[]) => {
      volta++;
      return Promise.resolve(reprovadas.map((f) => ({ ...f, textoPt: `versão ${volta + 1}` })));
    }),
  };
}

function juizFalso(rodadas: Veredito[][]) {
  const avaliar = jest.fn<Promise<Veredito[]>, [FalaTraduzida[]]>();
  for (const r of rodadas) avaliar.mockResolvedValueOnce(r);
  return { avaliar };
}

describe('revisarComJuiz', () => {
  it('aprova de primeira: não volta ao tradutor', async () => {
    const juiz = juizFalso([
      [
        { id: 0, aprovado: true, motivo: '' },
        { id: 1, aprovado: true, motivo: '' },
      ],
    ]);
    const tradutor = tradutorFalso();

    const revisadas = await revisarComJuiz(falas, juiz, tradutor);

    expect(tradutor.refazer).not.toHaveBeenCalled();
    expect(revisadas.map((f) => [f.id, f.juiz, f.tentativas])).toEqual([
      [0, 'aprovada', 1],
      [1, 'aprovada', 1],
    ]);
  });

  it('reprova uma vez: volta ao tradutor com o motivo e o juiz só reavalia a refeita', async () => {
    const juiz = juizFalso([
      [
        { id: 0, aprovado: true, motivo: '' },
        { id: 1, aprovado: false, motivo: 'heel hook se fala em inglês' },
      ],
      [{ id: 1, aprovado: true, motivo: '' }],
    ]);
    const tradutor = tradutorFalso();

    const revisadas = await revisarComJuiz(falas, juiz, tradutor);

    expect(tradutor.refazer).toHaveBeenCalledTimes(1);
    const [reprovadas, motivos] = tradutor.refazer.mock.calls[0] as unknown as [
      FalaTraduzida[],
      Map<number, string>,
    ];
    expect(reprovadas.map((f) => f.id)).toEqual([1]);
    expect(motivos.get(1)).toBe('heel hook se fala em inglês');
    expect(juiz.avaliar.mock.calls[1][0].map((f) => f.id)).toEqual([1]);
    expect(revisadas[0]).toMatchObject({
      juiz: 'aprovada',
      tentativas: 1,
      textoPt: 'Pega a gola.',
    });
    expect(revisadas[1]).toMatchObject({ juiz: 'aprovada', tentativas: 2, textoPt: 'versão 2' });
  });

  it('reprova sempre: para em 2 voltas, fica com a última versão e marca reprovada', async () => {
    const reprova = [{ id: 1, aprovado: false, motivo: 'soa traduzido' }];
    const juiz = juizFalso([[{ id: 0, aprovado: true, motivo: '' }, ...reprova], reprova, reprova]);
    const tradutor = tradutorFalso();

    const revisadas = await revisarComJuiz(falas, juiz, tradutor);

    expect(tradutor.refazer).toHaveBeenCalledTimes(2);
    expect(juiz.avaliar).toHaveBeenCalledTimes(3);
    expect(revisadas[1]).toMatchObject({
      juiz: 'reprovada',
      tentativas: 3,
      textoPt: 'versão 3',
      motivoJuiz: 'soa traduzido',
    });
  });

  it('falha explicitamente quando o juiz não devolve veredito de uma fala', async () => {
    const juiz = juizFalso([[{ id: 0, aprovado: true, motivo: '' }]]);
    await expect(revisarComJuiz(falas, juiz, tradutorFalso())).rejects.toThrow(/fala 1/);
  });
});
