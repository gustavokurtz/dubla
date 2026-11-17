import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { FfmpegService } from '../ffmpeg/ffmpeg.service';
import { SeparacaoService } from '../separacao/separacao.service';
import { TranscricaoService } from '../transcricao/transcricao.service';
import { TraducaoService } from '../traducao/traducao.service';
import { JuizService } from '../traducao/juiz.service';
import { revisarComJuiz } from '../traducao/revisar-com-juiz';
import { VozService } from '../voz/voz.service';
import { encaixarFalas } from '../encaixe/encaixar-falas';
import { gravarRelatorio, montarRelatorio } from '../relatorio/relatorio';

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
  ) {}

  // Dubla o vídeo fala por fala, cada uma no instante da original, e grava o relatório.
  async dublar(video: Buffer, nome: string): Promise<Buffer> {
    this.logger.log(`1/7 Extraindo áudio de "${nome}"`);
    const audio = await this.ffmpeg.extrairAudio(video);

    this.logger.log('2/7 Separando voz e fundo');
    const { fundo } = await this.separacao.separar(audio);

    this.logger.log('3/7 Transcrevendo');
    const falas = await this.transcricao.transcrever(audio);

    this.logger.log('4/7 Traduzindo e revisando com o juiz');
    const traduzidas = await this.traducao.traduzir(falas);
    const revisadas = await revisarComJuiz(traduzidas, this.juiz, this.traducao);

    this.logger.log('5/7 Gerando as vozes');
    const audios = await this.voz.gerarAudios(revisadas);

    this.logger.log('6/7 Encaixando cada fala no tempo');
    const encaixadas = await encaixarFalas(
      revisadas,
      audios,
      await this.ffmpeg.medirDuracao(video),
      {
        medir: (a) => this.ffmpeg.medirDuracao(a),
        encurtar: (f, alvo, motivo) => this.traducao.encurtar(f, alvo, motivo),
        sintetizar: (id, texto, voz) => this.voz.sintetizar(id, texto, voz),
      },
    );

    this.logger.log('7/7 Montando o vídeo');
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
}
