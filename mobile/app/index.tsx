import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';

/**
 * Landing screen.
 * Show a brief loading state, then send users straight to tabs.
 */
export default function Index() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(tabs)/home');
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="small" color="#6C63FF" />
    </View>
  );
}
