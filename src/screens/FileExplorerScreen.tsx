import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { Badge } from "@/components/Badge";
import { SectionHeader } from "@/components/SectionHeader";
import { fileTree, type FileNode } from "@/data/mockData";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing } from "@/theme";

type Props = BottomTabScreenProps<MainTabParamList, "Files">;

function ExplorerNode({
  node,
  depth,
  expandedIds,
  onToggle,
  onOpenFile,
}: {
  node: FileNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (node: FileNode) => void;
  onOpenFile: (node: FileNode) => void;
}) {
  const isExpanded = expandedIds.has(node.id) || node.expanded;
  const paddingLeft = depth * 16;

  return (
    <View>
      <Pressable
        onPress={() => (node.type === "folder" ? onToggle(node) : onOpenFile(node))}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.md,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing.md,
          marginBottom: spacing.sm,
          opacity: pressed ? 0.86 : 1,
          padding: spacing.md,
          paddingLeft: spacing.md + paddingLeft,
        })}
      >
        <Ionicons
          name={node.type === "folder" ? (isExpanded ? "folder-open-outline" : "folder-outline") : "document-text-outline"}
          size={18}
          color={node.type === "folder" ? colors.warning : colors.accent}
        />
        <Text style={{ color: colors.textPrimary, flex: 1, fontSize: 14, fontWeight: "700" }}>{node.name}</Text>
        {node.type === "folder" ? <Badge label={isExpanded ? "Open" : "Closed"} tone="accent" /> : null}
      </Pressable>

      {node.type === "folder" && isExpanded && node.children ? (
        <View style={{ marginLeft: 4 }}>
          {node.children.map((child) => (
            <ExplorerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function FileExplorerScreen({}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["src"]));
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);

  const rootNodes = useMemo(() => fileTree, []);

  const handleToggle = (node: FileNode) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <SectionHeader title="File Explorer" subtitle="Tap folders to expand and tap files to preview content." />

      <View>
        {rootNodes.map((node) => (
          <ExplorerNode
            key={node.id}
            node={node}
            depth={0}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onOpenFile={setSelectedFile}
          />
        ))}
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          gap: spacing.sm,
          padding: spacing.lg,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Open File</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "800" }}>
          {selectedFile ? selectedFile.name : "Select a file to preview"}
        </Text>
        <Text style={{ color: colors.textSecondary, fontFamily: "monospace", fontSize: 13, lineHeight: 20 }}>
          {selectedFile?.content ?? "The file content will appear here when you tap a file in the tree."}
        </Text>
      </View>
    </ScrollView>
  );
}
