import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'intake' | 'production' | 'qa' | 'customer' | 'supplier' | 'logistics';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching role:', error);
          setRole(null);
        } else {
          setRole(data?.role as AppRole);
        }
      } catch (err) {
        console.error('Error fetching role:', err);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRole();
  }, [user]);

  const isAdmin = role === 'admin';
  const isStaff = ['admin', 'intake', 'production', 'qa'].includes(role || '');
  const isSupplier = role === 'supplier';
  const isCustomer = role === 'customer';
  const isLogistics = role === 'logistics';

  return {
    role,
    isLoading,
    isAdmin,
    isStaff,
    isSupplier,
    isCustomer,
    isLogistics,
  };
}
