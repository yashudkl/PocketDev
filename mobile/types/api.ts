import type { ExecutionTarget, JobStatus, SessionStatus, Tier } from '@pocketdev/shared';

export interface Subscription {
  id: string;
  userId: string;
  tier: Tier;
  status: string;
  quotaJobsPerDay: number;
  jobsUsedToday: number;
  quotaResetAt: string;
  renewsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  tier: Tier;
  createdAt?: string;
  subscription?: Subscription | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  desktopPath?: string | null;
  desktopLinkedAt?: string | null;
  manifest?: Record<string, unknown> | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  projectId: string;
  userId: string;
  command: string;
  status: JobStatus;
  target: ExecutionTarget;
  queueJobId: string | null;
  exitCode: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Session {
  id: string;
  jobId: string | null;
  projectId: string;
  userId: string;
  target: ExecutionTarget;
  status: SessionStatus;
  containerId: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface DesktopStatus {
  online: boolean;
  deviceName: string | null;
  tunnelUrl: string | null;
  projectId: string | null;
  projectRoot: string | null;
  projects: {
    projectId: string;
    projectRoot: string;
  }[];
  lastHeartbeat: string | null;
  target: ExecutionTarget;
}
