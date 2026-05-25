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
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
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
import NoticeCard from '../components/NoticeCard';

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_HEIGHT = 160;
const AVATAR_SIZE = 100;

const AVATAR_FALLBACK = 'https://ui-avatars.com/api/?name=Bugema&background=4338CA&color=fff&size=96';

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  vice_chancellor: { label: 'Vice Chancellor', color: '#8B1A1A' },
  registrar: { label: 'Registrar', color: '#1565C0' },
  dean: { label: 'Dean', color: '#6A1B9A' },
  hod: { label: 'Head of Department', color: '#00695C' },
  lecturer: { label: 'Lecturer', color: '#2E7D32' },
  staff: { label: 'Staff', color: '#E65100' },
  student: { label: 'Student', color: '#757575' },
};

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
  bio?: string | null;
};

type NoticeItem = {
  id: number;
  title: string;
  description: string;
  created_by: number;
  created_by_username: string;
  created_by_full_name?: string | null;
  created_by_avatar?: string | null;
  created_by_is_staff?: boolean;
  created_by_is_faculty?: boolean;
  created_at: string;
  department?: string;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_favorited?: boolean;
  is_pinned?: boolean;
  priority?: string | null;
  attachments?: any[];
  category?: string | null;
};

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId, name } = route.params;
  const { theme } = useTheme();
  const { showError } = useToast();
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
        params: { page: pageParam, created_by: userId },
      });
      const payload = response.data;
      let results: NoticeItem[] = [];
      let nextPage: number | undefined;
      if (Array.isArray(payload)) {
        results = payload as NoticeItem[];
      } else if (payload && Array.isArray(payload.results)) {
        results = payload.results as NoticeItem[];
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
      return { results: results.filter((item) => !!item && typeof item.id !== 'undefined'), nextPage };
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
  } = useInfiniteQuery({
    queryKey: ['user-notices', userId],
    queryFn: fetchPage,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });

  const notices = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const refreshing = isFetching && !isFetchingNextPage;

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const isSelf = profile && currentUser && profile.id === currentUser.id;

  const displayName =
    profile && (profile.first_name || profile.last_name)
      ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
      : profile?.username || name || 'Profile';

  const designationLabel = useMemo(() => {
    if (!profile?.designation) return null;
    const cfg = ROLE_CONFIG[profile.designation.toLowerCase()];
    return cfg?.label || profile.designation;
  }, [profile?.designation]);

  // ─── Friend Actions ───
  const handleSendFriendRequest = useCallback(async () => {
    if (!profile) return;
    try {
      const request = await sendFriendRequest(profile.id);
      setFriendStatus('outgoing');
      setFriendRequestId(request.id);
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

  // ─── Facebook-style Action Buttons ───
  const renderFriendActions = () => {
    if (!profile || isSelf) return null;

    switch (friendStatus) {
      case 'friends':
        return (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.fbActionBtn, styles.fbActionPrimary, { backgroundColor: theme.colors.primary }]} onPress={handleMessageFriend}>
              <MaterialCommunityIcons name="facebook-messenger" size={16} color="#fff" />
              <Text style={styles.fbActionPrimaryText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fbActionBtn, styles.fbActionSecondary, { backgroundColor: theme.colors.border }]} onPress={handleRemoveFriend}>
              <MaterialCommunityIcons name="account-minus" size={16} color={theme.colors.text} />
              <Text style={[styles.fbActionSecondaryText, { color: theme.colors.text }]}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fbActionBtn, styles.fbActionSecondary, { backgroundColor: theme.colors.border }]} onPress={() => {}}>
              <MaterialCommunityIcons name="dots-horizontal" size={16} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        );
      case 'incoming':
        return (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.fbActionBtn, styles.fbActionPrimary, { backgroundColor: theme.colors.primary }]} onPress={handleAcceptFriendRequest}>
              <MaterialCommunityIcons name="account-check" size={16} color="#fff" />
              <Text style={styles.fbActionPrimaryText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fbActionBtn, styles.fbActionSecondary, { backgroundColor: theme.colors.border }]} onPress={handleDeclineFriendRequest}>
              <MaterialCommunityIcons name="close" size={16} color={theme.colors.text} />
              <Text style={[styles.fbActionSecondaryText, { color: theme.colors.text }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        );
      case 'outgoing':
        return (
          <View style={styles.actionRow}>
            <View style={[styles.fbActionBtn, styles.fbActionSecondary, { backgroundColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.muted} />
              <Text style={[styles.fbActionSecondaryText, { color: theme.colors.muted }]}>Request Sent</Text>
            </View>
            <TouchableOpacity style={[styles.fbActionBtn, styles.fbActionSecondary, { backgroundColor: theme.colors.border }]} onPress={handleCancelFriendRequest}>
              <MaterialCommunityIcons name="close" size={16} color={theme.colors.text} />
              <Text style={[styles.fbActionSecondaryText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.fbActionBtn, styles.fbActionPrimary, { backgroundColor: theme.colors.primary }]} onPress={handleSendFriendRequest}>
              <MaterialCommunityIcons name="account-plus" size={16} color="#fff" />
              <Text style={styles.fbActionPrimaryText}>Add Friend</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fbActionBtn, styles.fbActionSecondary, { backgroundColor: theme.colors.border }]} onPress={handleMessageFriend}>
              <MaterialCommunityIcons name="facebook-messenger" size={16} color={theme.colors.text} />
              <Text style={[styles.fbActionSecondaryText, { color: theme.colors.text }]}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fbActionBtn, styles.fbActionSecondary, { backgroundColor: theme.colors.border }]} onPress={() => {}}>
              <MaterialCommunityIcons name="dots-horizontal" size={16} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        );
    }
  };

  // ─── Cover Gradient Colors ───
  const coverColors = useMemo(() => {
    const base = theme.colors.primary;
    // Create a slightly darker variant for gradient
    return [base, base + 'CC'];
  }, [theme.colors.primary]);

  const renderNotice = ({ item }: { item: NoticeItem }) => (
    <NoticeCard
      notice={item}
      onComment={() => navigation.navigate('NoticeDetail', { id: item.id })}
      compact
    />
  );

  const listEmpty = (
    <View style={styles.emptyState}>
      {profileLoading ? (
        <ActivityIndicator />
      ) : (
        <>
          <MaterialCommunityIcons name="text-box-outline" size={48} color={theme.colors.muted} />
          <Text style={[styles.emptyText, { color: theme.colors.muted }]}>No posts yet</Text>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Back button overlay */}
      <View style={styles.backBtnOverlay}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={notices}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderNotice}
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
        ListHeaderComponent={
          <View>
            {/* Cover Photo Area */}
            <View style={[styles.coverArea, { backgroundColor: theme.colors.primary }]}>
              <View style={[styles.coverGradient, { backgroundColor: theme.colors.primary + '40' }]} />
            </View>

            {/* Profile Picture overlapping cover */}
            <View style={styles.avatarWrapper}>
              <TouchableOpacity onPress={() => setPreviewVisible(true)} activeOpacity={0.9}>
                <Image
                  source={{ uri: profile?.avatar_url || AVATAR_FALLBACK }}
                  style={[styles.profileAvatar, { borderColor: theme.colors.background }]}
                />
              </TouchableOpacity>
            </View>

            {/* Name & Info */}
            <View style={[styles.infoSection, { paddingHorizontal: spacing.lg }]}>
              {profileLoading ? (
                <ActivityIndicator style={{ marginTop: spacing.md }} />
              ) : profile ? (
                <>
                  <Text style={[styles.profileName, { color: theme.colors.text }]}>{displayName}</Text>
                  {designationLabel && (
                    <Text style={[styles.profileRole, { color: theme.colors.primary }]}>{designationLabel}</Text>
                  )}
                  {profile.bio && (
                    <Text style={[styles.profileBio, { color: theme.colors.muted }]}>{profile.bio}</Text>
                  )}

                  {/* Meta info chips */}
                  <View style={styles.metaRow}>
                    {profile.school && (
                      <View style={styles.metaChip}>
                        <MaterialCommunityIcons name="school-outline" size={14} color={theme.colors.muted} />
                        <Text style={[styles.metaChipText, { color: theme.colors.muted }]}>{profile.school}</Text>
                      </View>
                    )}
                    {profile.department && (
                      <View style={styles.metaChip}>
                        <MaterialCommunityIcons name="office-building-marker-outline" size={14} color={theme.colors.muted} />
                        <Text style={[styles.metaChipText, { color: theme.colors.muted }]}>{profile.department}</Text>
                      </View>
                    )}
                    {profile.course && (
                      <View style={styles.metaChip}>
                        <MaterialCommunityIcons name="book-open-page-variant" size={14} color={theme.colors.muted} />
                        <Text style={[styles.metaChipText, { color: theme.colors.muted }]}>{profile.course}</Text>
                      </View>
                    )}
                    {profile.academic_year && (
                      <View style={styles.metaChip}>
                        <MaterialCommunityIcons name="calendar-outline" size={14} color={theme.colors.muted} />
                        <Text style={[styles.metaChipText, { color: theme.colors.muted }]}>{profile.academic_year}</Text>
                      </View>
                    )}
                  </View>

                  {/* Action Buttons */}
                  {!isSelf && renderFriendActions()}
                </>
              ) : (
                <Text style={[styles.profileName, { color: theme.colors.text }]}>
                  {profileError ?? 'Profile unavailable.'}
                </Text>
              )}
            </View>

            {/* Posts Divider */}
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              <Text style={[styles.postsHeader, { color: theme.colors.text }]}>Posts</Text>
            </View>
          </View>
        }
        ListEmptyComponent={listEmpty}
      />

      <ImagePreviewModal
        visible={previewVisible}
        uri={(profile?.avatar_url || AVATAR_FALLBACK) ?? undefined}
        onClose={() => setPreviewVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backBtnOverlay: {
    position: 'absolute',
    top: 8,
    left: spacing.lg,
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverArea: {
    width: SCREEN_W,
    height: COVER_HEIGHT,
    position: 'relative',
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarWrapper: {
    marginTop: -AVATAR_SIZE / 2,
    paddingHorizontal: spacing.lg,
  },
  profileAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
  },
  infoSection: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  profileRole: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  profileBio: {
    fontSize: 14,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  fbActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  fbActionPrimary: {
    flex: 1,
  },
  fbActionSecondary: {
    flex: 1,
  },
  fbActionPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  fbActionSecondaryText: {
    fontWeight: '700',
    fontSize: 14,
  },
  divider: {
    height: 8,
    marginTop: spacing.md,
  },
  postsHeader: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyState: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
});
