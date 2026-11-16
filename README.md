# Dubla

Dubs English videos into Brazilian Portuguese. Upload a video, get the same video back with a Portuguese voice track.

I built it because the best jiu-jitsu instructionals are in English and YouTube's auto-translation either doesn't cover them or gets the technique wrong. A 10-minute video comes back in a few minutes.

## How it works

```mermaid
flowchart LR
    A[Video upload] --> B[ffmpeg<br/>extract audio]
    B --> C[Whisper<br/>transcribe]
    C --> D[GPT-4o-mini<br/>translate EN → PT-BR]
    D --> E[OpenAI TTS<br/>generate voice]
    E --> F[ffmpeg<br/>swap audio track]
    F --> G[Dubbed MP4]
```

`IngestionService` runs five steps in order:

1. **Extract audio.** ffmpeg pulls an MP3 out of the uploaded video.
2. **Transcribe.** Whisper (`whisper-1`) turns the audio into text.
3. **Translate.** GPT-4o-mini translates to Brazilian Portuguese. The prompt asks it to adapt idioms and keep a natural spoken tone instead of translating word for word.
4. **Generate voice.** OpenAI TTS (`tts-1`, voice `onyx`) reads the translation. Text longer than 4,000 characters is split at sentence boundaries and the audio chunks are joined.
5. **Rebuild the video.** ffmpeg copies the original video stream untouched and replaces the audio with the dubbed track.

Everything happens in memory with Buffers. ffmpeg only touches OS temp directories, which are deleted after each step. Nothing is stored.

## Stack

| | |
| --- | --- |
| Backend | NestJS 11 · TypeScript · fluent-ffmpeg · Multer |
| AI | OpenAI Whisper · GPT-4o-mini · OpenAI TTS |
| Frontend | React 19 · Vite · Tailwind CSS v4 |
| Tooling | pnpm workspaces · Jest · ESLint · Prettier |

There is also an `ElevenlabsModule` for ElevenLabs TTS (`eleven_multilingual_v2`). It is wired into the app module but the pipeline currently uses OpenAI TTS.

## Run it locally

Requirements: Node.js 20+, pnpm and ffmpeg installed on your PATH.

```bash
git clone https://github.com/gustavokurtz/dubla.git
cd dubla
pnpm install
```

Create a `.env` file at the **repository root** (not inside `back/`):

```bash
OPENAI_API_KEY=your-openai-key
ELEVENLABS_API_KEY=your-elevenlabs-key   # only needed by ElevenlabsModule
```

Start both apps:

```bash
pnpm dev          # backend on :3000, frontend on Vite's port
```

Open the frontend, drop a video and wait for the download. The frontend proxies `/api` to `localhost:3000`.

## API

`POST /ingestion/dublar`

- Body: `multipart/form-data` with the file in the `video` field
- Accepts `video/*` up to 100 MB
- Returns the dubbed video as `video/mp4` (`video-dublado.mp4`)

```bash
curl -F "video=@lesson.mp4" http://localhost:3000/ingestion/dublar -o dublado.mp4
```

## Project layout

```
back/                 NestJS API and pipeline
  src/ingestion/      orchestrator + upload endpoint
  src/ffmpeg/         audio extraction and audio swap
  src/openai/         Whisper, GPT translation, TTS
  src/elevenlabs/     ElevenLabs TTS (not used by the pipeline yet)
front/                React upload UI (idle, uploading, done, error)
```

## Limitations

- The dubbed audio is one continuous track. It is not aligned segment by segment with the original timestamps, so long videos can drift from the speaker's mouth and gestures.
- One voice for the whole video, no speaker separation.
- The request stays open for the whole pipeline. A queue would be needed for long videos or many users.

## Tests

```bash
pnpm --filter dubla run test
pnpm --filter dubla run test:e2e
```
