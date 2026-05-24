import React from 'react';
import { StyleProp, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';

type Props = {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export default function PrimaryButton({ title, onPress, style, disabled = false }: Props) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: theme.colors.primary,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: theme.colors.primary,
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 12 },
          shadowRadius: 20,
          elevation: 3,
        },
        disabled && { opacity: 0.6 },
        style,
      ]}
      activeOpacity={0.85}
    >
      <Text
        style={{
          color: theme.colors.primaryContrast,
          fontFamily: theme.fonts.semibold,
          fontSize: 16,
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}
