import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExecutionTarget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  listActive(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    });
  }

  history(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  /** Open a session row when a job is created (before a container exists). */
  open(params: {
    userId: string;
    projectId: string;
    jobId: string;
    target: ExecutionTarget;
  }) {
    return this.prisma.session.create({
      data: {
        userId: params.userId,
        projectId: params.projectId,
        jobId: params.jobId,
        target: params.target,
        status: 'ACTIVE',
      },
    });
  }

  /** Reconciler hook: record the container backing an active session. */
  markStarted(sessionId: string, containerId: string) {
    return this.prisma.session
      .update({ where: { id: sessionId }, data: { containerId } })
      .catch(() => undefined);
  }

  /** Reconciler hook (or user close): end a session. Idempotent. */
  markClosed(sessionId: string) {
    return this.prisma.session
      .updateMany({
        where: { id: sessionId, status: 'ACTIVE' },
        data: { status: 'CLOSED', endedAt: new Date() },
      })
      .catch(() => undefined);
  }

  /** User-initiated close (phone tapped "end session"). */
  async close(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Not your session');
    }
    await this.markClosed(sessionId);
    return { closed: true, sessionId };
  }
}
