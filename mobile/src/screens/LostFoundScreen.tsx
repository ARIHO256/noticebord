import React, { useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fetchLostFound } from '../api/campus';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';

export default function LostFoundScreen() {
  const { theme } = useTheme();
  const [filter, setFilter] = useState('');

  const { data } = useQuery({
    queryKey: ['lost-found'],
    queryFn: () => fetchLostFound(),
  });

  const items = (data?.results || data || []).filter((i: any) =>
    filter === '' || i.item_type === filter
  );

  const renderItem = ({ item }: { item: any }) => (
    <ModernCard style={styles.card}>
      {item.image_url && <Image source={{ uri: item.image_url }} style={styles.image} />}
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={[styles.typeBadge, { backgroundColor: item.item_type === 'lost' ? '#FFEBEE' : '#E8F5E9' }]}>
            <Text style={{ color: item.item_type === 'lost' ? '#C62828' : '#2E7D32', fontWeight: '800', fontSize: 11, textTransform: 'uppercase' }}>
              {item.item_type}
            </Text>
          </View>
          <Text style={[styles.date, { color: theme.colors.muted }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
        <Text style={[styles.desc, { color: theme.colors.muted }]} numberOfLines={2}>{item.description}</Text>
        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="map-marker" size={14} color={theme.colors.muted} />
          <Text style={[styles.metaText, { color: theme.colors.muted }]}>{item.location_lost_found}</Text>
        </View>
      </View>
    </ModernCard>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Lost & Found" onBack={() => {}} gradient={['#FF9800', '#FFC107']} />
      <View style={styles.filterRow}>
        {['', 'lost', 'found'].map((f) => (
          <TouchableOpacity key={f || 'all'} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && { backgroundColor: '#FF9800' }]}>
            <Text style={{ color: filter === f ? '#FFF' : theme.colors.text, fontWeight: '700' }}>
              {f ? f.charAt(0).toUpperCase() + f.slice(1) : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <MaterialCommunityIcons name="archive-search" size={64} color={theme.colors.muted} />
            <Text style={{ color: theme.colors.muted, marginTop: 12 }}>No items found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14, overflow: 'hidden' },
  image: { width: '100%', height: 180 },
  body: { padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  date: { fontSize: 12 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  desc: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { marginLeft: 6, fontSize: 12 },
  filterRow: { flexDirection: 'row', padding: 16, gap: 10 },
  filterBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.04)' },
});
