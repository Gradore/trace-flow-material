import { useState } from "react";
import { Plus, Search, Users as UsersIcon, MoreVertical, Shield, Mail, UserCheck } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const roleConfig = {
  admin: { label: "Administrator", class: "bg-destructive/10 text-destructive border-destructive/20", icon: Shield },
  intake: { label: "Annahme", class: "bg-info/10 text-info border-info/20", icon: UserCheck },
  production: { label: "Produktion", class: "bg-warning/10 text-warning border-warning/20", icon: UserCheck },
  qa: { label: "QA / Labor", class: "bg-success/10 text-success border-success/20", icon: UserCheck },
  customer: { label: "Kunde (Nur Lesen)", class: "bg-secondary text-secondary-foreground", icon: UserCheck },
};

const mockUsers = [
  {
    id: "1",
    name: "Max Schmidt",
    email: "m.schmidt@recytrack.de",
    role: "admin",
    status: "active",
    lastActive: "vor 5 Min.",
  },
  {
    id: "2",
    name: "Klaus Weber",
    email: "k.weber@recytrack.de",
    role: "qa",
    status: "active",
    lastActive: "vor 12 Min.",
  },
  {
    id: "3",
    name: "Lisa Müller",
    email: "l.mueller@recytrack.de",
    role: "production",
    status: "active",
    lastActive: "vor 1 Std.",
  },
  {
    id: "4",
    name: "Thomas Braun",
    email: "t.braun@recytrack.de",
    role: "intake",
    status: "active",
    lastActive: "vor 2 Std.",
  },
  {
    id: "5",
    name: "FiberTech AG",
    email: "kontakt@fibertech.de",
    role: "customer",
    status: "active",
    lastActive: "vor 3 Tagen",
  },
];

export default function Users() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = mockUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Benutzerverwaltung</h1>
          <p className="text-muted-foreground mt-1">Benutzer und Rollen verwalten</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Benutzer einladen
        </Button>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(roleConfig).map(([key, config]) => {
          const count = mockUsers.filter((u) => u.role === key).length;
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

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach Name oder E-Mail..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Benutzer</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Letzte Aktivität</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              const role = roleConfig[user.role as keyof typeof roleConfig];
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {getInitials(user.name)}
                        </AvatarFallback>
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
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", role.class)}>
                      {role.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="status-badge-success">Aktiv</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.lastActive}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Profil bearbeiten</DropdownMenuItem>
                        <DropdownMenuItem>Rolle ändern</DropdownMenuItem>
                        <DropdownMenuItem>Passwort zurücksetzen</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Deaktivieren</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
