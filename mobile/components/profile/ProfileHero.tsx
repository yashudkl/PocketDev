import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { colors } from '@/constants/theme';
import type { User } from '@/types/api';
import { initials } from '@/utils/format';

function getMemberSince(value?: string): string {
  if (!value) return 'PocketDev member';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'PocketDev member';

  return `Member since ${date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })}`;
}

export function ProfileHero({ user, tier }: { user: User; tier: User['tier'] }) {
  const isPaid = tier === 'PAID';
  const displayName = user.name?.trim() || 'PocketDev developer';

  return (
    <Card className="overflow-hidden border-cyan-500/20 bg-[#0B1119] p-0">
      <View className="h-1 bg-cyan-400" />
      <View className="p-5">
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
            <AppText className="text-2xl font-bold text-cyan-300">
              {initials(user.name, user.email) || 'PD'}
            </AppText>
          </View>
          <View className="min-w-0 flex-1">
            <AppText variant="heading" numberOfLines={1}>
              {displayName}
            </AppText>
            <AppText variant="caption" className="mt-0.5" numberOfLines={1}>
              {user.email}
            </AppText>
            <View className="mt-2">
              <Badge
                label={isPaid ? 'Paid workspace' : 'Free workspace'}
                tone={isPaid ? 'primary' : 'neutral'}
              />
            </View>
          </View>
        </View>

        <View className="mt-5 flex-row items-center justify-between gap-4 border-t border-slate-800 pt-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={16} color={colors.muted} />
            <AppText variant="caption">{getMemberSince(user.createdAt)}</AppText>
          </View>
          <AppText variant="mono" className="max-w-28 text-xs text-slate-500" numberOfLines={1}>
            {user.id}
          </AppText>
        </View>
      </View>
    </Card>
  );
}
