// File-sync protocol between the CLI agent (services/cli-agent) and the server.
// Delta-sync modeled on rsync: compare mtime+size+hash against a server-held
// manifest and transfer only changed files.

export interface FileManifestEntry {
  path: string;
  size: number;
  mtimeMs: number;
  hash: string; // content hash (e.g. sha256)
}

export type FileManifest = Record<string, FileManifestEntry>;

export interface ManifestDiff {
  changed: string[];
  removed: string[];
}

/** Messages from the CLI agent to the server. */
export type SyncClientMessage =
  | { type: 'manifest'; projectId: string; manifest: FileManifest }
  | { type: 'file'; projectId: string; path: string; contentBase64: string }
  | { type: 'removed'; projectId: string; path: string }
  | { type: 'done'; projectId: string };

/** Messages from the server to the CLI agent. */
export type SyncServerMessage =
  | { type: 'diff'; projectId: string; diff: ManifestDiff }
  | { type: 'ack'; projectId: string; path: string }
  | { type: 'synced'; projectId: string };
