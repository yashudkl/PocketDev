import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

import { AppButton } from "@/components/AppButton";
import { QueueBanner } from "@/components/QueueBanner";
import { terminalOutput } from "@/data/mockData";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";

type Props = BottomTabScreenProps<MainTabParamList, "Terminal">;

export default function TerminalScreen({}: Props) {
  const [session, setSession] = useState(1);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <QueueBanner position={3} />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>Terminal</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Session #{session}</Text>
        </View>
        <AppButton label="New Terminal" variant="secondary" onPress={() => setSession((value) => value + 1)} />
      </View>

      <Pressable
        style={{
          backgroundColor: colors.codeBackground,
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          minHeight: 320,
          padding: spacing.lg,
        }}
      >
        {terminalOutput.map((line, index) => (
          <Text key={`${session}-${index}`} style={{ color: index === 0 ? colors.warning : colors.textPrimary, fontFamily: "monospace", fontSize: 13, lineHeight: 22 }}>
            {line}
          </Text>
        ))}
        <Text style={{ color: colors.green, fontFamily: "monospace", fontSize: 13, lineHeight: 22 }}>
          $ _
        </Text>
      </Pressable>
    </ScrollView>
  );
}
