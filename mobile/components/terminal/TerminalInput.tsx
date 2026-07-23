import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/constants/theme';

export function TerminalInput({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (data: string) => void;
}) {
  const [input, setInput] = useState('');

  const submit = () => {
    if (disabled) return;
    onSend(`${input}\r`);
    setInput('');
  };

  return (
    <View className="border-t border-slate-800 bg-slate-950">
      <View className="flex-row gap-2 px-3 py-2">
        {[
          ['Ctrl+C', '\u0003'],
          ['Tab', '\t'],
          ['↑', '\u001b[A'],
          ['↓', '\u001b[B'],
        ].map(([label, data]) => (
          <Pressable
            key={label}
            disabled={disabled}
            onPress={() => onSend(data)}
            className="rounded-lg bg-slate-800 px-3 py-2 disabled:opacity-40"
          >
            <AppText variant="mono" className="text-xs text-slate-300">
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
      <View className="flex-row items-center gap-2 px-3 pb-3">
        <AppText variant="mono" className="text-cyan-300">
          $
        </AppText>
        <TextInput
          value={input}
          onChangeText={setInput}
          editable={!disabled}
          onSubmitEditing={submit}
          blurOnSubmit={false}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={disabled ? 'Waiting for terminal…' : 'Type terminal input'}
          placeholderTextColor={colors.subtle}
          selectionColor={colors.primary}
          className="h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 font-mono text-sm text-white"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send terminal input"
          disabled={disabled}
          onPress={submit}
          className="h-11 items-center justify-center rounded-xl bg-cyan-400 px-4 disabled:opacity-40"
        >
          <AppText className="font-bold text-slate-950">Send</AppText>
        </Pressable>
      </View>
    </View>
  );
}
