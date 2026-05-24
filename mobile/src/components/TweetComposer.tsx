import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

type Props = {
  avatarUrl?: string | null;
  placeholder?: string;
  onPress: () => void;
};

export default function TweetComposer({ avatarUrl, placeholder = "What's happening?", onPress }: Props) {
  const { theme } = useTheme();
  const fallbackAvatar = require('../../assets/bu-logo.png');
  const avatarSource = avatarUrl ? { uri: avatarUrl } : fallbackAvatar;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
      activeOpacity={0.9}
    >
      <Image source={avatarSource} style={styles.avatar} />
      <Text style={[styles.placeholder, { color: theme.colors.muted }]}>{placeholder}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 24,
    borderWidth: 1,
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: spacing.md,
  },
  placeholder: {
    fontSize: 15,
    flex: 1,
  },
});


