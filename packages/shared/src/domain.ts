// Domain enums, mirrored as string-literal unions so every workspace shares the
// same vocabulary without depending on Prisma's generated client.

export const Tier = {
  FREE: 'FREE',
  PAID: 'PAID',
} as const;
export type Tier = (typeof Tier)[keyof typeof Tier];

export const JobStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const ExecutionTarget = {
  CLOUD: 'CLOUD',
  DESKTOP: 'DESKTOP',
} as const;
export type ExecutionTarget = (typeof ExecutionTarget)[keyof typeof ExecutionTarget];

export const SessionStatus = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];
