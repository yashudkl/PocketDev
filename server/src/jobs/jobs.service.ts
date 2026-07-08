import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExecutionTarget, Tier } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  EXECUTION_QUEUE,
  RUN_COMMAND_JOB,
  RunCommandJobData,
} from './jobs.constants';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
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
   * Create a job and enqueue it (Decision 2: API is the queue producer).
   * Freemium behaviour (Definition of Done): free tier shares the queue at
   * normal priority; paid tier jumps the line with higher priority.
   * Routing (Decision 4): send to the desktop if its agent is online, else cloud.
   */
  async create(userId: string, tier: string, dto: CreateJobDto) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }

    await this.enforceQuota(userId);

    const target = await this.resolveTarget(userId);

    const job = await this.prisma.job.create({
      data: {
        projectId: dto.projectId,
        userId,
        command: dto.command,
        status: 'QUEUED',
        target,
      },
    });

    const isPaid = tier === Tier.PAID;
    const queued = await this.queue.add(
      RUN_COMMAND_JOB,
      {
        jobId: job.id,
        projectId: job.projectId,
        userId: job.userId,
        command: job.command,
        target,
      },
      {
        // Lower number = higher priority in BullMQ. Paid users jump the queue.
        priority: isPaid ? 1 : 10,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    return this.prisma.job.update({
      where: { id: job.id },
      data: { queueJobId: queued.id },
    });
  }

  /** Desktop-if-present-else-cloud routing (Decision 4). */
  private async resolveTarget(userId: string): Promise<ExecutionTarget> {
    const presence = await this.prisma.desktopPresence.findUnique({ where: { userId } });
    const fresh =
      presence?.online &&
      Date.now() - presence.lastHeartbeat.getTime() < 30_000; // 30s heartbeat window
    return fresh ? ExecutionTarget.DESKTOP : ExecutionTarget.CLOUD;
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
        data: { jobsUsedToday: 0, quotaResetAt: now },
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
