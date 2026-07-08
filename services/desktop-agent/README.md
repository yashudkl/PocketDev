# @pocketdev/desktop-agent

The headline feature (Project Brief §4, Build Plan Decision 4): run execution on the
developer's **own desktop** when it's online, and fall back to the cloud VM when it's off.

- Runs the same PTY-over-WebSocket server locally as the cloud worker.
- Exposed to the phone via an outbound-only **Cloudflare Tunnel** (`cloudflared`) in the
  demo — no port forwarding, no inbound ports (Tailscale is the production path).
- **Heartbeats** presence to the API (`POST /desktop/heartbeat` with the tunnel URL).
  The API routes a job to `DESKTOP` while the heartbeat is fresh, else `CLOUD`.

> `node-pty` (native addon) and `cloudflared` (binary) are **not installed** — add them
> during Weeks 9–10. This scaffold runs the WS server + presence heartbeat.

## Run

```bash
POCKETDEV_TOKEN=<jwt> POCKETDEV_TUNNEL_URL=<cloudflared-url> \
  pnpm --filter @pocketdev/desktop-agent dev
```
