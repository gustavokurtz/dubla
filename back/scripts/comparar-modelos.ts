// Traduz e julga de novo as falas de um relatório já dublado (pelo Opus), com os
// modelos atuais, e grava a comparação lado a lado com o custo medido.
// Reaproveita o inglês salvo: não chama a AssemblyAI.
// Uso (em back/):
//   node --env-file=../.env -r ts-node/register scripts/comparar-modelos.ts <relatorio.json> [--simulado]
// Sem --simulado chama a Claude (pago). Com --simulado não chama nada.
import { ConfigService } from '@nestjs/config';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Fala, FalaRevisada, FalaTraduzida } from '../src/shared/types';
import { TraducaoService, CHARS_POR_SEGUNDO } from '../src/traducao/traducao.service';
import { JuizService } from '../src/traducao/juiz.service';
import { revisarComJuiz, Veredito } from '../src/traducao/revisar-com-juiz';
import { rodarNoTrace, Trace, traceAtual } from '../src/trace/trace';

interface FalaDoRelatorio extends Fala {
  textoPt: string;
}

type Tradutor = {
  traduzir(falas: Fala[]): Promise<FalaTraduzida[]>;
  refazer(falas: FalaTraduzida[], motivos: Map<number, string>): Promise<FalaTraduzida[]>;
};
type Juiz = { avaliar(falas: FalaTraduzida[]): Promise<Veredito[]> };

// Sem custo: devolve o português do Opus marcado e reprova a primeira fala uma vez,
// para exercitar o refazer e a tabela de custo.
function simulados(referencia: Map<number, string>): { tradutor: Tradutor; juiz: Juiz } {
  const registrar = (papel: string) =>
    traceAtual()?.registrar({
      servico: 'claude',
      papel,
      modelo: 'simulado',
      custo: 0,
      duracaoMs: 0,
    });
  let primeiraVez = true;
  return {
    tradutor: {
      traduzir: (falas) => {
        registrar('traducao');
        return Promise.resolve(
          falas.map((f) => ({
            ...f,
            textoEnCorrigido: f.textoEn,
            textoPt: `${referencia.get(f.id)} (sim)`,
          })),
        );
      },
      refazer: (falas) => {
        registrar('refazer');
        return Promise.resolve(falas.map((f) => ({ ...f, textoPt: `${f.textoPt} (refeita)` })));
      },
    },
    juiz: {
      avaliar: (falas) => {
        registrar('juiz');
        const vereditos = falas.map((f, i) => ({
          id: f.id,
          aprovado: !(primeiraVez && i === 0),
          motivo: 'simulado',
        }));
        primeiraVez = false;
        return Promise.resolve(vereditos);
      },
    },
  };
}

const dinheiro = (v: number) => `US$ ${v.toFixed(4)}`;

function montarComparacao(
  nome: string,
  opus: Map<number, string>,
  revisadas: FalaRevisada[],
  trace: Trace,
): string {
  const linhas = [`# Comparação de modelos — ${nome}`, ''];
  for (const f of revisadas) {
    const alvo = Math.round((f.fim - f.inicio) * CHARS_POR_SEGUNDO);
    const ptOpus = opus.get(f.id) ?? '';
    linhas.push(
      `## Fala ${f.id} (${f.inicio.toFixed(1)}–${f.fim.toFixed(1)} s, alvo ${alvo} caracteres)`,
      '',
      `- EN: ${f.textoEnCorrigido}`,
      `- Opus (${ptOpus.length}): ${ptOpus}`,
      `- Novo (${f.textoPt.length}): ${f.textoPt}`,
      `- Juiz: ${f.juiz}, ${f.tentativas} tentativa(s)${f.motivoJuiz ? ` — ${f.motivoJuiz}` : ''}`,
      '',
    );
  }
  linhas.push(
    '## Custo',
    '',
    '| Papel | Modelo | Entrada | Saída | Custo |',
    '|---|---|---|---|---|',
  );
  for (const c of trace.chamadas) {
    linhas.push(
      `| ${c.papel} | ${c.modelo} | ${c.entrada ?? '-'} | ${c.saida ?? '-'} | ${dinheiro(c.custo)} |`,
    );
  }
  const reprovadas = revisadas.filter((f) => f.juiz === 'reprovada').length;
  const refeitas = revisadas.filter((f) => f.tentativas > 1).length;
  linhas.push(
    '',
    `Total: ${dinheiro(trace.custoTotal())} — ${revisadas.length} falas, ${refeitas} refeitas, ${reprovadas} reprovadas no fim.`,
    '',
  );
  return linhas.join('\n');
}

async function main() {
  const caminho = process.argv[2];
  const simulado = process.argv.includes('--simulado');
  if (!caminho) throw new Error('Uso: scripts/comparar-modelos.ts <relatorio.json> [--simulado]');

  const relatorio = JSON.parse(await readFile(caminho, 'utf8')) as {
    video: string;
    falas: FalaDoRelatorio[];
  };
  const falas: Fala[] = relatorio.falas.map(({ id, pessoa, inicio, fim, textoEn }) => ({
    id,
    pessoa,
    inicio,
    fim,
    textoEn,
  }));
  const opus = new Map(relatorio.falas.map((f) => [f.id, f.textoPt]));

  let tradutor: Tradutor;
  let juiz: Juiz;
  if (simulado) {
    ({ tradutor, juiz } = simulados(opus));
  } else {
    const config = new ConfigService();
    tradutor = new TraducaoService(config); // encurtar não roda aqui: é do encaixe
    juiz = new JuizService(config);
  }

  const trace = new Trace();
  const revisadas = await rodarNoTrace(trace, async () =>
    revisarComJuiz(await tradutor.traduzir(falas), juiz, tradutor),
  );

  const carimbo = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const destino = join(
    process.cwd(),
    '..',
    'relatorios',
    `comparacao-${carimbo}${simulado ? '-simulado' : ''}.md`,
  );
  await writeFile(destino, montarComparacao(relatorio.video, opus, revisadas, trace));
  console.log(`Custo: ${dinheiro(trace.custoTotal())}\n${destino}`);
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
