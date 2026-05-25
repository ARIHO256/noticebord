import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, StyleSheet, TextInput } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fetchGroups, joinGroup } from '../api/groups';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';
import BeautifulButton from '../components/BeautifulButton';

export default function GroupsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data: groups, isLoading, refetch } = useQuery({
    queryKey: ['groups', typeFilter],
    queryFn: () => fetchGroups({ group_type: typeFilter }),
  });

  const joinMutation = useMutation({
    mutationFn: (id: number) => joinGroup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  });

  const filtered = (groups?.results || groups || []).filter((g: any) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderGroup = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => navigation.navigate('GroupChat', { id: item.id })}>
      <ModernCard style={styles.card}>
        <View style={styles.row}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#1877F220', alignItems: 'center', justifyContent: 'center' }]}>
              <MaterialCommunityIcons name="account-group" size={28} color="#1877F2" />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.name, { color: theme.colors.text }]}>{item.name}</Text>
            <Text style={[styles.meta, { color: theme.colors.muted }]}>
              {item.group_type} · {item.member_count} members
            </Text>
            {item.department ? (
              <Text style={[styles.meta, { color: theme.colors.muted }]}>{item.department}</Text>
            ) : null}
          </View>
          {item.is_member ? (
            <View style={[styles.chip, { backgroundColor: '#E8F5E9' }]}>
              <Text style={{ color: '#2E7D32', fontWeight: '800', fontSize: 12 }}>Joined</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => joinMutation.mutate(item.id)} style={[styles.chip, { backgroundColor: '#1877F2' }]}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>Join</Text>
            </TouchableOpacity>
          )}
        </View>
      </ModernCard>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Groups" subtitle="Connect with your community" />
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.card }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search groups..."
            placeholderTextColor={theme.colors.muted}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
        </View>
        <FlatList
          horizontal
          data={['', 'course', 'department', 'club', 'general']}
          keyExtractor={(i) => i}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginTop: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setTypeFilter(item)}
              style={[styles.typeChip, typeFilter === item && { backgroundColor: '#1877F2' }]}
            >
              <Text style={{ color: typeFilter === item ? '#FFF' : theme.colors.text, fontWeight: '700', fontSize: 12 }}>
                {item ? item.charAt(0).toUpperCase() + item.slice(1) : 'All'}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderGroup}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <MaterialCommunityIcons name="account-group-outline" size={64} color={theme.colors.muted} />
            <Text style={{ color: theme.colors.muted, marginTop: 12 }}>No groups found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 16 },
  name: { fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 14, height: 48 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.04)' },
});
