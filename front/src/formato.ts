// Centavos somem nas chamadas baratas: abaixo de 1 centavo, mostra 4 casas.
export const formatarDolar = (valor: number) =>
  `US$ ${valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: valor > 0 && valor < 0.01 ? 4 : 2,
  })}`

export function formatarTempo(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(s / 60)
  return min > 0 ? `${min} min ${s % 60} s` : `${s} s`
}

export const formatarData = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const formatarNumero = (n: number) => n.toLocaleString('pt-BR')
