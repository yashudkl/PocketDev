import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-neutral-900 mb-2">
        Screen not found
      </Text>
      <Text className="text-base text-neutral-500 text-center mb-8">
        The page you are looking for does not exist.
      </Text>
      <Link href="/" className="text-primary font-semibold text-base">
        Go home
      </Link>
    </View>
  );
}
