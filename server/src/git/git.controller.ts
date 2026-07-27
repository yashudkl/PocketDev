import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';
import { CommitDto, SetRemoteDto } from './dto/git.dto';
import { GitService } from './git.service';

/** Git panel backend for the mobile app. Ownership checked on every call. */
@Controller('projects/:projectId/git')
export class GitController {
  constructor(
    private readonly git: GitService,
    private readonly projects: ProjectsService,
  ) {}

  private async own(user: AuthUser, projectId: string): Promise<void> {
    await this.projects.findOne(user.userId, projectId);
  }

  @Get('status')
  async status(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    await this.own(user, projectId);
    return this.git.status(user.userId, projectId);
  }

  @Get('log')
  async log(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    await this.own(user, projectId);
    return this.git.log(user.userId, projectId);
  }

  @Get('branches')
  async branches(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    await this.own(user, projectId);
    return this.git.branches(user.userId, projectId);
  }

  @Get('diff')
  async diff(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query('path') path?: string,
  ) {
    await this.own(user, projectId);
    return this.git.diff(user.userId, projectId, path);
  }

  @Post('init')
  async init(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    await this.own(user, projectId);
    return this.git.init(user.userId, projectId);
  }

  @Post('remote')
  async remote(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: SetRemoteDto,
  ) {
    await this.own(user, projectId);
    return this.git.setRemote(user.userId, projectId, dto.url);
  }

  @Post('commit')
  async commit(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: CommitDto,
  ) {
    await this.own(user, projectId);
    return this.git.commit(user.userId, projectId, dto.message);
  }

  @Post('push')
  async push(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    await this.own(user, projectId);
    return this.git.push(user.userId, projectId);
  }

  @Post('push/start')
  async startPush(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    await this.own(user, projectId);
    return this.git.startPush(user.userId, projectId);
  }

  @Get('push/progress')
  async pushProgress(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query('operationId') operationId: string,
  ) {
    await this.own(user, projectId);
    return this.git.pushProgress(user.userId, projectId, operationId);
  }

  @Post('pull')
  async pull(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    await this.own(user, projectId);
    return this.git.pull(user.userId, projectId);
  }
}
