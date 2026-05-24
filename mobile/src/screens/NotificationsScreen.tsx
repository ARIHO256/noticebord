import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { fetchNotifications, type Notification } from '../api/notifications';
import { acceptFriendRequest, declineFriendRequest } from '../api/friends';
import { useToast } from '../context/ToastContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../App';

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const { showSuccess, showError } = useToast();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const markAsRead = useCallback(
    (notificationId: number) => {
      queryClient.setQueryData<Notification[] | undefined>(['notifications'], (prev) =>
        prev ? prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)) : prev,
      );
    },
    [queryClient],
  );

  const markAllAsRead = useCallback(() => {
    queryClient.setQueryData<Notification[] | undefined>(['notifications'], (prev) =>
      prev ? prev.map((n) => ({ ...n, read: true })) : [],
    );
  }, [queryClient]);

  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useFocusEffect(
    useCallback(() => {
      if (notifications.length > 0) {
        markAllAsRead();
      }
    }, [markAllAsRead, notifications.length]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAcceptFriendRequest = useCallback(
    async (notification: Notification) => {
      if (!notification.friend_request) return;
      try {
        await acceptFriendRequest(notification.friend_request.id);
        showSuccess('Friend request accepted');
        // Invalidate notifications query to update badge
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch (error: any) {
        showError(error?.userMessage || 'Failed to accept friend request');
      }
    },
    [queryClient, showSuccess, showError],
  );

  const handleDeclineFriendRequest = useCallback(
    async (notification: Notification) => {
      if (!notification.friend_request) return;
      try {
        await declineFriendRequest(notification.friend_request.id);
        showSuccess('Friend request declined');
        // Invalidate notifications query to update badge
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch (error: any) {
        showError(error?.userMessage || 'Failed to decline friend request');
      }
    },
    [queryClient, showSuccess, showError],
  );

  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      markAsRead(notification.id);
      if (notification.type === 'friend_request') {
        // Navigate to user profile
        if (notification.friend_request?.sender) {
          navigation.navigate('UserProfile', {
            userId: notification.friend_request.sender.id,
            name: notification.friend_request.sender.first_name || notification.friend_request.sender.username,
          });
        }
      } else if (notification.type === 'suspended_post') {
        // For suspended posts: allow navigation if notice_id exists
        // Backend will handle permissions (admin/staff can view, owners can view their own)
        if (notification.notice_id) {
          navigation.navigate('NoticeDetail', { id: notification.notice_id });
        } else {
          // Fallback: show alert if no notice_id
          Alert.alert(
            notification.title || 'Post Suspended',
            notification.message || 'Your post has been suspended due to a violation of community guidelines.',
            [{ text: 'OK' }]
          );
        }
      } else if (notification.type === 'notice' && notification.notice_id) {
        // Navigate to notice detail for regular notices
        navigation.navigate('NoticeDetail', { id: notification.notice_id });
      }
    },
    [markAsRead, navigation],
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'friend_request':
        return 'account-plus';
      case 'notice':
        return 'file-document';
      case 'suspended_post':
        return 'alert-circle';
      case 'comment':
        return 'comment';
      case 'like':
        return 'thumb-up';
      default:
        return 'bell';
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const isFriendRequest = item.type === 'friend_request';
    const avatar = item.avatar || item.notice_author?.avatar_url;

    return (
      <View>
        <TouchableOpacity
          style={[styles.notificationItem, { backgroundColor: theme.colors.card }]}
          onPress={() => !isFriendRequest && handleNotificationPress(item)}
          activeOpacity={0.7}
        >
          {/* Unread indicator */}
          {!item.read && <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />}

          <View style={styles.notificationContent}>
            {/* Avatar with Badge */}
            <View style={styles.avatarContainer}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.avatarText, { color: theme.colors.text }]}>
                    {(item.notice_author?.first_name || item.friend_request?.sender?.first_name || 'U')
                      .slice(0, 1)
                      .toUpperCase()}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor:
                      item.type === 'friend_request'
                        ? theme.colors.primary
                        : item.type === 'suspended_post'
                          ? (theme.colors.error || '#FF3B30')
                          : item.type === 'notice'
                            ? theme.colors.accent
                            : theme.colors.success,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={getNotificationIcon(item.type) as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={10}
                  color="#FFFFFF"
                />
              </View>
            </View>

            {/* Content */}
            <View style={styles.textContainer}>
              <Text style={[styles.message, { color: theme.colors.text }]} numberOfLines={3}>
                {item.message}
              </Text>
              {item.notice_title && (
                <Text style={[styles.noticeTitle, { color: theme.colors.muted }]} numberOfLines={1}>
                  {item.notice_title}
                </Text>
              )}
              <Text style={[styles.time, { color: theme.colors.muted }]}>{formatTime(item.created_at)}</Text>

              {/* Actions for friend requests - below content */}
              {isFriendRequest && item.friend_request && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.acceptButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => handleAcceptFriendRequest(item)}
                  >
                    <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.declineButton, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}
                    onPress={() => handleDeclineFriendRequest(item)}
                  >
                    <MaterialCommunityIcons name="close" size={16} color={theme.colors.text} />
                    <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600' }}>Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading && notifications.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.muted }]}>Loading notifications...</Text>
      </View>
    );
  }

  const headerHorizontalMargin = Math.max(12, Math.round(width * 0.05));

  const renderHeader = () => (
    <View style={[styles.headerWrapper, { marginHorizontal: headerHorizontalMargin }]}>
      <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Notification</Text>
      <Text style={[styles.screenSubtitle, { color: theme.colors.muted }]}>
        Stay in the loop with campus news and requests
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => `notification-${item.id}`}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        scrollIndicatorInsets={{ right: 1 }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bell-off" size={64} color={theme.colors.muted} />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>No notifications yet</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.muted }]}>
              You'll see friend requests and notices here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  headerWrapper: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  screenSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  notificationItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xs,
    marginVertical: spacing.xs,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  iconBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  noticeTitle: {
    fontSize: 12,
    marginBottom: spacing.xs,
    fontWeight: '500',
    opacity: 0.85,
  },
  time: {
    fontSize: 11,
    marginTop: spacing.xs,
    fontWeight: '500',
    opacity: 0.7,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  acceptButton: {
    flex: 1,
    minWidth: 60,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  declineButton: {
    flex: 1,
    minWidth: 60,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  unreadDot: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  separator: {
    height: 0,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
