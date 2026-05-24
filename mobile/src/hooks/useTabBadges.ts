import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchConversations } from '../api/messages';
import { fetchUnreadCount } from '../api/notifications';

export type TabBadges = {
  home: number | null;
  official: number | null;
  messages: number | null;
  friends: number | null;
  notifications: number | null;
};

/**
 * Custom hook to manage badge counts for tab navigation
 * Fetches unread counts for:
 * - Messages (unread conversations)
 * - Notifications (unread in-app notifications)
 * - Friends (pending friend requests)
 */
export const useTabBadges = () => {
  const [badges, setBadges] = useState<TabBadges>({
    home: null,
    official: null,
    messages: null,
    friends: null,
    notifications: null,
  });

  // Fetch conversations to get unread message count
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    refetchInterval: 30000,
  });

  // Fetch unread notification count
  const { data: unreadCountData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30000,
  });

  useEffect(() => {
    // Calculate unread message count
    const unreadMessages = conversations.reduce((sum: number, conv: any) => sum + (conv.unread_count ?? 0), 0);

    setBadges({
      home: null,
      official: null,
      messages: unreadMessages > 0 ? unreadMessages : null,
      friends: null, // Set by FriendsScreen
      notifications: unreadCountData?.unread_count ?? null,
    });
  }, [conversations, unreadCountData]);

  return badges;
};
