import type {
  DesktopDirectoryListing,
  FileContent,
  FileNode,
  GitBranchInfo,
  GitCommitResult,
  GitDiffResult,
  GitLogEntry,
  GitPushProgress,
  GitStatusResult,
  StartSessionResponse,
  WriteFileResult,
} from '@pocketdev/shared';

import { apiClient } from '@/api/axios';
import type {
  AuthResponse,
  DesktopStatus,
  Job,
  Project,
  Session,
  Subscription,
  User,
} from '@/types/api';

const SLOW_REQUEST_TIMEOUT_MS = 120_000;
const GIT_NETWORK_TIMEOUT_MS = 5 * 60_000;

export const authApi = {
  login: async (email: string, password: string) =>
    (await apiClient.post<AuthResponse>('/auth/login', { email, password })).data,
  register: async (input: { email: string; password: string; name?: string }) =>
    (await apiClient.post<AuthResponse>('/auth/register', input)).data,
  profile: async () => (await apiClient.get<User>('/users/me')).data,
};

export const projectsApi = {
  list: async () => (await apiClient.get<Project[]>('/projects')).data,
  get: async (projectId: string) => (await apiClient.get<Project>(`/projects/${projectId}`)).data,
  create: async (input: { name: string; slug?: string; description?: string }) =>
    (await apiClient.post<Project>('/projects', input)).data,
  remove: async (projectId: string) =>
    (await apiClient.delete<{ deleted: true }>(`/projects/${projectId}`)).data,
};

export const filesApi = {
  tree: async (projectId: string) =>
    (await apiClient.get<FileNode>(`/projects/${projectId}/files`)).data,
  read: async (projectId: string, path: string) =>
    (
      await apiClient.get<FileContent>(`/projects/${projectId}/file`, {
        params: { path },
      })
    ).data,
  write: async (
    projectId: string,
    path: string,
    content: string,
    options: { createOnly?: boolean } = {},
  ) =>
    (
      await apiClient.put<WriteFileResult>(
        `/projects/${projectId}/file`,
        {
          path,
          content,
          createOnly: options.createOnly,
        },
        {
          timeout: SLOW_REQUEST_TIMEOUT_MS,
        },
      )
    ).data,
  remove: async (projectId: string, path: string) =>
    (
      await apiClient.delete<{ deleted: true }>(`/projects/${projectId}/file`, {
        params: { path },
        timeout: SLOW_REQUEST_TIMEOUT_MS,
      })
    ).data,
};

export const jobsApi = {
  list: async () => (await apiClient.get<Job[]>('/jobs')).data,
  get: async (jobId: string) => (await apiClient.get<Job>(`/jobs/${jobId}`)).data,
  start: async (projectId: string, command: string) =>
    (
      await apiClient.post<StartSessionResponse>('/jobs', {
        projectId,
        command,
      })
    ).data,
};

export const sessionsApi = {
  active: async () => (await apiClient.get<Session[]>('/sessions')).data,
  history: async () => (await apiClient.get<Session[]>('/sessions/history')).data,
  close: async (sessionId: string) =>
    (await apiClient.post<{ closed: true; sessionId: string }>(`/sessions/${sessionId}/close`))
      .data,
};

export const assistantApi = {
  explainTerminalFailure: async (input: { command: string; output: string; exitCode?: number }) =>
    (
      await apiClient.post<{ explanation: string; model: string }>(
        '/assistant/explain-terminal',
        input,
        { timeout: SLOW_REQUEST_TIMEOUT_MS },
      )
    ).data,
};

export const desktopApi = {
  status: async () => (await apiClient.get<DesktopStatus>('/desktop/status')).data,
  browse: async (path?: string) =>
    (
      await apiClient.get<DesktopDirectoryListing>('/desktop/browse', {
        params: path ? { path } : undefined,
      })
    ).data,
  link: async (projectId: string, path: string) =>
    (await apiClient.post<Project>('/desktop/link', { projectId, path })).data,
};

export const billingApi = {
  subscription: async () => (await apiClient.get<Subscription>('/billing/subscription')).data,
  upgrade: async () => (await apiClient.post<Subscription>('/billing/upgrade')).data,
  downgrade: async () => (await apiClient.post<Subscription>('/billing/downgrade')).data,
};

const gitPath = (projectId: string, action: string) => `/projects/${projectId}/git/${action}`;

export const gitApi = {
  status: async (projectId: string) =>
    (await apiClient.get<GitStatusResult>(gitPath(projectId, 'status'))).data,
  log: async (projectId: string) =>
    (await apiClient.get<GitLogEntry[]>(gitPath(projectId, 'log'))).data,
  branches: async (projectId: string) =>
    (await apiClient.get<GitBranchInfo>(gitPath(projectId, 'branches'))).data,
  diff: async (projectId: string, path?: string) =>
    (
      await apiClient.get<GitDiffResult>(gitPath(projectId, 'diff'), {
        params: path ? { path } : undefined,
      })
    ).data,
  init: async (projectId: string) =>
    (await apiClient.post<{ initialized: true; branch: string }>(gitPath(projectId, 'init'))).data,
  setRemote: async (projectId: string, url: string) =>
    (
      await apiClient.post<{ remote: string }>(gitPath(projectId, 'remote'), {
        url,
      })
    ).data,
  commit: async (projectId: string, message: string) =>
    (
      await apiClient.post<GitCommitResult>(
        gitPath(projectId, 'commit'),
        { message },
        { timeout: SLOW_REQUEST_TIMEOUT_MS },
      )
    ).data,
  push: async (projectId: string) =>
    (
      await apiClient.post<{ pushed: true; branch: string }>(
        gitPath(projectId, 'push'),
        undefined,
        { timeout: GIT_NETWORK_TIMEOUT_MS },
      )
    ).data,
  startPush: async (projectId: string) =>
    (
      await apiClient.post<GitPushProgress>(gitPath(projectId, 'push/start'), undefined, {
        timeout: SLOW_REQUEST_TIMEOUT_MS,
      })
    ).data,
  pushProgress: async (projectId: string, operationId: string) =>
    (
      await apiClient.get<GitPushProgress>(gitPath(projectId, 'push/progress'), {
        params: { operationId },
        timeout: SLOW_REQUEST_TIMEOUT_MS,
      })
    ).data,
  pull: async (projectId: string) =>
    (
      await apiClient.post<{ pulled: true }>(gitPath(projectId, 'pull'), undefined, {
        timeout: GIT_NETWORK_TIMEOUT_MS,
      })
    ).data,
};
