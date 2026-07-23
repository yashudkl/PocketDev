import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/theme';
import {
  explainTerminalFailure,
  getLocalModel,
  releaseLocalAssistant,
} from '@/services/localAssistant';
import { getErrorMessage } from '@/utils/errors';

export function ExplanationModal({
  visible,
  command,
  output,
  exitCode,
  onClose,
}: {
  visible: boolean;
  command: string;
  output: string;
  exitCode: number;
  onClose: () => void;
}) {
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasModel, setHasModel] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const model = await getLocalModel();
      if (!active) return;
      setHasModel(Boolean(model));
      if (!model) return;

      setLoading(true);
      try {
        const result = await explainTerminalFailure({
          command,
          output,
          exitCode,
          onToken: (token) => {
            if (active) setExplanation((current) => current + token);
          },
        });
        if (active) setExplanation((current) => current || result);
      } catch (assistantError) {
        if (active) setError(getErrorMessage(assistantError));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      void releaseLocalAssistant();
    };
  }, [command, exitCode, output, visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-[#070A0F]">
        <View className="border-b border-slate-800 px-5 pb-4 pt-16">
          <AppText variant="title">Local explanation</AppText>
          <AppText variant="caption">Runs entirely on this device</AppText>
        </View>

        {hasModel === false ? (
          <View className="flex-1 items-center justify-center px-8">
            <AppText variant="heading" className="text-center">
              Import a GGUF model first
            </AppText>
            <AppText variant="caption" className="mt-2 text-center leading-5">
              PocketDev does not bundle a large model in the app. Choose a compatible quantized GGUF
              file from your device.
            </AppText>
            <Button
              label="Open model settings"
              className="mt-5"
              onPress={() => {
                onClose();
                router.push('/settings/assistant');
              }}
            />
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerClassName="p-5">
            {loading && !explanation ? (
              <View className="items-center gap-3 py-14">
                <ActivityIndicator color={colors.primary} />
                <AppText variant="caption">Loading model and reading the error…</AppText>
              </View>
            ) : null}
            {error ? (
              <AppText className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                {error}
              </AppText>
            ) : null}
            {explanation ? (
              <AppText selectable className="leading-7 text-slate-200">
                {explanation}
              </AppText>
            ) : null}
            {loading && explanation ? (
              <ActivityIndicator className="mt-4 self-start" size="small" color={colors.primary} />
            ) : null}
          </ScrollView>
        )}

        <View className="border-t border-slate-800 p-4">
          <Button label="Close" variant="secondary" fullWidth onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
