// File-browser contract for the mobile file tree + code editor (Definition of
// Done: "a file can be edited and saved"). The server exposes the project's
// synced file store; these shape the browse/read/write HTTP responses.

export interface FileNode {
  name: string;
  path: string; // project-relative, POSIX separators
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
}

export interface FileContent {
  path: string;
  /** UTF-8 text content. Binary files are flagged and content is omitted. */
  content: string;
  encoding: 'utf-8';
  size: number;
}

export interface WriteFileResult {
  path: string;
  size: number;
  written: boolean;
}
