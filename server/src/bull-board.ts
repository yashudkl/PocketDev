import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { EXECUTION_QUEUE } from '@pocketdev/shared';
import type { Queue } from 'bullmq';
import type { NextFunction, Request, Response } from 'express';

import { Logger } from '@nestjs/common';

const BOARD_PATH = '/admin/queues';
const USER = process.env.BULLBOARD_USER ?? 'admin';
const PASS = process.env.BULLBOARD_PASSWORD ?? 'admin';
const USING_DEFAULT_CREDS = !process.env.BULLBOARD_USER && !process.env.BULLBOARD_PASSWORD;

/** HTTP Basic auth — this dashboard sits outside the JWT-guarded API routes. */
function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user === USER && pass === PASS) {
      next();
      return;
    }
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="PocketDev Queues"');
  res.status(401).send('Authentication required');
}

/**
 * Mount Bull Board (BUILD-PLAN Week 13) at /admin/queues to inspect the
 * execution queue — waiting/active/failed jobs, the freemium priority ordering,
 * and dead-lettered failures. Basic-auth protected.
 */
export function mountBullBoard(app: INestApplication): string | null {
  const logger = new Logger('BullBoard');
  // Never expose the dashboard with default creds in production.
  if (USING_DEFAULT_CREDS && process.env.NODE_ENV === 'production') {
    logger.error(
      'Refusing to mount /admin/queues: set BULLBOARD_USER and BULLBOARD_PASSWORD in production',
    );
    return null;
  }
  if (USING_DEFAULT_CREDS) {
    logger.warn('/admin/queues uses default admin/admin — set BULLBOARD_USER/PASSWORD');
  }
  const queue = app.get<Queue>(getQueueToken(EXECUTION_QUEUE));
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BOARD_PATH);
  createBullBoard({ queues: [new BullMQAdapter(queue)], serverAdapter });
  app.use(BOARD_PATH, basicAuth, serverAdapter.getRouter());
  return BOARD_PATH;
}
