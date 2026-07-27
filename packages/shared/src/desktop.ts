export type DesktopDirectoryEntryKind = 'drive' | 'directory';

export interface DesktopDirectoryEntry {
  name: string;
  path: string;
  kind: DesktopDirectoryEntryKind;
  hasGit: boolean;
}

export interface DesktopDirectoryListing {
  path: string | null;
  name: string;
  parentPath: string | null;
  entries: DesktopDirectoryEntry[];
}

export interface DesktopProjectLink {
  projectId: string;
  projectRoot: string;
}

export interface DesktopLinkResult extends DesktopProjectLink {
  name: string;
}
