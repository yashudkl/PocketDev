import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

import { AppButton } from "@/components/AppButton";
import { editorLines } from "@/data/mockData";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";

type Props = BottomTabScreenProps<MainTabParamList, "Editor">;

export default function CodeEditorScreen({}: Props) {
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View
        style={{
          backgroundColor: colors.codeBackground,
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.sm }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700" }}>editor.tsx</Text>
        </View>
        <ScrollView horizontal contentContainerStyle={{ padding: spacing.lg }}>
          <View style={{ gap: 4 }}>
            {editorLines.map((line, index) => (
              <View key={`${index}-${line}`} style={{ flexDirection: "row" }}>
                <Text style={{ color: colors.textMuted, fontFamily: "monospace", fontSize: 13, width: 36, textAlign: "right", paddingRight: 12 }}>
                  {index + 1}
                </Text>
                <Text style={{ color: colors.textPrimary, fontFamily: "monospace", fontSize: 13, lineHeight: 20 }}>{line || " "}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <AppButton label="Save" fullWidth variant="secondary" onPress={() => Alert.alert("Saved", "Your changes were saved locally.")} />
        <AppButton label="Run" fullWidth onPress={() => Alert.alert("Run", "This would execute the current file in a container.")} />
      </View>
    </ScrollView>
  );
}
