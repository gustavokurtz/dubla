import { useEffect, useState } from 'react'
import { formatarData, formatarDolar, formatarNumero, formatarTempo } from './formato'

type Situacao = 'na fila' | 'dublando' | 'pronto' | 'falhou' | 'interrompido'

// GET /jobs
interface ItemHistorico {
  id: string
  nome: string
  situacao: Situacao
  criadoEm: string
  duracaoMs?: number
  custo: number
}

// GET /jobs/:id (mesmo formato do SSE)
interface Detalhe {
  id: string
  nome: string
  situacao: Situacao
  criadoEm: string
  iniciadoEm?: string
  terminadoEm?: string
  erro?: string
  etapaDoErro?: string
  custo: number
  etapas: { nome: string; inicio: string; fim?: string; feito?: number; total?: number; erro?: string; custo: number }[]
  chamadas: {
    servico: 'claude' | 'assemblyai-transcricao' | 'assemblyai-voz'
    etapa?: number
    papel?: string
    modelo?: string
    entrada?: number
    saida?: number
    segundos?: number
    caracteres?: number
    quantidade?: number
    custo: number
    duracaoMs: number
  }[]
}

const COR_SITUACAO: Record<Situacao, string> = {
  'na fila': 'bg-slate-100 text-slate-500',
  dublando: 'bg-indigo-50 text-indigo-600',
  pronto: 'bg-emerald-50 text-emerald-600',
  falhou: 'bg-red-50 text-red-600',
  interrompido: 'bg-amber-50 text-amber-700',
}

const PAPEL: Record<string, string> = {
  traducao: 'Tradução',
  juiz: 'Juiz',
  refazer: 'Refazer tradução',
  encurtar: 'Encurtar fala',
}

function Selo({ situacao }: { situacao: Situacao }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COR_SITUACAO[situacao]}`}>
      {situacao[0].toUpperCase() + situacao.slice(1)}
    </span>
  )
}

function Voltar({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-indigo-500 hover:text-indigo-600 font-medium cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-indigo-400"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
      {children}
    </button>
  )
}

function useBuscar<T>(url: string) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    let vivo = true
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Esta dublagem não existe mais' : `Erro ${res.status}`)
        return (await res.json()) as T
      })
      .then((d) => vivo && setDados(d))
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : 'Erro desconhecido'))
    return () => {
      vivo = false
    }
  }, [url])
  return { dados, erro }
}

export function Historico({ onAbrir, onVoltar }: { onAbrir: (id: string) => void; onVoltar: () => void }) {
  const { dados: jobs, erro } = useBuscar<ItemHistorico[]>('/api/jobs')

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Histórico</h2>
        <Voltar onClick={onVoltar}>Dublar um vídeo</Voltar>
      </div>

      {erro && <p className="text-sm text-red-500">Não deu para ler o histórico: {erro}</p>}
      {!jobs && !erro && <p className="text-sm text-slate-400">Carregando…</p>}
      {jobs?.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma dublagem ainda. Mande um vídeo e ela aparece aqui.</p>
      )}

      {jobs && jobs.length > 0 && (
        <ul className="divide-y divide-slate-100 -mx-2">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-white/60">
              <button
                onClick={() => onAbrir(j.id)}
                className="flex-1 min-w-0 text-left cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-indigo-400"
              >
                <p className="text-sm font-medium text-slate-900 truncate">{j.nome}</p>
                <p className="text-xs text-slate-400 mt-0.5 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Selo situacao={j.situacao} />
                  <span>{formatarData(j.criadoEm)}</span>
                  {j.duracaoMs !== undefined && <span>{formatarTempo(j.duracaoMs)}</span>}
                </p>
              </button>
              <span className="text-sm text-slate-700 tabular-nums shrink-0">{formatarDolar(j.custo)}</span>
              {j.situacao === 'pronto' ? (
                <a
                  href={`/api/jobs/${j.id}/video`}
                  download
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                >
                  Baixar
                </a>
              ) : (
                <span className="shrink-0 w-[3.75rem]" aria-hidden />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

const duracaoDe = (e: { inicio: string; fim?: string }) => (e.fim ? Date.parse(e.fim) - Date.parse(e.inicio) : undefined)

export function Trace({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const { dados: job, erro } = useBuscar<Detalhe>(`/api/jobs/${id}`)

  if (erro || !job) {
    return (
      <>
        <Voltar onClick={onVoltar}>Histórico</Voltar>
        <p className={`text-sm mt-6 ${erro ? 'text-red-500' : 'text-slate-400'}`}>{erro || 'Carregando…'}</p>
      </>
    )
  }

  const claude = job.chamadas.filter((c) => c.servico === 'claude')
  const transcricao = job.chamadas.filter((c) => c.servico === 'assemblyai-transcricao')
  const vozes = job.chamadas.filter((c) => c.servico === 'assemblyai-voz')
  const soma = (cs: Detalhe['chamadas']) => cs.reduce((t, c) => t + c.custo, 0)
  const maisLonga = Math.max(1, ...job.etapas.map((e) => duracaoDe(e) ?? 0))
  const duracao = job.iniciadoEm && job.terminadoEm ? Date.parse(job.terminadoEm) - Date.parse(job.iniciadoEm) : undefined

  return (
    <>
      <Voltar onClick={onVoltar}>Histórico</Voltar>

      <div className="mt-5">
        <h2 className="text-lg font-semibold text-slate-900 break-words">{job.nome}</h2>
        <p className="text-xs text-slate-400 mt-1 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1">
          <Selo situacao={job.situacao} />
          <span>{formatarData(job.criadoEm)}</span>
          {duracao !== undefined && <span>{formatarTempo(duracao)}</span>}
        </p>
        {job.situacao === 'pronto' && (
          <a
            href={`/api/jobs/${job.id}/video`}
            download
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 mt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            Baixar vídeo
          </a>
        )}
      </div>

      {job.situacao === 'falhou' && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Falhou em {job.etapaDoErro ?? 'uma etapa'}: {job.erro}
        </p>
      )}

      <dl className="grid grid-cols-3 gap-3 mt-6">
        {[
          ['Claude', soma(claude)],
          ['AssemblyAI', soma(transcricao) + soma(vozes)],
          ['Total', job.custo],
        ].map(([rotulo, valor]) => (
          <div key={rotulo as string} className="rounded-xl bg-white/70 border border-white px-3 py-3">
            <dt className="text-xs text-slate-400">{rotulo}</dt>
            <dd className={`tabular-nums whitespace-nowrap mt-0.5 ${rotulo === 'Total' ? 'text-sm sm:text-base font-semibold text-slate-900' : 'text-sm text-slate-700'}`}>
              {formatarDolar(valor as number)}
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="text-sm font-semibold text-slate-900 mt-8 mb-3">Etapas</h3>
      <ol className="space-y-3">
        {job.etapas.map((e, i) => {
          const d = duracaoDe(e)
          const parouAqui = job.situacao === 'interrompido' && !e.fim
          return (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={e.erro ? 'text-red-600' : 'text-slate-700'}>{e.nome}</span>
                <span className="text-xs text-slate-400 tabular-nums shrink-0">
                  {d !== undefined ? formatarTempo(d) : parouAqui ? 'parou aqui' : 'em andamento'}
                  {e.custo > 0 && <span className="text-slate-600 ml-3">{formatarDolar(e.custo)}</span>}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${e.erro ? 'bg-red-400' : parouAqui ? 'bg-amber-400' : 'bg-indigo-400'}`}
                  style={{ width: `${d !== undefined ? Math.max(1, (d / maisLonga) * 100) : 100}%` }}
                />
              </div>
              {e.total !== undefined && (
                <p className="text-xs text-slate-400 mt-1 tabular-nums">{e.feito ?? 0} de {e.total} falas</p>
              )}
              {e.erro && <p className="text-xs text-red-600 mt-1">{e.erro}</p>}
            </li>
          )
        })}
      </ol>

      {claude.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-slate-900 mt-8 mb-3">Chamadas da Claude</h3>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-slate-400 text-left">
                <tr>
                  <th className="font-normal px-2 py-1.5">Papel</th>
                  <th className="font-normal px-2 py-1.5">Modelo</th>
                  <th className="font-normal px-2 py-1.5 text-right">Tokens entrada</th>
                  <th className="font-normal px-2 py-1.5 text-right">Tokens saída</th>
                  <th className="font-normal px-2 py-1.5 text-right">Tempo</th>
                  <th className="font-normal px-2 py-1.5 text-right">Custo</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 divide-y divide-slate-100">
                {claude.map((c, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">{PAPEL[c.papel ?? ''] ?? c.papel}</td>
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{c.modelo}</td>
                    <td className="px-2 py-1.5 text-right">{formatarNumero(c.entrada ?? 0)}</td>
                    <td className="px-2 py-1.5 text-right">{formatarNumero(c.saida ?? 0)}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatarTempo(c.duracaoMs)}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatarDolar(c.custo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(transcricao.length > 0 || vozes.length > 0) && (
        <>
          <h3 className="text-sm font-semibold text-slate-900 mt-8 mb-3">AssemblyAI</h3>
          <ul className="text-sm text-slate-700 divide-y divide-slate-100">
            {transcricao.map((c, i) => (
              <li key={`t${i}`} className="flex justify-between gap-3 py-2 tabular-nums">
                <span>Transcrição de {formatarTempo((c.segundos ?? 0) * 1000)} de áudio</span>
                <span className="whitespace-nowrap">{formatarDolar(c.custo)}</span>
              </li>
            ))}
            {vozes.map((c, i) => (
              <li key={`v${i}`} className="flex justify-between gap-3 py-2 tabular-nums">
                <span>
                  {formatarNumero(c.quantidade ?? 0)} vozes, {formatarNumero(c.caracteres ?? 0)} caracteres
                  {c.etapa !== undefined && job.etapas[c.etapa] && (
                    <span className="text-slate-400"> em {job.etapas[c.etapa].nome.toLowerCase()}</span>
                  )}
                </span>
                <span className="whitespace-nowrap">{formatarDolar(c.custo)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
