import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { FileManifest } from '@pocketdev/shared';

/** Junk we never sync (matches the server's file-store ignore list). */
export const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', '.expo', '.turbo']);
/** Skip syncing very large files in a demo (build artifacts, media). */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

/** Walk a project tree and build a path → {size, mtime, sha256} manifest. */
export async function buildManifest(root: string): Promise<FileManifest> {
  const manifest: FileManifest = {};
  await walk(root, root, manifest);
  return manifest;
}

async function walk(root: string, dir: string, out: FileManifest): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      await walk(root, join(dir, entry.name), out);
    } else if (entry.isFile()) {
      const abs = join(dir, entry.name);
      try {
        const stat = await fs.stat(abs);
        if (stat.size > MAX_FILE_BYTES) continue;
        const buf = await fs.readFile(abs);
        const hash = createHash('sha256').update(buf).digest('hex');
        const relPath = toPosix(relative(root, abs));
        out[relPath] = { path: relPath, size: stat.size, mtimeMs: stat.mtimeMs, hash };
      } catch {
        /* unreadable — skip */
      }
    }
  }
}

/** Read a file and base64-encode it for a `file` sync frame. */
export async function readBase64(root: string, relPath: string): Promise<string> {
  const abs = join(root, ...relPath.split('/'));
  const buf = await fs.readFile(abs);
  return buf.toString('base64');
}
