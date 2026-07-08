/** Name of the BullMQ queue shared between the API (producer) and the worker (consumer). */
export const EXECUTION_QUEUE = 'execution';

/** Job name added to the execution queue. */
export const RUN_COMMAND_JOB = 'run-command';

/** Shape of the payload handed to the execution worker. */
export interface RunCommandJobData {
  jobId: string;
  projectId: string;
  userId: string;
  command: string;
  target: 'CLOUD' | 'DESKTOP';
}
