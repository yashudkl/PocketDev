import type { IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { PtyClientMessage, PtyServerMessage, PtyTokenClaims } from '@pocketdev/shared';
import { spawnPty } from './spawn';
import type { PtyGateway, PtyGatewayOptions, PtyHandle, StartContext } from './types';

// Backpressure thresholds on the socket's send buffer (BUILD-PLAN: xterm.js flow
// control — pause the PTY when the client can't keep up, resume when it drains).
const HIGH_WATER = 1024 * 1024; // 1 MiB buffered → pause the PTY
const LOW_WATER = 256 * 1024; // drained below this → resume
const DRAIN_INTERVAL_MS = 50;

interface Conn {
  ws: WebSocket;
  queryToken: string | null;
  claims?: PtyTokenClaims;
  ctx?: StartContext;
  handle?: PtyHandle;
  started: boolean;
  exited: boolean;
  paused: boolean;
  drainTimer?: NodeJS.Timeout;
}

/**
 * Create a standalone PTY-over-WebSocket server speaking the shared pty-protocol
 * (`start`/`input`/`resize`/`kill` ⇄ `ready`/`data`/`exit`/`error`). The caller
 * supplies `verify` (token → claims) and `resolveSpawn` (claims → what to run),
 * which is the only thing that differs between the cloud worker and the desktop.
 */
export function createPtyGateway(opts: PtyGatewayOptions): PtyGateway {
  const log = opts.logger ?? (() => undefined);
  const wss = new WebSocketServer({
    port: opts.port,
    host: opts.host,
    path: opts.path,
  });

  wss.on('connection', (ws, req) => handleConnection(ws, req, opts, log));
  wss.on('listening', () =>
    log(`pty gateway listening on ws://${opts.host ?? '0.0.0.0'}:${opts.port}${opts.path ?? ''}`),
  );
  wss.on('error', (err) => log(`pty gateway error: ${err.message}`));

  return {
    port: opts.port,
    close: () =>
      new Promise<void>((resolve) => {
        wss.close(() => resolve());
      }),
  };
}

function tokenFromUrl(req: IncomingMessage): string | null {
  try {
    return new URL(req.url ?? '/', 'http://localhost').searchParams.get('token');
  } catch {
    return null;
  }
}

function send(ws: WebSocket, msg: PtyServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleConnection(
  ws: WebSocket,
  req: IncomingMessage,
  opts: PtyGatewayOptions,
  log: (m: string) => void,
): void {
  const conn: Conn = {
    ws,
    queryToken: tokenFromUrl(req),
    started: false,
    exited: false,
    paused: false,
  };

  ws.on('message', (raw) => {
    let msg: PtyClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as PtyClientMessage;
    } catch {
      return;
    }
    void onMessage(conn, msg, opts, log);
  });

  // A socket disappearing before the process exits cancels the command. A real
  // process exit calls finish() first with its own code, so this becomes a no-op.
  ws.on('close', () => finish(conn, opts, 130));
  ws.on('error', (err) => log(`pty socket error: ${err.message}`));
}

async function onMessage(
  conn: Conn,
  msg: PtyClientMessage,
  opts: PtyGatewayOptions,
  log: (m: string) => void,
): Promise<void> {
  switch (msg.type) {
    case 'start':
      await onStart(conn, msg, opts, log);
      break;
    case 'input':
      conn.handle?.write(msg.data);
      break;
    case 'resize':
      conn.handle?.resize(msg.cols, msg.rows);
      break;
    case 'kill':
      conn.handle?.kill();
      break;
  }
}

async function onStart(
  conn: Conn,
  msg: Extract<PtyClientMessage, { type: 'start' }>,
  opts: PtyGatewayOptions,
  log: (m: string) => void,
): Promise<void> {
  if (conn.started) return; // one PTY per socket

  const token = msg.token ?? conn.queryToken ?? '';
  const claims = opts.verify(token);
  if (!claims) {
    send(conn.ws, { type: 'error', sessionId: msg.sessionId, message: 'Unauthorized' });
    conn.ws.close(4401, 'Unauthorized');
    return;
  }
  if (claims.sessionId !== msg.sessionId) {
    send(conn.ws, { type: 'error', sessionId: msg.sessionId, message: 'Session mismatch' });
    conn.ws.close(4403, 'Session mismatch');
    return;
  }

  const ctx: StartContext = {
    sessionId: msg.sessionId,
    projectId: msg.projectId,
    command: msg.command,
    cols: msg.cols,
    rows: msg.rows,
  };
  conn.claims = claims;
  conn.ctx = ctx;
  conn.started = true;

  let handle: PtyHandle;
  try {
    const spec = await opts.resolveSpawn(claims, ctx);
    handle = spawnPty({ cols: ctx.cols, rows: ctx.rows, ...spec });
  } catch (err) {
    send(conn.ws, {
      type: 'error',
      sessionId: ctx.sessionId,
      message: (err as Error).message,
    });
    // Go through finish() so onSessionExit fires — otherwise the worker's job
    // (already past attached(), connect-timer cleared) blocks until max-duration,
    // leaking the container + concurrency slot.
    finish(conn, opts, 1);
    conn.ws.close(1011, 'spawn failed');
    return;
  }

  conn.handle = handle;
  handle.onData((data) => {
    send(conn.ws, { type: 'data', sessionId: ctx.sessionId, data });
    applyBackpressure(conn);
  });
  handle.onExit(({ exitCode }) => {
    send(conn.ws, { type: 'exit', sessionId: ctx.sessionId, exitCode });
    finish(conn, opts, exitCode);
    conn.ws.close(1000, 'session ended');
  });

  send(conn.ws, { type: 'ready', sessionId: ctx.sessionId });
  opts.onSessionStart?.(claims, ctx);
  log(`session ${ctx.sessionId} started`);
}

/** Pause the PTY when the socket's outbound buffer is backing up; resume on drain. */
function applyBackpressure(conn: Conn): void {
  if (conn.paused || !conn.handle?.pause) return;
  if (conn.ws.bufferedAmount <= HIGH_WATER) return;
  conn.paused = true;
  conn.handle.pause();
  conn.drainTimer = setInterval(() => {
    if (conn.ws.bufferedAmount < LOW_WATER || conn.ws.readyState !== conn.ws.OPEN) {
      conn.paused = false;
      conn.handle?.resume?.();
      if (conn.drainTimer) clearInterval(conn.drainTimer);
      conn.drainTimer = undefined;
    }
  }, DRAIN_INTERVAL_MS);
}

/** Tear a session down exactly once (from exit, kill, or client disconnect). */
function finish(conn: Conn, opts: PtyGatewayOptions, exitCode: number): void {
  if (conn.drainTimer) {
    clearInterval(conn.drainTimer);
    conn.drainTimer = undefined;
  }
  if (conn.exited) return;
  conn.exited = true;
  conn.handle?.kill();
  if (conn.started && conn.claims && conn.ctx) {
    opts.onSessionExit?.(conn.claims, conn.ctx, exitCode);
  }
}
