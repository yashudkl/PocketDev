import React from "react";
import { ActivityIndicator, Pressable, Text, ViewStyle } from "react-native";

import { colors, radii, spacing } from "@/theme";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function AppButton({
  label,
  onPress,
  variant = "primary",
  fullWidth,
  loading,
  style,
}: Props) {
  const backgroundColor =
    variant === "primary"
      ? colors.accent
      : variant === "secondary"
        ? colors.surfaceElevated
        : variant === "danger"
          ? colors.danger
          : "transparent";
  const borderColor = variant === "ghost" ? colors.border : "transparent";
  const textColor =
    variant === "secondary" || variant === "ghost"
      ? colors.textPrimary
      : variant === "danger"
        ? "#ffffff"
        : "#08111d";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: "center",
          backgroundColor,
          borderColor,
          borderRadius: radii.pill,
          borderWidth: variant === "ghost" ? 1 : 0,
          flexDirection: "row",
          justifyContent: "center",
          minHeight: 48,
          opacity: pressed ? 0.85 : 1,
          paddingHorizontal: spacing.lg,
          width: fullWidth ? "100%" : "auto",
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={{ color: textColor, fontSize: 15, fontWeight: "700" }}>{label}</Text>}
    </Pressable>
  );
}
