// Response shape for starting an execution/terminal session (POST /jobs).
// The API decides the target (desktop-if-present-else-cloud, BUILD-PLAN
// Decision 4), then hands the phone a WebSocket URL and a short-lived token
// scoped to this one session. The phone opens the PTY WebSocket to `wsUrl`,
// authenticating with `wsToken`, and speaks the pty-protocol from there.

import type { ExecutionTarget } from './domain';

export interface StartSessionResponse {
  jobId: string;
  sessionId: string;
  target: ExecutionTarget;
  /** Where the PTY WebSocket lives: the cloud worker, or the desktop tunnel. */
  wsUrl: string;
  /** Short-lived JWT (scope: "pty") authorizing this session on the PTY server. */
  wsToken: string;
}

/** Decoded claims carried by a wsToken; verified by the worker/desktop agent. */
export interface PtyTokenClaims {
  sub: string; // userId
  sessionId: string;
  projectId: string;
  scope: 'pty';
}
