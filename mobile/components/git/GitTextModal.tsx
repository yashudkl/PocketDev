import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function GitTextModal({
  visible,
  title,
  description,
  label,
  placeholder,
  actionLabel,
  loading,
  multiline = false,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  description?: string;
  label: string;
  placeholder: string;
  actionLabel: string;
  loading: boolean;
  multiline?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="rounded-t-3xl border-t border-slate-700 bg-slate-950 px-5 pb-10 pt-6">
          <AppText variant="title">{title}</AppText>
          {description ? (
            <AppText variant="caption" className="mt-1 leading-5">
              {description}
            </AppText>
          ) : null}
          <Input
            label={label}
            placeholder={placeholder}
            value={value}
            onChangeText={setValue}
            autoCapitalize={multiline ? 'sentences' : 'none'}
            autoCorrect={multiline}
            multiline={multiline}
            className={multiline ? undefined : 'font-mono'}
            containerClassName="mt-5"
            autoFocus
          />
          <View className="mt-5 flex-row gap-3">
            <Button label="Cancel" variant="secondary" className="flex-1" onPress={onClose} />
            <Button
              label={actionLabel}
              className="flex-1"
              loading={loading}
              disabled={!value.trim()}
              onPress={() => onSubmit(value.trim())}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
