import { api } from './client';
import type { MiniUser } from './messages';

export type FriendStatus = 'unknown' | 'self' | 'friends' | 'incoming' | 'outgoing' | 'none';

export type FriendProfile = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
  friend_status?: FriendStatus;
  friend_request_id?: number | null;
  mutual_friend_count?: number;
};

export type FriendRequest = {
  id: number;
  sender: MiniUser;
  receiver: MiniUser;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at?: string | null;
};

export const fetchFriends = async (): Promise<FriendProfile[]> => {
  const response = await api.get<FriendProfile[]>('/users/friends/');
  return Array.isArray(response.data) ? response.data : [];
};

export const searchProfiles = async (query: string): Promise<FriendProfile[]> => {
  if (!query.trim()) return [];
  const response = await api.get<FriendProfile[]>('/users/profiles/', { params: { search: query } });
  const payload = response.data as any;
  if (Array.isArray(payload)) return payload as FriendProfile[];
  if (payload?.results) return payload.results as FriendProfile[];
  return [];
};

export const fetchAllProfiles = async (
  page = 1,
  search?: string,
): Promise<{ results: FriendProfile[]; nextPage?: number }> => {
  const params: Record<string, any> = { page };
  if (search && search.trim().length > 0) {
    params.search = search.trim();
  }
  const response = await api.get('/users/profiles/', { params });
  const payload = response.data as any;
  let results: FriendProfile[] = [];
  let nextPage: number | undefined;
  if (Array.isArray(payload)) {
    results = payload as FriendProfile[];
  } else if (payload?.results) {
    results = payload.results as FriendProfile[];
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

export const fetchFriendRequests = async (box: 'incoming' | 'outgoing' | 'all' = 'incoming') => {
  const response = await api.get<FriendRequest[]>('/users/friend-requests/', { params: { box } });
  const payload = response.data as any;
  if (Array.isArray(payload)) return payload as FriendRequest[];
  if (payload?.results) return payload.results as FriendRequest[];
  return [];
};

export const sendFriendRequest = async (userId: number) => {
  try {
    const response = await api.post<FriendRequest>('/users/friend-requests/', { receiver_id: userId });
    return response.data;
  } catch (err: any) {
    const data = err?.response?.data as any;
    const detail =
      (typeof data?.detail === 'string' && data.detail) ||
      (Array.isArray(data?.non_field_errors) && data.non_field_errors[0]) ||
      (Array.isArray(data?.receiver_id) && data.receiver_id[0]) ||
      'Unable to send friend request.';
    throw Object.assign(err, { userMessage: detail });
  }
};

export const cancelFriendRequest = async (requestId: number) => {
  await api.delete(`/users/friend-requests/${requestId}/`);
};

export const acceptFriendRequest = async (requestId: number) => {
  const response = await api.post<FriendRequest>(`/users/friend-requests/${requestId}/accept/`);
  return response.data;
};

export const declineFriendRequest = async (requestId: number) => {
  const response = await api.post<FriendRequest>(`/users/friend-requests/${requestId}/decline/`);
  return response.data;
};

export const removeFriend = async (userId: number) => {
  await api.delete(`/users/friends/${userId}/`);
};
