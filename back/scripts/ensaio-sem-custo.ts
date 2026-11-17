// Ensaio da pipeline inteira sem nada pago, antes de uma rodada real.
// Reais: ffmpeg, Demucs, corte em falas, encaixe, montagem, relatório.
// Simulados: ver servicos-simulados.ts.
// Uso (em back/): node --env-file=../.env -r ts-node/register scripts/ensaio-sem-custo.ts \
//   <video.mp4> <id-da-transcricao> <relatorio-anterior.json>
import { ConfigService } from '@nestjs/config';
import { readFileSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { FfmpegService } from '../src/ffmpeg/ffmpeg.service';
import { SeparacaoService } from '../src/separacao/separacao.service';
import { IngestionService } from '../src/ingestion/ingestion.service';
import { YoutubeService } from '../src/youtube/youtube.service';
import { servicosSimulados } from './servicos-simulados';

async function main() {
  const [caminho, idTranscricao, relatorioAnterior] = process.argv.slice(2);
  if (!relatorioAnterior) {
    throw new Error('Uso: ensaio-sem-custo.ts <video.mp4> <id-da-transcricao> <relatorio.json>');
  }
  const config = new ConfigService();
  const simulados = await servicosSimulados(config, idTranscricao, relatorioAnterior);

  const service = new IngestionService(
    new FfmpegService(),
    new SeparacaoService(config),
    simulados.transcricao,
    simulados.traducao,
    simulados.juiz,
    simulados.voz,
    {} as YoutubeService,
  );

  const nome = `ensaio-${basename(caminho, extname(caminho))}`;
  const inicio = Date.now();
  const video = await service.dublar(readFileSync(caminho), nome);
  const saida = join(process.cwd(), '..', 'videos', `${nome}.mp4`);
  writeFileSync(saida, video);
  simulados.limpar();
  console.log(`Vídeo do ensaio: ${saida}`);
  console.log(`Chamadas de encurtar que a rodada real faria: ${simulados.encurtamentos()}`);
  console.log(`Tempo: ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.stack : erro);
  process.exit(1);
});
