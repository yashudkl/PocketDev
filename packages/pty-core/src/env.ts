import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Walk up from `start` to the monorepo root (marked by pnpm-workspace.yaml). */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

/**
 * Load the canonical shared env (server/.env) into process.env so the worker and
 * desktop agent use the SAME JWT_SECRET / REDIS / FILE_STORE_ROOT as the API —
 * otherwise the worker can't verify the API-minted PTY token. Uses Node 22's
 * built-in loadEnvFile (no dependency). Returns the repo root for path anchoring.
 * Real shell env still wins (loadEnvFile does not clobber already-set vars).
 */
export function loadSharedEnv(): string {
  const root = findRepoRoot();
  const envPath = join(root, 'server', '.env');
  try {
    const loadEnvFile = (process as { loadEnvFile?: (p: string) => void }).loadEnvFile;
    if (loadEnvFile && existsSync(envPath)) loadEnvFile(envPath);
  } catch {
    /* no/invalid .env — fall back to real env + defaults */
  }
  return root;
}
