import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { colors } from '@/constants/theme';
import type { Job, Project, Session } from '@/types/api';
import { formatRelativeDate } from '@/utils/format';

type BadgeTone = ComponentProps<typeof Badge>['tone'];
type IconName = ComponentProps<typeof Ionicons>['name'];

const STATUS_DISPLAY: Record<Job['status'], { label: string; tone: BadgeTone; icon: IconName }> = {
  QUEUED: { label: 'Queued', tone: 'warning', icon: 'time-outline' },
  RUNNING: { label: 'Running', tone: 'primary', icon: 'pulse-outline' },
  SUCCEEDED: {
    label: 'Succeeded',
    tone: 'success',
    icon: 'checkmark-circle-outline',
  },
  FAILED: { label: 'Failed', tone: 'danger', icon: 'close-circle-outline' },
  CANCELED: {
    label: 'Canceled',
    tone: 'neutral',
    icon: 'remove-circle-outline',
  },
};

export function JobActivityRow({
  job,
  project,
  session,
}: {
  job: Job;
  project?: Project;
  session?: Session;
}) {
  const status = STATUS_DISPLAY[job.status];
  const successfulExit = job.exitCode === 0;
  const date = job.finishedAt ?? job.startedAt ?? job.createdAt;

  return (
    <Card className="gap-3">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-slate-800">
          <Ionicons name={status.icon} size={20} color={colors.primary} />
        </View>
        <View className="min-w-0 flex-1">
          <AppText variant="mono" className="font-semibold text-white" numberOfLines={2}>
            $ {job.command}
          </AppText>
          <View className="mt-1.5 flex-row items-center gap-1.5">
            <Ionicons name="folder-outline" size={13} color={colors.subtle} />
            <AppText variant="caption" className="min-w-0 flex-1" numberOfLines={1}>
              {project?.name ?? `Project ${job.projectId.slice(0, 8)}`}
            </AppText>
          </View>
        </View>
        <Badge label={status.label} tone={status.tone} dot />
      </View>

      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800 pt-3">
        <View className="flex-row items-center gap-1.5">
          <Ionicons
            name={job.target === 'DESKTOP' ? 'desktop-outline' : 'cloud-outline'}
            size={14}
            color={colors.muted}
          />
          <AppText className="text-xs font-medium text-slate-400">
            {job.target === 'DESKTOP' ? 'Desktop' : 'Cloud'}
          </AppText>
        </View>

        <View className="flex-row items-center gap-1.5">
          <Ionicons name="code-working-outline" size={14} color={colors.muted} />
          <AppText
            className={
              job.exitCode === null
                ? 'text-xs font-medium text-slate-500'
                : successfulExit
                  ? 'text-xs font-semibold text-green-300'
                  : 'text-xs font-semibold text-red-300'
            }
          >
            Exit {job.exitCode ?? 'pending'}
          </AppText>
        </View>

        {session?.status === 'ACTIVE' ? (
          <View className="flex-row items-center gap-1.5">
            <View className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <AppText className="text-xs font-semibold text-cyan-300">Live session</AppText>
          </View>
        ) : null}

        <View className="ml-auto flex-row items-center gap-1.5">
          <Ionicons name="calendar-outline" size={14} color={colors.muted} />
          <AppText className="text-xs text-slate-500">{formatRelativeDate(date)}</AppText>
        </View>
      </View>
    </Card>
  );
}
