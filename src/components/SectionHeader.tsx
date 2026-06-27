import React from "react";
import { Text, View } from "react-native";

import { colors, spacing } from "@/theme";

type Props = {
  title: string;
  subtitle?: string;
};

export function SectionHeader({ title, subtitle }: Props) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{subtitle}</Text> : null}
    </View>
  );
}
