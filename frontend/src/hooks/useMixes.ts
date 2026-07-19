import { useQuery } from '@tanstack/react-query';
import * as api from '../api/backend';
import { useAuth } from '../auth/AuthContext';
import { useNetwork } from '../providers/NetworkProvider';

export const useMixes = () => {
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  return useQuery({
    queryKey: ['mixes', user?._id],
    queryFn: () => (user ? api.getMixes() : api.getGuestMixes()),
    staleTime: 60 * 60 * 1000, // 1 hour stale time, cache updates weekly on backend
    retry: 2,
  });
};
