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
| [`packages/shared/`](./packages/shared) | `@pocketdev/shared` | Shared TypeScript contracts: queue payloads, PTY protocol, sync protocol, domain enums. |

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

This is the **demo scaffold** (Weeks 1–2 of the 14-week plan): monorepo, NestJS modules,
Prisma schema, queue wiring, and mobile app are in place. The execution engine, CLI
sync, desktop runtime, on-device LLM, and gVisor hardening are scaffolded with clear
`TODO` markers pointing at their phase in the build plan.


## To Run it

docker compose up -d
cp server/.env.example server/.env && cp mobile/.env.example mobile/.env
pnpm --filter @pocketdev/server db:migrate
pnpm --filter @pocketdev/server db:seed      # free@ / paid@pocketdev.dev · password123
pnpm server:dev   # :3000
pnpm worker:dev
pnpm mobile:dev
