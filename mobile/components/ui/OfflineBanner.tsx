import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  if (isOnline) return null;

  return (
    <View className="flex-row items-center justify-center gap-2 bg-amber-500 px-4 py-2">
      <Ionicons name="cloud-offline-outline" size={16} color="#070A0F" />
      <AppText className="text-sm font-semibold text-slate-950">
        Offline — showing cached data
      </AppText>
    </View>
  );
}
