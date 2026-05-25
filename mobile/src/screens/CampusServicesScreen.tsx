import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';

const services = [
  { key: 'staff', title: 'Staff Directory', icon: 'account-tie', color: '#1877F2', screen: 'StaffDirectory' },
  { key: 'lostfound', title: 'Lost & Found', icon: 'archive-search', color: '#FF9800', screen: 'LostFound' },
  { key: 'venues', title: 'Venue Booking', icon: 'map-marker-radius', color: '#4CAF50', screen: 'VenueBooking' },
  { key: 'emergency', title: 'Emergency', icon: 'alert-circle', color: '#F44336', screen: 'EmergencyContacts' },
  { key: 'shuttle', title: 'Shuttle', icon: 'bus', color: '#9C27B0', screen: 'ShuttleSchedule' },
  { key: 'cafeteria', title: 'Cafeteria', icon: 'food', color: '#E91E63', screen: 'CafeteriaMenu' },
];

export default function CampusServicesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Campus" subtitle="Everything you need on campus" gradient={['#4CAF50', '#00BCD4']} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.grid}>
          {services.map((s) => (
            <TouchableOpacity key={s.key} style={{ flex: 1, minWidth: '45%' }} onPress={() => navigation.navigate(s.screen)}>
              <ModernCard style={[styles.serviceCard, { borderTopWidth: 4, borderTopColor: s.color }]}>
                <View style={[styles.iconCircle, { backgroundColor: s.color + '18' }]}>
                  <MaterialCommunityIcons name={s.icon as any} size={32} color={s.color} />
                </View>
                <Text style={[styles.serviceTitle, { color: theme.colors.text }]}>{s.title}</Text>
              </ModernCard>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  serviceCard: { alignItems: 'center', paddingVertical: 24 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  serviceTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
