import React, { useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import {
  fetchNotifications,
  markNotificationsAsRead,
  deleteNotifications,
  type NotificationItem,
} from '../api/notifications';
import { useToast } from '../context/ToastContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useNotificationsWebSocket } from '../hooks/useWebSocket';

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const { showSuccess, showError } = useToast();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { token } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);

  // WebSocket for real-time notifications
  const { unreadCount: wsUnreadCount } = useNotificationsWebSocket(token);

  const {
    data: notificationsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(),
    refetchInterval: 30000,
  });

  const notifications = notificationsData?.results || [];

  const markReadMutation = useMutation({
    mutationFn: markNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showSuccess('Notifications deleted');
    },
    onError: (error: any) => {
      showError(error?.userMessage || 'Failed to delete notifications');
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (notifications.length > 0) {
        const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
        if (unreadIds.length > 0) {
          markReadMutation.mutate(unreadIds);
        }
      }
    }, [notifications.length]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleMarkAllRead = useCallback(() => {
    markReadMutation.mutate(undefined);
  }, [markReadMutation]);

  const handleDeleteAllRead = useCallback(() => {
    deleteMutation.mutate(undefined);
  }, [deleteMutation]);

  const handleNotificationPress = useCallback(
    (notification: NotificationItem) => {
      if (!notification.is_read) {
        markReadMutation.mutate([notification.id]);
      }

      const { notice_id, conversation_id } = notification.data || {};

      if (notification.notification_type === 'message' && conversation_id) {
        navigation.navigate('Conversation', { conversationId: conversation_id });
      } else if (
        ['notice', 'official_notice', 'comment', 'comment_reply', 'like'].includes(
          notification.notification_type,
        ) &&
        notice_id
      ) {
        navigation.navigate('NoticeDetail', { id: notice_id });
      }
    },
    [markReadMutation, navigation],
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
      case 'friend_accepted':
        return 'account-plus';
      case 'message':
        return 'message-text';
      case 'notice':
      case 'official_notice':
        return 'file-document';
      case 'comment':
      case 'comment_reply':
        return 'comment';
      case 'like':
        return 'thumb-up';
      case 'mention':
        return 'at';
      case 'suspension':
        return 'alert-circle';
      case 'reminder':
        return 'bell';
      default:
        return 'bell-outline';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'friend_request':
      case 'friend_accepted':
        return '#25D366';
      case 'message':
        return '#007AFF';
      case 'notice':
      case 'official_notice':
        return '#FF9500';
      case 'comment':
      case 'comment_reply':
        return '#5856D6';
      case 'like':
        return '#FF2D55';
      case 'suspension':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          {
            backgroundColor: theme.colors.card,
            opacity: item.is_read ? 0.85 : 1,
          },
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {!item.is_read && (
          <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
        )}

        <View style={styles.notificationContent}>
          <View style={styles.avatarContainer}>
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: getIconColor(item.notification_type) + '20' },
              ]}
            >
              <MaterialCommunityIcons
                name={getNotificationIcon(item.notification_type) as any}
                size={22}
                color={getIconColor(item.notification_type)}
              />
            </View>
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.message, { color: theme.colors.muted }]} numberOfLines={2}>
              {item.message}
            </Text>
            <Text style={[styles.time, { color: theme.colors.muted }]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
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
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Notifications</Text>
          <Text style={[styles.screenSubtitle, { color: theme.colors.muted }]}>
            {wsUnreadCount > 0 ? `${wsUnreadCount} unread` : 'Stay in the loop with campus news'}
          </Text>
        </View>
        {notifications.length > 0 && (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerButton}>
              <MaterialCommunityIcons name="check-all" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteAllRead} style={styles.headerButton}>
              <MaterialCommunityIcons name="delete-sweep" size={20} color={theme.colors.error || '#FF3B30'} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => `notification-${item.id}`}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        scrollIndicatorInsets={{ right: 1 }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bell-off" size={64} color={theme.colors.muted} />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>No notifications yet</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.muted }]}>
              You'll see notices, messages, and friend requests here
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
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
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  time: {
    fontSize: 11,
    marginTop: spacing.xs,
    fontWeight: '500',
    opacity: 0.7,
  },
  unreadDot: {
    position: 'absolute',
    left: 8,
    top: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 1,
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
