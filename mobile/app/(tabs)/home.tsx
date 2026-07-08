import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-neutral-100">
        <Text className="text-2xl font-bold text-neutral-900">Home</Text>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <View className="py-4 gap-3">
          {/* Placeholder cards */}
          {[1, 2, 3].map((i) => (
            <View key={i} className="bg-neutral-50 rounded-xl p-4 gap-2">
              <View className="w-32 h-3 bg-neutral-200 rounded-full" />
              <View className="w-full h-3 bg-neutral-200 rounded-full" />
              <View className="w-3/4 h-3 bg-neutral-200 rounded-full" />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
