import { describe, expect, it } from 'vitest';
import { shellArgs } from '../services/desktop-agent/src/config';

describe('shellArgs (desktop host runner, cross-OS)', () => {
  it('runs a command in a POSIX login shell', () => {
    expect(shellArgs('bash', 'npm test')).toEqual(['-lc', 'npm test']);
  });

  it('opens an interactive POSIX shell when no command', () => {
    expect(shellArgs('/bin/zsh')).toEqual(['-l']);
  });

  it('runs a command via PowerShell', () => {
    expect(shellArgs('powershell.exe', 'Get-ChildItem')).toEqual([
      '-NoLogo',
      '-NoProfile',
      '-Command',
      'Get-ChildItem',
    ]);
  });

  it('runs a command via cmd.exe', () => {
    expect(shellArgs('C:\\Windows\\System32\\cmd.exe', 'dir')).toEqual(['/c', 'dir']);
  });

  it('treats a blank command as interactive', () => {
    expect(shellArgs('bash', '   ')).toEqual(['-l']);
  });
});
