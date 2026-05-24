import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  TextStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

type OptionPickerProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
};

export default function OptionPicker({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  error = null,
}: OptionPickerProps) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  const displayValue = useMemo(() => {
    if (!value) return placeholder;
    return value;
  }, [placeholder, value]);

  const handleSelect = (next: string) => {
    if (visible) {
      setVisible(false);
    }
    if (next !== value) {
      onChange(next);
    }
  };

  const themedStyles = useMemo(
    () => ({
      container: [
        styles.container,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
      ],
      label: [
        styles.label,
        {
          color: theme.colors.text,
        },
      ],
      selectedText: [
        styles.selectedText,
        {
          color: value ? theme.colors.text : theme.colors.muted,
        },
      ],
      modalBackdrop: [
        styles.modalBackdrop,
        { backgroundColor: 'rgba(0,0,0,0.4)' },
      ],
      modalCard: [
        styles.modalCard,
        {
          backgroundColor: theme.colors.card,
        },
      ],
      optionText: [
        styles.optionText,
        {
          color: theme.colors.text,
        },
      ],
      placeholderText: [
        styles.selectedText,
        { color: theme.colors.muted },
      ],
      cancelText: {
        color: theme.colors.primary,
        fontWeight: '600' as TextStyle['fontWeight'],
        fontSize: 16,
      },
      error: {
        color: '#ef4444',
        marginTop: spacing.xs,
        fontSize: 13,
      },
    }),
    [theme.colors.border, theme.colors.card, theme.colors.muted, theme.colors.primary, theme.colors.text, value],
  );

  return (
    <View>
      <Text style={themedStyles.label}>{label}</Text>
      <TouchableOpacity
        style={themedStyles.container}
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.7}
        disabled={disabled || options.length === 0}
      >
        <Text style={value ? themedStyles.selectedText : themedStyles.placeholderText}>
          {displayValue}
        </Text>
        <MaterialCommunityIcons name='chevron-down' size={18} color={theme.colors.muted} />
      </TouchableOpacity>
      {error ? <Text style={themedStyles.error}>{error}</Text> : null}
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (visible) {
            setVisible(false);
          }
        }}
      >
        <Pressable style={themedStyles.modalBackdrop} onPress={() => {
          if (visible) {
            setVisible(false);
          }
        }}>
          <View style={themedStyles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={themedStyles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item, idx) => `${item}-${idx}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={themedStyles.optionText}>{item}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
              )}
              ListEmptyComponent={
                <Text style={[styles.noOptionsText, { color: theme.colors.muted }]}>
                  No options available
                </Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  label: {
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedText: {
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxHeight: '70%',
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  optionRow: {
    paddingVertical: spacing.sm,
  },
  optionText: {
    fontSize: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  noOptionsText: {
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  });
