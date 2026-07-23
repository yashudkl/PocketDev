import type { FileNode } from '@pocketdev/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { filesApi, projectsApi } from '@/api/pocketdev';
import { CreateFileModal } from '@/components/files/CreateFileModal';
import { FileTreeRow } from '@/components/files/FileTreeRow';
import { AppHeader } from '@/components/ui/AppHeader';
import { IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateView';
import { colors } from '@/constants/theme';
import { getErrorMessage } from '@/utils/errors';

interface FlatNode {
  node: FileNode;
  depth: number;
}

function flattenTree(root: FileNode, expanded: Set<string>, search: string): FlatNode[] {
  const rows: FlatNode[] = [];
  const needle = search.trim().toLowerCase();

  const visit = (nodes: FileNode[], depth: number) => {
    for (const node of nodes) {
      if (needle) {
        if (node.type === 'file' && node.path.toLowerCase().includes(needle)) {
          rows.push({ node, depth: 0 });
        }
        continue;
      }
      rows.push({ node, depth });
      if (node.type === 'dir' && expanded.has(node.path)) {
        visit(node.children ?? [], depth + 1);
      }
    }
  };

  visit(root.children ?? [], 0);
  return rows;
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default function FilesScreen() {
  const params = useLocalSearchParams<{ projectId: string }>();
  const projectId = param(params.projectId);
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const [search, setSearch] = useState('');
  const [createVisible, setCreateVisible] = useState(false);

  const projectQuery = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const treeQuery = useQuery({
    queryKey: ['files', projectId],
    queryFn: () => filesApi.tree(projectId),
  });

  const createMutation = useMutation({
    mutationFn: (path: string) => filesApi.write(projectId, path, '', { createOnly: true }),
    onSuccess: async (_, path) => {
      setCreateVisible(false);
      await queryClient.invalidateQueries({ queryKey: ['files', projectId] });
      router.push({
        pathname: '/projects/[projectId]/editor',
        params: { projectId, path },
      });
    },
    onError: (error) =>
      Toast.show({ type: 'error', text1: 'Could not create file', text2: getErrorMessage(error) }),
  });
  const deleteMutation = useMutation({
    mutationFn: (path: string) => filesApi.remove(projectId, path),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['files', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['git', projectId] }),
      ]);
      Toast.show({ type: 'success', text1: 'Deleted' });
    },
    onError: (error) =>
      Toast.show({ type: 'error', text1: 'Could not delete', text2: getErrorMessage(error) }),
  });

  const rows = useMemo(
    () => (treeQuery.data ? flattenTree(treeQuery.data, expanded, search) : []),
    [expanded, search, treeQuery.data],
  );

  const toggleDirectory = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const confirmDelete = (node: FileNode) => {
    Alert.alert(
      `Delete ${node.type === 'dir' ? 'folder' : 'file'}?`,
      node.type === 'dir' ? `${node.path} and everything inside it will be deleted.` : node.path,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(node.path),
        },
      ],
    );
  };

  return (
    <Screen>
      <AppHeader
        title="Files"
        subtitle={projectQuery.data?.name}
        back
        right={<IconButton icon="add" label="Create file" onPress={() => setCreateVisible(true)} />}
      />
      <View className="px-4 py-3">
        <Input
          placeholder="Search files…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          className="h-11"
        />
      </View>

      {treeQuery.isLoading ? (
        <LoadingState label="Loading file tree…" />
      ) : treeQuery.error ? (
        <ErrorState
          message={getErrorMessage(treeQuery.error)}
          onRetry={() => void treeQuery.refetch()}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={({ node }) => node.path}
          renderItem={({ item: { node, depth } }) => (
            <FileTreeRow
              node={node}
              depth={depth}
              expanded={node.type === 'dir' && expanded.has(node.path)}
              onPress={() => {
                if (node.type === 'dir') {
                  toggleDirectory(node.path);
                } else {
                  router.push({
                    pathname: '/projects/[projectId]/editor',
                    params: { projectId, path: node.path },
                  });
                }
              }}
              onLongPress={() => confirmDelete(node)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={search ? 'search-outline' : 'folder-open-outline'}
              title={search ? 'No matching files' : 'No files synced yet'}
              description={
                search
                  ? 'Try a different file name or path.'
                  : 'Run the PocketDev CLI sync agent, or create a file here.'
              }
              actionLabel={!search ? 'Create file' : undefined}
              onAction={!search ? () => setCreateVisible(true) : undefined}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={treeQuery.isRefetching}
              onRefresh={() => void treeQuery.refetch()}
              tintColor={colors.primary}
            />
          }
          keyboardShouldPersistTaps="handled"
        />
      )}

      {createVisible ? (
        <CreateFileModal
          visible
          loading={createMutation.isPending}
          onClose={() => setCreateVisible(false)}
          onCreate={(path) => createMutation.mutate(path)}
        />
      ) : null}
    </Screen>
  );
}
