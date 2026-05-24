import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

const infoChips = [
  { icon: 'shield-check', label: 'Verified bulletins' },
  { icon: 'clock-check-outline', label: '24/7 updates' },
  { icon: 'account-group-outline', label: 'Faculty & students united' },
];

const officialNotices = [
  { icon: 'account-tie', from: 'Vice Chancellor', summary: 'Sent an official note', dept: 'University Admin' },
  { icon: 'school-outline', from: 'Dean of School', summary: 'Shared faculty update', dept: 'School Leadership' },
  { icon: 'book-education', from: 'Lecturer', summary: 'Posted class notice', dept: 'Department' },
];

export default function AppFooter() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Bugema Noticeboard</Text>
      <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
        Designed for a calmer, delightful campus communication experience.
      </Text>
      <View style={styles.noticeList}>
        {officialNotices.map((notice) => (
          <View
            key={notice.from}
            style={[
              styles.noticeCard,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={[styles.noticeIcon, { backgroundColor: theme.colors.primary + '12' }]}>
              <MaterialCommunityIcons name={notice.icon as any} size={16} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.noticeFrom, { color: theme.colors.text }]}>{notice.from}</Text>
              <Text style={[styles.noticeSummary, { color: theme.colors.muted }]}>{notice.summary}</Text>
              <Text style={[styles.noticeDept, { color: theme.colors.primary }]}>{notice.dept}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.chipGrid}>
        {infoChips.map((chip) => (
          <View
            key={chip.label}
            style={[
              styles.chip,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <MaterialCommunityIcons name={chip.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={16} color={theme.colors.accent} />
            <Text style={[styles.chipText, { color: theme.colors.text }]}>{chip.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.footerRow}>
        <Text style={[styles.footerText, { color: theme.colors.muted }]}>Version 2.0 · Crafted with care</Text>
        <Text style={[styles.footerText, { color: theme.colors.primary }]}>Stay inspired ✦</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
  },
  noticeList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  noticeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeFrom: {
    fontSize: 14,
    fontWeight: '700',
  },
  noticeSummary: {
    fontSize: 13,
    marginTop: 2,
  },
  noticeDept: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 12,
  },
});

