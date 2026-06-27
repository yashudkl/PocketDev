import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { StatCard } from "@/components/StatCard";
import { recentProjects, stats } from "@/data/mockData";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";

type Props = BottomTabScreenProps<MainTabParamList, "Home">;

const quickActions = [
  { id: "sync", label: "Sync", icon: "sync-outline" as const, route: "Projects" as const },
  { id: "terminal", label: "Terminal", icon: "terminal-outline" as const, route: "Terminal" as const },
  { id: "git", label: "Git", icon: "git-branch-outline" as const, route: "Git" as const },
];

export default function HomeScreen({ navigation }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{greeting}, Yashwant</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "900", marginTop: 4 }}>
          Build from anywhere.
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        {stats.map((item) => (
          <StatCard key={item.id} label={item.label} value={item.value} icon={item.icon as keyof typeof Ionicons.glyphMap} />
        ))}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Recent Projects"
          subtitle="Jump back into active workspaces and keep momentum going."
        />
        <View style={{ gap: spacing.md }}>
          {recentProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Quick Actions" subtitle="One-tap shortcuts for the most common tasks." />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          {quickActions.map((action) => (
            <Pressable
              key={action.id}
              onPress={() => navigation.navigate(action.route)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.lg,
                borderWidth: 1,
                flex: 1,
                gap: 8,
                opacity: pressed ? 0.85 : 1,
                paddingVertical: spacing.lg,
              })}
            >
              <Ionicons name={action.icon} size={20} color={colors.accent} />
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "700" }}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={() => Alert.alert("PocketDev", "This home screen is fully frontend-only with mock data.")}
        style={{
          backgroundColor: colors.surfaceSoft,
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          padding: spacing.lg,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Status</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>
          Your workspace is ready for offline coding.
        </Text>
      </Pressable>
    </ScrollView>
  );
}
