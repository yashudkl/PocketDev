import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

import { AppButton } from "@/components/AppButton";
import { Badge } from "@/components/Badge";
import { gitChangedFiles } from "@/data/mockData";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";

type Props = BottomTabScreenProps<MainTabParamList, "Git">;

export default function GitScreen({}: Props) {
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          gap: spacing.sm,
          padding: spacing.lg,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Current Branch</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "900" }}>main</Text>
        <Badge label="Ahead by 2 commits" tone="accent" />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <AppButton
          label="Commit"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => Alert.alert("Commit", "Commit dialog would open here.")}
        />
        <AppButton label="Push" style={{ flex: 1 }} onPress={() => Alert.alert("Push", "Push action would run here.")} />
        <AppButton
          label="Pull"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => Alert.alert("Pull", "Pull action would run here.")}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>Changed Files</Text>
        {gitChangedFiles.map((file) => (
          <View
            key={file.id}
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
            <Text style={{ color: colors.textPrimary, flex: 1, fontSize: 14, fontWeight: "700" }}>{file.name}</Text>
            <Badge label={file.change} tone={file.change === "Added" ? "success" : "warning"} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
