import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import { JwtService } from '@nestjs/jwt';
import { WebSocket, WebSocketServer } from 'ws';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DesktopPtyGateway } from '../server/src/desktop/desktop-pty.gateway';

describe('desktop PTY proxy', () => {
  let apiServer: Server;
  let upstream: WebSocketServer;
  let gateway: DesktopPtyGateway;

  beforeEach(async () => {
    upstream = new WebSocketServer({ port: 0 });
    await once(upstream, 'listening');
    upstream.on('connection', (socket) => {
      socket.on('message', (message, isBinary) => socket.send(message, { binary: isBinary }));
    });
    const upstreamPort = (upstream.address() as AddressInfo).port;

    apiServer = createServer();
    const jwt = new JwtService({ secret: 'desktop-proxy-test-secret' });
    const adapterHost = {
      httpAdapter: {
        getHttpServer: () => apiServer,
      },
    };
    const prisma = {
      session: {
        findFirst: async () => ({ id: 'session-one' }),
      },
      desktopPresence: {
        findUnique: async () => ({
          online: true,
          tunnelUrl: `ws://127.0.0.1:${upstreamPort}`,
          lastHeartbeat: new Date(),
          projectId: null,
          linkedProjects: [{ projectId: 'project-one', projectRoot: 'C:\\project' }],
        }),
      },
    };
    const config = {
      get: () => 30_000,
    };
    gateway = new DesktopPtyGateway(adapterHost as never, jwt, prisma as never, config as never);
    gateway.onModuleInit();
    apiServer.listen(0, '127.0.0.1');
    await once(apiServer, 'listening');
  });

  afterEach(async () => {
    gateway.onModuleDestroy();
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  it('relays a phone WebSocket through the API to the local desktop agent', async () => {
    const jwt = new JwtService({ secret: 'desktop-proxy-test-secret' });
    const token = jwt.sign(
      {
        sub: 'user-one',
        sessionId: 'session-one',
        projectId: 'project-one',
        scope: 'pty',
      },
      { expiresIn: '1m' },
    );
    const apiPort = (apiServer.address() as AddressInfo).port;
    const client = new WebSocket(
      `ws://127.0.0.1:${apiPort}/desktop/pty?token=${encodeURIComponent(token)}`,
    );
    await once(client, 'open');
    client.send('terminal-message');
    const [message] = (await once(client, 'message')) as [Buffer];
    expect(message.toString()).toBe('terminal-message');
    client.close();
    await once(client, 'close');
  });
});
