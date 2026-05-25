import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';

export default function CafeteriaMenuScreen() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Cafeteria Menu" onBack={() => {}} gradient={['#E91E63', '#FF5722']} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.colors.muted }}>Cafeteria menu coming soon.</Text>
      </View>
    </View>
  );
}
