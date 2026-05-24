// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import HeaderBar from '../components/HeaderBar';
import Card from '../components/Card';
import TweetCard, { NoticeAttachment } from '../components/TweetCard';
import { spacing } from '../theme';
import { api } from '../api/client';
import type { RootStackParamList } from '../App';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  FriendStatus,
  removeFriend,
  sendFriendRequest,
} from '../api/friends';
import { openConversation } from '../api/messages';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';
import ImagePreviewModal from '../components/ImagePreviewModal';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

type PublicProfile = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_faculty: boolean;
  is_staff: boolean;
  department?: string | null;
  designation?: string | null;
  school?: string | null;
  course?: string | null;
  academic_year?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  friend_status?: FriendStatus;
  friend_request_id?: number | null;
};

type NoticeListItem = {
  id: number;
  title: string;
  description: string;
  created_by: number;
  created_by_username: string;
  created_by_full_name?: string | null;
  created_by_avatar?: string | null;
  created_at: string;
  department?: string;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_favorited?: boolean;
  is_pinned?: boolean;
  attachments?: NoticeAttachment[];
  category?: string | null;
};

const AVATAR_FALLBACK = 'https://ui-avatars.com/api/?name=Bugema&background=4338CA&color=fff&size=96';

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId, name } = route.params;
  const { theme } = useTheme();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('unknown');
  const [friendRequestId, setFriendRequestId] = useState<number | null>(null);
  const { data: currentUser } = useCurrentUserProfile();
  const [previewVisible, setPreviewVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const response = await api.get(`/users/profiles/${userId}/public/`);
      setProfile(response.data);
    } catch (err) {
      setProfileError('Unable to load this profile.');
    } finally {
      setProfileLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile) {
      setFriendStatus(profile.friend_status ?? 'unknown');
      setFriendRequestId(profile.friend_request_id ?? null);
    }
  }, [profile]);

  const fetchPage = useCallback(
    async ({ pageParam = 1 }) => {
      const response = await api.get('/notices/', {
        params: {
          page: pageParam,
          created_by: userId,
        },
      });
      const payload = response.data;
      let results: NoticeListItem[] = [];
      let nextPage: number | undefined;
      if (Array.isArray(payload)) {
        results = payload as NoticeListItem[];
      } else if (payload && Array.isArray(payload.results)) {
        results = payload.results as NoticeListItem[];
        if (payload.next) {
          try {
            const parsed = new URL(payload.next, 'https://dummy');
            const nextParam = parsed.searchParams.get('page');
            if (nextParam) nextPage = Number(nextParam);
          } catch {
            nextPage = undefined;
          }
        }
      }
      const normalized = results.filter(
        (item): item is NoticeListItem => !!item && typeof item.id !== 'undefined',
      );
      return { results: normalized, nextPage };
    },
    [userId],
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
    isLoading: noticesLoading,
  } = useInfiniteQuery({
    queryKey: ['user-notices', userId],
    queryFn: fetchPage,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });

  const notices = useMemo(
    () =>
      data?.pages.flatMap((page) =>
        Array.isArray(page.results)
          ? page.results.filter((item): item is NoticeListItem => !!item && typeof item.id !== 'undefined')
          : [],
      ) ?? [],
    [data],
  );

  const refreshing = isFetching && !isFetchingNextPage;

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleToggleLike = useCallback(
    async (notice: NoticeListItem) => {
      if (!notice) return;
      try {
        const endpoint = notice.is_liked ? `/notices/${notice.id}/unlike/` : `/notices/${notice.id}/like/`;
        await api.post(endpoint);
      } finally {
        refetch();
      }
    },
    [refetch],
  );

  const handleToggleFavorite = useCallback(
    async (notice: NoticeListItem) => {
      if (!notice) return;
      try {
        const endpoint = notice.is_favorited ? `/notices/${notice.id}/unfavorite/` : `/notices/${notice.id}/favorite/`;
        await api.post(endpoint);
      } finally {
        refetch();
      }
    },
    [refetch],
  );

  const renderItem = ({ item }: { item: NoticeListItem }) => {
    const createdAtLabel = new Date(item.created_at).toLocaleString();
    return (
      <TweetCard
        {...item}
        created_at={createdAtLabel}
        onPress={() => navigation.navigate('NoticeDetail', { id: item.id })}
        onCommentPress={() => navigation.navigate('NoticeDetail', { id: item.id })}
        onLikeToggle={() => handleToggleLike(item)}
        onFavoriteToggle={() => handleToggleFavorite(item)}
      />
    );
  };

  const listEmpty = (
    <View style={styles.emptyState}>
      {noticesLoading ? (
        <>
          <ActivityIndicator />
          <Text style={[styles.emptyText, { color: theme.colors.muted }]}>Loading posts…</Text>
        </>
      ) : (
        <Text style={[styles.emptyText, { color: theme.colors.muted }]}>No posts yet.</Text>
      )}
    </View>
  );

  const isSelf = profile && currentUser && profile.id === currentUser.id;

  const handleSendFriendRequest = useCallback(async () => {
    if (!profile) return;
    try {
      const request = await sendFriendRequest(profile.id);
      setFriendStatus('outgoing');
      setFriendRequestId(request.id);
      Alert.alert('Request sent', 'Friend request sent successfully.');
    } catch (error: any) {
      const detail = error?.userMessage || error?.response?.data?.detail || 'Unable to send a friend request.';
      Alert.alert('Error', detail);
    }
  }, [profile]);

  const handleCancelFriendRequest = useCallback(async () => {
    if (!friendRequestId) return;
    try {
      await cancelFriendRequest(friendRequestId);
      setFriendStatus('none');
      setFriendRequestId(null);
    } catch {
      Alert.alert('Error', 'Unable to cancel this request.');
    }
  }, [friendRequestId]);

  const handleAcceptFriendRequest = useCallback(async () => {
    if (!friendRequestId) return;
    try {
      await acceptFriendRequest(friendRequestId);
      setFriendStatus('friends');
      setFriendRequestId(null);
      loadProfile();
    } catch {
      Alert.alert('Error', 'Unable to accept this request.');
    }
  }, [friendRequestId, loadProfile]);

  const handleDeclineFriendRequest = useCallback(async () => {
    if (!friendRequestId) return;
    try {
      await declineFriendRequest(friendRequestId);
      setFriendStatus('none');
      setFriendRequestId(null);
    } catch {
      Alert.alert('Error', 'Unable to decline this request.');
    }
  }, [friendRequestId]);

  const handleRemoveFriend = useCallback(async () => {
    if (!profile) return;
    Alert.alert('Remove friend', `Remove ${profile.first_name || profile.username} from your friends list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(profile.id);
            setFriendStatus('none');
          } catch {
            Alert.alert('Error', 'Unable to remove this friend.');
          }
        },
      },
    ]);
  }, [profile]);

  const handleMessageFriend = useCallback(async () => {
    if (!profile) return;
    try {
      const conversation = await openConversation({ recipient_id: profile.id });
      navigation.navigate('Conversation', {
        conversationId: conversation.id,
        title: displayName,
      });
    } catch (error: any) {
      const detail = error?.response?.data?.detail || 'Messaging is only available to friends.';
      Alert.alert('Unable to message', detail);
    }
  }, [displayName, navigation, profile]);

  const renderFriendActions = () => {
    if (!profile || isSelf) return null;
    switch (friendStatus) {
      case 'friends':
        return (
          <View style={styles.friendActions}>
            <TouchableOpacity
              style={[styles.friendPrimaryButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleMessageFriend}
            >
              <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.friendSecondaryButton, { borderColor: theme.colors.border }]}
              onPress={handleRemoveFriend}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Remove</Text>
            </TouchableOpacity>
          </View>
        );
      case 'incoming':
        return (
          <View style={styles.friendActions}>
            <TouchableOpacity
              style={[styles.friendPrimaryButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleAcceptFriendRequest}
            >
              <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.friendSecondaryButton, { borderColor: theme.colors.border }]}
              onPress={handleDeclineFriendRequest}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Decline</Text>
            </TouchableOpacity>
          </View>
        );
      case 'outgoing':
        return (
          <View style={styles.friendActions}>
            <View style={[styles.friendSecondaryButton, { borderColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.muted, fontWeight: '600' }}>Request sent</Text>
            </View>
            <TouchableOpacity
              style={[styles.friendSecondaryButton, { borderColor: theme.colors.border }]}
              onPress={handleCancelFriendRequest}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return (
          <View style={styles.friendActions}>
            <TouchableOpacity
              style={[styles.friendPrimaryButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSendFriendRequest}
            >
              <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Add Friend</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  const displayName =
    profile && (profile.first_name || profile.last_name)
      ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
      : profile?.username || name || 'Profile';

  return (
    <>
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <HeaderBar
        title={displayName}
        subtitle={profile?.department || 'Community member'}
        left={
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={notices}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Card>
              {profileLoading ? (
                <View style={styles.profileLoading}>
                  <ActivityIndicator />
                </View>
              ) : profile ? (
                <>
                  <View style={styles.profileRow}>
                    <TouchableOpacity onPress={() => setPreviewVisible(true)} activeOpacity={0.9}>
                      <Image
                        source={{ uri: profile.avatar_url || AVATAR_FALLBACK }}
                        style={styles.profileAvatar}
                      />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.profileName, { color: theme.colors.text }]}>{displayName}</Text>
                      <Text style={{ color: theme.colors.muted }}>@{profile.username}</Text>
                      {profile.designation ? (
                        <Text style={{ color: theme.colors.muted }}>{profile.designation}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.profileMetaGrid}>
                    {profile.department ? (
                      <View style={styles.metaChip}>
                        <MaterialCommunityIcons
                          name="office-building-marker-outline"
                          size={16}
                          color={theme.colors.primary}
                        />
                        <Text style={[styles.metaText, { color: theme.colors.text }]}>
                          {profile.department}
                        </Text>
                      </View>
                    ) : null}
                    {profile.school ? (
                      <View style={styles.metaChip}>
                        <MaterialCommunityIcons name="school-outline" size={16} color={theme.colors.primary} />
                        <Text style={[styles.metaText, { color: theme.colors.text }]}>{profile.school}</Text>
                      </View>
                    ) : null}
                  </View>
                  {profile.course || profile.academic_year ? (
                    <View style={styles.metaChip}>
                      <MaterialCommunityIcons name="book-open-page-variant" size={16} color={theme.colors.primary} />
                      <Text style={[styles.metaText, { color: theme.colors.text }]}>
                        {[profile.course, profile.academic_year].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  ) : null}
                  {profile.phone ? (
                    <View style={styles.metaChip}>
                      <MaterialCommunityIcons name="phone-outline" size={16} color={theme.colors.primary} />
                      <Text style={[styles.metaText, { color: theme.colors.text }]}>{profile.phone}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={{ color: theme.colors.text }}>{profileError ?? 'Profile unavailable.'}</Text>
              )}
            </Card>
            {!profileLoading && renderFriendActions()}
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Posts</Text>
          </View>
        }
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.colors.primary}
            onRefresh={() => {
              loadProfile();
              refetch();
            }}
          />
        }
        onEndReachedThreshold={0.5}
        onEndReached={handleEndReached}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator />
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
      </SafeAreaView>
      <ImagePreviewModal
        visible={previewVisible}
        uri={(profile?.avatar_url || AVATAR_FALLBACK) ?? undefined}
        onClose={() => setPreviewVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
  },
  profileMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  profileLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xl * 2,
  },
  friendActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  friendPrimaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
  },
  friendSecondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
  },
});
