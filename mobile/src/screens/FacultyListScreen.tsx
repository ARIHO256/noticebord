import React, { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import Card from '../components/Card';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import ScreenContainer from '../components/ScreenContainer';
import { spacing } from '../theme';

export default function FacultyListScreen() {
  const [items, setItems] = useState<any[]>([]);
  const { theme } = useTheme();

  useEffect(() => {
    api.get('/users/profiles/faculty/').then(r => setItems(r.data));
  }, []);

  return (
    <ScreenContainer title="Faculty" padded={false}>
      <FlatList
        data={items}
        keyExtractor={(u) => String(u.id)}
        renderItem={({ item }) => (
          <Card>
            <Text style={{ fontWeight: '600', color: theme.colors.text }}>
              {(item.first_name || item.username) + (item.last_name ? ` ${item.last_name}` : '')}
            </Text>
            <Text style={{ color: theme.colors.muted, marginTop: 4 }}>
              {item.designation || 'No designation'}
              {item.department ? ` • ${item.department}` : ''}
            </Text>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.sm }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.semibold, fontSize: 18 }}>
              {items.length} {items.length === 1 ? 'member' : 'members'}
            </Text>
            <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
              Drag to refresh when someone new joins the faculty.
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

