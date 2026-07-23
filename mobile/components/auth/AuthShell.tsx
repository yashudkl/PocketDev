import { Ionicons } from '@expo/vector-icons';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/theme';

interface AuthShellProps extends PropsWithChildren {
  title: string;
  subtitle: string;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <Screen scroll keyboard contentClassName="flex-grow justify-center py-10">
      <View className="mb-10">
        <View className="mb-6 h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10">
          <Ionicons name="terminal" size={28} color={colors.primary} />
        </View>
        <AppText variant="display">{title}</AppText>
        <AppText variant="body" className="mt-2 leading-6 text-slate-400">
          {subtitle}
        </AppText>
      </View>
      {children}
    </Screen>
  );
}
