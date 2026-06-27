import React from "react";
import { Text, View } from "react-native";

import { Badge } from "@/components/Badge";
import type { Project } from "@/data/mockData";
import { colors, radii, shadows, spacing } from "@/theme";

type Props = {
  project: Project;
};

export function ProjectCard({ project }: Props) {
  const tone =
    project.syncStatus === "Synced"
      ? "success"
      : project.syncStatus === "Pending"
        ? "warning"
        : "danger";

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        gap: spacing.sm,
        padding: spacing.lg,
        ...shadows.card,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "800" }}>{project.name}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{project.description}</Text>
        </View>
        <Badge label={project.syncStatus} tone={tone} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Branch</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "700" }}>{project.branch}</Text>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Updated</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "700" }}>{project.updatedAt}</Text>
      </View>
    </View>
  );
}
