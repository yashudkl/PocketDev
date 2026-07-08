// WebSocket protocol for streaming a real pseudo-terminal to the phone
// (node-pty ↔ WebSocket ↔ xterm/RN terminal view).

/** Messages sent from the client (phone) to the PTY server. */
export type PtyClientMessage =
  | { type: 'start'; sessionId: string; projectId: string; command?: string }
  | { type: 'input'; sessionId: string; data: string }
  | { type: 'resize'; sessionId: string; cols: number; rows: number }
  | { type: 'kill'; sessionId: string };

/** Messages sent from the PTY server back to the client. */
export type PtyServerMessage =
  | { type: 'ready'; sessionId: string }
  | { type: 'data'; sessionId: string; data: string }
  | { type: 'exit'; sessionId: string; exitCode: number }
  | { type: 'error'; sessionId: string; message: string };
