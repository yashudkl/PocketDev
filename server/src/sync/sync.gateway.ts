import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type {
  FileManifest,
  ManifestDiff,
  SyncClientMessage,
  SyncServerMessage,
} from '@pocketdev/shared';
import type { JwtPayload } from '../auth/jwt.strategy';
import { FileStoreService } from '../files/file-store.service';
import { ProjectsService } from '../projects/projects.service';

const SYNC_PATH = '/sync';

interface SyncConn {
  userId: string;
  /** projectId currently being synced on this socket (set by the `manifest` msg). */
  projectId?: string;
  /** The manifest the agent advertised; persisted verbatim once `done` arrives. */
  pendingManifest?: FileManifest;
}

/**
 * Raw-WebSocket ingestion endpoint (`/sync`) the CLI agent connects to
 * (BUILD-PLAN Weeks 3–4). Not a NestJS gateway abstraction — the wire protocol
 * is our own discriminated JSON (`SyncClientMessage`/`SyncServerMessage`), so we
 * attach a plain `ws` server to Nest's HTTP server and handle the upgrade
 * ourselves. Auth is a `?token=<jwt>` query param on the WS URL.
 */
@Injectable()
export class SyncGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncGateway.name);
  private wss?: WebSocketServer;
  private readonly conns = new WeakMap<WebSocket, SyncConn>();

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly jwt: JwtService,
    private readonly projects: ProjectsService,
    private readonly files: FileStoreService,
  ) {}

  onModuleInit(): void {
    const httpServer: HttpServer | undefined = this.adapterHost.httpAdapter?.getHttpServer();
    if (!httpServer) {
      this.logger.warn('No HTTP server available; sync gateway disabled');
      return;
    }
    this.wss = new WebSocketServer({ noServer: true });
    httpServer.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket, head));
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.logger.log(`Sync gateway listening on ws://…${SYNC_PATH}`);
  }

  onModuleDestroy(): void {
    this.wss?.close();
  }

  private handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const { pathname, token } = this.parseUrl(req);
    if (pathname !== SYNC_PATH) {
      return; // not ours — leave other upgrade handlers a chance, then it 404s
    }
    const userId = this.verify(token);
    if (!userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    this.wss!.handleUpgrade(req, socket, head, (ws) => {
      this.conns.set(ws, { userId });
      this.wss!.emit('connection', ws, req);
    });
  }

  private parseUrl(req: IncomingMessage): { pathname: string; token: string | null } {
    const url = new URL(req.url ?? '/', 'http://localhost');
    return { pathname: url.pathname, token: url.searchParams.get('token') };
  }

  private verify(token: string | null): string | null {
    if (!token) return null;
    try {
      return this.jwt.verify<JwtPayload>(token).sub;
    } catch {
      return null;
    }
  }

  private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    ws.on('message', (raw) => {
      void this.onMessage(ws, raw.toString());
    });
    ws.on('error', (err) => this.logger.warn(`sync socket error: ${err.message}`));
  }

  private send(ws: WebSocket, msg: SyncServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private async onMessage(ws: WebSocket, raw: string): Promise<void> {
    const conn = this.conns.get(ws);
    if (!conn) return;

    let msg: SyncClientMessage;
    try {
      msg = JSON.parse(raw) as SyncClientMessage;
    } catch {
      return;
    }

    try {
      switch (msg.type) {
        case 'manifest':
          await this.onManifest(ws, conn, msg.projectId, msg.manifest);
          break;
        case 'file':
          await this.onFile(ws, conn, msg.projectId, msg.path, msg.contentBase64);
          break;
        case 'removed':
          await this.onRemoved(conn, msg.projectId, msg.path);
          break;
        case 'done':
          await this.onDone(ws, conn, msg.projectId);
          break;
      }
    } catch (err) {
      this.logger.warn(`sync error: ${(err as Error).message}`);
      ws.close(1011, (err as Error).message);
    }
  }

  private async onManifest(
    ws: WebSocket,
    conn: SyncConn,
    projectId: string,
    clientManifest: FileManifest,
  ): Promise<void> {
    // Ownership check (throws ForbiddenException/NotFound if not the caller's).
    const project = await this.projects.findOne(conn.userId, projectId);
    conn.projectId = projectId;
    conn.pendingManifest = clientManifest;

    const serverManifest = (project.manifest as FileManifest | null) ?? {};
    const diff = this.computeDiff(serverManifest, clientManifest);
    this.send(ws, { type: 'diff', projectId, diff });
  }

  /** changed = new-or-hash-differs on the client; removed = gone from the client. */
  private computeDiff(server: FileManifest, client: FileManifest): ManifestDiff {
    const changed: string[] = [];
    for (const [path, entry] of Object.entries(client)) {
      const prev = server[path];
      if (!prev || prev.hash !== entry.hash) {
        changed.push(path);
      }
    }
    const removed = Object.keys(server).filter((path) => !(path in client));
    return { changed, removed };
  }

  private assertProject(conn: SyncConn, projectId: string): void {
    if (conn.projectId !== projectId) {
      throw new Error('Send a `manifest` for this project before file operations');
    }
  }

  private async onFile(
    ws: WebSocket,
    conn: SyncConn,
    projectId: string,
    path: string,
    contentBase64: string,
  ): Promise<void> {
    this.assertProject(conn, projectId);
    await this.files.writeBase64(conn.userId, projectId, path, contentBase64);
    this.send(ws, { type: 'ack', projectId, path });
  }

  private async onRemoved(conn: SyncConn, projectId: string, path: string): Promise<void> {
    this.assertProject(conn, projectId);
    await this.files.remove(conn.userId, projectId, path);
  }

  private async onDone(ws: WebSocket, conn: SyncConn, projectId: string): Promise<void> {
    this.assertProject(conn, projectId);
    // Persist the post-sync manifest to the JSONB column (Decision 1) so the
    // next sync only transfers deltas.
    const manifest = conn.pendingManifest ?? {};
    await this.projects.updateManifest(conn.userId, projectId, manifest as object);
    this.send(ws, { type: 'synced', projectId });
  }
}
