# PocketDev

> Your dev machine in your pocket — sync your local codebase, then browse, edit, run, and commit it from your phone in a real terminal, with the PC powered off.

PocketDev is a mobile-native cloud development environment (KU COMP 207 project). This
repo is a **pnpm + Turborepo monorepo**. Architecture and every technology choice are
documented in [`PROJECT-BRIEF.md`](./PROJECT-BRIEF.md) and [`BUILD-PLAN.md`](./BUILD-PLAN.md).

## Workspaces

| Path | Package | Role |
|---|---|---|
| [`mobile/`](./mobile) | `mobile` | React Native + Expo app (expo-router + NativeWind). Touch-first UI. |
| [`server/`](./server) | `@pocketdev/server` | NestJS **modular monolith** — API/auth/projects/jobs/sessions/billing + BullMQ queue **producer**. |
| [`services/execution-worker/`](./services/execution-worker) | `@pocketdev/execution-worker` | The one split-out process — BullMQ **consumer**: Docker + node-pty + WebSocket PTY streaming. |
| [`services/cli-agent/`](./services/cli-agent) | `@pocketdev/cli-agent` | CLI sync agent — chokidar delta-sync over WebSocket. |
| [`services/desktop-agent/`](./services/desktop-agent) | `@pocketdev/desktop-agent` | Local desktop runtime — same PTY-over-WS server + presence heartbeat (Cloudflare Tunnel). |
| [`packages/shared/`](./packages/shared) | `@pocketdev/shared` | Shared TypeScript contracts: queue payloads, PTY/sync/exec-event/git/file protocols, domain enums. |
| [`packages/pty-core/`](./packages/pty-core) | `@pocketdev/pty-core` | Shared PTY-over-WebSocket gateway (node-pty + ws + flow control + JWT). Used by both the worker (Docker runner) and desktop agent (host runner). |

The modular monolith's modules **are** the future service boundaries. The only genuine
seam split out now is the execution engine (Build Plan, Decision 2).

## Tech stack

Everything is **TypeScript**. Choices and their rationale are argued in full in
[`BUILD-PLAN.md`](./BUILD-PLAN.md); the summary:

| Component | Chosen technology | Why |
|---|---|---|
| Mobile app | React Native + Expo (expo-router, NativeWind) | Native, touch-first app — not a browser IDE shrunk onto a phone. Locked choice. |
| Backend API | NestJS 11 — **modular monolith** | Correct architecture at this scale; modules **are** the future service boundaries. |
| Database | PostgreSQL + Prisma | Relational core (users → projects → jobs → sessions); JSONB for file manifests; ACID; type-safe DX. |
| Queue / ephemeral state | Redis + BullMQ | Job scheduling, session state, worker coordination. Free tier shares the queue; paid jumps it. |
| Execution engine | Separate Node process: node-pty + Dockerode + `ws` | The one split-out process — different runtime profile + untrusted-code blast-radius isolation. |
| Terminal streaming | node-pty → WebSocket → xterm.js / RN terminal | Standard, battle-tested pattern; flow-control to avoid buffer drops. |
| File sync | CLI agent: chokidar + delta hashing over WebSocket | Low-CPU `fs.watch`; rsync-style delta transfer (mtime + size + hash). |
| Local desktop runtime | Cloudflare Tunnel (demo) / Tailscale · Headscale (prod) | Outbound-only, NAT/CGNAT traversal, no port forwarding, native WebSocket. |
| On-device LLM | llama.rn (llama.cpp) + GGUF **Q4_K_M** model | Explains failed commands on-device, offline — independent of backend scale. |
| Container isolation | Hardened Docker + **gVisor** (`runsc`) demo; Firecracker / Kata (prod) | Docker alone is not a security boundary for untrusted code. |
| Reverse proxy / TLS | Caddy | Automatic Let's Encrypt, WebSocket passthrough, lowest friction. |
| Demo host | Oracle Cloud Always Free **ARM** (2 OCPU / 12 GB) | Free ARM tier; fallback Hetzner or Oracle PAYG. |
| Process manager | PM2 or systemd | Keep the API + worker alive, restart on crash. |
| Monorepo tooling | pnpm workspaces + Turborepo | Task orchestration + caching across workspaces. |

### Key architecture decisions (from the build plan)

1. **PostgreSQL + Prisma**, not MongoDB — the data is overwhelmingly relational; JSONB covers the ~20% document-shaped file manifests.
2. **Modular monolith + exactly one worker**, not microservices — the only legitimate seam is splitting the execution engine from the CRUD API.
3. **All TypeScript**, no Go — `node-pty` is a native Node addon; the rest is I/O-bound.
4. **Reverse tunnel, not a custom relay** — Cloudflare Tunnel for the demo, Tailscale for production.
5. **Docker is not enough for untrusted code** — layer gVisor now, microVMs (Firecracker/Kata) at scale.

## Prerequisites

- Node.js ≥ 20 (this repo is on 22 — see [`.nvmrc`](./.nvmrc))
- pnpm ≥ 10 (`corepack enable`)
- Docker (for local Postgres + Redis, and later the execution sandbox)

## Getting started

```bash
# 1. Install everything
pnpm install

# 2. Start local Postgres + Redis
docker compose up -d

# 3. Configure env
cp server/.env.example server/.env
cp mobile/.env.example  mobile/.env

# 4. Create the database schema + seed two demo accounts
pnpm --filter @pocketdev/server db:migrate     # runs prisma migrate dev
pnpm --filter @pocketdev/server db:seed        # free@pocketdev.dev / paid@pocketdev.dev (password123)

# 5. Run
pnpm server:dev      # NestJS API on http://localhost:3000
pnpm worker:dev      # execution worker (needs Redis)
pnpm mobile:dev      # Expo dev server
```

## Common scripts (root)

| Command | What it does |
|---|---|
| `pnpm dev` | Run every workspace's dev task via Turbo |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm format` | Prettier-format the repo |
| `pnpm server:dev` / `worker:dev` / `mobile:dev` | Run a single app |
| `pnpm db:migrate` / `db:generate` | Prisma migrate / generate (server) |

## Status

The **backend is built end-to-end** (everything except the mobile app UI and the
on-device LLM, which lives on the phone). All six workspaces build and type-check,
and the unit tests pass.

| Area | State |
|---|---|
| Auth / users / projects / billing / tiers | ✅ API complete |
| CLI delta-sync → server file store (JSONB manifest) | ✅ `services/cli-agent` + `/sync` gateway |
| File browse / read / write API | ✅ `GET/PUT/DELETE /projects/:id/file(s)` |
| Terminal session start + tier-priority queue | ✅ `POST /jobs` → `StartSessionResponse` |
| Execution engine — hardened Docker + real PTY over WS | ✅ `services/execution-worker` + `packages/pty-core` |
| gVisor (`runsc`) hardening | ✅ one-env-var switch (`EXECUTION_RUNTIME=runsc`) |
| Local-desktop runtime + presence routing | ✅ `services/desktop-agent`, desktop-if-present-else-cloud |
| Git from the phone (status/commit/push/…) | ✅ `/projects/:id/git/*` (simple-git) |
| Execution-status reconciliation (worker → Redis → DB) | ✅ `ExecutionReconciler` (worker never touches the DB) |
| Queue dashboard | ✅ Bull Board at `/admin/queues` (basic-auth) |
| Mobile app UI · on-device LLM | ⏳ out of scope for this backend pass |

**Architecture note:** the execution worker (the untrusted-code blast radius) never
touches Postgres. It publishes lifecycle events on Redis; the API reconciles them into
the DB (BUILD-PLAN Decision 2). The PTY-over-WebSocket server is shared code
(`packages/pty-core`) used by *both* the cloud worker (Docker runner) and the desktop
agent (host runner).

## Run it

```bash
pnpm install
docker compose up -d                                # Postgres + Redis
cp .env.example server/.env                          # then edit JWT_SECRET etc.
pnpm --filter @pocketdev/server db:migrate           # prisma migrate dev
pnpm --filter @pocketdev/server db:seed              # free@ / paid@pocketdev.dev · password123
pnpm server:dev                                      # API + /admin/queues on :3000
pnpm worker:dev                                      # execution worker + PTY gateway on :4100 (needs Docker)
```

## Verification (end-to-end, needs Docker + Postgres + Redis)

```bash
# 1. Auth → grab a token
TOKEN=$(curl -s localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"free@pocketdev.dev","password":"password123"}' | jq -r .accessToken)

# 2. Find the seeded project id
PROJECT=$(curl -s localhost:3000/projects -H "authorization: Bearer $TOKEN" | jq -r '.[0].id')

# 3. Sync a local folder up
POCKETDEV_TOKEN=$TOKEN pnpm --filter @pocketdev/cli-agent start sync ./some-folder -p $PROJECT

# 4. Start a terminal session (returns wsUrl + wsToken); connect a WS client and
#    speak the pty-protocol ({type:"start", sessionId, projectId, token}).
curl -s localhost:3000/jobs -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d "{\"projectId\":\"$PROJECT\",\"command\":\"node -v\"}"

# 5. Freemium: with WORKER_CONCURRENCY=1, a 2nd FREE session queues while a PAID one jumps.
#    Watch it live in the dashboard at http://localhost:3000/admin/queues (admin/admin).
```

For the desktop-runtime path, run `pnpm --filter @pocketdev/desktop-agent start` with
`POCKETDEV_TOKEN` + `JWT_SECRET` set, expose it via `cloudflared`, and `POCKETDEV_TUNNEL_URL`
will make the API route that user's sessions to the desktop instead of the cloud.
