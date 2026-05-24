import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
};

export default function MultiSelectPicker({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select options',
  error,
  disabled = false,
}: Props) {
  const { theme } = useTheme();
  
  // Safety checks
  if (!theme || !theme.colors) {
    return null;
  }
  
  // Ensure selected is always an array
  const safeSelected = Array.isArray(selected) ? selected : [];
  const safeOptions = Array.isArray(options) ? options : [];
  
  // Safe theme colors with fallbacks
  const colors = theme.colors || {};
  const safeSpacing = spacing || { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

  const toggleOption = (option: string) => {
    if (disabled || !onChange) return;
    if (safeSelected.includes(option)) {
      onChange(safeSelected.filter((item) => item !== option));
    } else {
      onChange([...safeSelected, option]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text || '#000000' }]}>{label}</Text>
      <View
        style={[
          styles.pickerContainer,
          {
            borderColor: error ? '#dc2626' : (colors.border || '#E4E6EB'),
            backgroundColor: disabled ? (colors.surfaceMuted || '#F0F2F5') : (colors.surface || '#FFFFFF'),
          },
        ]}
      >
        {safeSelected.length === 0 ? (
          <Text style={[styles.placeholder, { color: colors.muted || '#65676B' }]}>{placeholder}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
            {safeSelected.map((item) => (
              <View
                key={item}
                style={[styles.chip, { backgroundColor: (colors.primary || '#1877F2') + '15', borderColor: colors.primary || '#1877F2' }]}
              >
                <Text style={[styles.chipText, { color: colors.primary || '#1877F2' }]} numberOfLines={1}>
                  {item}
                </Text>
                <TouchableOpacity
                  onPress={() => toggleOption(item)}
                  style={styles.chipRemove}
                  disabled={disabled}
                >
                  <MaterialCommunityIcons name="close-circle" size={16} color={colors.primary || '#1877F2'} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={colors.muted || '#65676B'}
          style={styles.chevron}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!disabled && (
        <View style={[styles.optionsContainer, { backgroundColor: colors.card || '#FFFFFF', borderColor: colors.border || '#E4E6EB' }]}>
          <ScrollView style={styles.optionsList} nestedScrollEnabled>
            {safeOptions.map((option) => {
              const isSelected = safeSelected.includes(option);
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => toggleOption(option)}
                  style={[
                    styles.option,
                    isSelected && { backgroundColor: (colors.primary || '#1877F2') + '15' },
                  ]}
                >
                  <View style={[styles.checkbox, { borderColor: isSelected ? (colors.primary || '#1877F2') : (colors.border || '#E4E6EB') }]}>
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={16} color={colors.primary || '#1877F2'} />
                    )}
                  </View>
                  <Text style={[styles.optionText, { color: colors.text || '#000000' }]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholder: {
    fontSize: 14,
    flex: 1,
  },
  chipsContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: spacing.xs,
    maxWidth: 200,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  chipRemove: {
    marginLeft: 2,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: spacing.xs,
  },
  optionsContainer: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: 200,
    overflow: 'hidden',
  },
  optionsList: {
    maxHeight: 200,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E6EB',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
});






