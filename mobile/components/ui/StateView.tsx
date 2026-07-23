import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-12">
      <ActivityIndicator color={colors.primary} />
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center justify-center px-8 py-14">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-slate-900">
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <AppText variant="heading" className="text-center">
        {title}
      </AppText>
      <AppText variant="caption" className="mt-2 text-center leading-5">
        {description}
      </AppText>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          variant="secondary"
          size="sm"
          onPress={onAction}
          className="mt-5"
        />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="warning-outline"
      title="Couldn’t load this"
      description={message}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}
