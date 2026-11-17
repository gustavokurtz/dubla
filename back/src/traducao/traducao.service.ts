import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { Fala, FalaTraduzida } from '../shared/types';
import { GUIA_TATAME } from './guia-bjj';

// Estimativa de quanto texto cabe por segundo de fala. É só alvo para o
// tradutor: quem decide se cabe é a duração medida do áudio gerado (T9).
export const CHARS_POR_SEGUNDO = 14;

const MODELO = 'claude-opus-5-5';

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
    const entrada = falas.map((f) => {
      const duracao = f.fim - f.inicio;
      return {
        id: f.id,
        pessoa: f.pessoa,
        duracaoSegundos: Number(duracao.toFixed(1)),
        alvoCaracteres: Math.round(duracao * CHARS_POR_SEGUNDO),
        textoEn: f.textoEn,
      };
    });
    const saida = await this.chamar(
      SaidaTraducao,
      `Falas do vídeo, em ordem:\n\n${JSON.stringify(entrada, null, 2)}`,
    );

    const porId = new Map(saida.falas.map((f) => [f.id, f]));
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

  // Reescreve uma fala mais curta para caber no tempo (usado no encaixe).
  async encurtar(fala: FalaTraduzida, alvoChars: number, motivo: string): Promise<string> {
    const pedido = {
      textoEn: fala.textoEnCorrigido,
      textoPtAtual: fala.textoPt,
      alvoCaracteres: alvoChars,
      motivo,
    };
    const saida = await this.chamar(
      SaidaEncurtar,
      `Esta fala dublada não cabe no tempo. Reescreva o português mais curto, com no máximo o alvo de caracteres, mantendo a instrução técnica e o registro do tatame. Devolva só essa fala.\n\n${JSON.stringify(pedido, null, 2)}`,
    );
    if (!saida.textoPt.trim()) {
      throw new Error(`Tradutor devolveu a fala ${fala.id} encurtada vazia`);
    }
    return saida.textoPt;
  }

  private async chamar<T>(schema: z.ZodType<T>, conteudo: string): Promise<T> {
    const stream = this.cliente.beta.messages.stream({
      model: MODELO,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: betaZodOutputFormat(schema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: conteudo }],
    });
    const resposta = await stream.finalMessage();
    if (resposta.stop_reason !== 'end_turn' || !resposta.parsed_output) {
      throw new Error(`Tradutor sem resposta válida (stop_reason: ${resposta.stop_reason})`);
    }
    return resposta.parsed_output;
  }
}
