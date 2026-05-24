import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

export default function OfflineBanner() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.warning,
          borderColor: theme.colors.accentContrast,
        },
      ]}
    >
      <MaterialCommunityIcons
        name="wifi-off"
        size={16}
        color={theme.colors.backgroundAlt}
        style={styles.icon}
      />
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.backgroundAlt }]}>Offline mode</Text>
        <Text style={[styles.subtitle, { color: theme.colors.accentContrast }]}>
          You are viewing cached notices. Changes will sync when you reconnect.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  icon: {
    marginRight: spacing.sm,
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
    fontSize: 13,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

