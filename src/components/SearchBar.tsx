import React from "react";
import { TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii, spacing } from "@/theme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder = "Search" }: Props) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Ionicons name="search-outline" size={18} color={colors.textMuted} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        style={{
          color: colors.textPrimary,
          flex: 1,
          fontSize: 14,
          minHeight: 48,
        }}
      />
    </View>
  );
}
