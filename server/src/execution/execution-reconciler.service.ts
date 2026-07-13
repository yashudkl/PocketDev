import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EXEC_CONTROL_CHANNEL,
  EXEC_EVENTS_CHANNEL,
  EXECUTION_QUEUE,
  type ExecutionControlSignal,
  type ExecutionEvent,
} from '@pocketdev/shared';
import { QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';

/**
 * Reconciles execution state into Postgres. Per BUILD-PLAN Decision 2 the worker
 * (untrusted-code blast radius) never touches the DB — it publishes
 * ExecutionEvents on a Redis channel, and THIS server-side service (which owns
 * the DB) writes them through. A BullMQ QueueEvents listener is a backstop:
 * if the worker dies without emitting `session-exited`, the queue's own `failed`
 * event still lets us fail the job instead of leaving it stuck RUNNING.
 */
@Injectable()
export class ExecutionReconciler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExecutionReconciler.name);
  private sub?: Redis;
  private pub?: Redis;
  private queueEvents?: QueueEvents;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {}

  private redisOptions() {
    return {
      host: this.config.get<string>('redis.host') ?? 'localhost',
      port: this.config.get<number>('redis.port') ?? 6379,
      password: this.config.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: null as null,
    };
  }

  onModuleInit(): void {
    const opts = this.redisOptions();

    this.sub = new Redis(opts);
    this.sub.on('error', (err) => this.logger.warn(`redis sub error: ${err.message}`));
    void this.sub.subscribe(EXEC_EVENTS_CHANNEL).catch((err) => {
      this.logger.warn(`could not subscribe to ${EXEC_EVENTS_CHANNEL}: ${err.message}`);
    });
    this.sub.on('message', (_channel, payload) => {
      void this.onEvent(payload);
    });

    this.pub = new Redis(opts);
    this.pub.on('error', (err) => this.logger.warn(`redis pub error: ${err.message}`));

    this.queueEvents = new QueueEvents(EXECUTION_QUEUE, { connection: opts });
    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      void this.onQueueFailed(jobId, failedReason);
    });
    this.queueEvents.on('error', (err) => this.logger.warn(`queueEvents error: ${err.message}`));

    this.logger.log(`Reconciling execution events from ${EXEC_EVENTS_CHANNEL}`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.sub?.quit(),
      this.pub?.quit(),
      this.queueEvents?.close(),
    ]);
  }

  /** Ask the worker to tear down a running session (server → worker control). */
  async killSession(sessionId: string): Promise<void> {
    const signal: ExecutionControlSignal = { type: 'kill-session', sessionId };
    await this.pub?.publish(EXEC_CONTROL_CHANNEL, JSON.stringify(signal));
  }

  private async onEvent(payload: string): Promise<void> {
    let event: ExecutionEvent;
    try {
      event = JSON.parse(payload) as ExecutionEvent;
    } catch {
      return;
    }
    try {
      switch (event.type) {
        case 'session-started':
          await this.prisma.job
            .updateMany({
              where: { id: event.jobId, status: 'QUEUED' },
              data: { status: 'RUNNING', startedAt: new Date() },
            })
            .catch(() => undefined);
          await this.sessions.markStarted(event.sessionId, event.containerId);
          break;
        case 'session-exited':
          await this.prisma.job
            .update({
              where: { id: event.jobId },
              data: {
                status: event.exitCode === 0 ? 'SUCCEEDED' : 'FAILED',
                exitCode: event.exitCode,
                finishedAt: new Date(),
              },
            })
            .catch(() => undefined);
          await this.sessions.markClosed(event.sessionId);
          break;
        case 'session-error':
          await this.prisma.job
            .update({
              where: { id: event.jobId },
              data: { status: 'FAILED', finishedAt: new Date() },
            })
            .catch(() => undefined);
          await this.sessions.markClosed(event.sessionId);
          this.logger.warn(`session ${event.sessionId} errored: ${event.message}`);
          break;
      }
    } catch (err) {
      this.logger.warn(`reconcile failed: ${(err as Error).message}`);
    }
  }

  /** Backstop: BullMQ says the job failed but we never saw session-exited. */
  private async onQueueFailed(queueJobId: string, reason: string): Promise<void> {
    await this.prisma.job
      .updateMany({
        where: { queueJobId, status: { in: ['QUEUED', 'RUNNING'] } },
        data: { status: 'FAILED', finishedAt: new Date() },
      })
      .catch(() => undefined);
    this.logger.warn(`queue job ${queueJobId} failed: ${reason}`);
  }
}
