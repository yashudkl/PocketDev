import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EXECUTION_QUEUE } from '../jobs/jobs.constants';

/**
 * Redis-backed BullMQ registration (Decision 2 of the build plan).
 * The API is the queue PRODUCER; the execution worker (services/execution-worker)
 * is the CONSUMER running as a separate process.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
        },
      }),
    }),
    BullModule.registerQueue({ name: EXECUTION_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
