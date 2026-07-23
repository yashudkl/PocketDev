import axios from 'axios';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { getApiBaseUrl } from '@/api/axios';
import { AuthShell } from '@/components/auth/AuthShell';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { saveApiUrl } from '@/services/apiSettings';
import { useAuth } from '@/providers/AuthProvider';
import { getErrorMessage } from '@/utils/errors';

export function ServerConfiguration() {
  const queryClient = useQueryClient();
  const { isAuthenticated, logout } = useAuth();
  const initialUrl = getApiBaseUrl();
  const [url, setUrl] = useState(initialUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const saveAndTest = async () => {
    const normalized = url.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/.+/i.test(normalized)) {
      setError('Enter a complete http:// or https:// URL.');
      return;
    }

    setTesting(true);
    setError(null);
    try {
      const response = await axios.get<{ status: string }>(`${normalized}/health`, {
        timeout: 10_000,
      });
      if (response.data.status !== 'ok') {
        throw new Error('The server returned an unexpected health response.');
      }
      await saveApiUrl(normalized);
      if (isAuthenticated && initialUrl !== normalized) {
        await logout();
        router.replace('/(auth)/login');
        return;
      }
      await queryClient.invalidateQueries();
      router.back();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not reach this server.'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <AuthShell
      title="Connect your server"
      subtitle="PocketDev talks directly to your NestJS API. You can change this endpoint at any time."
    >
      <View className="gap-4">
        <Input
          label="PocketDev API URL"
          placeholder="https://api.your-domain.com"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          className="font-mono"
          hint="Use an HTTPS URL reachable from this phone. localhost points to the phone itself."
        />
        {error ? (
          <AppText className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </AppText>
        ) : null}
        <Button
          label="Save and test"
          icon="cloud-done-outline"
          size="lg"
          fullWidth
          loading={testing}
          onPress={() => void saveAndTest()}
        />
        <Button label="Cancel" variant="ghost" fullWidth onPress={() => router.back()} />
      </View>
    </AuthShell>
  );
}
