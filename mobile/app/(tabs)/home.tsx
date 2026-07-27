import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { desktopApi, projectsApi } from '@/api/pocketdev';
import {
  CreateProjectModal,
  type CreateProjectValues,
} from '@/components/projects/CreateProjectModal';
import { NewProjectModal } from '@/components/projects/NewProjectModal';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateView';
import { colors } from '@/constants/theme';
import type { Project } from '@/types/api';
import { getErrorMessage } from '@/utils/errors';

export default function ProjectsScreen() {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateProjectValues) => projectsApi.create(values),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(['projects'], (projects = []) => [
        project,
        ...projects.filter((item) => item.id !== project.id),
      ]);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreateOpen(false);
      Toast.show({
        type: 'success',
        text1: 'Project created',
        text2: `${project.name} is ready to open.`,
      });
    },
  });

  const linkDesktopMutation = useMutation({
    mutationFn: async ({ name, path }: { name: string; path: string }) => {
      const project = await projectsApi.create({ name: name.slice(0, 80) });
      try {
        return await desktopApi.link(project.id, path);
      } catch (error) {
        await projectsApi.remove(project.id).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(['projects'], (projects = []) => [
        project,
        ...projects.filter((item) => item.id !== project.id),
      ]);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['desktop-status'] });
      void queryClient.invalidateQueries({ queryKey: ['files', project.id] });
      void queryClient.invalidateQueries({ queryKey: ['git', project.id] });
      setNewOpen(false);
      Toast.show({
        type: 'success',
        text1: 'Desktop project linked',
        text2: `${project.name} now opens from ${project.desktopPath}.`,
      });
      router.push(`/projects/${encodeURIComponent(project.id)}` as Href);
    },
  });

  const projects = projectsQuery.data ?? [];
  const projectCountLabel = projectsQuery.isSuccess
    ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
    : 'Your mobile workspaces';

  return (
    <Screen>
      <AppHeader
        title="Projects"
        subtitle={projectCountLabel}
        right={<Button label="New" icon="add" size="sm" onPress={() => setNewOpen(true)} />}
      />

      {projectsQuery.isLoading ? (
        <LoadingState label="Loading projects…" />
      ) : projectsQuery.isError && !projectsQuery.data ? (
        <ErrorState
          message={getErrorMessage(
            projectsQuery.error,
            'Your projects could not be loaded. Check your connection and try again.',
          )}
          onRetry={() => void projectsQuery.refetch()}
        />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(project) => project.id}
          className="flex-1"
          contentContainerClassName="grow px-5 pb-28 pt-5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={projectsQuery.isRefetching}
              onRefresh={() => void projectsQuery.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.elevated}
            />
          }
          ListHeaderComponent={
            projects.length > 0 ? (
              <View className="mb-4">
                <AppText variant="label">Recent workspaces</AppText>
                <AppText variant="caption" className="mt-1 leading-5">
                  Open a project to browse files, run commands, and manage Git.
                </AppText>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => router.push(`/projects/${encodeURIComponent(item.id)}` as Href)}
            />
          )}
          ListEmptyComponent={
            <View className="flex-1 justify-center">
              <EmptyState
                icon="folder-open-outline"
                title="Add your first project"
                description="Link a folder from your connected desktop or create a blank workspace."
                actionLabel="New project"
                onAction={() => setNewOpen(true)}
              />
            </View>
          }
        />
      )}

      <NewProjectModal
        visible={newOpen}
        onClose={() => setNewOpen(false)}
        onCreateBlank={() => setCreateOpen(true)}
        onSelectDesktopFolder={(selection) => linkDesktopMutation.mutateAsync(selection)}
      />

      <CreateProjectModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(values) => createMutation.mutateAsync(values)}
      />
    </Screen>
  );
}
