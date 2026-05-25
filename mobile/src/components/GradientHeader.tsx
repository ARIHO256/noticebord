import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  gradient?: [string, string];
};

export default function GradientHeader({ title, subtitle, onBack, rightAction, gradient = ['#1877F2', '#00C6FF'] }: Props) {
  const { theme } = useTheme();

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.row}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={26} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          <View style={styles.backBtn}>{rightAction}</View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
});
