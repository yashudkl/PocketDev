import { View, Text } from 'react-native';
import { BaseToastProps } from 'react-native-toast-message';

/**
 * Pass this as `config` prop to the <Toast /> component in _layout.tsx
 */
export const ToastConfig = {
  success: ({ text1, text2 }: BaseToastProps) => (
    <View className="mx-4 bg-neutral-900 rounded-2xl px-4 py-3 shadow-lg">
      {text1 && <Text className="text-white font-semibold text-sm">{text1}</Text>}
      {text2 && <Text className="text-neutral-400 text-xs mt-0.5">{text2}</Text>}
    </View>
  ),
  error: ({ text1, text2 }: BaseToastProps) => (
    <View className="mx-4 bg-red-500 rounded-2xl px-4 py-3 shadow-lg">
      {text1 && <Text className="text-white font-semibold text-sm">{text1}</Text>}
      {text2 && <Text className="text-red-100 text-xs mt-0.5">{text2}</Text>}
    </View>
  ),
  info: ({ text1, text2 }: BaseToastProps) => (
    <View className="mx-4 bg-neutral-800 rounded-2xl px-4 py-3 shadow-lg">
      {text1 && <Text className="text-white font-semibold text-sm">{text1}</Text>}
      {text2 && <Text className="text-neutral-300 text-xs mt-0.5">{text2}</Text>}
    </View>
  ),
};
