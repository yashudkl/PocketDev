import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors } from '@/constants/theme';
import type { Subscription, User } from '@/types/api';

function formatReset(value?: string): string {
  if (!value) return 'Reset time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Reset time unavailable';

  return `Resets ${date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

interface PlanCardProps {
  tier: User['tier'];
  subscription?: Subscription | null;
  loading?: boolean;
  actionDisabled?: boolean;
  error?: string;
  onChangePlan: () => void;
}

export function PlanCard({
  tier,
  subscription,
  loading = false,
  actionDisabled = false,
  error,
  onChangePlan,
}: PlanCardProps) {
  const effectiveTier = subscription?.tier ?? tier;
  const isPaid = effectiveTier === 'PAID';
  const used = subscription?.jobsUsedToday;
  const limit = subscription?.quotaJobsPerDay;
  const hasQuota = typeof used === 'number' && typeof limit === 'number';
  const progress = hasQuota && limit > 0 ? Math.max(0, Math.min(100, (used / limit) * 100)) : 0;
  const remaining = hasQuota ? Math.max(0, limit - used) : null;

  return (
    <Card className="gap-4 border-cyan-500/20">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <AppText variant="label">Plan & daily quota</AppText>
          <AppText variant="heading" className="mt-1">
            {isPaid ? 'PocketDev Paid' : 'PocketDev Free'}
          </AppText>
        </View>
        <Badge
          label={subscription?.status || 'Account plan'}
          tone={isPaid ? 'primary' : 'neutral'}
        />
      </View>

      <View className="rounded-xl bg-slate-950/60 p-4">
        <View className="flex-row items-end justify-between gap-3">
          <View>
            <AppText variant="caption">Cloud jobs today</AppText>
            <AppText className="mt-1 text-2xl font-bold text-white">
              {hasQuota ? used : '—'}
              <AppText className="text-base font-normal text-slate-500">
                {hasQuota ? ` / ${limit}` : ''}
              </AppText>
            </AppText>
          </View>
          <AppText variant="caption" className="text-right">
            {remaining === null ? 'Quota unavailable' : `${remaining} remaining`}
          </AppText>
        </View>
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <View className="h-full rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
        </View>
        <AppText variant="caption" className="mt-2 text-xs">
          {formatReset(subscription?.quotaResetAt)}
        </AppText>
      </View>

      {error && !subscription ? (
        <View className="flex-row items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <AppText variant="caption" className="min-w-0 flex-1 text-red-300">
            {error}
          </AppText>
        </View>
      ) : null}

      <View className="flex-row items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
        <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
        <AppText variant="caption" className="min-w-0 flex-1 leading-5 text-amber-200">
          Demo tier changes apply immediately. Paid jobs receive priority in the shared queue; Free
          jobs use standard priority.
        </AppText>
      </View>

      <Button
        label={isPaid ? 'Switch to Free demo' : 'Try Paid demo'}
        icon={isPaid ? 'arrow-down-circle-outline' : 'sparkles-outline'}
        variant={isPaid ? 'secondary' : 'primary'}
        fullWidth
        loading={loading}
        disabled={actionDisabled}
        onPress={onChangePlan}
      />
    </Card>
  );
}
