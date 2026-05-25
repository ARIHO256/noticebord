import React, { useState } from 'react';
import { View, Text, FlatList, Image, TextInput, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fetchStaffDirectory } from '../api/campus';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';

export default function StaffDirectoryScreen() {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['staff-directory', typeFilter],
    queryFn: () => fetchStaffDirectory({ staff_type: typeFilter }),
  });

  const staff = (data?.results || data || []).filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.department && s.department.toLowerCase().includes(search.toLowerCase()))
  );

  const renderItem = ({ item }: { item: any }) => (
    <ModernCard style={styles.card}>
      <View style={styles.row}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, { backgroundColor: '#1877F220', alignItems: 'center', justifyContent: 'center' }]}>
            <MaterialCommunityIcons name="account" size={32} color="#1877F2" />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.name, { color: theme.colors.text }]}>{item.name}</Text>
          <Text style={[styles.title, { color: theme.colors.muted }]}>{item.title}</Text>
          <Text style={[styles.dept, { color: theme.colors.muted }]}>{item.department}</Text>
          {item.office_hours ? (
            <Text style={[styles.hours, { color: '#4CAF50' }]}>Office Hours: {item.office_hours}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        {item.phone ? (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)} style={[styles.actionBtn, { backgroundColor: '#E8F5E9' }]}>
            <MaterialCommunityIcons name="phone" size={18} color="#2E7D32" />
            <Text style={{ color: '#2E7D32', fontWeight: '700', marginLeft: 6, fontSize: 12 }}>Call</Text>
          </TouchableOpacity>
        ) : null}
        {item.email ? (
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${item.email}`)} style={[styles.actionBtn, { backgroundColor: '#E3F2FD' }]}>
            <MaterialCommunityIcons name="email" size={18} color="#1565C0" />
            <Text style={{ color: '#1565C0', fontWeight: '700', marginLeft: 6, fontSize: 12 }}>Email</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ModernCard>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Staff Directory" onBack={() => {}} gradient={['#FF9800', '#F44336']} />
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.card }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search staff..."
            placeholderTextColor={theme.colors.muted}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
        </View>
      </View>
      <FlatList
        data={staff}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <MaterialCommunityIcons name="account-search" size={64} color={theme.colors.muted} />
            <Text style={{ color: theme.colors.muted, marginTop: 12 }}>No staff found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  photo: { width: 64, height: 64, borderRadius: 16 },
  name: { fontSize: 16, fontWeight: '800' },
  title: { fontSize: 13, marginTop: 2 },
  dept: { fontSize: 12, marginTop: 2 },
  hours: { fontSize: 12, marginTop: 4, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 14, height: 48 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },
});
