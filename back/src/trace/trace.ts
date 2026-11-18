import { AsyncLocalStorage } from 'async_hooks';

export interface Etapa {
  nome: string;
  inicio: Date;
  fim?: Date;
  feito?: number;
  total?: number;
  erro?: string;
}

export type Servico = 'claude' | 'assemblyai-transcricao' | 'assemblyai-voz';

export interface Chamada {
  servico: Servico;
  etapa?: number; // índice em etapas; sem etapa aberta (ex.: scripts) fica vazio
  papel?: string; // Claude: traducao, juiz, refazer, encurtar
  modelo?: string;
  entrada?: number; // tokens
  saida?: number; // tokens
  segundos?: number; // áudio transcrito
  caracteres?: number; // texto enviado para virar voz
  quantidade?: number; // vozes somadas nesta linha
  custo: number; // US$
  duracaoMs: number;
}

export interface EventoTrace {
  tipo: 'etapa' | 'progresso' | 'chamada';
}

// Etapas e chamadas pagas de uma dublagem, com aviso a quem acompanha.
export class Trace {
  readonly etapas: Etapa[] = [];
  readonly chamadas: Chamada[] = [];
  private readonly ouvintes = new Set<(evento: EventoTrace) => void>();

  iniciarEtapa(nome: string, total?: number): void {
    this.fecharCorrente();
    this.etapas.push({ nome, inicio: new Date(), ...(total !== undefined && { feito: 0, total }) });
    this.emitir('etapa');
  }

  avancar(): void {
    const etapa = this.corrente();
    if (!etapa) return;
    etapa.feito = (etapa.feito ?? 0) + 1;
    this.emitir('progresso');
  }

  encerrarEtapa(): void {
    this.fecharCorrente();
    this.emitir('etapa');
  }

  falhar(erro: string): void {
    const etapa = this.corrente();
    if (etapa) etapa.erro = erro;
    this.encerrarEtapa();
  }

  registrar(chamada: Omit<Chamada, 'etapa'>): void {
    this.chamadas.push({ ...chamada, etapa: this.indiceCorrente() });
    this.emitir('chamada');
  }

  // As vozes são muitas e baratas: uma linha por etapa, somada.
  somarVoz(caracteres: number, custo: number, duracaoMs: number): void {
    const etapa = this.indiceCorrente();
    const linha = this.chamadas.find((c) => c.servico === 'assemblyai-voz' && c.etapa === etapa);
    if (linha) {
      linha.quantidade = (linha.quantidade ?? 0) + 1;
      linha.caracteres = (linha.caracteres ?? 0) + caracteres;
      linha.custo += custo;
      linha.duracaoMs += duracaoMs;
    } else {
      this.chamadas.push({
        servico: 'assemblyai-voz',
        etapa,
        quantidade: 1,
        caracteres,
        custo,
        duracaoMs,
      });
    }
    this.emitir('chamada');
  }

  custoDaEtapa(indice: number): number {
    return this.chamadas.filter((c) => c.etapa === indice).reduce((s, c) => s + c.custo, 0);
  }

  custoTotal(): number {
    return this.chamadas.reduce((s, c) => s + c.custo, 0);
  }

  assinar(ouvinte: (evento: EventoTrace) => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  private corrente(): Etapa | undefined {
    const ultima = this.etapas.at(-1);
    return ultima && !ultima.fim ? ultima : undefined;
  }

  private indiceCorrente(): number | undefined {
    return this.corrente() ? this.etapas.length - 1 : undefined;
  }

  private fecharCorrente(): void {
    const etapa = this.corrente();
    if (etapa) etapa.fim = new Date();
  }

  private emitir(tipo: EventoTrace['tipo']): void {
    for (const ouvinte of this.ouvintes) ouvinte({ tipo });
  }
}

const armazem = new AsyncLocalStorage<Trace>();

// O trace da dublagem em andamento; fora de uma (ex.: scripts) é undefined.
export function traceAtual(): Trace | undefined {
  return armazem.getStore();
}

export function rodarNoTrace<T>(trace: Trace, fn: () => Promise<T>): Promise<T> {
  return armazem.run(trace, fn);
}
