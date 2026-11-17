// Preços em US$. Atualizar aqui quando mudarem.

// Claude: US$ por milhão de tokens. Fonte: skill claude-api (tabela de modelos, 2026-11-03).
// Escrita de cache = 1,25× a entrada (TTL de 5 min, o padrão).
export interface PrecoClaude {
  entrada: number;
  saida: number;
  escritaCache: number;
  leituraCache: number;
}

export interface TabelaClaude {
  ate: PrecoClaude;
  // Haiku 5.5 tem duas tabelas: acima de 100 mil tokens de prompt, vale a longa.
  acimaDe100k?: PrecoClaude;
}

export const PRECOS_CLAUDE: Record<string, TabelaClaude> = {
  'claude-opus-5-5': { ate: { entrada: 4, saida: 20, escritaCache: 5, leituraCache: 0.2 } },
  'claude-sonnet-5-5': { ate: { entrada: 2, saida: 10, escritaCache: 2.5, leituraCache: 0.1 } },
  // Para onde o Sonnet 5.5 cai quando recusa (fallback server-side).
  'claude-sonnet-5': { ate: { entrada: 2, saida: 10, escritaCache: 2.5, leituraCache: 0.2 } },
  'claude-haiku-5-5': {
    ate: { entrada: 0.1, saida: 0.5, escritaCache: 0.125, leituraCache: 0.01 },
    acimaDe100k: { entrada: 0.5, saida: 2.5, escritaCache: 0.625, leituraCache: 0.05 },
  },
};

// AssemblyAI. Fonte: https://www.assemblyai.com/pricing (consultado em 2026-11-17).
// Transcrição: modelo padrão AssemblyAI-STT-3.7 ($0,21/h) + speaker labels ($0,02/h)
// + keyterms prompting ($0,05/h).
export const PRECO_TRANSCRICAO_POR_HORA = 0.21 + 0.02 + 0.05;
// Voz (TTS): $15 por milhão de caracteres enviados.
export const PRECO_VOZ_POR_MILHAO_DE_CARACTERES = 15;
