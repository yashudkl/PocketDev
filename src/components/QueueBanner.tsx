import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii, spacing } from "@/theme";

type Props = {
  position: number;
};

export function QueueBanner({ position }: Props) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "rgba(78,161,255,0.14)",
        borderColor: "rgba(78,161,255,0.28)",
        borderRadius: radii.lg,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.lg,
      }}
    >
      <Ionicons name="time" size={18} color={colors.accent} />
      <Text style={{ color: colors.textPrimary, flex: 1, fontSize: 14, fontWeight: "700" }}>
        You are #{position} in queue
      </Text>
    </View>
  );
}
