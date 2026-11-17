import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { chamarClaude } from './claude';
import { rodarNoTrace, Trace } from '../trace/trace';

const Schema = z.object({ ok: z.boolean() });

function clienteQueResponde(resposta: object) {
  return {
    beta: { messages: { stream: () => ({ finalMessage: () => Promise.resolve(resposta) }) } },
  } as unknown as Anthropic;
}

const respostaOk = {
  model: 'claude-sonnet-5-5',
  usage: {
    input_tokens: 9800,
    output_tokens: 7200,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
  },
  stop_reason: 'end_turn',
  parsed_output: { ok: true },
};

describe('chamarClaude', () => {
  it('registra no trace o papel, o modelo que respondeu, os tokens e o custo', async () => {
    const trace = new Trace();
    trace.iniciarEtapa('Traduzindo e revisando');

    await rodarNoTrace(trace, () =>
      chamarClaude(clienteQueResponde(respostaOk), { papel: 'traducao' }, 's', Schema, 'c'),
    );

    expect(trace.chamadas).toEqual([
      expect.objectContaining({
        servico: 'claude',
        etapa: 0,
        papel: 'traducao',
        modelo: 'claude-sonnet-5-5',
        entrada: 9800,
        saida: 7200,
      }),
    ]);
    expect(trace.chamadas[0].custo).toBeCloseTo(0.0916, 10);
  });

  it('resposta recusada também é registrada, porque foi cobrada', async () => {
    const trace = new Trace();
    const recusada = { ...respostaOk, stop_reason: 'refusal', parsed_output: null };

    await expect(
      rodarNoTrace(trace, () =>
        chamarClaude(clienteQueResponde(recusada), { papel: 'juiz' }, 's', Schema, 'c'),
      ),
    ).rejects.toThrow(/refusal/);
    expect(trace.chamadas).toHaveLength(1);
  });

  it('fora de um trace só devolve a resposta', async () => {
    await expect(
      chamarClaude(clienteQueResponde(respostaOk), { papel: 'traducao' }, 's', Schema, 'c'),
    ).resolves.toEqual({ ok: true });
  });
});
