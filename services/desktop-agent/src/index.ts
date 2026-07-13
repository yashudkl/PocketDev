import { createPtyGateway, jwtVerifier } from '@pocketdev/pty-core';
import jwt from 'jsonwebtoken';
import { config, shellArgs } from './config';

// The desktop's own linked owner (from its access token). A PTY session runs an
// UNSANDBOXED shell on this host, so we must bind it to this owner: only a PTY
// token minted for THIS user is allowed to spawn here. Without this, any user's
// own valid token (all share JWT_SECRET) could open a shell on someone else's
// machine. An unlinked desktop (no token) authorizes no one.
function resolveOwnerId(): string | null {
  if (!config.token) return null;
  try {
    const decoded = jwt.verify(config.token, config.jwtSecret) as { sub?: string };
    return typeof decoded.sub === 'string' ? decoded.sub : null;
  } catch {
    return null;
  }
}
const OWNER_ID = resolveOwnerId();

// ── PTY gateway ──────────────────────────────────────────────────────────────
// The SAME PTY-over-WS server the cloud worker runs (via @pocketdev/pty-core),
// but the runner spawns a shell directly on THIS machine — that's the whole
// "run on your own desktop when it's on" feature (BUILD-PLAN Decision 4). The
// phone reaches it through the Cloudflare Tunnel and authenticates with the
// same API-minted PTY token (verified here with the shared JWT secret).
const gateway = createPtyGateway({
  port: config.port,
  host: config.bindHost,
  verify: jwtVerifier(config.jwtSecret),
  logger: (msg) => console.log(`[desktop-agent] ${msg}`),

  resolveSpawn: (claims, ctx) => {
    if (!OWNER_ID || claims.sub !== OWNER_ID) {
      throw new Error('unauthorized: PTY token owner is not this desktop’s linked user');
    }
    return {
      command: config.shell,
      args: shellArgs(config.shell, ctx.command),
      cwd: config.projectRoot,
    };
  },

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

console.log(`[desktop-agent] PTY-over-WS server on ws://${config.bindHost}:${config.port}`);
console.log(`[desktop-agent] shell=${config.shell} cwd=${config.projectRoot}`);
if (!OWNER_ID) {
  console.warn('[desktop-agent] no valid POCKETDEV_TOKEN — PTY sessions are refused until linked');
}
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
