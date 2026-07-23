import { Ionicons } from '@expo/vector-icons';
import type { GitFileStatus } from '@pocketdev/shared';
import { Pressable } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { colors } from '@/constants/theme';

export function GitFileRow({ file, onPress }: { file: GitFileStatus; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-slate-800 px-4 py-3"
    >
      <Ionicons
        name={file.status.includes('D') ? 'trash-outline' : 'document-text-outline'}
        size={18}
        color={file.status.includes('D') ? colors.danger : colors.muted}
      />
      <AppText variant="mono" className="min-w-0 flex-1 text-sm" numberOfLines={1}>
        {file.path}
      </AppText>
      {file.staged ? <Badge label="staged" tone="success" /> : null}
      <AppText variant="mono" className="text-xs text-amber-300">
        {file.status}
      </AppText>
    </Pressable>
  );
}
