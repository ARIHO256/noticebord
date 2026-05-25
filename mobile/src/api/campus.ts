import { api } from './client';

export interface StaffMember {
  id: number;
  name: string;
  staff_type: string;
  title: string;
  department: string;
  school: string;
  office_location: string;
  office_hours: string;
  phone: string;
  email: string;
  bio: string;
  photo_url: string | null;
}

export interface LostFoundItem {
  id: number;
  title: string;
  description: string;
  item_type: string;
  category: string;
  image_url: string | null;
  location_lost_found: string;
  date_lost_found: string;
  status: string;
  created_at: string;
}

export interface EmergencyContact {
  id: number;
  name: string;
  contact_type: string;
  phone: string;
  alt_phone: string;
  email: string;
  location: string;
  is_available_24_7: boolean;
}

export interface Venue {
  id: number;
  name: string;
  location: string;
  capacity: number | null;
  amenities: string[];
  image_url: string | null;
}

export const fetchStaffDirectory = async (params?: Record<string, any>) => {
  const { data } = await api.get('/campus/staff/', { params });
  return data;
};

export const fetchLostFound = async (params?: Record<string, any>) => {
  const { data } = await api.get('/campus/lost-found/', { params });
  return data;
};

export const createLostFound = async (payload: any) => {
  const { data } = await api.post('/campus/lost-found/', payload);
  return data;
};

export const claimLostFound = async (id: number, notes?: string) => {
  const { data } = await api.post(`/campus/lost-found/${id}/claim/`, { notes });
  return data;
};

export const fetchEmergencyContacts = async () => {
  const { data } = await api.get('/campus/emergency-contacts/');
  return data;
};

export const fetchEmergencyAlerts = async () => {
  const { data } = await api.get('/campus/emergency-alerts/');
  return data;
};

export const acknowledgeEmergencyAlert = async (id: number, lat?: number, lng?: number) => {
  const { data } = await api.post(`/campus/emergency-alerts/${id}/acknowledge/`, { lat, lng });
  return data;
};

export const fetchVenues = async () => {
  const { data } = await api.get('/campus/venues/');
  return data;
};
