import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { mountBullBoard } from './bull-board';

const DEFAULT_JWT_SECRET = 'change-me-in-production';

async function bootstrap(): Promise<void> {
  // Refuse to boot in production with the shared default secret (would let anyone
  // forge tokens — including PTY tokens the worker/desktop trust).
  const secret = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && secret === DEFAULT_JWT_SECRET) {
    throw new Error('JWT_SECRET must be set to a strong value in production');
  }

  const app = await NestFactory.create(AppModule);

  // Run OnModuleDestroy hooks (Prisma/Redis/WS cleanup) on SIGINT/SIGTERM.
  app.enableShutdownHooks();

  // Mobile app (Expo) talks to this over HTTP/WS — allow cross-origin in dev.
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Queue dashboard (auth-protected) at /admin/queues.
  const boardPath = mountBullBoard(app);

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;

  await app.listen(port, '0.0.0.0');
  const log = new Logger('Bootstrap');
  log.log(`PocketDev API listening on http://0.0.0.0:${port}`);
  if (boardPath) {
    log.log(`Queue dashboard at http://0.0.0.0:${port}${boardPath}`);
  }
}

void bootstrap();
