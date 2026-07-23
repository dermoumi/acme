# acme

Monorepo of composable TypeScript libraries to build apps once and deploy them
anywhere: Cloudflare (free tier) or stateless Docker containers on a homelab,
with pluggable backends (SQLite, libsql, PostgreSQL, D1, KV, Redis/Valkey,
S3-compatible storage).

Features are composed as Vite plugins (`@acme/db`, `@acme/sentry`, ...) so an
app opts into exactly what it needs — React apps, WebGL games, offline-first
PWAs. Apps favor progressive enhancement and work without JavaScript unless
they inherently need it.

## Workspace

- pnpm workspaces + Turborepo; dependency versions pinned in the
  [pnpm catalog](pnpm-workspace.yaml)
- Libraries live in `packages/*`, deployable apps in `apps/*`; all are
  consumed as pure TypeScript source (no publishing — apps depend on
  libraries via `workspace:*`)
- Lint/format via oxlint + oxfmt, strict TypeScript presets in
  [`@acme/tsconfig`](packages/tsconfig)
- Conventional commits + semantic versioning (release-please)

## Commands

| Command         | Purpose                                 |
| --------------- | --------------------------------------- |
| `pnpm lint`     | Format check + lint + typecheck (turbo) |
| `pnpm lint:fix` | Auto-fix lint and formatting            |
| `pnpm test`     | Run tests across packages               |
| `pnpm build`    | Build deployables                       |
| `pnpm dev`      | Run dev servers                         |
