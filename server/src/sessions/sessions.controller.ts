import { Controller, Get } from '@nestjs/common';
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
}
