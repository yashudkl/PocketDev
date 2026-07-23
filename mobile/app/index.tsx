import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/constants/theme';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-[#070A0F]">
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10">
        <Ionicons name="terminal" size={30} color={colors.primary} />
      </View>
      <AppText variant="title">PocketDev</AppText>
      <ActivityIndicator className="mt-5" size="small" color={colors.primary} />
    </View>
  );
}
