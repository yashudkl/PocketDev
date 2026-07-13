import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExecutionTarget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExecControlService } from '../execution/exec-control.service';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly execControl: ExecControlService,
  ) {}

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
  async markClosed(sessionId: string): Promise<void> {
    const session = await this.prisma.session
      .findUnique({ where: { id: sessionId } })
      .catch(() => null);
    if (!session) return;

    await this.prisma.session
      .updateMany({
        where: { id: sessionId, status: 'ACTIVE' },
        data: { status: 'CLOSED', endedAt: new Date() },
      })
      .catch(() => undefined);

    // CLOUD jobs are finalized by the ExecutionReconciler (via worker events).
    // DESKTOP jobs run outside the queue, so nothing else ever completes them —
    // do it here when the session ends.
    if (session.target === ExecutionTarget.DESKTOP && session.jobId) {
      await this.prisma.job
        .updateMany({
          where: { id: session.jobId, status: { in: ['QUEUED', 'RUNNING'] } },
          data: { status: 'SUCCEEDED', finishedAt: new Date() },
        })
        .catch(() => undefined);
    }
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
    // Tell the cloud worker to tear the container down now (DESKTOP sessions end
    // when the phone drops the WS, so no signal is needed there).
    if (session.target === ExecutionTarget.CLOUD) {
      await this.execControl.killSession(sessionId);
    }
    return { closed: true, sessionId };
  }
}
