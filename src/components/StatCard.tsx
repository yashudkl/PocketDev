import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii, shadows, spacing } from "@/theme";

type Props = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export function StatCard({ label, value, icon }: Props) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        flex: 1,
        gap: spacing.sm,
        minWidth: 100,
        padding: spacing.lg,
        ...shadows.card,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
