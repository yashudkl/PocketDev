import { createPtyGateway, jwtVerifier, type PtyGateway, type SpawnSpec } from '@pocketdev/pty-core';
import { config } from './config';
import type { SessionRegistry } from './session-registry';

/**
 * Start the CLOUD PTY gateway. When the phone connects and sends `start`, we
 * look up the container the BullMQ job provisioned for that session and hand
 * back a `docker exec` spec — node-pty (inside pty-core) runs it, giving a real
 * PTY inside the hardened sandbox. The only worker-specific logic is
 * resolveSpawn + wiring exit back to the job via the registry.
 */
export function startPtyGateway(registry: SessionRegistry): PtyGateway {
  const verify = jwtVerifier(config.jwtSecret);

  return createPtyGateway({
    port: config.ptyPort,
    verify,
    logger: (msg) => console.log(`[pty-gateway] ${msg}`),

    resolveSpawn: async (claims, ctx): Promise<SpawnSpec> => {
      // Wait long enough to sit in the FREE-tier queue behind an active session
      // and then stream once a slot frees (not just the ~instant provisioning case).
      const entry = await registry.waitFor(ctx.sessionId, config.queueWaitS * 1000);
      if (!entry) {
        throw new Error('session container not provisioned (timed out in queue)');
      }
      if (entry.userId !== claims.sub) {
        throw new Error('token does not match session owner');
      }
      // Phone is here — stop the job's connect timeout so it won't tear down.
      entry.attached();

      const shell = config.docker.shell;
      const args = [
        'exec',
        '-i',
        '-t',
        '-w',
        '/workspace',
        '-e',
        'TERM=xterm-256color',
        entry.containerId,
      ];
      if (ctx.command && ctx.command.trim()) {
        args.push(shell, '-lc', ctx.command);
      } else {
        args.push(shell, '-l');
      }
      return { command: 'docker', args };
    },

    onSessionExit: (_claims, ctx, exitCode) => {
      registry.get(ctx.sessionId)?.release(exitCode);
    },
  });
}
