import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "./useUserRole";

export interface UserPermissions {
  can_view_dashboard: boolean;
  can_view_reporting: boolean;
  can_view_orders: boolean;
  can_view_companies: boolean;
  can_view_containers: boolean;
  can_view_intake: boolean;
  can_view_processing: boolean;
  can_view_maintenance: boolean;
  can_view_sampling: boolean;
  can_view_output: boolean;
  can_view_delivery_notes: boolean;
  can_view_documents: boolean;
  can_view_traceability: boolean;
  can_view_recipe_matching: boolean;
  can_view_sales_search: boolean;
  can_view_logistics: boolean;
  can_view_users: boolean;
  can_view_admin: boolean;
  can_view_audit_logs: boolean;
  can_view_api_docs: boolean;
  can_view_settings: boolean;
}

const defaultPermissions: UserPermissions = {
  can_view_dashboard: true,
  can_view_reporting: false,
  can_view_orders: false,
  can_view_companies: false,
  can_view_containers: false,
  can_view_intake: false,
  can_view_processing: false,
  can_view_maintenance: false,
  can_view_sampling: false,
  can_view_output: false,
  can_view_delivery_notes: false,
  can_view_documents: false,
  can_view_traceability: false,
  can_view_recipe_matching: false,
  can_view_sales_search: false,
  can_view_logistics: false,
  can_view_users: false,
  can_view_admin: false,
  can_view_audit_logs: false,
  can_view_api_docs: false,
  can_view_settings: false,
};

export function useUserPermissions() {
  const { user } = useAuth();
  const { role, isLoading: isRoleLoading } = useUserRole();
  const [permissions, setPermissions] = useState<UserPermissions>(defaultPermissions);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      if (!user) {
        setPermissions(defaultPermissions);
        setIsLoading(false);
        return;
      }

      try {
        // First check for custom permissions
        const { data: customPerms, error: customError } = await supabase
          .from("user_permissions")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (customError && customError.code !== "PGRST116") {
          console.error("Error fetching permissions:", customError);
        }

        if (customPerms) {
          // Use custom permissions
          setPermissions({
            can_view_dashboard: customPerms.can_view_dashboard ?? true,
            can_view_reporting: customPerms.can_view_reporting ?? false,
            can_view_orders: customPerms.can_view_orders ?? false,
            can_view_companies: customPerms.can_view_companies ?? false,
            can_view_containers: customPerms.can_view_containers ?? false,
            can_view_intake: customPerms.can_view_intake ?? false,
            can_view_processing: customPerms.can_view_processing ?? false,
            can_view_maintenance: customPerms.can_view_maintenance ?? false,
            can_view_sampling: customPerms.can_view_sampling ?? false,
            can_view_output: customPerms.can_view_output ?? false,
            can_view_delivery_notes: customPerms.can_view_delivery_notes ?? false,
            can_view_documents: customPerms.can_view_documents ?? false,
            can_view_traceability: customPerms.can_view_traceability ?? false,
            can_view_recipe_matching: customPerms.can_view_recipe_matching ?? false,
            can_view_sales_search: customPerms.can_view_sales_search ?? false,
            can_view_logistics: customPerms.can_view_logistics ?? false,
            can_view_users: customPerms.can_view_users ?? false,
            can_view_admin: customPerms.can_view_admin ?? false,
            can_view_audit_logs: customPerms.can_view_audit_logs ?? false,
            can_view_api_docs: customPerms.can_view_api_docs ?? false,
            can_view_settings: customPerms.can_view_settings ?? false,
          });
        } else if (role) {
          // Fall back to role-based defaults
          const { data: rolePerms } = await supabase
            .rpc("get_default_permissions_for_role", { role_name: role });

          if (rolePerms && typeof rolePerms === 'object' && !Array.isArray(rolePerms)) {
            setPermissions(rolePerms as unknown as UserPermissions);
          }
        }
      } catch (err) {
        console.error("Error fetching permissions:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (!isRoleLoading) {
      fetchPermissions();
    }
  }, [user, role, isRoleLoading]);

  return {
    permissions,
    isLoading: isLoading || isRoleLoading,
    canView: (module: keyof UserPermissions) => permissions[module],
  };
}
