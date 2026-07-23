import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { ListRow } from '@/components/ui/ListRow';
import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';

type IconName = ComponentProps<typeof Ionicons>['name'];
type BadgeTone = NonNullable<ComponentProps<typeof Badge>['tone']>;

interface ProfileSettingRowProps {
  icon: IconName;
  title: string;
  description?: string;
  value?: string;
  status?: {
    label: string;
    tone?: BadgeTone;
    dot?: boolean;
  };
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
  last?: boolean;
  onPress?: () => void;
}

export function ProfileSettingRow({
  icon,
  title,
  description,
  value,
  status,
  loading = false,
  disabled = false,
  danger = false,
  last = false,
  onPress,
}: ProfileSettingRowProps) {
  const canPress = Boolean(onPress && !disabled && !loading);

  return (
    <ListRow
      icon={icon}
      title={title}
      subtitle={description}
      danger={danger}
      onPress={canPress ? onPress : undefined}
      className={cn(!last && 'border-b border-slate-800/80', disabled && 'opacity-60')}
      right={
        <View className="ml-2 flex-row items-center gap-2">
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : status ? (
            <Badge label={status.label} tone={status.tone} dot={status.dot} />
          ) : value ? (
            <AppText
              variant="caption"
              className="max-w-32 text-right text-slate-300"
              numberOfLines={1}
            >
              {value}
            </AppText>
          ) : null}
          {canPress ? <Ionicons name="chevron-forward" size={17} color={colors.subtle} /> : null}
        </View>
      }
    />
  );
}
