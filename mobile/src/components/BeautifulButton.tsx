import React from 'react';
import { StyleProp, Text, TouchableOpacity, ViewStyle, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'gradient';

type Props = {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  variant?: Variant;
  icon?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
};

const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: '#1877F2', text: '#FFFFFF' },
  secondary: { bg: '#E4E6EB', text: '#050505' },
  danger: { bg: '#FF3B30', text: '#FFFFFF' },
  success: { bg: '#25D366', text: '#FFFFFF' },
  ghost: { bg: 'transparent', text: '#1877F2', border: '#1877F2' },
  gradient: { bg: 'gradient', text: '#FFFFFF' },
};

const sizeStyles = {
  small: { py: 8, px: 14, font: 13, radius: 10 },
  medium: { py: 12, px: 20, font: 15, radius: 14 },
  large: { py: 16, px: 28, font: 17, radius: 18 },
};

export default function BeautifulButton({
  title,
  onPress,
  style,
  disabled = false,
  variant = 'primary',
  icon,
  size = 'medium',
}: Props) {
  const { theme } = useTheme();
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  const content = (
    <>
      {icon}
      <Text
        style={{
          color: v.text,
          fontFamily: theme.fonts.semibold,
          fontSize: s.font,
          marginLeft: icon ? 8 : 0,
        }}
      >
        {title}
      </Text>
    </>
  );

  const touchableStyle: StyleProp<ViewStyle> = [
    styles.button,
    {
      paddingVertical: s.py,
      paddingHorizontal: s.px,
      borderRadius: s.radius,
      opacity: disabled ? 0.55 : 1,
      borderWidth: v.border ? 1.5 : 0,
      borderColor: v.border || 'transparent',
    },
    style,
  ];

  if (variant === 'gradient') {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={[{ borderRadius: s.radius, overflow: 'hidden' }, style]}>
        <LinearGradient
          colors={['#1877F2', '#00C6FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, { paddingVertical: s.py, paddingHorizontal: s.px, borderRadius: s.radius }]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[touchableStyle, { backgroundColor: v.bg }]}
      activeOpacity={0.85}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
});
