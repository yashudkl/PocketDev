import { forwardRef } from 'react';
import { ScrollView, type ScrollViewProps, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

interface TerminalOutputProps extends ScrollViewProps {
  output: string;
  placeholder?: string;
}

export const TerminalOutput = forwardRef<ScrollView, TerminalOutputProps>(function TerminalOutput(
  { output, placeholder = 'Terminal output will appear here.', ...props },
  ref,
) {
  return (
    <ScrollView
      ref={ref}
      className="flex-1 bg-black"
      contentContainerClassName="min-h-full p-4"
      keyboardShouldPersistTaps="handled"
      {...props}
    >
      {output ? (
        <AppText selectable variant="mono" className="text-[13px] leading-5 text-slate-200">
          {output}
        </AppText>
      ) : (
        <View className="flex-1 items-center justify-center py-20">
          <AppText variant="mono" className="text-center text-slate-600">
            {placeholder}
          </AppText>
        </View>
      )}
    </ScrollView>
  );
});
