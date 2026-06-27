import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppButton } from "@/components/AppButton";
import { RootStackParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("yashwant@pocketdev.app");
  const [password, setPassword] = useState("password");

  return (
    <View
      style={{
        backgroundColor: colors.background,
        flex: 1,
        justifyContent: "center",
        padding: spacing.xl,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "900" }}>Welcome back</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 15, marginTop: spacing.sm }}>
        Sign in to keep your projects, terminals, and git state in sync.
      </Text>

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.lg,
              borderWidth: 1,
              color: colors.textPrimary,
              minHeight: 52,
              paddingHorizontal: spacing.lg,
            }}
          />
        </View>

        <View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.lg,
              borderWidth: 1,
              color: colors.textPrimary,
              minHeight: 52,
              paddingHorizontal: spacing.lg,
            }}
          />
        </View>

        <AppButton
          label="Login"
          fullWidth
          onPress={() => navigation.replace("Main")}
        />

        <Pressable onPress={() => Alert.alert("Sign up", "Sign up flow would open here.")}>
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "700", textAlign: "center" }}>
            Sign up for a new account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
