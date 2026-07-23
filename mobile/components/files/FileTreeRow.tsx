import { Ionicons } from '@expo/vector-icons';
import type { FileNode } from '@pocketdev/shared';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { formatBytes } from '@/utils/format';

function fileIcon(name: string): keyof typeof Ionicons.glyphMap {
  const extension = name.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension ?? '')) {
    return 'image-outline';
  }
  if (['json', 'yaml', 'yml', 'toml'].includes(extension ?? '')) {
    return 'settings-outline';
  }
  if (['md', 'txt'].includes(extension ?? '')) {
    return 'document-text-outline';
  }
  return 'code-slash-outline';
}

export function FileTreeRow({
  node,
  depth,
  expanded,
  onPress,
  onLongPress,
}: {
  node: FileNode;
  depth: number;
  expanded?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const isDirectory = node.type === 'dir';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      className="min-h-12 flex-row items-center border-b border-slate-900 py-2 pr-4"
      style={{ paddingLeft: 16 + depth * 18 }}
    >
      {isDirectory ? (
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={colors.subtle}
        />
      ) : (
        <View className="w-4" />
      )}
      <Ionicons
        name={
          isDirectory ? (expanded ? 'folder-open-outline' : 'folder-outline') : fileIcon(node.name)
        }
        size={19}
        color={isDirectory ? colors.primary : colors.muted}
        style={{ marginLeft: 6 }}
      />
      <AppText className="ml-3 min-w-0 flex-1 text-sm text-slate-200" numberOfLines={1}>
        {node.name}
      </AppText>
      {!isDirectory && node.size !== undefined ? (
        <AppText className="ml-2 text-xs text-slate-600">{formatBytes(node.size)}</AppText>
      ) : null}
    </Pressable>
  );
}
