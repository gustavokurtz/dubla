# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dubla** is a video dubbing pipeline. It accepts a video file, extracts audio, transcribes it with OpenAI Whisper, translates the transcription to Brazilian Portuguese using GPT-4o-mini, generates speech with ElevenLabs TTS, and reassembles the video with the dubbed audio track synchronized to the original timestamps.

This is a **monorepo** with two workspaces:
- `back/` — NestJS backend (API + pipeline)
- `front/` — React frontend (upload UI)

## Commands

```bash
# Root (runs both workspaces)
pnpm dev                # Run back + front in parallel
pnpm dev:back           # Run only backend (NestJS watch mode)
pnpm dev:front          # Run only frontend (Vite dev server)
pnpm build              # Build all workspaces

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
- `OPENAI_API_KEY` — OpenAI API key (used for Whisper transcription and GPT translation)
- `ELEVENLABS_API_KEY` — ElevenLabs API key (used for TTS voice generation)

`ConfigModule` is loaded globally with `envFilePath: path.join(process.cwd(), '..', '.env')` so it reads from the root.

## Architecture

The app is a **5-step pipeline** orchestrated by the `IngestionService`:

1. **FfmpegService** — Extracts audio from uploaded video (MP3 via fluent-ffmpeg)
2. **OpenaiService** — Transcribes audio into timed segments using Whisper (`verbose_json` with segment timestamps)
3. **OpenaiService** — Translates all segments from English to PT-BR using GPT-4o-mini in a single batch prompt
4. **ElevenlabsService** — Generates TTS audio for each translated segment sequentially (voice: `JBFqnCBsd6RMkjVDRZzb` / George, model: `eleven_multilingual_v2`)
5. **FfmpegService** — Reassembles video by delaying each dubbed audio segment to its original timestamp using ffmpeg's `adelay` + `amix` complex filter, then muxing with the original video stream (copy codec)

### Backend module structure (`back/`)

- **IngestionModule** — Orchestrator. Imports Ffmpeg, OpenAI, and ElevenLabs modules. Exposes `POST /ingestion/dublar` (multipart file upload, field name `video`, max 100MB, video/* only). Returns the dubbed MP4 as a download.
- **FfmpegModule** — Audio extraction and video reassembly using temp directories (`mkdtemp`). All temp files are cleaned up in `finally` blocks.
- **OpenaiModule** — Whisper transcription and GPT translation. Uses `openai` SDK.
- **ElevenlabsModule** — Text-to-speech via `@elevenlabs/elevenlabs-js` SDK.
- **shared/types.ts** — `Segmento` (start, end, texto) and `SegmentoComAudio` (adds audio Buffer) interfaces used across modules.

### Frontend (`front/`)

Single-page React + Vite + Tailwind CSS v4 app. One component (`App.tsx`) with 4 states: idle (upload), uploading (shimmer progress), done (download), error. Crisp Glass visual style (glass card, Inter font, indigo accent). Communicates with backend via Vite proxy (`/api` → `localhost:3000`). NestJS does NOT use a global API prefix.

### Key design decisions

- All processing is in-memory using Buffers (no persistent storage).
- FfmpegService uses OS temp directories for intermediate files required by ffmpeg CLI, cleaned up after each operation.
- The codebase uses Portuguese for domain terminology (method names, log messages, variable names).
- Package manager is **pnpm** with workspaces (`pnpm-workspace.yaml`). Lockfile at root.
