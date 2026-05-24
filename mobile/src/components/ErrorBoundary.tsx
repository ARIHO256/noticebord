import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (__DEV__) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={() => {
            this.setState({ hasError: false, error: null });
            this.props.onReset?.();
          }}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.errorIconContainer,
          { backgroundColor: `${theme.colors.danger}15` },
        ]}
      >
        <MaterialCommunityIcons
          name="alert-circle"
          size={64}
          color={theme.colors.danger}
        />
      </View>

      <Text
        style={[
          styles.title,
          { color: theme.colors.text, marginTop: spacing.lg },
        ]}
      >
        Oops! Something went wrong
      </Text>

      <Text
        style={[
          styles.description,
          { color: theme.colors.muted, marginTop: spacing.sm },
        ]}
      >
        We encountered an unexpected error. Please try again.
      </Text>

      {__DEV__ && error && (
        <View
          style={[
            styles.errorDetails,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.errorMessage,
              { color: theme.colors.text },
            ]}
          >
            {error.message}
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={onReset}
        style={[
          styles.resetButton,
          { backgroundColor: theme.colors.primary, marginTop: spacing.lg },
        ]}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="reload" size={20} color="#FFFFFF" />
        <Text style={styles.resetText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  errorDetails: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 120,
  },
  errorMessage: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    gap: spacing.sm,
    minWidth: 150,
  },
  resetText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default ErrorBoundary;
