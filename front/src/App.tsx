import { useState, useCallback, useEffect, useRef, type DragEvent, type ChangeEvent } from 'react'

const MAX_SIZE = 100 * 1024 * 1024 // 100MB

const STEPS = [
  'Separando voz e fundo...',
  'Transcrevendo...',
  'Traduzindo para português...',
  'Revisando a tradução...',
  'Gerando as vozes...',
  'Encaixando cada fala no tempo...',
  'Montando vídeo final...',
]

type Status = 'idle' | 'uploading' | 'done' | 'error'

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [link, setLink] = useState('')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('video/')) {
      setError('Apenas arquivos de vídeo são aceitos')
      setFile(null)
      return
    }
    if (f.size > MAX_SIZE) {
      setError('Arquivo excede o limite de 100MB')
      setFile(null)
      return
    }
    setFile(f)
    setError('')
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }, [handleFile])

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const reset = () => {
    setStatus('idle')
    setFile(null)
    setLink('')
    setBlob(null)
    setError('')
  }

  const enviar = async (form: FormData) => {
    setStatus('uploading')
    setStepIndex(0)

    try {
      const res = await fetch('/api/ingestion/dublar', { method: 'POST', body: form })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Erro ${res.status}`)
      }
      const resultBlob = await res.blob()
      setBlob(resultBlob)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setStatus('error')
    }
  }

  const handleUpload = () => {
    if (!file) return
    const form = new FormData()
    form.append('video', file)
    enviar(form)
  }

  const handleLink = () => {
    if (!link.trim()) return
    const form = new FormData()
    form.append('url', link.trim())
    enviar(form)
  }

  useEffect(() => {
    if (status !== 'uploading') return
    const interval = setInterval(() => {
      setStepIndex((i) => (i + 1) % STEPS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [status])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20 p-4">
      <div className="bg-white/70 backdrop-blur-xl border border-white/90 rounded-2xl shadow-sm p-10 max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            dubla<span className="text-indigo-500">.</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Duble qualquer vídeo em segundos</p>
        </div>

        {status === 'idle' && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragging
                  ? 'border-indigo-400 bg-indigo-50/50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-slate-500 mt-3">
                Arraste um vídeo ou <span className="text-indigo-500 font-medium">clique para selecionar</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">Até 100MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleInputChange}
              />
            </div>

            {error && status === 'idle' && (
              <p className="text-xs text-red-500 mt-2 text-center">{error}</p>
            )}

            {file && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-slate-600 mb-3">
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <span className="text-slate-400 ml-2 shrink-0">{formatSize(file.size)}</span>
                </div>
                <button
                  onClick={handleUpload}
                  className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Enviar vídeo
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">ou cole um link do YouTube</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400"
            />
            {link.trim() && (
              <button
                onClick={handleLink}
                className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors mt-3 cursor-pointer"
              >
                Dublar link
              </button>
            )}
          </>
        )}

        {status === 'uploading' && (
          <div className="text-center">
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-slate-900 via-indigo-400 to-slate-900 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
            </div>
            <p className="text-sm text-slate-600 mt-4 font-medium">{STEPS[stepIndex]}</p>
            <p className="text-xs text-slate-400 mt-1">Isso pode levar alguns minutos</p>
          </div>
        )}

        {status === 'done' && blob && (
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-900">Vídeo dublado pronto!</p>
            <button
              onClick={() => {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'video-dublado.mp4'
                a.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}
              className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors mt-4 cursor-pointer"
            >
              Baixar vídeo
            </button>
            <button
              onClick={reset}
              className="text-sm text-indigo-500 hover:text-indigo-600 mt-3 font-medium cursor-pointer"
            >
              Dublar outro vídeo
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-900">Algo deu errado</p>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
            <button
              onClick={reset}
              className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors mt-4 cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
