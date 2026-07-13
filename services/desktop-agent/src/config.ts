import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { loadSharedEnv } from '@pocketdev/pty-core';

// Side effect: load server/.env so JWT_SECRET matches the API (the desktop
// verifies API-minted PTY tokens). Must run before we read process.env below.
loadSharedEnv();

function num(v: string | undefined, fallback: number): number {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

/** First matching executable on PATH, or null (Windows tries .exe too). */
function findOnPath(exe: string): string | null {
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const full = join(dir, exe + ext);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

/**
 * Pick a sensible interactive shell unless overridden by DESKTOP_SHELL.
 * Windows: prefer PowerShell 7 (`pwsh`) if installed, else Windows PowerShell
 * (`powershell.exe`, always present) — both far nicer than the legacy `cmd.exe`.
 */
function defaultShell(): string {
  if (process.env.DESKTOP_SHELL) return process.env.DESKTOP_SHELL;
  if (process.platform === 'win32') {
    return findOnPath('pwsh') ?? 'powershell.exe';
  }
  return process.env.SHELL ?? 'bash';
}

export const config = {
  port: num(process.env.DESKTOP_AGENT_PORT, 4000),
  // Bind loopback by default: cloudflared connects to localhost, so the tunnel
  // still works, but nothing on the LAN can reach the (unsandboxed) host PTY.
  // Set DESKTOP_BIND=0.0.0.0 only if you deliberately expose it another way.
  bindHost: process.env.DESKTOP_BIND ?? '127.0.0.1',
  apiUrl: process.env.POCKETDEV_API_URL ?? 'http://localhost:3000',
  /** The desktop's own linking token (its user's JWT) for presence + closing sessions. */
  token: process.env.POCKETDEV_TOKEN ?? '',
  /** Public tunnel URL (cloudflared) the phone reaches this agent through. */
  tunnelUrl: process.env.POCKETDEV_TUNNEL_URL || undefined,
  /** Shared with the server to verify the phone's short-lived PTY token. */
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  shell: defaultShell(),
  /** Directory sessions open in — the developer's actual local project. */
  projectRoot: resolve(process.env.DESKTOP_PROJECT_ROOT ?? process.cwd()),
  heartbeatMs: num(process.env.DESKTOP_HEARTBEAT_MS, 15_000),
} as const;

/** Build shell args to run a command (or an interactive shell if none). */
export function shellArgs(shell: string, command?: string): string[] {
  const cmd = command?.trim();
  if (/powershell|pwsh/i.test(shell)) {
    return cmd ? ['-NoLogo', '-NoProfile', '-Command', cmd] : ['-NoLogo', '-NoProfile'];
  }
  if (/cmd(\.exe)?$/i.test(shell)) {
    return cmd ? ['/c', cmd] : [];
  }
  return cmd ? ['-lc', cmd] : ['-l'];
}
