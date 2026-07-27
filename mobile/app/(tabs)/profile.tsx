import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { getApiBaseUrl } from '@/api/axios';
import { billingApi, desktopApi } from '@/api/pocketdev';
import { PlanCard } from '@/components/profile/PlanCard';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileSettingRow } from '@/components/profile/ProfileSettingRow';
import { SettingsSection } from '@/components/profile/SettingsSection';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { LoadingState } from '@/components/ui/StateView';
import { colors } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import type { Subscription } from '@/types/api';
import { getErrorMessage } from '@/utils/errors';
import { formatRelativeDate } from '@/utils/format';

interface BiometricState {
  hasHardware: boolean;
  enrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
}

function biometricTypeLabel(types: LocalAuthentication.AuthenticationType[]): string {
  const labels = types.map((type) => {
    if (type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) {
      return 'face recognition';
    }
    if (type === LocalAuthentication.AuthenticationType.FINGERPRINT) {
      return 'fingerprint';
    }
    if (type === LocalAuthentication.AuthenticationType.IRIS) {
      return 'iris';
    }
    return 'biometrics';
  });

  return [...new Set(labels)].join(' and ');
}

async function inspectBiometrics(): Promise<BiometricState> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const [enrolled, types] = await Promise.all([
    LocalAuthentication.isEnrolledAsync(),
    hasHardware
      ? LocalAuthentication.supportedAuthenticationTypesAsync()
      : Promise.resolve([] as LocalAuthentication.AuthenticationType[]),
  ]);

  return { hasHardware, enrolled, types };
}

export default function ProfileScreen() {
  const { accessToken, user, logout, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const apiBaseUrl = getApiBaseUrl();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTestingBiometrics, setIsTestingBiometrics] = useState(false);

  const subscriptionQuery = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: billingApi.subscription,
    enabled: Boolean(user && apiBaseUrl),
    retry: 1,
  });
  const desktopQuery = useQuery({
    queryKey: ['desktop-status'],
    queryFn: desktopApi.status,
    enabled: Boolean(user && apiBaseUrl),
    refetchInterval: 15_000,
    retry: 1,
  });
  const biometricQuery = useQuery({
    queryKey: ['device-biometric-support'],
    queryFn: inspectBiometrics,
    staleTime: 30_000,
    retry: false,
  });
  const biometric = biometricQuery.data ?? {
    hasHardware: false,
    enrolled: false,
    types: [],
  };

  const planMutation = useMutation({
    mutationFn: (action: 'upgrade' | 'downgrade') =>
      action === 'upgrade' ? billingApi.upgrade() : billingApi.downgrade(),
    onSuccess: async (subscription: Subscription) => {
      queryClient.setQueryData(['billing-subscription'], subscription);
      try {
        await refreshProfile();
      } catch {
        // The subscription response is enough to update this screen.
      }
      Alert.alert(
        'Demo plan updated',
        `Your account is now on the ${subscription.tier === 'PAID' ? 'Paid' : 'Free'} demo tier. New jobs use the updated queue priority immediately.`,
      );
    },
    onError: (error) => {
      Toast.show({
        type: 'error',
        text1: 'Could not change plan',
        text2: getErrorMessage(error),
      });
    },
  });

  const refreshEverything = useCallback(
    async (notify: boolean) => {
      if (isRefreshing) return;
      setIsRefreshing(true);

      const tasks: Promise<unknown>[] = [biometricQuery.refetch({ throwOnError: true })];
      if (apiBaseUrl) {
        tasks.push(
          refreshProfile(),
          subscriptionQuery.refetch({ throwOnError: true }),
          desktopQuery.refetch({ throwOnError: true }),
        );
      }

      const results = await Promise.allSettled(tasks);
      const failed = results.filter((result) => result.status === 'rejected').length;
      setIsRefreshing(false);

      if (!notify) return;
      if (failed > 0) {
        Toast.show({
          type: 'error',
          text1: 'Some settings could not refresh',
          text2: 'Check your connection and API configuration, then try again.',
        });
      } else {
        Toast.show({ type: 'success', text1: 'Settings are up to date' });
      }
    },
    [apiBaseUrl, biometricQuery, desktopQuery, isRefreshing, refreshProfile, subscriptionQuery],
  );

  const testBiometrics = useCallback(async () => {
    if (!biometric.hasHardware) {
      Alert.alert(
        'Biometrics unavailable',
        'This device does not report biometric authentication hardware.',
      );
      return;
    }
    if (!biometric.enrolled) {
      Alert.alert(
        'Set up biometrics first',
        'Add Face ID, a fingerprint, or another biometric in your device settings, then refresh this page.',
      );
      return;
    }

    setIsTestingBiometrics(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock PocketDev',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use device passcode',
        disableDeviceFallback: false,
      });
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Biometric authentication works',
          text2: 'This device can securely confirm your identity.',
        });
      } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
        Toast.show({
          type: 'error',
          text1: 'Authentication was not completed',
          text2: 'Try again or verify your device biometric settings.',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not test biometrics',
        text2: getErrorMessage(error),
      });
    } finally {
      setIsTestingBiometrics(false);
    }
  }, [biometric.enrolled, biometric.hasHardware]);

  const confirmLogout = useCallback(() => {
    Alert.alert(
      'Sign out of PocketDev?',
      'Your secure session will be removed from this device. Your projects and account data stay on PocketDev.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => void logout(),
        },
      ],
    );
  }, [logout]);

  const subscription = subscriptionQuery.data ?? user?.subscription ?? null;
  const currentTier = subscription?.tier ?? user?.tier ?? 'FREE';
  const desktop = desktopQuery.data;
  const desktopReady = Boolean(desktop?.online && desktop.tunnelUrl);

  const biometricPresentation = (() => {
    if (biometricQuery.isError) {
      return {
        label: 'Unavailable',
        tone: 'danger' as const,
        description: 'PocketDev could not inspect biometric support on this device.',
      };
    }
    if (!biometric.hasHardware) {
      return {
        label: 'Not supported',
        tone: 'neutral' as const,
        description: 'No biometric authentication hardware was reported.',
      };
    }
    if (!biometric.enrolled) {
      return {
        label: 'Set up',
        tone: 'warning' as const,
        description: 'Hardware is available, but no biometric is enrolled.',
      };
    }
    const type = biometricTypeLabel(biometric.types);
    return {
      label: 'Ready',
      tone: 'success' as const,
      description: `${type ? `${type[0].toUpperCase()}${type.slice(1)}` : 'Biometric authentication'} is enrolled. Tap to test it.`,
    };
  })();

  if (!user) {
    return (
      <Screen>
        <AppHeader title="Settings" />
        <LoadingState label="Loading your account…" />
      </Screen>
    );
  }

  const desktopDescription = !apiBaseUrl
    ? 'Configure the PocketDev API before checking your runner.'
    : desktopQuery.isError
      ? getErrorMessage(desktopQuery.error, 'Desktop runner status is unavailable.')
      : desktopReady
        ? `Tunnel connected${desktop?.lastHeartbeat ? ` · seen ${formatRelativeDate(desktop.lastHeartbeat)}` : ''}`
        : `No connected desktop${desktop?.lastHeartbeat ? ` · last seen ${formatRelativeDate(desktop.lastHeartbeat)}` : ''}`;

  const cloudDescription = !apiBaseUrl
    ? 'Cloud execution needs a configured PocketDev API endpoint.'
    : desktopQuery.isError
      ? 'Execution routing could not be verified.'
      : desktop?.target === 'CLOUD'
        ? 'New commands currently route to the managed cloud worker.'
        : 'Available as the fallback when your desktop runner is offline.';

  return (
    <Screen>
      <AppHeader
        title="Settings"
        subtitle="Account, runtime, and security"
        right={
          <Button
            label="Refresh"
            icon="refresh-outline"
            size="sm"
            variant="ghost"
            loading={isRefreshing}
            onPress={() => void refreshEverything(true)}
          />
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pb-12 pt-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refreshEverything(false)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.elevated}
          />
        }
      >
        <ProfileHero user={user} tier={currentTier} />

        <PlanCard
          tier={currentTier}
          subscription={subscription}
          loading={planMutation.isPending}
          actionDisabled={!apiBaseUrl || subscriptionQuery.isLoading}
          error={
            subscriptionQuery.isError
              ? getErrorMessage(subscriptionQuery.error, 'Subscription details are unavailable.')
              : undefined
          }
          onChangePlan={() => planMutation.mutate(currentTier === 'PAID' ? 'downgrade' : 'upgrade')}
        />

        <SettingsSection
          title="Execution"
          description="PocketDev automatically chooses the best available place to run commands."
        >
          <ProfileSettingRow
            icon="desktop-outline"
            title="Desktop runner"
            description={desktopDescription}
            loading={desktopQuery.isLoading && Boolean(apiBaseUrl)}
            status={{
              label: !apiBaseUrl
                ? 'Unavailable'
                : desktopQuery.isError
                  ? 'Unknown'
                  : desktopReady
                    ? 'Online'
                    : 'Offline',
              tone: !apiBaseUrl
                ? 'neutral'
                : desktopQuery.isError
                  ? 'warning'
                  : desktopReady
                    ? 'success'
                    : 'neutral',
              dot: desktopReady,
            }}
          />
          <ProfileSettingRow
            icon="cloud-outline"
            title="Cloud execution"
            description={cloudDescription}
            loading={desktopQuery.isLoading && Boolean(apiBaseUrl)}
            status={{
              label: !apiBaseUrl
                ? 'Unavailable'
                : desktopQuery.isError
                  ? 'Unknown'
                  : desktop?.target === 'CLOUD'
                    ? 'Active'
                    : 'Standby',
              tone: desktop?.target === 'CLOUD' && !desktopQuery.isError ? 'info' : 'neutral',
              dot: desktop?.target === 'CLOUD' && !desktopQuery.isError,
            }}
            last
          />
        </SettingsSection>

        <SettingsSection title="App configuration">
          <ProfileSettingRow
            icon="server-outline"
            title="PocketDev API"
            description={apiBaseUrl ?? 'Choose the API server this device should connect to.'}
            status={{
              label: apiBaseUrl ? 'Configured' : 'Missing',
              tone: apiBaseUrl ? 'success' : 'danger',
              dot: Boolean(apiBaseUrl),
            }}
            onPress={() => router.push('/settings/server')}
          />
          <ProfileSettingRow
            icon="sparkles-outline"
            title="On-device AI (optional)"
            description="Use a private local model instead of the automatic server assistant."
            status={{
              label: 'Optional',
              tone: 'neutral',
            }}
            onPress={() => router.push('/settings/assistant')}
          />
          <ProfileSettingRow
            icon="key-outline"
            title="Secure session"
            description={
              accessToken
                ? 'Your access token is stored in the device secure store.'
                : 'No access token is available on this device.'
            }
            status={{
              label: accessToken ? 'Active' : 'Missing',
              tone: accessToken ? 'success' : 'danger',
              dot: Boolean(accessToken),
            }}
            last
          />
        </SettingsSection>

        <SettingsSection
          title="Device security"
          description="Biometrics are checked locally and never sent to PocketDev."
        >
          <ProfileSettingRow
            icon="finger-print-outline"
            title="Biometric authentication"
            description={biometricPresentation.description}
            loading={biometricQuery.isFetching || isTestingBiometrics}
            status={{
              label: biometricPresentation.label,
              tone: biometricPresentation.tone,
              dot: biometric.enrolled && !biometricQuery.isError,
            }}
            onPress={biometric.enrolled ? () => void testBiometrics() : undefined}
            last
          />
        </SettingsSection>

        <View>
          <Button
            label="Sign out"
            icon="log-out-outline"
            variant="danger"
            fullWidth
            onPress={confirmLogout}
          />
          <AppText variant="caption" className="mt-3 text-center text-xs leading-5">
            Signing out removes only this device&apos;s secure session.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}
