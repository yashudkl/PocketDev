import React, { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/theme";

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function Screen({ children, scroll = true, contentStyle }: Props) {
  const content = (
    <View style={[{ flex: 1, gap: spacing.lg, padding: spacing.lg }, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{content}</ScrollView> : content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
