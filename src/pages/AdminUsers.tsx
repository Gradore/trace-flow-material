import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserCheck, UserX, Users, Clock, Check, X, Building2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

type PendingRegistration = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  requested_role: string;
  company_name: string | null;
  company_id: string | null;
  status: string;
  created_at: string;
};

type Profile = {
  id: string;
  user_id: string;
  email: string;
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

export default function AdminUsers() {
  const [selectedRegistration, setSelectedRegistration] = useState<PendingRegistration | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [assignCompanyId, setAssignCompanyId] = useState("");
  const queryClient = useQueryClient();

  // Get pending registrations
  const { data: pendingRegistrations, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_registrations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as PendingRegistration[];
    },
  });

  // Get all profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Get all user roles
  const { data: userRoles } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*");
      if (error) throw error;
      return data as UserRole[];
    },
  });

  // Get companies for assignment
  const { data: companies } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, type")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ registration, companyId }: { registration: PendingRegistration; companyId?: string }) => {
      // Get current user for reviewer
      const { data: { user } } = await supabase.auth.getUser();
      const { data: reviewerProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      // Update registration status
      const { error: updateError } = await supabase
        .from("pending_registrations")
        .update({
          status: "approved",
          reviewed_by: reviewerProfile?.id,
          reviewed_at: new Date().toISOString(),
          company_id: companyId || null,
        })
        .eq("id", registration.id);
      if (updateError) throw updateError;

      // Add user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: registration.user_id,
          role: registration.requested_role as "admin" | "intake" | "production" | "qa" | "customer" | "supplier" | "logistics",
        });
      if (roleError) throw roleError;

      // If company assigned, create contact entry
      if (companyId) {
        const nameParts = registration.name.split(" ");
        const firstName = nameParts[0] || registration.name;
        const lastName = nameParts.slice(1).join(" ") || "";
        
        const { error: contactError } = await supabase
          .from("contacts")
          .insert({
            company_id: companyId,
            user_id: registration.user_id,
            first_name: firstName,
            last_name: lastName,
            email: registration.email,
            is_primary: false,
          });
        if (contactError) throw contactError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      toast.success("Benutzer freigegeben");
      setSelectedRegistration(null);
      setAssignCompanyId("");
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ registration, reason }: { registration: PendingRegistration; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: reviewerProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      const { error } = await supabase
        .from("pending_registrations")
        .update({
          status: "rejected",
          reviewed_by: reviewerProfile?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", registration.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-registrations"] });
      toast.success("Anfrage abgelehnt");
      setRejectDialogOpen(false);
      setSelectedRegistration(null);
      setRejectionReason("");
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      // Delete existing role
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (deleteError) throw deleteError;

      // Insert new role
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: newRole as "admin" | "intake" | "production" | "qa" | "customer" | "supplier" | "logistics",
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      toast.success("Rolle aktualisiert");
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const getRoleBadge = (role: string) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      admin: "destructive",
      intake: "default",
      production: "default",
      qa: "secondary",
      customer: "outline",
      supplier: "outline",
      logistics: "secondary",
    };
    const labels: Record<string, string> = {
      admin: "Admin",
      intake: "Annahme",
      production: "Produktion",
      qa: "QS/Labor",
      customer: "Kunde",
      supplier: "Lieferant",
      logistics: "Logistik",
    };
    return <Badge variant={colors[role] || "outline"}>{labels[role] || role}</Badge>;
  };

  const getUserRole = (userId: string) => {
    const role = userRoles?.find((r) => r.user_id === userId);
    return role?.role || "customer";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Benutzerverwaltung</h1>
        <p className="text-muted-foreground">Benutzer und Registrierungsanfragen verwalten</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offene Anfragen</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRegistrations?.length || 0}</div>
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

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Offene Anfragen
            {(pendingRegistrations?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingRegistrations?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="users">Alle Benutzer</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Registrierungsanfragen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
              ) : pendingRegistrations?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine offenen Anfragen
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
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRegistrations?.map((reg) => (
                        <TableRow key={reg.id}>
                          <TableCell className="font-medium">{reg.name}</TableCell>
                          <TableCell>{reg.email}</TableCell>
                          <TableCell>{getRoleBadge(reg.requested_role)}</TableCell>
                          <TableCell>{reg.company_name || "-"}</TableCell>
                          <TableCell>
                            {format(new Date(reg.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => setSelectedRegistration(reg)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Freigeben
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedRegistration(reg);
                                  setRejectDialogOpen(true);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
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

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Alle Benutzer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profilesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Lädt...</div>
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
                      {profiles?.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">{profile.name}</TableCell>
                          <TableCell>{profile.email}</TableCell>
                          <TableCell>{getRoleBadge(getUserRole(profile.user_id))}</TableCell>
                          <TableCell>
                            {format(new Date(profile.created_at), "dd.MM.yyyy", { locale: de })}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={getUserRole(profile.user_id)}
                              onValueChange={(value) =>
                                updateRoleMutation.mutate({ userId: profile.user_id, newRole: value })
                              }
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="intake">Annahme</SelectItem>
                                <SelectItem value="production">Produktion</SelectItem>
                                <SelectItem value="qa">QS/Labor</SelectItem>
                                <SelectItem value="customer">Kunde</SelectItem>
                                <SelectItem value="supplier">Lieferant</SelectItem>
                                <SelectItem value="logistics">Logistik</SelectItem>
                              </SelectContent>
                            </Select>
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

      {/* Approve Dialog */}
      <Dialog open={!!selectedRegistration && !rejectDialogOpen} onOpenChange={() => setSelectedRegistration(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer freigeben</DialogTitle>
          </DialogHeader>
          {selectedRegistration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{selectedRegistration.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">E-Mail</Label>
                  <p className="font-medium">{selectedRegistration.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Gewünschte Rolle</Label>
                  <p>{getRoleBadge(selectedRegistration.requested_role)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Angegebene Firma</Label>
                  <p className="font-medium">{selectedRegistration.company_name || "-"}</p>
                </div>
              </div>

              {(selectedRegistration.requested_role === "customer" || 
                selectedRegistration.requested_role === "supplier") && (
                <div className="space-y-2">
                  <Label>Firma zuweisen</Label>
                  <Select value={assignCompanyId} onValueChange={setAssignCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Firma auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.filter((c) => 
                        selectedRegistration.requested_role === "customer" 
                          ? c.type === "customer" || c.type === "both"
                          : c.type === "supplier" || c.type === "both"
                      ).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedRegistration(null)}>
                  Abbrechen
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({
                    registration: selectedRegistration,
                    companyId: assignCompanyId || undefined,
                  })}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? "Freigeben..." : "Freigeben"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anfrage ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Grund für Ablehnung</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Optional: Grund angeben..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedRegistration) {
                    rejectMutation.mutate({
                      registration: selectedRegistration,
                      reason: rejectionReason,
                    });
                  }
                }}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? "Ablehnen..." : "Ablehnen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
