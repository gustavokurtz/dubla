// Fim da fase 2: transcreve um vídeo, traduz, passa pelo juiz e grava o
// relatório em relatorios/ na raiz. Ainda sem voz nem montagem (fase 3).
// Uso (em back/): node --env-file=../.env -r ts-node/register scripts/traduzir-video.ts <video.mp4>
// Chama AssemblyAI e Claude (pago).
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { FfmpegService } from '../src/ffmpeg/ffmpeg.service';
import { TranscricaoService } from '../src/transcricao/transcricao.service';
import { TraducaoService } from '../src/traducao/traducao.service';
import { JuizService } from '../src/traducao/juiz.service';
import { revisarComJuiz } from '../src/traducao/revisar-com-juiz';
import { gravarRelatorio, linhaDaFala, montarRelatorio } from '../src/relatorio/relatorio';

async function main() {
  const caminho = process.argv[2];
  if (!caminho) throw new Error('Uso: scripts/traduzir-video.ts <video.mp4>');

  const config = new ConfigService();
  const audio = await new FfmpegService().extrairAudio(await readFile(caminho));
  const falas = await new TranscricaoService(config).transcrever(audio);

  const tradutor = new TraducaoService(config);
  const traduzidas = await tradutor.traduzir(falas);
  const revisadas = await revisarComJuiz(traduzidas, new JuizService(config), tradutor);

  const relatorio = montarRelatorio(basename(caminho, extname(caminho)), revisadas);
  for (const fala of revisadas) {
    console.log(`${linhaDaFala(fala)}\n   EN: ${fala.textoEnCorrigido}\n   PT: ${fala.textoPt}`);
  }
  console.log(JSON.stringify(relatorio.resumo, null, 2));
  console.log(
    await gravarRelatorio(relatorio, join(process.cwd(), '..', 'relatorios'), new Date()),
  );
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
