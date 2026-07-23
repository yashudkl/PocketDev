import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import type { Job, Session } from '@/types/api';

function SummaryMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <View className="flex-1 items-center px-2 py-3">
      <AppText
        className={accent ? 'text-xl font-bold text-cyan-300' : 'text-xl font-bold text-white'}
      >
        {value}
      </AppText>
      <AppText className="mt-0.5 text-xs text-slate-500">{label}</AppText>
    </View>
  );
}

export function ActivitySummary({ jobs, sessions }: { jobs: Job[]; sessions: Session[] }) {
  const activeJobs = jobs.filter(
    (job) => job.status === 'QUEUED' || job.status === 'RUNNING',
  ).length;
  const succeededJobs = jobs.filter((job) => job.status === 'SUCCEEDED').length;
  const activeSessions = sessions.filter((session) => session.status === 'ACTIVE').length;

  return (
    <Card className="overflow-hidden p-0">
      <View className="flex-row items-center justify-between px-4 py-4">
        <View>
          <AppText variant="label">Recent command runs</AppText>
          <AppText variant="title" className="mt-1">
            {jobs.length}
          </AppText>
        </View>
        <View className="h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
          <View className="h-3 w-3 rounded-full bg-cyan-400" />
        </View>
      </View>
      <View className="flex-row border-t border-slate-800">
        <SummaryMetric label="Active jobs" value={activeJobs} accent={activeJobs > 0} />
        <View className="w-px bg-slate-800" />
        <SummaryMetric label="Succeeded" value={succeededJobs} />
        <View className="w-px bg-slate-800" />
        <SummaryMetric label="Live sessions" value={activeSessions} accent={activeSessions > 0} />
      </View>
    </Card>
  );
}
