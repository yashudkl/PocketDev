import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white items-center justify-center" style={{ paddingTop: insets.top }}>
      <Text className="text-xl font-semibold text-neutral-700">Notifications</Text>
      <Text className="text-sm text-neutral-400 mt-1">You are all caught up</Text>
    </View>
  );
}
