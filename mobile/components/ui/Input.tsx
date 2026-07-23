import { forwardRef } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, className, containerClassName, multiline, ...props },
  ref,
) {
  return (
    <View className={cn('gap-2', containerClassName)}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.subtle}
        selectionColor={colors.primary}
        multiline={multiline}
        className={cn(
          'rounded-xl border border-slate-700 bg-slate-900 px-4 text-base text-white',
          multiline ? 'min-h-28 py-3' : 'h-12',
          error && 'border-red-500',
          className,
        )}
        {...props}
      />
      {error ? (
        <AppText className="text-sm text-red-400">{error}</AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
});
