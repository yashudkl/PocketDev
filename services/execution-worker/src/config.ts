import { resolve } from 'node:path';
import { loadSharedEnv } from '@pocketdev/pty-core';

// Side effect: load server/.env so JWT_SECRET/REDIS/etc match the API. Must run
// before we read process.env below. Returns the repo root for path anchoring.
const REPO_ROOT = loadSharedEnv();

function num(v: string | undefined, fallback: number): number {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: num(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',

  /** PTY-over-WS gateway port the phone connects to for CLOUD sessions. */
  ptyPort: num(process.env.WORKER_PTY_PORT, 4100),

  /** Root of the synced file store; per-project subfolders bind-mount into
   *  containers. Anchored at the repo root so it resolves to the SAME directory
   *  as the API regardless of each process's cwd. */
  fileStoreRoot: resolve(REPO_ROOT, process.env.FILE_STORE_ROOT ?? './.pocketdev-store'),

  docker: {
    image: process.env.EXECUTION_IMAGE ?? 'node:22-bookworm-slim',
    /** "runc" (default) or "runsc" (gVisor, BUILD-PLAN Week 8 — a demo-able win). */
    runtime: process.env.EXECUTION_RUNTIME ?? 'runc',
    shell: process.env.EXECUTION_SHELL ?? 'bash',
    memoryMb: num(process.env.EXECUTION_MEMORY_MB, 512),
    cpus: Number(process.env.EXECUTION_CPUS ?? '1'),
    pidsLimit: num(process.env.EXECUTION_PIDS_LIMIT, 256),
    /** 1 = bridge network (npm/pip installs work); 0 = --network none. */
    network: process.env.EXECUTION_NETWORK !== '0',
    /** Read-only rootfs (defense-in-depth). Off by default so demo builds work. */
    readonlyRootfs: process.env.EXECUTION_READONLY === '1',
    /** Run user commands as this container user (blank = image default). */
    user: process.env.EXECUTION_USER || undefined,
  },

  /** Max concurrent CLOUD sessions = the FREE-tier shared pool (Definition of Done). */
  concurrency: num(process.env.WORKER_CONCURRENCY, 2),
  /** Seconds to hold a provisioned container waiting for the phone to attach. */
  connectTimeoutS: num(process.env.SESSION_CONNECT_TIMEOUT_S, 60),
  /** Seconds a connected client waits for its (possibly QUEUED) job to be
   *  scheduled and its container provisioned — long enough to sit in the free
   *  tier queue behind an active session, then stream once a slot frees. */
  queueWaitS: num(process.env.SESSION_QUEUE_WAIT_S, 300),
  /** Hard wall-clock cap on a single session. */
  maxDurationS: num(process.env.SESSION_MAX_DURATION_S, 1800),
} as const;

export type WorkerConfig = typeof config;
