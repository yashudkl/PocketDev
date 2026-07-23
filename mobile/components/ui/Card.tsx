import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '@/utils/cn';

interface CardProps extends PropsWithChildren<ViewProps> {
  className?: string;
}

export function Card({ className, ...props }: CardProps) {
  return (
    <View
      className={cn('rounded-2xl border border-slate-800 bg-slate-900 p-4', className)}
      {...props}
    />
  );
}
