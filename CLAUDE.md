# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dubla** dubs Brazilian Jiu-Jitsu instructional videos into Brazilian Portuguese. It accepts a video file, separates voice from background (Demucs), transcribes with speaker labels and word timings (AssemblyAI), corrects and translates each line with Claude (plus a separate Claude judge), synthesizes each line with a fixed voice per speaker (AssemblyAI TTS), fits each dubbed line into its original time slot, and remixes it over the original background.

This is a **monorepo** with two workspaces:
- `back/` — NestJS backend (API + pipeline)
- `front/` — React frontend (upload, progress, history, cost trace)

## Commands

```bash
# Root (runs both workspaces)
pnpm dev                # Run back + front in parallel
pnpm dev:back           # Run only backend (NestJS watch mode)
pnpm dev:front          # Run only frontend (Vite dev server)
pnpm build              # Build all workspaces
docker compose up -d    # Local Postgres for the dubbing history (port 5433)

# Backend (from back/ or via --filter)
pnpm --filter dubla run start:dev    # NestJS watch mode
pnpm --filter dubla run test         # Run unit tests (jest)
pnpm --filter dubla run test -- --testPathPattern=ffmpeg  # Tests for a specific module
pnpm --filter dubla run test:e2e     # Run e2e tests
pnpm --filter dubla run lint         # ESLint with auto-fix
pnpm --filter dubla run format       # Prettier formatting
```

## Environment Variables

Requires a `.env` file at the **project root** (not inside `back/`) with:
- `ASSEMBLYAI_API_KEY` — transcription (speaker labels, word timings) and TTS
- `ANTHROPIC_API_KEY` — translation and judge (Claude)
- `DATABASE_URL` — local Postgres (`postgresql://dubla:dubla@localhost:5433/dubla`). Also read by `back/prisma.config.ts`, so `pnpm install` (postinstall `prisma generate`) needs the `.env` to exist
- `FERRAMENTAS_PYTHON` (optional) — Python with `demucs` and `yt-dlp`; defaults to `back/.venv-py/bin/python` (created with `uv`, see `.trilho/projeto.md`)

`ConfigModule` is loaded globally with `envFilePath: path.join(process.cwd(), '..', '.env')` so it reads from the root.

## Architecture

`POST /jobs` queues a job (`JobsService`, in-memory queue, one job at a time) and returns its id. The worker runs `IngestionService.dublar(video, nome)` (or `dublarLink`, which first downloads with yt-dlp) inside the job's `Trace`:

1. **FfmpegService.extrairAudio** — MP3 of the video
2. **SeparacaoService** — Demucs (`htdemucs`, two stems) splits voice and background
3. **TranscricaoService** — AssemblyAI with speaker labels and the BJJ term list; `cortarEmFalas` cuts words into lines ("falas": one speaker, sentence end or pause ≥ 0.4 s, max ~12 s)
4. **TraducaoService + JuizService** — one Claude call (Sonnet 5.5, high effort, server-side fallback) corrects the English and translates the whole video (character budget per line); the judge (Haiku 5.5) reviews each line, rejected lines go back to the translator up to 2 times (`revisarComJuiz`)
5. **VozService** — AssemblyAI TTS per line; the speaker who talks most gets `aai-cassio`, the second `aai-benicio` (`atribuirVozes`)
6. **encaixarFalas / planejarEncaixe** — fits each line into its slot: shorten (Claude) → speed up ≤ 15% (`atempo`) → run over the following silence → after 3 shortenings, cut at the next line with a fade
7. **FfmpegService.montarVideo** — each line delayed to its original start (`adelay`) and mixed over the background (`amix normalize=0`); video stream copied, duration = the video's

Each step opens a stage in the `Trace` (`back/src/trace/`) and every paid call is recorded with its cost (`back/src/custos/`, prices in `precos.ts`; model and effort per role in `POR_PAPEL`, `traducao/claude.ts`). The dubbed MP4 goes to `dublados/<id>.mp4` at the root. A JSON report per video (speaker, English, Portuguese, judge verdict, original vs. dubbed start, shortened/accelerated/cut) is written to `relatorios/` at the root.

### Backend module structure (`back/`)

- **JobsModule** — Queue and routes: `POST /jobs` (multipart `video` up to 100MB or `url`), `GET /jobs` (history), `GET /jobs/:id`, `GET /jobs/:id/eventos` (SSE, live jobs only), `GET /jobs/:id/video`. `JobsRepositorio` writes each job, its stages and paid calls to Postgres as they change, reads old jobs back, and marks `na fila`/`dublando` as `interrompido` on startup.
- **IngestionModule** — Pipeline orchestrator (no controller).
- `src/banco/` — `PrismaService`; schema in `back/prisma/schema.prisma`, generated client in `src/generated/prisma` (not in git).
- **FfmpegModule**, **SeparacaoModule**, **TranscricaoModule**, **TraducaoModule** (translator, judge, BJJ guide in `guia-bjj.ts`), **VozModule**, **YoutubeModule** (yt-dlp download).
- `src/encaixe/` and `src/relatorio/` — pure functions (fit planning, report).
- **shared/types.ts** — `Fala`, `FalaTraduzida`, `FalaRevisada`, `EncaixeDaFala`.
- `back/scripts/` — manual scripts (download a video, voice probe, translate + judge a local video, model comparison, no-cost rehearsal and rehearsal server with simulated paid services). Paid APIs: run only on purpose.

### Frontend (`front/`)

Single-page React + Vite + Tailwind CSS v4 app, no router: `App.tsx` switches between the dubbing card (idle, progress from SSE with step/lines/time/cost, done, error), the history and a job's cost trace (`Historico.tsx`; formatters in `formato.ts`). Crisp Glass visual style (glass card, Inter font, indigo accent). Communicates with backend via Vite proxy (`/api` → `localhost:3000`). NestJS does NOT use a global API prefix.

### Key design decisions

- Processing is in-memory using Buffers. Persisted: the dubbed MP4 (`dublados/`), the history with costs (local Postgres) and the diagnostic report (`relatorios/`).
- Services that call ffmpeg/demucs use OS temp directories (`mkdtemp`), cleaned up in `finally`.
- Rules with a single right answer (cutting lines, judge retry limit, fitting) are code, not LLM.
- The codebase uses Portuguese for domain terminology (method names, log messages, variable names).
- Package manager is **pnpm** with workspaces (`pnpm-workspace.yaml`). Lockfile at root.
