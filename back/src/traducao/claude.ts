import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { custoClaude } from '../custos/custo';
import { traceAtual } from '../trace/trace';

const logger = new Logger('Claude');

export type Papel = 'traducao' | 'refazer' | 'encurtar' | 'juiz';

// Modelo e esforço de cada papel. O Haiku 5.5 não tem fallback server-side.
// Tradutor em esforço alto: em médio o Sonnet passava do alvo de caracteres
// em 16 de 72 falas do arm bar; em alto, 4 (T5).
const TRADUTOR = { modelo: 'claude-sonnet-5-5', esforco: 'high', fallback: true } as const;
const POR_PAPEL = {
  traducao: TRADUTOR,
  refazer: TRADUTOR,
  encurtar: TRADUTOR,
  juiz: { modelo: 'claude-haiku-5-5', esforco: 'medium', fallback: false },
} as const;

// Uma chamada ao Claude com saída estruturada, usada pelo tradutor e pelo juiz.
// Resposta cortada, recusada ou fora do formato é erro explícito, mas fica
// registrada no trace antes, porque foi cobrada.
export async function chamarClaude<T>(
  cliente: Anthropic,
  opcoes: { papel: Papel },
  system: string,
  schema: z.ZodType<T>,
  conteudo: string,
): Promise<T> {
  const inicio = Date.now();
  const { modelo, esforco, fallback } = POR_PAPEL[opcoes.papel];
  const stream = cliente.beta.messages.stream({
    model: modelo,
    max_tokens: 64000,
    ...(fallback && {
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default' as const,
    }),
    output_config: { effort: esforco, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: 'user', content: conteudo }],
  });
  const resposta = await stream.finalMessage();
  const custo = custoClaude(resposta.model, resposta.usage);
  logger.log(
    `${opcoes.papel} (${resposta.model}): ${resposta.usage.input_tokens} tokens de entrada, ${resposta.usage.output_tokens} de saída, US$ ${custo.toFixed(4)}`,
  );
  traceAtual()?.registrar({
    servico: 'claude',
    papel: opcoes.papel,
    modelo: resposta.model,
    entrada: resposta.usage.input_tokens,
    saida: resposta.usage.output_tokens,
    custo,
    duracaoMs: Date.now() - inicio,
  });
  if (resposta.stop_reason !== 'end_turn' || !resposta.parsed_output) {
    throw new Error(`Claude sem resposta válida (stop_reason: ${resposta.stop_reason})`);
  }
  return resposta.parsed_output;
}
