import { describe, expect, it } from 'vitest';
import {
  interactivePtyStart,
  plainTerminalText,
  terminalCommandInput,
} from '../mobile/utils/terminal';

describe('interactive terminal startup', () => {
  it('opens a shell without turning the first command into the shell process', () => {
    const message = interactivePtyStart({
      sessionId: 'session-one',
      projectId: 'project-one',
      token: 'token',
      cols: 80,
      rows: 24,
    });

    expect(message).toEqual({
      type: 'start',
      sessionId: 'session-one',
      projectId: 'project-one',
      token: 'token',
      cols: 80,
      rows: 24,
    });
    expect(message).not.toHaveProperty('command');
  });

  it('sends the first and subsequent commands through the live PTY', () => {
    expect(terminalCommandInput('  npm test  ')).toBe('npm test\r');
  });
});

describe('plainTerminalText', () => {
  it('removes PowerShell CSI and title control sequences', () => {
    const output =
      '\u001b[?9001h\u001b[?25l\u001b[2J\u001b[m\u001b[H' +
      '\u001b]0;npm\u0007\u001b[1mnpm\u001b[22m run build\r\n';
    expect(plainTerminalText(output)).toBe('npm run build\r\n');
  });

  it('keeps normal Unicode terminal output', () => {
    expect(plainTerminalText('✓ build complete\nनेपाल')).toBe('✓ build complete\nनेपाल');
  });
});
