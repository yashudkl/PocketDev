import type {
  ManifestDiff,
  SyncClientMessage,
  SyncServerMessage,
} from '@pocketdev/shared';
import WebSocket from 'ws';
import { buildManifest, readBase64 } from './manifest';

export interface SyncOptions {
  /** Base server URL, e.g. ws://localhost:3000 (the agent appends /sync). */
  server: string;
  token: string;
  projectId: string;
  root: string;
  log?: (msg: string) => void;
}

export interface SyncResult {
  changed: number;
  removed: number;
}

/**
 * One delta-sync round (BUILD-PLAN Weeks 3–4): build the local manifest, hand it
 * to the server, and transfer only what the server asks for.
 *   manifest → (server) diff → file/removed frames → done → synced
 */
export function syncOnce(opts: SyncOptions): Promise<SyncResult> {
  const log = opts.log ?? (() => undefined);
  const url = `${opts.server.replace(/\/+$/, '')}/sync?token=${encodeURIComponent(opts.token)}`;

  return new Promise<SyncResult>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };

    void (async () => {
      const manifest = await buildManifest(opts.root);
      const ws = new WebSocket(url);
      const result: SyncResult = { changed: 0, removed: 0 };

      const send = (msg: SyncClientMessage): void => ws.send(JSON.stringify(msg));

      ws.on('open', () => {
        log(`connected — advertising ${Object.keys(manifest).length} files`);
        send({ type: 'manifest', projectId: opts.projectId, manifest });
      });

      ws.on('message', (raw) => {
        let msg: SyncServerMessage;
        try {
          msg = JSON.parse(raw.toString()) as SyncServerMessage;
        } catch {
          return;
        }
        if (msg.type === 'diff') {
          void pushDiff(ws, send, opts, msg.diff, result, log);
        } else if (msg.type === 'synced') {
          finish(() => resolve(result));
          ws.close(1000, 'done');
        }
      });

      ws.on('error', (err) => finish(() => reject(err)));
      ws.on('close', (code) => {
        finish(() => reject(new Error(`sync socket closed early (${code})`)));
      });
    })().catch((err) => finish(() => reject(err)));
  });
}

async function pushDiff(
  ws: WebSocket,
  send: (m: SyncClientMessage) => void,
  opts: SyncOptions,
  diff: ManifestDiff,
  result: SyncResult,
  log: (m: string) => void,
): Promise<void> {
  log(`server wants ${diff.changed.length} changed, ${diff.removed.length} removed`);
  for (const path of diff.changed) {
    try {
      const contentBase64 = await readBase64(opts.root, path);
      send({ type: 'file', projectId: opts.projectId, path, contentBase64 });
      result.changed += 1;
    } catch (err) {
      log(`skip ${path}: ${(err as Error).message}`);
    }
  }
  for (const path of diff.removed) {
    send({ type: 'removed', projectId: opts.projectId, path });
    result.removed += 1;
  }
  send({ type: 'done', projectId: opts.projectId });
  // Keep the socket alive; the server replies `synced` and we close on it.
  void ws;
}
