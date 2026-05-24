import React from 'react';
import { Image, StyleSheet, TextInput, TouchableOpacity, View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import PrimaryButton from './PrimaryButton';

type Props = {
  avatarUrl?: string | null;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
};

export default function InlineComposer({
  avatarUrl,
  value,
  onChangeText,
  onSubmit,
  onCancel,
  isSubmitting,
}: Props) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: theme.colors.surface }]} />
      )}
      <View style={styles.body}>
        <TextInput
          style={[styles.input, { color: theme.colors.text }]}
          placeholder="Share an announcement..."
          placeholderTextColor={theme.colors.muted}
          multiline
          value={value}
          onChangeText={onChangeText}
        />
        <View style={styles.actions}>
          {onCancel ? (
            <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
              <Text style={{ color: theme.colors.muted }}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
          <PrimaryButton
            title={isSubmitting ? 'Posting…' : 'Post'}
            onPress={onSubmit}
            style={styles.postButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
  },
  input: {
    minHeight: 80,
    fontSize: 15,
  },
  actions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  postButton: {
    minWidth: 110,
  },
});


