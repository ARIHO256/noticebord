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
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

const TABS = [
  { key: 'requests', label: 'Requests' },
  { key: 'suggestions', label: 'Suggestions' },
  { key: 'friends', label: 'Your Friends' },
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

  const handleSendRequest = useCallback(async (profile: FriendProfile) => {
    try {
      await sendFriendRequest(profile.id);
      refreshAll();
      showSuccess(`Friend request sent to ${profile.first_name || profile.username}.`);
    } catch (err: any) {
      const detail = err?.userMessage || err?.response?.data?.detail || 'Unable to send friend request.';
      showError(detail);
    }
  }, [refreshAll]);

  const handleCancelRequest = useCallback(async (profile: FriendProfile) => {
    if (!profile.friend_request_id) return;
    try {
      await cancelFriendRequest(profile.friend_request_id);
      refreshAll();
      showSuccess('Friend request cancelled');
    } catch {
      showError('Unable to cancel this request.');
    }
  }, [refreshAll, showSuccess]);

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
  const filteredSuggestions = useMemo(() => {
    const flattened = (allUsersPages?.pages || []).flatMap((p) => p.results || []);
    const requestIds = new Set((incomingQuery.data || []).filter((req) => req?.sender?.id).map((req) => req.sender.id));
    return flattened.filter((profile) => profile?.id && !requestIds.has(profile.id)).filter(matchesQuery).slice(0, 12);
  }, [allUsersPages?.pages, incomingQuery.data, matchesQuery]);

  const currentUserId = currentUser?.id ?? null;

  const goToProfile = (userId: number, name: string) => {
    navigation.navigate('UserProfile', { userId, name });
  };

  // ─── Facebook-style Request Card ───
  const RequestCard = ({ request }: { request: FriendRequest }) => {
    const user = request.sender;
    const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username;
    const mutualCount = user.mutual_friend_count ?? 0;
    return (
      <View style={[styles.requestCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => goToProfile(user.id, name)} activeOpacity={0.8}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.requestAvatar} />
          ) : (
            <View style={[styles.requestAvatar, styles.avatarFallback, { backgroundColor: theme.colors.primary + '18' }]}>
              <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 22 }}>
                {name[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => goToProfile(user.id, name)} activeOpacity={0.8} style={{ marginTop: spacing.sm }}>
          <Text style={[styles.requestName, { color: theme.colors.text }]} numberOfLines={1}>{name}</Text>
        </TouchableOpacity>
        {mutualCount > 0 && (
          <Text style={[styles.mutualText, { color: theme.colors.muted }]}>{mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}</Text>
        )}
        <View style={{ marginTop: spacing.sm, gap: spacing.xs, width: '100%' }}>
          <TouchableOpacity
            style={[styles.fbPrimaryBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => handleAccept(request)}
            activeOpacity={0.7}
          >
            <Text style={styles.fbPrimaryBtnText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fbSecondaryBtn, { backgroundColor: theme.colors.border }]}
            onPress={() => handleDecline(request)}
            activeOpacity={0.7}
          >
            <Text style={[styles.fbSecondaryBtnText, { color: theme.colors.text }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Facebook-style Suggestion Card ───
  const SuggestionCard = ({ profile }: { profile: FriendProfile }) => {
    const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.username;
    const mutualCount = profile.mutual_friend_count ?? 0;
    const status = profile.friend_status ?? 'none';
    const isSelf = currentUserId === profile.id;

    return (
      <View style={[styles.requestCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => goToProfile(profile.id, name)} activeOpacity={0.8}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.requestAvatar} />
          ) : (
            <View style={[styles.requestAvatar, styles.avatarFallback, { backgroundColor: theme.colors.primary + '18' }]}>
              <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 22 }}>
                {name[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => goToProfile(profile.id, name)} activeOpacity={0.8} style={{ marginTop: spacing.sm }}>
          <Text style={[styles.requestName, { color: theme.colors.text }]} numberOfLines={1}>{name}</Text>
        </TouchableOpacity>
        {mutualCount > 0 && (
          <Text style={[styles.mutualText, { color: theme.colors.muted }]}>{mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}</Text>
        )}
        <View style={{ marginTop: spacing.sm, gap: spacing.xs, width: '100%' }}>
          {isSelf ? (
            <View style={[styles.fbDisabledBtn, { backgroundColor: theme.colors.border }]}>
              <Text style={[styles.fbSecondaryBtnText, { color: theme.colors.muted }]}>You</Text>
            </View>
          ) : status === 'friends' ? (
            <TouchableOpacity
              style={[styles.fbPrimaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => handleMessage(profile)}
              activeOpacity={0.7}
            >
              <Text style={styles.fbPrimaryBtnText}>Message</Text>
            </TouchableOpacity>
          ) : status === 'outgoing' ? (
            <>
              <View style={[styles.fbDisabledBtn, { backgroundColor: theme.colors.border }]}>
                <Text style={[styles.fbSecondaryBtnText, { color: theme.colors.muted }]}>Request sent</Text>
              </View>
              <TouchableOpacity
                style={[styles.fbSecondaryBtn, { backgroundColor: theme.colors.border }]}
                onPress={() => handleCancelRequest(profile)}
                activeOpacity={0.7}
              >
                <Text style={[styles.fbSecondaryBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : status === 'incoming' ? (
            <>
              <TouchableOpacity
                style={[styles.fbPrimaryBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  if (profile.friend_request_id) handleAccept({ id: profile.friend_request_id, sender: profile } as FriendRequest);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.fbPrimaryBtnText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fbSecondaryBtn, { backgroundColor: theme.colors.border }]}
                onPress={() => {
                  if (profile.friend_request_id) handleDecline({ id: profile.friend_request_id, sender: profile } as FriendRequest);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.fbSecondaryBtnText, { color: theme.colors.text }]}>Delete</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.fbPrimaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => handleSendRequest(profile)}
              activeOpacity={0.7}
            >
              <Text style={styles.fbPrimaryBtnText}>Add Friend</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ─── Facebook-style Friend Grid Card ───
  const FriendGridCard = ({ friend }: { friend: FriendProfile }) => {
    const name = `${friend.first_name ?? ''} ${friend.last_name ?? ''}`.trim() || friend.username;
    return (
      <View style={[styles.gridCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => goToProfile(friend.id, name)} activeOpacity={0.8}>
          {friend.avatar_url ? (
            <Image source={{ uri: friend.avatar_url }} style={styles.gridAvatar} />
          ) : (
            <View style={[styles.gridAvatar, styles.avatarFallback, { backgroundColor: theme.colors.primary + '18' }]}>
              <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 28 }}>
                {name[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.gridInfo}>
          <TouchableOpacity onPress={() => goToProfile(friend.id, name)} activeOpacity={0.8}>
            <Text style={[styles.gridName, { color: theme.colors.text }]} numberOfLines={1}>{name}</Text>
          </TouchableOpacity>
          {friend.department && (
            <Text style={[styles.gridMeta, { color: theme.colors.muted }]} numberOfLines={1}>{friend.department}</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.gridMenuBtn, { backgroundColor: theme.colors.border }]}
          onPress={() => {
            Alert.alert(name, undefined, [
              { text: 'Message', onPress: () => handleMessage(friend) },
              { text: 'View Profile', onPress: () => goToProfile(friend.id, name) },
              { text: 'Remove Friend', style: 'destructive', onPress: () => handleRemoveFriend(friend) },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabPill = ({ key, label }: typeof TABS[number]) => {
    const isActive = tab === key;
    const count = key === 'requests' ? filteredIncoming.length : 0;
    return (
      <TouchableOpacity
        key={key}
        onPress={() => setTab(key)}
        style={[
          styles.tabPill,
          {
            backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
            borderColor: isActive ? theme.colors.primary : theme.colors.border,
          },
        ]}
        activeOpacity={0.7}
      >
        <Text
          style={{
            color: isActive ? theme.colors.primaryContrast : theme.colors.text,
            fontWeight: isActive ? '700' : '600',
            fontSize: 14,
          }}
        >
          {label}
        </Text>
        {count > 0 && (
          <View style={[styles.tabBadge, { backgroundColor: isActive ? '#fff' : '#FF3B30' }]}>
            <Text style={{ color: isActive ? theme.colors.primary : '#fff', fontSize: 10, fontWeight: '800' }}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ─── Render Content by Tab ───
  const renderContent = () => {
    if (tab === 'requests') {
      return (
        <>
          {filteredIncoming.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Friend requests ({filteredIncoming.length})
              </Text>
              <View style={styles.horizontalCards}>
                {filteredIncoming.map((req) => (
                  <RequestCard key={`req-${req.id}`} request={req} />
                ))}
              </View>
            </View>
          )}
          {filteredIncoming.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-check-outline" size={48} color={theme.colors.muted} />
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>No friend requests</Text>
            </View>
          )}
        </>
      );
    }

    if (tab === 'suggestions') {
      return (
        <>
          {filteredSuggestions.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>People you may know</Text>
              <View style={styles.horizontalCards}>
                {filteredSuggestions.map((profile) => (
                  <SuggestionCard key={`sug-${profile.id}`} profile={profile} />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-search-outline" size={48} color={theme.colors.muted} />
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>No suggestions right now</Text>
            </View>
          )}
          {isFetchingMoreUsers && (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          )}
        </>
      );
    }

    // Your Friends tab
    return (
      <>
        {filteredFriends.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {filteredFriends.length} friend{filteredFriends.length === 1 ? '' : 's'}
            </Text>
            <View style={styles.friendGrid}>
              {filteredFriends.map((friend) => (
                <FriendGridCard key={`fr-${friend.id}`} friend={friend} />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group-outline" size={48} color={theme.colors.muted} />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>No friends yet</Text>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Facebook-style header */}
      <View style={[styles.fbHeader, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.fbHeaderTitle, { color: theme.colors.text }]}>Friends</Text>
        <TouchableOpacity
          style={[styles.findFriendsBtn, { backgroundColor: theme.colors.surface }]}
          onPress={() => setTab('suggestions')}
        >
          <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tab pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabPillRow}
      >
        {TABS.map(renderTabPill)}
      </ScrollView>

      {/* Search bar */}
      <View style={[styles.searchBar, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.muted} />
        <TextInput
          placeholder="Search friends"
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

      {/* Content */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
        contentContainerStyle={styles.scrollContent}
      >
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fbHeaderTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  findFriendsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tabPill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tabBadge: {
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  // Horizontal request/suggestion cards
  horizontalCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  requestCard: {
    width: GRID_CARD_WIDTH,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.sm,
    alignItems: 'center',
  },
  requestAvatar: {
    width: GRID_CARD_WIDTH - 16,
    height: GRID_CARD_WIDTH - 16,
    borderRadius: 10,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  mutualText: {
    fontSize: 12,
    marginTop: 2,
  },
  fbPrimaryBtn: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  fbPrimaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  fbSecondaryBtn: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  fbSecondaryBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  fbDisabledBtn: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Friend grid
  friendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridCard: {
    width: GRID_CARD_WIDTH,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridAvatar: {
    width: GRID_CARD_WIDTH,
    height: GRID_CARD_WIDTH,
  },
  gridInfo: {
    padding: spacing.sm,
    paddingBottom: spacing.xs,
  },
  gridName: {
    fontSize: 15,
    fontWeight: '700',
  },
  gridMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  gridMenuBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    padding: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
