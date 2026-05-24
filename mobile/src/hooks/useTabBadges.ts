import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { fetchConversations } from '../api/messages';
import { fetchUnreadCount } from '../api/notifications';

export type TabBadges = {
  home: number | null;
  official: number | null;
  messages: number | null;
  friends: number | null;
  notifications: number | null;
};

const KEYS = {
  home: 'badge_viewed_home',
  official: 'badge_viewed_official',
  messages: 'badge_viewed_messages',
  friends: 'badge_viewed_friends',
} as const;

async function readViewedCount(key: string) {
  const raw = await AsyncStorage.getItem(key);
  const value = Number(raw || '0');
  return Number.isFinite(value) ? value : 0;
}

async function writeViewedCount(key: string, value: number) {
  await AsyncStorage.setItem(key, String(Math.max(0, value)));
}

function extractCount(payload: any): number {
  if (typeof payload?.count === 'number') return payload.count;
  if (Array.isArray(payload?.results)) return payload.results.length;
  if (Array.isArray(payload)) return payload.length;
  return 0;
}

export async function fetchNoticesCount(): Promise<number> {
  const response = await api.get('/notices/', { params: { page: 1 } });
  return extractCount(response.data);
}

export async function fetchOfficialNoticesCount(): Promise<number> {
  const response = await api.get('/notices/official/');
  return extractCount(response.data);
}

export async function fetchFriendRequestCount(): Promise<number> {
  const response = await api.get('/users/friend-requests/', { params: { box: 'incoming' } });
  return extractCount(response.data);
}

export const markNoticesViewed = (count: number) => writeViewedCount(KEYS.home, count);
export const markOfficialNoticesViewed = (count: number) => writeViewedCount(KEYS.official, count);
export const markMessagesViewed = (count: number) => writeViewedCount(KEYS.messages, count);
export const markFriendRequestsViewed = (count: number) => writeViewedCount(KEYS.friends, count);

export const useTabBadges = () => {
  const [viewed, setViewed] = useState({ home: 0, official: 0, messages: 0, friends: 0 });

  useEffect(() => {
    let active = true;
    (async () => {
      const [home, official, messages, friends] = await Promise.all([
        readViewedCount(KEYS.home),
        readViewedCount(KEYS.official),
        readViewedCount(KEYS.messages),
        readViewedCount(KEYS.friends),
      ]);
      if (!active) return;
      setViewed({ home, official, messages, friends });
    })();
    return () => {
      active = false;
    };
  }, []);

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    refetchInterval: 30000,
  });

  const { data: unreadCountData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30000,
  });

  const { data: noticesCount = 0 } = useQuery({
    queryKey: ['notices-count'],
    queryFn: fetchNoticesCount,
    refetchInterval: 30000,
  });

  const { data: officialCount = 0 } = useQuery({
    queryKey: ['official-notices-count'],
    queryFn: fetchOfficialNoticesCount,
    refetchInterval: 30000,
  });

  const { data: friendRequestsCount = 0 } = useQuery({
    queryKey: ['friend-requests-count'],
    queryFn: fetchFriendRequestCount,
    refetchInterval: 30000,
  });

  return useMemo<TabBadges>(() => {
    const unreadMessages = conversations.reduce((sum: number, conv: any) => sum + (conv.unread_count ?? 0), 0);
    const homeBadge = Math.max(0, noticesCount - viewed.home);
    const officialBadge = Math.max(0, officialCount - viewed.official);
    const messagesBadge = Math.max(0, unreadMessages - viewed.messages);
    const friendsBadge = Math.max(0, friendRequestsCount - viewed.friends);

    return {
      home: homeBadge > 0 ? homeBadge : null,
      official: officialBadge > 0 ? officialBadge : null,
      messages: messagesBadge > 0 ? messagesBadge : null,
      friends: friendsBadge > 0 ? friendsBadge : null,
      notifications: unreadCountData?.unread_count ? unreadCountData.unread_count : null,
    };
  }, [conversations, noticesCount, officialCount, friendRequestsCount, unreadCountData?.unread_count, viewed]);
};
