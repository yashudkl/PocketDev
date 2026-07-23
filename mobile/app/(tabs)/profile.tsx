import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white px-6" style={{ paddingTop: insets.top }}>
      <View className="items-center gap-3 py-6">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-primary">
          <Text className="text-3xl font-bold text-white">P</Text>
        </View>
        <Text className="text-xl font-bold text-neutral-900">Profile</Text>
        <Text className="text-center text-sm text-neutral-400">
          Manage your PocketDev account, development environments, and app settings.
        </Text>
      </View>

      <View className="mt-8 rounded-2xl bg-neutral-50 p-4">
        <Text className="text-sm font-semibold text-neutral-700">PocketDev</Text>
        <Text className="mt-2 text-sm leading-6 text-neutral-500">
          Your mobile workspace for browsing, editing, running, and committing code from
          anywhere.
        </Text>
      </View>
    </View>
  );
}
