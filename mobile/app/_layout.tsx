import '../global.css';

import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useEffect } from 'react';

import { QueryLifecycle } from '@/components/QueryLifecycle';
import { ToastConfig } from '@/components/ToastConfig';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

function AppNavigator() {
  const segments = useSegments();
  const { isAuthenticated, isBootstrapping } = useAuth();

  useEffect(() => {
    if (isBootstrapping) return;
    const inAuth = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, isBootstrapping, segments]);

  return (
    <>
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#070A0F' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="projects/[projectId]/index" />
        <Stack.Screen name="projects/[projectId]/files" />
        <Stack.Screen
          name="projects/[projectId]/editor"
          options={{ headerBackButtonMenuEnabled: false }}
        />
        <Stack.Screen name="projects/[projectId]/terminal" />
        <Stack.Screen name="projects/[projectId]/git" />
        <Stack.Screen name="settings/assistant" />
        <Stack.Screen name="settings/server" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <QueryLifecycle />
              <AppNavigator />
              <StatusBar style="light" />
              <Toast config={ToastConfig} />
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
