import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import HeaderBar from '../components/HeaderBar';
import { spacing } from '../theme';
import Card from '../components/Card';

type AnalyticsData = {
  total_notices: number;
  active_notices: number;
  expired_notices: number;
  recent_notices: number;
  priority_stats: Array<{ priority: string; count: number }>;
  category_stats: Array<{ category: string; count: number }>;
  top_departments: Array<{ department: string; count: number }>;
  avg_views: number;
  avg_likes: number;
};

export default function AnalyticsDashboardScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await api.get('/notices/analytics/');
      setData(response.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading && !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <HeaderBar title="Analytics Dashboard" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <HeaderBar title="Analytics Dashboard" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <MaterialCommunityIcons name="alert-circle" size={48} color={theme.colors.danger} />
          <Text style={{ color: theme.colors.text, marginTop: spacing.md, textAlign: 'center' }}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: number | string; color?: string }) => (
    <Card style={{ flex: 1, minWidth: '45%', marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={24} color={color || theme.colors.primary} />
        <Text style={{ color: theme.colors.muted, fontSize: 12, marginLeft: spacing.xs }}>{label}</Text>
      </View>
      <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '700' }}>{value}</Text>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <HeaderBar title="Analytics Dashboard" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAnalytics(true)} />}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <StatCard icon="file-document-multiple" label="Total Notices" value={data.total_notices} />
          <StatCard icon="check-circle" label="Active" value={data.active_notices} color={theme.colors.success} />
          <StatCard icon="clock-alert" label="Expired" value={data.expired_notices} color={theme.colors.danger} />
          <StatCard icon="calendar-clock" label="Recent (30d)" value={data.recent_notices} color={theme.colors.primary} />
        </View>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Engagement</Text>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="eye" size={20} color={theme.colors.primary} />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{data.avg_views.toFixed(1)}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Avg Views</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="heart" size={20} color={theme.colors.danger} />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{data.avg_likes.toFixed(1)}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Avg Likes</Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Priority Distribution</Text>
          {(data.priority_stats || []).map((stat) => (
            <View key={stat.priority} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: theme.colors.text }]}>
                {stat.priority.charAt(0).toUpperCase() + stat.priority.slice(1)}
              </Text>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${data.total_notices > 0 ? (stat.count / data.total_notices) * 100 : 0}%`,
                      backgroundColor:
                        stat.priority === 'urgent'
                          ? '#EF4444'
                          : stat.priority === 'important'
                          ? '#F59E0B'
                          : theme.colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: theme.colors.muted }]}>{stat.count}</Text>
            </View>
          ))}
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Category Distribution</Text>
          {(data.category_stats || []).map((stat) => (
            <View key={stat.category} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: theme.colors.text }]}>
                {stat.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${data.total_notices > 0 ? (stat.count / data.total_notices) * 100 : 0}%`,
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: theme.colors.muted }]}>{stat.count}</Text>
            </View>
          ))}
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Top Departments</Text>
          {(data.top_departments || []).map((dept, index) => (
            <View key={dept.department} style={styles.departmentRow}>
              <View style={[styles.rankBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                <Text style={[styles.rankText, { color: theme.colors.primary }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.departmentName, { color: theme.colors.text }]}>{dept.department || 'General'}</Text>
              <Text style={[styles.departmentCount, { color: theme.colors.muted }]}>{dept.count} notices</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  barLabel: {
    width: 100,
    fontSize: 13,
    fontWeight: '600',
  },
  barContainer: {
    flex: 1,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 10,
  },
  barValue: {
    width: 40,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
  },
  departmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  departmentName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  departmentCount: {
    fontSize: 13,
  },
});

