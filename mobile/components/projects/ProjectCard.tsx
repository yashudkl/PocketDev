import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import type { Project } from '@/types/api';
import { formatRelativeDate } from '@/utils/format';

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
}

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const activityLabel = project.lastSyncedAt
    ? `Synced ${formatRelativeDate(project.lastSyncedAt)}`
    : `Updated ${formatRelativeDate(project.updatedAt)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${project.name}`}
      accessibilityHint="Opens the project workspace"
      onPress={onPress}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-4 active:border-cyan-500/50 active:bg-slate-800"
    >
      <View className="flex-row items-start gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
          <Ionicons name="code-slash" size={23} color={colors.primary} />
        </View>

        <View className="min-w-0 flex-1">
          <AppText variant="heading" numberOfLines={1}>
            {project.name}
          </AppText>
          <AppText variant="mono" className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
            {project.slug}
          </AppText>
        </View>

        <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-800">
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
      </View>

      {project.description ? (
        <AppText variant="caption" className="mt-4 leading-5" numberOfLines={2}>
          {project.description}
        </AppText>
      ) : (
        <AppText variant="caption" className="mt-4 italic text-slate-500">
          No description yet
        </AppText>
      )}

      <View className="mt-4 flex-row items-center border-t border-slate-800 pt-3">
        <Ionicons name="time-outline" size={15} color={colors.subtle} />
        <AppText variant="caption" className="ml-1.5 text-xs">
          {activityLabel}
        </AppText>
      </View>
    </Pressable>
  );
}
