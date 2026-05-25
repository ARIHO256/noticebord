import { api } from './client';

export interface Group {
  id: number;
  name: string;
  description: string;
  group_type: string;
  avatar_url: string | null;
  cover_image_url: string | null;
  course: string;
  department: string;
  school: string;
  academic_year: string;
  created_by: any;
  is_public: boolean;
  only_admin_can_post: boolean;
  member_count: number;
  is_member: boolean;
  user_role: string | null;
  created_at: string;
}

export interface GroupMessage {
  id: number;
  sender: any;
  content: string;
  attachment_url: string | null;
  attachment_type: string;
  attachment_name: string;
  created_at: string;
  edited_at: string | null;
  is_pinned: boolean;
  read_count: number;
}

export const fetchGroups = async (params?: Record<string, any>) => {
  const { data } = await api.get('/groups/', { params });
  return data;
};

export const fetchGroup = async (id: number) => {
  const { data } = await api.get(`/groups/${id}/`);
  return data;
};

export const createGroup = async (payload: any) => {
  const { data } = await api.post('/groups/', payload);
  return data;
};

export const joinGroup = async (id: number) => {
  const { data } = await api.post(`/groups/${id}/join/`);
  return data;
};

export const leaveGroup = async (id: number) => {
  const { data } = await api.post(`/groups/${id}/leave/`);
  return data;
};

export const fetchGroupMessages = async (id: number) => {
  const { data } = await api.get(`/groups/${id}/messages/`);
  return data;
};

export const sendGroupMessage = async (id: number, payload: any) => {
  const { data } = await api.post(`/groups/${id}/send-message/`, payload);
  return data;
};
