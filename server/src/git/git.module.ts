import { Module } from '@nestjs/common';
import { DesktopModule } from '../desktop/desktop.module';
import { FilesModule } from '../files/files.module';
import { ProjectsModule } from '../projects/projects.module';
import { GitController } from './git.controller';
import { GitService } from './git.service';

@Module({
  imports: [DesktopModule, FilesModule, ProjectsModule],
  controllers: [GitController],
  providers: [GitService],
  exports: [GitService],
})
export class GitModule {}
