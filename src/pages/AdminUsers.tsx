import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Clock, Building2, Info, ShieldAlert, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

type PendingRegistration = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  requested_role: string;
  company_name: string | null;
  company_id: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  user_id: string;
  email: string | null;
  name: string;
  role: string;
  created_at: string;
};

type UserRole = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type AppRole =
  | "admin"
  | "betriebsleiter"
  | "intake"
  | "production"
  | "qa"
  | "customer"
  | "supplier"
  | "logistics";

const roleOptions: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "betriebsleiter", label: "Betriebsleiter" },
  { value: "intake", label: "Annahme" },
  { value: "production", label: "Produktion" },
  { value: "qa", label: "QS/Labor" },
  { value: "customer", label: "Kunde" },
  { value: "supplier", label: "Lieferant" },
  { value: "logistics", label: "Logistik" },
];

const registrationStatusLabels: Record<string, string> = {
  pending: "Offen",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();

  // Historical registration requests. Self-registration is switched off, so no
  // new rows can arrive here - the table is kept for documentation only.
  const {
    data: registrations,
    isLoading: registrationsLoading,
    isError: registrationsError,
  } = useQuery({
    queryKey: ["pending-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_registrations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PendingRegistration[];
    },
    enabled: isAdmin,
  });

  // Get all profiles
  const {
    data: profiles,
    isLoading: profilesLoading,
    isError: profilesError,
  } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAdmin,
  });

  // Get all user roles
  const { data: userRoles, isError: userRolesError } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*");
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: isAdmin,
  });

  // The role swap runs in a single SECURITY DEFINER transaction. Deleting and
  // re-inserting from the client left the acting admin without any role when
  // RLS rejected the follow-up insert.
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase.rpc("set_user_role", {
        _user_id: userId,
        _role: newRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profiles-with-roles"] });
      toast.success("Rolle aktualisiert");
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const getRoleBadge = (role: string | null) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      admin: "destructive",
      betriebsleiter: "default",
      intake: "default",
      production: "default",
      qa: "secondary",
      customer: "outline",
      supplier: "outline",
      logistics: "secondary",
    };
    if (!role) {
      return <Badge variant="outline">Unbekannt</Badge>;
    }
    const label = roleOptions.find((r) => r.value === role)?.label;
    return <Badge variant={colors[role] || "outline"}>{label || role}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variant: "default" | "secondary" | "destructive" | "outline" =
      status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
    return <Badge variant={variant}>{registrationStatusLabels[status] || status}</Badge>;
  };

  // No fallback role: a missing row means the role is unknown, not "Kunde".
  const getUserRole = (userId: string): string | null => {
    const role = userRoles?.find((r) => r.user_id === userId);
    return role?.role || null;
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Benutzerverwaltung</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-medium">Kein Zugriff</p>
              <p className="text-sm text-muted-foreground">
                Diese Seite ist ausschließlich für Administratoren.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openRequests = registrations?.filter((r) => r.status === "pending").length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Benutzerverwaltung</h1>
        <p className="text-muted-foreground">Benutzerrollen verwalten und Registrierungsarchiv einsehen</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registrierungsarchiv</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{registrations?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {openRequests > 0 ? `davon ${openRequests} unbearbeitet` : "keine offenen Altanfragen"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktive Benutzer</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profiles?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Externe Nutzer</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userRoles?.filter((r) => ["customer", "supplier", "logistics"].includes(r.role)).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Alle Benutzer</TabsTrigger>
          <TabsTrigger value="registrations">Registrierungsarchiv</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Alle Benutzer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profilesError || userRolesError ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Benutzerdaten konnten nicht geladen werden. Bitte laden Sie die Seite neu.
                  </AlertDescription>
                </Alert>
              ) : profilesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : profiles?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Keine Benutzer vorhanden</div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>E-Mail</TableHead>
                        <TableHead>Rolle</TableHead>
                        <TableHead>Registriert</TableHead>
                        <TableHead>Rolle ändern</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles?.map((profile) => {
                        const isSelf = profile.user_id === currentUser?.id;
                        return (
                          <TableRow key={profile.id}>
                            <TableCell className="font-medium">{profile.name}</TableCell>
                            <TableCell>{profile.email || "-"}</TableCell>
                            <TableCell>{getRoleBadge(getUserRole(profile.user_id))}</TableCell>
                            <TableCell>
                              {format(new Date(profile.created_at), "dd.MM.yyyy", { locale: de })}
                            </TableCell>
                            <TableCell>
                              {isSelf ? (
                                <span className="text-xs text-muted-foreground">
                                  Eigene Rolle nicht änderbar
                                </span>
                              ) : (
                                <Select
                                  value={getUserRole(profile.user_id) || ""}
                                  disabled={updateRoleMutation.isPending}
                                  onValueChange={(value) =>
                                    updateRoleMutation.mutate({
                                      userId: profile.user_id,
                                      newRole: value as AppRole,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Rolle wählen" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roleOptions.map((role) => (
                                      <SelectItem key={role.value} value={role.value}>
                                        {role.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Registrierungsarchiv
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Die Selbstregistrierung ist deaktiviert. Neue Benutzer werden ausschließlich unter
                  „Benutzer“ von Administratoren angelegt. Diese Liste ist ein reines Archiv der
                  früheren Anfragen und kann nicht mehr bearbeitet werden.
                </AlertDescription>
              </Alert>

              {registrationsError ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Das Registrierungsarchiv konnte nicht geladen werden. Bitte laden Sie die Seite neu.
                  </AlertDescription>
                </Alert>
              ) : registrationsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : registrations?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Registrierungsanfragen vorhanden
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>E-Mail</TableHead>
                        <TableHead>Gewünschte Rolle</TableHead>
                        <TableHead>Firma</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Eingegangen</TableHead>
                        <TableHead>Bearbeitet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrations?.map((reg) => (
                        <TableRow key={reg.id}>
                          <TableCell className="font-medium">{reg.name}</TableCell>
                          <TableCell>{reg.email}</TableCell>
                          <TableCell>{getRoleBadge(reg.requested_role)}</TableCell>
                          <TableCell>{reg.company_name || "-"}</TableCell>
                          <TableCell>{getStatusBadge(reg.status)}</TableCell>
                          <TableCell>
                            {format(new Date(reg.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          </TableCell>
                          <TableCell>
                            {reg.reviewed_at
                              ? format(new Date(reg.reviewed_at), "dd.MM.yyyy HH:mm", { locale: de })
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
