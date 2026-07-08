import type { ExecutionTarget } from './domain';

// Contract between the API (producer, server/) and the execution worker
// (consumer, services/execution-worker/). Values MUST stay in sync with
// server/src/jobs/jobs.constants.ts.

export const EXECUTION_QUEUE = 'execution';
export const RUN_COMMAND_JOB = 'run-command';

export interface RunCommandJobData {
  jobId: string;
  projectId: string;
  userId: string;
  command: string;
  target: ExecutionTarget;
}

export interface RunCommandJobResult {
  exitCode: number;
  durationMs: number;
}
