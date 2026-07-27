import type { PtyClientMessage } from '@pocketdev/shared';

const escapeCharacter = String.fromCharCode(27);
const ansiPattern = new RegExp(
  `${escapeCharacter}(?:\\[[0-?]*[ -/]*[@-~]|\\][^\\u0007]*(?:\\u0007|${escapeCharacter}\\\\))`,
  'g',
);

type PtyStartMessage = Extract<PtyClientMessage, { type: 'start' }>;

/** Start a shell rather than a one-shot command so the PTY stays alive. */
export function interactivePtyStart(
  input: Omit<PtyStartMessage, 'type' | 'command'>,
): PtyStartMessage {
  return { type: 'start', ...input };
}

/** Translate a command into the Enter-terminated input expected by a live PTY. */
export function terminalCommandInput(command: string): string {
  return `${command.trim()}\r`;
}

/** Convert PTY output into readable plain text for the React Native text renderer. */
export function plainTerminalText(value: string): string {
  return value.replace(ansiPattern, '').replace(/\r(?!\n)/g, '');
}
