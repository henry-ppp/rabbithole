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

- **Load fixture** — preview the Git rebase sample (cheat sheet or roadmap, depending on Style).
- **Generate** — runs style-specific planners and writers via `@cursor/sdk`.

Choose **Style** in the UI:

| Style | Purpose |
|-------|---------|
| Cheat sheet | Lookup tables with question frames; supports drill-down |
| Roadmap | Interactive concept graph on the canvas; no drill-down |

## Scripts

```bash
pnpm dev      # development server
pnpm build    # production build (webpack)
pnpm start    # serve production build
pnpm lint     # ESLint
pnpm test:cheat-sheet:json   # JSON extract / layout unit tests (no API key)
pnpm test:cheat-sheet:e2e    # full agent pipeline (requires CURSOR_API_KEY in .env)
```

E2E options:

```bash
pnpm test:cheat-sheet:e2e -- --topic "git rebase" --style cheatsheet
pnpm test:cheat-sheet:e2e -- --topic "git rebase" --style roadmap
```

Legacy `--depth` is accepted and maps to cheat sheet style.

## Environment

| Variable | Description |
|----------|-------------|
| `CURSOR_API_KEY` | Server-only; required for agent generation |
| `CURSOR_AGENT_RUNTIME` | Optional: `local` (default) or `cloud` |

### Vercel

Local agents need a writable `HOME`. On Vercel, `lib/agent-client.ts` redirects `HOME` and `TMPDIR` to `/tmp` at startup (dashboard `HOME` overrides are blocked). Set `CURSOR_API_KEY` in project env vars. The Linux native SDK binary (`@cursor/sdk-linux-x64`) is bundled via `serverExternalPackages`. Agent state in `/tmp` is ephemeral per invocation.
