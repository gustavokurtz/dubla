import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { custoClaude } from '../custos/custo';
import { traceAtual } from '../trace/trace';

const MODELO = 'claude-opus-5-5';
const logger = new Logger('Claude');

export type Papel = 'traducao' | 'refazer' | 'encurtar' | 'juiz';

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
