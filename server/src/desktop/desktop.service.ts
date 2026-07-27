import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import type {
  DesktopDirectoryListing,
  DesktopLinkResult,
  DesktopProjectLink,
} from '@pocketdev/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HeartbeatDto } from './dto/heartbeat.dto';

const AGENT_REQUEST_TIMEOUT_MS = 10_000;

function parseLinks(value: Prisma.JsonValue | null | undefined): DesktopProjectLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      !Array.isArray(entry) &&
      typeof entry.projectId === 'string' &&
      typeof entry.projectRoot === 'string'
    ) {
      return [{ projectId: entry.projectId, projectRoot: entry.projectRoot }];
    }
    return [];
  });
}

function serializedLinks(links: DesktopProjectLink[]): Prisma.InputJsonValue {
  return links.map(({ projectId, projectRoot }) => ({ projectId, projectRoot }));
}

@Injectable()
export class DesktopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Desktop agent calls this on an interval to advertise it's online. */
  async heartbeat(userId: string, dto: HeartbeatDto) {
    const now = new Date();
    let links = this.heartbeatLinks(dto);
    if (links.length > 0) {
      const projects = await this.prisma.project.findMany({
        where: {
          userId,
          id: { in: [...new Set(links.map((link) => link.projectId))] },
        },
        select: { id: true },
      });
      const ownedProjectIds = new Set(projects.map((project) => project.id));
      links = links.filter((link) => ownedProjectIds.has(link.projectId));
    }

    return this.prisma.$transaction(async (tx) => {
      const primaryLink = links[0];
      const presence = await tx.desktopPresence.upsert({
        where: { userId },
        create: {
          userId,
          online: true,
          tunnelUrl: dto.tunnelUrl,
          deviceName: dto.deviceName,
          projectId: primaryLink?.projectId,
          projectRoot: primaryLink?.projectRoot,
          linkedProjects: serializedLinks(links),
          lastHeartbeat: now,
        },
        update: {
          online: true,
          tunnelUrl: dto.tunnelUrl,
          deviceName: dto.deviceName,
          projectId: primaryLink?.projectId ?? null,
          projectRoot: primaryLink?.projectRoot ?? null,
          linkedProjects: serializedLinks(links),
          lastHeartbeat: now,
        },
      });
      for (const link of links) {
        await tx.project.update({
          where: { id: link.projectId },
          data: { desktopPath: link.projectRoot, desktopLinkedAt: now },
        });
      }
      return presence;
    });
  }

  offline(userId: string) {
    return this.prisma.desktopPresence.upsert({
      where: { userId },
      create: { userId, online: false },
      update: { online: false },
    });
  }

  async status(userId: string) {
    const presence = await this.prisma.desktopPresence.findUnique({ where: { userId } });
    const online = this.isFresh(presence);
    const canReachDesktop = online && !!presence?.tunnelUrl;
    const projects = this.presenceLinks(presence);
    return {
      online,
      deviceName: presence?.deviceName ?? null,
      tunnelUrl: canReachDesktop ? presence!.tunnelUrl : null,
      projectId: projects[0]?.projectId ?? null,
      projectRoot: projects[0]?.projectRoot ?? null,
      projects,
      lastHeartbeat: presence?.lastHeartbeat ?? null,
      target: canReachDesktop ? 'DESKTOP' : 'CLOUD',
    };
  }

  async browse(userId: string, path?: string): Promise<DesktopDirectoryListing> {
    const presence = await this.requireOnlinePresence(userId);
    const url = this.agentUrl(presence.tunnelUrl!, '/desktop/browse');
    if (path) url.searchParams.set('path', path);
    return this.agentRequest<DesktopDirectoryListing>(userId, url);
  }

  async linkProject(userId: string, projectId: string, path: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const presence = await this.requireOnlinePresence(userId);
    const url = this.agentUrl(presence.tunnelUrl!, '/desktop/link');
    const linked = await this.agentRequest<DesktopLinkResult>(userId, url, {
      method: 'POST',
      body: JSON.stringify({ projectId, path }),
    });

    const links = this.presenceLinks(presence).filter((link) => link.projectId !== projectId);
    links.push({ projectId, projectRoot: linked.projectRoot });
    await this.prisma.desktopPresence.update({
      where: { userId },
      data: {
        projectId: links[0]?.projectId ?? null,
        projectRoot: links[0]?.projectRoot ?? null,
        linkedProjects: serializedLinks(links),
      },
    });
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        desktopPath: linked.projectRoot,
        desktopLinkedAt: new Date(),
      },
    });
  }

  async projectAvailable(userId: string, projectId: string): Promise<boolean> {
    const presence = await this.prisma.desktopPresence.findUnique({ where: { userId } });
    return (
      this.isFresh(presence) &&
      !!presence?.tunnelUrl &&
      this.presenceLinks(presence).some((link) => link.projectId === projectId)
    );
  }

  async projectRequest<T>(
    userId: string,
    projectId: string,
    action: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      query?: Record<string, string | undefined>;
    } = {},
  ): Promise<T> {
    const presence = await this.requireOnlinePresence(userId);
    if (!this.presenceLinks(presence).some((link) => link.projectId === projectId)) {
      throw new NotFoundException('This project is not linked to the connected desktop');
    }
    const url = this.agentUrl(
      presence.tunnelUrl!,
      `/desktop/projects/${encodeURIComponent(projectId)}/${action}`,
    );
    for (const [name, value] of Object.entries(options.query ?? {})) {
      if (value) url.searchParams.set(name, value);
    }
    return this.agentRequest<T>(userId, url, {
      method: options.method ?? 'GET',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }

  private heartbeatLinks(dto: HeartbeatDto): DesktopProjectLink[] {
    const links = (dto.projects ?? []).map(({ projectId, projectRoot }) => ({
      projectId,
      projectRoot,
    }));
    if (links.length === 0 && dto.projectId && dto.projectRoot) {
      links.push({ projectId: dto.projectId, projectRoot: dto.projectRoot });
    }
    return [...new Map(links.map((link) => [link.projectId, link])).values()];
  }

  private presenceLinks(
    presence:
      | {
          linkedProjects: Prisma.JsonValue | null;
          projectId: string | null;
          projectRoot: string | null;
        }
      | null
      | undefined,
  ): DesktopProjectLink[] {
    const links = parseLinks(presence?.linkedProjects);
    if (links.length === 0 && presence?.projectId && presence.projectRoot) {
      return [{ projectId: presence.projectId, projectRoot: presence.projectRoot }];
    }
    return links;
  }

  private isFresh(presence: { online: boolean; lastHeartbeat: Date } | null | undefined): boolean {
    const windowMs = this.config.get<number>('execution.desktopHeartbeatWindowMs') ?? 30_000;
    return !!presence?.online && Date.now() - presence.lastHeartbeat.getTime() < windowMs;
  }

  private async requireOnlinePresence(userId: string) {
    const presence = await this.prisma.desktopPresence.findUnique({ where: { userId } });
    if (!this.isFresh(presence) || !presence?.tunnelUrl) {
      throw new ServiceUnavailableException(
        'Your desktop agent is offline. Start it and try again.',
      );
    }
    return presence;
  }

  private agentUrl(tunnelUrl: string, pathname: string): URL {
    const url = new URL(tunnelUrl);
    if (url.protocol === 'wss:') url.protocol = 'https:';
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('Desktop tunnel URL is invalid');
    }
    url.pathname = pathname;
    url.search = '';
    url.hash = '';
    return url;
  }

  private async agentRequest<T>(userId: string, url: URL, init: RequestInit = {}): Promise<T> {
    const token = this.jwt.sign({ sub: userId, scope: 'desktop-control' }, { expiresIn: '1m' });
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(AGENT_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new BadGatewayException(
        `Could not reach the connected desktop: ${(error as Error).message}`,
      );
    }

    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    if (!response.ok) {
      const message =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
          ? body.error
          : 'The connected desktop rejected the request.';
      if (response.status === 400) throw new BadRequestException(message);
      throw new BadGatewayException(message);
    }
    return body as T;
  }
}
