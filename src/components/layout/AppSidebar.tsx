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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import laurekuLogo from "@/assets/laureku-logo.png";

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

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { role, isLoading, isAdmin } = useUserRole();

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.roles) return role && item.roles.includes(role);
    return true;
  });

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-col hidden md:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border h-16">
        <img 
          src={laurekuLogo} 
          alt="LAUREKU Logo" 
          className="h-10 w-10 object-contain shrink-0"
        />
        {!collapsed && (
          <div className="flex flex-col animate-fade-in overflow-hidden">
            <span className="font-bold text-sidebar-foreground text-lg truncate">LAUREKU</span>
            <span className="text-xs text-sidebar-foreground/60 truncate">RecyTrack</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          {isLoading ? (
            <div className="space-y-2 p-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              const linkContent = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                    isActive && "bg-primary/10 text-primary font-medium",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && (
                    <span className="animate-fade-in truncate">{item.label}</span>
                  )}
                </NavLink>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.path} delayDuration={0}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })
          )}
        </nav>
      </ScrollArea>

      {/* QR Scanner Quick Action */}
      <div className="p-2 border-t border-sidebar-border">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <NavLink
                to="/scan"
                className="flex items-center justify-center w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90"
              >
                <QrCode className="h-5 w-5" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              QR Scannen
            </TooltipContent>
          </Tooltip>
        ) : (
          <NavLink
            to="/scan"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90"
          >
            <QrCode className="h-5 w-5" />
            <span>QR Scannen</span>
          </NavLink>
        )}
      </div>

      {/* Collapse Button */}
      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed && "justify-center"
          )}
        >
          <ChevronLeft className={cn("h-5 w-5 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span className="ml-2">Einklappen</span>}
        </Button>
      </div>
    </aside>
  );
}
