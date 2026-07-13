import { resolve } from 'node:path';

function num(v: string | undefined, fallback: number): number {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Pick a sensible interactive shell per-OS unless overridden. */
function defaultShell(): string {
  if (process.env.DESKTOP_SHELL) return process.env.DESKTOP_SHELL;
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'cmd.exe';
  return process.env.SHELL ?? 'bash';
}

export const config = {
  port: num(process.env.DESKTOP_AGENT_PORT, 4000),
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
