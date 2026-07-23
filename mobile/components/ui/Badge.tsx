import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/utils/cn';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const container: Record<BadgeTone, string> = {
  neutral: 'border-slate-700 bg-slate-800',
  primary: 'border-cyan-500/30 bg-cyan-500/10',
  success: 'border-green-500/30 bg-green-500/10',
  warning: 'border-amber-500/30 bg-amber-500/10',
  danger: 'border-red-500/30 bg-red-500/10',
  info: 'border-blue-500/30 bg-blue-500/10',
};

const text: Record<BadgeTone, string> = {
  neutral: 'text-slate-300',
  primary: 'text-cyan-300',
  success: 'text-green-300',
  warning: 'text-amber-300',
  danger: 'text-red-300',
  info: 'text-blue-300',
};

export function Badge({
  label,
  tone = 'neutral',
  dot = false,
}: {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
}) {
  return (
    <View
      className={cn(
        'self-start flex-row items-center gap-1.5 rounded-full border px-2.5 py-1',
        container[tone],
      )}
    >
      {dot ? (
        <View className={cn('h-1.5 w-1.5 rounded-full', text[tone].replace('text-', 'bg-'))} />
      ) : null}
      <AppText className={cn('text-xs font-semibold', text[tone])}>{label}</AppText>
    </View>
  );
}
