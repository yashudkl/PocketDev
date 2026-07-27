import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ExecutionTarget, SessionStatus } from '@prisma/client';
import type { PtyTokenClaims } from '@pocketdev/shared';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { PrismaService } from '../prisma/prisma.service';

const DESKTOP_PTY_PATH = '/desktop/pty';
const RESERVED_CLOSE_CODES = new Set([1004, 1005, 1006, 1015]);

function safeCloseCode(code: number, fallback: number): number {
  const validProtocolCode = code >= 1000 && code <= 1014 && !RESERVED_CLOSE_CODES.has(code);
  const validApplicationCode = code >= 3000 && code <= 4999;
  return validProtocolCode || validApplicationCode ? code : fallback;
}

@Injectable()
export class DesktopPtyGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DesktopPtyGateway.name);
  private readonly wss = new WebSocketServer({ noServer: true });
  private httpServer?: HttpServer;
  private readonly upgradeListener = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void => {
    void this.handleUpgrade(request, socket, head);
  };

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.httpServer = this.adapterHost.httpAdapter?.getHttpServer();
    if (!this.httpServer) {
      this.logger.warn('No HTTP server available; desktop PTY proxy disabled');
      return;
    }
    this.httpServer.on('upgrade', this.upgradeListener);
    this.logger.log(`Desktop PTY proxy listening on ws://…${DESKTOP_PTY_PATH}`);
  }

  onModuleDestroy(): void {
    this.httpServer?.off('upgrade', this.upgradeListener);
    this.wss.close();
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== DESKTOP_PTY_PATH) return;

    const claims = this.verify(url.searchParams.get('token'));
    if (!claims || !(await this.sessionIsActive(claims))) {
      this.reject(socket, 401, 'Unauthorized');
      return;
    }

    const upstreamUrl = await this.desktopUrl(claims.sub, claims.projectId);
    if (!upstreamUrl) {
      this.reject(socket, 503, 'Desktop unavailable');
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (client) => {
      this.proxy(client, upstreamUrl);
    });
  }

  private verify(token: string | null): PtyTokenClaims | null {
    if (!token) return null;
    try {
      const claims = this.jwt.verify<PtyTokenClaims>(token);
      return claims.scope === 'pty' ? claims : null;
    } catch {
      return null;
    }
  }

  private async sessionIsActive(claims: PtyTokenClaims): Promise<boolean> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: claims.sessionId,
        userId: claims.sub,
        projectId: claims.projectId,
        target: ExecutionTarget.DESKTOP,
        status: SessionStatus.ACTIVE,
      },
      select: { id: true },
    });
    return !!session;
  }

  private async desktopUrl(userId: string, projectId: string): Promise<string | null> {
    const presence = await this.prisma.desktopPresence.findUnique({ where: { userId } });
    const windowMs = this.config.get<number>('execution.desktopHeartbeatWindowMs') ?? 30_000;
    const linked =
      (Array.isArray(presence?.linkedProjects) &&
        presence.linkedProjects.some(
          (link) =>
            typeof link === 'object' &&
            link !== null &&
            !Array.isArray(link) &&
            link.projectId === projectId,
        )) ||
      presence?.projectId === projectId;
    if (
      !presence?.online ||
      !presence.tunnelUrl ||
      !linked ||
      Date.now() - presence.lastHeartbeat.getTime() >= windowMs
    ) {
      return null;
    }
    const url = new URL(presence.tunnelUrl);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return null;
    return url.toString();
  }

  private proxy(client: WebSocket, upstreamUrl: string): void {
    const upstream = new WebSocket(upstreamUrl);
    const pending: Array<{ data: RawData; isBinary: boolean }> = [];
    let upstreamOpen = false;

    client.on('message', (data, isBinary) => {
      if (upstreamOpen && upstream.readyState === WebSocket.OPEN) {
        upstream.send(data, { binary: isBinary });
      } else {
        pending.push({ data, isBinary });
      }
    });

    upstream.on('open', () => {
      upstreamOpen = true;
      for (const message of pending.splice(0)) {
        upstream.send(message.data, { binary: message.isBinary });
      }
    });
    upstream.on('message', (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });
    upstream.on('close', (code, reason) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(safeCloseCode(code, 1000), reason.toString().slice(0, 120));
      }
    });
    upstream.on('error', (error) => {
      this.logger.warn(`desktop PTY upstream error: ${error.message}`);
      if (client.readyState === WebSocket.OPEN) {
        client.close(1011, 'Could not connect to the desktop agent');
      }
    });
    client.on('close', (code, reason) => {
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close(safeCloseCode(code, 1000), reason.toString().slice(0, 120));
      }
    });
    client.on('error', () => upstream.close());
  }

  private reject(socket: Duplex, status: number, message: string): void {
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  }
}
