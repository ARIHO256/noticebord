import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { AuthContext } from '../context/AuthContext';

export type CurrentUserProfile = {
  id: number;
  username: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  department?: string | null;
  designation?: string | null;
  phone?: string | null;
  school?: string | null;
  course?: string | null;
  academic_year?: string | null;
  is_faculty?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
};

export const useCurrentUserProfile = () => {
  const { token } = useContext(AuthContext);
  return useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const response = await api.get<CurrentUserProfile>('/users/profiles/me/');
      return response.data;
    },
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 5,
  });
};
