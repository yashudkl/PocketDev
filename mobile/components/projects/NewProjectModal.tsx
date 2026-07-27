import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { DesktopDirectoryListing } from '@pocketdev/shared';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { desktopApi } from '@/api/pocketdev';
import { AppText } from '@/components/ui/AppText';
import { Button, IconButton } from '@/components/ui/Button';
import { colors } from '@/constants/theme';
import { getErrorMessage } from '@/utils/errors';

interface DesktopFolderSelection {
  name: string;
  path: string;
}

interface NewProjectModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateBlank: () => void;
  onSelectDesktopFolder: (selection: DesktopFolderSelection) => Promise<unknown>;
}

type ViewMode = 'choices' | 'browse';

export function NewProjectModal({
  visible,
  onClose,
  onCreateBlank,
  onSelectDesktopFolder,
}: NewProjectModalProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<ViewMode>('choices');
  const [path, setPath] = useState<string | undefined>();
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const desktopQuery = useQuery({
    queryKey: ['desktop-status'],
    queryFn: desktopApi.status,
    enabled: visible,
    refetchInterval: visible ? 10_000 : false,
  });
  const browseQuery = useQuery({
    queryKey: ['desktop-browse', path ?? '<roots>'],
    queryFn: () => desktopApi.browse(path),
    enabled: visible && mode === 'browse' && Boolean(desktopQuery.data?.online),
  });

  const close = () => {
    if (!linking) onClose();
  };

  const showBlankForm = () => {
    if (linking) return;
    onClose();
    onCreateBlank();
  };

  const goBack = () => {
    setLinkError(null);
    if (mode === 'choices') {
      close();
      return;
    }
    const listing = browseQuery.data;
    if (!listing?.path) {
      setMode('choices');
      return;
    }
    setPath(listing.parentPath ?? undefined);
  };

  const selectCurrentFolder = async (listing: DesktopDirectoryListing) => {
    if (!listing.path || linking) return;
    setLinkError(null);
    setLinking(true);
    try {
      await onSelectDesktopFolder({
        name: listing.name,
        path: listing.path,
      });
    } catch (error) {
      setLinkError(getErrorMessage(error, 'Could not link this desktop folder.'));
      setLinking(false);
    }
  };

  const desktop = desktopQuery.data;
  const desktopOnline = Boolean(desktop?.online && desktop.tunnelUrl);
  const listing = browseQuery.data;
  const canSelectCurrentFolder = Boolean(listing?.path && listing.parentPath !== null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
      onShow={() => {
        setMode('choices');
        setPath(undefined);
        setLinkError(null);
        setLinking(false);
      }}
    >
      <View className="flex-1 justify-end bg-black/75">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close new project options"
          className="flex-1"
          onPress={close}
        />

        <View
          className="max-h-[92%] min-h-[58%] rounded-t-3xl border-t border-slate-700 bg-slate-950"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          <View className="items-center pb-2 pt-3">
            <View className="h-1 w-10 rounded-full bg-slate-700" />
          </View>

          <View className="flex-row items-center gap-3 px-5 pb-4">
            <IconButton
              icon="arrow-back"
              label={mode === 'browse' ? 'Go back' : 'Close'}
              size={19}
              disabled={linking}
              onPress={goBack}
            />
            <View className="min-w-0 flex-1">
              <AppText variant="title">
                {mode === 'browse' ? 'Select desktop folder' : 'New project'}
              </AppText>
              <AppText variant="caption" className="mt-1" numberOfLines={1}>
                {mode === 'browse'
                  ? (listing?.path ?? 'Choose a drive')
                  : 'Link existing code or start with a blank workspace.'}
              </AppText>
            </View>
          </View>

          {mode === 'choices' ? (
            <ScrollView
              className="px-5"
              contentContainerClassName="gap-4 pb-4"
              showsVerticalScrollIndicator={false}
            >
              <View className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <View className="flex-row items-start gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/15">
                    <Ionicons name="desktop-outline" size={23} color={colors.primary} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-2">
                      <AppText variant="heading">From connected desktop</AppText>
                      {desktopOnline ? (
                        <View className="h-2 w-2 rounded-full bg-emerald-400" />
                      ) : null}
                    </View>
                    <AppText variant="caption" className="mt-1 leading-5">
                      {desktopQuery.isLoading
                        ? 'Checking your desktop connection…'
                        : desktopOnline
                          ? `${desktop?.deviceName ?? 'Desktop'} is online. Browse its drives and choose an existing project folder.`
                          : 'Start your desktop agent to browse drives and link an existing folder.'}
                    </AppText>
                  </View>
                </View>
                {desktopQuery.isError ? (
                  <AppText className="mt-3 text-sm text-red-300">
                    {getErrorMessage(desktopQuery.error, 'Desktop status is unavailable.')}
                  </AppText>
                ) : null}
                <Button
                  label={desktopOnline ? 'Browse desktop' : 'Desktop offline'}
                  icon="folder-open-outline"
                  className="mt-4"
                  fullWidth
                  disabled={!desktopOnline}
                  onPress={() => {
                    setPath(undefined);
                    setMode('browse');
                  }}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create a blank project"
                className="rounded-2xl border border-slate-800 bg-slate-900 p-4 active:border-slate-600 active:bg-slate-800"
                disabled={linking}
                onPress={showBlankForm}
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-slate-800">
                    <Ionicons name="add-circle-outline" size={23} color={colors.text} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <AppText variant="heading">Create blank project</AppText>
                    <AppText variant="caption" className="mt-1 leading-5">
                      Keep the existing flow and create an empty PocketDev workspace.
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={colors.muted} />
                </View>
              </Pressable>
            </ScrollView>
          ) : (
            <View className="min-h-0 flex-1">
              {browseQuery.isLoading ? (
                <View className="flex-1 items-center justify-center gap-3 px-5">
                  <ActivityIndicator color={colors.primary} />
                  <AppText variant="caption">Reading folders from your desktop…</AppText>
                </View>
              ) : browseQuery.isError ? (
                <View className="flex-1 justify-center px-5">
                  <View className="items-center rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                    <Ionicons name="warning-outline" size={28} color={colors.danger} />
                    <AppText variant="heading" className="mt-3 text-center">
                      Couldn’t open this location
                    </AppText>
                    <AppText variant="caption" className="mt-2 text-center leading-5">
                      {getErrorMessage(
                        browseQuery.error,
                        'Restart the connected desktop agent and try again.',
                      )}
                    </AppText>
                    <Button
                      label="Try again"
                      variant="secondary"
                      size="sm"
                      className="mt-4"
                      onPress={() => void browseQuery.refetch()}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <ScrollView
                    className="px-5"
                    contentContainerClassName="gap-2 pb-3"
                    showsVerticalScrollIndicator={false}
                  >
                    {listing?.entries.map((entry) => (
                      <Pressable
                        key={entry.path}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${entry.name}`}
                        className="flex-row items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 active:border-cyan-500/40 active:bg-slate-800"
                        onPress={() => {
                          setLinkError(null);
                          setPath(entry.path);
                        }}
                      >
                        <View className="h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
                          <Ionicons
                            name={entry.kind === 'drive' ? 'server-outline' : 'folder-outline'}
                            size={21}
                            color={entry.hasGit ? colors.success : colors.primary}
                          />
                        </View>
                        <View className="min-w-0 flex-1">
                          <AppText variant="body" numberOfLines={1}>
                            {entry.name}
                          </AppText>
                          {entry.hasGit ? (
                            <AppText variant="caption" className="mt-0.5 text-emerald-400">
                              Git repository
                            </AppText>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                      </Pressable>
                    ))}

                    {listing && listing.entries.length === 0 ? (
                      <View className="items-center py-12">
                        <Ionicons name="folder-open-outline" size={30} color={colors.subtle} />
                        <AppText variant="caption" className="mt-3">
                          This folder has no subfolders.
                        </AppText>
                      </View>
                    ) : null}
                  </ScrollView>

                  <View className="border-t border-slate-800 px-5 pt-4">
                    {linkError ? (
                      <AppText className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {linkError}
                      </AppText>
                    ) : null}
                    <Button
                      label={
                        canSelectCurrentFolder
                          ? `Use ${listing?.name ?? 'this folder'}`
                          : 'Open a project folder'
                      }
                      icon="link-outline"
                      fullWidth
                      disabled={!canSelectCurrentFolder}
                      loading={linking}
                      onPress={() => {
                        if (listing) void selectCurrentFolder(listing);
                      }}
                    />
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
