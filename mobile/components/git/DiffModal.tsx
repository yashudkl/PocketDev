import { Modal, ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/StateView';

function lineClass(line: string): string {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'text-green-300';
  if (line.startsWith('-') && !line.startsWith('---')) return 'text-red-300';
  if (line.startsWith('@@')) return 'text-cyan-300';
  return 'text-slate-400';
}

export function DiffModal({
  visible,
  path,
  diff,
  loading,
  onClose,
}: {
  visible: boolean;
  path?: string;
  diff?: string;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-[#070A0F]">
        <View className="border-b border-slate-800 px-5 pb-4 pt-16">
          <AppText variant="heading" numberOfLines={1}>
            {path || 'Working tree diff'}
          </AppText>
          <AppText variant="caption">Unstaged changes</AppText>
        </View>
        {loading ? (
          <LoadingState label="Generating diff…" />
        ) : diff ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName="p-4"
            horizontal
            showsHorizontalScrollIndicator
          >
            <View>
              {diff.split('\n').map((line, index) => (
                <AppText
                  key={`${index}-${line.slice(0, 20)}`}
                  variant="mono"
                  className={`text-xs leading-5 ${lineClass(line)}`}
                >
                  {line || ' '}
                </AppText>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <AppText variant="heading">No unstaged diff</AppText>
            <AppText variant="caption" className="mt-2 text-center">
              This file may only contain staged changes, or it has no changes.
            </AppText>
          </View>
        )}
        <View className="border-t border-slate-800 p-4">
          <Button label="Close" variant="secondary" fullWidth onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
