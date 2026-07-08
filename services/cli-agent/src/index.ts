#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import chokidar from 'chokidar';
import { Command } from 'commander';
import type { FileManifest } from '@pocketdev/shared';

// Ignore junk (Build Plan: chokidar with an ignore list + awaitWriteFinish).
const IGNORED = [/(^|[/\\])\.git/, /node_modules/, /dist/, /\.expo/, /\.turbo/];

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function manifestEntry(root: string, path: string): FileManifest[string] | null {
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return null;
    return {
      path: relative(root, path).split('\\').join('/'),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      hash: hashFile(path),
    };
  } catch {
    return null;
  }
}

const program = new Command();
program.name('pocketdev').description('PocketDev CLI sync agent').version('0.1.0');

program
  .command('watch')
  .argument('<dir>', 'project directory to watch')
  .option('-p, --project <id>', 'project id on the server')
  .option('-s, --server <url>', 'server WebSocket URL', 'ws://localhost:3000')
  .description('Watch a folder and delta-sync changes to the server')
  .action((dir: string, opts: { project?: string; server: string }) => {
    const root = resolve(dir);
    console.log(`[cli-agent] watching ${root}`);
    console.log(`[cli-agent] project=${opts.project ?? '(unset)'} server=${opts.server}`);

    const watcher = chokidar.watch(root, {
      ignored: IGNORED,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });

    watcher.on('all', (event, path) => {
      const entry = manifestEntry(root, path);
      // TODO (Weeks 3–4): diff against the server manifest and push only changed
      // files as SyncClientMessage frames over the WebSocket.
      console.log(`[cli-agent] ${event.padEnd(7)} ${entry ? entry.path : relative(root, path)}`);
    });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
