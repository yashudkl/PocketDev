import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { FileManifest, FileNode } from '@pocketdev/shared';

/** Never walk into (or serve a tree of) these — matches the CLI agent's ignore list. */
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', '.expo', '.turbo']);
/** Files bigger than this aren't served to the editor (treated as non-text). */
const MAX_EDITABLE_BYTES = 2 * 1024 * 1024;

/**
 * Owns the on-disk store where the CLI agent's synced project files land
 * (BUILD-PLAN Weeks 3–4). Every project gets an isolated directory
 * `${FILE_STORE_ROOT}/${userId}/${projectId}`. All caller-supplied paths are
 * resolved and confirmed to stay inside that directory — no `..` traversal.
 */
@Injectable()
export class FileStoreService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('fileStore.root') ?? './.pocketdev-store');
  }

  /** Absolute directory for a project's files (created on demand). */
  projectDir(userId: string, projectId: string): string {
    return join(this.root, userId, projectId);
  }

  /**
   * Resolve a project-relative path to an absolute path, rejecting anything that
   * escapes the project directory (path traversal / absolute paths).
   */
  private safeResolve(projectRoot: string, relPath: string): string {
    const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    // Reject anything absolute or drive-qualified BEFORE resolving. On Windows,
    // path.relative() between different drives returns the absolute target
    // (e.g. "D:\evil"), which contains no ".." and would otherwise slip through.
    if (isAbsolute(relPath) || isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) {
      throw new BadRequestException(`Illegal path: ${relPath}`);
    }
    const abs = resolve(projectRoot, normalized);
    const rel = relative(projectRoot, abs);
    if (rel === '' || rel.startsWith('..') || rel.split(sep).includes('..') || isAbsolute(rel)) {
      throw new BadRequestException(`Illegal path: ${relPath}`);
    }
    return abs;
  }

  private async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  /** Write (or overwrite) a file from a UTF-8 string. Returns bytes written. */
  async writeText(userId: string, projectId: string, relPath: string, content: string): Promise<number> {
    const projectRoot = this.projectDir(userId, projectId);
    const abs = this.safeResolve(projectRoot, relPath);
    await this.ensureDir(dirname(abs));
    const buf = Buffer.from(content, 'utf-8');
    await fs.writeFile(abs, buf);
    return buf.byteLength;
  }

  /** Write (or overwrite) a file from base64 content (used by the sync gateway). */
  async writeBase64(userId: string, projectId: string, relPath: string, base64: string): Promise<number> {
    const projectRoot = this.projectDir(userId, projectId);
    const abs = this.safeResolve(projectRoot, relPath);
    await this.ensureDir(dirname(abs));
    const buf = Buffer.from(base64, 'base64');
    await fs.writeFile(abs, buf);
    return buf.byteLength;
  }

  /** Read a file as UTF-8 text; rejects oversized or binary files (editor use). */
  async readText(userId: string, projectId: string, relPath: string): Promise<{ content: string; size: number }> {
    const projectRoot = this.projectDir(userId, projectId);
    const abs = this.safeResolve(projectRoot, relPath);
    let stat;
    try {
      stat = await fs.stat(abs);
    } catch {
      throw new BadRequestException(`File not found: ${relPath}`);
    }
    if (!stat.isFile()) {
      throw new BadRequestException(`Not a file: ${relPath}`);
    }
    if (stat.size > MAX_EDITABLE_BYTES) {
      throw new BadRequestException(`File too large to edit (${stat.size} bytes)`);
    }
    const buf = await fs.readFile(abs);
    if (buf.includes(0)) {
      throw new BadRequestException('Binary file is not editable');
    }
    return { content: buf.toString('utf-8'), size: stat.size };
  }

  /** Delete a file (or empty dir). Idempotent. */
  async remove(userId: string, projectId: string, relPath: string): Promise<void> {
    const projectRoot = this.projectDir(userId, projectId);
    const abs = this.safeResolve(projectRoot, relPath);
    await fs.rm(abs, { recursive: true, force: true });
  }

  /** Build the project's file tree for the mobile browser (ignores junk dirs). */
  async tree(userId: string, projectId: string): Promise<FileNode> {
    const projectRoot = this.projectDir(userId, projectId);
    await this.ensureDir(projectRoot);
    const children = await this.walk(projectRoot, projectRoot);
    return { name: '', path: '', type: 'dir', children };
  }

  private async walk(projectRoot: string, dir: string): Promise<FileNode[]> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const nodes: FileNode[] = [];
    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      const abs = join(dir, entry.name);
      const relPath = relative(projectRoot, abs).split(sep).join('/');
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'dir',
          children: await this.walk(projectRoot, abs),
        });
      } else if (entry.isFile()) {
        let size = 0;
        try {
          size = (await fs.stat(abs)).size;
        } catch {
          /* ignore */
        }
        nodes.push({ name: entry.name, path: relPath, type: 'file', size });
      }
    }
    // Dirs first, then files, each alphabetical — stable ordering for the UI.
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return nodes;
  }

  /** Compute a manifest (path → size/mtime/hash) of what's currently on disk. */
  async computeManifest(userId: string, projectId: string): Promise<FileManifest> {
    const projectRoot = this.projectDir(userId, projectId);
    await this.ensureDir(projectRoot);
    const manifest: FileManifest = {};
    await this.collectManifest(projectRoot, projectRoot, manifest);
    return manifest;
  }

  private async collectManifest(projectRoot: string, dir: string, out: FileManifest): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        await this.collectManifest(projectRoot, join(dir, entry.name), out);
      } else if (entry.isFile()) {
        const abs = join(dir, entry.name);
        const relPath = relative(projectRoot, abs).split(sep).join('/');
        try {
          const stat = await fs.stat(abs);
          const hash = createHash('sha256').update(await fs.readFile(abs)).digest('hex');
          out[relPath] = { path: relPath, size: stat.size, mtimeMs: stat.mtimeMs, hash };
        } catch {
          /* ignore unreadable files */
        }
      }
    }
  }
}
