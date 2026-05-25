import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fetchVenues } from '../api/campus';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';

export default function VenueBookingScreen() {
  const { theme } = useTheme();
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: fetchVenues });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Venue Booking" onBack={() => {}} gradient={['#00BCD4', '#4CAF50']} />
      <FlatList
        data={venues?.results || venues || []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <ModernCard style={{ marginBottom: 14 }}>
            <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: '800' }}>{item.name}</Text>
            <Text style={{ color: theme.colors.muted, marginTop: 4 }}>{item.location}</Text>
            {item.capacity && <Text style={{ color: theme.colors.muted, marginTop: 4 }}>Capacity: {item.capacity}</Text>}
            {item.amenities?.length > 0 && (
              <Text style={{ color: theme.colors.muted, marginTop: 4 }}>Amenities: {item.amenities.join(', ')}</Text>
            )}
          </ModernCard>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <MaterialCommunityIcons name="map-marker-radius" size={64} color={theme.colors.muted} />
            <Text style={{ color: theme.colors.muted, marginTop: 12 }}>No venues found.</Text>
          </View>
        }
      />
    </View>
  );
}
