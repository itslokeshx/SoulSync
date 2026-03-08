import { useQuery } from '@tanstack/react-query';
import * as api from '../api/backend';
import { useAuth } from '../auth/AuthContext';
import { useNetwork } from '../providers/NetworkProvider';

export const useDashboard = () => {
    const { user } = useAuth();
    const { isOnline } = useNetwork();

    return useQuery({
        queryKey: ['dashboard', user?._id],
        queryFn: () => api.getDashboard(),
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 2,
        enabled: isOnline,
    });
};
