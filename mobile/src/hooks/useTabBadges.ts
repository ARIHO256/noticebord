import { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { fetchConversations } from '../api/messages';
import { fetchNotifications } from '../api/notifications';

export type TabBadges = {
  home: number | null;
  official: number | null;
  messages: number | null;
  notifications: number | null;
};

/**
 * Custom hook to manage badge counts for tab navigation
 * Fetches unread counts for:
 * - Messages (unread conversations)
 * - Notifications (unread friend requests and notices)
 */
export const useTabBadges = () => {
  const [badges, setBadges] = useState<TabBadges>({
    home: null,
    official: null,
    messages: null,
    notifications: null,
  });

  // Fetch conversations to get unread message count
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch notifications to get unread notification count
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    // Calculate unread message count
    const unreadMessages = conversations.reduce((sum, conv) => sum + (conv.unread_count ?? 0), 0);

    // Calculate unread notification count
    const unreadNotifications = notifications.filter((notif) => !notif.read).length;

    setBadges({
      home: null, // Home has no badges for now
      official: null, // Official notices don't need unread badge (they're always fresh)
      messages: unreadMessages > 0 ? unreadMessages : null,
      notifications: unreadNotifications > 0 ? unreadNotifications : null,
    });
  }, [conversations, notifications]);

  return badges;
};
