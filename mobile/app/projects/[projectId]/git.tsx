import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { gitApi, projectsApi } from '@/api/pocketdev';
import { DiffModal } from '@/components/git/DiffModal';
import { GitFileRow } from '@/components/git/GitFileRow';
import { GitTextModal } from '@/components/git/GitTextModal';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateView';
import { colors } from '@/constants/theme';
import { getErrorMessage } from '@/utils/errors';
import { formatRelativeDate } from '@/utils/format';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default function GitScreen() {
  const params = useLocalSearchParams<{ projectId: string }>();
  const projectId = param(params.projectId);
  const queryClient = useQueryClient();
  const [section, setSection] = useState<'changes' | 'history'>('changes');
  const [commitVisible, setCommitVisible] = useState(false);
  const [remoteVisible, setRemoteVisible] = useState(false);
  const [diffPath, setDiffPath] = useState<string | undefined>();

  const projectQuery = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const statusQuery = useQuery({
    queryKey: ['git', projectId, 'status'],
    queryFn: () => gitApi.status(projectId),
    retry: false,
  });
  const isRepository = Boolean(statusQuery.data);
  const logQuery = useQuery({
    queryKey: ['git', projectId, 'log'],
    queryFn: () => gitApi.log(projectId),
    enabled: isRepository,
  });
  const branchesQuery = useQuery({
    queryKey: ['git', projectId, 'branches'],
    queryFn: () => gitApi.branches(projectId),
    enabled: isRepository,
  });
  const diffQuery = useQuery({
    queryKey: ['git', projectId, 'diff', diffPath],
    queryFn: () => gitApi.diff(projectId, diffPath),
    enabled: diffPath !== undefined,
  });

  const invalidateGit = async () => {
    await queryClient.invalidateQueries({ queryKey: ['git', projectId] });
  };

  const initMutation = useMutation({
    mutationFn: () => gitApi.init(projectId),
    onSuccess: async () => {
      await invalidateGit();
      Toast.show({ type: 'success', text1: 'Git repository initialized' });
    },
    onError: (error) =>
      Toast.show({ type: 'error', text1: 'Git init failed', text2: getErrorMessage(error) }),
  });
  const commitMutation = useMutation({
    mutationFn: (message: string) => gitApi.commit(projectId, message),
    onSuccess: async (result) => {
      setCommitVisible(false);
      await invalidateGit();
      Toast.show({ type: 'success', text1: `Committed ${result.commit}`, text2: result.summary });
    },
    onError: (error) =>
      Toast.show({ type: 'error', text1: 'Commit failed', text2: getErrorMessage(error) }),
  });
  const remoteMutation = useMutation({
    mutationFn: (url: string) => gitApi.setRemote(projectId, url),
    onSuccess: (result) => {
      setRemoteVisible(false);
      Toast.show({ type: 'success', text1: 'Origin updated', text2: result.remote });
    },
    onError: (error) =>
      Toast.show({ type: 'error', text1: 'Remote failed', text2: getErrorMessage(error) }),
  });
  const pushMutation = useMutation({
    mutationFn: () => gitApi.push(projectId),
    onSuccess: async (result) => {
      await invalidateGit();
      Toast.show({ type: 'success', text1: `Pushed ${result.branch}` });
    },
    onError: (error) =>
      Toast.show({ type: 'error', text1: 'Push failed', text2: getErrorMessage(error) }),
  });
  const pullMutation = useMutation({
    mutationFn: () => gitApi.pull(projectId),
    onSuccess: async () => {
      await Promise.all([
        invalidateGit(),
        queryClient.invalidateQueries({ queryKey: ['files', projectId] }),
      ]);
      Toast.show({ type: 'success', text1: 'Pull complete' });
    },
    onError: (error) =>
      Toast.show({ type: 'error', text1: 'Pull failed', text2: getErrorMessage(error) }),
  });

  const statusError = getErrorMessage(statusQuery.error, '');
  const notRepository = statusError.toLowerCase().includes('not a git repository');

  if (statusQuery.isLoading) {
    return (
      <Screen>
        <AppHeader title="Git" subtitle={projectQuery.data?.name} back />
        <LoadingState label="Reading repository…" />
      </Screen>
    );
  }

  if (!statusQuery.data) {
    return (
      <Screen>
        <AppHeader title="Git" subtitle={projectQuery.data?.name} back />
        {notRepository ? (
          <EmptyState
            icon="git-branch-outline"
            title="Git is not initialized"
            description="Initialize a repository in the synced project store. Commits will use the local PocketDev identity."
            actionLabel={initMutation.isPending ? 'Initializing…' : 'Initialize Git'}
            onAction={() => initMutation.mutate()}
          />
        ) : (
          <ErrorState message={statusError} onRetry={() => void statusQuery.refetch()} />
        )}
      </Screen>
    );
  }

  const status = statusQuery.data;
  return (
    <Screen
      scroll
      contentClassName="gap-4 pt-4"
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={statusQuery.isRefetching}
            onRefresh={() => void invalidateGit()}
            tintColor={colors.primary}
          />
        ),
      }}
    >
      <AppHeader title="Git" subtitle={projectQuery.data?.name} back />
      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View>
            <AppText variant="label">Current branch</AppText>
            <AppText variant="heading" className="mt-1">
              {status.branch}
            </AppText>
          </View>
          <Badge
            label={status.clean ? 'Clean' : `${status.files.length} changed`}
            tone={status.clean ? 'success' : 'warning'}
            dot
          />
        </View>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-xl bg-slate-800 p-3">
            <AppText variant="caption">Ahead</AppText>
            <AppText variant="heading">{status.ahead}</AppText>
          </View>
          <View className="flex-1 rounded-xl bg-slate-800 p-3">
            <AppText variant="caption">Behind</AppText>
            <AppText variant="heading">{status.behind}</AppText>
          </View>
          <View className="flex-1 rounded-xl bg-slate-800 p-3">
            <AppText variant="caption">Branches</AppText>
            <AppText variant="heading">{branchesQuery.data?.all.length ?? '—'}</AppText>
          </View>
        </View>
      </Card>

      <View className="flex-row rounded-xl bg-slate-900 p-1">
        {(['changes', 'history'] as const).map((value) => (
          <AppText
            key={value}
            onPress={() => setSection(value)}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold ${
              section === value ? 'bg-slate-700 text-white' : 'text-slate-500'
            }`}
          >
            {value === 'changes' ? 'Changes' : 'History'}
          </AppText>
        ))}
      </View>

      {section === 'changes' ? (
        <Card className="overflow-hidden p-0">
          {status.files.length ? (
            status.files.map((file) => (
              <GitFileRow key={file.path} file={file} onPress={() => setDiffPath(file.path)} />
            ))
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              title="Working tree clean"
              description="There are no changes to commit."
            />
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          {logQuery.isLoading ? (
            <LoadingState label="Loading commits…" />
          ) : logQuery.data?.length ? (
            logQuery.data.map((entry) => (
              <View key={entry.hash} className="border-b border-slate-800 px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <AppText variant="mono" className="text-xs text-cyan-300">
                    {entry.hash}
                  </AppText>
                  <AppText className="min-w-0 flex-1 font-semibold text-white" numberOfLines={1}>
                    {entry.message}
                  </AppText>
                </View>
                <AppText variant="caption" className="mt-1">
                  {entry.author} · {formatRelativeDate(entry.date)}
                </AppText>
              </View>
            ))
          ) : (
            <EmptyState
              icon="time-outline"
              title="No commits yet"
              description="Your first commit will appear here."
            />
          )}
        </Card>
      )}

      <View className="flex-row gap-2">
        <Button
          label="Pull"
          icon="arrow-down"
          variant="secondary"
          className="flex-1"
          loading={pullMutation.isPending}
          onPress={() => pullMutation.mutate()}
        />
        <Button
          label="Push"
          icon="arrow-up"
          variant="secondary"
          className="flex-1"
          loading={pushMutation.isPending}
          onPress={() => pushMutation.mutate()}
        />
      </View>
      <Button
        label="Commit all changes"
        icon="git-commit-outline"
        fullWidth
        disabled={status.clean}
        onPress={() => setCommitVisible(true)}
      />
      <Button
        label="Configure origin"
        icon="link-outline"
        variant="ghost"
        fullWidth
        onPress={() => setRemoteVisible(true)}
      />
      <AppText variant="caption" className="text-center leading-5">
        Commit stages every changed file. Push and pull use credentials configured on the PocketDev
        server.
      </AppText>

      {commitVisible ? (
        <GitTextModal
          visible
          title="Commit all changes"
          description={`${status.files.length} changed file${status.files.length === 1 ? '' : 's'} will be staged and committed.`}
          label="Commit message"
          placeholder="Describe your changes"
          actionLabel="Commit"
          multiline
          loading={commitMutation.isPending}
          onClose={() => setCommitVisible(false)}
          onSubmit={(message) => commitMutation.mutate(message)}
        />
      ) : null}
      {remoteVisible ? (
        <GitTextModal
          visible
          title="Configure origin"
          description="HTTPS credentials or SSH keys must already be configured on the server."
          label="Remote URL"
          placeholder="git@github.com:owner/repo.git"
          actionLabel="Save origin"
          loading={remoteMutation.isPending}
          onClose={() => setRemoteVisible(false)}
          onSubmit={(url) => remoteMutation.mutate(url)}
        />
      ) : null}
      <DiffModal
        visible={diffPath !== undefined}
        path={diffPath}
        diff={diffQuery.data?.diff}
        loading={diffQuery.isLoading}
        onClose={() => setDiffPath(undefined)}
      />
    </Screen>
  );
}
