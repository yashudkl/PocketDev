import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const HEARTBEAT_WINDOW_MS = 30_000;

@Injectable()
export class DesktopService {
  constructor(private readonly prisma: PrismaService) {}

  /** Desktop agent calls this on an interval to advertise it's online. */
  heartbeat(userId: string, tunnelUrl?: string) {
    const now = new Date();
    return this.prisma.desktopPresence.upsert({
      where: { userId },
      create: { userId, online: true, tunnelUrl, lastHeartbeat: now },
      update: { online: true, tunnelUrl, lastHeartbeat: now },
    });
  }

  offline(userId: string) {
    return this.prisma.desktopPresence.upsert({
      where: { userId },
      create: { userId, online: false },
      update: { online: false },
    });
  }

  async status(userId: string) {
    const presence = await this.prisma.desktopPresence.findUnique({ where: { userId } });
    const online =
      !!presence?.online &&
      Date.now() - presence.lastHeartbeat.getTime() < HEARTBEAT_WINDOW_MS;
    return {
      online,
      tunnelUrl: online ? presence?.tunnelUrl ?? null : null,
      lastHeartbeat: presence?.lastHeartbeat ?? null,
      // Where a job would route right now (Decision 4).
      target: online ? 'DESKTOP' : 'CLOUD',
    };
  }
}
