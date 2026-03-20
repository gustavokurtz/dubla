# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dubla** is a video dubbing pipeline built with NestJS. It accepts a video file, extracts audio, transcribes it with OpenAI Whisper, translates the transcription to Brazilian Portuguese using GPT-4o-mini, generates speech with ElevenLabs TTS, and reassembles the video with the dubbed audio track synchronized to the original timestamps.

## Commands

```bash
pnpm start:dev          # Run in watch mode (development)
pnpm build              # Compile to dist/
pnpm start:prod         # Run compiled output
pnpm test               # Run unit tests (jest)
pnpm test -- --testPathPattern=ffmpeg  # Run tests for a specific module
pnpm test:e2e           # Run e2e tests
pnpm lint               # ESLint with auto-fix
pnpm format             # Prettier formatting
```

## Environment Variables

Requires a `.env` file at the project root with:
- `OPENAI_API_KEY` — OpenAI API key (used for Whisper transcription and GPT translation)
- `ELEVENLABS_API_KEY` — ElevenLabs API key (used for TTS voice generation)

`ConfigModule` is loaded globally, so all modules access env vars via `ConfigService`.

## Architecture

The app is a **5-step pipeline** orchestrated by the `IngestionService`:

1. **FfmpegService** — Extracts audio from uploaded video (MP3 via fluent-ffmpeg)
2. **OpenaiService** — Transcribes audio into timed segments using Whisper (`verbose_json` with segment timestamps)
3. **OpenaiService** — Translates all segments from English to PT-BR using GPT-4o-mini in a single batch prompt
4. **ElevenlabsService** — Generates TTS audio for each translated segment sequentially (voice: `JBFqnCBsd6RMkjVDRZzb` / George, model: `eleven_multilingual_v2`)
5. **FfmpegService** — Reassembles video by delaying each dubbed audio segment to its original timestamp using ffmpeg's `adelay` + `amix` complex filter, then muxing with the original video stream (copy codec)

### Module structure

- **IngestionModule** — Orchestrator. Imports Ffmpeg, OpenAI, and ElevenLabs modules. Exposes `POST /ingestion/dublar` (multipart file upload, field name `video`, max 100MB, video/* only). Returns the dubbed MP4 as a download.
- **FfmpegModule** — Audio extraction and video reassembly using temp directories (`mkdtemp`). All temp files are cleaned up in `finally` blocks.
- **OpenaiModule** — Whisper transcription and GPT translation. Uses `openai` SDK.
- **ElevenlabsModule** — Text-to-speech via `@elevenlabs/elevenlabs-js` SDK.
- **shared/types.ts** — `Segmento` (start, end, texto) and `SegmentoComAudio` (adds audio Buffer) interfaces used across modules.

### Key design decisions

- All processing is in-memory using Buffers (no persistent storage).
- FfmpegService uses OS temp directories for intermediate files required by ffmpeg CLI, cleaned up after each operation.
- The codebase uses Portuguese for domain terminology (method names, log messages, variable names).
- Package manager is **pnpm** (lockfile: `pnpm-lock.yaml`).
