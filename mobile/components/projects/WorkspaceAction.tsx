import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function WorkspaceAction({
  icon,
  title,
  description,
  onPress,
}: {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-1 rounded-2xl border border-slate-800 bg-slate-900 p-4"
    >
      <View className="mb-4 h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10">
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <AppText className="font-bold text-white">{title}</AppText>
      <AppText variant="caption" className="mt-1 leading-5">
        {description}
      </AppText>
    </Pressable>
  );
}
