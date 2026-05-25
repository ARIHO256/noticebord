import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';

export default function ShuttleScheduleScreen() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Shuttle Schedule" onBack={() => {}} gradient={['#9C27B0', '#E91E63']} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.colors.muted }}>Shuttle schedule coming soon.</Text>
      </View>
    </View>
  );
}
