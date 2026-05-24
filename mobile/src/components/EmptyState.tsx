import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  size = 'large',
}: EmptyStateProps) {
  const { theme } = useTheme();
  
  const iconSize = size === 'small' ? 48 : size === 'medium' ? 64 : 80;
  const titleSize = size === 'small' ? 14 : size === 'medium' ? 16 : 18;
  const descSize = size === 'small' ? 12 : size === 'medium' ? 13 : 14;

  return (
    <View style={[styles.container, { paddingVertical: size === 'small' ? spacing.md : spacing.xl * 2 }]}>
      <View
        style={[
          styles.iconContainer,
          {
            width: iconSize + 20,
            height: iconSize + 20,
            borderRadius: (iconSize + 20) / 2,
            backgroundColor: `${theme.colors.primary}15`,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={iconSize}
          color={theme.colors.primary}
        />
      </View>

      <Text
        style={[
          styles.title,
          {
            fontSize: titleSize,
            color: theme.colors.text,
            marginTop: size === 'small' ? spacing.sm : spacing.md,
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.description,
          {
            fontSize: descSize,
            color: theme.colors.muted,
            marginTop: spacing.sm,
          },
        ]}
      >
        {description}
      </Text>

      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.colors.primary,
              marginTop: size === 'small' ? spacing.md : spacing.lg,
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionText, { color: theme.colors.primaryContrast }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  actionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  actionText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
