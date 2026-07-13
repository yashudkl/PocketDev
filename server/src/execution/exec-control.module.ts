import { Module } from '@nestjs/common';
import { ExecControlService } from './exec-control.service';

// Standalone (no SessionsModule dependency) so SessionsService can publish kill
// signals without a circular import.
@Module({
  providers: [ExecControlService],
  exports: [ExecControlService],
})
export class ExecControlModule {}
