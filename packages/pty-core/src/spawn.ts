import { spawn as ptySpawn, type IPty } from 'node-pty';
import type { PtyHandle, SpawnSpec } from './types';

/** Wrap node-pty into the runner-agnostic PtyHandle interface. */
export function spawnPty(spec: SpawnSpec): PtyHandle {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  for (const [name, value] of Object.entries(spec.env ?? {})) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
  const proc: IPty = ptySpawn(spec.command, spec.args, {
    name: 'xterm-256color',
    cols: spec.cols ?? 80,
    rows: spec.rows ?? 24,
    cwd: spec.cwd ?? process.cwd(),
    env,
  });

  return {
    write: (data) => proc.write(data),
    resize: (cols, rows) => {
      try {
        proc.resize(Math.max(1, cols), Math.max(1, rows));
      } catch {
        /* window may already be gone */
      }
    },
    kill: () => {
      try {
        proc.kill();
      } catch {
        /* already exited */
      }
    },
    onData: (cb) => proc.onData(cb),
    onExit: (cb) => proc.onExit(({ exitCode }) => cb({ exitCode })),
    pause: () => proc.pause(),
    resume: () => proc.resume(),
  };
}
