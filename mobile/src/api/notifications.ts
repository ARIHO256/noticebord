import { api } from './client';

export interface NotificationItem {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  sender: string | null;
  sender_name: string;
  sender_avatar: string;
  is_read: boolean;
  read_at: string | null;
  push_sent: boolean;
  created_at: string;
  time_ago: string;
}

export interface NotificationPreference {
  notify_new_notices: boolean;
  notify_official_notices: boolean;
  notify_messages: boolean;
  notify_friend_requests: boolean;
  notify_comments: boolean;
  notify_likes: boolean;
  notify_mentions: boolean;
  notify_reminders: boolean;
  push_new_notices: boolean;
  push_official_notices: boolean;
  push_messages: boolean;
  push_friend_requests: boolean;
  push_comments: boolean;
  push_likes: boolean;
  push_mentions: boolean;
  push_reminders: boolean;
  email_official_notices: boolean;
  email_suspension: boolean;
  email_reminders: boolean;
}

export interface UnreadCount {
  unread_count: number;
  total_count: number;
}

export const fetchNotifications = async (params?: { is_read?: boolean; type?: string }) => {
  const { data } = await api.get<{ results: NotificationItem[]; count: number }>('/notifications/', { params });
  return data;
};

export const fetchUnreadCount = async () => {
  const { data } = await api.get<UnreadCount>('/notifications/unread-count/');
  return data;
};

export const markNotificationsAsRead = async (ids?: string[]) => {
  const { data } = await api.post('/notifications/mark-read/', { ids });
  return data;
};

export const deleteNotifications = async (ids?: string[]) => {
  const { data } = await api.post('/notifications/delete/', { ids });
  return data;
};

export const fetchNotificationPreferences = async () => {
  const { data } = await api.get<NotificationPreference>('/notifications/preferences/');
  return data;
};

export const updateNotificationPreferences = async (preferences: Partial<NotificationPreference>) => {
  const { data } = await api.put('/notifications/preferences/', preferences);
  return data;
};
