# @pocketdev/desktop-agent

The headline feature (Project Brief §4, Build Plan Decision 4): run execution on the
developer's **own desktop** when it's online, and fall back to the cloud VM when it's off.

- Runs the same PTY-over-WebSocket server locally as the cloud worker.
- Exposes an authenticated folder browser on the same tunnel so the mobile app
  can list drives, choose project folders, and link them at runtime.
- Serves linked project files and runs Git operations against the selected
  desktop folder, so the mobile Files and Git views stay live.
- Exposed to the phone via an outbound-only **Cloudflare Tunnel** (`cloudflared`) in the
  demo — no port forwarding, no inbound ports (Tailscale is the production path).
- **Heartbeats** presence to the API (`POST /desktop/heartbeat` with the tunnel URL).
  The API routes a job to `DESKTOP` while the heartbeat is fresh, else `CLOUD`.

> `node-pty` (native addon) and `cloudflared` (binary) are **not installed** — add them
> during Weeks 9–10. This scaffold runs the WS server + presence heartbeat.

## Run

Start one agent for the desktop. Project folders selected from the mobile app are
stored in `~/.pocketdev/desktop-links.json` and restored when the agent restarts:

```bash
POCKETDEV_TOKEN=<jwt> \
POCKETDEV_TUNNEL_URL=<cloudflared-url> \
pnpm --filter @pocketdev/desktop-agent dev
```

`POCKETDEV_PROJECT` and `DESKTOP_PROJECT_ROOT` remain available as an optional
initial/legacy link. `DESKTOP_STATE_FILE` can override the persisted-link file.

For a same-Wi-Fi development build, a tunnel is optional. Bind to the LAN and
advertise the computer's LAN address:

```bash
DESKTOP_BIND=0.0.0.0 \
POCKETDEV_TUNNEL_URL=ws://192.168.1.20:4000 \
pnpm --filter @pocketdev/desktop-agent dev
```

The heartbeat records every linked folder. The API routes linked projects to
this agent while it is online; unlinked projects continue to use the cloud
worker. Desktop-linked file edits and Git commands are applied directly to the
selected local folder. Desktop terminal sockets are relayed through the API, so
`ws://localhost:4000` remains valid when the API runs on the same computer.
