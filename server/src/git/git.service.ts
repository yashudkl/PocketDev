import { BadRequestException, Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import simpleGit, { type SimpleGit } from 'simple-git';
import {
  parseGitPushProgressLine,
  type GitBranchInfo,
  type GitCommitResult,
  type GitDiffResult,
  type GitLogEntry,
  type GitPushProgress,
  type GitStatusResult,
} from '@pocketdev/shared';
import { DesktopService } from '../desktop/desktop.service';
import { FileStoreService } from '../files/file-store.service';

const PUSH_OPERATION_RETENTION_MS = 10 * 60 * 1000;

interface LocalGitPushOperation extends GitPushProgress {
  userId: string;
  projectId: string;
  recentOutput: string;
  remainder: string;
}

/**
 * Git-from-the-phone (BUILD-PLAN Weeks 11–12 / Definition of Done: "a commit can
 * be pushed"). Runs git against the project's synced file store directory.
 * Push/pull against a real remote needs credentials configured on the host
 * (HTTPS token or SSH key) — that's an environment concern the demo sets up.
 */
@Injectable()
export class GitService {
  private readonly pushOperations = new Map<string, LocalGitPushOperation>();

  constructor(
    private readonly files: FileStoreService,
    private readonly desktop: DesktopService,
  ) {}

  private async git(userId: string, projectId: string): Promise<SimpleGit> {
    const dir = this.files.projectDir(userId, projectId);
    await fs.mkdir(dir, { recursive: true });
    // CRITICAL isolation: the file store may live inside another git repo (e.g.
    // during local dev the store is under the PocketDev checkout). Git normally
    // walks UP to the nearest .git, which would make every project operate on the
    // wrong repo. GIT_CEILING_DIRECTORIES stops that upward search at the store,
    // so a project only ever uses its OWN .git (created by init()).
    return simpleGit(dir).env({ ...process.env, GIT_CEILING_DIRECTORIES: dirname(dir) });
  }

  private async requireRepo(git: SimpleGit): Promise<void> {
    if (!(await git.checkIsRepo())) {
      throw new BadRequestException('Not a git repository — run git init first');
    }
  }

  private wrap<T>(p: Promise<T>): Promise<T> {
    return p.catch((err: Error) => {
      throw new BadRequestException(err.message.trim());
    });
  }

  private publicPushProgress(operation: LocalGitPushOperation): GitPushProgress {
    return {
      operationId: operation.operationId,
      branch: operation.branch,
      status: operation.status,
      stage: operation.stage,
      percent: operation.percent,
      message: operation.message,
      startedAt: operation.startedAt,
      updatedAt: operation.updatedAt,
      ...(operation.error ? { error: operation.error } : {}),
    };
  }

  private applyPushOutput(operation: LocalGitPushOperation, chunk: string): void {
    operation.recentOutput = `${operation.recentOutput}${chunk}`.slice(-8_000);
    const lines = `${operation.remainder}${chunk}`.split(/[\r\n]+/);
    operation.remainder = lines.pop() ?? '';
    for (const line of lines) {
      const parsed = parseGitPushProgressLine(line);
      if (!parsed || parsed.percent < operation.percent) continue;
      operation.stage = parsed.stage;
      operation.percent = parsed.percent;
      operation.message = parsed.message;
      operation.updatedAt = new Date().toISOString();
    }
  }

  private pushFailureMessage(operation: LocalGitPushOperation): string {
    const lines = `${operation.recentOutput}${operation.remainder}`
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.slice(-6).join('\n').slice(-1_500) || 'Git push failed.';
  }

  private retainPushOperation(operationId: string): void {
    const timer = setTimeout(
      () => this.pushOperations.delete(operationId),
      PUSH_OPERATION_RETENTION_MS,
    );
    timer.unref();
  }

  private async startLocalPush(userId: string, projectId: string): Promise<GitPushProgress> {
    const existing = [...this.pushOperations.values()].find(
      (operation) =>
        operation.userId === userId &&
        operation.projectId === projectId &&
        operation.status === 'RUNNING',
    );
    if (existing) return this.publicPushProgress(existing);

    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const branch = (await git.status()).current ?? 'main';
    const now = new Date().toISOString();
    const operation: LocalGitPushOperation = {
      operationId: randomUUID(),
      userId,
      projectId,
      branch,
      status: 'RUNNING',
      stage: 'PREPARING',
      percent: 2,
      message: `Preparing ${branch} for push`,
      startedAt: now,
      updatedAt: now,
      recentOutput: '',
      remainder: '',
    };
    this.pushOperations.set(operation.operationId, operation);

    const dir = this.files.projectDir(userId, projectId);
    const child = spawn('git', ['push', '--progress', '--set-upstream', 'origin', branch], {
      cwd: dir,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_CEILING_DIRECTORIES: dirname(dir),
      },
    });
    child.stdout.on('data', (data: Buffer | string) =>
      this.applyPushOutput(operation, String(data)),
    );
    child.stderr.on('data', (data: Buffer | string) =>
      this.applyPushOutput(operation, String(data)),
    );
    child.on('error', (error) => {
      if (operation.status !== 'RUNNING') return;
      operation.status = 'FAILED';
      operation.stage = 'FAILED';
      operation.message = 'Push could not be started';
      operation.error = error.message;
      operation.updatedAt = new Date().toISOString();
      this.retainPushOperation(operation.operationId);
    });
    child.on('close', (exitCode) => {
      if (operation.remainder) this.applyPushOutput(operation, '\n');
      if (operation.status !== 'RUNNING') return;
      operation.updatedAt = new Date().toISOString();
      if (exitCode === 0) {
        operation.status = 'COMPLETED';
        operation.stage = 'COMPLETED';
        operation.percent = 100;
        operation.message = `Pushed ${branch} successfully`;
      } else {
        operation.status = 'FAILED';
        operation.stage = 'FAILED';
        operation.message = 'Push failed';
        operation.error = this.pushFailureMessage(operation);
      }
      this.retainPushOperation(operation.operationId);
    });

    return this.publicPushProgress(operation);
  }

  async init(userId: string, projectId: string): Promise<{ initialized: true; branch: string }> {
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/init', { method: 'POST' });
    }
    const git = await this.git(userId, projectId);
    if (!(await git.checkIsRepo())) {
      await this.wrap(git.init(['--initial-branch=main']));
      // Set a local identity so commits work even when the host has no global
      // git user configured (e.g. the demo VM).
      await git.addConfig('user.name', 'PocketDev', false, 'local').catch(() => undefined);
      await git.addConfig('user.email', 'pocketdev@local', false, 'local').catch(() => undefined);
    }
    const status = await git.status();
    return { initialized: true, branch: status.current ?? 'main' };
  }

  async setRemote(userId: string, projectId: string, url: string): Promise<{ remote: string }> {
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/remote', {
        method: 'POST',
        body: { url },
      });
    }
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const remotes = await git.getRemotes();
    if (remotes.some((r) => r.name === 'origin')) {
      await this.wrap(git.remote(['set-url', 'origin', url]));
    } else {
      await this.wrap(git.addRemote('origin', url));
    }
    return { remote: url };
  }

  async status(userId: string, projectId: string): Promise<GitStatusResult> {
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/status');
    }
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const [s, remotes] = await Promise.all([git.status(), git.getRemotes(true)]);
    const origin = remotes.find((remote) => remote.name === 'origin');
    return {
      branch: s.current ?? 'HEAD',
      remoteUrl: origin?.refs.fetch ?? origin?.refs.push ?? null,
      ahead: s.ahead,
      behind: s.behind,
      clean: s.isClean(),
      files: s.files.map((f) => ({
        path: f.path,
        status: `${f.index}${f.working_dir}`.trim() || '?',
        staged: f.index !== ' ' && f.index !== '?',
      })),
    };
  }

  async commit(userId: string, projectId: string, message: string): Promise<GitCommitResult> {
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/commit', {
        method: 'POST',
        body: { message },
      });
    }
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    await this.wrap(git.add('.'));
    const res = await this.wrap(git.commit(message));
    const status = await git.status();
    return {
      commit: res.commit || '(no changes)',
      branch: status.current ?? 'main',
      summary: `${res.summary.changes} changed, ${res.summary.insertions}+, ${res.summary.deletions}-`,
    };
  }

  async push(userId: string, projectId: string): Promise<{ pushed: true; branch: string }> {
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/push', { method: 'POST' });
    }
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const branch = (await git.status()).current ?? 'main';
    await this.wrap(git.push(['-u', 'origin', branch]));
    return { pushed: true, branch };
  }

  async startPush(userId: string, projectId: string): Promise<GitPushProgress> {
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/push/start', { method: 'POST' });
    }
    return this.startLocalPush(userId, projectId);
  }

  async pushProgress(
    userId: string,
    projectId: string,
    operationId: string,
  ): Promise<GitPushProgress> {
    const local = this.pushOperations.get(operationId);
    if (local) {
      if (local.userId !== userId || local.projectId !== projectId) {
        throw new BadRequestException('Git push operation was not found.');
      }
      return this.publicPushProgress(local);
    }
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/push/progress', {
        query: { operationId },
      });
    }
    throw new BadRequestException('Git push operation was not found.');
  }

  async pull(userId: string, projectId: string): Promise<{ pulled: true }> {
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/pull', { method: 'POST' });
    }
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    await this.wrap(git.pull());
    return { pulled: true };
  }

  async log(userId: string, projectId: string): Promise<GitLogEntry[]> {
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/log');
    }
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const res = await this.wrap(git.log({ maxCount: 50 }));
    return res.all.map((c) => ({
      hash: c.hash.slice(0, 8),
      message: c.message,
      author: c.author_name,
      date: c.date,
    }));
  }

  async branches(userId: string, projectId: string): Promise<GitBranchInfo> {
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/branches');
    }
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const b = await git.branchLocal();
    return { current: b.current, all: b.all };
  }

  async diff(userId: string, projectId: string, path?: string): Promise<GitDiffResult> {
    if (await this.desktop.projectAvailable(userId, projectId)) {
      return this.desktop.projectRequest(userId, projectId, 'git/diff', {
        query: { path },
      });
    }
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const args = path ? ['--', path] : [];
    const diff = await this.wrap(git.diff(args));
    return { path, diff };
  }
}
