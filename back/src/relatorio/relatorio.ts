import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { EncaixeDaFala, FalaRevisada } from '../shared/types';

export interface FalaNoRelatorio extends FalaRevisada {
  encaixe?: EncaixeDaFala;
}

export interface Relatorio {
  video: string;
  resumo: {
    falas: number;
    pessoas: number;
    juiz: { aprovadasDePrimeira: number; aprovadasDepois: number; reprovadas: number };
    encaixe: Record<EncaixeDaFala['acao'] | 'semDados', number>;
    maiorDesvioInicio: number | null; // segundos; R1 pede ≤ 0,1
  };
  falas: FalaNoRelatorio[];
}

const centesimos = (s: number) => Math.round(s * 100) / 100;

export function montarRelatorio(video: string, falas: FalaNoRelatorio[]): Relatorio {
  const encaixe: Relatorio['resumo']['encaixe'] = {
    ok: 0,
    encurtar: 0,
    acelerar: 0,
    avancar: 0,
    cortar: 0,
    semDados: 0,
  };
  const desvios: number[] = [];
  for (const fala of falas) {
    if (!fala.encaixe) {
      encaixe.semDados++;
      continue;
    }
    encaixe[fala.encaixe.acao]++;
    desvios.push(centesimos(Math.abs(fala.encaixe.inicioDublado - fala.inicio)));
  }

  return {
    video,
    resumo: {
      falas: falas.length,
      pessoas: new Set(falas.map((f) => f.pessoa)).size,
      juiz: {
        aprovadasDePrimeira: falas.filter((f) => f.juiz === 'aprovada' && f.tentativas === 1)
          .length,
        aprovadasDepois: falas.filter((f) => f.juiz === 'aprovada' && f.tentativas > 1).length,
        reprovadas: falas.filter((f) => f.juiz === 'reprovada').length,
      },
      encaixe,
      maiorDesvioInicio: desvios.length ? Math.max(...desvios) : null,
    },
    falas,
  };
}

// 135.3 → "2:15,30"
function tempo(segundos: number): string {
  const cs = Math.round(segundos * 100);
  const min = Math.floor(cs / 6000);
  const seg = Math.floor((cs % 6000) / 100);
  return `${min}:${String(seg).padStart(2, '0')},${String(cs % 100).padStart(2, '0')}`;
}

// Uma linha legível por fala, para o log.
export function linhaDaFala(fala: FalaNoRelatorio): string {
  const partes = [`fala ${fala.id}`, `pessoa ${fala.pessoa}`];
  const e = fala.encaixe;
  if (e) {
    partes.push(`${tempo(fala.inicio)} → ${tempo(e.inicioDublado)}`);
    if (e.acao === 'cortar') partes.push('cortada');
    if (e.acao === 'avancar') partes.push('avançou sobre o silêncio');
    if (e.encurtamentos > 0) partes.push(`encurtada ${e.encurtamentos}×`);
    if (e.atempo > 1) partes.push(`acelerada ${Math.round((e.atempo - 1) * 100)}%`);
  } else {
    partes.push(tempo(fala.inicio));
  }
  if (fala.juiz === 'reprovada') {
    partes.push(`juiz: reprovada (${fala.motivoJuiz})`);
  } else if (fala.tentativas > 1) {
    partes.push(`juiz: aprovada na ${fala.tentativas}ª tentativa`);
  } else {
    partes.push('juiz: aprovada');
  }
  return partes.join(', ');
}

// Grava em <pasta>/<AAAA-MM-DD>-<nome-do-video>.json e devolve o caminho.
export async function gravarRelatorio(
  relatorio: Relatorio,
  pasta: string,
  data: Date,
): Promise<string> {
  const dia = [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, '0'),
    String(data.getDate()).padStart(2, '0'),
  ].join('-');
  const nome = relatorio.video
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  await mkdir(pasta, { recursive: true });
  const arquivo = path.join(pasta, `${dia}-${nome}.json`);
  await writeFile(arquivo, JSON.stringify(relatorio, null, 2));
  return arquivo;
}
