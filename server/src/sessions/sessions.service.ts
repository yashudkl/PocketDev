import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
