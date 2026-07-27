import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';

import { assistantApi } from '@/api/pocketdev';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/theme';
import {
  explainTerminalFailure as explainLocally,
  getLocalModel,
  releaseLocalAssistant,
} from '@/services/localAssistant';
import { getErrorMessage } from '@/utils/errors';
import { plainTerminalText } from '@/utils/terminal';

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
  exitCode?: number;
  onClose: () => void;
}) {
  const [explanation, setExplanation] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let active = true;

    void (async () => {
      try {
        const localModel = await getLocalModel();
        if (localModel) {
          try {
            if (!active) return;
            setSource(`On-device · ${localModel.name}`);
            const result = await explainLocally({
              command,
              output,
              exitCode,
              onToken: (token) => {
                if (active) setExplanation((current) => current + token);
              },
            });
            if (active) setExplanation((current) => current || result);
            return;
          } catch {
            if (active) {
              setExplanation('');
              setSource(null);
            }
          }
        }

        const result = await assistantApi.explainTerminalFailure({
          command,
          output: plainTerminalText(output).slice(-12_000),
          exitCode,
        });
        if (!active) return;
        setExplanation(result.explanation);
        setSource(`PocketDev server · ${result.model}`);
      } catch (assistantError) {
        if (active) {
          setError(
            getErrorMessage(
              assistantError,
              'The AI assistant could not explain this terminal output.',
            ),
          );
        }
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
          <AppText variant="title">AI explanation</AppText>
          <AppText variant="caption">{source ?? 'Analyzing terminal output'}</AppText>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="p-5">
          {loading && !explanation ? (
            <View className="items-center gap-3 py-14">
              <ActivityIndicator color={colors.primary} />
              <AppText variant="caption">Reading the terminal output…</AppText>
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

        <View className="border-t border-slate-800 p-4">
          <Button label="Close" variant="secondary" fullWidth onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
