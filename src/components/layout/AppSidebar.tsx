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
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: ClipboardList, label: "Aufträge", path: "/orders" },
  { icon: Building2, label: "Firmen", path: "/companies" },
  { icon: Package, label: "Container", path: "/containers" },
  { icon: Inbox, label: "Materialeingang", path: "/intake" },
  { icon: Cog, label: "Verarbeitung", path: "/processing" },
  { icon: FlaskConical, label: "Beprobung", path: "/sampling" },
  { icon: FileOutput, label: "Ausgangsmaterial", path: "/output" },
  { icon: FileText, label: "Lieferscheine", path: "/delivery-notes" },
  { icon: FolderOpen, label: "Dokumente", path: "/documents" },
  { icon: History, label: "Rückverfolgung", path: "/traceability" },
  { icon: Truck, label: "Logistik", path: "/logistics" },
  { icon: ShoppingCart, label: "Kunden-Portal", path: "/customer-portal" },
  { icon: Package, label: "Lieferanten-Portal", path: "/supplier-portal" },
  { icon: Users, label: "Benutzer", path: "/users" },
  { icon: User, label: "Profil", path: "/profile" },
  { icon: Settings, label: "Einstellungen", path: "/settings" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

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
        {navItems.map((item) => {
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
        })}
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
