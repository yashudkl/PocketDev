import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
      }),
    [],
  );

  return isOnline;
}
