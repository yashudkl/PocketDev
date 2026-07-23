import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExecutionTarget } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ExecControlService } from '../execution/exec-control.service';
import { EXECUTION_QUEUE, RunCommandJobData } from '../jobs/jobs.constants';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly execControl: ExecControlService,
    @InjectQueue(EXECUTION_QUEUE) private readonly queue: Queue<RunCommandJobData>,
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
  open(params: { userId: string; projectId: string; jobId: string; target: ExecutionTarget }) {
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

  /** Reconciler hook: end a session. Idempotent. */
  async markClosed(sessionId: string): Promise<void> {
    await this.prisma.session
      .updateMany({
        where: { id: sessionId, status: 'ACTIVE' },
        data: { status: 'CLOSED', endedAt: new Date() },
      })
      .catch(() => undefined);
  }

  /** User-initiated close (phone tapped "end session"). */
  async close(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { job: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Not your session');
    }
    // Remove a job that is still waiting in BullMQ before marking it canceled.
    // A best-effort Redis pub/sub signal alone can be lost before the worker has
    // registered the session.
    if (
      session.target === ExecutionTarget.CLOUD &&
      session.job?.status === 'QUEUED' &&
      session.job.queueJobId
    ) {
      const queued = await this.queue.getJob(session.job.queueJobId).catch(() => undefined);
      await queued?.remove().catch(() => undefined);
    }

    if (session.jobId) {
      await this.prisma.job.updateMany({
        where: { id: session.jobId, status: { in: ['QUEUED', 'RUNNING'] } },
        data: { status: 'CANCELED', finishedAt: new Date() },
      });
    }

    await this.markClosed(sessionId);
    // Tell the cloud worker to tear the container down now (DESKTOP sessions end
    // when the phone drops the WS, so no signal is needed there).
    if (session.target === ExecutionTarget.CLOUD) {
      await this.execControl.killSession(sessionId);
    }
    return { closed: true, sessionId };
  }

  /** Desktop-agent callback after the command exits naturally. */
  async complete(userId: string, sessionId: string, exitCode: number) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Not your session');
    }
    if (session.target !== ExecutionTarget.DESKTOP) {
      throw new ForbiddenException('Only desktop sessions complete through this endpoint');
    }

    if (session.jobId) {
      await this.prisma.job.updateMany({
        where: { id: session.jobId, status: { in: ['QUEUED', 'RUNNING'] } },
        data: {
          status: exitCode === 0 ? 'SUCCEEDED' : exitCode === 130 ? 'CANCELED' : 'FAILED',
          exitCode,
          finishedAt: new Date(),
        },
      });
    }
    await this.markClosed(sessionId);
    return { completed: true, sessionId, exitCode };
  }
}
