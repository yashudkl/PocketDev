import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';

type IconName = ComponentProps<typeof Ionicons>['name'];
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const containerVariants: Record<ButtonVariant, string> = {
  primary: 'bg-cyan-400 border-cyan-400',
  secondary: 'bg-slate-800 border-slate-700',
  ghost: 'bg-transparent border-transparent',
  danger: 'bg-red-500/15 border-red-500/40',
};

const textVariants: Record<ButtonVariant, string> = {
  primary: 'text-slate-950',
  secondary: 'text-white',
  ghost: 'text-cyan-300',
  danger: 'text-red-300',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3',
  md: 'min-h-12 px-4',
  lg: 'min-h-14 px-5',
};

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-xl border',
        containerVariants[variant],
        sizes[size],
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.background : colors.primary}
        />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={variant === 'primary' ? colors.background : undefined}
              className={textVariants[variant]}
            />
          ) : null}
          <AppText className={cn('text-sm font-bold', textVariants[variant])} numberOfLines={1}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

interface IconButtonProps extends PressableProps {
  icon: IconName;
  label: string;
  danger?: boolean;
  size?: number;
}

export function IconButton({
  icon,
  label,
  danger = false,
  size = 20,
  className,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-xl border',
        danger ? 'border-red-500/30 bg-red-500/10' : 'border-slate-800 bg-slate-900',
        className,
      )}
      {...props}
    >
      <Ionicons name={icon} size={size} color={danger ? colors.danger : colors.text} />
    </Pressable>
  );
}

export function ButtonGroup({ children }: { children: React.ReactNode }) {
  return <View className="flex-row gap-2">{children}</View>;
}
