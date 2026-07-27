import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PtyTokenClaims } from '@pocketdev/shared';

/** A live pseudo-terminal, abstracted over node-pty so callers stay decoupled. */
export interface PtyHandle {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (e: { exitCode: number }) => void): void;
  /** Flow-control hooks (backpressure). Optional; no-ops if unsupported. */
  pause?(): void;
  resume?(): void;
}

/** What to actually run when a client sends `start`. Returned by resolveSpawn. */
export interface SpawnSpec {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  cols?: number;
  rows?: number;
}

export interface StartContext {
  sessionId: string;
  projectId: string;
  command?: string;
  cols?: number;
  rows?: number;
}

/**
 * Service-specific: given the authenticated token claims and the client's
 * `start` request, decide what to spawn. The worker looks up the container and
 * returns a `docker exec` spec; the desktop agent returns a host shell spec.
 */
export type ResolveSpawn = (
  claims: PtyTokenClaims,
  ctx: StartContext,
) => Promise<SpawnSpec> | SpawnSpec;

export interface PtyGatewayOptions {
  port: number;
  host?: string;
  /** WebSocket path to accept (default: any path). */
  path?: string;
  /** Verify a wsToken → claims, or null to reject the connection. */
  verify: (token: string) => PtyTokenClaims | null;
  resolveSpawn: ResolveSpawn;
  /** Called once a PTY is live for a session. */
  onSessionStart?: (claims: PtyTokenClaims, ctx: StartContext) => void;
  /** Called when the PTY exits (process end, kill, or client disconnect). */
  onSessionExit?: (claims: PtyTokenClaims, ctx: StartContext, exitCode: number) => void;
  /** Optional HTTP control plane served on the same port as the WebSocket gateway. */
  handleHttpRequest?: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
  logger?: (msg: string) => void;
}

export interface PtyGateway {
  port: number;
  close(): Promise<void>;
}
