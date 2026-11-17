# Projeto — Dubla

**Atualizado em:** 2026-11-17

## Comandos

| Ação | Comando | Quando rodar | Observação |
|---|---|---|---|
| Testes (todos) | `cd back && CI=true npx jest` | fim de fase e entrega, se entrou código de produção depois da última vez que passou | leva ~5 s (2026-11-17; `montar-video.spec.ts` roda o ffmpeg real). Verde desde a T11 da dublagem-bjj |
| Teste (um arquivo) | `cd back && CI=true npx jest <caminho>` | a cada tarefa | `pnpm --filter dubla run test` falha sem TTY (pnpm tenta reinstalar); usar `npx jest` direto em `back/` |
| Lint | `cd back && npx eslint "src/**/*.ts"` | fim de fase e entrega | limpo desde 2026-11-17 (inclui `test/`). `npm run lint` usa `--fix` e reescreve arquivos |
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

- Antes de rodada real paga que mude a pipeline, rodar o ensaio sem custo (`back/scripts/ensaio-sem-custo.ts`, ver README/estado da dublagem-bjj) e corrigir o que ele mostrar: o dev é sensível a custo ("não tô rico") (2026-11-17).

- Chamadas a APIs pagas (AssemblyAI, Anthropic) em teste automatizado são sempre mockadas. Rodada real só com o "pode" do usuário na sessão.
- Nunca commitar `.env` nem chaves.

## Áreas sensíveis

- Postgres local do histórico: `docker compose up -d` na raiz (porta 5433). Migrations (`cd back && npx prisma migrate dev`) só com `DATABASE_URL` em `localhost:5433` (2026-11-17).
- Serviços externos pagos: AssemblyAI (`ASSEMBLYAI_API_KEY`), Anthropic (`ANTHROPIC_API_KEY`). Avisar antes de qualquer rodada real.

## Armadilhas

- `pkill -f <padrão>` no Bash mata o próprio shell; parar o back com `kill $(pgrep -f "ts-nod[e].* src/main")` (o `.*` pega também o back subido com `npx ts-node`, que vira `ts-node/dist/bin.js src/main.ts`) (2026-11-17).
- zsh expande `?` de links: link do YouTube sempre entre aspas no `curl -F 'url=…'` (2026-11-17).
- AssemblyAI TTS: limite de 50 pedidos/min por conta (o `VozService` já respeita); a voz pronta põe silêncio nas pontas (o `IngestionService` já apara) (2026-11-17).
- Python das ferramentas (Demucs, yt-dlp): `back/.venv-py` a partir de `back/requirements-python.txt` (comando no README) (2026-11-17).

- Ferramentas Python (yt-dlp, demucs) ficam em `back/.venv-py`, criado com `uv` (`~/.local/bin/uv`): `python3 -m venv` falha porque o sistema não tem `python3.12-venv` (2026-11-17).
- `pnpm` global é 11.x; o projeto usa 10.32.1, fixado em `packageManager` no `package.json` da raiz (o 11 troca sozinho para a 10.32.1 ali dentro). Sem isso o 11 recusava a store v10 (`ERR_PNPM_UNEXPECTED_STORE`) e pacotes publicados há menos de 1 dia (`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`) (2026-11-17).
