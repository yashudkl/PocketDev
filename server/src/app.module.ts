import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { JobsModule } from './jobs/jobs.module';
import { SessionsModule } from './sessions/sessions.module';
import { BillingModule } from './billing/billing.module';
import { DesktopModule } from './desktop/desktop.module';
import { HealthModule } from './health/health.module';
import { FilesModule } from './files/files.module';
import { SyncModule } from './sync/sync.module';
import { GitModule } from './git/git.module';
import { ExecutionModule } from './execution/execution.module';
import { AssistantModule } from './assistant/assistant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    QueueModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    JobsModule,
    SessionsModule,
    BillingModule,
    DesktopModule,
    HealthModule,
    FilesModule,
    SyncModule,
    GitModule,
    ExecutionModule,
    AssistantModule,
  ],
  providers: [
    // JWT required by default; opt out per-route with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
