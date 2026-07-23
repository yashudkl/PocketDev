import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  View,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '@/utils/cn';

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  keyboard?: boolean;
  className?: string;
  contentClassName?: string;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  scrollProps?: ScrollViewProps;
  viewProps?: ViewProps;
}

export function Screen({
  children,
  scroll = false,
  keyboard = false,
  className,
  contentClassName,
  edges = ['top', 'left', 'right'],
  scrollProps,
  viewProps,
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      className={cn('flex-1', className)}
      contentContainerClassName={cn('px-5 pb-10', contentClassName)}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={cn('flex-1', className, contentClassName)} {...viewProps}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} className="flex-1 bg-[#070A0F]">
      {keyboard ? (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
