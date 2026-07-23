import { Link } from 'expo-router';
import { Pressable } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/StateView';

export default function NotFoundScreen() {
  return (
    <Screen contentClassName="items-center justify-center px-5">
      <EmptyState
        icon="map-outline"
        title="Page not found"
        description="This route doesn’t exist or may have moved."
      />
      <Link href="/" asChild>
        <Pressable className="rounded-xl bg-cyan-400 px-5 py-3">
          <AppText className="font-bold text-slate-950">Go home</AppText>
        </Pressable>
      </Link>
    </Screen>
  );
}
