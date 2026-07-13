import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EXEC_CONTROL_CHANNEL, type ExecutionControlSignal } from '@pocketdev/shared';
import Redis from 'ioredis';

/**
 * Publishes server → worker control signals on Redis. Kept in its own module
 * (no dependency on SessionsModule) so SessionsService can send a kill without a
 * circular import with the reconciler.
 */
@Injectable()
export class ExecControlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExecControlService.name);
  private pub?: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.pub = new Redis({
      host: this.config.get<string>('redis.host') ?? 'localhost',
      port: this.config.get<number>('redis.port') ?? 6379,
      password: this.config.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: null,
    });
    this.pub.on('error', (err) => this.logger.warn(`redis pub error: ${err.message}`));
  }

  /** Ask the worker to tear down a running CLOUD session (SIGKILL semantics). */
  async killSession(sessionId: string): Promise<void> {
    const signal: ExecutionControlSignal = { type: 'kill-session', sessionId };
    await this.pub?.publish(EXEC_CONTROL_CHANNEL, JSON.stringify(signal)).catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pub?.quit().catch(() => undefined);
  }
}
