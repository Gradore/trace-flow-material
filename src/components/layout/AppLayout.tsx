import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileSidebar } from "./MobileSidebar";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { Moon, Sun, Menu, LogOut, User, Settings, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useExport } from "@/hooks/useExport";
import { useIsMobile } from "@/hooks/use-mobile";
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

export function AppLayout({ children }: AppLayoutProps) {
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { exportToCSV } = useExport();
  const isMobile = useIsMobile();

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Initialize dark mode
  if (darkMode && !document.documentElement.classList.contains("dark")) {
    document.documentElement.classList.add("dark");
  }

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
      <div className={cn(
        "transition-all duration-300",
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
            {/* Export menu - hidden on very small screens */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden sm:flex">
                  <Download className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportToCSV("material_inputs")}>
                  Materialeingänge exportieren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToCSV("containers")}>
                  Container exportieren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToCSV("samples")}>
                  Proben exportieren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToCSV("output_materials")}>
                  Ausgangsmaterialien exportieren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToCSV("delivery_notes")}>
                  Lieferscheine exportieren
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
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
                <DropdownMenuItem onClick={() => navigate("/settings")} className="hidden md:flex">
                  <Settings className="mr-2 h-4 w-4" />
                  Einstellungen
                </DropdownMenuItem>
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
        
        {/* Footer */}
        <footer className="border-t border-border bg-muted/30 py-4 px-3 md:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>© {new Date().getFullYear()} RecyTrack</span>
            <nav className="flex items-center gap-4">
              <a href="/impressum" className="hover:text-foreground transition-colors">Impressum</a>
              <a href="/datenschutz" className="hover:text-foreground transition-colors">Datenschutz</a>
              <a href="/agb" className="hover:text-foreground transition-colors">AGB</a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
