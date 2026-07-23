import { promises as fs } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FileStoreService } from '../server/src/files/file-store.service';

let root: string;
let files: FileStoreService;

beforeAll(async () => {
  root = await fs.mkdtemp(join(os.tmpdir(), 'pd-file-create-'));
  files = new FileStoreService({
    get: () => root,
  } as unknown as ConfigService);
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('FileStoreService exclusive create', () => {
  it('does not truncate a file that already exists', async () => {
    await files.writeText('user', 'project', 'src/existing.ts', 'keep me');

    await expect(
      files.writeText('user', 'project', 'src/existing.ts', '', {
        createOnly: true,
      }),
    ).rejects.toThrow('File already exists');

    await expect(files.readText('user', 'project', 'src/existing.ts')).resolves.toMatchObject({
      content: 'keep me',
    });
  });

  it('allows an explicit editor save to overwrite content', async () => {
    await files.writeText('user', 'project', 'src/save.ts', 'before');
    await files.writeText('user', 'project', 'src/save.ts', 'after');

    await expect(files.readText('user', 'project', 'src/save.ts')).resolves.toMatchObject({
      content: 'after',
    });
  });
});
