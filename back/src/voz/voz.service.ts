import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Fala } from '../shared/types';
import { atribuirVozes } from './atribuir-vozes';

// Vozes prontas PT da AssemblyAI escolhidas pelo dev (T1): quem mais fala primeiro.
export const VOZES_PT = ['aai-cassio', 'aai-benicio'];

const URL_FALA = 'https://tts.us.assemblyai.com/v1/speech';

// Limite da conta na AssemblyAI: 50 pedidos por minuto (resposta 429 acima disso).
// A janela tem 1 s de folga para não encostar no relógio do servidor.
const PEDIDOS_POR_JANELA = 50;
const JANELA_MS = 61_000;

export interface AudioDaFala {
  id: number;
  voz: string;
  audio: Buffer; // mp3
}

const TENTATIVAS = 3;

// Segundos que a API pede para esperar, ou null quando o erro não é passageiro.
function esperaPedida(corpo: string): number | null {
  try {
    const erro = JSON.parse(corpo) as { retryable?: boolean; retry_after_seconds?: number };
    return erro.retryable ? (erro.retry_after_seconds ?? 5) : null;
  } catch {
    return null; // corpo que não é JSON: erro da API sem marcação, não é passageiro
  }
}

@Injectable()
export class VozService {
  private readonly logger = new Logger(VozService.name);
  private readonly chave: string;
  private readonly pedidosRecentes: number[] = []; // instantes dos últimos pedidos (ms)

  constructor(config: ConfigService) {
    this.chave = config.getOrThrow<string>('ASSEMBLYAI_API_KEY');
  }

  // Gera o áudio de cada fala com a voz fixa da pessoa que a disse.
  async gerarAudios(falas: (Fala & { textoPt: string })[]): Promise<AudioDaFala[]> {
    const vozes = atribuirVozes(falas, VOZES_PT);
    this.logger.log(`Gerando voz de ${falas.length} falas: ${JSON.stringify(vozes)}`);
    const audios: AudioDaFala[] = [];
    for (const f of falas) {
      const voz = vozes[f.pessoa].voz;
      audios.push({ id: f.id, voz, audio: await this.sintetizar(f.id, f.textoPt, voz) });
    }
    return audios;
  }

  // Uma fala em mp3. Pública porque o encaixe regera a fala depois de encurtar.
  // Erro que a API marca como passageiro (retryable) é tentado de novo depois do tempo
  // que ela pede, até TENTATIVAS vezes; os outros derrubam na hora.
  async sintetizar(id: number, texto: string, voz: string): Promise<Buffer> {
    for (let tentativa = 1; ; tentativa++) {
      await this.respeitarLimite();
      const resposta = await fetch(URL_FALA, {
        method: 'POST',
        headers: { Authorization: this.chave, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: texto,
          voice_id: voz,
          language: 'portuguese',
          encoding: 'mp3',
          stream: false,
        }),
      });
      if (resposta.ok) return Buffer.from(await resposta.arrayBuffer());

      const corpo = await resposta.text();
      const espera = esperaPedida(corpo);
      if (espera === null || tentativa === TENTATIVAS) {
        throw new Error(`Voz da fala ${id} falhou: HTTP ${resposta.status} ${corpo}`);
      }
      this.logger.warn(
        `Voz da fala ${id}: HTTP ${resposta.status}, tentando de novo em ${espera} s`,
      );
      await new Promise((resolve) => setTimeout(resolve, espera * 1000));
    }
  }

  // Espera até haver vaga na janela de 1 minuto antes de cada pedido.
  private async respeitarLimite(): Promise<void> {
    for (;;) {
      const agora = Date.now();
      while (this.pedidosRecentes.length && agora - this.pedidosRecentes[0] >= JANELA_MS) {
        this.pedidosRecentes.shift();
      }
      if (this.pedidosRecentes.length < PEDIDOS_POR_JANELA) {
        this.pedidosRecentes.push(agora);
        return;
      }
      const espera = JANELA_MS - (agora - this.pedidosRecentes[0]);
      this.logger.log(`Limite de 50 vozes/min: esperando ${Math.ceil(espera / 1000)} s`);
      await new Promise((resolve) => setTimeout(resolve, espera));
    }
  }
}
