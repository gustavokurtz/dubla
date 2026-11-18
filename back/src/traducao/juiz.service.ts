import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { FalaTraduzida } from '../shared/types';
import { GUIA_TATAME } from './guia-bjj';
import { chamarClaude } from './claude';
import { entradaDaFala } from './traducao.service';
import { Veredito } from './revisar-com-juiz';

// O juiz só julga; quem reescreve é o tradutor. Assim o critério de
// reprovação fica separado da escrita.
const SYSTEM = `
Você é o juiz de uma dublagem de jiu-jitsu para o português do Brasil. Para cada fala você recebe o inglês, a tradução, a duração em segundos e o alvo de caracteres. Aprove ou reprove cada fala por estes critérios:

1. Termo de jiu-jitsu: o nome da técnica, posição ou pegada é o que se usa no tatame brasileiro, segundo o guia abaixo (o que fica em inglês fica em inglês; o que se traduz usa o termo do tatame).
2. Naturalidade: soa como um professor brasileiro falando, não como tradução automática nem português de livro.
3. Sentido: diz a mesma coisa que o inglês, sem perder a instrução técnica e sem inventar.
4. Tempo: cabe na duração, sem passar muito do alvo de caracteres.

Reprove só por um problema concreto num desses critérios. Ao reprovar, o motivo diz em uma frase o que está errado e como se fala certo (ex.: "heel hook se fala em inglês no tatame, não 'chave de calcanhar'"). Ao aprovar, o motivo fica vazio. Devolva um veredito para cada fala, com o mesmo id.

${GUIA_TATAME}
`.trim();

const SaidaJuiz = z.object({
  vereditos: z.array(
    z.object({
      id: z.number().int(),
      aprovado: z.boolean(),
      motivo: z.string(),
    }),
  ),
});

@Injectable()
export class JuizService {
  private readonly logger = new Logger(JuizService.name);
  private readonly cliente: Anthropic;

  constructor(config: ConfigService) {
    this.cliente = new Anthropic({ apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY') });
  }

  async avaliar(falas: FalaTraduzida[]): Promise<Veredito[]> {
    this.logger.log(`Juiz avaliando ${falas.length} falas`);
    const entrada = falas.map((f) => ({
      ...entradaDaFala(f),
      textoEn: f.textoEnCorrigido,
      textoPt: f.textoPt,
    }));
    const saida = await chamarClaude(
      this.cliente,
      { papel: 'juiz' },
      SYSTEM,
      SaidaJuiz,
      `Falas para julgar:\n\n${JSON.stringify(entrada, null, 2)}`,
    );
    return saida.vereditos;
  }
}
