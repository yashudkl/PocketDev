import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  className?: string;
}

export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  right,
  danger = false,
  className,
}: ListRowProps) {
  const content = (
    <>
      {icon ? (
        <View
          className={cn(
            'h-10 w-10 items-center justify-center rounded-xl',
            danger ? 'bg-red-500/10' : 'bg-slate-800',
          )}
        >
          <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <AppText className={cn('font-semibold', danger && 'text-red-300')} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ??
        (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.subtle} /> : null)}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className={cn('flex-row items-center gap-3 px-4 py-3.5', className)}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className={cn('flex-row items-center gap-3 px-4 py-3.5', className)}>{content}</View>
  );
}
