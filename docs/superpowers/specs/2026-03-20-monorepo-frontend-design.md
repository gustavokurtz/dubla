# Dubla -- Monorepo + Frontend Design Spec

## Overview

Reorganizar o projeto Dubla em monorepo (pnpm workspaces) com `back/` e `front/`, e criar uma aplicação React minimalista de tela única para upload, processamento e download de vídeos dublados.

## Decisões

- **Escopo**: Tela única (upload → progresso → download)
- **Monorepo**: pnpm workspaces (sem Turborepo/Nx)
- **Visual**: Crisp Glass -- fundo quase branco com toque indigo, glass sutil, botão escuro, tipografia Inter
- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS

## 1. Estrutura do Monorepo

```
dubla/
├── back/                    # NestJS app (código existente movido)
│   ├── src/
│   ├── test/
│   ├── package.json
│   ├── nest-cli.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── eslint.config.mjs
│   ├── .prettierrc
│   └── .prettierignore
├── front/                   # React + Vite + Tailwind
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   └── vite-env.d.ts
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── package.json             # Root workspace com scripts orquestradores
├── pnpm-workspace.yaml      # packages: [back, front]
├── .env                     # Na raiz, back lê via envFilePath: '../.env'
├── .gitignore
└── CLAUDE.md
```

### Root package.json

```json
{
  "name": "dubla",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "dev:back": "pnpm --filter back start:dev",
    "dev:front": "pnpm --filter front dev",
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint"
  }
}
```

O back precisa de um script `dev` que aponte para `start:dev` do Nest.

### pnpm-workspace.yaml

```yaml
packages:
  - back
  - front
```

### .env

Permanece na raiz. O back referencia com `envFilePath: path.join(process.cwd(), '..', '.env')` no ConfigModule. Como `pnpm --filter back` roda com `cwd = back/`, subir um nível chega na raiz.

Alternativa: copiar `.env` para `back/` e manter a raiz como fallback. Optamos pelo `process.cwd()` + `..` por simplicidade.

## 2. Interface -- Estados e Fluxo

Tela única com 3 estados + erro, tudo no componente `App.tsx`:

### Estado 1 -- Idle (Upload)

- Card glass centralizado na tela
- Logo "dubla." com ponto indigo
- Subtítulo "Duble qualquer vídeo em segundos"
- Zona de drag & drop com ícone (ou clique para selecionar)
- Aceita `video/*`, máximo 100MB
- Ao selecionar arquivo: mostra nome + tamanho, botão "Enviar vídeo" fica ativo
- Botão escuro (#0f172a), rounded, font Inter semibold

### Estado 2 -- Uploading (Processando)

- Mesmo card, conteúdo substitui o upload
- Barra de progresso animada indeterminada (shimmer CSS, não baseada em percentual)
- A request é única e síncrona, sem streaming de progresso do back
- Texto rotativo cosmético das etapas a cada ~4s:
  1. "Extraindo áudio..."
  2. "Transcrevendo com Whisper..."
  3. "Traduzindo para português..."
  4. "Gerando dublagem..."
  5. "Montando vídeo final..."
- Sem botão de cancelar

### Estado 3 -- Done (Download)

- Mesmo card
- Ícone de check / animação de sucesso
- "Vídeo dublado pronto!"
- Botão escuro "Baixar vídeo" → dispara download do blob via `URL.createObjectURL`
- Link secundário "Dublar outro vídeo" → volta ao estado idle

### Estado de Erro

- Mesmo card
- Mensagem de erro amigável
- Botão "Tentar novamente" → volta ao estado idle

## 3. Comunicação Front ↔ Back

- **Endpoint**: `POST /api/ingestion/dublar`
- **Payload**: `FormData` com campo `video`
- **Response**: blob MP4
- **Client**: `fetch` nativo (sem axios)
- **Proxy**: Vite dev server reescreve `/api` → `http://localhost:3000` (NestJS NÃO usa global prefix; `/api` é exclusivo do front, removido pelo proxy)
  ```ts
  // vite.config.ts
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
  ```

### Download

```ts
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'video-dublado.mp4';
a.click();
setTimeout(() => URL.revokeObjectURL(url), 1000);
```

## 4. Componentes e Estado

Zero abstrações. Um arquivo `App.tsx`:

```ts
type Status = 'idle' | 'uploading' | 'done' | 'error';

const [status, setStatus] = useState<Status>('idle');
const [file, setFile] = useState<File | null>(null);
const [blob, setBlob] = useState<Blob | null>(null);
const [error, setError] = useState<string>('');
```

- Renderização condicional por `status`
- `handleUpload()`: monta FormData, faz fetch, trata sucesso/erro
- `useEffect` + `setInterval` para rotação de texto cosmético durante upload
- Drag & drop via `onDragOver`/`onDrop` nativos no div

## 5. Visual -- Crisp Glass

### Cores

- Background: gradiente sutil `from-slate-50 via-indigo-50/30 to-violet-50/20`
- Card: `bg-white/70 backdrop-blur-xl border border-white/90 shadow-sm`
- Botão primário: `bg-slate-900 text-white hover:bg-slate-800`
- Barra de progresso: `bg-gradient-to-r from-slate-900 to-indigo-500`
- Texto primário: `text-slate-900`
- Texto secundário: `text-slate-400`
- Accent: indigo-500 (ponto no logo, links)

### Tipografia

- Font family: Inter (via Google Fonts ou @fontsource)
- Logo: `text-2xl font-bold tracking-tight`
- Subtítulo: `text-sm text-slate-400`
- Botão: `text-sm font-semibold`

### Layout

- Tela cheia com gradiente no body
- Card centralizado: `max-w-sm mx-auto` com padding generoso
- Border radius: `rounded-2xl` no card, `rounded-xl` nos botões
- Responsivo: card ocupa mais largura em mobile (`max-w-sm` → quase full width)

## 6. Migração de Configs

Ao mover o NestJS para `back/`:
- **Movem para `back/`**: `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`
- **Ficam na raiz**: `.gitignore` (atualizado), `CLAUDE.md`, `.env`
- **Root não tem** eslint/prettier próprio -- cada workspace gerencia o seu
- `front/` usa o template do `create vite` (React-TS) que já gera `tsconfig.json` adequado (`jsx: react-jsx`, `moduleResolution: bundler`)

## 7. Produção (fora do escopo inicial)

Para dev, basta rodar `pnpm dev` (back na 3000, front na 5173 com proxy). Deploy/produção não é escopo desta spec -- será tratado separadamente quando necessário.
