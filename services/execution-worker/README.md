# @pocketdev/execution-worker

The **execution engine** — the single process split out from the modular monolith
(Build Plan, Decision 2). It has a fundamentally different runtime profile from the
API (long-lived stateful PTY/WebSocket connections, untrusted-code blast radius,
CPU/IO-spiky) so it runs as its own process.

- **Transport in:** BullMQ over Redis. The API (`server/`) is the producer; this is
  the consumer. Queue name and payload types come from `@pocketdev/shared`.
- **What it will do (Weeks 5–8):** spawn a hardened Docker container per session via
  Dockerode, attach `node-pty`, stream the terminal over WebSocket (`PtyServerMessage`),
  and run under gVisor (`--runtime=runsc`).

> `node-pty` is a native addon and is **not yet installed** — add it during the
> execution-engine phase (`pnpm --filter @pocketdev/execution-worker add node-pty`)
> once a C/C++ toolchain is available on the build host.

## Run

```bash
# needs Redis (see root docker-compose.yml)
pnpm --filter @pocketdev/execution-worker dev
```
