import { Module } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module';
import { ExecutionReconciler } from './execution-reconciler.service';

// Server-side reconciliation of worker ExecutionEvents into Postgres.
@Module({
  imports: [SessionsModule],
  providers: [ExecutionReconciler],
  exports: [ExecutionReconciler],
})
export class ExecutionModule {}
