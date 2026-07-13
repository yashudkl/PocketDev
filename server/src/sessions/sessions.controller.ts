import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  active(@CurrentUser() user: AuthUser) {
    return this.sessions.listActive(user.userId);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser) {
    return this.sessions.history(user.userId);
  }

  @HttpCode(200)
  @Post(':id/close')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.close(user.userId, id);
  }
}
