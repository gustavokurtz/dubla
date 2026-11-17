// O back de verdade (fila, trace, SSE, ffmpeg, Demucs, encaixe), com os services pagos
// simulados (ver servicos-simulados.ts), para ver a tela andar sem gastar nada.
// Mande pela tela o mesmo vídeo da transcrição; link do YouTube não serve aqui.
// Uso (em back/, com o back normal parado):
//   node --env-file=../.env -r ts-node/register scripts/servidor-ensaio.ts \
//     <id-da-transcricao> <relatorio-anterior.json>
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { TranscricaoService } from '../src/transcricao/transcricao.service';
import { TraducaoService } from '../src/traducao/traducao.service';
import { JuizService } from '../src/traducao/juiz.service';
import { VozService } from '../src/voz/voz.service';
import { servicosSimulados } from './servicos-simulados';

async function main() {
  const [idTranscricao, relatorioAnterior] = process.argv.slice(2);
  if (!relatorioAnterior) {
    throw new Error('Uso: servidor-ensaio.ts <id-da-transcricao> <relatorio.json>');
  }
  const simulados = await servicosSimulados(new ConfigService(), idTranscricao, relatorioAnterior);
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TranscricaoService)
    .useValue(simulados.transcricao)
    .overrideProvider(TraducaoService)
    .useValue(simulados.traducao)
    .overrideProvider(JuizService)
    .useValue(simulados.juiz)
    .overrideProvider(VozService)
    .useValue(simulados.voz)
    .compile();
  const app = modulo.createNestApplication();
  await app.listen(process.env.PORT ?? 3000);
  console.log('Back do ensaio (sem custo) em http://localhost:3000');
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.stack : erro);
  process.exit(1);
});
