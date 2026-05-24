import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderBar from './HeaderBar';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
  contentStyle?: ViewStyle;
};

export default function ScreenContainer({
  title,
  subtitle,
  right,
  children,
  padded = true,
  contentStyle,
}: Props) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <HeaderBar title={title} subtitle={subtitle} right={right} />
      <View
        style={[
          styles.body,
          padded && {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.lg,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
});


