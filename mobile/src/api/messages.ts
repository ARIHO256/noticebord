import { api } from './client';

export type MiniUser = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
};

export type Conversation = {
  id: number;
  notice?: number | null;
  notice_title?: string | null;
  other_user?: MiniUser | null;
  last_message_preview?: string;
  last_message_by?: number | null;
  last_message_at?: string | null;
  unread_count?: number;
  created_at: string;
  updated_at: string;
};

export type ConversationMessage = {
  id: number;
  sender: MiniUser;
  content: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  created_at: string;
  read_at?: string | null;
  // Some backends return delivery/read flags instead of timestamps
  delivered_at?: string | null;
  readAt?: string | null;
  deliveredAt?: string | null;
  is_delivered?: boolean;
  is_read?: boolean;
  is_mine: boolean;
  reply_to?: {
    id: number;
    content: string;
    sender: MiniUser;
    attachment_url?: string | null;
    attachment_type?: string | null;
    attachment_name?: string | null;
  } | null;
};

export const fetchConversations = async (): Promise<Conversation[]> => {
  const response = await api.get('/messages/conversations/');
  const payload: any = response.data;
  return Array.isArray(payload) ? payload : payload?.results || [];
};

export const openConversation = async (payload: {
  notice_id?: number;
  recipient_id?: number;
  first_message?: string;
}): Promise<Conversation> => {
  const response = await api.post<Conversation>('/messages/conversations/', payload);
  return response.data;
};

export const fetchConversationMessages = async (
  conversationId: number,
  page = 1,
): Promise<{ results: ConversationMessage[]; nextPage?: number }> => {
  const response = await api.get(`/messages/conversations/${conversationId}/messages/`, {
    params: { page },
  });
  const payload = response.data as any;
  let results: ConversationMessage[] = [];
  let nextPage: number | undefined;
  if (Array.isArray(payload)) {
    results = payload;
  } else if (payload?.results) {
    results = payload.results as ConversationMessage[];
    if (payload.next) {
      try {
        const parsed = new URL(payload.next, 'http://dummy');
        const pageParam = parsed.searchParams.get('page');
        if (pageParam) nextPage = Number(pageParam);
      } catch {
        nextPage = undefined;
      }
    }
  }
  return { results, nextPage };
};

export const sendConversationMessage = async (
  conversationId: number,
  payload: {
    content?: string;
    attachment?: {
      uri: string;
      type?: 'image' | 'video' | string | null;
      mimeType?: string | null;
      name?: string | null;
    } | null;
    replyToId?: number | null;
  },
) => {
  const content = payload.content?.trim() ?? '';
  const attachment = payload.attachment;
  const replyToId = payload.replyToId;

  if (attachment) {
    const formData = new FormData();
    if (content.trim()) {
      formData.append('content', content);
    }
    if (replyToId) {
      formData.append('reply_to', String(replyToId));
    }
    const isVideo = (attachment.type ?? '').startsWith('video');
    const fallbackName = isVideo ? `video-${Date.now()}.mp4` : `photo-${Date.now()}.jpg`;
    const name = attachment.name || fallbackName;
    const type =
      attachment.mimeType ||
      (isVideo ? 'video/mp4' : 'image/jpeg');

    formData.append('attachment', {
      uri: attachment.uri,
      name,
      type,
    } as any);
    const response = await api.post(`/messages/conversations/${conversationId}/messages/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as ConversationMessage;
  } else {
    const response = await api.post(`/messages/conversations/${conversationId}/messages/`, {
      content,
      reply_to: replyToId || undefined,
    });
    return response.data as ConversationMessage;
  }
};

export const getUnreadMessageCount = async (): Promise<number> => {
  try {
    const conversations = await fetchConversations();
    return conversations.reduce((sum, conv) => sum + (conv.unread_count ?? 0), 0);
  } catch (error) {
    console.error('Error fetching unread message count:', error);
    return 0;
  }
};

export const markConversationAsRead = async (conversationId: number): Promise<void> => {
  try {
    // Try to mark the conversation as read if the endpoint exists
    // This may be a PATCH or POST endpoint depending on backend implementation
    await api.post(`/messages/conversations/${conversationId}/mark-as-read/`);
  } catch (error) {
    // If endpoint doesn't exist, silently fail - the badge will still update on next refetch
    console.debug('mark-as-read endpoint not available, will update on next refetch');
  }
};
