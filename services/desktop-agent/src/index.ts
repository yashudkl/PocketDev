import { WebSocketServer } from 'ws';
import type { PtyClientMessage } from '@pocketdev/shared';

const PORT = parseInt(process.env.DESKTOP_AGENT_PORT ?? '4000', 10);
const API_URL = process.env.POCKETDEV_API_URL ?? 'http://localhost:3000';
const TOKEN = process.env.POCKETDEV_TOKEN ?? '';
const TUNNEL_URL = process.env.POCKETDEV_TUNNEL_URL; // set by cloudflared in the demo
const HEARTBEAT_MS = 15_000;

// Same PTY-over-WebSocket server the cloud worker runs, but on the dev's machine.
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  console.log('[desktop-agent] client connected');
  ws.on('message', (raw) => {
    let msg: PtyClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as PtyClientMessage;
    } catch {
      return;
    }
    // TODO (Weeks 9–10): spawn node-pty for `start`, feed `input`, `resize`, `kill`,
    // and stream PtyServerMessage frames back over this socket.
    console.log(`[desktop-agent] message type=${msg.type}`);
  });
  ws.on('close', () => console.log('[desktop-agent] client disconnected'));
});

// Presence: tell the API this desktop is online so the API routes execution here
// (desktop-if-present-else-cloud). Uses global fetch (Node 18+), no extra deps.
async function heartbeat(): Promise<void> {
  if (!TOKEN) return; // not linked yet
  try {
    await fetch(`${API_URL}/desktop/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ tunnelUrl: TUNNEL_URL }),
    });
  } catch (err) {
    console.warn(`[desktop-agent] heartbeat failed: ${(err as Error).message}`);
  }
}

const timer = setInterval(heartbeat, HEARTBEAT_MS);
void heartbeat();

console.log(`[desktop-agent] PTY-over-WS server on ws://localhost:${PORT}`);
console.log(`[desktop-agent] heartbeating to ${API_URL} every ${HEARTBEAT_MS / 1000}s`);

async function shutdown(): Promise<void> {
  clearInterval(timer);
  wss.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
