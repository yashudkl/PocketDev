import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppButton } from "@/components/AppButton";
import { RootStackParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";

type Navigation = NativeStackNavigationProp<RootStackParamList, "Splash">;

export default function SplashScreen() {
  const navigation = useNavigation<Navigation>();

  useEffect(() => {
    const timer = setTimeout(() => navigation.replace("Login"), 1400);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.background,
        flex: 1,
        justifyContent: "center",
        padding: spacing.xl,
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 32,
          borderWidth: 1,
          height: 96,
          justifyContent: "center",
          marginBottom: spacing.xl,
          width: 96,
        }}
      >
        <Text style={{ color: colors.accent, fontSize: 32, fontWeight: "900" }}>PD</Text>
      </View>
      <Text style={{ color: colors.textPrimary, fontSize: 30, fontWeight: "900", letterSpacing: 0.5 }}>PocketDev</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: spacing.sm, textAlign: "center" }}>
        Code Anywhere. No Laptop Required.
      </Text>
      <View style={{ marginTop: spacing.xl, width: "100%" }}>
        <AppButton label="Continue" onPress={() => navigation.replace("Login")} fullWidth />
      </View>
    </View>
  );
}
