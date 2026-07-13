import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import simpleGit, { type SimpleGit } from 'simple-git';
import type {
  GitBranchInfo,
  GitCommitResult,
  GitDiffResult,
  GitLogEntry,
  GitStatusResult,
} from '@pocketdev/shared';
import { FileStoreService } from '../files/file-store.service';

/**
 * Git-from-the-phone (BUILD-PLAN Weeks 11–12 / Definition of Done: "a commit can
 * be pushed"). Runs git against the project's synced file store directory.
 * Push/pull against a real remote needs credentials configured on the host
 * (HTTPS token or SSH key) — that's an environment concern the demo sets up.
 */
@Injectable()
export class GitService {
  constructor(private readonly files: FileStoreService) {}

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

  async init(userId: string, projectId: string): Promise<{ initialized: true; branch: string }> {
    const git = await this.git(userId, projectId);
    if (!(await git.checkIsRepo())) {
      await this.wrap(git.init(['--initial-branch=main']));
      // Set a local identity so commits work even when the host has no global
      // git user configured (e.g. the demo VM).
      await git.addConfig('user.name', 'PocketDev', false, 'local').catch(() => undefined);
      await git
        .addConfig('user.email', 'pocketdev@local', false, 'local')
        .catch(() => undefined);
    }
    const status = await git.status();
    return { initialized: true, branch: status.current ?? 'main' };
  }

  async setRemote(userId: string, projectId: string, url: string): Promise<{ remote: string }> {
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
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const s = await git.status();
    return {
      branch: s.current ?? 'HEAD',
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

  async commit(
    userId: string,
    projectId: string,
    message: string,
  ): Promise<GitCommitResult> {
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
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const branch = (await git.status()).current ?? 'main';
    await this.wrap(git.push(['-u', 'origin', branch]));
    return { pushed: true, branch };
  }

  async pull(userId: string, projectId: string): Promise<{ pulled: true }> {
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    await this.wrap(git.pull());
    return { pulled: true };
  }

  async log(userId: string, projectId: string): Promise<GitLogEntry[]> {
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
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const b = await git.branchLocal();
    return { current: b.current, all: b.all };
  }

  async diff(userId: string, projectId: string, path?: string): Promise<GitDiffResult> {
    const git = await this.git(userId, projectId);
    await this.requireRepo(git);
    const args = path ? ['--', path] : [];
    const diff = await this.wrap(git.diff(args));
    return { path, diff };
  }
}
