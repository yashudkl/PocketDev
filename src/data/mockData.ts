export type Project = {
  id: string;
  name: string;
  branch: string;
  syncStatus: "Synced" | "Pending" | "Offline";
  updatedAt: string;
  description: string;
};

export type FileNode = {
  id: string;
  name: string;
  type: "folder" | "file";
  expanded?: boolean;
  children?: FileNode[];
  content?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export const stats = [
  { id: "projects", label: "Projects", value: "12", icon: "folder-outline" },
  { id: "containers", label: "Containers", value: "4", icon: "cube-outline" },
  { id: "queue", label: "Queue", value: "#3", icon: "time-outline" },
];

export const recentProjects: Project[] = [
  {
    id: "p1",
    name: "PocketDev App",
    branch: "main",
    syncStatus: "Synced",
    updatedAt: "5 min ago",
    description: "Mobile workspace for remote edits.",
  },
  {
    id: "p2",
    name: "Design System",
    branch: "feat/tokens",
    syncStatus: "Pending",
    updatedAt: "21 min ago",
    description: "Shared components and theme tokens.",
  },
  {
    id: "p3",
    name: "Docs Portal",
    branch: "release/v2",
    syncStatus: "Offline",
    updatedAt: "2 hrs ago",
    description: "Content editing and publishing flow.",
  },
];

export const projects: Project[] = [
  ...recentProjects,
  {
    id: "p4",
    name: "API Playground",
    branch: "fix/auth-refresh",
    syncStatus: "Synced",
    updatedAt: "Yesterday",
    description: "Mock endpoints and request testing.",
  },
  {
    id: "p5",
    name: "CLI Tools",
    branch: "main",
    syncStatus: "Pending",
    updatedAt: "Yesterday",
    description: "Developer tooling and scripts.",
  },
];

export const fileTree: FileNode[] = [
  {
    id: "src",
    name: "src",
    type: "folder",
    children: [
      {
        id: "components",
        name: "components",
        type: "folder",
        children: [
          {
            id: "button",
            name: "AppButton.tsx",
            type: "file",
            content: `import { Pressable, Text } from "react-native";`,
          },
          {
            id: "card",
            name: "ProjectCard.tsx",
            type: "file",
            content: `export function ProjectCard() {\n  return <Card />;\n}`,
          },
        ],
      },
      {
        id: "screens",
        name: "screens",
        type: "folder",
        children: [
          {
            id: "home",
            name: "HomeScreen.tsx",
            type: "file",
            content: `export default function HomeScreen() {\n  return null;\n}`,
          },
          {
            id: "editor",
            name: "CodeEditorScreen.tsx",
            type: "file",
            content: `const sum = (a: number, b: number) => a + b;`,
          },
        ],
      },
    ],
  },
  {
    id: "package",
    name: "package.json",
    type: "file",
    content: `{\n  "name": "pocketdev"\n}`,
  },
];

export const editorLines = [
  "import React from 'react';",
  "",
  "type Props = {",
  "  title: string;",
  "};",
  "",
  "export function Header({ title }: Props) {",
  "  return <Text>{title}</Text>;",
  "}",
];

export const terminalOutput = [
  "$ npm run start",
  "Starting Metro bundler...",
  "Connected to pocketdev-workspace",
  "Watching files for changes...",
  "Build ready on device",
];

export const gitChangedFiles = [
  { id: "g1", name: "src/screens/HomeScreen.tsx", change: "Modified" },
  { id: "g2", name: "src/components/ProjectCard.tsx", change: "Added" },
  { id: "g3", name: "src/theme/index.ts", change: "Modified" },
];

export const aiSuggestions = [
  "Explain this error",
  "Suggest a fix",
  "Review this component",
];

export const initialMessages: Message[] = [
  {
    id: "m1",
    role: "assistant",
    text: "Paste an error and I’ll explain what it means in simple terms.",
  },
];

export const profile = {
  name: "Yashwant",
  email: "yashwant@pocketdev.app",
  plan: "Free",
  location: "Kathmandu, Nepal",
};
