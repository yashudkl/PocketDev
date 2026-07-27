import { Module } from '@nestjs/common';
import { DesktopController } from './desktop.controller';
import { DesktopPtyGateway } from './desktop-pty.gateway';
import { DesktopService } from './desktop.service';

@Module({
  controllers: [DesktopController],
  providers: [DesktopService, DesktopPtyGateway],
  exports: [DesktopService],
})
export class DesktopModule {}
