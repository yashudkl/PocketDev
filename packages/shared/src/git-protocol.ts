// Git-from-the-phone contract (BUILD-PLAN Weeks 11–12 / Definition of Done:
// "a commit can be pushed"). The API runs git against the project's synced
// file store; these types shape the HTTP responses the mobile Git panel renders.

export interface GitFileStatus {
  path: string;
  /** Porcelain-ish index/worktree state, e.g. "M", "A", "D", "??", "R". */
  status: string;
  staged: boolean;
}

export interface GitStatusResult {
  branch: string;
  /** Fetch/push URL for origin when the synced repository is connected. */
  remoteUrl: string | null;
  ahead: number;
  behind: number;
  clean: boolean;
  files: GitFileStatus[];
}

export interface GitCommitResult {
  commit: string; // short sha
  branch: string;
  summary: string;
}

export interface GitLogEntry {
  hash: string;
  message: string;
  author: string;
  date: string; // ISO
}

export interface GitBranchInfo {
  current: string;
  all: string[];
}

export interface GitDiffResult {
  path?: string;
  diff: string;
}

export type GitPushStage =
  'PREPARING' | 'COUNTING' | 'COMPRESSING' | 'UPLOADING' | 'FINALIZING' | 'COMPLETED' | 'FAILED';

export type GitPushStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface GitPushProgress {
  operationId: string;
  branch: string;
  status: GitPushStatus;
  stage: GitPushStage;
  /** Weighted whole-operation percentage, from 0 through 100. */
  percent: number;
  message: string;
  startedAt: string;
  updatedAt: string;
  error?: string;
}

export interface ParsedGitPushProgress {
  stage: Exclude<GitPushStage, 'COMPLETED' | 'FAILED'>;
  percent: number;
  message: string;
}

function boundedPercent(value: string | undefined): number {
  return Math.max(0, Math.min(100, Number(value ?? 0)));
}

/**
 * Convert `git push --progress` stderr lines into monotonic, user-facing
 * whole-operation progress. Git reports a percentage for each individual
 * phase, so each phase is mapped into its portion of the overall operation.
 */
export function parseGitPushProgressLine(line: string): ParsedGitPushProgress | null {
  const text = line.trim();
  if (!text) return null;

  if (/^Enumerating objects:/i.test(text)) {
    return { stage: 'PREPARING', percent: 5, message: 'Scanning commits and objects' };
  }

  let match = text.match(/^Counting objects:\s+(\d+)%/i);
  if (match) {
    const phasePercent = boundedPercent(match[1]);
    return {
      stage: 'COUNTING',
      percent: Math.round(5 + phasePercent * 0.15),
      message: `Counting objects · ${phasePercent}%`,
    };
  }

  match = text.match(/^Compressing objects:\s+(\d+)%/i);
  if (match) {
    const phasePercent = boundedPercent(match[1]);
    return {
      stage: 'COMPRESSING',
      percent: Math.round(20 + phasePercent * 0.25),
      message: `Compressing objects · ${phasePercent}%`,
    };
  }

  match = text.match(/^Writing objects:\s+(\d+)%(?:\s+\([^)]*\))?(?:,\s*(.*))?/i);
  if (match) {
    const phasePercent = boundedPercent(match[1]);
    const transfer = match[2]?.replace(/,\s*done\.?$/i, '').trim();
    return {
      stage: 'UPLOADING',
      percent: Math.round(45 + phasePercent * 0.45),
      message: `Uploading objects · ${phasePercent}%${transfer ? ` · ${transfer}` : ''}`,
    };
  }

  match = text.match(/^(?:remote:\s*)?Resolving deltas:\s+(\d+)%/i);
  if (match) {
    const phasePercent = boundedPercent(match[1]);
    return {
      stage: 'FINALIZING',
      percent: Math.round(90 + phasePercent * 0.08),
      message: `Remote is resolving deltas · ${phasePercent}%`,
    };
  }

  if (/^Everything up-to-date$/i.test(text)) {
    return {
      stage: 'FINALIZING',
      percent: 99,
      message: 'Everything is already up to date',
    };
  }

  if (/^To\s+\S+/i.test(text) || /->/.test(text)) {
    return {
      stage: 'FINALIZING',
      percent: 99,
      message: 'Updating the remote branch',
    };
  }

  return null;
}
