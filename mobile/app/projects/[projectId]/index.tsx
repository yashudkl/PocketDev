import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { desktopApi, projectsApi } from '@/api/pocketdev';
import { ProjectSummary } from '@/components/projects/ProjectSummary';
import { WorkspaceAction } from '@/components/projects/WorkspaceAction';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, LoadingState } from '@/components/ui/StateView';
import { getErrorMessage } from '@/utils/errors';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default function ProjectWorkspaceScreen() {
  const { projectId: rawProjectId } = useLocalSearchParams<{ projectId: string }>();
  const projectId = param(rawProjectId);
  const queryClient = useQueryClient();
  const [command, setCommand] = useState('npm run');

  const projectQuery = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: Boolean(projectId),
  });
  const desktopQuery = useQuery({
    queryKey: ['desktop-status'],
    queryFn: desktopApi.status,
    refetchInterval: 15_000,
  });
  const removeMutation = useMutation({
    mutationFn: () => projectsApi.remove(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      Toast.show({ type: 'success', text1: 'Project deleted' });
      router.replace('/(tabs)/home');
    },
    onError: (error) =>
      Toast.show({
        type: 'error',
        text1: 'Could not delete project',
        text2: getErrorMessage(error),
      }),
  });

  const project = projectQuery.data;

  const confirmDelete = () => {
    Alert.alert(
      'Delete project?',
      'This removes the project record, its jobs, and sessions. Your original local folder is not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeMutation.mutate(),
        },
      ],
    );
  };

  if (projectQuery.isLoading) {
    return (
      <Screen>
        <AppHeader title="Workspace" back />
        <LoadingState label="Opening project…" />
      </Screen>
    );
  }

  if (!project) {
    return (
      <Screen>
        <AppHeader title="Workspace" back />
        <ErrorState
          message={getErrorMessage(projectQuery.error, 'Project not found.')}
          onRetry={() => void projectQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll contentClassName="gap-5 pt-5">
      <AppHeader title={project.name} subtitle="Project workspace" back />
      <ProjectSummary project={project} desktop={desktopQuery.data} />

      <View>
        <AppText variant="label" className="mb-3">
          Workspace
        </AppText>
        <View className="flex-row gap-3">
          <WorkspaceAction
            icon="folder-open-outline"
            title="Files"
            description="Browse and edit"
            onPress={() =>
              router.push({
                pathname: '/projects/[projectId]/files',
                params: { projectId },
              })
            }
          />
          <WorkspaceAction
            icon="git-branch-outline"
            title="Git"
            description="Commit and push"
            onPress={() =>
              router.push({
                pathname: '/projects/[projectId]/git',
                params: { projectId },
              })
            }
          />
        </View>
      </View>

      <Card>
        <AppText variant="heading">Run a command</AppText>
        <AppText variant="caption" className="mt-1 leading-5">
          Starts a persistent interactive shell, runs this first command, and stays open for more.
        </AppText>
        <Input
          label="Command"
          value={command}
          onChangeText={setCommand}
          autoCapitalize="none"
          autoCorrect={false}
          className="font-mono"
          containerClassName="mt-4"
          returnKeyType="go"
          onSubmitEditing={() => {
            if (!command.trim()) return;
            router.push({
              pathname: '/projects/[projectId]/terminal',
              params: { projectId, command: command.trim(), autorun: '1' },
            });
          }}
        />
        <Button
          label="Open terminal"
          icon="terminal-outline"
          fullWidth
          className="mt-4"
          disabled={!command.trim()}
          onPress={() =>
            router.push({
              pathname: '/projects/[projectId]/terminal',
              params: { projectId, command: command.trim() },
            })
          }
        />
      </Card>

      <Card className="gap-1">
        <AppText variant="heading">Project details</AppText>
        <View className="mt-3 flex-row justify-between gap-4">
          <AppText variant="caption">Created</AppText>
          <AppText className="text-sm text-slate-300">
            {new Date(project.createdAt).toLocaleDateString()}
          </AppText>
        </View>
        <View className="mt-2 flex-row justify-between gap-4">
          <AppText variant="caption">Project ID</AppText>
          <AppText variant="mono" className="max-w-[65%] text-xs text-slate-400" numberOfLines={1}>
            {project.id}
          </AppText>
        </View>
        <View className="mt-2 flex-row justify-between gap-4">
          <AppText variant="caption">Desktop link</AppText>
          <AppText
            variant="mono"
            className="max-w-[65%] text-right text-xs text-slate-400"
            numberOfLines={2}
          >
            {project.desktopPath ?? 'Not linked'}
          </AppText>
        </View>
      </Card>

      <Button
        label="Delete project"
        variant="danger"
        icon="trash-outline"
        loading={removeMutation.isPending}
        onPress={confirmDelete}
      />
    </Screen>
  );
}
