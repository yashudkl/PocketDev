import { promises as fs } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildManifest, readBase64 } from '../services/cli-agent/src/manifest';

let dir: string;

beforeAll(async () => {
  dir = await fs.mkdtemp(join(os.tmpdir(), 'pd-manifest-'));
  await fs.writeFile(join(dir, 'a.txt'), 'hello');
  await fs.mkdir(join(dir, 'src'));
  await fs.writeFile(join(dir, 'src', 'b.js'), 'console.log(1)');
  await fs.mkdir(join(dir, 'node_modules'));
  await fs.writeFile(join(dir, 'node_modules', 'junk.js'), 'nope');
  await fs.mkdir(join(dir, '.git'));
  await fs.writeFile(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main');
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('buildManifest (CLI delta-sync)', () => {
  it('includes tracked files with POSIX paths and sha256 hashes', async () => {
    const m = await buildManifest(dir);
    expect(Object.keys(m).sort()).toEqual(['a.txt', 'src/b.js']);
    expect(m['a.txt'].hash).toHaveLength(64);
    expect(m['src/b.js'].path).toBe('src/b.js');
  });

  it('ignores node_modules and .git', async () => {
    const m = await buildManifest(dir);
    expect(m['node_modules/junk.js']).toBeUndefined();
    expect(m['.git/HEAD']).toBeUndefined();
  });

  it('produces a stable hash for identical content', async () => {
    const m1 = await buildManifest(dir);
    const m2 = await buildManifest(dir);
    expect(m1['a.txt'].hash).toBe(m2['a.txt'].hash);
  });

  it('readBase64 round-trips file content', async () => {
    const b64 = await readBase64(dir, 'a.txt');
    expect(Buffer.from(b64, 'base64').toString()).toBe('hello');
  });
});
