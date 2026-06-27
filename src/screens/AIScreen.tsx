import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "@/components/AppButton";
import { aiSuggestions, initialMessages, type Message } from "@/data/mockData";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";

type Props = BottomTabScreenProps<MainTabParamList, "AI">;

function makeReply(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("error")) {
    return "That usually means a dependency, syntax, or runtime issue. Start by checking the first stack trace line.";
  }
  if (lower.includes("fix")) {
    return "A practical fix is to isolate the failing screen, then test the smallest possible change first.";
  }
  if (lower.includes("review")) {
    return "I’d look for duplicated logic, missing edge cases, and any state that can drift out of sync.";
  }
  return "Here’s a simple explanation: break the problem into smaller pieces, then validate each one on its own.";
}

export default function AIScreen({}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-u`, role: "user", text: trimmed },
      { id: `${Date.now()}-a`, role: "assistant", text: makeReply(trimmed) },
    ]);
    setDraft("");
  };

  return (
    <View style={{ backgroundColor: colors.background, flex: 1, padding: spacing.lg, gap: spacing.lg }}>
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.md }}>
        {messages.map((message) => (
          <View
            key={message.id}
            style={{
              alignSelf: message.role === "user" ? "flex-end" : "flex-start",
              backgroundColor: message.role === "user" ? colors.accentSoft : colors.surface,
              borderColor: colors.border,
              borderRadius: radii.lg,
              borderWidth: 1,
              maxWidth: "88%",
              padding: spacing.md,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{message.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {aiSuggestions.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => sendMessage(prompt)}
              style={({ pressed }) => ({
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                opacity: pressed ? 0.85 : 1,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              })}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>{prompt}</Text>
            </Pressable>
          ))}
        </View>

        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.pill,
            borderWidth: 1,
            flexDirection: "row",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
          }}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask PocketDev AI..."
            placeholderTextColor={colors.textMuted}
            style={{ color: colors.textPrimary, flex: 1, minHeight: 48 }}
          />
          <AppButton label="Send" onPress={() => sendMessage(draft)} />
        </View>
      </View>
    </View>
  );
}
