import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';

const modules = [
  { title: 'Events', subtitle: 'RSVP & Check-in', icon: 'calendar-star', color: '#E91E63', screen: 'Events' },
  { title: 'Groups', subtitle: 'Join communities', icon: 'account-group', color: '#9C27B0', screen: 'Groups' },
  { title: 'Campus', subtitle: 'Services & Safety', icon: 'school', color: '#4CAF50', screen: 'CampusServices' },
  { title: 'Academic', subtitle: 'Exams & Grades', icon: 'book-open-page-variant', color: '#2196F3', screen: 'AcademicHub' },
  { title: 'Staff', subtitle: 'Directory', icon: 'account-tie', color: '#FF9800', screen: 'StaffDirectory' },
  { title: 'Lost & Found', subtitle: 'Claim items', icon: 'archive-search', color: '#795548', screen: 'LostFound' },
  { title: 'Emergency', subtitle: 'Safety first', icon: 'alert-circle', color: '#F44336', screen: 'EmergencyContacts' },
  { title: 'Venues', subtitle: 'Book spaces', icon: 'map-marker-radius', color: '#00BCD4', screen: 'VenueBooking' },
];

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Discover" subtitle="Explore your university" gradient={['#8E2DE2', '#4A00E0']} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.grid}>
          {modules.map((m) => (
            <TouchableOpacity key={m.title} style={{ width: '47%' }} onPress={() => navigation.navigate(m.screen)}>
              <ModernCard style={[styles.card, { borderTopWidth: 4, borderTopColor: m.color }]}>
                <View style={[styles.iconCircle, { backgroundColor: m.color + '18' }]}>
                  <MaterialCommunityIcons name={m.icon as any} size={28} color={m.color} />
                </View>
                <Text style={[styles.title, { color: theme.colors.text }]}>{m.title}</Text>
                <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{m.subtitle}</Text>
              </ModernCard>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  card: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 10 },
  iconCircle: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 12, marginTop: 4, textAlign: 'center' },
});
