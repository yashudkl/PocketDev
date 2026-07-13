// Coordination contract between the execution worker (services/execution-worker)
// and the API (server/). Per BUILD-PLAN Decision 2, the worker is the
// untrusted-code blast radius and MUST NOT touch Postgres directly. Instead it
// publishes lifecycle events on a Redis pub/sub channel; the server subscribes
// and reconciles them into the database (Job.status, Session.containerId, etc.).

import type { ExecutionTarget } from './domain';

/** Redis pub/sub channel the worker publishes ExecutionEvents on. */
export const EXEC_EVENTS_CHANNEL = 'pocketdev:exec:events';

/**
 * Redis pub/sub channel the server publishes control signals on (e.g. an
 * operator/API-initiated kill for a running session).
 */
export const EXEC_CONTROL_CHANNEL = 'pocketdev:exec:control';

/** A container/session has been provisioned and is ready for a PTY attach. */
export interface SessionStartedEvent {
  type: 'session-started';
  jobId: string;
  sessionId: string;
  userId: string;
  projectId: string;
  target: ExecutionTarget;
  containerId: string;
  at: string; // ISO timestamp
}

/** A session ended (process exited, client killed it, or it timed out). */
export interface SessionExitedEvent {
  type: 'session-exited';
  jobId: string;
  sessionId: string;
  exitCode: number;
  durationMs: number;
  at: string;
}

/** A session failed to provision or crashed before/while running. */
export interface SessionErrorEvent {
  type: 'session-error';
  jobId: string;
  sessionId: string;
  message: string;
  at: string;
}

export type ExecutionEvent = SessionStartedEvent | SessionExitedEvent | SessionErrorEvent;

/** Server → worker control signals. */
export interface KillSessionSignal {
  type: 'kill-session';
  sessionId: string;
}

export type ExecutionControlSignal = KillSessionSignal;
