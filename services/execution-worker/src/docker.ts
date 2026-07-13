import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import Docker from 'dockerode';
import { config } from './config';

// Uses DOCKER_HOST / the default socket. On the demo VM this is the local daemon.
const docker = new Docker();

// Drop ALL caps, then add back only the minimal set package managers need to
// extract tarballs and drop privileges (npm/pip). Everything dangerous
// (NET_ADMIN, SYS_ADMIN, SYS_PTRACE, …) stays dropped. BUILD-PLAN Decision 6.
const KEEP_CAPS = ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'FSETID', 'SETGID', 'SETUID'];

export interface ProvisionOpts {
  userId: string;
  projectId: string;
  sessionId: string;
  jobId: string;
}

export async function pingDocker(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

export async function pullIfMissing(image: string): Promise<void> {
  try {
    await docker.getImage(image).inspect();
    return; // already present
  } catch {
    /* not present — pull below */
  }
  await new Promise<void>((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (done: Error | null) =>
        done ? reject(done) : resolve(),
      );
    });
  });
}

/**
 * Create + start a hardened, long-lived sandbox container for a session. It just
 * `sleep`s; the PTY gateway `docker exec`s user commands into it. Hardening:
 * cgroup CPU/memory/PID caps, dropped capabilities, no-new-privileges, tmpfs for
 * /tmp, optional read-only rootfs and `runsc` (gVisor) runtime.
 */
export async function createSessionContainer(opts: ProvisionOpts): Promise<Docker.Container> {
  const hostDir = join(config.fileStoreRoot, opts.userId, opts.projectId);
  await fs.mkdir(hostDir, { recursive: true });
  const d = config.docker;

  const container = await docker.createContainer({
    Image: d.image,
    name: `pocketdev-${opts.sessionId}`,
    Cmd: ['sleep', 'infinity'],
    WorkingDir: '/workspace',
    Tty: false,
    User: d.user,
    Env: ['HOME=/workspace', 'TERM=xterm-256color'],
    Labels: {
      pocketdev: 'session',
      'pocketdev.sessionId': opts.sessionId,
      'pocketdev.jobId': opts.jobId,
      'pocketdev.userId': opts.userId,
    },
    HostConfig: {
      Binds: [`${hostDir}:/workspace`],
      Memory: d.memoryMb * 1024 * 1024,
      NanoCpus: Math.round(d.cpus * 1e9),
      PidsLimit: d.pidsLimit,
      CapDrop: ['ALL'],
      CapAdd: KEEP_CAPS,
      SecurityOpt: ['no-new-privileges'],
      ReadonlyRootfs: d.readonlyRootfs,
      Tmpfs: { '/tmp': 'rw,size=64m', '/run': 'rw,size=16m' },
      NetworkMode: d.network ? 'bridge' : 'none',
      Runtime: d.runtime,
      AutoRemove: false,
    },
  });

  await container.start();
  return container;
}

export async function destroyContainer(container: Docker.Container): Promise<void> {
  try {
    await container.remove({ force: true });
  } catch {
    /* already gone */
  }
}

/** Best-effort cleanup of any leftover session containers (crash recovery). */
export async function reapOrphans(): Promise<void> {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ['pocketdev=session'] },
    });
    await Promise.allSettled(
      containers.map((c) => docker.getContainer(c.Id).remove({ force: true })),
    );
  } catch {
    /* daemon may be down; ignore */
  }
}
