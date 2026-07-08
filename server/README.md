# @pocketdev/server

PocketDev backend — a **NestJS modular monolith** (Build Plan, Decision 2). Handles
auth, CRUD, git, and acts as the **producer** for the BullMQ execution queue. The
execution engine itself runs as a separate process (`services/execution-worker`).

## Modules

| Module | Routes | Notes |
|---|---|---|
| `auth` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | JWT; global guard, opt out with `@Public()`. |
| `users` | `GET /users/me` | Profile + subscription. |
| `projects` | `GET/POST /projects`, `GET/DELETE /projects/:id` | JSONB `manifest` for file sync. |
| `jobs` | `GET/POST /jobs`, `GET /jobs/:id` | Enqueues to BullMQ; free = normal priority, paid = jumps the queue; routes DESKTOP-if-present-else-CLOUD. |
| `sessions` | `GET /sessions`, `GET /sessions/history` | Terminal sessions. |
| `billing` | `GET /billing/subscription`, `POST /billing/upgrade\|downgrade` | Demo tier switch (no real payment). |
| `desktop` | `POST /desktop/heartbeat\|offline`, `GET /desktop/status` | Local-runtime presence (Decision 4). |
| `health` | `GET /health` | Public liveness check. |

## Data model

PostgreSQL via Prisma — see [`prisma/schema.prisma`](./prisma/schema.prisma):
`User → Project → Job → Session`, plus `Subscription` and `DesktopPresence`.

## Develop

```bash
docker compose up -d                 # from repo root: Postgres + Redis
cp .env.example .env
pnpm db:migrate                      # prisma migrate dev
pnpm db:seed                         # demo accounts
pnpm start:dev                       # http://localhost:3000
```
