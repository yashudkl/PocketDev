import type { JobStatus } from '@pocketdev/shared';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { Job } from '@/types/api';
import { cn } from '@/utils/cn';

export type ActivityFilterValue = 'ALL' | JobStatus;

const FILTERS: readonly {
  value: ActivityFilterValue;
  label: string;
}[] = [
  { value: 'ALL', label: 'All' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'QUEUED', label: 'Queued' },
  { value: 'SUCCEEDED', label: 'Succeeded' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELED', label: 'Canceled' },
];

export function ActivityFilter({
  jobs,
  value,
  onChange,
}: {
  jobs: Job[];
  value: ActivityFilterValue;
  onChange: (value: ActivityFilterValue) => void;
}) {
  return (
    <View>
      <AppText variant="label" className="mb-3">
        Filter by status
      </AppText>
      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const selected = value === filter.value;
          const count =
            filter.value === 'ALL'
              ? jobs.length
              : jobs.filter((job) => job.status === filter.value).length;

          return (
            <Pressable
              key={filter.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${filter.label}, ${count} jobs`}
              onPress={() => onChange(filter.value)}
              className={cn(
                'flex-row items-center gap-1.5 rounded-full border px-3 py-2',
                selected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-700 bg-slate-900',
              )}
            >
              <AppText
                className={cn(
                  'text-sm font-semibold',
                  selected ? 'text-slate-950' : 'text-slate-300',
                )}
              >
                {filter.label}
              </AppText>
              <View
                className={cn(
                  'min-w-5 items-center rounded-full px-1.5 py-0.5',
                  selected ? 'bg-slate-950/15' : 'bg-slate-800',
                )}
              >
                <AppText
                  className={cn(
                    'text-[11px] font-bold',
                    selected ? 'text-slate-950' : 'text-slate-400',
                  )}
                >
                  {count}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
