import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';

export const CodeEditor = forwardRef<TextInput, TextInputProps>(function CodeEditor(
  { className, ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      multiline
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      spellCheck={false}
      textAlignVertical="top"
      selectionColor={colors.primary}
      placeholderTextColor={colors.subtle}
      className={cn(
        'flex-1 bg-[#070A0F] px-4 py-4 font-mono text-[14px] leading-6 text-slate-200',
        className,
      )}
      {...props}
    />
  );
});
