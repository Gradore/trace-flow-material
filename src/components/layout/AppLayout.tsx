import { ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileSidebar } from "./MobileSidebar";
import { GlobalSearch } from "./GlobalSearch";
import { Footer } from "./Footer";
import { hasAccess } from "./navigation";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { Moon, Sun, Menu, LogOut, User, Settings, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useExport } from "@/hooks/useExport";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppLayoutProps {
  children: ReactNode;
}

const THEME_STORAGE_KEY = "rekuflow.theme";
const SIDEBAR_STORAGE_KEY = "rekuflow.sidebar.open";

function readDarkMode(): boolean {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) !== "light";
  } catch {
    return true; // storage unavailable - fall back to the default dark theme
  }
}

function readSidebarOpen(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "collapsed";
  } catch {
    return true;
  }
}

/**
 * Export targets and the nav path whose access rule they share - a role that
 * may not open the module must not be able to dump its table to CSV either.
 */
const EXPORT_ITEMS = [
  { table: "material_inputs", path: "/intake", label: "Materialeingänge exportieren" },
  { table: "containers", path: "/containers", label: "Container exportieren" },
  { table: "samples", path: "/sampling", label: "Proben exportieren" },
  { table: "output_materials", path: "/output", label: "Ausgangsmaterialien exportieren" },
  { table: "delivery_notes", path: "/delivery-notes", label: "Lieferscheine exportieren" },
] as const;

export function AppLayout({ children }: AppLayoutProps) {
  const [darkMode, setDarkMode] = useState(readDarkMode);
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { exportToCSV } = useExport();
  const isMobile = useIsMobile();
  const { role, isAdmin } = useUserRole();

  const exportItems = EXPORT_ITEMS.filter((item) => hasAccess(item.path, role, isAdmin));
  const canOpenSettings = hasAccess("/settings", role, isAdmin);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Apply the theme before the browser paints, otherwise every load of the
  // shell flashes the light palette first. The layout remounts on route switch.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? "dark" : "light");
    } catch {
      /* storage unavailable - the theme simply is not remembered */
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarOpen ? "open" : "collapsed");
    } catch {
      /* storage unavailable - the sidebar state simply is not remembered */
    }
  }, [sidebarOpen]);

  // Get user initials
  const userInitials = user?.user_metadata?.name
    ? user.user_metadata.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && <AppSidebar collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />}
      
      {/* Mobile Sidebar Drawer */}
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
      
      {/* Main Content */}
      {/* The margin transition is scoped to md so no sidebar animation can
          ever run on a phone, where the content is never offset. */}
      <div className={cn(
        "md:transition-all md:duration-300",
        !isMobile && (sidebarOpen ? "ml-64" : "ml-16"),
        isMobile && "ml-0"
      )}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-14 md:h-16 bg-background/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-3 md:px-6">
          <div className="flex items-center gap-2 md:gap-4 flex-1">
            {/* Mobile menu button */}
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            
            {/* Desktop sidebar toggle */}
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            
            <div className="flex-1 max-w-md">
              <GlobalSearch />
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {/* Export menu - only the modules the role may open, hidden on very small screens */}
            {exportItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden sm:flex">
                    <Download className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {exportItems.map((item) => (
                    <DropdownMenuItem key={item.table} onClick={() => exportToCSV(item.table)}>
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <NotificationDropdown />
            
            <Button variant="ghost" size="icon" onClick={toggleDarkMode} className="hidden sm:flex">
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">
                    {userInitials}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Mein Profil
                </DropdownMenuItem>
                {canOpenSettings && (
                  <DropdownMenuItem onClick={() => navigate("/settings")} className="hidden md:flex">
                    <Settings className="mr-2 h-4 w-4" />
                    Einstellungen
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {/* Mobile-only: Dark mode toggle */}
                <DropdownMenuItem onClick={toggleDarkMode} className="sm:hidden">
                  {darkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {darkMode ? "Hellmodus" : "Dunkelmodus"}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="sm:hidden" />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 md:p-6 min-h-[calc(100vh-3.5rem-4rem)] md:min-h-[calc(100vh-4rem-4rem)]">
          {children}
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
