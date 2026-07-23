import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingTop: 6,
        },
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            home: 'folder-open-outline',
            explore: 'pulse-outline',
            profile: 'settings-outline',
          } as const;

          return (
            <Ionicons
              name={iconMap[route.name as keyof typeof iconMap] ?? 'ellipse-outline'}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Projects' }} />
      <Tabs.Screen name="explore" options={{ title: 'Activity' }} />
      <Tabs.Screen name="profile" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
