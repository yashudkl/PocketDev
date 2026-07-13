import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ExecutionTarget, Tier } from '@prisma/client';
import type { PtyTokenClaims, StartSessionResponse } from '@pocketdev/shared';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { EXECUTION_QUEUE, RUN_COMMAND_JOB, RunCommandJobData } from './jobs.constants';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectQueue(EXECUTION_QUEUE) private readonly queue: Queue<RunCommandJobData>,
  ) {}

  list(userId: string) {
    return this.prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(userId: string, id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.userId !== userId) {
      throw new ForbiddenException('Not your job');
    }
    return job;
  }

  /**
   * Create a job + session and hand the phone a PTY WebSocket to stream from.
   *
   * - Decision 2: the API is the queue producer; the worker consumes.
   * - Freemium (Definition of Done): FREE shares the queue at normal priority;
   *   PAID jumps the line (lower BullMQ priority number).
   * - Decision 4 routing: run on the developer's desktop if its agent is online
   *   AND advertised a tunnel URL, otherwise fall back to the cloud worker.
   */
  async create(userId: string, tier: string, dto: CreateJobDto): Promise<StartSessionResponse> {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }

    await this.enforceQuota(userId);

    const route = await this.resolveTarget(userId);

    const job = await this.prisma.job.create({
      data: {
        projectId: dto.projectId,
        userId,
        command: dto.command,
        status: route.target === ExecutionTarget.DESKTOP ? 'RUNNING' : 'QUEUED',
        startedAt: route.target === ExecutionTarget.DESKTOP ? new Date() : null,
        target: route.target,
      },
    });

    const session = await this.sessions.open({
      userId,
      projectId: dto.projectId,
      jobId: job.id,
      target: route.target,
    });

    const wsToken = this.mintPtyToken(userId, session.id, dto.projectId);

    if (route.target === ExecutionTarget.CLOUD) {
      const isPaid = tier === Tier.PAID;
      const queued = await this.queue.add(
        RUN_COMMAND_JOB,
        {
          jobId: job.id,
          sessionId: session.id,
          projectId: job.projectId,
          userId: job.userId,
          command: job.command,
          target: route.target,
        },
        {
          // Lower number = higher priority in BullMQ. Paid users jump the queue.
          priority: isPaid ? 1 : 10,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
      await this.prisma.job.update({
        where: { id: job.id },
        data: { queueJobId: queued.id },
      });
    }

    return {
      jobId: job.id,
      sessionId: session.id,
      target: route.target,
      wsUrl: route.target === ExecutionTarget.CLOUD ? this.workerWsUrl() : route.tunnelUrl!,
      wsToken,
    };
  }

  private mintPtyToken(userId: string, sessionId: string, projectId: string): string {
    const claims: PtyTokenClaims = { sub: userId, sessionId, projectId, scope: 'pty' };
    const ttl = this.config.get<string>('execution.wsTokenTtl') ?? '5m';
    return this.jwt.sign(claims, { expiresIn: ttl as JwtSignOptions['expiresIn'] });
  }

  private workerWsUrl(): string {
    return this.config.get<string>('execution.workerWsUrl') ?? 'ws://localhost:4100';
  }

  /** Desktop-if-present-else-cloud routing (Decision 4). */
  private async resolveTarget(
    userId: string,
  ): Promise<{ target: ExecutionTarget; tunnelUrl?: string }> {
    const presence = await this.prisma.desktopPresence.findUnique({ where: { userId } });
    const windowMs =
      this.config.get<number>('execution.desktopHeartbeatWindowMs') ?? 30_000;
    const fresh =
      !!presence?.online &&
      !!presence.tunnelUrl &&
      Date.now() - presence.lastHeartbeat.getTime() < windowMs;
    return fresh
      ? { target: ExecutionTarget.DESKTOP, tunnelUrl: presence!.tunnelUrl! }
      : { target: ExecutionTarget.CLOUD };
  }

  /** Daily job quota per subscription; resets on a rolling 24h window. */
  private async enforceQuota(userId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) {
      return; // No subscription row yet — don't block early dev.
    }

    const now = new Date();
    if (now.getTime() - sub.quotaResetAt.getTime() > 24 * 60 * 60 * 1000) {
      await this.prisma.subscription.update({
        where: { userId },
        data: { jobsUsedToday: 1, quotaResetAt: now },
      });
      return;
    }

    if (sub.jobsUsedToday >= sub.quotaJobsPerDay) {
      throw new ForbiddenException('Daily job quota reached — upgrade to run more.');
    }

    await this.prisma.subscription.update({
      where: { userId },
      data: { jobsUsedToday: { increment: 1 } },
    });
  }
}
