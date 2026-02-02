import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserCompanyInfo {
  companyId: string | null;
  companyName: string | null;
  isInternalStaff: boolean;
  userRole: string | null;
}

/**
 * Hook to get the current user's company information for multi-tenancy
 */
export function useMultiTenancy() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-company", user?.id],
    queryFn: async (): Promise<UserCompanyInfo> => {
      if (!user?.id) {
        return {
          companyId: null,
          companyName: null,
          isInternalStaff: false,
          userRole: null
        };
      }

      // Get user's role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const userRole = roleData?.role || null;
      
      // Check if internal staff
      const internalRoles = ["admin", "intake", "production", "qa", "betriebsleiter", "logistics"];
      const isInternalStaff = internalRoles.includes(userRole || "");

      // Get user's company from contacts
      const { data: contactData } = await supabase
        .from("contacts")
        .select(`
          company_id,
          companies:company_id (
            id,
            name
          )
        `)
        .eq("user_id", user.id)
        .single();

      // Handle the nested companies data
      const companyInfo = contactData?.companies as { id: string; name: string } | null;

      return {
        companyId: contactData?.company_id || null,
        companyName: companyInfo?.name || null,
        isInternalStaff,
        userRole
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  return {
    companyId: data?.companyId || null,
    companyName: data?.companyName || null,
    isInternalStaff: data?.isInternalStaff || false,
    userRole: data?.userRole || null,
    isLoading,
    error,
    
    /**
     * Check if the current user can access data for a given company
     */
    canAccessCompany: (targetCompanyId: string | null): boolean => {
      if (!data) return false;
      if (data.isInternalStaff) return true;
      if (!targetCompanyId) return false;
      return data.companyId === targetCompanyId;
    },

    /**
     * Filter a list of items to only include those the user can access
     */
    filterByCompanyAccess: <T extends { company_id?: string | null }>(items: T[]): T[] => {
      if (!data) return [];
      if (data.isInternalStaff) return items;
      return items.filter(item => item.company_id === data.companyId);
    }
  };
}
