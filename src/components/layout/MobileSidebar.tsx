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
  Settings,
  User,
  ClipboardList,
  Building2,
  Truck,
  ShoppingCart,
  Shield,
  BarChart3,
  Wrench,
  FileCode,
  ScrollText,
  Sparkles,
  Search,
  SlidersHorizontal,
  Upload,
  Archive,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  { icon: ClipboardList, label: "Aufträge", path: "/orders", roles: ['admin', 'betriebsleiter', 'intake', 'production', 'qa', 'customer'] },
  { icon: Building2, label: "Firmen", path: "/companies", roles: ['admin', 'betriebsleiter', 'intake', 'logistics'] },
  { icon: Package, label: "Container", path: "/containers", roles: ['admin', 'betriebsleiter', 'intake', 'production', 'qa', 'logistics'] },
  { icon: Inbox, label: "Materialeingang", path: "/intake", roles: ['admin', 'betriebsleiter', 'intake', 'production'] },
  { icon: Cog, label: "Verarbeitung", path: "/processing", roles: ['admin', 'betriebsleiter', 'production'] },
  { icon: Wrench, label: "Wartung", path: "/maintenance", roles: ['admin', 'betriebsleiter', 'production'] },
  { icon: FlaskConical, label: "Beprobung", path: "/sampling", roles: ['admin', 'betriebsleiter', 'qa', 'production'] },
  { icon: FileOutput, label: "Ausgangsmaterial", path: "/output", roles: ['admin', 'betriebsleiter', 'production', 'qa'] },
  { icon: FileText, label: "Lieferscheine", path: "/delivery-notes", roles: ['admin', 'betriebsleiter', 'intake', 'production', 'logistics'] },
  { icon: FolderOpen, label: "Dokumente", path: "/documents", roles: ['admin', 'betriebsleiter', 'intake', 'production', 'qa'] },
  { icon: Archive, label: "Archiv", path: "/archive", roles: ['admin', 'betriebsleiter', 'intake', 'production', 'qa'] },
  { icon: History, label: "Rückverfolgung", path: "/traceability", roles: ['admin', 'betriebsleiter', 'intake', 'production', 'qa'] },
  { icon: Upload, label: "Datenblatt-Upload", path: "/datasheet-upload", roles: ['admin', 'intake', 'production', 'qa'] },
  { icon: Sparkles, label: "KI Rezepturen", path: "/recipe-matching", roles: ['admin', 'production', 'qa', 'intake'] },
  { icon: Search, label: "KI Vertrieb", path: "/sales-search", roles: ['admin', 'production', 'qa', 'intake'] },
  { icon: Truck, label: "Logistik", path: "/logistics", roles: ['admin', 'betriebsleiter', 'logistics'] },
  { icon: ShoppingCart, label: "Kunden-Portal", path: "/customer-portal", roles: ['customer'] },
  { icon: Package, label: "Lieferanten-Portal", path: "/supplier-portal", roles: ['supplier'] },
  { icon: Users, label: "Benutzer", path: "/users", roles: ['admin', 'betriebsleiter'] },
  { icon: Shield, label: "Admin", path: "/admin/users", adminOnly: true },
  { icon: ScrollText, label: "Audit-Log", path: "/audit-logs", roles: ['admin', 'betriebsleiter'] },
  { icon: FileCode, label: "API-Docs", path: "/api-docs", roles: ['admin'] },
  { icon: User, label: "Profil", path: "/profile" },
  { icon: Settings, label: "Einstellungen", path: "/settings", roles: ['admin', 'betriebsleiter'] },
  { icon: SlidersHorizontal, label: "Admin-Einstellungen", path: "/admin-settings", adminOnly: true },
];

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const location = useLocation();
  const { role, isLoading, isAdmin } = useUserRole();

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.roles) return role && item.roles.includes(role);
    return true;
  });

  const handleNavClick = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
        <SheetHeader className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img 
              src={laurekuLogo} 
              alt="LAUREKU Logo" 
              className="h-10 w-10 object-contain"
            />
            <div className="flex flex-col">
              <SheetTitle className="text-sidebar-foreground text-lg font-bold">LAUREKU</SheetTitle>
              <span className="text-xs text-sidebar-foreground/60">RecyTrack</span>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
          <nav className="p-3 space-y-1">
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
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                      isActive && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })
            )}
          </nav>
        </ScrollArea>

        {/* QR Scanner Quick Action */}
        <div className="p-3 border-t border-sidebar-border">
          <NavLink
            to="/scan"
            onClick={handleNavClick}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90"
          >
            <QrCode className="h-5 w-5" />
            <span>QR Scannen</span>
          </NavLink>
        </div>
      </SheetContent>
    </Sheet>
  );
}
