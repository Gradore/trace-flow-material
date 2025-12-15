import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Inbox,
  Cog,
  FlaskConical,
  FileOutput,
  FileText,
  FolderOpen,
  History,
  Users,
  QrCode,
  ChevronLeft,
  Recycle,
  Settings,
  User,
  ClipboardList,
  Building2,
  Truck,
  ShoppingCart,
  Shield,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  roles?: string[];
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: BarChart3, label: "Reporting", path: "/reporting", roles: ['admin', 'intake', 'production', 'qa'] },
  { icon: ClipboardList, label: "Aufträge", path: "/orders", roles: ['admin', 'intake', 'production', 'qa', 'customer'] },
  { icon: Building2, label: "Firmen", path: "/companies", roles: ['admin', 'intake', 'logistics'] },
  { icon: Package, label: "Container", path: "/containers", roles: ['admin', 'intake', 'production', 'qa', 'logistics'] },
  { icon: Inbox, label: "Materialeingang", path: "/intake", roles: ['admin', 'intake'] },
  { icon: Cog, label: "Verarbeitung", path: "/processing", roles: ['admin', 'production'] },
  { icon: FlaskConical, label: "Beprobung", path: "/sampling", roles: ['admin', 'qa', 'production'] },
  { icon: FileOutput, label: "Ausgangsmaterial", path: "/output", roles: ['admin', 'production', 'qa'] },
  { icon: FileText, label: "Lieferscheine", path: "/delivery-notes", roles: ['admin', 'intake', 'production', 'logistics'] },
  { icon: FolderOpen, label: "Dokumente", path: "/documents", roles: ['admin', 'intake', 'production', 'qa'] },
  { icon: History, label: "Rückverfolgung", path: "/traceability", roles: ['admin', 'intake', 'production', 'qa'] },
  { icon: Truck, label: "Logistik", path: "/logistics", roles: ['admin', 'logistics'] },
  { icon: ShoppingCart, label: "Kunden-Portal", path: "/customer-portal", roles: ['customer'] },
  { icon: Package, label: "Lieferanten-Portal", path: "/supplier-portal", roles: ['supplier'] },
  { icon: Users, label: "Benutzer", path: "/users", roles: ['admin'] },
  { icon: Shield, label: "Admin", path: "/admin/users", adminOnly: true },
  { icon: User, label: "Profil", path: "/profile" },
  { icon: Settings, label: "Einstellungen", path: "/settings", roles: ['admin'] },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { role, isLoading, isAdmin } = useUserRole();

  const filteredNavItems = navItems.filter(item => {
    // Admin-only items
    if (item.adminOnly) {
      return isAdmin;
    }
    
    // Items with role restrictions
    if (item.roles) {
      return role && item.roles.includes(role);
    }
    
    // Items without role restrictions (visible to all)
    return true;
  });

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Recycle className="h-6 w-6" />
        </div>
        {!collapsed && (
          <div className="flex flex-col animate-fade-in">
            <span className="font-bold text-sidebar-foreground text-lg">RecyTrack</span>
            <span className="text-xs text-sidebar-foreground/60">Materialverfolgung</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "nav-link",
                  isActive && "nav-link-active"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <span className="animate-fade-in">{item.label}</span>
                )}
              </NavLink>
            );
          })
        )}
      </nav>

      {/* QR Scanner Quick Action */}
      <div className="p-3 border-t border-sidebar-border">
        <NavLink
          to="/scan"
          className={cn(
            "flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90",
            collapsed && "px-0"
          )}
        >
          <QrCode className="h-5 w-5" />
          {!collapsed && <span>QR Scannen</span>}
        </NavLink>
      </div>

      {/* Collapse Button */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <ChevronLeft className={cn("h-5 w-5 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span className="ml-2">Einklappen</span>}
        </Button>
      </div>
    </aside>
  );
}
