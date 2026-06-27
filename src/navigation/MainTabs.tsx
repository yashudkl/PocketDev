import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme";
import { MainTabParamList } from "@/navigation/types";
import HomeScreen from "@/screens/HomeScreen";
import ProjectsScreen from "@/screens/ProjectsScreen";
import FileExplorerScreen from "@/screens/FileExplorerScreen";
import CodeEditorScreen from "@/screens/CodeEditorScreen";
import TerminalScreen from "@/screens/TerminalScreen";
import GitScreen from "@/screens/GitScreen";
import AIScreen from "@/screens/AIScreen";
import ProfileScreen from "@/screens/ProfileScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
            Home: "home-outline",
            Projects: "folder-outline",
            Files: "folder-open-outline",
            Editor: "code-slash-outline",
            Terminal: "terminal-outline",
            Git: "logo-github",
            AI: "sparkles-outline",
            Profile: "person-circle-outline",
          };

          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Projects" component={ProjectsScreen} />
      <Tab.Screen name="Files" component={FileExplorerScreen} />
      <Tab.Screen name="Editor" component={CodeEditorScreen} />
      <Tab.Screen name="Terminal" component={TerminalScreen} />
      <Tab.Screen name="Git" component={GitScreen} />
      <Tab.Screen name="AI" component={AIScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
