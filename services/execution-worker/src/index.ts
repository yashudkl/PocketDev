import {
  EXECUTION_QUEUE,
  ExecutionTarget,
  type RunCommandJobData,
  type RunCommandJobResult,
} from '@pocketdev/shared';
import { Worker } from 'bullmq';
import { config } from './config';
import {
  createSessionContainer,
  destroyContainer,
  pingDocker,
  pullIfMissing,
  reapOrphans,
} from './docker';
import { ExecEvents } from './events';
import { startPtyGateway } from './gateway';
import { SessionRegistry } from './session-registry';

const iso = (): string => new Date().toISOString();
const registry = new SessionRegistry();

// Control channel: an API-initiated kill tears the session down (code 137 = SIGKILL).
const events = new ExecEvents((signal) => {
  if (signal.type === 'kill-session') {
    registry.get(signal.sessionId)?.release(137);
  }
});

const gateway = startPtyGateway(registry);

/**
 * A CLOUD execution job: provision a hardened container, publish `session-started`,
 * then BLOCK holding this concurrency slot until the PTY session ends. The block
 * is exactly what makes the FREE tier queue — with `concurrency` slots, the
 * (N+1)-th free job waits in BullMQ while paid jobs jump ahead (priority).
 */
const worker = new Worker<RunCommandJobData, RunCommandJobResult>(
  EXECUTION_QUEUE,
  async (job) => {
    const { jobId, sessionId, userId, projectId, command } = job.data;
    const started = Date.now();

    let container;
    try {
      container = await createSessionContainer({ userId, projectId, sessionId, jobId });
    } catch (err) {
      events.publish({
        type: 'session-error',
        jobId,
        sessionId,
        message: (err as Error).message,
        at: iso(),
      });
      throw err; // BullMQ marks failed; the server's QueueEvents backstop catches it too
    }

    events.publish({
      type: 'session-started',
      jobId,
      sessionId,
      userId,
      projectId,
      target: ExecutionTarget.CLOUD,
      containerId: container.id,
      at: iso(),
    });

    const exitCode = await new Promise<number>((resolve) => {
      let settled = false;
      const done = (code: number): void => {
        if (!settled) {
          settled = true;
          resolve(code);
        }
      };
      // No phone attached in time → nothing ran, release the slot.
      const connectTimer = setTimeout(() => done(0), config.connectTimeoutS * 1000);
      // Hard wall-clock cap (124 = timeout, like coreutils `timeout`).
      const maxTimer = setTimeout(() => done(124), config.maxDurationS * 1000);

      registry.set({
        sessionId,
        jobId,
        userId,
        projectId,
        containerId: container.id,
        container,
        attached: () => clearTimeout(connectTimer),
        release: (code) => {
          clearTimeout(connectTimer);
          clearTimeout(maxTimer);
          done(code);
        },
      });
    });

    registry.delete(sessionId);
    await destroyContainer(container);
    const durationMs = Date.now() - started;
    events.publish({ type: 'session-exited', jobId, sessionId, exitCode, durationMs, at: iso() });
    return { exitCode, durationMs };
  },
  {
    connection: { ...config.redis, maxRetriesPerRequest: null },
    concurrency: config.concurrency,
  },
);

worker.on('completed', (job, result) =>
  console.log(`[execution-worker] job=${job.id} exit=${result.exitCode} ${result.durationMs}ms`),
);
worker.on('failed', (job, err) =>
  console.error(`[execution-worker] job=${job?.id} failed: ${err.message}`),
);
worker.on('error', (err) => console.error(`[execution-worker] worker error: ${err.message}`));

async function main(): Promise<void> {
  if (await pingDocker()) {
    await reapOrphans();
    try {
      console.log(`[execution-worker] ensuring image ${config.docker.image} …`);
      await pullIfMissing(config.docker.image);
    } catch (err) {
      console.warn(`[execution-worker] image pull failed: ${(err as Error).message}`);
    }
  } else {
    console.warn('[execution-worker] Docker not reachable — sessions will fail until it is up');
  }
  console.log(
    `[execution-worker] queue="${EXECUTION_QUEUE}" concurrency=${config.concurrency} ` +
      `pty=ws://0.0.0.0:${config.ptyPort} runtime=${config.docker.runtime}`,
  );
}

void main();

async function shutdown(): Promise<void> {
  console.log('[execution-worker] shutting down …');
  await Promise.allSettled([worker.close(), gateway.close(), events.close(), reapOrphans()]);
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
