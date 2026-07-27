import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import type { GitPushProgress } from '@pocketdev/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DesktopLinks } from '../services/desktop-agent/src/desktop-control';
import { handleProjectControl } from '../services/desktop-agent/src/project-control';

const execFileAsync = promisify(execFile);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function request(method: string, body?: unknown): IncomingMessage {
  return Object.assign(
    Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf8')]),
    { method },
  ) as IncomingMessage;
}

describe('desktop project control', () => {
  let temporaryDirectory: string;
  let projectRoot: string;
  let links: DesktopLinks;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(join(tmpdir(), 'pocketdev-desktop-control-'));
    projectRoot = join(temporaryDirectory, 'project');
    await fs.mkdir(join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(join(projectRoot, 'src', 'index.ts'), 'export const answer = 42;\n');
    links = new DesktopLinks(join(temporaryDirectory, 'links.json'));
    links.link('project-one', projectRoot);
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  it('lists, reads, and writes files in the linked desktop folder', async () => {
    const listing = await handleProjectControl(
      request('GET'),
      new URL('http://agent/desktop/projects/project-one/files'),
      links,
    );
    expect(listing?.body).toMatchObject({
      type: 'dir',
      children: [{ name: 'src', type: 'dir' }],
    });

    const read = await handleProjectControl(
      request('GET'),
      new URL('http://agent/desktop/projects/project-one/file?path=src%2Findex.ts'),
      links,
    );
    expect(read?.body).toMatchObject({ content: 'export const answer = 42;\n' });

    await handleProjectControl(
      request('PUT', { path: 'src/index.ts', content: 'export const answer = 43;\n' }),
      new URL('http://agent/desktop/projects/project-one/file'),
      links,
    );
    expect(await fs.readFile(join(projectRoot, 'src', 'index.ts'), 'utf8')).toBe(
      'export const answer = 43;\n',
    );
  });

  it('reports the selected folder’s real Git repository', async () => {
    await execFileAsync('git', ['init', '--initial-branch=main'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.name', 'PocketDev Test'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.email', 'test@pocketdev.local'], {
      cwd: projectRoot,
    });
    await execFileAsync('git', ['add', '.'], { cwd: projectRoot });
    await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: projectRoot });

    const status = await handleProjectControl(
      request('GET'),
      new URL('http://agent/desktop/projects/project-one/git/status'),
      links,
    );
    expect(status?.body).toMatchObject({ branch: 'main', clean: true });

    const log = await handleProjectControl(
      request('GET'),
      new URL('http://agent/desktop/projects/project-one/git/log'),
      links,
    );
    expect(log?.body).toEqual([
      expect.objectContaining({ message: 'Initial commit', author: 'PocketDev Test' }),
    ]);
  });

  it('reports progress while pushing the linked repository', async () => {
    const remoteRoot = join(temporaryDirectory, 'remote.git');
    await execFileAsync('git', ['init', '--bare', remoteRoot]);
    await execFileAsync('git', ['init', '--initial-branch=main'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.name', 'PocketDev Test'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.email', 'test@pocketdev.local'], {
      cwd: projectRoot,
    });
    await execFileAsync('git', ['add', '.'], { cwd: projectRoot });
    await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: projectRoot });
    await execFileAsync('git', ['remote', 'add', 'origin', remoteRoot], { cwd: projectRoot });

    const started = await handleProjectControl(
      request('POST'),
      new URL('http://agent/desktop/projects/project-one/git/push/start'),
      links,
    );
    let progress = started?.body as GitPushProgress;
    expect(progress).toMatchObject({
      branch: 'main',
      status: 'RUNNING',
      stage: 'PREPARING',
    });

    for (let attempt = 0; attempt < 50 && progress.status === 'RUNNING'; attempt += 1) {
      await wait(50);
      const result = await handleProjectControl(
        request('GET'),
        new URL(
          `http://agent/desktop/projects/project-one/git/push/progress?operationId=${progress.operationId}`,
        ),
        links,
      );
      progress = result?.body as GitPushProgress;
    }

    expect(progress).toMatchObject({
      branch: 'main',
      status: 'COMPLETED',
      stage: 'COMPLETED',
      percent: 100,
    });
    const remoteHead = await execFileAsync('git', ['--git-dir', remoteRoot, 'rev-parse', 'main']);
    expect(remoteHead.stdout.trim()).toMatch(/^[a-f0-9]{40}$/);
  });
});
