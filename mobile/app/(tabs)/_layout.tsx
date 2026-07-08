import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#A3A3A3',
        tabBarStyle: {
          backgroundColor: '#171717',
          borderTopColor: '#262626',
        },
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            home: 'home-outline',
            explore: 'compass-outline',
            notifications: 'notifications-outline',
            profile: 'person-outline',
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
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
