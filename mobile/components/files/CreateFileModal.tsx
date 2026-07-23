import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function CreateFileModal({
  visible,
  loading,
  onClose,
  onCreate,
}: {
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onCreate: (path: string) => void;
}) {
  const [path, setPath] = useState('');

  const normalized = path.trim().replace(/^\/+/, '').replace(/\\/g, '/');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="rounded-t-3xl border-t border-slate-700 bg-slate-950 px-5 pb-10 pt-6">
          <AppText variant="title">New file</AppText>
          <AppText variant="caption" className="mt-1">
            Include folders in the path if needed.
          </AppText>
          <Input
            label="Project-relative path"
            placeholder="src/components/Button.tsx"
            value={path}
            onChangeText={setPath}
            autoCapitalize="none"
            autoCorrect={false}
            className="font-mono"
            containerClassName="mt-5"
            autoFocus
          />
          <View className="mt-5 flex-row gap-3">
            <Button label="Cancel" variant="secondary" className="flex-1" onPress={onClose} />
            <Button
              label="Create"
              className="flex-1"
              loading={loading}
              disabled={!normalized}
              onPress={() => onCreate(normalized)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
