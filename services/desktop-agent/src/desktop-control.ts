import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path';
import type {
  DesktopDirectoryEntry,
  DesktopDirectoryListing,
  DesktopLinkResult,
  DesktopProjectLink,
} from '@pocketdev/shared';
import jwt from 'jsonwebtoken';
import { handleProjectControl } from './project-control';

interface ControlClaims {
  sub?: string;
  scope?: string;
}

interface LinkRequest {
  projectId?: string;
  path?: string;
}

interface SavedLinks {
  links?: DesktopProjectLink[];
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function directoryExists(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function driveEntries(): DesktopDirectoryEntry[] {
  if (process.platform !== 'win32') {
    return [{ name: 'File system', path: '/', kind: 'drive', hasGit: false }];
  }

  const entries: DesktopDirectoryEntry[] = [];
  for (let code = 65; code <= 90; code += 1) {
    const path = `${String.fromCharCode(code)}:\\`;
    if (directoryExists(path)) {
      entries.push({
        name: `${String.fromCharCode(code)}: drive`,
        path,
        kind: 'drive',
        hasGit: false,
      });
    }
  }
  return entries;
}

function parentOf(path: string): string | null {
  const parsed = parse(path);
  const parent = dirname(path);
  return parent === path || path === parsed.root ? null : parent;
}

function displayName(path: string): string {
  return basename(path) || parse(path).root || path;
}

function listDirectory(inputPath?: string): DesktopDirectoryListing {
  if (!inputPath) {
    return {
      path: null,
      name: process.platform === 'win32' ? 'This PC' : 'Computer',
      parentPath: null,
      entries: driveEntries(),
    };
  }
  if (!isAbsolute(inputPath)) {
    throw new Error('Choose an absolute desktop path.');
  }

  const path = realpathSync(resolve(inputPath));
  if (!statSync(path).isDirectory()) {
    throw new Error('The selected path is not a directory.');
  }

  const entries = readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .slice(0, 500)
    .map<DesktopDirectoryEntry>((entry) => {
      const childPath = join(path, entry.name);
      return {
        name: entry.name,
        path: childPath,
        kind: 'directory',
        hasGit: existsSync(join(childPath, '.git')),
      };
    })
    .sort((left, right) => {
      if (left.hasGit !== right.hasGit) return left.hasGit ? -1 : 1;
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });

  return {
    path,
    name: displayName(path),
    parentPath: parentOf(path),
    entries,
  };
}

async function readBody(request: IncomingMessage): Promise<LinkRequest> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 16 * 1024) {
      throw new Error('Request body is too large.');
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as LinkRequest;
}

export class DesktopLinks {
  private readonly roots = new Map<string, string>();

  constructor(
    private readonly stateFile: string,
    initial?: DesktopProjectLink,
  ) {
    this.load();
    if (initial?.projectId && directoryExists(initial.projectRoot)) {
      this.roots.set(initial.projectId, realpathSync(initial.projectRoot));
    }
  }

  list(): DesktopProjectLink[] {
    return [...this.roots.entries()].map(([projectId, projectRoot]) => ({
      projectId,
      projectRoot,
    }));
  }

  rootFor(projectId: string): string | null {
    return this.roots.get(projectId) ?? null;
  }

  link(projectId: string, inputPath: string): DesktopLinkResult {
    if (!projectId.trim()) throw new Error('Project ID is required.');
    if (!isAbsolute(inputPath)) throw new Error('Choose an absolute desktop path.');

    const projectRoot = realpathSync(resolve(inputPath));
    if (!statSync(projectRoot).isDirectory()) {
      throw new Error('The selected path is not a directory.');
    }
    this.roots.set(projectId, projectRoot);
    this.save();
    return {
      projectId,
      projectRoot,
      name: displayName(projectRoot),
    };
  }

  private load(): void {
    if (!existsSync(this.stateFile)) return;
    try {
      const saved = JSON.parse(readFileSync(this.stateFile, 'utf8')) as SavedLinks;
      for (const link of saved.links ?? []) {
        if (
          typeof link.projectId === 'string' &&
          typeof link.projectRoot === 'string' &&
          directoryExists(link.projectRoot)
        ) {
          this.roots.set(link.projectId, realpathSync(link.projectRoot));
        }
      }
    } catch (error) {
      console.warn(`[desktop-agent] could not load linked folders: ${(error as Error).message}`);
    }
  }

  private save(): void {
    mkdirSync(dirname(this.stateFile), { recursive: true });
    writeFileSync(this.stateFile, JSON.stringify({ links: this.list() }, null, 2), 'utf8');
  }
}

export function createDesktopControlHandler(options: {
  jwtSecret: string;
  ownerId: string | null;
  links: DesktopLinks;
}): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://desktop-agent.local');
    if (!url.pathname.startsWith('/desktop/')) {
      json(response, 404, { error: 'Not found' });
      return;
    }

    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    let claims: ControlClaims | null = null;
    try {
      claims = token ? (jwt.verify(token, options.jwtSecret) as ControlClaims) : null;
    } catch {
      claims = null;
    }
    if (
      !claims ||
      claims.scope !== 'desktop-control' ||
      !options.ownerId ||
      claims.sub !== options.ownerId
    ) {
      json(response, 401, { error: 'Unauthorized' });
      return;
    }

    if (url.pathname.startsWith('/desktop/projects/')) {
      try {
        const result = await handleProjectControl(request, url, options.links);
        if (result) {
          json(response, result.status, result.body);
          return;
        }
      } catch (error) {
        json(response, 400, { error: (error as Error).message });
        return;
      }
    }

    if (request.method === 'GET' && url.pathname === '/desktop/browse') {
      try {
        json(response, 200, listDirectory(url.searchParams.get('path') || undefined));
      } catch (error) {
        json(response, 400, { error: (error as Error).message });
      }
      return;
    }

    if (request.method === 'POST' && url.pathname === '/desktop/link') {
      try {
        const body = await readBody(request);
        if (!body.projectId || !body.path) {
          json(response, 400, { error: 'Project ID and path are required.' });
          return;
        }
        json(response, 200, options.links.link(body.projectId, body.path));
      } catch (error) {
        json(response, 400, { error: (error as Error).message });
      }
      return;
    }

    json(response, 404, { error: 'Not found' });
  };
}
