# Projeto — Dubla

**Atualizado em:** 2026-11-17

## Comandos

| Ação | Comando | Quando rodar | Observação |
|---|---|---|---|
| Testes (todos) | `cd back && CI=true npx jest` | fim de fase e entrega, se entrou código de produção depois da última vez que passou | leva ~3 s (medido em 2026-11-17). Em 2026-11-17 a suíte estava vermelha: 6 de 9 specs geradas pelo Nest falham por falta de `ConfigService` no módulo de teste |
| Teste (um arquivo) | `cd back && CI=true npx jest <caminho>` | a cada tarefa | `pnpm --filter dubla run test` falha sem TTY (pnpm tenta reinstalar); usar `npx jest` direto em `back/` |
| Lint | `cd back && npx eslint "src/**/*.ts"` | fim de fase e entrega | em 2026-11-17: 8 erros preexistentes (maioria prettier). `npm run lint` usa `--fix` e reescreve arquivos |
| Typecheck | `cd back && npx tsc --noEmit -p tsconfig.json` | fim de fase e entrega | ~2 s |
| Build | `pnpm build` (raiz) | entrega | front: `tsc -b && vite build`; back: `nest build` |

Front (`front/`) não tem testes; verificação dele é visual.

## Branches

- Integração: `master` (remoto `origin` = github.com/gustavokurtz/dubla)
- Padrão de nome: `feat/<slug>`
- Atenção: `master` local pode ter commits não enviados (ex.: `chore: add trilho`). Crie a branch a partir do `master` local, não de `origin/master`.

## Commits

Conventional Commits em inglês, minúsculo, sem escopo, sem ponto final. Exemplos reais:

- `feat: implement complete upload UI with all states (idle, uploading, done, error)`
- `fix: shimmer animation, useRef for file input, inline validation errors`
- `docs: update CLAUDE.md for monorepo structure`

## Stack e estrutura

- Monorepo pnpm: `back/` (NestJS 11, Jest 30, ts-jest) e `front/` (React 19 + Vite + Tailwind v4).
- Backend: um módulo Nest por integração (`back/src/<servico>/<servico>.module.ts|service.ts`), orquestrado por `back/src/ingestion/ingestion.service.ts`. Endpoint único `POST /ingestion/dublar`.
- Tipos compartilhados em `back/src/shared/types.ts`. Testes ao lado do arquivo (`*.spec.ts`).
- `.env` na raiz (lido por `ConfigModule` com `path.join(process.cwd(), '..', '.env')`).

## Convenções de código

- Nomes de domínio, métodos e logs em português (ver `back/src/ffmpeg/ffmpeg.service.ts`).
- Arquivos temporários do ffmpeg em `mkdtemp` + limpeza em `finally` (ver `back/src/ffmpeg/ffmpeg.service.ts`).
- Processamento em memória com `Buffer`, sem persistência.

## Regras fixas

- Chamadas a APIs pagas (AssemblyAI, Anthropic) em teste automatizado são sempre mockadas. Rodada real só com o "pode" do usuário na sessão.
- Nunca commitar `.env` nem chaves.

## Áreas sensíveis

- Sem banco de dados.
- Serviços externos pagos: AssemblyAI (`ASSEMBLYAI_API_KEY`), Anthropic (`ANTHROPIC_API_KEY`). Avisar antes de qualquer rodada real.

## Armadilhas

- `CLAUDE.md` descreve uma pipeline por segmentos com ElevenLabs que não é a que roda: em 2026-11-17 a pipeline real usava Whisper texto corrido + TTS da OpenAI num bloco só. Confie no código, não no `CLAUDE.md`, até ele ser atualizado.
- Ferramentas Python (yt-dlp, demucs) ficam em `back/.venv-py`, criado com `uv` (`~/.local/bin/uv`): `python3 -m venv` falha porque o sistema não tem `python3.12-venv` (2026-11-17).
