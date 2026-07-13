import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { FileStoreService } from './file-store.service';
import { FilesController } from './files.controller';

@Module({
  imports: [ProjectsModule],
  controllers: [FilesController],
  providers: [FileStoreService],
  exports: [FileStoreService],
})
export class FilesModule {}
