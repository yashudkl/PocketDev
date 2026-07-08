import { Injectable, NotFoundException } from '@nestjs/common';
import { Tier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PAID_QUOTA = 1000;
const FREE_QUOTA = 50;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) {
      throw new NotFoundException('No subscription');
    }
    return sub;
  }

  /**
   * Demo-only tier switch (no real payment). Flips the user + subscription to
   * PAID so the freemium difference (instant vs queued) is demonstrable.
   */
  async upgrade(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { tier: Tier.PAID } });
    return this.prisma.subscription.update({
      where: { userId },
      data: { tier: Tier.PAID, quotaJobsPerDay: PAID_QUOTA, status: 'active' },
    });
  }

  async downgrade(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { tier: Tier.FREE } });
    return this.prisma.subscription.update({
      where: { userId },
      data: { tier: Tier.FREE, quotaJobsPerDay: FREE_QUOTA },
    });
  }
}
