import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { fetchEvents, fetchFeaturedEvents } from '../api/events';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';
import BeautifulButton from '../components/BeautifulButton';

export default function EventsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState('upcoming');

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['events', filter],
    queryFn: () => fetchEvents({ time_filter: filter }),
  });

  const { data: featured } = useQuery({
    queryKey: ['featured-events'],
    queryFn: fetchFeaturedEvents,
  });

  const renderEvent = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => navigation.navigate('EventDetail', { id: item.id })}>
      <ModernCard style={styles.card}>
        {item.cover_image_url && (
          <Image source={{ uri: item.cover_image_url }} style={styles.cover} />
        )}
        <View style={styles.cardBody}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: item.event_type === 'academic' ? '#E3F2FD' : '#E8F5E9' }]}>
              <Text style={[styles.badgeText, { color: item.event_type === 'academic' ? '#1565C0' : '#2E7D32' }]}>
                {item.event_type}
              </Text>
            </View>
            {item.is_featured && (
              <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
                <Text style={[styles.badgeText, { color: '#EF6C00' }]}>Featured</Text>
              </View>
            )}
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="calendar" size={16} color={theme.colors.muted} />
            <Text style={[styles.metaText, { color: theme.colors.muted }]}>
              {new Date(item.start_time).toLocaleDateString()} · {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="map-marker" size={16} color={theme.colors.muted} />
            <Text style={[styles.metaText, { color: theme.colors.muted }]}>{item.location || 'TBA'}</Text>
          </View>
          <View style={styles.footer}>
            <View style={styles.attendeeRow}>
              <MaterialCommunityIcons name="account-group" size={16} color={theme.colors.muted} />
              <Text style={[styles.metaText, { color: theme.colors.muted }]}>
                {item.attendees_count} going {item.max_attendees ? `/ ${item.max_attendees}` : ''}
              </Text>
            </View>
            {item.user_rsvp && (
              <View style={[styles.rsvpBadge, { backgroundColor: '#25D36620' }]}>
                <Text style={{ color: '#25D366', fontWeight: '700', fontSize: 12 }}>{item.user_rsvp.status}</Text>
              </View>
            )}
          </View>
        </View>
      </ModernCard>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Events" subtitle="Campus life at your fingertips" />
      <View style={styles.filterRow}>
        {['upcoming', 'ongoing', 'past'].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && { backgroundColor: '#1877F2' }]}
          >
            <Text style={[styles.filterText, { color: filter === f ? '#FFF' : theme.colors.text }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={events?.results || events || []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEvent}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <MaterialCommunityIcons name="calendar-blank" size={64} color={theme.colors.muted} />
            <Text style={{ color: theme.colors.muted, marginTop: 12 }}>No events found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  cover: { width: '100%', height: 160, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  cardBody: { padding: 14 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  metaText: { marginLeft: 8, fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  attendeeRow: { flexDirection: 'row', alignItems: 'center' },
  rsvpBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  filterRow: { flexDirection: 'row', padding: 16, gap: 10 },
  filterBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.04)' },
  filterText: { fontWeight: '700', fontSize: 13 },
});
