import { createPtyGateway, jwtVerifier } from '@pocketdev/pty-core';
import { config, shellArgs } from './config';

// ── PTY gateway ──────────────────────────────────────────────────────────────
// The SAME PTY-over-WS server the cloud worker runs (via @pocketdev/pty-core),
// but the runner spawns a shell directly on THIS machine — that's the whole
// "run on your own desktop when it's on" feature (BUILD-PLAN Decision 4). The
// phone reaches it through the Cloudflare Tunnel and authenticates with the
// same API-minted PTY token (verified here with the shared JWT secret).
const gateway = createPtyGateway({
  port: config.port,
  verify: jwtVerifier(config.jwtSecret),
  logger: (msg) => console.log(`[desktop-agent] ${msg}`),

  resolveSpawn: (_claims, ctx) => ({
    command: config.shell,
    args: shellArgs(config.shell, ctx.command),
    cwd: config.projectRoot,
  }),

  onSessionExit: (_claims, ctx) => {
    // Best-effort: tell the API the desktop session ended so it's marked CLOSED.
    void closeSession(ctx.sessionId);
  },
});

async function closeSession(sessionId: string): Promise<void> {
  if (!config.token) return;
  try {
    await fetch(`${config.apiUrl}/sessions/${sessionId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}` },
    });
  } catch {
    /* offline — the server's TTL/heartbeat window will reconcile */
  }
}

// ── Presence heartbeat ───────────────────────────────────────────────────────
// Advertise "this desktop is online at <tunnelUrl>" so the API routes execution
// here instead of the cloud (desktop-if-present-else-cloud).
async function heartbeat(): Promise<void> {
  if (!config.token) return; // not linked yet
  try {
    await fetch(`${config.apiUrl}/desktop/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ tunnelUrl: config.tunnelUrl }),
    });
  } catch (err) {
    console.warn(`[desktop-agent] heartbeat failed: ${(err as Error).message}`);
  }
}

async function goOffline(): Promise<void> {
  if (!config.token) return;
  try {
    await fetch(`${config.apiUrl}/desktop/offline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}` },
    });
  } catch {
    /* ignore */
  }
}

const timer = setInterval(() => void heartbeat(), config.heartbeatMs);
void heartbeat();

console.log(`[desktop-agent] PTY-over-WS server on ws://0.0.0.0:${config.port}`);
console.log(`[desktop-agent] shell=${config.shell} cwd=${config.projectRoot}`);
console.log(
  `[desktop-agent] heartbeating to ${config.apiUrl} every ${config.heartbeatMs / 1000}s` +
    (config.tunnelUrl ? ` as ${config.tunnelUrl}` : ' (no tunnel URL set)'),
);
if (!config.token) {
  console.warn('[desktop-agent] POCKETDEV_TOKEN not set — presence disabled until linked');
}

async function shutdown(): Promise<void> {
  console.log('[desktop-agent] shutting down …');
  clearInterval(timer);
  await goOffline();
  await gateway.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
