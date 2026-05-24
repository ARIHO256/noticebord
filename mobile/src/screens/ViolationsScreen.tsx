import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
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
import { useToast } from '../context/ToastContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Violation = {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
  };
  violation_type: string;
  category: string;
  content_preview: string;
  created_at: string;
  is_resolved: boolean;
  user_violations_count: number;
};

type SuspendedUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  designation: string;
  department: string;
  recent_violations: number;
  total_violations: number;
  last_violation_at: string | null;
  last_violation_type: string | null;
  last_violation_category: string | null;
};

type Tab = 'violations' | 'suspended';

export default function ViolationsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('violations');
  const [violations, setViolations] = useState<Violation[]>([]);
  const [suspendedUsers, setSuspendedUsers] = useState<SuspendedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const loadViolations = useCallback(async () => {
    try {
      const response = await api.get('/moderation/violations/');
      setViolations(response.data.results || []);
    } catch (error: any) {
      console.error('Failed to load violations:', error);
      showError(error?.response?.data?.detail || 'Failed to load violations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showError]);

  const loadSuspendedUsers = useCallback(async () => {
    try {
      const response = await api.get('/moderation/suspended-users/');
      setSuspendedUsers(response.data.results || []);
    } catch (error: any) {
      console.error('Failed to load suspended users:', error);
      showError(error?.response?.data?.detail || 'Failed to load suspended users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showError]);

  useEffect(() => {
    if (activeTab === 'violations') {
      loadViolations();
    } else {
      loadSuspendedUsers();
    }
  }, [activeTab, loadViolations, loadSuspendedUsers]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'violations') {
      loadViolations();
    } else {
      loadSuspendedUsers();
    }
  }, [activeTab, loadViolations, loadSuspendedUsers]);

  const handleResolveViolation = useCallback(async (violationId: number) => {
    Alert.alert(
      'Resolve Violation',
      'Are you sure you want to mark this violation as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          style: 'destructive',
          onPress: async () => {
            setResolvingId(violationId);
            try {
              await api.post(`/moderation/violations/${violationId}/resolve/`);
              showSuccess('Violation marked as resolved');
              loadViolations();
            } catch (error: any) {
              showError(error?.response?.data?.detail || 'Failed to resolve violation');
            } finally {
              setResolvingId(null);
            }
          },
        },
      ]
    );
  }, [loadViolations, showSuccess, showError]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      profanity: '#EF4444',
      nudity: '#DC2626',
      spam: '#F59E0B',
      inappropriate_language: '#EF4444',
      potential_nudity: '#DC2626',
      account_suspended: '#991B1B',
    };
    return colors[category] || theme.colors.primary;
  };

  const TabButton = ({ label, tab, icon }: { label: string; tab: Tab; icon: string }) => (
    <TouchableOpacity
      onPress={() => setActiveTab(tab)}
      style={[
        styles.tabButton,
        {
          backgroundColor: activeTab === tab ? theme.colors.primary : theme.colors.surface,
          borderColor: activeTab === tab ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={20}
        color={activeTab === tab ? '#FFFFFF' : theme.colors.text}
      />
      <Text
        style={[
          styles.tabButtonText,
          {
            color: activeTab === tab ? '#FFFFFF' : theme.colors.text,
            fontWeight: activeTab === tab ? '600' : '400',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <ScreenContainer title="Content Violations" padded={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.muted }]}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Content Violations" padded={false}>
      <View style={styles.tabContainer}>
        <TabButton label="Violations" tab="violations" icon="alert-circle" />
        <TabButton label="Suspended Users" tab="suspended" icon="account-cancel" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {activeTab === 'violations' ? (
          <>
            {violations.length === 0 ? (
              <Card style={styles.emptyCard}>
                <MaterialCommunityIcons name="check-circle" size={48} color={theme.colors.muted} />
                <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                  No violations found
                </Text>
              </Card>
            ) : (
              violations.map((violation) => (
                <Card key={violation.id} style={styles.violationCard}>
                  <View style={styles.violationHeader}>
                    <View style={styles.userInfo}>
                      <View
                        style={[
                          styles.avatarContainer,
                          {
                            backgroundColor: violation.user.is_active
                              ? theme.colors.primary + '20'
                              : '#DC262620',
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="account"
                          size={24}
                          color={violation.user.is_active ? theme.colors.primary : '#DC2626'}
                        />
                      </View>
                      <View style={styles.userDetails}>
                        <Text style={[styles.userName, { color: theme.colors.text }]}>
                          {violation.user.first_name} {violation.user.last_name} (@{violation.user.username})
                        </Text>
                        <Text style={[styles.userEmail, { color: theme.colors.muted }]}>
                          {violation.user.email}
                        </Text>
                      </View>
                    </View>
                    {!violation.is_resolved && (
                      <TouchableOpacity
                        onPress={() => handleResolveViolation(violation.id)}
                        disabled={resolvingId === violation.id}
                        style={styles.resolveButton}
                      >
                        {resolvingId === violation.id ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <MaterialCommunityIcons name="check" size={20} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.violationDetails}>
                    <View style={styles.categoryBadge}>
                      <View
                        style={[
                          styles.categoryDot,
                          { backgroundColor: getCategoryColor(violation.category) },
                        ]}
                      />
                      <Text style={[styles.categoryText, { color: theme.colors.text }]}>
                        {violation.category.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.typeText, { color: theme.colors.muted }]}>
                      Type: {violation.violation_type}
                    </Text>
                  </View>

                  {violation.content_preview && (
                    <View style={styles.contentPreview}>
                      <Text style={[styles.previewLabel, { color: theme.colors.muted }]}>
                        Content Preview:
                      </Text>
                      <Text style={[styles.previewText, { color: theme.colors.text }]}>
                        {violation.content_preview}
                      </Text>
                    </View>
                  )}

                  <View style={styles.violationFooter}>
                    <Text style={[styles.dateText, { color: theme.colors.muted }]}>
                      {formatDate(violation.created_at)}
                    </Text>
                    <View style={styles.countBadge}>
                      <MaterialCommunityIcons name="alert" size={14} color={theme.colors.primary} />
                      <Text style={[styles.countText, { color: theme.colors.primary }]}>
                        {violation.user_violations_count} total violations
                      </Text>
                    </View>
                    {violation.is_resolved && (
                      <View style={[styles.resolvedBadge, { backgroundColor: '#10B98120' }]}>
                        <Text style={[styles.resolvedText, { color: '#10B981' }]}>RESOLVED</Text>
                      </View>
                    )}
                    {!violation.user.is_active && (
                      <View style={[styles.suspendedBadge, { backgroundColor: '#DC262620' }]}>
                        <Text style={[styles.suspendedText, { color: '#DC2626' }]}>SUSPENDED</Text>
                      </View>
                    )}
                  </View>
                </Card>
              ))
            )}
          </>
        ) : (
          <>
            {suspendedUsers.length === 0 ? (
              <Card style={styles.emptyCard}>
                <MaterialCommunityIcons name="account-check" size={48} color={theme.colors.muted} />
                <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                  No suspended users
                </Text>
              </Card>
            ) : (
              suspendedUsers.map((user) => (
                <Card key={user.id} style={styles.suspendedCard}>
                  <View style={styles.suspendedHeader}>
                    <View
                      style={[
                        styles.avatarContainer,
                        { backgroundColor: '#DC262620' },
                      ]}
                    >
                      <MaterialCommunityIcons name="account-cancel" size={32} color="#DC2626" />
                    </View>
                    <View style={styles.userDetails}>
                      <Text style={[styles.userName, { color: theme.colors.text }]}>
                        {user.first_name} {user.last_name}
                      </Text>
                      <Text style={[styles.userEmail, { color: theme.colors.muted }]}>
                        @{user.username} • {user.email}
                      </Text>
                      <Text style={[styles.userInfoText, { color: theme.colors.muted }]}>
                        {user.designation} • {user.department}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: '#DC2626' }]}>
                        {user.total_violations}
                      </Text>
                      <Text style={[styles.statLabel, { color: theme.colors.muted }]}>
                        Total Violations
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                        {user.recent_violations}
                      </Text>
                      <Text style={[styles.statLabel, { color: theme.colors.muted }]}>
                        Recent (30 days)
                      </Text>
                    </View>
                  </View>

                  {user.last_violation_at && (
                    <View style={styles.lastViolation}>
                      <Text style={[styles.lastViolationLabel, { color: theme.colors.muted }]}>
                        Last Violation:
                      </Text>
                      <Text style={[styles.lastViolationText, { color: theme.colors.text }]}>
                        {formatDate(user.last_violation_at)} - {user.last_violation_type} ({user.last_violation_category})
                      </Text>
                    </View>
                  )}
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  violationCard: {
    gap: spacing.md,
  },
  violationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 13,
  },
  userInfoText: {
    fontSize: 12,
  },
  resolveButton: {
    padding: spacing.sm,
  },
  violationDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeText: {
    fontSize: 12,
  },
  contentPreview: {
    padding: spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    gap: spacing.xs,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewText: {
    fontSize: 14,
  },
  violationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  dateText: {
    fontSize: 12,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resolvedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  resolvedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  suspendedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  suspendedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  suspendedCard: {
    gap: spacing.md,
  },
  suspendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  statItem: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  lastViolation: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: spacing.xs,
  },
  lastViolationLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  lastViolationText: {
    fontSize: 13,
  },
});

