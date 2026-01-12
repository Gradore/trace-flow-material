import { useState, useEffect } from "react";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    user_id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  onSuccess: () => void;
}

interface Permissions {
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

const permissionLabels: Record<keyof Permissions, string> = {
  can_view_dashboard: "Dashboard",
  can_view_reporting: "Reporting",
  can_view_orders: "Aufträge",
  can_view_companies: "Firmen",
  can_view_containers: "Container",
  can_view_intake: "Materialeingang",
  can_view_processing: "Verarbeitung",
  can_view_maintenance: "Wartung",
  can_view_sampling: "Beprobung",
  can_view_output: "Ausgangsmaterial",
  can_view_delivery_notes: "Lieferscheine",
  can_view_documents: "Dokumente",
  can_view_traceability: "Rückverfolgung",
  can_view_recipe_matching: "KI Rezepturen",
  can_view_sales_search: "KI Vertrieb",
  can_view_logistics: "Logistik",
  can_view_users: "Benutzer",
  can_view_admin: "Admin",
  can_view_audit_logs: "Audit-Log",
  can_view_api_docs: "API-Docs",
  can_view_settings: "Einstellungen",
};

const permissionGroups = [
  {
    title: "Übersicht",
    permissions: ["can_view_dashboard", "can_view_reporting"] as (keyof Permissions)[],
  },
  {
    title: "Kernfunktionen",
    permissions: [
      "can_view_orders",
      "can_view_companies",
      "can_view_containers",
      "can_view_intake",
      "can_view_processing",
      "can_view_maintenance",
    ] as (keyof Permissions)[],
  },
  {
    title: "Qualität & Ausgabe",
    permissions: [
      "can_view_sampling",
      "can_view_output",
      "can_view_delivery_notes",
      "can_view_documents",
      "can_view_traceability",
    ] as (keyof Permissions)[],
  },
  {
    title: "KI & Spezial",
    permissions: [
      "can_view_recipe_matching",
      "can_view_sales_search",
      "can_view_logistics",
    ] as (keyof Permissions)[],
  },
  {
    title: "Administration",
    permissions: [
      "can_view_users",
      "can_view_admin",
      "can_view_audit_logs",
      "can_view_api_docs",
      "can_view_settings",
    ] as (keyof Permissions)[],
  },
];

const roles = [
  { value: "admin", label: "Administrator" },
  { value: "betriebsleiter", label: "Betriebsleiter" },
  { value: "intake", label: "Annahme" },
  { value: "production", label: "Produktion" },
  { value: "qa", label: "QA / Labor" },
  { value: "customer", label: "Kunde" },
  { value: "supplier", label: "Lieferant" },
  { value: "logistics", label: "Logistik" },
];

const defaultPermissions: Permissions = {
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

export function UserPermissionsDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserPermissionsDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [permissions, setPermissions] = useState<Permissions>(defaultPermissions);
  const [selectedRole, setSelectedRole] = useState(user?.role || "customer");

  useEffect(() => {
    if (user && open) {
      setSelectedRole(user.role);
      loadPermissions();
    }
  }, [user, open]);

  const loadPermissions = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // First check if user has custom permissions
      const { data: existingPerms, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", user.user_id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (existingPerms) {
        // Use existing permissions
        const perms: Permissions = {
          can_view_dashboard: existingPerms.can_view_dashboard ?? true,
          can_view_reporting: existingPerms.can_view_reporting ?? false,
          can_view_orders: existingPerms.can_view_orders ?? false,
          can_view_companies: existingPerms.can_view_companies ?? false,
          can_view_containers: existingPerms.can_view_containers ?? false,
          can_view_intake: existingPerms.can_view_intake ?? false,
          can_view_processing: existingPerms.can_view_processing ?? false,
          can_view_maintenance: existingPerms.can_view_maintenance ?? false,
          can_view_sampling: existingPerms.can_view_sampling ?? false,
          can_view_output: existingPerms.can_view_output ?? false,
          can_view_delivery_notes: existingPerms.can_view_delivery_notes ?? false,
          can_view_documents: existingPerms.can_view_documents ?? false,
          can_view_traceability: existingPerms.can_view_traceability ?? false,
          can_view_recipe_matching: existingPerms.can_view_recipe_matching ?? false,
          can_view_sales_search: existingPerms.can_view_sales_search ?? false,
          can_view_logistics: existingPerms.can_view_logistics ?? false,
          can_view_users: existingPerms.can_view_users ?? false,
          can_view_admin: existingPerms.can_view_admin ?? false,
          can_view_audit_logs: existingPerms.can_view_audit_logs ?? false,
          can_view_api_docs: existingPerms.can_view_api_docs ?? false,
          can_view_settings: existingPerms.can_view_settings ?? false,
        };
        setPermissions(perms);
      } else {
        // Get default permissions for role
        const { data: defaultPerms } = await supabase
          .rpc("get_default_permissions_for_role", { role_name: user.role });
        
        if (defaultPerms && typeof defaultPerms === 'object' && !Array.isArray(defaultPerms)) {
          setPermissions(defaultPerms as unknown as Permissions);
        } else {
          setPermissions(defaultPermissions);
        }
      }
    } catch (error: any) {
      console.error("Error loading permissions:", error);
      toast({
        title: "Fehler",
        description: "Berechtigungen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToRoleDefaults = async () => {
    if (!selectedRole) return;
    
    try {
      const { data: defaultPerms } = await supabase
        .rpc("get_default_permissions_for_role", { role_name: selectedRole });
      
      if (defaultPerms && typeof defaultPerms === 'object' && !Array.isArray(defaultPerms)) {
        setPermissions(defaultPerms as unknown as Permissions);
        toast({ title: "Berechtigungen auf Rollen-Standard zurückgesetzt" });
      }
    } catch (error: any) {
      console.error("Error resetting permissions:", error);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    setSelectedRole(newRole);
    
    // Get default permissions for new role
    try {
      const { data: defaultPerms } = await supabase
        .rpc("get_default_permissions_for_role", { role_name: newRole });
      
      if (defaultPerms && typeof defaultPerms === 'object' && !Array.isArray(defaultPerms)) {
        setPermissions(defaultPerms as unknown as Permissions);
      }
    } catch (error: any) {
      console.error("Error getting default permissions:", error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      // Update role - first delete all existing roles for this user, then insert the new one
      const roleValue = selectedRole as "admin" | "intake" | "production" | "qa" | "customer" | "supplier" | "logistics" | "betriebsleiter";
      
      // Delete all existing roles for this user
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.user_id);
      
      if (deleteError) throw deleteError;
      
      // Insert the new role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([{ user_id: user.user_id, role: roleValue }]);
      if (roleError) throw roleError;

      // Update or insert permissions
      const { data: existingPerms } = await supabase
        .from("user_permissions")
        .select("id")
        .eq("user_id", user.user_id)
        .single();

      if (existingPerms) {
        const { error: permError } = await supabase
          .from("user_permissions")
          .update(permissions)
          .eq("user_id", user.user_id);
        if (permError) throw permError;
      } else {
        const { error: permError } = await supabase
          .from("user_permissions")
          .insert([{ user_id: user.user_id, ...permissions }]);
        if (permError) throw permError;
      }

      toast({ title: "Benutzer aktualisiert" });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving:", error);
      toast({
        title: "Fehler beim Speichern",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (key: keyof Permissions) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Benutzer bearbeiten: {user.name}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              {/* Role Selection */}
              <div className="space-y-2">
                <Label>Rolle</Label>
                <div className="flex gap-2">
                  <Select value={selectedRole} onValueChange={handleRoleChange}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Rolle auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleResetToRoleDefaults}
                    title="Auf Rollen-Standard zurücksetzen"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bei Rollenwechsel werden die Berechtigungen auf den Standard der Rolle gesetzt.
                </p>
              </div>

              <Separator />

              {/* Permission Groups */}
              <div className="space-y-6">
                <h4 className="text-sm font-medium text-foreground">
                  Individuelle Berechtigungen
                </h4>
                
                {permissionGroups.map((group) => (
                  <div key={group.title} className="space-y-3">
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {group.title}
                    </h5>
                    <div className="grid gap-3">
                      {group.permissions.map((permKey) => (
                        <div
                          key={permKey}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <Label htmlFor={permKey} className="cursor-pointer">
                            {permissionLabels[permKey]}
                          </Label>
                          <Switch
                            id={permKey}
                            checked={permissions[permKey]}
                            onCheckedChange={() => togglePermission(permKey)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
