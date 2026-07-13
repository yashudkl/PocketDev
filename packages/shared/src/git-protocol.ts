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
