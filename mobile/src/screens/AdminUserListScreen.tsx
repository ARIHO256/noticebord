import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, Text, TouchableOpacity, View, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { openConversation } from '../api/messages';
import Card from '../components/Card';
import ScreenContainer from '../components/ScreenContainer';
import { spacing, Theme } from '../theme';

type UserRow = {
  id: number;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  is_faculty?: boolean;
  is_staff?: boolean;
  is_active?: boolean;
};

type DepartmentSection = {
  title: string;
  key: string;
  data: UserRow[];
};

type Filter = 'all' | 'students' | 'staff' | 'suspended' | 'reported';

const FilterPill = ({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: Theme;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={{
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      backgroundColor: active ? `${theme.colors.primary}20` : theme.colors.card,
    }}
  >
    <Text
      style={{
        color: active ? theme.colors.primary : theme.colors.text,
        fontFamily: active ? theme.fonts.semibold : theme.fonts.regular,
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

type Props = {
  navigation: any;
  route?: { params?: { filter?: Filter; quickAction?: 'message' | 'suspend' | 'unsuspend' } };
};

export default function AdminUserListScreen({ navigation, route }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reportedUserIds, setReportedUserIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(route?.params?.filter || 'all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const { theme } = useTheme();
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    let mounted = true;
    const loadUsers = async () => {
      setLoading(true);
      setError(null);

      const collected: UserRow[] = [];
      let page = 1;

      try {
        while (mounted) {
          const response = await api.get('/users/profiles/', { params: { page } });
          const payload: any = response.data;
          const results: UserRow[] = Array.isArray(payload) ? payload : payload?.results || [];
          collected.push(...results);

          const hasNext = !Array.isArray(payload) && Boolean(payload?.next);
          if (!hasNext) break;
          page += 1;
        }

        if (mounted) {
          setUsers(collected);
        }
      } catch (err) {
        if (mounted) setError('Failed to load users');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const loadReportedUsers = async () => {
      try {
        const response = await api.get('/users/profiles/reported/');
        const reported: UserRow[] = Array.isArray(response.data) ? response.data : [];
        if (mounted) {
          setReportedUserIds(new Set(reported.map((u) => u.id)));
        }
      } catch (err) {
        // Silently fail - reported users is optional
      }
    };

    loadUsers();
    loadReportedUsers();
    // If quickAction is "message", focus message CTA after load
    if (route?.params?.quickAction === 'message') {
      setFilter('all');
    }
    return () => {
      mounted = false;
    };
  }, [route?.params?.quickAction]);

  const filteredUsers = useMemo(() => {
    if (filter === 'students') {
      return users.filter((u) => !u.is_staff);
    }
    if (filter === 'staff') {
      return users.filter((u) => !!u.is_staff);
    }
    if (filter === 'suspended') {
      return users.filter((u) => u.is_active === false);
    }
    if (filter === 'reported') {
      return users.filter((u) => reportedUserIds.has(u.id));
    }
    return users;
  }, [filter, users, reportedUserIds]);

  const sections = useMemo<DepartmentSection[]>(() => {
    if (!filteredUsers.length) return [];
    const grouped = new Map<string, UserRow[]>();
    filteredUsers.forEach((user) => {
      const raw = user.department?.trim();
      const key = raw && raw.length > 0 ? raw : 'Unassigned';
      const list = grouped.get(key);
      if (list) {
        list.push(user);
      } else {
        grouped.set(key, [user]);
      }
    });
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({
        title,
        key: title.toLowerCase().replace(/\s+/g, '-'),
        data: data.sort((lhs, rhs) => {
          const leftName = `${lhs.first_name || ''} ${lhs.last_name || ''}`.trim() || lhs.username;
          const rightName = `${rhs.first_name || ''} ${rhs.last_name || ''}`.trim() || rhs.username;
          return leftName.localeCompare(rightName);
        }),
      }));
  }, [filteredUsers]);

  const handleSuspend = async (user: UserRow) => {
    Alert.alert(
      'Suspend User',
      `Are you sure you want to suspend ${user.first_name || user.username}? They will not be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(user.id);
            try {
              await api.post(`/users/profiles/${user.id}/suspend/`);
              setUsers((prev) =>
                prev.map((u) => (u.id === user.id ? { ...u, is_active: false } : u))
              );
              showSuccess('User has been suspended');
            } catch (error: any) {
              showError(error?.userMessage || 'Failed to suspend user');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleUnsuspend = async (user: UserRow) => {
    setActionLoading(user.id);
    try {
      await api.post(`/users/profiles/${user.id}/unsuspend/`);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: true } : u))
      );
      showSuccess('User has been unsuspended');
    } catch (error: any) {
      showError(error?.userMessage || 'Failed to unsuspend user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (user: UserRow) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${user.first_name || user.username}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(user.id);
            try {
              await api.delete(`/users/profiles/${user.id}/`);
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
              setReportedUserIds((prev) => {
                const next = new Set(prev);
                next.delete(user.id);
                return next;
              });
              showSuccess('User has been deleted');
            } catch (error: any) {
              showError(error?.userMessage || 'Failed to delete user');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleMessage = async (user: UserRow) => {
    setActionLoading(user.id);
    try {
      const conversation = await openConversation({
        recipient_id: user.id,
      });
      const title =
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Conversation';
      navigation.navigate('Conversation', { conversationId: conversation.id, title });
    } catch (error: any) {
      showError(error?.userMessage || 'Failed to open conversation');
    } finally {
      setActionLoading(null);
    }
  };

  const totalMembers = users.length;
  const studentCount = users.filter((u) => !u.is_staff).length;
  const staffCount = users.filter((u) => !!u.is_staff).length;
  const suspendedCount = users.filter((u) => u.is_active === false).length;
  const reportedCount = reportedUserIds.size;
  const totalDepartments = sections.length;

  return (
    <ScreenContainer
      title="Manage Users"
      padded={false}
      right={
        <TouchableOpacity
          onPress={() => navigation.navigate('AdminUserCreate' as any)}
          style={{ marginRight: spacing.md }}
        >
          <MaterialCommunityIcons name="plus-circle" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      }
    >
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: '#dc2626' }}>{error}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <FilterPill
                  label={`All (${totalMembers})`}
                  active={filter === 'all'}
                  onPress={() => setFilter('all')}
                  theme={theme}
                />
                <FilterPill
                  label={`Students (${studentCount})`}
                  active={filter === 'students'}
                  onPress={() => setFilter('students')}
                  theme={theme}
                />
                <FilterPill
                  label={`Staff (${staffCount})`}
                  active={filter === 'staff'}
                  onPress={() => setFilter('staff')}
                  theme={theme}
                />
                {suspendedCount > 0 && (
                  <FilterPill
                    label={`Suspended (${suspendedCount})`}
                    active={filter === 'suspended'}
                    onPress={() => setFilter('suspended')}
                    theme={theme}
                  />
                )}
                {reportedCount > 0 && (
                  <FilterPill
                    label={`Reported (${reportedCount})`}
                    active={filter === 'reported'}
                    onPress={() => setFilter('reported')}
                    theme={theme}
                  />
                )}
              </View>
              {filteredUsers.length > 0 ? (
                <View>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: 18,
                      fontFamily: theme.fonts.semibold,
                    }}
                  >
                    {filteredUsers.length} {filteredUsers.length === 1 ? 'member' : 'members'}
                  </Text>
                  <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
                    Across {totalDepartments} {totalDepartments === 1 ? 'department' : 'departments'}
                  </Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username;
            const isSuspended = item.is_active === false;
            const isReported = reportedUserIds.has(item.id);
            const isLoading = actionLoading === item.id;

            return (
              <Card style={{ marginBottom: spacing.sm }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('AdminUserEdit', { id: item.id })}
                  style={{ flex: 1 }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Text
                          style={{
                            fontFamily: theme.fonts.semibold,
                            fontSize: 16,
                            color: theme.colors.text,
                          }}
                        >
                          {name}
                        </Text>
                        {isSuspended && (
                          <View
                            style={{
                              backgroundColor: '#dc2626',
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>SUSPENDED</Text>
                          </View>
                        )}
                        {isReported && (
                          <View
                            style={{
                              backgroundColor: '#f59e0b',
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>REPORTED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: theme.colors.muted, marginTop: 4, fontSize: 13 }}>
                        {item.email || 'No email'}
                      </Text>
                      <Text style={{ color: theme.colors.muted, marginTop: 2, fontSize: 13 }}>
                        {item.designation || 'No designation'}
                        {item.is_faculty ? ' • Faculty' : ''}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: spacing.sm,
                    marginTop: spacing.md,
                    paddingTop: spacing.md,
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.border,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => handleMessage(item)}
                    disabled={isLoading}
                    style={{
                      flex: 1.2,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.xs,
                      paddingVertical: spacing.sm,
                      borderRadius: 8,
                      backgroundColor: `${theme.colors.primary}20`,
                      borderWidth: 1,
                      borderColor: theme.colors.primary,
                    }}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="message-text" size={18} color={theme.colors.primary} />
                        <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>
                          Message
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {isSuspended ? (
                    <TouchableOpacity
                      onPress={() => handleUnsuspend(item)}
                      disabled={isLoading}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing.xs,
                        paddingVertical: spacing.sm,
                        borderRadius: 8,
                        backgroundColor: '#10B98120',
                        borderWidth: 1,
                        borderColor: '#10B981',
                      }}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#10B981" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="account-check" size={18} color="#10B981" />
                          <Text style={{ color: '#10B981', fontWeight: '600', fontSize: 13 }}>
                            Unsuspend
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleSuspend(item)}
                      disabled={isLoading}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing.xs,
                        paddingVertical: spacing.sm,
                        borderRadius: 8,
                        backgroundColor: '#dc262620',
                        borderWidth: 1,
                        borderColor: '#dc2626',
                      }}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#dc2626" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="account-lock" size={18} color="#dc2626" />
                          <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>Suspend</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    disabled={isLoading}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.xs,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: 8,
                      backgroundColor: '#dc262620',
                      borderWidth: 1,
                      borderColor: '#dc2626',
                    }}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <MaterialCommunityIcons name="delete" size={18} color="#dc2626" />
                    )}
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                backgroundColor: theme.colors.background,
                paddingVertical: 12,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.fonts.semibold,
                    fontSize: 16,
                  }}
                >
                  {section.title}
                </Text>
                <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
                  {section.data.length} {section.data.length === 1 ? 'member' : 'members'}
                </Text>
              </View>
            </View>
          )}
          stickySectionHeadersEnabled
          SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 32 }}>
              <Text style={{ color: theme.colors.muted }}>No members found.</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
