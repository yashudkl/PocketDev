import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/utils/errors';

const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Use at least 2 characters.')
    .max(80, 'Name must be 80 characters or fewer.'),
  slug: z
    .string()
    .trim()
    .max(64, 'Slug must be 64 characters or fewer.')
    .refine(
      (value) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
      'Use lowercase letters, numbers, and single hyphens.',
    ),
  description: z.string().trim().max(280, 'Description must be 280 characters or fewer.'),
});

type FormValues = z.infer<typeof createProjectSchema>;

export interface CreateProjectValues {
  name: string;
  slug?: string;
  description?: string;
}

interface CreateProjectModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (values: CreateProjectValues) => Promise<unknown>;
}

export function CreateProjectModal({ visible, onClose, onCreate }: CreateProjectModalProps) {
  const insets = useSafeAreaInsets();
  const {
    control,
    clearErrors,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
    },
  });

  useEffect(() => {
    if (!visible) {
      reset();
    }
  }, [reset, visible]);

  const close = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const submit = handleSubmit(async (values) => {
    clearErrors('root');

    try {
      await onCreate({
        name: values.name,
        slug: values.slug || undefined,
        description: values.description || undefined,
      });
    } catch (error) {
      setError('root', {
        message: getErrorMessage(error, 'Could not create the project.'),
      });
    }
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-end bg-black/75">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close new project form"
            className="flex-1"
            onPress={close}
          />

          <View
            className="max-h-[90%] rounded-t-3xl border-t border-slate-700 bg-slate-950"
            style={{ paddingBottom: Math.max(insets.bottom, 20) }}
          >
            <View className="items-center pb-2 pt-3">
              <View className="h-1 w-10 rounded-full bg-slate-700" />
            </View>

            <ScrollView
              className="px-5"
              contentContainerClassName="pb-3"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <AppText variant="title">New project</AppText>
              <AppText variant="caption" className="mt-1 leading-5">
                Create a workspace for files, terminal sessions, and Git.
              </AppText>

              <View className="mt-6 gap-4">
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <Input
                      label="Project name"
                      placeholder="My awesome app"
                      autoCapitalize="words"
                      autoCorrect={false}
                      autoFocus
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      error={errors.name?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="slug"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <Input
                      label="Slug (optional)"
                      placeholder="my-awesome-app"
                      hint="Leave blank to generate one from the project name."
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={value}
                      onBlur={onBlur}
                      onChangeText={(nextValue) => onChange(nextValue.toLowerCase())}
                      error={errors.slug?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="description"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <Input
                      label="Description (optional)"
                      placeholder="What are you building?"
                      multiline
                      maxLength={280}
                      textAlignVertical="top"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      error={errors.description?.message}
                    />
                  )}
                />
              </View>

              {errors.root?.message ? (
                <AppText className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errors.root.message}
                </AppText>
              ) : null}

              <View className="mt-6 flex-row gap-3">
                <Button
                  label="Cancel"
                  variant="secondary"
                  className="flex-1"
                  disabled={isSubmitting}
                  onPress={close}
                />
                <Button
                  label="Create project"
                  icon="add"
                  className="flex-1"
                  loading={isSubmitting}
                  onPress={() => void submit()}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
