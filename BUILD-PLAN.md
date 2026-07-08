# PocketDev Build Plan: Mobile Native Cloud Development Environment

*(A 4th-semester KU CS project — demo build + documented production-migration blueprint)*

## TL;DR
- **Use PostgreSQL (via Prisma), build a NestJS modular monolith with exactly ONE split-out process (the PTY/Docker execution worker), keep everything in TypeScript, use Cloudflare Tunnel (demo) → Tailscale (production) for the local-desktop-as-runtime feature, and deploy on Oracle Cloud ARM — but downgrade your resource expectations, because Oracle halved the free ARM tier to 2 OCPU/12GB on June 15, 2026.**
- Your two instincts are both wrong: "Postgres probably not needed" is WRONG (Postgres wins clearly here), and "we will need microservices" is WRONG (a modular monolith + one worker process is correct). The one genuinely correct architectural seam is splitting the execution engine from the CRUD API — do that, and nothing more.
- Docker alone is not a security boundary for untrusted code. Fine to acknowledge for the demo, but the production blueprint must specify gVisor (`runsc`) at minimum and Firecracker/Kata microVMs as the real answer — exactly as Replit/E2B/Modal do.

## Key Findings

### Decision 1: DATABASE — Use PostgreSQL with Prisma. Your instinct is wrong.
**Recommendation: PostgreSQL + Prisma ORM. Not MongoDB.**

The data is overwhelmingly relational: users → projects → jobs → sessions, plus tiers/billing. These have foreign keys, need referential integrity, and benefit from transactions (e.g. "create job + decrement quota + write session record" must be atomic). PostgreSQL has had ACID transactions for 30+ years. MongoDB bolted on multi-document transactions in v4.0, and per MongoDB's own Performance Best Practices docs, "by default, MongoDB will automatically abort any multi-document transaction that runs for more than 60 seconds" (governed by `transactionLifetimeLimitSeconds`), with the additional guidance that "no more than 1,000 documents should be modified within a transaction." Those are real constraints you'd be designing around; Postgres has none of them.

The one document-shaped part — file manifests and sync-delta metadata — is handled perfectly by Postgres's JSONB type (binary JSON, GIN-indexable, queryable with `@>`, `->`, `->>`). This is the "80/20 rule": ~80% structured, ~20% dynamic → JSONB column on a relational table. You do NOT need a second database for it. The one caveat to respect: don't put high-churn counters inside a big JSONB blob (Postgres rewrites the whole row under MVCC on each update) — pull hot fields like `view_count`/`status` into real typed columns. For file manifests that are written once per sync and read often, JSONB is ideal.

Redis already owns ephemeral/queue state via BullMQ, so MongoDB's supposed advantage (fast flexible writes) is moot — the high-churn data isn't in your primary DB anyway.

**Tiebreaker on ORM:** Prisma gives you type-safe, auto-generated TypeScript types from a single schema file, first-class NestJS integration, and Prisma Migrate. For a student team this maximizes developer velocity and catches bugs at compile time. Mongoose only makes sense if you were on Mongo. TypeORM works but Prisma's DX is better in 2026. (Note: Prisma's MongoDB support exists but is weaker than its SQL support — another reason the Postgres+Prisma pairing is the stronger, better-trodden path.)

The only real MongoDB win — sustained high-concurrency partial-document updates and out-of-the-box sharding — is irrelevant to a 1-2 account demo, and per a January 26, 2026 MongoDB benchmark it only surfaces under ~256 concurrent users hammering ~13M large documents. Not your world.

### Decision 2: ARCHITECTURE — Modular monolith + ONE execution worker. Not microservices.
**Recommendation: A NestJS modular monolith for the API/CRUD/auth/git/queue-producer, plus exactly one separate process — the execution engine (PTY + Docker + WebSocket streaming). Two deployables, not a microservices mesh.**

Microservices are an organizational solution (many teams, independent deploys, different failure domains), not a technical one. For a student team they add distributed-systems complexity (service discovery, network serialization, distributed tracing, eventual consistency) with zero payoff at 1-2 users. The NestJS community consensus is explicit: start with a clean modular monolith; your modules ARE your future service boundaries. As one widely-shared framing puts it, "your future microservices are already defined in your modules."

BUT there is one legitimate seam. The PTY/Docker execution engine has fundamentally different runtime characteristics from the CRUD API:
- It holds long-lived, stateful WebSocket + PTY connections (not request/response).
- It is the untrusted-code blast radius — if a container escape or resource exhaustion happens, you want it isolated from your API/auth/DB process.
- It's CPU/IO-bound and spiky, versus the light, latency-sensitive API.
- A crash in a PTY handler must not take down auth.

This maps exactly to documented BullMQ best practice: run workers as separate processes, never inside the API event loop ("Worker crashes bring down your API. Always separate processes"). So the execution engine = your BullMQ worker + node-pty + Docker control + the WebSocket PTY gateway, deployed as its own process. The main NestJS app is the queue producer and CRUD/auth/git API. NestJS also supports a "standalone application" worker that shares the codebase but runs a separate event loop with full DI — that's the clean way to build the worker.

**Transport between them:** you already have Redis. Use BullMQ (Redis) as the job channel; use Redis pub/sub or BullMQ QueueEvents for coordination. You do NOT need NestJS's TCP/gRPC microservice transports here — that's more ceremony than value.

### Decision 3: LANGUAGE — All TypeScript. Don't add Go.
**Recommendation: Keep everything in TypeScript/Node.js.**

node-pty is a native Node addon — the execution worker must be Node. The delta-sync engine and container orchestration are I/O-bound (file hashing, spawning docker, streaming), where the bottleneck is disk/network, not CPU — Node handles these fine. Introducing Go means a second toolchain, a second set of Docker base images, cross-language serialization, and split team knowledge: real cost, no demo benefit.

The honest production exception: a Go rewrite of the delta-sync engine or a Go control plane could help at scale (Go's concurrency and static single-binary distribution are attractive for a fleet agent), and the CLI agent could eventually ship as a Go binary for painless cross-platform distribution. But for the demo and a 14-week timeline, all-TypeScript is unambiguously correct. (Note: gVisor itself is written in Go — you *consume* it as a runtime; you don't write Go.)

### Decision 4: LOCAL-DESKTOP-AS-RUNTIME — Do not build a relay. Cloudflare Tunnel (demo) → Tailscale (production).
**Recommendation: Demo — Cloudflare Tunnel (`cloudflared`) on the desktop, exposing its local WebSocket/HTTP execution endpoint via an outbound-only tunnel. Production — Tailscale (WireGuard mesh), or self-hosted Headscale for full sovereignty.**

The problem: the phone must reach the desktop behind NAT/CGNAT with no port forwarding. This is solved; every tool you named uses one of two patterns:

1. **Reverse tunnel / relay** — an outbound-only connection from the machine to a public relay. This is how VS Code Remote Tunnels, ngrok, and Cloudflare Tunnel work. VS Code Tunnels specifically runs `code tunnel` on the machine, which dials out to Microsoft's dev-tunnel relay; the client connects through that relay. No inbound ports, works through CGNAT.
2. **Mesh VPN** — WireGuard peer-to-peer with NAT traversal + a DERP relay fallback. This is Tailscale/Headscale.

For your stack:
- **Cloudflare Tunnel is the best demo choice.** It's free; `cloudflared` makes an outbound-only, post-quantum-encrypted connection; no port forwarding; automatic TLS; and Cloudflare "supports proxied WebSocket connections without additional configuration" (the upgrade request counts as one long-lived HTTP request). Your desktop agent runs the same small PTY-over-WS server you run on the cloud VM, and `cloudflared` exposes it at a stable hostname. NestJS routes execution to the cloud container or the desktop's tunnel URL based on a presence flag.
- **Caveat:** Cloudflare Tunnel public hostnames proxy HTTP/HTTPS (and WebSocket over them) but NOT arbitrary UDP, and Cloudflare's CDN ToS has grey areas around heavy non-web traffic. For a dev tool streaming terminal text, this is fine.
- **Tailscale is the better production answer:** near-native WireGuard speed on direct connections, DERP relay fallback through CGNAT, a generous free personal plan, and a self-hostable control plane via Headscale (the Tailscale clients work against it unchanged). The friction point is the phone: Tailscale doesn't drop trivially into an Expo app, so for production you'd pair the Tailscale mobile app with your app, or keep the relay pattern.

**Presence/failover logic (your own ~50 lines):** the desktop agent maintains a WebSocket/heartbeat to your NestJS API. Heartbeat present → route commands to the desktop tunnel. Heartbeat drops → fall back to the cloud VM container. The transport is entirely off-the-shelf.

**Do NOT:** build your own relay server, implement WebRTC data channels (ICE/STUN/TURN signaling — massive complexity for no demo benefit), or attempt raw NAT hole-punching from scratch.

### Decision 5: DEPLOYMENT — Oracle ARM works but was just nerfed; have a fallback.
**Recommendation: Demo — a single Oracle Cloud Always Free ARM VM provisioned in Frankfurt or Singapore, running Docker + Redis + NestJS + the execution worker behind Caddy (auto-TLS). Fallback if you can't get ARM capacity — a cheap paid small VPS (Hetzner) or Oracle Pay-As-You-Go; NOT Railway/Render/Fly free tiers for the Docker-in-Docker execution part.**

**Critical, current fact:** On June 15, 2026, Oracle halved the Always Free Ampere A1 allowance from 4 OCPU/24GB to 2 OCPU/12GB for free-tier tenancies — with no public announcement (InfoQ, July 2026: "Oracle has reduced the Always Free Ampere A1 Compute allowance… from 4 OCPUs and 24 GB of RAM to 2 OCPUs and 12 GB of RAM. The change took effect on June 15, 2026… Oracle did not publish a blog post, send customer notifications, or make any public announcement"). Oracle's docs now state all tenancies get "1,500 OCPU hours and 9,000 GB hours per month… for Always Free tenancies, this is equivalent to 2 OCPUs and 12 GB of memory." Support agents have told users (as of June 22, 2026) that the cut applies to free-tier only and Pay-As-You-Go may still get 4/24, but Oracle has issued no public clarification — treat "PAYG stays at 4/24 free" as **unconfirmed**. **Your proposal's "4 ARM cores / 24GB RAM" premise is no longer guaranteed.** Plan for 2 OCPU/12GB, which is still fine for 1-2 accounts plus a small model, but tighter.

**Known Oracle gotchas:**
- **"Out of host capacity"** errors are rampant in US regions; Frankfurt (`eu-frankfurt-1`) and Singapore (`ap-singapore-1`) provision within minutes. Use a retry script (e.g. `hitrov/oci-arm-host-capacity`) or switch to PAYG for reliable capacity.
- **Idle reclaim:** instances with 95th-percentile CPU, network, AND memory all under 20% over a rolling 7-day period may be reclaimed (per Oracle's current docs — note the threshold is 20%, not the older 10% figure). A trivial keep-alive cron avoids this. PAYG instances are exempt.
- **Crypto-miner false positives:** one user reported a whole account banned because a pulled Docker image contained a miner. Only pull trusted images.

**Stack on the VM:** install Docker + gVisor (`runsc`, which ships ARM64/aarch64 binaries), run Redis and Postgres as containers (or Postgres managed — see blueprint), run the NestJS API and the execution worker as processes (PM2 or systemd), and put **Caddy** in front as the reverse proxy — lowest-friction automatic Let's Encrypt TLS and WebSocket pass-through. nginx/Traefik also work; Caddy is easiest for a student.

**Why NOT the PaaS free tiers for execution:** Railway removed its free tier on Aug 1, 2023 — CEO Jake Cooper's stated reason was abuse: "Crypto miners spun up free containers to hash coins. Torrent bots leeched bandwidth… Railway was spending more on fighting abuse than on building the product" (replaced by a one-time $5 trial credit + $5/mo Hobby minimum). Fly.io removed its free allowances; Render's free tier sleeps on inactivity. More importantly, none of these let you spawn sibling/nested privileged containers or use a custom `runsc` runtime — which is the entire point of your execution engine. They're viable only for the stateless CRUD API, not the sandboxed runtime.

### Decision 6: SECURITY & ISOLATION — Docker is not enough; say so and mitigate.
**Recommendation: Demo — Docker with hardening (no `--privileged`, `--network=none` where possible, seccomp/AppArmor defaults, cgroup CPU/memory/PID limits, non-root user, read-only rootfs, dropped capabilities), plus gVisor (`runsc`) as the runtime (ARM64-supported, drop-in Docker runtime — a strong, cheap upgrade and a great thing to demo). Production — Firecracker or Kata microVMs, exactly like the real cloud IDEs.**

The industry consensus is blunt: containers share the host kernel, so one kernel CVE is a full escape affecting all tenants. The canonical example, **CVE-2022-0492** (CVSS 7.0), is a cgroups v1 `release_agent` flaw disclosed February 2022 by Huawei researchers Yiqi Sun and Kevin Wang; per Palo Alto Unit 42, "if you can write to the release_agent file, you can force the kernel into invoking a binary of your choosing with elevated privileges and take control of the entire machine." It was added to CISA's Known Exploited Vulnerabilities catalog in June 2026, confirming active in-the-wild exploitation. Running untrusted user code in a plain Docker container is a non-starter.

The isolation hierarchy the real platforms use:
- **gVisor (Google):** a userspace application kernel intercepting syscalls; OCI-compatible drop-in for `runc`; used by **Modal**. Per gVisor's own docs it implements "240 of 294 syscalls" on arm64 (~82%) and "277 of 351 syscalls" on amd64 (~79%). Weakness: no Docker-in-Docker inside it, some syscall gaps, and syscall-heavy workloads run slower. Great middle ground and available on ARM64 — runnable on your Oracle VM.
- **Firecracker (AWS):** a microVM with its own guest kernel and hardware KVM isolation. Per the AWS Open Source Blog its minimal device model "enables faster startup times (< 125 ms on an i3.metal…) and < 5 MiB per microVM." E2B's engineering blog confirms "companies like E2B use Firecracker to run AI generated code securely in the cloud, while Fly.io uses it to run lightweight container-like VMs." Gold standard — but needs bare-metal/KVM (nested virt), so it cannot run on the Oracle free VM.
- **Kata Containers:** microVMs behind standard container APIs; integrates Firecracker/Cloud Hypervisor with Kubernetes.

## Details

### Tech-stack summary table

| Component | Chosen technology | Why |
|---|---|---|
| Mobile app | React Native + Expo | Locked (given) |
| Backend API | NestJS (modular monolith) | Locked; modular monolith is the correct architecture |
| Database | PostgreSQL + Prisma | Relational core (users→projects→jobs), JSONB for manifests, ACID, type-safe DX |
| Ephemeral/queue state | Redis + BullMQ | Job scheduling, session state, worker coordination |
| Execution engine | Separate Node/TS process: node-pty + Dockerode + `ws` | Different runtime profile; untrusted-code blast-radius isolation |
| Terminal streaming | node-pty → WebSocket → xterm.js | Standard, battle-tested pattern |
| File sync | CLI agent: chokidar + delta hashing over WebSocket | chokidar used by VS Code; fs.watch-based, low CPU |
| CLI agent language | Node/TypeScript (demo); Go optional for prod distribution | Single toolchain; native pty needs Node anyway |
| Local desktop runtime | Cloudflare Tunnel (demo) / Tailscale/Headscale (prod) | Outbound-only, NAT traversal, no port forwarding, native WS |
| On-device LLM | llama.rn (llama.cpp binding) + GGUF Q4_K_M model | Standard RN on-device stack; supports Phi/Gemma/Qwen |
| Container isolation | Hardened Docker + gVisor (`runsc`) demo; Firecracker/Kata prod | Docker alone is insecure for untrusted code |
| Reverse proxy / TLS | Caddy | Automatic Let's Encrypt, WebSocket passthrough, lowest friction |
| Demo host | Oracle Cloud Always Free ARM (Frankfurt/Singapore) | Free 2 OCPU/12GB ARM; fallback Hetzner/Oracle PAYG |
| Process manager | PM2 or systemd | Keep API + worker alive, restart on crash |

### On-device LLM note
The proposal names Phi-3 Mini / Gemma 2B via llama.cpp. The correct RN integration is **llama.rn** (the React Native binding to llama.cpp), loading a GGUF-format model quantized to **Q4_K_M** — the accepted mobile sweet spot (~70% memory reduction, ~1-2% perplexity increase). Realistic on-device speed: ~15-30 tok/s on flagship phones (Snapdragon 8 Gen 2+/A17 Pro), ~5-15 tok/s mid-range. Store weights in the app's document directory via `expo-file-system` with a background download + checksum (don't bundle >100MB in the binary), and run inference on a background thread. Alternatives worth a line: `react-native-ai` (MLC engine) and React Native ExecuTorch (Meta). Because inference is on-device, this is entirely independent of your backend scale story — a nice architectural point to make in the presentation.

### File sync mechanics
The CLI agent uses **chokidar** (fs.watch-based, avoids polling, used in production by VS Code/webpack/gulp) to watch the local tree. On change, compute per-file hashes, compare against a server-held manifest, and send only changed files/chunks over WebSocket — a delta-sync modeled on rsync's delta-transfer algorithm (compare mtime+size, then transfer only differing portions). Use chokidar's `awaitWriteFinish` to avoid firing on partial writes of large files, and an ignore list (`node_modules`, `.git`) to avoid watching junk. Note chokidar v5 (Nov 2025) is ESM-only and requires Node ≥ 20.

### Terminal streaming mechanics
Standard three-tier: xterm.js (or an RN terminal view) ↔ WebSocket ↔ node-pty spawning bash inside the Docker container. Manage sessions in a map keyed by socket/session ID; destroy the PTY on disconnect for per-session shells. For robustness under fast output, implement xterm.js flow control (pause/resume the pty on the write-callback backpressure signal) — the naive pipe hits xterm.js's hardcoded ~50MB input buffer cap and silently drops data on very chatty commands.

## PRODUCTION BLUEPRINT (for documentation/presentation, NOT the demo build)

This section is for your report's scale/security/cost narrative. Do NOT build this for the demo.

### Scale honesty
The proposal's "1,800 jobs/hour" and "thousands of users" were acknowledged fluff; don't defend those numbers. The honest production story is architectural:
- The modular monolith's modules become extractable services only where a real bottleneck or failure-domain boundary appears. The first genuine extraction is the execution engine (already a separate process in the demo) becoming a horizontally-scaled fleet of execution nodes.
- **Queue:** BullMQ scales by adding worker processes/machines consuming the same Redis queue; concurrency is tuned per worker (`concurrency` factor and/or multiple workers). Free tier = shared worker pool (one queue, bounded concurrency); paid tier = dedicated worker/container per user.
- **Database:** move from self-hosted Postgres to managed — **Neon** or **Supabase** (serverless Postgres, generous free/starter tiers, branching) or AWS RDS/Aurora for heavier needs. (Had you chosen Mongo you'd use Atlas; you didn't.)
- **Redis:** managed — Upstash (serverless, pay-per-use) or ElastiCache/Redis Cloud.

### Container orchestration at scale
- **Start:** a fleet of VMs, each running the execution worker + a sandboxed runtime, load-balanced, jobs pulled from Redis.
- **Scale:** Kubernetes with a gVisor RuntimeClass (GKE Sandbox offers this out-of-the-box), or Fly.io Machines (Firecracker-based), or AWS ECS/Fargate (Firecracker under the hood).
- **Per-user execution model:** free = ephemeral shared-pool container with tight cgroup limits and a short TTL; paid = dedicated, longer-lived, larger-quota microVM.

### Isolation at scale (the big one)
This is where you show you understand the real problem. Untrusted user code = adversarial. Real platforms:
- **E2B:** Firecracker microVM per sandbox (< 125ms boot), hardware KVM isolation.
- **Modal:** gVisor.
- **Fly.io:** Firecracker.
- **Replit/Gitpod/Codespaces/Coder:** containers, with the serious ones layering gVisor/Kata/microVMs for untrusted execution.

Recommended production posture: **Firecracker or Kata microVMs per execution session**, giving each user their own guest kernel. Layer defense-in-depth: seccomp/AppArmor, dropped capabilities, read-only rootfs, `no-new-privileges`, per-container cgroup CPU/memory/PID/disk quotas, egress network filtering (block outbound except package registries) to stop crypto-mining and data exfiltration, and short session TTLs.

Real incidents to cite: AI agents escaping tool denylists via `/proc/self/root`; the **Shai-Hulud** npm supply-chain worm — per a CISA alert (Sept 23, 2025) it "compromised over 500 packages," scanning for and exfiltrating GitHub PATs and AWS/GCP/Azure keys, with a Nov/Dec 2025 "Shai-Hulud 2.0" wave hitting Zapier, PostHog and Postman packages (JFrog counted ~796 malicious packages in the second wave vs 1,150+ in the first) — these hit `npm install`/`pip install`, prime vectors in a code-execution platform; and resource-abuse/crypto-mining as the #1 free-tier abuse vector (the same abuse that killed Railway's free tier).

### Cost math (order-of-magnitude, for the presentation)
- **Demo:** $0 (Oracle Always Free), or ~$4-6/mo if you switch to Oracle PAYG for reliable capacity, or ~€4/mo Hetzner.
- **Small production (hundreds of light users):** a couple of small execution VMs + managed Postgres (Neon/Supabase free → ~$20-25/mo) + managed Redis (Upstash pay-per-use) + a load balancer ≈ **$50-150/mo**.
- The dominant variable cost is **idle execution capacity**. This is why the industry moved to fast-booting microVMs with scale-to-zero (Fly.io "auto-sleep," E2B pause/resume) — you pay for compute only while a session is live. Firecracker's sub-125ms boot is precisely what makes ephemeral, scale-to-zero per-user sandboxes economically viable.

### Security implications summary for production
Running untrusted code is the single biggest production risk: container escape (kernel CVEs like CVE-2022-0492), resource abuse (crypto mining — the top free-tier abuse), data exfiltration, and supply-chain attacks via package installs (Shai-Hulud). The mitigation stack is non-negotiable at scale: microVM isolation (Firecracker/Kata) + seccomp/AppArmor + capability dropping + cgroup quotas + egress filtering + short TTLs + image provenance.

## Recommendations — Phased 14-week plan

- **Weeks 1-2 — Foundations.** NestJS modular monolith skeleton (modules: auth, users, projects, jobs, sessions, billing/tier). Postgres + Prisma schema and migrations. Redis + BullMQ wired. JWT auth. Provision the Oracle ARM VM *early* (Frankfurt/Singapore — expect capacity fights) with Docker + Caddy + TLS.
- **Weeks 3-4 — CLI sync agent.** Node/TS CLI with chokidar + delta hashing, WebSocket transport, server-side manifest + file store. Ignore lists, `awaitWriteFinish`.
- **Weeks 5-7 — Execution engine (separate process).** node-pty + Dockerode, spawn per-session containers, WebSocket PTY streaming to a terminal view, xterm.js flow control. BullMQ job model: free = shared queue, paid = dedicated container. Harden Docker (non-root, cgroup limits, dropped caps, seccomp).
- **Week 8 — gVisor.** Install `runsc` on the ARM VM, run user containers under `--runtime=runsc`. A demo-able security win.
- **Weeks 9-10 — Local-desktop-as-runtime.** Desktop agent runs the same PTY-WS server locally; `cloudflared` tunnel exposes it. Heartbeat/presence in the API; routing logic (desktop-if-present-else-cloud). This is the headline feature — give it real time.
- **Weeks 11-12 — Git ops + on-device LLM.** Git operations (`isomorphic-git`, or shell to `git` in-container). llama.rn + a Q4_K_M GGUF model; hook the error-explainer to non-zero exit codes streamed from the PTY.
- **Week 13 — Polish + freemium enforcement.** Tier gating, quotas, Bull Board dashboard (auth-protected), error handling, dead-letter handling for failed jobs.
- **Week 14 — Production blueprint doc + demo prep.** Write the scale/security/cost section above; record a fallback demo video in case live Oracle capacity or the tunnel flakes.

**Benchmarks / thresholds that change the plan:**
- Oracle ARM unobtainable after ~1 week of retries → switch to Hetzner or Oracle PAYG immediately; don't sink more timeline into capacity roulette.
- gVisor breaks a required dev tool (syscall gap) → fall back to hardened `runc` for that path and document the tradeoff.
- On-device LLM too slow/large on the target phone → drop to a smaller model (SmolLM2, Qwen2.5 0.5-1.5B) or make the explainer a backend call as a fallback.
- WebSocket instability through Cloudflare Tunnel → implement client heartbeat/ping-pong (Cloudflare closes idle WS and restarts terminate connections).

## Caveats
- The Oracle free-ARM halving (June 15, 2026) is recent and the free-tier-vs-PAYG distinction is officially unclarified; **verify current limits at provisioning time** and plan for 2 OCPU/12GB.
- gVisor on ARM64 is supported but has syscall-coverage gaps (240 of 294 arm64 syscalls implemented) — test your actual toolchain under it before committing.
- Cloudflare Tunnel WebSocket works, but Cloudflare restarts and idle-timeouts drop long-lived connections; you must implement reconnect + heartbeat. The CDN ToS grey area is a non-issue for terminal text but worth a footnote.
- Tailscale is not a clean drop-in inside a React Native/Expo app; for the demo, the Cloudflare Tunnel reverse-proxy pattern is far simpler than mesh VPN on the phone.
- Firecracker cannot run on the Oracle free VM (needs KVM/nested virt) — it's a production-only recommendation.
- Prisma's MongoDB support is weaker than its SQL support — reinforcing that Postgres + Prisma is the stronger, better-trodden path.