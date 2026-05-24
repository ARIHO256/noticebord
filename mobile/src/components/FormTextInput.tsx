import React, { useEffect, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  trailing?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  enablePasswordToggle?: boolean;
};

export default function FormTextInput({
  label,
  error,
  trailing,
  style,
  containerStyle,
  inputStyle,
  enablePasswordToggle,
  secureTextEntry,
  ...rest
}: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const shouldTogglePassword = Boolean(enablePasswordToggle && secureTextEntry);
  const [isSecure, setIsSecure] = useState<boolean>(Boolean(secureTextEntry));

  useEffect(() => {
    setIsSecure(Boolean(secureTextEntry));
  }, [secureTextEntry]);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, style, inputStyle]}
          placeholderTextColor={theme.colors.muted}
          secureTextEntry={shouldTogglePassword ? isSecure : secureTextEntry}
          {...rest}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        {shouldTogglePassword ? (
          <TouchableOpacity
            onPress={() => setIsSecure((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={isSecure ? 'Show password' : 'Hide password'}
            style={[styles.toggle, trailing ? { marginLeft: spacing.sm } : null]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name={isSecure ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.colors.muted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (theme: typeof import('../theme').lightTheme) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: spacing.md,
    },
    label: {
      color: theme.colors.text,
      marginBottom: spacing.xs,
      fontWeight: '600',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 14,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: spacing.md,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 1,
    },
    input: {
      flex: 1,
      paddingVertical: spacing.sm,
      color: theme.colors.text,
      fontSize: 16,
    },
    trailing: {
      marginLeft: spacing.sm,
    },
    toggle: {
      marginLeft: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    error: {
      marginTop: spacing.xs,
      color: '#ef4444',
      fontSize: 13,
    },
  });
