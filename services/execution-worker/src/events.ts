import {
  EXEC_CONTROL_CHANNEL,
  EXEC_EVENTS_CHANNEL,
  type ExecutionControlSignal,
  type ExecutionEvent,
} from '@pocketdev/shared';
import Redis from 'ioredis';
import { config } from './config';

/**
 * The worker's link to the API. Per Decision 2 the worker never touches
 * Postgres: it PUBLISHES lifecycle events (the API reconciles them into the DB)
 * and SUBSCRIBES to control signals (e.g. an API-initiated kill).
 */
export class ExecEvents {
  private readonly pub: Redis;
  private readonly sub: Redis;

  constructor(onControl: (signal: ExecutionControlSignal) => void) {
    const opts = { ...config.redis, maxRetriesPerRequest: null as null };
    this.pub = new Redis(opts);
    this.sub = new Redis(opts);
    this.pub.on('error', (err) => console.warn(`[events] pub error: ${err.message}`));
    this.sub.on('error', (err) => console.warn(`[events] sub error: ${err.message}`));

    void this.sub.subscribe(EXEC_CONTROL_CHANNEL).catch((err) => {
      console.warn(`[events] control subscribe failed: ${err.message}`);
    });
    this.sub.on('message', (_channel, payload) => {
      try {
        onControl(JSON.parse(payload) as ExecutionControlSignal);
      } catch {
        /* ignore malformed control frames */
      }
    });
  }

  publish(event: ExecutionEvent): void {
    void this.pub.publish(EXEC_EVENTS_CHANNEL, JSON.stringify(event));
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.pub.quit(), this.sub.quit()]);
  }
}
