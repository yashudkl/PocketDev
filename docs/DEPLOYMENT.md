# PocketDev — Integration, Verification & Deployment Guide

A hand-holding, do-this-then-that guide to run the backend for real. It goes in the
order you should actually do it:

1. **[Part A — Local](#part-a--run--verify-locally-start-here)** — prove it works on your own Windows machine (Docker Desktop).
2. **[Part B — Cloudflare Tunnel](#part-b--desktop-runtime-via-cloudflare-tunnel)** — expose your desktop so execution routes to *your* machine.
3. **[Part C — Oracle Cloud](#part-c--deploy-to-oracle-cloud-arm)** — put it on a free ARM VM with gVisor + HTTPS.

> Commands/links verified July 2026. Version-sensitive facts are flagged **[FLAG]** with a source.

## What runs where (ports)

| Process | Port | Command |
|---|---|---|
| NestJS API (+ `/admin/queues`, `/sync` WS) | `3000` | `pnpm server:dev` |
| Execution worker + cloud PTY WebSocket | `4100` | `pnpm worker:dev` |
| Desktop agent (host PTY WebSocket) | `4000` | `pnpm --filter @pocketdev/desktop-agent start` |
| Postgres | `5432` | `docker compose up -d` |
| Redis | `6379` | `docker compose up -d` |

The API hands the phone/test-client a `wsUrl` — `ws://…:4100` for **cloud** execution, or your
desktop tunnel URL for **desktop** execution — plus a short-lived `wsToken`. Everything shares
one `JWT_SECRET`.

---

# Part A — Run & verify locally (start here)

Goal: on your own PC, sync a folder, open a real terminal from a script, run a command, see live
output, push a commit, and watch the free-vs-paid queue — all with the PC's own Docker.

### A1. Install Docker Desktop (Windows 11)

Docker Desktop is what actually spawns the sandbox containers. **[FLAG** — requires Win 11 64-bit
23H2 (build 22631)+ and WSL 2.1.5+; source: [docs.docker.com/desktop/setup/install/windows-install](https://docs.docker.com/desktop/setup/install/windows-install/), page rev 2026-02-21**]**

```powershell
# 1. WSL2 first (PowerShell as Administrator)
wsl --install
wsl --update
wsl --version          # confirm 2.1.5 or later

# 2. Docker Desktop
winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
```

Launch Docker Desktop → **Settings → General → “Use WSL 2 based engine”** → Apply. Verify:

```powershell
docker run hello-world     # should print "Hello from Docker!"
```

> **[FLAG]** Local Windows execution works, but `node-pty` → `docker exec` is smoothest on Linux.
> If the worker misbehaves on Windows, run the whole stack inside WSL2 Ubuntu (open a WSL shell,
> clone the repo under `~/`, and follow the Linux commands from [Part C6](#c6-install-docker-engine--compose-plugin) onward). Everything else in Part A is identical.

### A2. Bring up the project

```bash
git clone https://github.com/yashudkl/PocketDev.git
cd PocketDev
pnpm install

docker compose up -d                       # Postgres + Redis
cp .env.example server/.env                # then edit JWT_SECRET to a long random string

pnpm --filter @pocketdev/server db:migrate # create the schema
pnpm --filter @pocketdev/server db:seed    # free@ / paid@pocketdev.dev · password123
```

### A3. Start the API and the worker (two terminals)

```bash
# terminal 1
pnpm server:dev        # → http://localhost:3000  (+ dashboard at /admin/queues)

# terminal 2  — needs Docker running
pnpm worker:dev        # → PTY gateway on ws://localhost:4100
```

The worker pulls `node:22-bookworm-slim` on first run (one-time). Quick health check:

```bash
curl -s localhost:3000/health          # {"status":"ok",...}
```

### A4. Sync a folder up (CLI agent)

```bash
# Get a token + your project id
TOKEN=$(curl -s localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"free@pocketdev.dev","password":"password123"}' | jq -r .accessToken)
PROJECT=$(curl -s localhost:3000/projects -H "authorization: Bearer $TOKEN" | jq -r '.[0].id')

# Sync any folder — only changed files transfer (delta sync)
POCKETDEV_TOKEN=$TOKEN pnpm --filter @pocketdev/cli-agent start sync ./some-folder -p $PROJECT
```

Confirm the files landed:

```bash
curl -s "localhost:3000/projects/$PROJECT/files" -H "authorization: Bearer $TOKEN" | jq
```

### A5. Open a REAL terminal (the headline feature)

Use the bundled test client — it does login → start session → connect the PTY WebSocket → stream:

```bash
# Run a command and watch live output, then it exits:
node scripts/pty-client.mjs --email free@pocketdev.dev --password password123 --command "ls -la && node -v"

# Or an interactive shell (type commands, Ctrl+C to quit):
node scripts/pty-client.mjs --email free@pocketdev.dev --password password123
```

You are now typing into a real bash PTY inside a hardened container, streamed over WebSocket.
Your synced files are at `/workspace`.

### A6. Git from the “phone” (API)

```bash
curl -s -X POST "localhost:3000/projects/$PROJECT/git/init"   -H "authorization: Bearer $TOKEN"
curl -s -X POST "localhost:3000/projects/$PROJECT/git/commit" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"message":"first commit from PocketDev"}'
curl -s "localhost:3000/projects/$PROJECT/git/log" -H "authorization: Bearer $TOKEN" | jq
# To push: set a remote first, then push (needs your git credentials on the host)
curl -s -X POST "localhost:3000/projects/$PROJECT/git/remote" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"url":"https://github.com/you/repo.git"}'
curl -s -X POST "localhost:3000/projects/$PROJECT/git/push" -H "authorization: Bearer $TOKEN"
```

### A7. Prove the freemium queue (free waits, paid jumps)

Make the shared pool exactly one slot, then watch:

```bash
# restart the worker with a single slot
WORKER_CONCURRENCY=1 pnpm worker:dev
```

1. **Terminal 1** — free user opens an *interactive* session (holds the one slot):
   `node scripts/pty-client.mjs --email free@pocketdev.dev --password password123`
2. **Terminal 2** — a second free session: `… --email free@pocketdev.dev …` → its job sits **QUEUED**.
3. **Terminal 3** — a paid session: `… --email paid@pocketdev.dev …` → it’s ahead of the waiting free one (higher priority).
4. Quit Terminal 1 (Ctrl+C) → the **paid** session runs next, before the free one.

Watch it live at **http://localhost:3000/admin/queues** (basic-auth `admin`/`admin`, change via
`BULLBOARD_USER`/`BULLBOARD_PASSWORD`): waiting vs active jobs, and the priority ordering.

### A8. Turn on gVisor locally (optional, Linux/WSL2 only)

See [Part C7](#c7-optional-gvisor-runsc-hardening); then restart the worker with `EXECUTION_RUNTIME=runsc`.

---

# Part B — Desktop runtime via Cloudflare Tunnel

Goal: run the **desktop agent** on your machine and expose it, so when you’re online the API routes
your sessions to *your* PC instead of the cloud (BUILD-PLAN Decision 4). No port-forwarding — the
tunnel makes only outbound connections and works behind NAT/CGNAT.

### B1. Install cloudflared

```powershell
# Windows 11
winget install --id Cloudflare.cloudflared
cloudflared --version
```
```bash
# Linux (official apt repo). [FLAG] Cloudflare rotated its signing key 2025-10-30; old keys are
# removed 2026-04-30 — this cloudflare-main.gpg URL is the current one. Source: pkg.cloudflare.com
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
```

### B2. Run the desktop agent

```bash
# Windows PowerShell — reuse the same JWT_SECRET as the server
$env:JWT_SECRET="<same-as-server>"
$env:POCKETDEV_TOKEN="<a JWT for the user who owns the desktop>"   # from /auth/login
$env:POCKETDEV_API_URL="https://<your-api-host>"                   # or http://localhost:3000 for a same-machine test
$env:DESKTOP_PROJECT_ROOT="C:\path\to\your\project"                # where sessions open
pnpm --filter @pocketdev/desktop-agent start                       # PTY server on ws://localhost:4000
```

### B3. Expose port 4000 with a tunnel

**Fastest — quick tunnel** (ephemeral random URL, great for a demo):

```bash
cloudflared tunnel --url http://localhost:4000
```
It prints a boxed `https://<random>.trycloudflare.com`. Your desktop’s public WS URL is the
`wss://` form of it. **[FLAG]** Quick tunnels are testing-only: the URL changes on every restart,
cap ~200 in-flight requests. Source: [trycloudflare doc](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).

**Stable — named tunnel** (your domain, survives restarts, runs as a service):

```bash
cloudflared tunnel login
cloudflared tunnel create pocketdev-desktop        # note the printed UUID
cloudflared tunnel route dns pocketdev-desktop desktop.yourdomain.com
```
`~/.cloudflared/config.yml`:
```yaml
tunnel: <UUID>
credentials-file: /home/YOU/.cloudflared/<UUID>.json
ingress:
  - hostname: desktop.yourdomain.com
    service: http://localhost:4000
  - service: http_status:404          # required catch-all
```
```bash
cloudflared tunnel run pocketdev-desktop           # or install as a service (see source)
```

### B4. Tell the API where your desktop is

Set the tunnel URL for the desktop agent so its heartbeat advertises it, then restart the agent:

```powershell
$env:POCKETDEV_TUNNEL_URL="wss://desktop.yourdomain.com"   # or the trycloudflare wss URL
pnpm --filter @pocketdev/desktop-agent start
```

Now `GET /desktop/status` returns `online: true` and `target: DESKTOP`, and the next
`node scripts/pty-client.mjs …` prints `routed to DESKTOP` — commands run on **your** machine.
Stop the agent and it falls back to `CLOUD` within the 30 s heartbeat window.

> **[FLAG] Heartbeats are mandatory for WebSockets through Cloudflare** — it closes idle
> connections (widely observed ~100 s of no data). Source:
> [Cloudflare WebSockets](https://developers.cloudflare.com/network/websockets/). PocketDev already
> keeps the PTY stream busy during use; for long idle terminals add a ~30–60 s ping later.

---

# Part C — Deploy to Oracle Cloud ARM

Goal: the demo host — a free ARM VM running Postgres, Redis, the API, the worker (with gVisor),
behind Caddy with automatic HTTPS.

> **[FLAG] The free allowance was cut.** Since **June 15, 2026**, Always Free Ampere A1 is
> **2 OCPU / 12 GB** (was 4/24). Plan for 2/12 — still fine for 1–2 accounts. Confirmed on Oracle’s
> own [Always Free Resources doc](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
> and [InfoQ, July 2026](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/).

### C1. Create the account

Go to **https://signup.oraclecloud.com/**. You need email + phone (SMS) + a real credit or
credit-style debit card (Oracle places a ~$1 auth hold, reversed in days; **not** charged unless you
upgrade). Prepaid/virtual/PIN-only cards are rejected. **Pick your Home Region carefully — it’s
permanent**; choose one that provisions A1 reliably (see C3).

Generate an SSH key first:
```bash
ssh-keygen -t ed25519 -C "oci-pocketdev" -f ~/.ssh/oci_key   # public half: ~/.ssh/oci_key.pub
```

### C2. Provision the ARM VM

Console: **☰ → Compute → Instances → Create instance**
- **Image and shape → Change image:** Canonical **Ubuntu 24.04**.
- **Change shape → Ampere → VM.Standard.A1.Flex**, set **OCPUs = 2, Memory = 12 GB**.
- **Add SSH keys → Paste public keys:** paste `~/.ssh/oci_key.pub`.
- Networking: **Create new VCN**, **Assign public IPv4 = Yes**. Boot volume 47 GB+ is fine.
- **Create**.

### C3. If you hit “Out of host capacity”

Common and not your fault — the AD has no free A1 hardware right now.
- **Retry**, varying the **Availability Domain** (AD-1 → AD-2 → AD-3); leave Fault Domain unspecified.
- Off-peak (early morning, region-local) frees up capacity. Or automate with
  [github.com/hitrov/oci-arm-host-capacity](https://github.com/hitrov/oci-arm-host-capacity).
- **Region matters:** Frankfurt (`eu-frankfurt-1`) and Singapore (`ap-singapore-1`) provision fast in
  2026; busy US regions can take days.
- **Upgrading to Pay-As-You-Go** gives higher capacity priority and you still pay **$0** within free
  limits. Source: [Oracle — Resolving Out of Host Capacity](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/troubleshooting-out-of-host-capacity.htm).

### C4. Open the ports (TWO firewalls — both required)

**(a) Cloud — VCN Security List:** ☰ → Networking → Virtual Cloud Networks → your VCN → Subnet →
Security List → **Add Ingress Rules**: Source `0.0.0.0/0`, TCP, Destination ports `80,443`.

**(b) OS — the iptables trap.** Oracle’s Ubuntu image has a blanket `REJECT` at the end of the INPUT
chain; appended rules are ignored — you must **insert above** it. Source:
[Oracle Developers blog](https://blogs.oracle.com/developers/enabling-network-traffic-to-ubuntu-images-in-oracle-cloud-infrastructure).

```bash
sudo iptables -L INPUT --line-numbers                # find the REJECT line number (often 6)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### C5. SSH in

```bash
ssh -i ~/.ssh/oci_key ubuntu@<PUBLIC_IP>
```

### C6. Install Docker Engine + Compose plugin

Official apt steps; `arm64` is auto-detected. Source:
[docs.docker.com/engine/install/ubuntu](https://docs.docker.com/engine/install/ubuntu/).

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker
docker run --rm hello-world
```

### C7. (Optional) gVisor (`runsc`) hardening

Makes untrusted code run under a userspace kernel — a great thing to demo. ARM64 supported (kernel
4.14.77+). Source: [gvisor.dev/docs/user_guide/install](https://gvisor.dev/docs/user_guide/install/).

```bash
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" | sudo tee /etc/apt/sources.list.d/gvisor.list >/dev/null
sudo apt-get update && sudo apt-get install -y runsc
sudo runsc install                 # registers the runtime in /etc/docker/daemon.json
sudo systemctl restart docker
docker run --rm --runtime=runsc hello-world
```
Then run the worker with `EXECUTION_RUNTIME=runsc` — that one env var routes user containers through
gVisor. **[FLAG]** ARM64 implements 250/294 syscalls; test your toolchain under it, keep `runc` as a
fallback. Source: [gvisor arm64 compatibility](https://gvisor.dev/docs/user_guide/compatibility/linux/arm64/).

### C8. Deploy the app

```bash
# Node 22 + pnpm (via corepack)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
sudo corepack enable

git clone https://github.com/yashudkl/PocketDev.git && cd PocketDev
pnpm install
docker compose up -d                        # Postgres + Redis
cp .env.example server/.env                 # set a strong JWT_SECRET; keep FILE_STORE_ROOT shared
pnpm build
pnpm --filter @pocketdev/server db:deploy   # apply migrations (prod)
pnpm --filter @pocketdev/server db:seed
```

Keep the API + worker alive with **systemd** (survives reboot). Example unit for the API:

```ini
# /etc/systemd/system/pocketdev-api.service
[Unit]
Description=PocketDev API
After=network.target docker.service
[Service]
WorkingDirectory=/home/ubuntu/PocketDev/server
ExecStart=/usr/bin/node dist/main.js
EnvironmentFile=/home/ubuntu/PocketDev/server/.env
Restart=always
RestartSec=3
User=ubuntu
[Install]
WantedBy=multi-user.target
```
```ini
# /etc/systemd/system/pocketdev-worker.service
[Unit]
Description=PocketDev execution worker
After=network.target docker.service
[Service]
WorkingDirectory=/home/ubuntu/PocketDev/services/execution-worker
ExecStart=/usr/bin/node dist/index.js
EnvironmentFile=/home/ubuntu/PocketDev/server/.env
Environment=EXECUTION_RUNTIME=runsc
Environment=WORKER_CONCURRENCY=2
Restart=always
User=ubuntu
[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pocketdev-api pocketdev-worker
journalctl -u pocketdev-api -f     # live logs
```

### C9. HTTPS with Caddy

Point a DNS **A record** at the VM’s public IP, then:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```
`/etc/caddy/Caddyfile` (WebSocket passthrough is automatic in `reverse_proxy`):
```caddyfile
api.yourdomain.com {
    reverse_proxy /admin/* localhost:3000
    reverse_proxy localhost:3000        # API + /sync WebSocket
}
pty.yourdomain.com {
    reverse_proxy localhost:4100        # cloud PTY WebSocket
}
```
```bash
caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
Set `WORKER_WS_URL=wss://pty.yourdomain.com` in `server/.env` so the API hands clients the public
PTY URL. Caddy fetches + renews Let’s Encrypt certs automatically. Source:
[caddyserver.com/docs/install](https://caddyserver.com/docs/install).

### C10. Keep the free VM from being reclaimed

Oracle reclaims Always-Free instances idle (CPU **and** network **and** memory all <20% over 7 days).
A used app stays above that; for a quiet box add a nudge or convert to PAYG (exempt from reclaim):
```bash
( crontab -l 2>/dev/null; echo "*/15 * * * * timeout 30 sh -c 'while :; do :; done' >/dev/null 2>&1" ) | crontab -
```
Source: [Always Free Resources doc](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

---

## Environment variable reference

| Var | Used by | Default | Notes |
|---|---|---|---|
| `JWT_SECRET` | server, worker, desktop-agent | `change-me…` | **Must match** across all three |
| `DATABASE_URL` | server | postgres@localhost | from `docker compose` |
| `REDIS_HOST`/`REDIS_PORT` | server, worker | localhost/6379 | |
| `FILE_STORE_ROOT` | server, worker | `./.pocketdev-store` | **share the path** on one host (worker bind-mounts it) |
| `WORKER_WS_URL` | server | `ws://localhost:4100` | public cloud PTY URL handed to clients |
| `WORKER_PTY_PORT` | worker | `4100` | |
| `WORKER_CONCURRENCY` | worker | `2` | = FREE shared-pool size; set `1` for the queue demo |
| `EXECUTION_RUNTIME` | worker | `runc` | `runsc` = gVisor |
| `EXECUTION_IMAGE` | worker | `node:22-bookworm-slim` | sandbox base image |
| `EXECUTION_NETWORK` | worker | `1` | `0` = `--network none` |
| `DESKTOP_AGENT_PORT` | desktop-agent | `4000` | |
| `POCKETDEV_TUNNEL_URL` | desktop-agent | — | your `wss://…` tunnel; enables DESKTOP routing |
| `DESKTOP_PROJECT_ROOT` | desktop-agent | cwd | where desktop sessions open |
| `BULLBOARD_USER`/`_PASSWORD` | server | admin/admin | dashboard basic-auth |

## Troubleshooting

- **`pnpm server:dev` → `Cannot find module …/server/dist/main`** — a stale
  TypeScript build-info made the compiler skip emitting. Fixed in-repo (removed
  `incremental`), but if it ever recurs: `rm -rf server/dist server/*.tsbuildinfo`
  then rebuild.
- **Worker spams `[events] redis …` / can't reach Redis even though the container is "Up"** —
  a stale `pocketdev-redis` container can run without publishing port 6379
  (`docker port pocketdev-redis` shows nothing). Recreate it:
  `docker compose up -d --force-recreate redis`. Verify: `docker port pocketdev-redis`
  should show `6379/tcp -> 0.0.0.0:6379`.
- **Container `/workspace` is empty when a command runs** — the server and worker
  resolve `FILE_STORE_ROOT` relative to *their own* working directory, so the
  defaults diverge. Set it to the **same absolute path** in both processes' env
  (e.g. `FILE_STORE_ROOT=C:\dev\pocketdev\.store` locally, or `/home/ubuntu/store` on the VM).
- **Worker logs "Docker not reachable"** — Docker daemon isn’t up, or your user isn’t in the `docker` group (`newgrp docker`).
- **Session never streams** — the client must attach within `SESSION_CONNECT_TIMEOUT_S` (60 s); check the worker terminal for `session … started`.
- **Port open in OCI but still unreachable** — the OS iptables REJECT rule (Part C4b). `sudo iptables -L INPUT --line-numbers`.
- **`git push` fails** — the host needs credentials for the remote (HTTPS token or SSH key); PocketDev runs git, it doesn’t store your GitHub creds.
- **Windows bind-mount issues in the worker** — run the stack under WSL2 Ubuntu instead ([A1 note](#a1-install-docker-desktop-windows-11)).

## Sources

Oracle: [Always Free limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) ·
[Out of host capacity](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/troubleshooting-out-of-host-capacity.htm) ·
[iptables/ports](https://blogs.oracle.com/developers/enabling-network-traffic-to-ubuntu-images-in-oracle-cloud-infrastructure) ·
[InfoQ free-tier cut](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/).
Cloudflare: [Downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/) ·
[apt repo](https://pkg.cloudflare.com/) ·
[Quick tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/) ·
[WebSockets](https://developers.cloudflare.com/network/websockets/).
Docker: [Desktop/Windows](https://docs.docker.com/desktop/setup/install/windows-install/) ·
[Engine/Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
gVisor: [Install](https://gvisor.dev/docs/user_guide/install/) ·
[arm64](https://gvisor.dev/docs/user_guide/compatibility/linux/arm64/). Caddy: [Install](https://caddyserver.com/docs/install).
