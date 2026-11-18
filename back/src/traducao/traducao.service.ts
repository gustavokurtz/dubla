import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { Fala, FalaTraduzida } from '../shared/types';
import { GUIA_TATAME } from './guia-bjj';
import { chamarClaude } from './claude';

// Estimativa de quanto texto cabe por segundo de fala. É só alvo para o
// tradutor: quem decide se cabe é a duração medida do áudio gerado (T9).
export const CHARS_POR_SEGUNDO = 14;

const SYSTEM = `
Você é um dublador brasileiro de vídeos de jiu-jitsu. Recebe as falas de um vídeo em inglês, transcritas automaticamente, e devolve para cada fala:

- textoEnCorrigido: o inglês com os erros de transcrição corrigidos (termos de jiu-jitsu mal reconhecidos, palavras trocadas pelo som). Não reescreva o que já está certo.
- textoPt: a fala em português do Brasil, do jeito que um professor brasileiro falaria no tatame, seguindo o guia abaixo.

Cada fala vem com a duração em segundos e um alvo de caracteres. A dublagem precisa caber no tempo da fala original: fique perto do alvo e nunca muito acima dele. Se o inglês tem mais conteúdo do que cabe, corte o que é enchimento e mantenha a instrução técnica.

Use o vídeo inteiro como contexto para resolver ambiguidades (o que é "pass", "base", "frame" depende da cena). Devolva todas as falas, com o mesmo id, sem juntar nem dividir falas.

${GUIA_TATAME}
`.trim();

const SaidaTraducao = z.object({
  falas: z.array(
    z.object({
      id: z.number().int(),
      textoEnCorrigido: z.string(),
      textoPt: z.string(),
    }),
  ),
});

const SaidaEncurtar = z.object({ textoPt: z.string() });

@Injectable()
export class TraducaoService {
  private readonly logger = new Logger(TraducaoService.name);
  private readonly cliente: Anthropic;

  constructor(config: ConfigService) {
    this.cliente = new Anthropic({ apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY') });
  }

  // Corrige o inglês e traduz todas as falas do vídeo numa chamada só.
  async traduzir(falas: Fala[]): Promise<FalaTraduzida[]> {
    this.logger.log(`Traduzindo ${falas.length} falas`);
    const saida = await chamarClaude(
      this.cliente,
      { papel: 'traducao' },
      SYSTEM,
      SaidaTraducao,
      `Falas do vídeo, em ordem:\n\n${JSON.stringify(falas.map(entradaDaFala), null, 2)}`,
    );
    return aplicarTraducao(falas, saida.falas);
  }

  // Traduz de novo as falas que o juiz reprovou, com o motivo de cada uma.
  async refazer(
    reprovadas: FalaTraduzida[],
    motivos: Map<number, string>,
  ): Promise<FalaTraduzida[]> {
    this.logger.log(`Refazendo ${reprovadas.length} falas reprovadas pelo juiz`);
    const entrada = reprovadas.map((f) => ({
      ...entradaDaFala(f),
      textoEn: f.textoEnCorrigido,
      textoPtReprovado: f.textoPt,
      motivoDoJuiz: motivos.get(f.id),
    }));
    const saida = await chamarClaude(
      this.cliente,
      { papel: 'refazer' },
      SYSTEM,
      SaidaTraducao,
      `O revisor reprovou estas falas. Escreva uma nova versão em português de cada uma, corrigindo o que o motivo aponta.\n\n${JSON.stringify(entrada, null, 2)}`,
    );
    return aplicarTraducao(reprovadas, saida.falas);
  }

  // Reescreve uma fala mais curta para caber no tempo (usado no encaixe).
  async encurtar(fala: FalaTraduzida, alvoChars: number, motivo: string): Promise<string> {
    const pedido = {
      textoEn: fala.textoEnCorrigido,
      textoPtAtual: fala.textoPt,
      alvoCaracteres: alvoChars,
      motivo,
    };
    const saida = await chamarClaude(
      this.cliente,
      { papel: 'encurtar' },
      SYSTEM,
      SaidaEncurtar,
      `Esta fala dublada não cabe no tempo. Reescreva o português mais curto, com no máximo o alvo de caracteres, mantendo a instrução técnica e o registro do tatame. Devolva só essa fala.\n\n${JSON.stringify(pedido, null, 2)}`,
    );
    if (!saida.textoPt.trim()) {
      throw new Error(`Tradutor devolveu a fala ${fala.id} encurtada vazia`);
    }
    return saida.textoPt;
  }
}

// O que o modelo vê de cada fala: tempo disponível e alvo de caracteres.
export function entradaDaFala(f: Fala) {
  const duracao = f.fim - f.inicio;
  return {
    id: f.id,
    pessoa: f.pessoa,
    duracaoSegundos: Number(duracao.toFixed(1)),
    alvoCaracteres: Math.round(duracao * CHARS_POR_SEGUNDO),
    textoEn: f.textoEn,
  };
}

// Junta a saída do modelo às falas por id; fala sem português é erro.
function aplicarTraducao(
  falas: Fala[],
  saida: z.infer<typeof SaidaTraducao>['falas'],
): FalaTraduzida[] {
  const porId = new Map(saida.map((f) => [f.id, f]));
  return falas.map((fala) => {
    const traduzida = porId.get(fala.id);
    if (!traduzida || !traduzida.textoPt.trim()) {
      throw new Error(`Tradutor não devolveu o português da fala ${fala.id}`);
    }
    return {
      ...fala,
      textoEnCorrigido: traduzida.textoEnCorrigido,
      textoPt: traduzida.textoPt,
    };
  });
}
