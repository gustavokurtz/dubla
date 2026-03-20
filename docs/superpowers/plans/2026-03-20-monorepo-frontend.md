# Monorepo + Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize Dubla into a pnpm monorepo (`back/` + `front/`) and create the React frontend for video upload, processing, and download.

**Architecture:** Move existing NestJS app into `back/`, scaffold React+Vite+Tailwind app in `front/`, wire them via Vite proxy. Single-page app with 3 states (idle, uploading, done) in one component.

**Tech Stack:** pnpm workspaces, NestJS, React 19, Vite, TypeScript, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-20-monorepo-frontend-design.md`

---

## File Structure

### Root (create/modify)
- `pnpm-workspace.yaml` — workspace definition
- `package.json` — root orchestrator scripts (replace current)
- `.gitignore` — update to include front build artifacts + `.superpowers/`

### back/ (move existing + modify)
- `back/src/**` — all existing `src/` contents (unchanged)
- `back/test/**` — all existing `test/` contents (unchanged)
- `back/package.json` — current `package.json` (add `dev` script alias)
- `back/nest-cli.json` — move from root
- `back/tsconfig.json` — move from root
- `back/tsconfig.build.json` — move from root
- `back/eslint.config.mjs` — move from root
- `back/.prettierrc` — move from root
- `back/.prettierignore` — move from root
- `back/src/app.module.ts` — modify ConfigModule envFilePath

### front/ (create new)
- `front/package.json` — Vite React TS project
- `front/index.html` — entry HTML with Inter font
- `front/vite.config.ts` — proxy config
- ~~`front/tailwind.config.ts`~~ — Not needed with Tailwind v4 (uses CSS-based config via `@theme`)
- `front/tsconfig.json` — React TS config (from Vite template)
- `front/src/main.tsx` — React entry point
- `front/src/index.css` — Tailwind directives + background gradient + shimmer animation
- `front/src/App.tsx` — single component with all 4 states
- `front/src/vite-env.d.ts` — Vite types

---

## Task 1: Move NestJS into `back/`

**Files:**
- Move: `src/` → `back/src/`
- Move: `test/` → `back/test/`
- Move: `package.json` → `back/package.json`
- Move: `nest-cli.json` → `back/nest-cli.json`
- Move: `tsconfig.json` → `back/tsconfig.json`
- Move: `tsconfig.build.json` → `back/tsconfig.build.json`
- Move: `eslint.config.mjs` → `back/eslint.config.mjs`
- Move: `.prettierrc` → `back/.prettierrc`
- Move: `.prettierignore` → `back/.prettierignore`

- [ ] **Step 0: Stage untracked files and commit current changes**

There are untracked files (`src/shared/`) and unstaged modifications. Stage and commit them first so `git mv` captures everything:

```bash
git add src/shared/
git add -u
git commit -m "chore: stage current work before monorepo restructure"
```

- [ ] **Step 1: Create `back/` directory and move all NestJS files**

```bash
mkdir back
git mv src back/src
git mv test back/test
git mv nest-cli.json back/
git mv tsconfig.json back/
git mv tsconfig.build.json back/
git mv eslint.config.mjs back/
git mv .prettierrc back/
git mv .prettierignore back/
```

- [ ] **Step 2: Move `package.json` to `back/` and rename the package**

Copy current `package.json` to `back/package.json`. Add a `"dev"` script that aliases `start:dev`:

```json
"dev": "nest start --watch"
```

This goes in the `"scripts"` block alongside existing scripts. The `name` field stays `"dubla"` (pnpm resolves by directory, not name).

- [ ] **Step 3: Move `package.json` and clean up**

```bash
rm -rf node_modules
mv package.json back/package.json
```

Keep `pnpm-lock.yaml` at the root (pnpm workspaces require it there). Don't install yet — wait until root workspace is configured in Task 2.

- [ ] **Step 4: Update `back/src/app.module.ts` — envFilePath**

Change ConfigModule.forRoot to:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: path.join(process.cwd(), '..', '.env'),
})
```

Add `import * as path from 'path';` at the top.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move NestJS app into back/ directory"
```

---

## Task 2: Set up pnpm workspace root

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Modify: `.gitignore`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - back
  - front
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "dubla-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "dev:back": "pnpm --filter dubla run dev",
    "dev:front": "pnpm --filter dubla-front run dev",
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint"
  }
}
```

- [ ] **Step 3: Update `.gitignore`**

Add these entries if not present:

```
# Build output (covers back/dist/ and front/dist/)
dist/

# Superpowers
.superpowers/
```

Also check that the existing `/dist` entry is changed to `dist/` (without leading slash) so it matches in subdirectories.

- [ ] **Step 4: Install dependencies from root**

```bash
cd /home/ntconsult/Projetos/dubla
pnpm install
```

This reads `back/package.json` and installs its deps in the workspace.

- [ ] **Step 5: Verify back still works**

```bash
pnpm dev:back
```

Confirm NestJS starts on port 3000 without errors. Ctrl+C after confirming.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json .gitignore pnpm-lock.yaml
git commit -m "feat: set up pnpm workspace root"
```

---

## Task 3: Scaffold React + Vite + Tailwind in `front/`

**Files:**
- Create: `front/package.json`
- Create: `front/index.html`
- Create: `front/vite.config.ts`
- Create: `front/tsconfig.json`
- Create: `front/tsconfig.app.json`
- Create: `front/tsconfig.node.json`
- Create: `front/src/main.tsx`
- Create: `front/src/App.tsx` (placeholder)
- Create: `front/src/index.css`
- Create: `front/src/vite-env.d.ts`

- [ ] **Step 1: Scaffold Vite React-TS project**

```bash
cd /home/ntconsult/Projetos/dubla
pnpm create vite front --template react-ts
```

If `front/` already exists (it shouldn't), remove it first. This generates the full boilerplate.

- [ ] **Step 2: Install Tailwind CSS v4**

```bash
cd /home/ntconsult/Projetos/dubla/front
pnpm add -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure Vite with Tailwind plugin and proxy**

Replace `front/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

- [ ] **Step 4: Set up `front/src/index.css` with Tailwind + Inter font + shimmer**

```css
@import "tailwindcss";

@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

- [ ] **Step 5: Update `front/index.html` to load Inter font**

In the `<head>` section add before closing `</head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Update the `<title>` to `dubla`.

- [ ] **Step 6: Replace `front/src/App.tsx` with minimal placeholder**

```tsx
function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20">
      <div className="bg-white/70 backdrop-blur-xl border border-white/90 rounded-2xl shadow-sm p-10 max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          dubla<span className="text-indigo-500">.</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">Duble qualquer vídeo em segundos</p>
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 7: Clean up Vite boilerplate**

Delete generated files we don't need:
- `front/src/App.css`
- `front/src/assets/` (entire directory)
- `front/public/vite.svg`

Update `front/src/main.tsx` to remove any `App.css` import if present. Keep only:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8: Update `front/package.json` name**

Change `"name"` to `"dubla-front"` so `pnpm --filter dubla-front` works.

- [ ] **Step 9: Install from root and verify**

```bash
cd /home/ntconsult/Projetos/dubla
pnpm install
pnpm dev:front
```

Open http://localhost:5173 — should see the glass card with "dubla." logo. Ctrl+C.

- [ ] **Step 10: Commit**

```bash
cd /home/ntconsult/Projetos/dubla
git add front/ pnpm-lock.yaml
git commit -m "feat: scaffold React + Vite + Tailwind frontend"
```

---

## Task 4: Implement idle state (upload UI)

**Files:**
- Modify: `front/src/App.tsx`

- [ ] **Step 1: Implement the full idle state with drag & drop and file input**

Replace `front/src/App.tsx`:

```tsx
import { useState, useCallback, type DragEvent, type ChangeEvent } from 'react'

type Status = 'idle' | 'uploading' | 'done' | 'error'

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const MAX_SIZE = 100 * 1024 * 1024 // 100MB

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('video/')) {
      setError('Apenas arquivos de vídeo são aceitos')
      setStatus('error')
      return
    }
    if (f.size > MAX_SIZE) {
      setError('Arquivo excede o limite de 100MB')
      setStatus('error')
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
    setBlob(null)
    setError('')
  }

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
              onClick={() => document.getElementById('file-input')?.click()}
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
                id="file-input"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleInputChange}
              />
            </div>

            {file && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-slate-600 mb-3">
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <span className="text-slate-400 ml-2 shrink-0">{formatSize(file.size)}</span>
                </div>
                <button
                  onClick={() => {/* Task 5 */}}
                  className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Enviar vídeo
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 2: Run dev server and verify**

```bash
cd /home/ntconsult/Projetos/dubla
pnpm dev:front
```

Open http://localhost:5173. Verify:
- Glass card with logo
- Drag & drop zone with upload icon
- Clicking opens file picker
- After selecting a video file, name + size + button appear

- [ ] **Step 3: Commit**

```bash
git add front/src/App.tsx
git commit -m "feat: implement idle state with drag & drop upload UI"
```

---

## Task 5: Implement uploading state + fetch logic

**Files:**
- Modify: `front/src/App.tsx`

- [ ] **Step 1: Add handleUpload and uploading state rendering**

In `App.tsx`, add these constants above the component:

```tsx
const STEPS = [
  'Extraindo áudio...',
  'Transcrevendo com Whisper...',
  'Traduzindo para português...',
  'Gerando dublagem...',
  'Montando vídeo final...',
]
```

Add state for the step index:

```tsx
const [stepIndex, setStepIndex] = useState(0)
```

Add the `handleUpload` function inside the component:

```tsx
const handleUpload = async () => {
  if (!file) return
  setStatus('uploading')
  setStepIndex(0)

  const form = new FormData()
  form.append('video', file)

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
```

Add `useEffect` for step rotation (add `useEffect` to the import):

```tsx
import { useState, useCallback, useEffect, type DragEvent, type ChangeEvent } from 'react'

// Inside the component:
useEffect(() => {
  if (status !== 'uploading') return
  const interval = setInterval(() => {
    setStepIndex((i) => (i + 1) % STEPS.length)
  }, 4000)
  return () => clearInterval(interval)
}, [status])
```

Wire the button's `onClick` to `handleUpload`:

```tsx
onClick={handleUpload}
```

- [ ] **Step 2: Add uploading state JSX**

After the `{status === 'idle' && (...)}` block, add:

```tsx
{status === 'uploading' && (
  <div className="text-center">
    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-slate-900 to-indigo-500 animate-[shimmer_1.5s_ease-in-out_infinite]" />
    </div>
    <p className="text-sm text-slate-600 mt-4 font-medium">{STEPS[stepIndex]}</p>
    <p className="text-xs text-slate-400 mt-1">Isso pode levar alguns minutos</p>
  </div>
)}
```

- [ ] **Step 3: Run dev server and verify**

```bash
pnpm dev:front
```

Select a video and click "Enviar vídeo". Verify:
- Card switches to progress bar + rotating step text
- Shimmer animation runs on the progress bar
- If back is not running, an error state should eventually show

- [ ] **Step 4: Commit**

```bash
git add front/src/App.tsx
git commit -m "feat: implement uploading state with fetch and step rotation"
```

---

## Task 6: Implement done and error states

**Files:**
- Modify: `front/src/App.tsx`

- [ ] **Step 1: Add done state JSX**

After the uploading block, add:

```tsx
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
```

- [ ] **Step 2: Add error state JSX**

After the done block, add:

```tsx
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
```

- [ ] **Step 3: Run dev server and verify all states**

```bash
pnpm dev:front
```

Test the full flow:
- Idle: upload zone visible
- Select file → button appears
- Click "Enviar vídeo" → uploading state with shimmer + step text
- If back is running: should eventually show done state with download button
- Click "Dublar outro" → back to idle
- If back is off: should show error state with "Tentar novamente"

- [ ] **Step 4: Commit**

```bash
git add front/src/App.tsx
git commit -m "feat: implement done and error states"
```

---

## Task 7: Update CLAUDE.md and final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md to reflect monorepo structure**

Update the Commands section to reflect the new workspace commands. Update Architecture section to mention the monorepo and frontend. Add `front/` to Module structure.

Key changes:
- Commands: `pnpm dev` (both), `pnpm dev:back`, `pnpm dev:front`
- Architecture: add note about monorepo with `back/` and `front/`
- Frontend: single-page React+Vite+Tailwind app, Crisp Glass design

- [ ] **Step 2: Full integration test**

```bash
cd /home/ntconsult/Projetos/dubla
pnpm dev
```

Open http://localhost:5173, upload a video (with back running on :3000), verify complete flow: upload → processing → download.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for monorepo structure"
```
