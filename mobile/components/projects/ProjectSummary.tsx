import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { colors } from '@/constants/theme';
import type { DesktopStatus, Project } from '@/types/api';
import { formatRelativeDate } from '@/utils/format';

export function ProjectSummary({
  project,
  desktop,
}: {
  project: Project;
  desktop?: DesktopStatus;
}) {
  const desktopReady = Boolean(
    desktop?.online &&
    desktop.tunnelUrl &&
    (desktop.projects?.some((link) => link.projectId === project.id) ||
      desktop.projectId === project.id),
  );

  return (
    <Card className="gap-4">
      <View className="flex-row items-start gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
          <Ionicons name="code-slash" size={24} color={colors.primary} />
        </View>
        <View className="min-w-0 flex-1">
          <AppText variant="heading" numberOfLines={1}>
            {project.name}
          </AppText>
          <AppText variant="mono" className="mt-0.5 text-slate-500">
            {project.slug}
          </AppText>
        </View>
        <Badge
          label={desktopReady ? 'Desktop' : 'Cloud'}
          tone={desktopReady ? 'success' : 'info'}
          dot
        />
      </View>

      {project.description ? (
        <AppText variant="caption" className="leading-5">
          {project.description}
        </AppText>
      ) : null}

      {project.desktopPath ? (
        <View className="rounded-xl bg-slate-800/70 px-3 py-2">
          <AppText variant="caption">Linked desktop folder</AppText>
          <AppText variant="mono" className="mt-1 text-xs text-cyan-300" numberOfLines={2}>
            {project.desktopPath}
          </AppText>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between border-t border-slate-800 pt-3">
        <AppText variant="caption">{desktopReady ? 'Workspace access' : 'Last synced'}</AppText>
        <AppText className="text-sm font-medium text-slate-300">
          {desktopReady ? 'Live from desktop' : formatRelativeDate(project.lastSyncedAt)}
        </AppText>
      </View>
    </Card>
  );
}
