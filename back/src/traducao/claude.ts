import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const MODELO = 'claude-opus-5-5';
const logger = new Logger('Claude');

// Uma chamada ao Claude com saída estruturada, usada pelo tradutor e pelo juiz.
// Resposta cortada, recusada ou fora do formato é erro explícito.
export async function chamarClaude<T>(
  cliente: Anthropic,
  system: string,
  schema: z.ZodType<T>,
  conteudo: string,
): Promise<T> {
  const stream = cliente.beta.messages.stream({
    model: MODELO,
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: 'user', content: conteudo }],
  });
  const resposta = await stream.finalMessage();
  logger.log(
    `${resposta.model}: ${resposta.usage.input_tokens} tokens de entrada, ${resposta.usage.output_tokens} de saída`,
  );
  if (resposta.stop_reason !== 'end_turn' || !resposta.parsed_output) {
    throw new Error(`Claude sem resposta válida (stop_reason: ${resposta.stop_reason})`);
  }
  return resposta.parsed_output;
}
