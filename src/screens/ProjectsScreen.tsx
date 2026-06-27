import React, { useMemo, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

import { AppButton } from "@/components/AppButton";
import { ProjectCard } from "@/components/ProjectCard";
import { SearchBar } from "@/components/SearchBar";
import { projects } from "@/data/mockData";
import type { MainTabParamList } from "@/navigation/types";
import { colors, spacing } from "@/theme";

type Props = BottomTabScreenProps<MainTabParamList, "Projects">;

export default function ProjectsScreen({}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      projects.filter((project) =>
        [project.name, project.branch, project.syncStatus, project.description]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );

  return (
    <View style={{ backgroundColor: colors.background, flex: 1, padding: spacing.lg, gap: spacing.lg }}>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search projects" />
      <AppButton label="Add Project" onPress={() => Alert.alert("Add Project", "Create project flow would open here.")} fullWidth />

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: 96 }}
        renderItem={({ item }) => <ProjectCard project={item} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: spacing.xl }}>
            <Text style={{ color: colors.textSecondary }}>No projects match your search.</Text>
          </View>
        }
      />
    </View>
  );
}
