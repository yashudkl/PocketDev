import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { DesktopService } from './desktop.service';
import { BrowseDesktopDto } from './dto/browse-desktop.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { LinkDesktopDto } from './dto/link-desktop.dto';

@Controller('desktop')
export class DesktopController {
  constructor(private readonly desktop: DesktopService) {}

  @HttpCode(200)
  @Post('heartbeat')
  heartbeat(@CurrentUser() user: AuthUser, @Body() dto: HeartbeatDto) {
    return this.desktop.heartbeat(user.userId, dto);
  }

  @HttpCode(200)
  @Post('offline')
  offline(@CurrentUser() user: AuthUser) {
    return this.desktop.offline(user.userId);
  }

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.desktop.status(user.userId);
  }

  @Get('browse')
  browse(@CurrentUser() user: AuthUser, @Query() query: BrowseDesktopDto) {
    return this.desktop.browse(user.userId, query.path);
  }

  @Post('link')
  link(@CurrentUser() user: AuthUser, @Body() dto: LinkDesktopDto) {
    return this.desktop.linkProject(user.userId, dto.projectId, dto.path);
  }
}
