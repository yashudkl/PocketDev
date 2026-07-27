import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  parseGitPushProgressLine,
  type FileContent,
  type FileNode,
  type GitBranchInfo,
  type GitCommitResult,
  type GitDiffResult,
  type GitLogEntry,
  type GitPushProgress,
  type GitStatusResult,
  type WriteFileResult,
} from '@pocketdev/shared';
import type { DesktopLinks } from './desktop-control';

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', '.expo', '.turbo']);
const MAX_EDITABLE_BYTES = 2 * 1024 * 1024;
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_GIT_OUTPUT_BYTES = 10 * 1024 * 1024;
const PUSH_OPERATION_RETENTION_MS = 10 * 60 * 1000;

interface ProjectRoute {
  projectId: string;
  action: string;
}

interface WriteFileBody {
  path?: string;
  content?: string;
  createOnly?: boolean;
}

interface GitBody {
  message?: string;
  url?: string;
}

interface DesktopGitPushOperation extends GitPushProgress {
  root: string;
  recentOutput: string;
  remainder: string;
}

const gitPushOperations = new Map<string, DesktopGitPushOperation>();

export interface ProjectControlResult {
  status: number;
  body: unknown;
}

function parseProjectRoute(pathname: string): ProjectRoute | null {
  const prefix = '/desktop/projects/';
  if (!pathname.startsWith(prefix)) return null;
  const segments = pathname
    .slice(prefix.length)
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const projectId = segments.shift();
  if (!projectId || segments.length === 0) return null;
  return { projectId, action: segments.join('/') };
}

function safeProjectPath(root: string, input: string): string {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || isAbsolute(input) || isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`Illegal path: ${input}`);
  }
  const absolute = resolve(root, normalized);
  const relation = relative(root, absolute);
  if (
    !relation ||
    relation.startsWith('..') ||
    relation.split(sep).includes('..') ||
    isAbsolute(relation)
  ) {
    throw new Error(`Illegal path: ${input}`);
  }
  return absolute;
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {} as T;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

async function fileTree(root: string): Promise<FileNode> {
  return {
    name: '',
    path: '',
    type: 'dir',
    children: await walkFiles(root, root),
  };
}

async function walkFiles(root: string, directory: string): Promise<FileNode[]> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    const path = relative(root, absolute).split(sep).join('/');
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path,
        type: 'dir',
        children: await walkFiles(root, absolute),
      });
    } else if (entry.isFile()) {
      const stat = await fs.stat(absolute).catch(() => null);
      nodes.push({ name: entry.name, path, type: 'file', size: stat?.size ?? 0 });
    }
  }
  nodes.sort((left, right) => {
    if (left.type !== right.type) return left.type === 'dir' ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
  return nodes;
}

async function readFile(root: string, path: string): Promise<FileContent> {
  const absolute = safeProjectPath(root, path);
  const stat = await fs.stat(absolute).catch(() => null);
  if (!stat?.isFile()) throw new Error(`File not found: ${path}`);
  if (stat.size > MAX_EDITABLE_BYTES) {
    throw new Error(`File too large to edit (${stat.size} bytes)`);
  }
  const content = await fs.readFile(absolute);
  if (content.includes(0)) throw new Error('Binary file is not editable');
  return { path, content: content.toString('utf8'), encoding: 'utf-8', size: stat.size };
}

async function writeFile(root: string, body: WriteFileBody): Promise<WriteFileResult> {
  if (!body.path || typeof body.content !== 'string') {
    throw new Error('File path and content are required.');
  }
  const absolute = safeProjectPath(root, body.path);
  await fs.mkdir(dirname(absolute), { recursive: true });
  const content = Buffer.from(body.content, 'utf8');
  try {
    await fs.writeFile(absolute, content, body.createOnly ? { flag: 'wx' } : undefined);
  } catch (error) {
    if (
      body.createOnly &&
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'EEXIST'
    ) {
      throw new Error(`File already exists: ${body.path}`);
    }
    throw error;
  }
  return { path: body.path, size: content.byteLength, written: true };
}

function runGit(root: string, args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      'git',
      args,
      {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: MAX_GIT_OUTPUT_BYTES,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(String(stderr || error.message).trim()));
          return;
        }
        resolvePromise(stdout);
      },
    );
  });
}

function publicPushProgress(operation: DesktopGitPushOperation): GitPushProgress {
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

function applyPushOutput(operation: DesktopGitPushOperation, chunk: string): void {
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

function pushFailureMessage(operation: DesktopGitPushOperation): string {
  const lines = `${operation.recentOutput}${operation.remainder}`
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(-6).join('\n').slice(-1_500) || 'Git push failed.';
}

function retainPushOperation(operationId: string): void {
  const timer = setTimeout(
    () => gitPushOperations.delete(operationId),
    PUSH_OPERATION_RETENTION_MS,
  );
  timer.unref();
}

async function startGitPush(root: string): Promise<GitPushProgress> {
  await requireGitRepository(root);
  const running = [...gitPushOperations.values()].find(
    (operation) => operation.root === root && operation.status === 'RUNNING',
  );
  if (running) return publicPushProgress(running);

  const branch = (await runGit(root, ['branch', '--show-current'])).trim() || 'main';
  const now = new Date().toISOString();
  const operation: DesktopGitPushOperation = {
    operationId: randomUUID(),
    root,
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
  gitPushOperations.set(operation.operationId, operation);

  const child = spawn('git', ['push', '--progress', '--set-upstream', 'origin', branch], {
    cwd: root,
    windowsHide: true,
  });
  child.stdout.on('data', (data: Buffer | string) => applyPushOutput(operation, String(data)));
  child.stderr.on('data', (data: Buffer | string) => applyPushOutput(operation, String(data)));
  child.on('error', (error) => {
    if (operation.status !== 'RUNNING') return;
    operation.status = 'FAILED';
    operation.stage = 'FAILED';
    operation.message = 'Push could not be started';
    operation.error = error.message;
    operation.updatedAt = new Date().toISOString();
    retainPushOperation(operation.operationId);
  });
  child.on('close', (exitCode) => {
    if (operation.remainder) applyPushOutput(operation, '\n');
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
      operation.error = pushFailureMessage(operation);
    }
    retainPushOperation(operation.operationId);
  });

  return publicPushProgress(operation);
}

function gitPushProgress(root: string, operationId: string): GitPushProgress {
  const operation = gitPushOperations.get(operationId);
  if (!operation || operation.root !== root) {
    throw new Error('Git push operation was not found.');
  }
  return publicPushProgress(operation);
}

async function isGitRepository(root: string): Promise<boolean> {
  try {
    return (await runGit(root, ['rev-parse', '--is-inside-work-tree'])).trim() === 'true';
  } catch {
    return false;
  }
}

async function requireGitRepository(root: string): Promise<void> {
  if (!(await isGitRepository(root))) {
    throw new Error('Not a git repository — run git init first');
  }
}

async function gitRemote(root: string): Promise<string | null> {
  try {
    return (await runGit(root, ['remote', 'get-url', 'origin'])).trim() || null;
  } catch {
    return null;
  }
}

async function gitStatus(root: string): Promise<GitStatusResult> {
  await requireGitRepository(root);
  const output = await runGit(root, ['status', '--porcelain=v1', '--branch']);
  const lines = output.split(/\r?\n/).filter(Boolean);
  const header = lines.shift() ?? '## HEAD';
  const branchMatch = header.match(/^## (?:No commits yet on )?(.+?)(?:\.\.\.|$)/);
  const branch = branchMatch?.[1]?.trim() || 'HEAD';
  const ahead = Number(header.match(/ahead (\d+)/)?.[1] ?? 0);
  const behind = Number(header.match(/behind (\d+)/)?.[1] ?? 0);
  const files = lines.map((line) => ({
    path: line.slice(3).replace(/^"|"$/g, ''),
    status: line.slice(0, 2).trim() || '?',
    staged: line[0] !== ' ' && line[0] !== '?',
  }));
  return {
    branch,
    remoteUrl: await gitRemote(root),
    ahead,
    behind,
    clean: files.length === 0,
    files,
  };
}

async function gitLog(root: string): Promise<GitLogEntry[]> {
  await requireGitRepository(root);
  try {
    await runGit(root, ['rev-parse', '--verify', 'HEAD']);
  } catch {
    return [];
  }
  const output = await runGit(root, [
    'log',
    '-50',
    '--date=iso-strict',
    '--pretty=format:%H%x1f%an%x1f%aI%x1f%s%x1e',
  ]);
  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash = '', author = '', date = '', message = ''] = record.split('\x1f');
      return { hash: hash.slice(0, 8), author, date, message };
    });
}

async function gitBranches(root: string): Promise<GitBranchInfo> {
  await requireGitRepository(root);
  const output = await runGit(root, ['branch', '--format=%(HEAD)%09%(refname:short)']);
  const entries = output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [marker = '', name = ''] = line.split('\t');
      return { current: marker.trim() === '*', name };
    });
  return {
    current: entries.find((entry) => entry.current)?.name ?? 'HEAD',
    all: entries.map((entry) => entry.name),
  };
}

async function gitInit(root: string): Promise<{ initialized: true; branch: string }> {
  if (!(await isGitRepository(root))) {
    await runGit(root, ['init', '--initial-branch=main']);
    await runGit(root, ['config', 'user.name', 'PocketDev']);
    await runGit(root, ['config', 'user.email', 'pocketdev@local']);
  }
  const branch = (await runGit(root, ['branch', '--show-current'])).trim() || 'main';
  return { initialized: true, branch };
}

async function setGitRemote(root: string, url: string): Promise<{ remote: string }> {
  await requireGitRepository(root);
  if (!url.trim()) throw new Error('Remote URL is required.');
  if (await gitRemote(root)) {
    await runGit(root, ['remote', 'set-url', 'origin', url]);
  } else {
    await runGit(root, ['remote', 'add', 'origin', url]);
  }
  return { remote: url };
}

async function gitCommit(root: string, message: string): Promise<GitCommitResult> {
  await requireGitRepository(root);
  if (!message.trim()) throw new Error('Commit message is required.');
  await runGit(root, ['add', '--all']);
  await runGit(root, ['commit', '-m', message]);
  const [commit, branch, summary] = await Promise.all([
    runGit(root, ['rev-parse', '--short', 'HEAD']),
    runGit(root, ['branch', '--show-current']),
    runGit(root, ['show', '--stat', '--oneline', '--format=', 'HEAD']),
  ]);
  return {
    commit: commit.trim(),
    branch: branch.trim() || 'HEAD',
    summary: summary.trim() || 'Commit created',
  };
}

async function handleGit(
  request: IncomingMessage,
  url: URL,
  root: string,
  action: string,
): Promise<unknown> {
  if (request.method === 'GET' && action === 'git/status') return gitStatus(root);
  if (request.method === 'GET' && action === 'git/log') return gitLog(root);
  if (request.method === 'GET' && action === 'git/branches') return gitBranches(root);
  if (request.method === 'GET' && action === 'git/diff') {
    await requireGitRepository(root);
    const path = url.searchParams.get('path') || undefined;
    const diff = await runGit(root, path ? ['diff', '--', path] : ['diff']);
    return { path, diff } satisfies GitDiffResult;
  }
  if (request.method === 'POST' && action === 'git/init') return gitInit(root);
  if (request.method === 'POST' && action === 'git/remote') {
    const body = await readJson<GitBody>(request);
    return setGitRemote(root, body.url ?? '');
  }
  if (request.method === 'POST' && action === 'git/commit') {
    const body = await readJson<GitBody>(request);
    return gitCommit(root, body.message ?? '');
  }
  if (request.method === 'POST' && action === 'git/push') {
    await requireGitRepository(root);
    const branch = (await runGit(root, ['branch', '--show-current'])).trim() || 'main';
    await runGit(root, ['push', '--set-upstream', 'origin', branch]);
    return { pushed: true, branch };
  }
  if (request.method === 'POST' && action === 'git/push/start') {
    return startGitPush(root);
  }
  if (request.method === 'GET' && action === 'git/push/progress') {
    const operationId = url.searchParams.get('operationId');
    if (!operationId) throw new Error('Push operation ID is required.');
    return gitPushProgress(root, operationId);
  }
  if (request.method === 'POST' && action === 'git/pull') {
    await requireGitRepository(root);
    await runGit(root, ['pull']);
    return { pulled: true };
  }
  throw new Error('Desktop project operation was not found.');
}

export async function handleProjectControl(
  request: IncomingMessage,
  url: URL,
  links: DesktopLinks,
): Promise<ProjectControlResult | null> {
  const route = parseProjectRoute(url.pathname);
  if (!route) return null;
  const root = links.rootFor(route.projectId);
  if (!root) throw new Error('This project is not linked to a desktop folder.');

  if (request.method === 'GET' && route.action === 'files') {
    return { status: 200, body: await fileTree(root) };
  }
  if (request.method === 'GET' && route.action === 'file') {
    const path = url.searchParams.get('path');
    if (!path) throw new Error('File path is required.');
    return { status: 200, body: await readFile(root, path) };
  }
  if (request.method === 'PUT' && route.action === 'file') {
    return { status: 200, body: await writeFile(root, await readJson(request)) };
  }
  if (request.method === 'DELETE' && route.action === 'file') {
    const path = url.searchParams.get('path');
    if (!path) throw new Error('File path is required.');
    await fs.rm(safeProjectPath(root, path), { recursive: true, force: true });
    return { status: 200, body: { deleted: true } };
  }
  if (route.action.startsWith('git/')) {
    return { status: 200, body: await handleGit(request, url, root, route.action) };
  }
  throw new Error('Desktop project operation was not found.');
}
