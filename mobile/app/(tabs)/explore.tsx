import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { jobsApi, projectsApi, sessionsApi } from '@/api/pocketdev';
import { ActivityFilter, type ActivityFilterValue } from '@/components/activity/ActivityFilter';
import { ActivitySummary } from '@/components/activity/ActivitySummary';
import { JobActivityRow } from '@/components/activity/JobActivityRow';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateView';
import type { Project, Session } from '@/types/api';
import { getErrorMessage } from '@/utils/errors';

const ACTIVE_JOB_STATUSES = new Set(['QUEUED', 'RUNNING']);

export default function ActivityScreen() {
  const [filter, setFilter] = useState<ActivityFilterValue>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const jobsQuery = useQuery({
    queryKey: ['jobs'],
    queryFn: jobsApi.list,
    refetchInterval: (query) =>
      query.state.data?.some((job) => ACTIVE_JOB_STATUSES.has(job.status)) ? 3_000 : false,
  });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'history'],
    queryFn: sessionsApi.history,
    refetchInterval: (query) =>
      query.state.data?.some((session) => session.status === 'ACTIVE') ? 3_000 : false,
  });
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data]);
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);

  const projectsById = useMemo(
    () =>
      new Map<string, Project>((projectsQuery.data ?? []).map((project) => [project.id, project])),
    [projectsQuery.data],
  );

  const sessionsByJobId = useMemo(() => {
    const result = new Map<string, Session>();
    for (const session of sessions) {
      if (session.jobId && !result.has(session.jobId)) {
        result.set(session.jobId, session);
      }
    }
    return result;
  }, [sessions]);

  const visibleJobs = useMemo(
    () => (filter === 'ALL' ? jobs : jobs.filter((job) => job.status === filter)),
    [filter, jobs],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([jobsQuery.refetch(), sessionsQuery.refetch(), projectsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [jobsQuery, projectsQuery, sessionsQuery]);

  const isLoading = jobsQuery.isPending || sessionsQuery.isPending || projectsQuery.isPending;

  if (isLoading) {
    return (
      <Screen>
        <AppHeader title="Activity" subtitle="Command history" />
        <LoadingState label="Loading activity..." />
      </Screen>
    );
  }

  if (jobsQuery.isError && !jobsQuery.data) {
    return (
      <Screen>
        <AppHeader title="Activity" subtitle="Command history" />
        <ErrorState
          message={getErrorMessage(jobsQuery.error, 'Could not load activity.')}
          onRetry={() => void refresh()}
        />
      </Screen>
    );
  }

  const detailError = projectsQuery.isError || sessionsQuery.isError;

  return (
    <Screen>
      <AppHeader
        title="Activity"
        subtitle={`${jobs.length} recent ${jobs.length === 1 ? 'job' : 'jobs'}`}
      />

      <FlatList
        data={visibleJobs}
        keyExtractor={(job) => job.id}
        contentContainerClassName="px-5 pb-10"
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View className="gap-5 pb-4 pt-5">
            <ActivitySummary jobs={jobs} sessions={sessions} />
            <ActivityFilter jobs={jobs} value={filter} onChange={setFilter} />
            {detailError ? (
              <View className="flex-row items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
                <AppText className="min-w-0 flex-1 text-sm text-amber-200">
                  Some project or session details are unavailable.
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading activity details"
                  hitSlop={8}
                  onPress={() => void refresh()}
                >
                  <AppText className="text-sm font-semibold text-amber-100">Retry</AppText>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          jobs.length === 0 ? (
            <EmptyState
              icon="pulse-outline"
              title="No activity yet"
              description="Run a command from a project workspace and it will appear here."
            />
          ) : (
            <EmptyState
              icon="filter-outline"
              title="No matching jobs"
              description="Choose another status to see the rest of your command history."
            />
          )
        }
        renderItem={({ item }) => (
          <JobActivityRow
            job={item}
            project={projectsById.get(item.projectId)}
            session={sessionsByJobId.get(item.id)}
          />
        )}
      />
    </Screen>
  );
}
