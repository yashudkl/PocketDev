import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ProjectsModule } from '../projects/projects.module';
import { SyncGateway } from './sync.gateway';

// JwtService is provided by the (global) JwtModule registered in AuthModule.
@Module({
  imports: [FilesModule, ProjectsModule],
  providers: [SyncGateway],
})
export class SyncModule {}
