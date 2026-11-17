import {
  PRECO_TRANSCRICAO_POR_HORA,
  PRECO_VOZ_POR_MILHAO_DE_CARACTERES,
  PRECOS_CLAUDE,
} from './precos';

export interface UsoClaude {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
}

const MILHAO = 1_000_000;

// Custo em US$ de uma resposta da Claude, pelo modelo que de fato respondeu.
export function custoClaude(modelo: string, uso: UsoClaude): number {
  const tabela = PRECOS_CLAUDE[modelo];
  if (!tabela) throw new Error(`Sem preço para o modelo ${modelo} (custos/precos.ts)`);
  const escrita = uso.cache_creation_input_tokens ?? 0;
  const leitura = uso.cache_read_input_tokens ?? 0;
  const prompt = uso.input_tokens + escrita + leitura;
  const preco = tabela.acimaDe100k && prompt > 100_000 ? tabela.acimaDe100k : tabela.ate;
  return (
    (uso.input_tokens * preco.entrada +
      escrita * preco.escritaCache +
      leitura * preco.leituraCache +
      uso.output_tokens * preco.saida) /
    MILHAO
  );
}

export function custoTranscricao(segundos: number): number {
  return (segundos / 3600) * PRECO_TRANSCRICAO_POR_HORA;
}

export function custoVoz(caracteres: number): number {
  return (caracteres * PRECO_VOZ_POR_MILHAO_DE_CARACTERES) / MILHAO;
}
