import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "@/components/AppButton";
import { Badge } from "@/components/Badge";
import { profile } from "@/data/mockData";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";

type Props = BottomTabScreenProps<MainTabParamList, "Profile">;

export default function ProfileScreen({}: Props) {
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          gap: spacing.sm,
          padding: spacing.xl,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.accentSoft,
            borderRadius: 999,
            height: 72,
            justifyContent: "center",
            width: 72,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: "900" }}>Y</Text>
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "900" }}>{profile.name}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{profile.email}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{profile.location}</Text>
        <Badge label={`${profile.plan} plan`} tone={profile.plan === "Pro" ? "success" : "warning"} />
      </View>

      <View style={{ gap: spacing.md }}>
        <AppButton label="Settings" variant="secondary" fullWidth onPress={() => Alert.alert("Settings", "Settings screen would open here.")} />
        <AppButton label="Logout" variant="danger" fullWidth onPress={() => Alert.alert("Logout", "Logout would sign out the local session.")} />
      </View>

      <View style={{ gap: spacing.sm }}>
        {["Account", "Notifications", "Appearance", "Storage"].map((item) => (
          <Pressable
            key={item}
            onPress={() => Alert.alert(item, `${item} settings would open here.`)}
            style={{
              alignItems: "center",
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.lg,
              borderWidth: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              padding: spacing.lg,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Ionicons name="settings-outline" size={18} color={colors.accent} />
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>{item}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
