import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import type { FileContent, FileNode, WriteFileResult } from '@pocketdev/shared';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { DesktopService } from '../desktop/desktop.service';
import { ProjectsService } from '../projects/projects.service';
import { WriteFileDto } from './dto/write-file.dto';
import { FileStoreService } from './file-store.service';

/**
 * Browse / read / write the project's synced file store — the backend half of
 * "a file can be edited and saved" (Definition of Done). Ownership is checked
 * on every call via ProjectsService.findOne (throws if not the caller's).
 */
@Controller('projects/:projectId')
export class FilesController {
  constructor(
    private readonly files: FileStoreService,
    private readonly projects: ProjectsService,
    private readonly desktop: DesktopService,
  ) {}

  @Get('files')
  async tree(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ): Promise<FileNode> {
    await this.projects.findOne(user.userId, projectId);
    if (await this.desktop.projectAvailable(user.userId, projectId)) {
      return this.desktop.projectRequest<FileNode>(user.userId, projectId, 'files');
    }
    return this.files.tree(user.userId, projectId);
  }

  @Get('file')
  async read(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query('path') path: string,
  ): Promise<FileContent> {
    await this.projects.findOne(user.userId, projectId);
    if (await this.desktop.projectAvailable(user.userId, projectId)) {
      return this.desktop.projectRequest<FileContent>(user.userId, projectId, 'file', {
        query: { path },
      });
    }
    const { content, size } = await this.files.readText(user.userId, projectId, path);
    return { path, content, encoding: 'utf-8', size };
  }

  @Put('file')
  async write(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: WriteFileDto,
  ): Promise<WriteFileResult> {
    await this.projects.findOne(user.userId, projectId);
    if (await this.desktop.projectAvailable(user.userId, projectId)) {
      return this.desktop.projectRequest<WriteFileResult>(user.userId, projectId, 'file', {
        method: 'PUT',
        body: dto,
      });
    }
    const size = await this.files.writeText(user.userId, projectId, dto.path, dto.content, {
      createOnly: dto.createOnly,
    });
    const manifest = await this.files.computeManifest(user.userId, projectId);
    await this.projects.updateManifest(user.userId, projectId, manifest);
    return { path: dto.path, size, written: true };
  }

  @Delete('file')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query('path') path: string,
  ): Promise<{ deleted: true }> {
    await this.projects.findOne(user.userId, projectId);
    if (await this.desktop.projectAvailable(user.userId, projectId)) {
      return this.desktop.projectRequest<{ deleted: true }>(user.userId, projectId, 'file', {
        method: 'DELETE',
        query: { path },
      });
    }
    await this.files.remove(user.userId, projectId, path);
    const manifest = await this.files.computeManifest(user.userId, projectId);
    await this.projects.updateManifest(user.userId, projectId, manifest);
    return { deleted: true };
  }
}
