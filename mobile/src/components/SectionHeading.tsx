import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const logo = require('../../assets/icon.png');

export default function SectionHeading({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { gap: 10 }]}>
      <Image source={logo} style={[styles.icon, { tintColor: theme.colors.primary }]} />
      <Text style={[styles.heading, { color: theme.colors.text }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
  },
});
