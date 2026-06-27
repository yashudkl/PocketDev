import React from "react";
import { Text, View } from "react-native";

import { colors, radii, spacing } from "@/theme";

type Props = {
  label: string;
  tone?: "success" | "warning" | "danger" | "neutral" | "accent";
};

export function Badge({ label, tone = "neutral" }: Props) {
  const palette = {
    success: { bg: "rgba(50,213,131,0.15)", fg: colors.success },
    warning: { bg: "rgba(245,165,36,0.14)", fg: colors.warning },
    danger: { bg: "rgba(255,107,107,0.14)", fg: colors.danger },
    neutral: { bg: colors.surfaceElevated, fg: colors.textSecondary },
    accent: { bg: "rgba(78,161,255,0.14)", fg: colors.accent },
  }[tone];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: palette.bg,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <Text style={{ color: palette.fg, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
