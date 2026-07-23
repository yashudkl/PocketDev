import type { TextProps } from 'react-native';
import { Text } from 'react-native';

import { cn } from '@/utils/cn';

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label' | 'mono';

const variants: Record<TextVariant, string> = {
  display: 'text-3xl font-bold tracking-tight text-white',
  title: 'text-2xl font-bold tracking-tight text-white',
  heading: 'text-lg font-semibold text-white',
  body: 'text-base text-slate-200',
  caption: 'text-sm text-slate-400',
  label: 'text-xs font-semibold uppercase tracking-widest text-slate-400',
  mono: 'font-mono text-sm text-slate-200',
};

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  className?: string;
}

export function AppText({ variant = 'body', className, ...props }: AppTextProps) {
  return <Text className={cn(variants[variant], className)} {...props} />;
}
