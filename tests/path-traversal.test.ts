import os from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileStoreService } from '../server/src/files/file-store.service';

// Instantiate directly with a stub ConfigService (no Nest container needed).
const svc = new FileStoreService({
  get: () => join(os.tmpdir(), 'pd-store-test'),
} as unknown as import('@nestjs/config').ConfigService);

describe('FileStoreService path traversal (security)', () => {
  it('rejects ../ escapes', async () => {
    await expect(svc.writeText('u', 'p', '../../etc/passwd', 'x')).rejects.toThrow();
  });

  it('rejects POSIX absolute paths', async () => {
    await expect(svc.writeText('u', 'p', '/etc/passwd', 'x')).rejects.toThrow();
  });

  it('rejects Windows drive-letter / cross-drive paths', async () => {
    await expect(svc.writeText('u', 'p', 'D:\\evil.txt', 'x')).rejects.toThrow();
    await expect(svc.writeText('u', 'p', 'C:/Windows/system32/x', 'x')).rejects.toThrow();
  });

  it('rejects backslash traversal', async () => {
    await expect(svc.writeText('u', 'p', '..\\..\\secret', 'x')).rejects.toThrow();
  });

  it('allows a normal nested relative path', async () => {
    const bytes = await svc.writeText('u', 'p', 'src/ok.txt', 'hello');
    expect(bytes).toBe(5);
  });
});
