import React from 'react';
import { View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { fetchEvent, rsvpEvent, cancelRSVP } from '../api/events';
import GradientHeader from '../components/GradientHeader';
import BeautifulButton from '../components/BeautifulButton';
import ModernCard from '../components/ModernCard';

export default function EventDetailScreen() {
  const { theme } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { id } = route.params;

  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEvent(id),
  });

  const rsvpMutation = useMutation({
    mutationFn: (status: string) => rsvpEvent(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRSVP(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  if (!event) return null;

  const onShare = async () => {
    try {
      await Share.share({ message: `${event.title}\n${event.description}\n\nLocation: ${event.location}` });
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader
        title="Event Details"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={onShare}>
            <MaterialCommunityIcons name="share-variant" size={24} color="#FFF" />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {event.cover_image_url && (
          <Image source={{ uri: event.cover_image_url }} style={styles.cover} />
        )}
        <Text style={[styles.title, { color: theme.colors.text }]}>{event.title}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: '#E3F2FD' }]}>
            <Text style={[styles.badgeText, { color: '#1565C0' }]}>{event.event_type}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: event.status === 'upcoming' ? '#E8F5E9' : '#FFF3E0' }]}>
            <Text style={[styles.badgeText, { color: event.status === 'upcoming' ? '#2E7D32' : '#EF6C00' }]}>{event.status}</Text>
          </View>
        </View>

        <ModernCard style={{ marginTop: 16 }}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="calendar" size={22} color="#1877F2" />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Date & Time</Text>
              <Text style={[styles.value, { color: theme.colors.muted }]}>
                {new Date(event.start_time).toLocaleString()} - {new Date(event.end_time).toLocaleTimeString()}
              </Text>
            </View>
          </View>
          <View style={[styles.row, { marginTop: 14 }]}>
            <MaterialCommunityIcons name="map-marker" size={22} color="#1877F2" />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Location</Text>
              <Text style={[styles.value, { color: theme.colors.muted }]}>{event.location || 'TBA'}</Text>
            </View>
          </View>
          <View style={[styles.row, { marginTop: 14 }]}>
            <MaterialCommunityIcons name="account-group" size={22} color="#1877F2" />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Attendees</Text>
              <Text style={[styles.value, { color: theme.colors.muted }]}>
                {event.attendees_count} going {event.max_attendees ? `· ${event.max_attendees - event.attendees_count} spots left` : ''}
              </Text>
            </View>
          </View>
        </ModernCard>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About</Text>
        <ModernCard>
          <Text style={{ color: theme.colors.text, lineHeight: 22 }}>{event.description}</Text>
        </ModernCard>

        {event.requires_rsvp && (
          <View style={styles.rsvpBlock}>
            {event.user_rsvp ? (
              <View style={{ gap: 10 }}>
                <BeautifulButton
                  title="Going"
                  variant={event.user_rsvp.status === 'going' ? 'success' : 'secondary'}
                  onPress={() => rsvpMutation.mutate('going')}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <BeautifulButton
                    title="Maybe"
                    variant={event.user_rsvp.status === 'maybe' ? 'primary' : 'ghost'}
                    style={{ flex: 1 }}
                    onPress={() => rsvpMutation.mutate('maybe')}
                  />
                  <BeautifulButton
                    title="Cancel"
                    variant="danger"
                    style={{ flex: 1 }}
                    onPress={() => cancelMutation.mutate()}
                  />
                </View>
              </View>
            ) : (
              <BeautifulButton
                title="RSVP Now"
                variant="gradient"
                size="large"
                onPress={() => rsvpMutation.mutate('going')}
              />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 220, borderRadius: 20, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '700' },
  value: { fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 24, marginBottom: 12 },
  rsvpBlock: { marginTop: 24 },
});
