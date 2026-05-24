import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import ScreenContainer from '../components/ScreenContainer';
import Card from '../components/Card';
import SectionHeading from '../components/SectionHeading';
import { spacing } from '../theme';
import { api } from '../api/client';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const rootNavigation = navigation.getParent?.() ?? navigation;
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalStaff: 0,
    totalFaculty: 0,
    activeUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/profiles/');
      const payload: any = response.data;
      const users: any[] = Array.isArray(payload) ? payload : payload?.results || [];

      // Collect all users if paginated
      let allUsers = [...users];
      if (!Array.isArray(payload) && payload?.next) {
        let page = 2;
        while (true) {
          try {
            const nextResponse = await api.get('/users/profiles/', { params: { page } });
            const nextPayload: any = nextResponse.data;
            const nextUsers: any[] = Array.isArray(nextPayload) ? nextPayload : nextPayload?.results || [];
            if (nextUsers.length === 0) break;
            allUsers.push(...nextUsers);
            if (!nextPayload?.next) break;
            page++;
          } catch {
            break;
          }
        }
      }

      const stats = {
        totalUsers: allUsers.length,
        totalStudents: allUsers.filter((u) => !u.is_staff && !u.is_faculty).length,
        totalStaff: allUsers.filter((u) => u.is_staff).length,
        totalFaculty: allUsers.filter((u) => u.is_faculty).length,
        activeUsers: allUsers.filter((u) => u.is_active !== false).length,
      };

      setStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const AdminActionCard = ({
    icon,
    title,
    description,
    onPress,
    color = theme.colors.primary,
  }: {
    icon: string;
    title: string;
    description: string;
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.actionCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: `${color}15`,
          },
        ]}
      >
        <MaterialCommunityIcons name={icon as any} size={32} color={color} />
      </View>
      <View style={styles.actionContent}>
        <Text style={[styles.actionTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.actionDescription, { color: theme.colors.muted }]}>{description}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.muted} />
    </TouchableOpacity>
  );

  const StatCard = ({
    label,
    value,
    icon,
    color = theme.colors.primary,
  }: {
    label: string;
    value: number;
    icon: string;
    color?: string;
  }) => (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.statIconContainer,
          {
            backgroundColor: `${color}15`,
          },
        ]}
      >
        <MaterialCommunityIcons name={icon as any} size={24} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.muted }]}>{label}</Text>
    </View>
  );

  return (
    <ScreenContainer title="Admin Dashboard" padded={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Section */}
        <View style={styles.statsSection}>
          <SectionHeading title="User Statistics" />
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard
                label="Total Users"
                value={stats.totalUsers}
                icon="account-group"
                color={theme.colors.primary}
              />
              <StatCard
                label="Students"
                value={stats.totalStudents}
                icon="school"
                color="#10B981"
              />
              <StatCard
                label="Staff"
                value={stats.totalStaff}
                icon="briefcase"
                color="#3B82F6"
              />
              <StatCard
                label="Faculty"
                value={stats.totalFaculty}
                icon="account-tie"
                color="#8B5CF6"
              />
              <StatCard
                label="Active Users"
                value={stats.activeUsers}
                icon="account-check"
                color="#F59E0B"
              />
            </View>
          )}
        </View>

        {/* User Management Section */}
        <Card style={styles.actionsCard}>
          <SectionHeading title="User Management" />
          <View style={styles.actionsList}>
            <AdminActionCard
              icon="account-group"
              title="Manage Users"
              description="View, edit, and manage all users in the system"
              onPress={() => rootNavigation.navigate('AdminUserList')}
              color={theme.colors.primary}
            />
            <AdminActionCard
              icon="account-plus"
              title="Create New User"
              description="Add a new student, staff, or faculty member"
              onPress={() => rootNavigation.navigate('AdminUserCreate')}
              color="#10B981"
            />
          </View>
        </Card>

        {/* Content Moderation Section */}
        <Card style={styles.actionsCard}>
          <SectionHeading title="Content Moderation" />
          <View style={styles.actionsList}>
            <AdminActionCard
              icon="alert-circle"
              title="View Violations"
              description="Review content violations and suspended users"
              onPress={() => rootNavigation.navigate('Violations')}
              color="#DC2626"
            />
          </View>
        </Card>

        {/* Quick Actions Section */}
        <Card style={styles.actionsCard}>
          <SectionHeading title="Quick Actions" />
          <View style={styles.actionsList}>
            <AdminActionCard
              icon="account-search"
              title="View All Students"
              description="Browse and search all student accounts"
              onPress={() => rootNavigation.navigate('StudentList')}
              color="#3B82F6"
            />
            <AdminActionCard
              icon="account-tie"
              title="View All Faculty"
              description="Browse and search all faculty members"
              onPress={() => rootNavigation.navigate('FacultyList')}
              color="#8B5CF6"
            />
            <AdminActionCard
              icon="account-cancel"
              title="Suspend / Unsuspend"
              description="Suspend or reinstate students and staff"
              onPress={() => rootNavigation.navigate('AdminUserList', { filter: 'all' })}
              color="#DC2626"
            />
            <AdminActionCard
              icon="message-text"
              title="Message Any User"
              description="Open a direct conversation with any member"
              onPress={() => rootNavigation.navigate('AdminUserList', { quickAction: 'message' })}
              color={theme.colors.primary}
            />
          </View>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  statsSection: {
    marginTop: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statCard: {
    width: '47%',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  actionsCard: {
    gap: spacing.md,
  },
  actionsList: {
    gap: spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionDescription: {
    fontSize: 13,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
