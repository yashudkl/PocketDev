import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { DesktopService } from './desktop.service';
import { HeartbeatDto } from './dto/heartbeat.dto';

@Controller('desktop')
export class DesktopController {
  constructor(private readonly desktop: DesktopService) {}

  @HttpCode(200)
  @Post('heartbeat')
  heartbeat(@CurrentUser() user: AuthUser, @Body() dto: HeartbeatDto) {
    return this.desktop.heartbeat(user.userId, dto.tunnelUrl);
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
}
