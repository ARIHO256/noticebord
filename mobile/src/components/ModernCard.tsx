import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  padding?: 'none' | 'small' | 'medium' | 'large';
};

export default function ModernCard({ children, style, elevated = true, padding = 'medium' }: Props) {
  const { theme } = useTheme();
  const paddingMap = { none: 0, small: 10, medium: 16, large: 24 };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          padding: paddingMap[padding],
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.colors.border || 'rgba(0,0,0,0.04)',
        },
        elevated && {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
});
