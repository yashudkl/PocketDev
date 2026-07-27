#!/usr/bin/env node
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import chokidar from 'chokidar';
import { Command } from 'commander';
import { IGNORED_DIRS } from './manifest';
import { syncOnce } from './sync-client';

const execFileAsync = promisify(execFile);

/** Normalize an http(s)/ws(s) base URL to a ws(s) one for the /sync socket. */
function toWs(url: string): string {
  return url.replace(/^http/i, 'ws');
}

function toHttp(url: string): string {
  return url.replace(/^ws/i, 'http').replace(/\/+$/, '');
}

interface CommonOpts {
  project?: string;
  server: string;
  token?: string;
}

function resolveAuth(opts: CommonOpts): { projectId: string; token: string; server: string } {
  const projectId = opts.project ?? process.env.POCKETDEV_PROJECT ?? '';
  const token = opts.token ?? process.env.POCKETDEV_TOKEN ?? '';
  const server = toWs(opts.server ?? process.env.POCKETDEV_API_URL ?? 'ws://localhost:3000');
  if (!projectId) {
    console.error('Missing --project (or POCKETDEV_PROJECT).');
    process.exit(1);
  }
  if (!token) {
    console.error('Missing --token (or POCKETDEV_TOKEN). Log in to get a JWT.');
    process.exit(1);
  }
  return { projectId, token, server };
}

const log = (msg: string): void => console.log(`[cli-agent] ${msg}`);

const program = new Command();
program.name('pocketdev').description('PocketDev CLI sync agent').version('0.1.0');

program
  .command('link')
  .argument('<dir>', 'existing desktop project directory to link')
  .option('-p, --project <id>', 'project id on the server')
  .option('-s, --server <url>', 'server URL (http/ws)', 'ws://localhost:3000')
  .option('-t, --token <jwt>', 'access token (JWT)')
  .description('Link a desktop folder, sync its files, and carry across its Git origin')
  .action(async (dir: string, opts: CommonOpts) => {
    const { projectId, token, server } = resolveAuth(opts);
    const root = resolve(dir);
    log(`linking ${root} → ${server} (project ${projectId})`);
    try {
      const res = await syncOnce({ server, token, projectId, root, log });
      await linkDesktopProject({ server, token, projectId, root });
      const remote = await localGitOrigin(root);
      await configureServerGit({ server, token, projectId, remote });
      log(
        `linked: ${res.changed} sent, ${res.removed} removed` +
          (remote ? `, origin=${remote}` : ', no local Git origin detected'),
      );
    } catch (err) {
      console.error(`[cli-agent] link failed: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  });

program
  .command('sync')
  .argument('<dir>', 'project directory to sync')
  .option('-p, --project <id>', 'project id on the server')
  .option('-s, --server <url>', 'server URL (http/ws)', 'ws://localhost:3000')
  .option('-t, --token <jwt>', 'access token (JWT)')
  .description('One-shot delta-sync of a folder to the server')
  .action(async (dir: string, opts: CommonOpts) => {
    const { projectId, token, server } = resolveAuth(opts);
    const root = resolve(dir);
    log(`syncing ${root} → ${server} (project ${projectId})`);
    try {
      const res = await syncOnce({ server, token, projectId, root, log });
      log(`done: ${res.changed} sent, ${res.removed} removed`);
    } catch (err) {
      console.error(`[cli-agent] sync failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('watch')
  .argument('<dir>', 'project directory to watch')
  .option('-p, --project <id>', 'project id on the server')
  .option('-s, --server <url>', 'server URL (http/ws)', 'ws://localhost:3000')
  .option('-t, --token <jwt>', 'access token (JWT)')
  .option('-d, --debounce <ms>', 'debounce window for change bursts', '600')
  .description('Watch a folder and delta-sync on every change (BUILD-PLAN Weeks 3–4)')
  .action(async (dir: string, opts: CommonOpts & { debounce: string }) => {
    const { projectId, token, server } = resolveAuth(opts);
    const root = resolve(dir);
    const debounceMs = parseInt(opts.debounce, 10) || 600;

    const runSync = makeSerializedSync({ server, token, projectId, root });
    log(`initial sync of ${root} …`);
    await runSync();

    const watcher = chokidar.watch(root, {
      ignored: (p: string) => p.split(/[\\/]/).some((seg) => IGNORED_DIRS.has(seg)),
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });

    let timer: NodeJS.Timeout | undefined;
    const schedule = (event: string, path: string): void => {
      log(`${event} ${path}`);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void runSync(), debounceMs);
    };
    watcher.on('add', (p) => schedule('add', p));
    watcher.on('change', (p) => schedule('change', p));
    watcher.on('unlink', (p) => schedule('unlink', p));
    watcher.on('ready', () =>
      log(`watching for changes (debounce ${debounceMs}ms) — Ctrl+C to stop`),
    );

    process.on('SIGINT', () => {
      void watcher.close().then(() => process.exit(0));
    });
  });

/**
 * Serialize syncs so overlapping change bursts don't race: if a sync is running
 * and another is requested, run exactly one more after it finishes.
 */
function makeSerializedSync(base: {
  server: string;
  token: string;
  projectId: string;
  root: string;
}): () => Promise<void> {
  let running = false;
  let queued = false;
  const run = async (): Promise<void> => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      const res = await syncOnce({ ...base, log });
      log(`synced: ${res.changed} sent, ${res.removed} removed`);
    } catch (err) {
      console.error(`[cli-agent] sync failed: ${(err as Error).message}`);
    } finally {
      running = false;
      if (queued) {
        queued = false;
        void run();
      }
    }
  };
  return run;
}

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});

async function apiPost(
  server: string,
  token: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`${toHttp(server)}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function linkDesktopProject(input: {
  server: string;
  token: string;
  projectId: string;
  root: string;
}): Promise<void> {
  await apiPost(input.server, input.token, `/projects/${input.projectId}/link`, {
    desktopPath: input.root,
  });
}

async function localGitOrigin(root: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', root, 'remote', 'get-url', 'origin']);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function configureServerGit(input: {
  server: string;
  token: string;
  projectId: string;
  remote: string | null;
}): Promise<void> {
  await apiPost(input.server, input.token, `/projects/${input.projectId}/git/init`);
  if (input.remote) {
    await apiPost(input.server, input.token, `/projects/${input.projectId}/git/remote`, {
      url: input.remote,
    });
  }
}
