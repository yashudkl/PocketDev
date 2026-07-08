import { Controller, Get, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('subscription')
  subscription(@CurrentUser() user: AuthUser) {
    return this.billing.getSubscription(user.userId);
  }

  @Post('upgrade')
  upgrade(@CurrentUser() user: AuthUser) {
    return this.billing.upgrade(user.userId);
  }

  @Post('downgrade')
  downgrade(@CurrentUser() user: AuthUser) {
    return this.billing.downgrade(user.userId);
  }
}
