import { useState, useEffect } from "react";
import { Plus, Search, Shield, Mail, UserCheck, Loader2, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { InviteUserDialog } from "@/components/users/InviteUserDialog";
import { UserPermissionsDialog } from "@/components/users/UserPermissionsDialog";

const roleConfig: Record<string, { label: string; class: string; icon: typeof Shield }> = {
  admin: { label: "Administrator", class: "bg-destructive/10 text-destructive border-destructive/20", icon: Shield },
  betriebsleiter: { label: "Betriebsleiter", class: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: HardHat },
  intake: { label: "Annahme", class: "bg-info/10 text-info border-info/20", icon: UserCheck },
  production: { label: "Produktion", class: "bg-warning/10 text-warning border-warning/20", icon: UserCheck },
  qa: { label: "QA / Labor", class: "bg-success/10 text-success border-success/20", icon: UserCheck },
  customer: { label: "Kunde", class: "bg-secondary text-secondary-foreground", icon: UserCheck },
  supplier: { label: "Lieferant", class: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: UserCheck },
  logistics: { label: "Logistik", class: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20", icon: UserCheck },
};

export default function Users() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!currentUser) return;
      const { data, error } = await supabase.rpc('has_role', { _user_id: currentUser.id, _role: 'admin' });
      if (!error && data) setIsAdmin(true);
    };
    checkAdminStatus();
  }, [currentUser]);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["profiles-with-roles"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase.from("user_roles").select("*");
      if (rolesError) throw rolesError;

      return (profiles || []).map(profile => ({
        ...profile,
        role: roles?.find(r => r.user_id === profile.user_id)?.role || 'customer',
      }));
    },
  });

  const filteredUsers = users.filter(
    (u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleUserClick = (user: typeof selectedUser) => {
    if (!isAdmin) return;
    setSelectedUser(user);
    setPermissionsDialogOpen(true);
  };

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Benutzerverwaltung</h1>
          <p className="text-muted-foreground mt-1">Benutzer und Rollen verwalten</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Benutzer anlegen
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {Object.entries(roleConfig).map(([key, config]) => {
          const count = roleCounts[key] || 0;
          const Icon = config.icon;
          return (
            <div key={key} className="glass-card rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", config.class.split(" ")[0])}>
                  <Icon className={cn("h-4 w-4", config.class.split(" ")[1])} />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Suchen nach Name oder E-Mail..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Benutzer</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Erstellt am</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Keine Benutzer vorhanden</TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const role = roleConfig[user.role] || roleConfig.customer;
                  return (
                    <TableRow 
                      key={user.id} 
                      className={cn(isAdmin && "cursor-pointer hover:bg-muted/50")}
                      onClick={() => handleUserClick(user)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", role.class)}>{role.label}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(user.created_at).toLocaleDateString("de-DE")}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <InviteUserDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} onSuccess={() => refetch()} />
      <UserPermissionsDialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen} user={selectedUser} onSuccess={() => refetch()} />
    </div>
  );
}
