# Rabbithole

Agent-orchestrated cheat sheets on a pan/zoom canvas (Next.js 16).

## Getting started

Requires [pnpm](https://pnpm.io/installation) (see `packageManager` in `package.json`).

Native deps (`sharp`, `sqlite3` for `@cursor/sdk`) are allowlisted in [`pnpm-workspace.yaml`](pnpm-workspace.yaml).

```bash
pnpm install
cp .env.example .env.local
# Set CURSOR_API_KEY in .env.local for agent generation
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and go to **Cheat sheet canvas**, or visit [http://localhost:3000/cheat-sheet](http://localhost:3000/cheat-sheet).

- **Load fixture** — preview the Git rebase sample without an API key.
- **Generate** — runs the planner → per-section writers → programmatic layout via `@cursor/sdk`.

## Scripts

```bash
pnpm dev      # development server
pnpm build    # production build (webpack)
pnpm start    # serve production build
pnpm lint     # ESLint
pnpm test:cheat-sheet:json   # JSON extract / layout unit tests (no API key)
pnpm test:cheat-sheet:e2e    # full agent pipeline (requires CURSOR_API_KEY in .env)
```

E2E options: `pnpm test:cheat-sheet:e2e -- --topic "cfa level 2" --depth exam`

## Environment

| Variable | Description |
|----------|-------------|
| `CURSOR_API_KEY` | Server-only; required for agent generation |
