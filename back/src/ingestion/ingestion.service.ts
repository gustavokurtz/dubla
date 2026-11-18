import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { FfmpegService } from '../ffmpeg/ffmpeg.service';
import { SeparacaoService } from '../separacao/separacao.service';
import { TranscricaoService } from '../transcricao/transcricao.service';
import { TraducaoService } from '../traducao/traducao.service';
import { JuizService } from '../traducao/juiz.service';
import { revisarComJuiz } from '../traducao/revisar-com-juiz';
import { VozService } from '../voz/voz.service';
import { YoutubeService } from '../youtube/youtube.service';
import { encaixarFalas } from '../encaixe/encaixar-falas';
import { gravarRelatorio, montarRelatorio } from '../relatorio/relatorio';
import { traceAtual } from '../trace/trace';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly ffmpeg: FfmpegService,
    private readonly separacao: SeparacaoService,
    private readonly transcricao: TranscricaoService,
    private readonly traducao: TraducaoService,
    private readonly juiz: JuizService,
    private readonly voz: VozService,
    private readonly youtube: YoutubeService,
  ) {}

  // Baixa o vídeo do YouTube e dubla com o título como nome (R12).
  async dublarLink(url: string): Promise<Buffer> {
    this.etapa('Baixando o vídeo');
    const { video, titulo } = await this.youtube.baixar(url);
    return this.dublar(video, titulo);
  }

  // Dubla o vídeo fala por fala, cada uma no instante da original, e grava o relatório.
  async dublar(video: Buffer, nome: string): Promise<Buffer> {
    this.logger.log(`Dublando "${nome}"`);
    this.etapa('Extraindo o áudio');
    const audio = await this.ffmpeg.extrairAudio(video);

    this.etapa('Separando voz e fundo');
    const { fundo } = await this.separacao.separar(audio);

    this.etapa('Transcrevendo');
    const falas = await this.transcricao.transcrever(audio);

    this.etapa('Traduzindo e revisando');
    const traduzidas = await this.traducao.traduzir(falas);
    const revisadas = await revisarComJuiz(traduzidas, this.juiz, this.traducao);

    this.etapa('Gerando as vozes', revisadas.length);
    const audios = await this.voz.gerarAudios(revisadas);
    for (const a of audios) a.audio = await this.ffmpeg.apararSilencio(a.audio);

    this.etapa('Encaixando as falas', revisadas.length);
    const encaixadas = await encaixarFalas(
      revisadas,
      audios,
      await this.ffmpeg.medirDuracao(video),
      {
        medir: (a) => this.ffmpeg.medirDuracao(a),
        encurtar: (f, alvo, motivo) => this.traducao.encurtar(f, alvo, motivo),
        sintetizar: async (id, texto, voz) =>
          this.ffmpeg.apararSilencio(await this.voz.sintetizar(id, texto, voz)),
      },
    );

    this.etapa('Montando o vídeo');
    const final = await this.ffmpeg.montarVideo(
      video,
      fundo,
      encaixadas.map((e) => ({ audio: e.audio, encaixe: e.fala.encaixe })),
    );

    const relatorio = montarRelatorio(
      nome,
      encaixadas.map((e) => e.fala),
    );
    const arquivo = await gravarRelatorio(
      relatorio,
      join(process.cwd(), '..', 'relatorios'),
      new Date(),
    );
    this.logger.log(`Relatório: ${arquivo}\n${JSON.stringify(relatorio.resumo, null, 2)}`);
    return final;
  }

  // Abre a etapa no trace do job (se houver) e deixa a linha no log do servidor.
  private etapa(nome: string, total?: number): void {
    this.logger.log(total === undefined ? nome : `${nome} (${total} falas)`);
    traceAtual()?.iniciarEtapa(nome, total);
  }
}
