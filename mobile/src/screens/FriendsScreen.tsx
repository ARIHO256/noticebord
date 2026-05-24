import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import HeaderBar from '../components/HeaderBar';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { spacing } from '../theme';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  fetchAllProfiles,
  FriendProfile,
  FriendRequest,
  removeFriend,
  sendFriendRequest,
} from '../api/friends';
import { openConversation } from '../api/messages';
import { markFriendRequestsViewed } from '../hooks/useTabBadges';

const TABS = [
  { key: 'requests', label: 'Suggestions' },
  { key: 'friends', label: 'Your friends' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function FriendsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<TabKey>('requests');
  const [query, setQuery] = useState('');
  const friendsQuery = useQuery({ queryKey: ['friends'], queryFn: fetchFriends });
  const incomingQuery = useQuery({ queryKey: ['friend-requests', 'incoming'], queryFn: () => fetchFriendRequests('incoming') });
  const outgoingQuery = useQuery({ queryKey: ['friend-requests', 'outgoing'], queryFn: () => fetchFriendRequests('outgoing') });
  const { data: currentUser } = useCurrentUserProfile();
  const {
    data: allUsersPages,
    fetchNextPage: fetchNextUsers,
    hasNextPage: hasMoreUsers,
    isFetchingNextPage: isFetchingMoreUsers,
    refetch: refetchAllUsers,
    isFetching: isFetchingAllUsers,
  } = useInfiniteQuery({
    queryKey: ['all-users'],
    queryFn: ({ pageParam = 1 }) => fetchAllProfiles(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });

  useFocusEffect(
    useCallback(() => {
      friendsQuery.refetch();
      incomingQuery.refetch();
      outgoingQuery.refetch();
      refetchAllUsers();
      let active = true;
      (async () => {
        try {
          const count = incomingQuery.data?.length ?? 0;
          if (active) {
            await markFriendRequestsViewed(count);
          }
        } catch {
          // ignore
        }
      })();
      return () => {
        active = false;
      };
    }, [
      friendsQuery.refetch,
      incomingQuery.refetch,
      incomingQuery.data,
      outgoingQuery.refetch,
      refetchAllUsers,
      markFriendRequestsViewed,
    ])
  );

  const refreshing = friendsQuery.isFetching || incomingQuery.isFetching || outgoingQuery.isFetching || isFetchingAllUsers;

  const refreshAll = useCallback(() => {
    friendsQuery.refetch();
    incomingQuery.refetch();
    outgoingQuery.refetch();
    refetchAllUsers();
  }, [friendsQuery, incomingQuery, outgoingQuery, refetchAllUsers]);

  const handleAccept = useCallback(async (request: FriendRequest) => {
    try {
      await acceptFriendRequest(request.id);
      refreshAll();
      showSuccess(`${request.sender.first_name || request.sender.username} is now your friend.`);
    } catch {
      showError('Unable to accept this request.');
    }
  }, [refreshAll, showSuccess, showError]);

  const matchesQuery = useCallback((profile: FriendProfile) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim().toLowerCase();
    const username = (profile.username || '').toLowerCase();
    const dept = (profile.department || '').toLowerCase();
    const designation = (profile.designation || '').toLowerCase();
    return name.includes(q) || username.includes(q) || dept.includes(q) || designation.includes(q);
  }, [query]);

  const filteredFriends = useMemo(
    () => (friendsQuery.data || []).filter(matchesQuery),
    [friendsQuery.data, matchesQuery]
  );
  const filteredIncoming = useMemo(
    () => (incomingQuery.data || []).filter((req) => req?.sender && matchesQuery(req.sender)),
    [incomingQuery.data, matchesQuery]
  );
  const filteredOutgoing = useMemo(
    () => (outgoingQuery.data || []).filter((req) => req?.receiver && matchesQuery(req.receiver)),
    [outgoingQuery.data, matchesQuery]
  );
  const filteredSuggestions = useMemo(() => {
    const flattened = (allUsersPages?.pages || []).flatMap((p) => p.results || []);
    return flattened.filter(matchesQuery);
  }, [allUsersPages?.pages, matchesQuery]);

  const handleDecline = useCallback(async (request: FriendRequest) => {
    try {
      await declineFriendRequest(request.id);
      refreshAll();
    } catch {
      showError('Unable to decline this request.');
    }
  }, [refreshAll, showError]);

  const handleRemoveFriend = useCallback(async (friend: FriendProfile) => {
    Alert.alert('Remove friend', `Remove ${friend.first_name || friend.username} from your friends list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(friend.id);
            refreshAll();
            showSuccess('Friend removed successfully');
          } catch {
            showError('Unable to remove this friend.');
          }
        },
      },
    ]);
  }, [refreshAll, showSuccess, showError]);

  const handleMessage = useCallback(async (friend: FriendProfile) => {
    try {
      const conversation = await openConversation({ recipient_id: friend.id });
      const target = navigation?.getParent?.() ?? navigation;
      target?.navigate('Conversation', {
        conversationId: conversation.id,
        title: friend.first_name ? `${friend.first_name} ${friend.last_name || ''}`.trim() : friend.username,
      });
    } catch (err: any) {
      showError(err?.response?.data?.detail || 'You can only message accepted friends.');
    }
  }, [navigation]);

  const handleSearchSendRequest = useCallback(async (profile: FriendProfile) => {
    try {
      await sendFriendRequest(profile.id);
      refreshAll();
      showSuccess(`Friend request sent to ${profile.first_name || profile.username}.`);
    } catch (err: any) {
      const detail = err?.userMessage || err?.response?.data?.detail || 'Unable to send friend request.';
      showError(detail);
    }
  }, [refreshAll]);

  const handleSearchCancelRequest = useCallback(async (profile: FriendProfile) => {
    if (!profile.friend_request_id) return;
    try {
      await cancelFriendRequest(profile.friend_request_id);
      refreshAll();
      showSuccess('Friend request cancelled');
    } catch {
      showError('Unable to cancel this request.');
    }
  }, [refreshAll, showSuccess, showError]);

  const handleSearchAcceptRequest = useCallback(async (profile: FriendProfile) => {
    if (!profile.friend_request_id) return;
    try {
      await acceptFriendRequest(profile.friend_request_id);
      refreshAll();
      showSuccess('Friend request accepted');
    } catch {
      showError('Unable to accept this request.');
    }
  }, [refreshAll, showSuccess, showError]);

  const handleSearchDeclineRequest = useCallback(async (profile: FriendProfile) => {
    if (!profile.friend_request_id) return;
    try {
      await declineFriendRequest(profile.friend_request_id);
      refreshAll();
      showSuccess('Friend request declined');
    } catch {
      showError('Unable to decline this request.');
    }
  }, [refreshAll, showSuccess, showError]);

  const renderTabButton = ({ key, label }: typeof TABS[number]) => (
    <TouchableOpacity
      key={key}
      onPress={() => setTab(key)}
      style={[
        styles.tabButton,
        {
          backgroundColor: tab === key ? theme.colors.primary : 'transparent',
          borderBottomWidth: tab === key ? 3 : 0,
          borderBottomColor: tab === key ? theme.colors.primary : 'transparent',
        },
      ]}
      activeOpacity={0.7}
    >
      <Text
        style={{
          color: tab === key ? theme.colors.primary : theme.colors.muted,
          fontWeight: tab === key ? '700' : '500',
          fontSize: 15,
        }}
      >
        {label}
      </Text>
      {key === 'requests' && (filteredIncoming.length || 0) > 0 ? (
        <View style={[styles.badge, { backgroundColor: '#FF3B30' }]}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
            {filteredIncoming.length > 99 ? '99+' : filteredIncoming.length}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const renderRequestRow = useCallback(
    ({ item }: { item: FriendRequest }) => {
      const user = item.sender;
      const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username;
      const avatar = user.avatar_url;
      const timeLabel = new Date(item.created_at).toLocaleDateString();
      const goToProfile = () =>
        navigation.navigate('UserProfile', {
          userId: user.id,
          name,
        });
      return (
        <View style={[styles.modernCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Card Header with Avatar and Info */}
          <View style={styles.cardHeader}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.largeAvatar} />
            ) : (
              <View style={[styles.largeAvatar, styles.avatarFallback, { backgroundColor: theme.colors.primary + '20' }]}>
                <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 20 }}>
                  {name[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.cardHeaderInfo}>
              <TouchableOpacity onPress={goToProfile} activeOpacity={0.7}>
                <Text style={[styles.nameText, { color: theme.colors.text }]} numberOfLines={1}>
                  {name}
                </Text>
              </TouchableOpacity>
              <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 2 }}>@{user.username}</Text>
              <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 4 }}>
                <MaterialCommunityIcons name="clock-outline" size={12} color={theme.colors.muted} /> {timeLabel}
              </Text>
            </View>
            {/* Online Indicator */}
            <View style={[styles.onlineIndicator, { backgroundColor: '#1DB446' }]} />
          </View>

          {/* Action Buttons */}
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => handleAccept(item)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="check" size={18} color="#fff" />
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.declineBtn, { backgroundColor: theme.colors.border }]}
              onPress={() => handleDecline(item)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close" size={18} color={theme.colors.text} />
              <Text style={[styles.declineBtnText, { color: theme.colors.text }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [handleAccept, handleDecline, navigation, theme.colors.border, theme.colors.muted, theme.colors.primary, theme.colors.surface, theme.colors.text]
  );

  const renderFriendRow = useCallback(
    ({ item }: { item: FriendProfile }) => {
      const name = `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() || item.username;
      const mutualCount = item.mutual_friend_count ?? 0;
      return (
        <View style={[styles.modernCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Card Header */}
          <View style={styles.cardHeader}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.largeAvatar} />
            ) : (
              <View style={[styles.largeAvatar, styles.avatarFallback, { backgroundColor: theme.colors.primary + '20' }]}>
                <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 20 }}>
                  {name[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.cardHeaderInfo}>
              <Text style={[styles.nameText, { color: theme.colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              {mutualCount > 0 && (
                <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 4 }}>
                  <MaterialCommunityIcons name="account-multiple" size={13} color={theme.colors.muted} /> {mutualCount} mutual
                  {mutualCount === 1 ? '' : 's'}
                </Text>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.friendActions}>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => handleMessage(item)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="message-text-outline" size={16} color="#fff" />
              <Text style={styles.primaryActionText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryActionBtn, { borderColor: theme.colors.border }]}
              onPress={() => navigation.navigate('UserProfile', { userId: item.id, name })}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="account-circle-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dangerActionBtn, { borderColor: '#FF3B30' }]}
              onPress={() => handleRemoveFriend(item)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="delete-outline" size={16} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [handleMessage, handleRemoveFriend, navigation, theme.colors.border, theme.colors.muted, theme.colors.primary, theme.colors.surface, theme.colors.text]
  );

  const allUsers = useMemo(
    () =>
      allUsersPages?.pages.flatMap((page) =>
        Array.isArray(page.results)
          ? page.results.filter((item): item is FriendProfile => !!item && typeof item.id !== 'undefined')
          : [],
      ) ?? [],
    [allUsersPages],
  );
  const friendRequests = filteredIncoming;
  const suggestions = useMemo(() => {
    const requestIds = new Set(friendRequests.filter((req) => req?.sender?.id).map((req) => req.sender.id));
    return filteredSuggestions.filter((profile) => profile?.id && !requestIds.has(profile.id)).slice(0, 6);
  }, [filteredSuggestions, friendRequests]);

  const data = useMemo<any[]>(() => {
    if (tab === 'friends') return filteredFriends as any[];
    return filteredIncoming as any[];
  }, [filteredFriends, filteredIncoming, tab]);

  const currentUserId = currentUser?.id ?? null;

  const renderAllUsersRow = useCallback(
    ({ item }: { item: FriendProfile }) => {
      const name = `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() || item.username;
      const status = item.friend_status ?? 'none';
      const isSelf = currentUserId === item.id;
      const mutualCount = item.mutual_friend_count ?? 0;
      return (
        <View style={[styles.modernCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.cardHeader}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.largeAvatar} />
            ) : (
              <View style={[styles.largeAvatar, styles.avatarFallback, { backgroundColor: theme.colors.primary + '20' }]}>
                <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 20 }}>
                  {name[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.cardHeaderInfo}>
              <Text style={[styles.nameText, { color: theme.colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 2 }}>@{item.username}</Text>
              {mutualCount > 0 && (
                <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 4 }}>
                  <MaterialCommunityIcons name="account-multiple" size={12} color={theme.colors.muted} /> {mutualCount} mutual
                </Text>
              )}
            </View>
          </View>

          {isSelf ? (
            <View style={styles.selfIndicator}>
              <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>This is you</Text>
            </View>
          ) : (
            <View style={styles.suggestionActions}>
              {(status === 'none' || status === 'unknown') && (
                <TouchableOpacity
                  style={[styles.suggestionPrimaryBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => handleSearchSendRequest(item)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="account-plus" size={16} color="#fff" />
                  <Text style={styles.suggestionPrimaryText}>Add Friend</Text>
                </TouchableOpacity>
              )}
              {status === 'outgoing' && (
                <>
                  <View style={[styles.suggestionDisabledBtn, { backgroundColor: theme.colors.border }]}>
                    <Text style={{ color: theme.colors.muted, fontSize: 13, fontWeight: '600' }}>Request sent</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.suggestionSecondaryBtn, { borderColor: theme.colors.border }]}
                    onPress={() => handleSearchCancelRequest(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.suggestionSecondaryText, { color: theme.colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
              {status === 'incoming' && (
                <>
                  <TouchableOpacity
                    style={[styles.suggestionPrimaryBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={() => handleSearchAcceptRequest(item)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="check" size={16} color="#fff" />
                    <Text style={styles.suggestionPrimaryText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.suggestionSecondaryBtn, { borderColor: theme.colors.border }]}
                    onPress={() => handleSearchDeclineRequest(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.suggestionSecondaryText, { color: theme.colors.text }]}>Decline</Text>
                  </TouchableOpacity>
                </>
              )}
              {status === 'friends' && (
                <TouchableOpacity
                  style={[styles.suggestionPrimaryBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => handleMessage(item)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="message-text-outline" size={16} color="#fff" />
                  <Text style={styles.suggestionPrimaryText}>Message</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.suggestionSecondaryBtn, { borderColor: theme.colors.border }]}
                onPress={() => navigation.navigate('UserProfile', { userId: item.id, name })}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="account-circle-outline" size={16} color={theme.colors.text} />
                <Text style={[styles.suggestionSecondaryText, { color: theme.colors.text }]}>Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [
      currentUserId,
      handleMessage,
      handleSearchAcceptRequest,
      handleSearchCancelRequest,
      handleSearchDeclineRequest,
      handleSearchSendRequest,
      navigation,
      theme.colors.border,
      theme.colors.muted,
      theme.colors.primary,
      theme.colors.text,
    ],
  );



  const listEmpty = useMemo(() => {
    const messageMap: Record<TabKey, string> = {
      requests: 'No friend requests at the moment.',
      friends: 'No friends yet. Send requests to connect.',
    };
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="account-group-outline" size={32} color={theme.colors.muted} />
        <Text style={[styles.emptyText, { color: theme.colors.muted }]}>{messageMap[tab]}</Text>
      </View>
    );
  }, [tab, theme.colors.muted]);

  const renderItem = tab === 'friends' ? renderFriendRow : renderRequestRow;

  const requestsHeaderComponent = useMemo(() => {
    if (tab !== 'requests') return null;
    return (
      <View style={styles.requestsHeaderContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.requestsTitle, { color: theme.colors.text }]}>Friend requests ({friendRequests.length})</Text>
          <Text style={[styles.requestsSubtitle, { color: theme.colors.muted }]}>People who want to connect</Text>
        </View>
        <TouchableOpacity onPress={refreshAll}>
          <Text style={[styles.seeAllLink, { color: theme.colors.primary }]}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }, [friendRequests.length, refreshAll, tab, theme.colors.muted, theme.colors.primary, theme.colors.text]);

  const suggestionsFooterComponent = useMemo(() => {
    if (tab !== 'requests' || suggestions.length === 0) return null;
    return (
      <View style={styles.suggestionsSection}>
        <Text style={[styles.requestsTitle, { color: theme.colors.text }]}>People you may know</Text>
        <View style={{ gap: spacing.sm }}>
          {suggestions.map((profile) => (
            <View key={`suggest-${profile.id}`}>{renderAllUsersRow({ item: profile } as { item: FriendProfile })}</View>
          ))}
        </View>
      </View>
    );
  }, [renderAllUsersRow, suggestions, tab, theme.colors.text]);

  const requestsFooterComponent = useMemo(() => {
    if (tab !== 'requests') return null;
    return (
      <View style={{ gap: spacing.lg }}>
        {suggestionsFooterComponent}
        {isFetchingMoreUsers ? (
          <View style={styles.footer}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : null}
      </View>
    );
  }, [isFetchingMoreUsers, suggestionsFooterComponent, tab, theme.colors.primary]);

  const handleLoadMore = useCallback(() => {
    if (tab === 'requests' && hasMoreUsers && !isFetchingMoreUsers) {
      fetchNextUsers();
    }
  }, [fetchNextUsers, hasMoreUsers, isFetchingMoreUsers, tab]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <HeaderBar title="Friends" subtitle="Manage your connections" />
      <View style={[styles.searchBar, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.muted} />
        <TextInput
          placeholder="Search people by name, username, department"
          placeholderTextColor={theme.colors.muted}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: theme.colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.tabRow}>{TABS.map(renderTabButton)}</View>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem as any}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
        ListEmptyComponent={listEmpty}
        ListHeaderComponent={requestsHeaderComponent}
        contentContainerStyle={data?.length ? styles.listContent : styles.emptyContainer}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListFooterComponent={requestsFooterComponent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.lg,
    borderBottomWidth: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  tabButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 14,
    fontWeight: '500',
  },
  /* Modern Card Styles */
  modernCard: {
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    marginVertical: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  largeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 2,
  },
  /* Request Actions */
  requestActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: spacing.xs,
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: spacing.xs,
  },
  declineBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  /* Friend Actions */
  friendActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  primaryActionBtn: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: spacing.xs,
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryActionBtn: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.xs,
  },
  secondaryActionText: {
    fontWeight: '600',
    fontSize: 14,
  },
  dangerActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Suggestion Actions */
  suggestionActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  suggestionPrimaryBtn: {
    flex: 1,
    minWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    gap: spacing.xs,
  },
  suggestionPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  suggestionSecondaryBtn: {
    flex: 1,
    minWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.xs,
  },
  suggestionSecondaryText: {
    fontWeight: '600',
    fontSize: 13,
  },
  suggestionDisabledBtn: {
    flex: 1,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
  },
  selfIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: spacing.md,
  },
  requestsHeaderContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  requestsSubtitle: {
    fontSize: 13,
  },
  seeAllLink: {
    fontWeight: '700',
    fontSize: 14,
  },
  suggestionsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: spacing.md,
    fontWeight: '600',
    fontSize: 15,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
