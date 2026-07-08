import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(userId: string, dto: CreateProjectDto) {
    const slug = dto.slug ?? this.slugify(dto.name);
    return this.prisma.project.create({
      data: {
        userId,
        name: dto.name,
        slug,
        description: dto.description,
      },
    });
  }

  async findOne(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.userId !== userId) {
      throw new ForbiddenException('Not your project');
    }
    return project;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.project.delete({ where: { id } });
    return { deleted: true };
  }

  /** Updates the JSONB file manifest after a CLI sync (Decision 1: JSONB column). */
  async updateManifest(userId: string, id: string, manifest: Prisma.InputJsonValue) {
    await this.findOne(userId, id);
    return this.prisma.project.update({
      where: { id },
      data: { manifest, lastSyncedAt: new Date() },
    });
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60);
  }
}
