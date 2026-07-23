import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/constants/theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
}

export function AppHeader({ title, subtitle, back = false, onBack, right }: AppHeaderProps) {
  return (
    <View className="flex-row items-center gap-3 border-b border-slate-900 px-5 py-3">
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={onBack ?? (() => router.back())}
          className="h-10 w-10 items-center justify-center rounded-xl bg-slate-900"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      ) : null}
      <View className="min-w-0 flex-1">
        <AppText variant="heading" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}
