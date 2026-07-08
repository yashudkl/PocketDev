import { Worker } from 'bullmq';
import {
  EXECUTION_QUEUE,
  type RunCommandJobData,
  type RunCommandJobResult,
} from '@pocketdev/shared';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

// Consumes the same Redis queue the API produces to. Run as a SEPARATE process
// from the API so a container escape or crash can't take down auth/DB.
const worker = new Worker<RunCommandJobData, RunCommandJobResult>(
  EXECUTION_QUEUE,
  async (job) => {
    const started = Date.now();
    const { jobId, command, target } = job.data;
    console.log(`[execution-worker] run job=${jobId} target=${target} :: ${command}`);

    // ── TODO (Weeks 5–8) ──────────────────────────────────────────────────────
    // 1. Dockerode: spawn a per-session container, hardened (non-root, dropped
    //    caps, read-only rootfs, cgroup CPU/mem/PID limits, seccomp).
    // 2. node-pty: attach a PTY running the command inside the container.
    // 3. Stream stdout/stderr as PtyServerMessage frames over a WebSocket.
    // 4. Week 8: run the container under gVisor (--runtime=runsc).
    // For now this simulates a run so the freemium queue is demonstrable.
    await new Promise((resolve) => setTimeout(resolve, 500));

    return { exitCode: 0, durationMs: Date.now() - started };
  },
  { connection, concurrency: 4 },
);

worker.on('completed', (job, result) => {
  console.log(`[execution-worker] completed job=${job.id}`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[execution-worker] failed job=${job?.id}: ${err.message}`);
});

console.log(`[execution-worker] listening on queue "${EXECUTION_QUEUE}" @ ${connection.host}:${connection.port}`);

async function shutdown(): Promise<void> {
  await worker.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
