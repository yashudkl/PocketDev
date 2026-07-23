import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

export function QueryLifecycle() {
  useEffect(() => {
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => {
        setOnline(state.isConnected !== false && state.isInternetReachable !== false);
      }),
    );

    const subscription = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    });

    return () => subscription.remove();
  }, []);

  return null;
}
