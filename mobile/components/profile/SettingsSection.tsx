import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';

interface SettingsSectionProps extends PropsWithChildren {
  title: string;
  description?: string;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <View>
      <AppText variant="label" className="mb-2 px-1">
        {title}
      </AppText>
      {description ? (
        <AppText variant="caption" className="mb-3 px-1 leading-5">
          {description}
        </AppText>
      ) : null}
      <Card className="overflow-hidden p-0">{children}</Card>
    </View>
  );
}
