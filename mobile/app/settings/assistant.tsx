import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { AppHeader } from '@/components/ui/AppHeader';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import {
  getLocalModel,
  importLocalModel,
  type LocalModel,
  removeLocalModel,
} from '@/services/localAssistant';
import { getErrorMessage } from '@/utils/errors';
import { formatBytes } from '@/utils/format';

export default function AssistantSettingsScreen() {
  const [model, setModel] = useState<LocalModel | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => setModel(await getLocalModel()), []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const importModel = async () => {
    setLoading(true);
    try {
      const selected = await importLocalModel();
      if (selected) {
        setModel(selected);
        Toast.show({ type: 'success', text1: 'Local model ready', text2: selected.name });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Import failed', text2: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const confirmRemove = () =>
    Alert.alert('Remove local model?', 'The copied GGUF file will be deleted from PocketDev.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await removeLocalModel();
            setModel(null);
          })();
        },
      },
    ]);

  return (
    <Screen scroll contentClassName="gap-5 pt-5">
      <AppHeader title="Local Assistant" subtitle="Offline error explanations" back />
      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <AppText variant="heading">On-device model</AppText>
            <AppText variant="caption" className="mt-1 leading-5">
              Powered by llama.cpp through Metal on supported iPhones.
            </AppText>
          </View>
          <Badge
            label={model ? 'Installed' : 'Not configured'}
            tone={model ? 'success' : 'warning'}
            dot
          />
        </View>
        {model ? (
          <View className="mt-5 rounded-xl bg-slate-800 p-4">
            <AppText variant="mono" numberOfLines={2}>
              {model.name}
            </AppText>
            <AppText variant="caption" className="mt-1">
              {formatBytes(model.size)}
            </AppText>
          </View>
        ) : null}
      </Card>

      <Card>
        <AppText variant="heading">Choosing a model</AppText>
        <AppText variant="caption" className="mt-2 leading-6">
          Use a small instruct model in GGUF format. A Q4_K_M quantization around 1–2 GB is a
          practical starting point. Larger models need substantially more device memory.
        </AppText>
      </Card>

      <Button
        label={model ? 'Replace GGUF model' : 'Import GGUF model'}
        icon="folder-open-outline"
        size="lg"
        fullWidth
        loading={loading}
        onPress={() => void importModel()}
      />
      {model ? (
        <Button
          label="Remove model"
          icon="trash-outline"
          variant="danger"
          fullWidth
          onPress={confirmRemove}
        />
      ) : null}
      <AppText variant="caption" className="text-center leading-5">
        Model files stay on this device. Terminal output is never sent to an external AI API.
      </AppText>
    </Screen>
  );
}
