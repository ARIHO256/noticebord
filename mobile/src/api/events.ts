import { api } from './client';

export interface Event {
  id: number;
  title: string;
  description: string;
  event_type: string;
  status: string;
  start_time: string;
  end_time: string;
  location: string;
  location_map_url: string;
  cover_image_url: string | null;
  max_attendees: number | null;
  requires_rsvp: boolean;
  is_recurring: boolean;
  attendees_count: number;
  is_full: boolean;
  user_rsvp: { status: string; notes: string } | null;
  created_by: any;
  department: string;
  school: string;
  is_featured: boolean;
  created_at: string;
}

export interface RSVP {
  id: number;
  event: number;
  status: string;
  notes: string;
  created_at: string;
}

export const fetchEvents = async (params?: Record<string, any>) => {
  const { data } = await api.get('/events/', { params });
  return data;
};

export const fetchEvent = async (id: number) => {
  const { data } = await api.get(`/events/${id}/`);
  return data;
};

export const createEvent = async (payload: any) => {
  const { data } = await api.post('/events/', payload);
  return data;
};

export const rsvpEvent = async (id: number, status: string, notes?: string) => {
  const { data } = await api.post(`/events/${id}/rsvp/`, { status, notes });
  return data;
};

export const cancelRSVP = async (id: number) => {
  const { data } = await api.post(`/events/${id}/cancel-rsvp/`);
  return data;
};

export const checkInEvent = async (id: number, code: string) => {
  const { data } = await api.post(`/events/${id}/check-in/`, { code });
  return data;
};

export const fetchFeaturedEvents = async () => {
  const { data } = await api.get('/events/featured/');
  return data;
};

export const fetchMyEvents = async () => {
  const { data } = await api.get('/events/my-events/');
  return data;
};
