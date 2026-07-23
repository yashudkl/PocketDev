import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { AuthShell } from '@/components/auth/AuthShell';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/providers/AuthProvider';
import { getErrorMessage } from '@/utils/errors';

const schema = z
  .object({
    name: z.string().trim().max(80, 'Name is too long.').optional(),
    email: z.string().trim().email('Enter a valid email address.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterScreen() {
  const { register } = useAuth();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const submit = handleSubmit(async ({ confirmPassword: _, ...values }) => {
    try {
      await register(values);
      router.replace('/(tabs)/home');
    } catch (error) {
      setError('root', { message: getErrorMessage(error, 'Could not create account.') });
    }
  });

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Start free. Connect the CLI, sync a project, and keep coding."
    >
      <View className="gap-4">
        <Controller
          control={control}
          name="name"
          render={({ field: { onBlur, onChange, value } }) => (
            <Input
              label="Name"
              placeholder="Your name (optional)"
              autoCapitalize="words"
              textContentType="name"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <Input
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <Input
              label="Password"
              placeholder="At least 8 characters"
              secureTextEntry
              textContentType="newPassword"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.password?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onBlur, onChange, value } }) => (
            <Input
              label="Confirm password"
              placeholder="Repeat your password"
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="done"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              onSubmitEditing={() => void submit()}
              error={errors.confirmPassword?.message}
            />
          )}
        />
        {errors.root?.message ? (
          <AppText className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errors.root.message}
          </AppText>
        ) : null}
        <Button
          label="Create account"
          icon="arrow-forward"
          size="lg"
          fullWidth
          loading={isSubmitting}
          onPress={() => void submit()}
        />
      </View>

      <View className="mt-8 flex-row items-center justify-center gap-1">
        <AppText variant="caption">Already have an account?</AppText>
        <Link href="/(auth)/login" asChild>
          <Pressable hitSlop={8}>
            <AppText className="font-semibold text-cyan-300">Sign in</AppText>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
